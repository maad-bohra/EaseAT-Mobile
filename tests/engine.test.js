import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb } from './helpers.js';
import { addDays, dayOfWeek, todayStr } from '../src/utils/dates.js';
import { createSubject, deleteSubject, listSubjects, updateSubject } from '../src/services/subject.service.js';
import { createEntry, deleteEntry, updateEntry, getWeeklyTimetable } from '../src/services/timetable.service.js';
import {
  bulkMark,
  createSession,
  deleteSession,
  generateSessions,
  listSessions,
  updateSessionStatus,
} from '../src/services/session.service.js';
import { rescheduleClass } from '../src/services/actions.js';
import {
  getAllPredictions,
  getSubjectPrediction,
  getSummary,
  getTodayAndUpcoming,
} from '../src/services/attendance.service.js';
import { createEvent, createEventRange, deleteEvent, getDayDetail, listEvents } from '../src/services/calendar.service.js';
import {
  countUnread,
  listNotifications,
  markAllRead,
  refreshNotifications,
} from '../src/services/notification.service.js';
import { eraseAllData, getSettings, updateSettings } from '../src/services/settings.service.js';
import { getDb } from '../src/db/database.js';

const today = todayStr();

/** First date after today that falls on the given weekday. */
function nextDow(dow) {
  let date = addDays(today, 1);
  while (dayOfWeek(date) !== dow) date = addDays(date, 1);
  return date;
}

async function dsa(extra = {}) {
  return createSubject({ name: 'DSA', ...extra });
}

beforeEach(async () => {
  await freshDb();
});

/* ------------------------------ the core promise ------------------------------ */

test('the same subject twice on one day makes two separate sessions', async () => {
  const s = await dsa();
  await createEntry({ subjectId: s.id, dayOfWeek: 1, startTime: '09:00', endTime: '10:00' });
  await createEntry({ subjectId: s.id, dayOfWeek: 1, startTime: '14:00', endTime: '15:00' });

  const monday = nextDow(1);
  const sessions = await listSessions({ from: monday, to: monday });
  assert.deepEqual(sessions.map((x) => x.startTime), ['09:00', '14:00']);
});

test('generation is idempotent and never overwrites a mark', async () => {
  const s = await dsa();
  await createEntry({ subjectId: s.id, dayOfWeek: 1, startTime: '09:00', endTime: '10:00' });
  const monday = nextDow(1);
  const [first] = await listSessions({ from: monday, to: monday });
  await updateSessionStatus(first.id, { status: 'PRESENT' });

  const before = (await listSessions()).length;
  const again = await generateSessions(today, addDays(today, 60));
  assert.equal(again.created, 0);
  assert.equal((await listSessions()).length, before);
  assert.equal((await listSessions({ from: monday, to: monday }))[0].status, 'PRESENT');
});

/* ------------------------------ academic calendar ------------------------------ */

test('a holiday removes unmarked classes but keeps marked ones', async () => {
  const s = await dsa();
  await createEntry({ subjectId: s.id, dayOfWeek: 1, startTime: '09:00', endTime: '10:00' });
  const m1 = nextDow(1);
  const m2 = addDays(m1, 7);
  const [second] = await listSessions({ from: m2, to: m2 });
  await updateSessionStatus(second.id, { status: 'PRESENT' });

  await createEvent({ date: m1, type: 'HOLIDAY', title: 'Festival' });
  await createEvent({ date: m2, type: 'HOLIDAY', title: 'Festival' });

  assert.equal((await listSessions({ from: m1, to: m1 })).length, 0);
  const kept = await listSessions({ from: m2, to: m2 });
  assert.equal(kept.length, 1);
  assert.equal(kept[0].status, 'PRESENT');
});

test('a working day overrides a holiday on the same date', async () => {
  const s = await dsa();
  await createEntry({ subjectId: s.id, dayOfWeek: 1, startTime: '09:00', endTime: '10:00' });
  const monday = nextDow(1);

  await createEvent({ date: monday, type: 'HOLIDAY', title: 'Long weekend' });
  assert.equal((await listSessions({ from: monday, to: monday })).length, 0);

  await createEvent({ date: monday, type: 'WORKING_DAY', title: 'Compensatory' });
  assert.equal((await listSessions({ from: monday, to: monday })).length, 1);
});

