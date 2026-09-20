import { getDb } from '../db/database.js';
import { AppError } from '../utils/errors.js';
import { DAY_NAMES, addDays, dayOfWeek, todayStr } from '../utils/dates.js';
import { newId, nowIso } from '../utils/validate.js';
import { getNextSession, getSummary } from './attendance.service.js';

/**
 * In-app notifications only. `deliver` is the single place a notification is
 * written, so a future push adapter has exactly one seam to plug into.
 */

function mapNotification(row) {
  let meta = null;
  try {
    meta = row.meta ? JSON.parse(row.meta) : null;
  } catch {
    meta = null;
  }
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    read: Boolean(row.is_read),
    meta,
    createdAt: row.created_at,
  };
}

async function deliver({ type, title, message, meta, dedupeKey }) {
  const id = newId();
  const result = await getDb().run(
    `INSERT OR IGNORE INTO notifications (id, type, title, message, is_read, meta, dedupe_key, created_at)
     VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
    [id, type, title, message, meta ? JSON.stringify(meta) : null, dedupeKey ?? null, nowIso()],
  );
  if (result.changes === 0) return null; // already sent
  return { id, type, title, message };
}

export async function listNotifications({ unreadOnly = false, limit = 50 } = {}) {
  const rows = await getDb().all(
    `SELECT * FROM notifications ${unreadOnly ? 'WHERE is_read = 0' : ''} ORDER BY created_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map(mapNotification);
}

export async function countUnread() {
  const row = await getDb().get('SELECT COUNT(*) AS n FROM notifications WHERE is_read = 0');
  return row?.n ?? 0;
}

export async function markRead(id) {
  const existing = await getDb().get('SELECT id FROM notifications WHERE id = ?', [id]);
  if (!existing) throw AppError.notFound('That notification was not found');
  await getDb().run('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
}

export async function markAllRead() {
  const result = await getDb().run('UPDATE notifications SET is_read = 1 WHERE is_read = 0');
  return { updated: result.changes };
}

export async function deleteNotification(id) {
  await getDb().run('DELETE FROM notifications WHERE id = ?', [id]);
}

/**
 * Recomputes the notifications the student should see right now. Safe to call
 * on every dashboard load: dedupeKey keeps it idempotent.
 */
export async function refreshNotifications() {
  const db = getDb();
  const today = todayStr();
  const tomorrow = addDays(today, 1);
  const created = [];

  const summary = await getSummary();
  for (const subject of summary.subjects) {
    if (subject.status === 'BELOW') {
      created.push(
        await deliver({
          type: 'BELOW_REQUIRED',
          title: `${subject.name} is below ${subject.required}%`,
          message: `${subject.name} is at ${subject.percentage}%. Attend the next classes to recover.`,
          meta: { subjectId: subject.subjectId, percentage: subject.percentage },
          dedupeKey: `below:${subject.subjectId}:${today}`,
        }),
      );
    } else if (subject.status === 'AT_RISK') {
      created.push(
        await deliver({
          type: 'LOW_ATTENDANCE',
          title: `${subject.name} is close to the limit`,
          message: `${subject.name} is at ${subject.percentage}%, just above the ${subject.required}% requirement.`,
          meta: { subjectId: subject.subjectId, percentage: subject.percentage },
          dedupeKey: `risk:${subject.subjectId}:${today}`,
        }),
      );
    }
  }

  const holidayTomorrow = await db.get(
    `SELECT * FROM academic_calendar WHERE date = ? AND type IN ('HOLIDAY', 'VACATION') LIMIT 1`,
    [tomorrow],
  );
  if (holidayTomorrow) {
    created.push(
      await deliver({
        type: 'HOLIDAY_TOMORROW',
        title: 'College holiday tomorrow',
        message: `${holidayTomorrow.title || 'Holiday'} on ${DAY_NAMES[dayOfWeek(tomorrow)]}. No classes will be counted.`,
        meta: { date: tomorrow },
        dedupeKey: `holiday:${tomorrow}`,
      }),
    );
  }

  const exam = await db.get(
    `SELECT * FROM academic_calendar WHERE type = 'EXAM' AND date >= ? AND date <= ? ORDER BY date LIMIT 1`,
    [today, addDays(today, 7)],
  );
  if (exam) {
    created.push(
      await deliver({
        type: 'EXAM_APPROACHING',
        title: 'Exam coming up',
        message: `${exam.title || 'Exam'} on ${exam.date}.`,
        meta: { date: exam.date },
        dedupeKey: `exam:${exam.date}`,
      }),
    );
  }

  const next = await getNextSession();
  if (next && next.date === today) {
    created.push(
      await deliver({
        type: 'UPCOMING_CLASS',
        title: `${next.subject.name} at ${next.startTime}`,
        message: `Next up today: ${next.subject.name} ${next.startTime}–${next.endTime}.`,
        meta: { sessionId: next.id },
        dedupeKey: `next:${next.id}`,
      }),
    );
  }

  const unmarkedYesterday = await db.all(
    `SELECT a.id, a.start_time, s.name AS subject_name
       FROM attendance_sessions a JOIN subjects s ON s.id = a.subject_id
      WHERE a.status = 'PENDING' AND a.date = ?`,
    [addDays(today, -1)],
  );
  for (const session of unmarkedYesterday) {
    created.push(
      await deliver({
        type: 'MISSED_CLASS',
        title: `Mark yesterday's ${session.subject_name}`,
        message: `${session.subject_name} at ${session.start_time} is still unmarked.`,
        meta: { sessionId: session.id },
        dedupeKey: `unmarked:${session.id}`,
      }),
    );
  }

  return created.filter(Boolean);
}

export function notifyReschedule({ subjectName, from, to }) {
  return deliver({
    type: 'CLASS_RESCHEDULED',
    title: `${subjectName} moved`,
    message: `${subjectName} moved from ${from} to ${to}.`,
    meta: { subjectName, from, to },
    dedupeKey: `resched:${subjectName}:${from}:${to}`,
  });
}
