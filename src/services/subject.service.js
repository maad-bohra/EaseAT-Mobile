import { getDb } from '../db/database.js';
import { AppError } from '../utils/errors.js';
import {
  newId,
  nowIso,
  optionalInt,
  optionalNumber,
  optionalText,
  requireColor,
  requiredText,
} from '../utils/validate.js';

export const SUBJECT_COLORS = [
  '#2F6F4E',
  '#3A6EA5',
  '#8A5A2B',
  '#7A3E7E',
  '#B2472B',
  '#1F6F6B',
  '#5B6BB5',
  '#87741F',
];

function mapSubject(row) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    faculty: row.faculty,
    credits: row.credits,
    color: row.color,
    requiredAttendance: row.required_attendance,
    archived: Boolean(row.archived),
    weeklyClasses: row.timetable_count ?? 0,
    sessionCount: row.session_count ?? 0,
  };
}

function cleanInput(input) {
  return {
    name: requiredText(input.name, 80, 'Name the subject', 'Name'),
    code: optionalText(input.code, 20, 'Code'),
    faculty: optionalText(input.faculty, 80, 'Faculty'),
    credits: optionalInt(input.credits, 0, 20, 'Credits'),
    color: requireColor(input.color ?? SUBJECT_COLORS[0]),
    requiredAttendance: optionalNumber(input.requiredAttendance, 1, 100, 'Required attendance'),
  };
}

async function assertNameFree(name, ignoreId = null) {
  const clash = await getDb().get(
    'SELECT id FROM subjects WHERE name = ? COLLATE NOCASE AND id != ?',
    [name, ignoreId ?? ''],
  );
  if (clash) throw AppError.conflict('You already have a subject with that name');
}

export async function listSubjects({ includeArchived = false } = {}) {
  const rows = await getDb().all(
    `SELECT s.*,
            (SELECT COUNT(*) FROM timetable_entries t WHERE t.subject_id = s.id) AS timetable_count,
            (SELECT COUNT(*) FROM attendance_sessions a WHERE a.subject_id = s.id) AS session_count
       FROM subjects s
      ${includeArchived ? '' : 'WHERE s.archived = 0'}
      ORDER BY s.name COLLATE NOCASE`,
  );
  return rows.map(mapSubject);
}

export async function getSubject(id) {
  const row = await getDb().get('SELECT * FROM subjects WHERE id = ?', [id]);
  if (!row) throw AppError.notFound('That subject was not found');
  return mapSubject(row);
}

export async function createSubject(input) {
  const data = cleanInput(input);
  await assertNameFree(data.name);

  const id = newId();
  const now = nowIso();
  await getDb().run(
    `INSERT INTO subjects (id, name, code, faculty, credits, color, required_attendance, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.name, data.code, data.faculty, data.credits, data.color, data.requiredAttendance, now, now],
  );
  return getSubject(id);
}

export async function updateSubject(id, input) {
  await getSubject(id);
  const data = cleanInput(input);
  await assertNameFree(data.name, id);

  await getDb().run(
    `UPDATE subjects
        SET name = ?, code = ?, faculty = ?, credits = ?, color = ?, required_attendance = ?, updated_at = ?
      WHERE id = ?`,
    [data.name, data.code, data.faculty, data.credits, data.color, data.requiredAttendance, nowIso(), id],
  );
  return getSubject(id);
}

/**
 * Deleting a subject cascades to its timetable slots and every attendance
 * record, so the caller is told how much history went with it.
 */
export async function deleteSubject(id) {
  await getSubject(id);
  const counted = await getDb().get('SELECT COUNT(*) AS n FROM attendance_sessions WHERE subject_id = ?', [id]);
  await getDb().run('DELETE FROM subjects WHERE id = ?', [id]);
  return { deletedSessions: counted?.n ?? 0 };
}