test('deleting a holiday brings the classes back', async () => {
  const s = await dsa();
  await createEntry({ subjectId: s.id, dayOfWeek: 1, startTime: '09:00', endTime: '10:00' });
  const monday = nextDow(1);
  const holiday = await createEvent({ date: monday, type: 'VACATION', title: 'Break' });
  assert.equal((await listSessions({ from: monday, to: monday })).length, 0);
  await deleteEvent(holiday.id);
  assert.equal((await listSessions({ from: monday, to: monday })).length, 1);
});

test('one-off classes survive a holiday', async () => {
  const s = await dsa();
  await createEntry({ subjectId: s.id, dayOfWeek: 1, startTime: '09:00', endTime: '10:00' });
  const monday = nextDow(1);
  await createSession({ subjectId: s.id, date: monday, startTime: '16:00', endTime: '17:00' });
  await createEvent({ date: monday, type: 'HOLIDAY', title: 'Holiday' });

  const left = await listSessions({ from: monday, to: monday });
  assert.deepEqual(left.map((x) => x.startTime), ['16:00']);
});

test('a multi-day range adds each date once and skips duplicates', async () => {
  const from = addDays(today, 3);
  const first = await createEventRange({ from, to: addDays(from, 2), type: 'VACATION', title: 'Mid-sem break' });
  assert.deepEqual(first, { created: 3, skipped: 0 });
  const second = await createEventRange({ from, to: addDays(from, 3), type: 'VACATION', title: 'Mid-sem break' });
  assert.deepEqual(second, { created: 1, skipped: 3 });
  assert.equal((await listEvents({ from, to: addDays(from, 3) })).length, 4);
  await assert.rejects(() => createEvent({ date: from, type: 'VACATION', title: 'Mid-sem break' }), /already in the calendar/);
});

test('day detail returns both events and classes', async () => {
  const s = await dsa();
  await createEntry({ subjectId: s.id, dayOfWeek: 2, startTime: '11:00', endTime: '12:00' });
  const tuesday = nextDow(2);
  await createEvent({ date: tuesday, type: 'EXAM', title: 'Internal I' });
  const detail = await getDayDetail(tuesday);
  assert.equal(detail.events[0].title, 'Internal I');
  assert.equal(detail.sessions.length, 1);
});

/* ------------------------------ timetable rules ------------------------------ */

test('overlapping slots are rejected, back-to-back slots are fine', async () => {
  const s = await dsa();
  await createEntry({ subjectId: s.id, dayOfWeek: 1, startTime: '09:00', endTime: '10:00' });
  await assert.rejects(
    () => createEntry({ subjectId: s.id, dayOfWeek: 1, startTime: '09:30', endTime: '10:30' }),
    /overlaps an existing class on Monday at 09:00/,
  );
  await createEntry({ subjectId: s.id, dayOfWeek: 1, startTime: '10:00', endTime: '11:00' });
  const week = await getWeeklyTimetable();
  assert.equal(week[1].entries.length, 2);
});

test('a class must end after it starts', async () => {
  const s = await dsa();
  await assert.rejects(
    () => createEntry({ subjectId: s.id, dayOfWeek: 1, startTime: '10:00', endTime: '09:00' }),
    /end after it starts/,
  );
});

test('editing a slot rebuilds future classes instead of duplicating them', async () => {
  const s = await dsa();
  const entry = await createEntry({ subjectId: s.id, dayOfWeek: 1, startTime: '09:00', endTime: '10:00' });
  const m1 = nextDow(1);
  const m2 = addDays(m1, 7);

  await updateEntry(entry.id, { subjectId: s.id, dayOfWeek: 1, startTime: '10:00', endTime: '11:00' });

  for (const day of [m1, m2]) {
    const rows = await listSessions({ from: day, to: day });
    assert.deepEqual(rows.map((x) => x.startTime), ['10:00'], `only the new time on ${day}`);
  }
});

