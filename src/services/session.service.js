import { getDb } from '../db/database.js';
import { AppError } from '../utils/errors.js';
import { addDays, dayOfWeek, daysBetween, eachDateInRange, todayStr } from '../utils/dates.js';
import {
  assertTimeOrder,
  chunk,
  newId,
  nowIso,
  optionalText,
  placeholders,
  requireDate,
  requireStatus,
  requireTime,
} from '../utils/validate.js';

const BLOCKING_EVENT_TYPES = new Set(['HOLIDAY', 'VACATION', 'SEMESTER_END']);
const MAX_RANGE_DAYS = 400;

/**
 * Builds a map of "YYYY-MM-DD" -> { blocked, events } from the academic
 * calendar. A WORKING_DAY always wins over a holiday on the same date, which
 * is how colleges announce compensatory working Saturdays.
 */
export async function buildCalendarIndex(from, to) {
  const events = await getDb().all(
    'SELECT * FROM academic_calendar WHERE date >= ? AND date <= ? ORDER BY date',
    [from, to],
  );

  const index = new Map();
  for (const event of events) {
    const entry = index.get(event.date) || { blocked: false, workingDay: false, events: [] };
    entry.events.push(event);
    if (BLOCKING_EVENT_TYPES.has(event.type)) entry.blocked = true;
    if (event.type === 'WORKING_DAY') entry.workingDay = true;
    index.set(event.date, entry);
  }

  for (const entry of index.values()) {
    if (entry.workingDay) entry.blocked = false;
  }
  return index;
}

/**
 * Creates the attendance sessions implied by the weekly timetable for every
 * date in [from, to] that is not blocked by the academic calendar.
 *
 * Idempotent: an existing session for (subject, date, startTime) is never
 * duplicated and never overwritten, so regenerating cannot erase marks the
 * student already made.
 */
export async function generateSessions(from, to) {
  requireDate(from, 'From');
  requireDate(to, 'To');
  if (to < from) throw AppError.badRequest('The end date must be on or after the start date');
  if (daysBetween(from, to) > MAX_RANGE_DAYS) {
    throw AppError.badRequest(`Choose a range of ${MAX_RANGE_DAYS} days or less`);
  }

  const db = getDb();
  const entries = await db.all('SELECT * FROM timetable_entries WHERE active = 1 ORDER BY day_of_week, start_time');
  if (entries.length === 0) {
    return { created: 0, skippedHolidays: 0, existing: 0, removedOnHolidays: 0 };
  }

  const calendar = await buildCalendarIndex(from, to);
  const existing = await db.all(
    'SELECT subject_id, date, start_time FROM attendance_sessions WHERE date >= ? AND date <= ?',
    [from, to],
  );
  const existingKeys = new Set(existing.map((s) => `${s.subject_id}|${s.date}|${s.start_time}`));

  const toCreate = [];
  let skippedHolidays = 0;

  for (const date of eachDateInRange(from, to)) {
    if (calendar.get(date)?.blocked) {
      skippedHolidays += 1;
      continue;
    }
    const weekday = dayOfWeek(date);
    for (const entry of entries) {
      if (entry.day_of_week !== weekday) continue;
      if (entry.effective_from && date < entry.effective_from) continue;
      if (entry.effective_to && date > entry.effective_to) continue;

      const key = `${entry.subject_id}|${date}|${entry.start_time}`;
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      toCreate.push({ entry, date });
    }
  }

  const blockedDates = [...calendar.entries()].filter(([, value]) => value.blocked).map(([key]) => key);
  const now = nowIso();
  let created = 0;
  let removedOnHolidays = 0;

  await db.transaction(async (tx) => {
    for (const { entry, date } of toCreate) {
      const result = await tx.run(
        `INSERT OR IGNORE INTO attendance_sessions
           (id, subject_id, timetable_entry_id, date, start_time, end_time, status, is_rescheduled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'PENDING', 0, ?, ?)`,
        [newId(), entry.subject_id, entry.id, date, entry.start_time, entry.end_time, now, now],
      );
      created += result.changes;
    }

    // A holiday confirmed after sessions were generated removes the untouched
    // (PENDING) timetable sessions on that date. Anything the student already
    // marked, moved, or added by hand as a one-off class is left alone.
    for (const part of chunk(blockedDates, 100)) {
      const result = await tx.run(
        `DELETE FROM attendance_sessions
          WHERE status = 'PENDING' AND is_rescheduled = 0 AND timetable_entry_id IS NOT NULL
            AND date IN (${placeholders(part.length)})`,
        part,
      );
      removedOnHolidays += result.changes;
    }
  });

  return { created, existing: existing.length, skippedHolidays, removedOnHolidays };
}

/** Rebuilds the near future. Called after timetable or calendar edits and on app start. */
export function regenerateHorizon(days = 60) {
  const today = todayStr();
  return generateSessions(today, addDays(today, days));
}

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

const SESSION_SELECT = `
  SELECT a.*,
         s.name  AS subject_name,
         s.code  AS subject_code,
         s.color AS subject_color,
         t.classroom AS classroom,
         t.faculty   AS entry_faculty
    FROM attendance_sessions a
    JOIN subjects s ON s.id = a.subject_id
    LEFT JOIN timetable_entries t ON t.id = a.timetable_entry_id`;

export function serializeSession(row) {
  return {
    id: row.id,
    subjectId: row.subject_id,
    subject: {
      id: row.subject_id,
      name: row.subject_name,
      code: row.subject_code ?? null,
      color: row.subject_color,
    },
    timetableEntryId: row.timetable_entry_id ?? null,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    notes: row.notes ?? null,
    isRescheduled: Boolean(row.is_rescheduled),
    classroom: row.classroom ?? null,
    faculty: row.entry_faculty ?? null,
  };
}

