import { getDb } from '../db/database.js';
import { AppError } from '../utils/errors.js';
import { addDays, daysBetween, eachDateInRange, todayStr } from '../utils/dates.js';
import { newId, nowIso, optionalText, requireCalendarType, requireDate } from '../utils/validate.js';
import { fetchSessions, regenerateHorizon } from './session.service.js';

const MAX_RANGE_DAYS = 100;

function mapEvent(row) {
  return {
    id: row.id,
    date: row.date,
    type: row.type,
    title: row.title ?? null,
    description: row.description ?? null,
  };
}

function cleanInput(data) {
  return {
    date: requireDate(data.date, 'Date'),
    type: requireCalendarType(data.type),
    title: optionalText(data.title, 120, 'Name'),
    description: optionalText(data.description, 300, 'Description'),
  };
}

async function findDuplicate({ date, type, title }, ignoreId = null) {
  return getDb().get(
    `SELECT id FROM academic_calendar
      WHERE date = ? AND type = ? AND COALESCE(title, '') = ? AND id != ?`,
    [date, type, title ?? '', ignoreId ?? ''],
  );
}

export async function listEvents({ from, to } = {}) {
  const where = [];
  const params = [];
  if (from) {
    where.push('date >= ?');
    params.push(from);
  }
  if (to) {
    where.push('date <= ?');
    params.push(to);
  }
  const rows = await getDb().all(
    `SELECT * FROM academic_calendar ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY date, type`,
    params,
  );
  return rows.map(mapEvent);
}

async function getEvent(id) {
  const row = await getDb().get('SELECT * FROM academic_calendar WHERE id = ?', [id]);
  if (!row) throw AppError.notFound('That calendar entry was not found');
  return mapEvent(row);
}

async function insertEvent(data) {
  const id = newId();
  const now = nowIso();
  await getDb().run(
    `INSERT INTO academic_calendar (id, date, type, title, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, data.date, data.type, data.title, data.description, now, now],
  );
  return id;
}

export async function createEvent(input) {
  const data = cleanInput(input);
  if (await findDuplicate(data)) throw AppError.conflict('That date is already in the calendar');

  const id = await insertEvent(data);
  await regenerateHorizon();
  return getEvent(id);
}

/** Adds the same entry on every date from `from` to `to`, e.g. a two-week vacation. */
export async function createEventRange({ from, to, type, title, description }) {
  requireDate(from, 'From');
  requireDate(to, 'Until');
  if (to < from) throw AppError.badRequest('The last day must be on or after the first day');
  if (daysBetween(from, to) + 1 > MAX_RANGE_DAYS) {
    throw AppError.badRequest(`Add up to ${MAX_RANGE_DAYS} days at a time`);
  }

  let created = 0;
  let skipped = 0;
  for (const date of eachDateInRange(from, to)) {
    const data = cleanInput({ date, type, title, description });
    if (await findDuplicate(data)) {
      skipped += 1;
      continue;
    }
    await insertEvent(data);
    created += 1;
  }
  await regenerateHorizon();
  return { created, skipped };
}

export async function updateEvent(id, input) {
  await getEvent(id);
  const data = cleanInput(input);
  if (await findDuplicate(data, id)) throw AppError.conflict('That date is already in the calendar');

  await getDb().run(
    `UPDATE academic_calendar SET date = ?, type = ?, title = ?, description = ?, updated_at = ? WHERE id = ?`,
    [data.date, data.type, data.title, data.description, nowIso(), id],
  );
  await regenerateHorizon();
  return getEvent(id);
}

export async function deleteEvent(id) {
  await getEvent(id);
  await getDb().run('DELETE FROM academic_calendar WHERE id = ?', [id]);
  await regenerateHorizon();
}

export async function getUpcomingHolidays(days = 30) {
  const today = todayStr();
  const rows = await getDb().all(
    `SELECT * FROM academic_calendar
      WHERE type IN ('HOLIDAY', 'VACATION', 'EXAM') AND date >= ? AND date <= ?
      ORDER BY date LIMIT 10`,
    [today, addDays(today, days)],
  );
  return rows.map(mapEvent);
}

/** Day detail for the monthly calendar view. */
export async function getDayDetail(date) {
  requireDate(date, 'Date');
  const [sessions, events] = await Promise.all([
    fetchSessions('a.date = ?', [date], 'ORDER BY a.start_time'),
    listEvents({ from: date, to: date }),
  ]);
  return { date, events, sessions };
}