test('removing a slot drops unmarked future classes and keeps history', async () => {
  const s = await dsa();
  const entry = await createEntry({ subjectId: s.id, dayOfWeek: 1, startTime: '09:00', endTime: '10:00' });

  // History: last two weeks, one marked.
  await generateSessions(addDays(today, -14), addDays(today, -1));
  const past = await listSessions({ to: addDays(today, -1) });
  assert.ok(past.length >= 2);
  await updateSessionStatus(past[0].id, { status: 'PRESENT' });

  const result = await deleteEntry(entry.id);
  assert.ok(result.removedFutureSessions > 0);
  assert.equal((await listSessions({ from: today })).length, 0);
  assert.equal((await listSessions({ to: addDays(today, -1) })).length, past.length);
});

/* ------------------------------ subjects ------------------------------ */

test('subject names are unique regardless of case', async () => {
  await dsa();
  await assert.rejects(() => createSubject({ name: 'dsa' }), /already have a subject/);
  const other = await createSubject({ name: 'Maths' });
  await assert.rejects(() => updateSubject(other.id, { name: 'DSA' }), /already have a subject/);
});

test('deleting a subject cascades and reports how much history went', async () => {
  const s = await dsa();
  await createEntry({ subjectId: s.id, dayOfWeek: 1, startTime: '09:00', endTime: '10:00' });
  const count = (await listSessions()).length;
  assert.ok(count > 0);
  const [listed] = await listSubjects();
  assert.equal(listed.weeklyClasses, 1);
  assert.equal(listed.sessionCount, count);

  const result = await deleteSubject(s.id);
  assert.equal(result.deletedSessions, count);
  assert.equal((await listSessions()).length, 0);
  assert.equal((await getWeeklyTimetable()).flatMap((d) => d.entries).length, 0);
});

test('validation: bad colour, credits and requirement are refused', async () => {
  await assert.rejects(() => createSubject({ name: 'X', color: 'green' }), /colour/);
  await assert.rejects(() => createSubject({ name: 'X', credits: 40 }), /Credits/);
  await assert.rejects(() => createSubject({ name: 'X', requiredAttendance: 150 }), /Required attendance/);
  await assert.rejects(() => createSubject({ name: '   ' }), /Name the subject/);
});

/* ------------------------------ attendance maths in context ------------------------------ */

async function markPattern(subjectId, statuses) {
  await createEntry({ subjectId, dayOfWeek: 1, startTime: '09:00', endTime: '10:00' });
  await generateSessions(addDays(today, -60), addDays(today, -1));
  const rows = (await listSessions({ subjectId, to: addDays(today, -1) })).slice(-statuses.length);
  assert.equal(rows.length, statuses.length);
  for (let i = 0; i < rows.length; i += 1) {
    await updateSessionStatus(rows[i].id, { status: statuses[i] });
  }
}

test('only present and absent count; cancelled classes are harmless', async () => {
  const s = await dsa();
  await markPattern(s.id, ['PRESENT', 'PRESENT', 'PRESENT', 'ABSENT', 'CANCELLED']);

  const summary = await getSummary();
  const row = summary.subjects[0];
  assert.equal(row.present, 3);
  assert.equal(row.absent, 1);
  assert.equal(row.cancelled, 1);
  assert.equal(row.counted, 4);
  assert.equal(row.percentage, 75);
  assert.equal(summary.overall.percentage, 75);
  assert.equal(summary.overall.required, 75);
});

test('a per-subject requirement overrides the default', async () => {
  const s = await dsa({ requiredAttendance: 90 });
  await markPattern(s.id, ['PRESENT', 'PRESENT', 'PRESENT', 'ABSENT']);
  const summary = await getSummary();
  assert.equal(summary.subjects[0].required, 90);
  assert.equal(summary.subjects[0].status, 'BELOW');
  assert.equal(summary.warnings.length, 1);

  const prediction = await getSubjectPrediction(s.id);
  assert.match(prediction.message, /Attend the next \d+ DSA classes to get back to 90%/);
  assert.equal((await getAllPredictions()).length, 1);
});

test('the default requirement comes from settings', async () => {
  const s = await dsa();
  await markPattern(s.id, ['PRESENT', 'PRESENT', 'PRESENT', 'ABSENT']);
  assert.equal((await getSummary()).subjects[0].status, 'AT_RISK'); // 75% vs 75% required
  await updateSettings({ requiredAttendance: 60 });
  assert.equal((await getSummary()).subjects[0].status, 'SAFE');
  assert.equal((await getSummary()).subjects[0].required, 60);
});

