import { getDb } from '../db/database.js';
import { AppError } from '../utils/errors.js';
import { DAY_NAMES, timeToMinutes, todayStr } from '../utils/dates.js';
import { assertTimeOrder, newId, nowIso, optionalText, requireTime } from '../utils/validate.js';
import { regenerateHorizon } from './session.service.js';

function mapEntry(row) {
  return {
    id: row.id,
    subjectId: row.subject_id,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time,
    endTime: row.end_time,
    classroom: row.classroom ?? null,
    faculty: row.faculty ?? null,
    active: Boolean(row.active),
    subject: {
      id: row.subject_id,
      name: row.subject_name,
      code: row.subject_code ?? null,
      color: row.subject_color,
    },
  };
}

const ENTRY_SELECT = `
  SELECT t.*, s.name AS subject_name, s.code AS subject_code, s.color AS subject_color
    FROM timetable_entries t
    JOIN subjects s ON s.id = t.subject_id`;

function cleanInput(data) {
  const dayOfWeek = Number(data.dayOfWeek);
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    throw AppError.badRequest('Choose a day of the week');
  }
  const startTime = requireTime(data.startTime, 'Start time');
  const endTime = requireTime(data.endTime, 'End time');
  assertTimeOrder(startTime, endTime);
  return {
    subjectId: data.subjectId,
    dayOfWeek,
    startTime,
    endTime,
    classroom: optionalText(data.classroom, 40, 'Room'),
    faculty: optionalText(data.faculty, 80, 'Faculty'),
  };
}

/** Rejects overlapping slots on the same weekday, ignoring `ignoreId` on edits. */
async function assertNoOverlap({ dayOfWeek, startTime, endTime }, ignoreId = null) {
  const sameDay = await getDb().all(
    'SELECT id, start_time, end_time FROM timetable_entries WHERE day_of_week = ? AND active = 1 AND id != ?',
    [dayOfWeek, ignoreId ?? ''],
  );
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  const clash = sameDay.find((e) => start < timeToMinutes(e.end_time) && end > timeToMinutes(e.start_time));
  if (clash) {
    throw AppError.conflict(`That overlaps an existing class on ${DAY_NAMES[dayOfWeek]} at ${clash.start_time}`);
  }
}

export async function listTimetable() {
  const rows = await getDb().all(`${ENTRY_SELECT} ORDER BY t.day_of_week, t.start_time`);
  return rows.map(mapEntry);
}

/** The same list grouped by weekday (Sunday = 0), the shape the timetable screen wants. */
export async function getWeeklyTimetable() {
  const entries = await listTimetable();
  return DAY_NAMES.map((day, index) => ({
    dayOfWeek: index,
    day,
    entries: entries.filter((e) => e.dayOfWeek === index),
  }));
}

async function getEntry(id) {
  const row = await getDb().get(`${ENTRY_SELECT} WHERE t.id = ?`, [id]);
  if (!row) throw AppError.notFound('That class slot was not found');
  return mapEntry(row);
}

export async function createEntry(input) {
  const data = cleanInput(input);
  const subject = await getDb().get('SELECT id FROM subjects WHERE id = ?', [data.subjectId]);
  if (!subject) throw AppError.notFound('That subject was not found');
  await assertNoOverlap(data);

  const id = newId();
  const now = nowIso();
  await getDb().run(
    `INSERT INTO timetable_entries
       (id, subject_id, day_of_week, start_time, end_time, classroom, faculty, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [id, data.subjectId, data.dayOfWeek, data.startTime, data.endTime, data.classroom, data.faculty, now, now],
  );
  await regenerateHorizon();
  return getEntry(id);
}

export async function updateEntry(id, input) {
  await getEntry(id);
  const data = cleanInput(input);
  const subject = await getDb().get('SELECT id FROM subjects WHERE id = ?', [data.subjectId]);
  if (!subject) throw AppError.notFound('That subject was not found');
  await assertNoOverlap(data, id);

  // Unmarked future classes were generated from the old slot. Clear them so the
  // regeneration below rebuilds them from the new day/time instead of leaving
  // both versions behind. Marked and moved classes are never touched.
  await getDb().run(
    `DELETE FROM attendance_sessions
      WHERE timetable_entry_id = ? AND status = 'PENDING' AND is_rescheduled = 0 AND date >= ?`,
    [id, todayStr()],
  );
  await getDb().run(
    `UPDATE timetable_entries
        SET subject_id = ?, day_of_week = ?, start_time = ?, end_time = ?, classroom = ?, faculty = ?, updated_at = ?
      WHERE id = ?`,
    [data.subjectId, data.dayOfWeek, data.startTime, data.endTime, data.classroom, data.faculty, nowIso(), id],
  );
  await regenerateHorizon();
  return getEntry(id);
}

/**
 * Removes the slot and any future sessions the student has not marked yet.
 * Past and already-marked sessions stay, so history is never rewritten.
 */
export async function deleteEntry(id) {
  await getEntry(id);
  const db = getDb();
  const removed = await db.run(
    `DELETE FROM attendance_sessions WHERE timetable_entry_id = ? AND status = 'PENDING' AND date >= ?`,
    [id, todayStr()],
  );
  await db.run('DELETE FROM timetable_entries WHERE id = ?', [id]);
  return { removedFutureSessions: removed.changes };
}
