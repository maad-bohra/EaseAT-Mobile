import { getDb } from '../db/database.js';
import { AppError } from '../utils/errors.js';
import { optionalInt, optionalNumber, optionalText } from '../utils/validate.js';

function mapSettings(row) {
  return {
    name: row.name ?? '',
    collegeName: row.college_name ?? '',
    semester: row.semester ?? null,
    year: row.year ?? null,
    requiredAttendance: row.required_attendance,
  };
}

export async function getSettings() {
  const row = await getDb().get('SELECT * FROM settings WHERE id = 1');
  return mapSettings(row);
}

/** The one student on this phone. Every field is optional. */
export async function updateSettings(input) {
  const name = optionalText(input.name, 80, 'Name');
  const collegeName = optionalText(input.collegeName, 120, 'College');
  const semester = optionalInt(input.semester, 1, 12, 'Semester');
  const year = optionalInt(input.year, 1, 8, 'Year');
  const required = optionalNumber(input.requiredAttendance, 1, 100, 'Required attendance');
  if (required === null) throw AppError.badRequest('Enter the attendance percentage you need');

  await getDb().run(
    `UPDATE settings
        SET name = ?, college_name = ?, semester = ?, year = ?, required_attendance = ?
      WHERE id = 1`,
    [name, collegeName, semester, year, required],
  );
  return getSettings();
}

/** Wipes every table and puts the settings row back to its defaults. */
export async function eraseAllData() {
  await getDb().transaction(async (tx) => {
    await tx.run('DELETE FROM notifications');
    await tx.run('DELETE FROM rescheduled_classes');
    await tx.run('DELETE FROM attendance_sessions');
    await tx.run('DELETE FROM timetable_entries');
    await tx.run('DELETE FROM academic_calendar');
    await tx.run('DELETE FROM subjects');
    await tx.run(
      `UPDATE settings
          SET name = NULL, college_name = NULL, semester = NULL, year = NULL, required_attendance = 75
        WHERE id = 1`,
    );
  });
}