test('marking can be undone', async () => {
  const s = await dsa();
  await markPattern(s.id, ['PRESENT']);
  const [row] = await listSessions({ subjectId: s.id, status: 'PRESENT' });
  const undone = await updateSessionStatus(row.id, { status: 'PENDING' });
  assert.equal(undone.status, 'PENDING');
  assert.equal((await getSummary()).overall.totalCounted, 0);
});

test('bulk marking updates every selected class', async () => {
  const s = await dsa();
  await createEntry({ subjectId: s.id, dayOfWeek: 1, startTime: '09:00', endTime: '10:00' });
  await createEntry({ subjectId: s.id, dayOfWeek: 1, startTime: '14:00', endTime: '15:00' });
  const monday = nextDow(1);
  const rows = await listSessions({ from: monday, to: monday });
  const result = await bulkMark(rows.map((r) => r.id), 'PRESENT');
  assert.equal(result.updated, 2);
  assert.ok((await listSessions({ from: monday, to: monday })).every((r) => r.status === 'PRESENT'));
});

test('today and upcoming split correctly', async () => {
  const s = await dsa();
  for (let d = 0; d < 7; d += 1) {
    await createEntry({ subjectId: s.id, dayOfWeek: d, startTime: '09:00', endTime: '10:00' });
  }
  const { today: now, upcoming } = await getTodayAndUpcoming();
  assert.equal(now.length, 1);
  assert.equal(now[0].date, today);
  assert.ok(upcoming.length >= 6 && upcoming.every((x) => x.date > today));
});

/* ------------------------------ rescheduling ------------------------------ */

test('rescheduling cancels the original and creates a countable replacement', async () => {
  const s = await dsa();
  await createEntry({ subjectId: s.id, dayOfWeek: 1, startTime: '09:00', endTime: '10:00' });
  const monday = nextDow(1);
  const [original] = await listSessions({ from: monday, to: monday });
  const target = addDays(monday, 2);

  const moved = await rescheduleClass(original.id, {
    date: target,
    startTime: '11:00',
    endTime: '12:00',
    reason: 'Faculty on leave',
  });

  assert.equal(moved.original.status, 'CANCELLED');
  assert.equal(moved.original.notes, 'Rescheduled: Faculty on leave');
  assert.equal(moved.replacement.status, 'PENDING');
  assert.equal(moved.replacement.isRescheduled, true);
  assert.equal(moved.replacement.date, target);

  // Neither half counts until the student marks the new one.
  assert.equal((await getSummary()).overall.totalCounted, 0);
  await updateSessionStatus(moved.replacement.id, { status: 'PRESENT' });
  assert.equal((await getSummary()).overall.percentage, 100);

  const notes = await listNotifications();
  assert.ok(notes.some((n) => n.type === 'CLASS_RESCHEDULED'));

  const link = await getDb().get('SELECT * FROM rescheduled_classes');
  assert.equal(link.original_session_id, original.id);
  assert.equal(link.new_session_id, moved.replacement.id);
});

test('rescheduling refuses clashes and double moves', async () => {
  const s = await dsa();
  await createEntry({ subjectId: s.id, dayOfWeek: 1, startTime: '09:00', endTime: '10:00' });
  await createEntry({ subjectId: s.id, dayOfWeek: 2, startTime: '09:00', endTime: '10:00' });
  const monday = nextDow(1);
  const tuesday = nextDow(2);
  const [a] = await listSessions({ from: monday, to: monday });

  await assert.rejects(
    () => rescheduleClass(a.id, { date: tuesday, startTime: '09:00', endTime: '10:00' }),
    /already a class at that time/,
  );

  await rescheduleClass(a.id, { date: tuesday, startTime: '13:00', endTime: '14:00' });
  await assert.rejects(
    () => rescheduleClass(a.id, { date: tuesday, startTime: '15:00', endTime: '16:00' }),
    /already been moved/,
  );
});