/** Runs the shared session query with a WHERE clause and returns serialised rows. */
export async function fetchSessions(where = '', params = [], tail = 'ORDER BY a.date, a.start_time') {
  const rows = await getDb().all(`${SESSION_SELECT} ${where ? `WHERE ${where}` : ''} ${tail}`, params);
  return rows.map(serializeSession);
}

export async function listSessions({ from, to, subjectId, status } = {}) {
  const where = [];
  const params = [];
  if (from) {
    where.push('a.date >= ?');
    params.push(from);
  }
  if (to) {
    where.push('a.date <= ?');
    params.push(to);
  }
  if (subjectId) {
    where.push('a.subject_id = ?');
    params.push(subjectId);
  }
  if (status) {
    where.push('a.status = ?');
    params.push(status);
  }
  return fetchSessions(where.join(' AND '), params);
}

export async function getSession(id) {
  const [session] = await fetchSessions('a.id = ?', [id], '');
  if (!session) throw AppError.notFound('That class was not found');
  return session;
}

/* ------------------------------------------------------------------ */
/* Writing                                                             */
/* ------------------------------------------------------------------ */

export async function updateSessionStatus(id, { status, notes } = {}) {
  await getSession(id);

  const sets = [];
  const params = [];
  if (status !== undefined) {
    requireStatus(status);
    sets.push('status = ?', 'marked_at = ?');
    params.push(status, status === 'PENDING' ? null : nowIso());
  }
  if (notes !== undefined) {
    sets.push('notes = ?');
    params.push(optionalText(notes, 300, 'Note'));
  }
  if (sets.length === 0) throw AppError.badRequest('Nothing to update');

  sets.push('updated_at = ?');
  params.push(nowIso());
  await getDb().run(`UPDATE attendance_sessions SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
  return getSession(id);
}

export async function bulkMark(ids, status) {
  requireStatus(status);
  if (!ids || ids.length === 0) return { updated: 0 };

  const now = nowIso();
  let updated = 0;
  await getDb().transaction(async (tx) => {
    for (const part of chunk(ids, 100)) {
      const result = await tx.run(
        `UPDATE attendance_sessions SET status = ?, marked_at = ?, updated_at = ?
          WHERE id IN (${placeholders(part.length)})`,
        [status, status === 'PENDING' ? null : now, now, ...part],
      );
      updated += result.changes;
    }
  });
  return { updated };
}

/** Manually add a one-off class that is not on the weekly timetable. */
export async function createSession(data) {
  const db = getDb();
  const subject = await db.get('SELECT id FROM subjects WHERE id = ?', [data.subjectId]);
  if (!subject) throw AppError.notFound('That subject was not found');

  requireDate(data.date, 'Date');
  requireTime(data.startTime, 'Start time');
  requireTime(data.endTime, 'End time');
  assertTimeOrder(data.startTime, data.endTime);
  const status = requireStatus(data.status || 'PENDING');
  const notes = optionalText(data.notes, 300, 'Note');

  const clash = await db.get('SELECT id FROM attendance_sessions WHERE date = ? AND start_time = ?', [
    data.date,
    data.startTime,
  ]);
  if (clash) throw AppError.conflict('There is already a class at that time on that day');

  const id = newId();
  const now = nowIso();
  await db.run(
    `INSERT INTO attendance_sessions
       (id, subject_id, timetable_entry_id, date, start_time, end_time, status, notes, is_rescheduled, marked_at, created_at, updated_at)
     VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    [id, data.subjectId, data.date, data.startTime, data.endTime, status, notes, status === 'PENDING' ? null : now, now, now],
  );
  return getSession(id);
}

export async function deleteSession(id) {
  await getSession(id);
  await getDb().run('DELETE FROM attendance_sessions WHERE id = ?', [id]);
}

/**
 * Cancels the original class and creates the replacement as a fresh, countable
 * session. Both rows remain, linked through rescheduled_classes.
 */
export async function rescheduleSession(id, { date, startTime, endTime, reason } = {}) {
  const db = getDb();
  const original = await getSession(id);

  requireDate(date, 'New date');
  requireTime(startTime, 'Start time');
  requireTime(endTime, 'End time');
  assertTimeOrder(startTime, endTime);
  const why = optionalText(reason, 200, 'Reason');

  const alreadyMoved = await db.get('SELECT id FROM rescheduled_classes WHERE original_session_id = ?', [id]);
  if (alreadyMoved) throw AppError.conflict('That class has already been moved');

  const clash = await db.get('SELECT id FROM attendance_sessions WHERE date = ? AND start_time = ?', [date, startTime]);
  if (clash) throw AppError.conflict('There is already a class at that time on that day');

  const replacementId = newId();
  const now = nowIso();

  await db.transaction(async (tx) => {
    await tx.run(
      `UPDATE attendance_sessions SET status = 'CANCELLED', notes = ?, marked_at = ?, updated_at = ? WHERE id = ?`,
      [why ? `Rescheduled: ${why}` : 'Rescheduled', now, now, original.id],
    );
    await tx.run(
      `INSERT INTO attendance_sessions
         (id, subject_id, timetable_entry_id, date, start_time, end_time, status, notes, is_rescheduled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, 1, ?, ?)`,
      [
        replacementId,
        original.subjectId,
        original.timetableEntryId,
        date,
        startTime,
        endTime,
        `Moved from ${original.date} ${original.startTime}`,
        now,
        now,
      ],
    );
    await tx.run(
      `INSERT INTO rescheduled_classes (id, original_session_id, new_session_id, reason, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [newId(), original.id, replacementId, why, now],
    );
  });

  return { original: await getSession(original.id), replacement: await getSession(replacementId) };
}