test('one-off classes: added by hand, clash-checked, removable', async () => {
  const s = await dsa();
  const date = addDays(today, 2);
  const created = await createSession({ subjectId: s.id, date, startTime: '17:00', endTime: '18:00', notes: 'Extra lab' });
  assert.equal(created.timetableEntryId, null);
  assert.equal(created.notes, 'Extra lab');
  await assert.rejects(
    () => createSession({ subjectId: s.id, date, startTime: '17:00', endTime: '18:00' }),
    /already a class at that time/,
  );
  await deleteSession(created.id);
  assert.equal((await listSessions({ from: date, to: date })).length, 0);
});

/* ------------------------------ notifications ------------------------------ */

test('warnings are written once per day and can be cleared', async () => {
  const s = await dsa();
  await markPattern(s.id, ['PRESENT', 'ABSENT', 'ABSENT', 'ABSENT']);

  const first = await refreshNotifications();
  assert.ok(first.some((n) => n.type === 'BELOW_REQUIRED'));
  const second = await refreshNotifications();
  assert.equal(second.filter((n) => n.type === 'BELOW_REQUIRED').length, 0);

  assert.ok((await countUnread()) > 0);
  await markAllRead();
  assert.equal(await countUnread(), 0);
});

test('unmarked classes from yesterday are flagged', async () => {
  const s = await dsa();
  const yesterday = addDays(today, -1);
  await createSession({ subjectId: s.id, date: yesterday, startTime: '09:00', endTime: '10:00' });
  const made = await refreshNotifications();
  assert.ok(made.some((n) => n.type === 'MISSED_CLASS'));
});

test('a holiday tomorrow and an exam this week both notify', async () => {
  await createEvent({ date: addDays(today, 1), type: 'HOLIDAY', title: 'Diwali' });
  await createEvent({ date: addDays(today, 3), type: 'EXAM', title: 'Internal I' });
  const made = await refreshNotifications();
  const types = made.map((n) => n.type);
  assert.ok(types.includes('HOLIDAY_TOMORROW'));
  assert.ok(types.includes('EXAM_APPROACHING'));
});

/* ------------------------------ database behaviour ------------------------------ */

test('a failed transaction rolls everything back', async () => {
  const db = getDb();
  await assert.rejects(() =>
    db.transaction(async (tx) => {
      await tx.run(
        `INSERT INTO subjects (id, name, color, created_at, updated_at) VALUES ('a', 'Ghost', '#2F6F4E', 'x', 'x')`,
      );
      throw new Error('boom');
    }),
  );
  assert.equal((await listSubjects()).length, 0);
});

test('many concurrent writes stay consistent', async () => {
  const names = Array.from({ length: 25 }, (_, i) => `Subject ${i}`);
  const [, , ...created] = await Promise.all([
    getSummary(),
    listSubjects(),
    ...names.map((name) => createSubject({ name })),
  ]);
  assert.equal(created.length, 25);
  assert.equal((await listSubjects()).length, 25);
});

test('deleting a subject with foreign keys on removes its rows everywhere', async () => {
  const s = await dsa();
  await createEntry({ subjectId: s.id, dayOfWeek: 3, startTime: '09:00', endTime: '10:00' });
  await deleteSubject(s.id);
  const leftovers = await getDb().get('SELECT COUNT(*) AS n FROM attendance_sessions');
  assert.equal(leftovers.n, 0);
});

/* ------------------------------ settings ------------------------------ */

test('settings validate and erase resets everything', async () => {
  assert.equal((await getSettings()).requiredAttendance, 75);
  await assert.rejects(() => updateSettings({ name: 'A', requiredAttendance: 0 }), /between 1 and 100/);
  await assert.rejects(() => updateSettings({ name: 'A', requiredAttendance: 75, semester: 20 }), /Semester/);

  await updateSettings({ name: 'Priya', collegeName: 'IIT', semester: 5, year: 3, requiredAttendance: 80 });
  const saved = await getSettings();
  assert.deepEqual(saved, { name: 'Priya', collegeName: 'IIT', semester: 5, year: 3, requiredAttendance: 80 });

  const s = await dsa();
  await createEntry({ subjectId: s.id, dayOfWeek: 1, startTime: '09:00', endTime: '10:00' });
  await eraseAllData();
  assert.equal((await listSubjects()).length, 0);
  assert.equal((await listSessions()).length, 0);
  assert.deepEqual(await getSettings(), { name: '', collegeName: '', semester: null, year: null, requiredAttendance: 75 });
});
