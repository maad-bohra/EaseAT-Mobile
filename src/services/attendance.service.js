import { getDb } from '../db/database.js';
import { AppError } from '../utils/errors.js';
import { addDays, nowMinutes, timeToMinutes, todayStr } from '../utils/dates.js';
import { buildPrediction, percentage, riskLevel } from '../engine/attendance-math.js';
import { fetchSessions } from './session.service.js';
import { getSettings } from './settings.service.js';

const EMPTY_COUNTS = { present: 0, absent: 0, cancelled: 0, pending: 0, noClass: 0 };

/** Counts PRESENT/ABSENT/CANCELLED/PENDING per subject in one grouped query. */
async function countsBySubject({ from, to } = {}) {
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

  const grouped = await getDb().all(
    `SELECT subject_id, status, COUNT(*) AS n
       FROM attendance_sessions
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      GROUP BY subject_id, status`,
    params,
  );

  const map = new Map();
  for (const row of grouped) {
    const current = map.get(row.subject_id) || { ...EMPTY_COUNTS };
    if (row.status === 'PRESENT') current.present += row.n;
    else if (row.status === 'ABSENT') current.absent += row.n;
    else if (row.status === 'CANCELLED') current.cancelled += row.n;
    else if (row.status === 'PENDING') current.pending += row.n;
    else current.noClass += row.n;
    map.set(row.subject_id, current);
  }
  return map;
}

const requirementFor = (subject, settings) => subject.required_attendance ?? settings.requiredAttendance;

/** Overall + per-subject figures for the dashboard. */
export async function getSummary(range = {}) {
  const settings = await getSettings();
  const subjects = await getDb().all('SELECT * FROM subjects WHERE archived = 0 ORDER BY name COLLATE NOCASE');
  const counts = await countsBySubject(range);

  const bySubject = subjects.map((subject) => {
    const c = counts.get(subject.id) || EMPTY_COUNTS;
    const required = requirementFor(subject, settings);
    const counted = c.present + c.absent;
    const current = percentage(c.present, c.absent);
    return {
      subjectId: subject.id,
      name: subject.name,
      code: subject.code,
      color: subject.color,
      faculty: subject.faculty,
      credits: subject.credits,
      required,
      present: c.present,
      absent: c.absent,
      cancelled: c.cancelled,
      pending: c.pending,
      counted,
      percentage: current,
      status: riskLevel(current, required, counted),
    };
  });

  const totals = bySubject.reduce(
    (acc, s) => ({
      present: acc.present + s.present,
      absent: acc.absent + s.absent,
      cancelled: acc.cancelled + s.cancelled,
      pending: acc.pending + s.pending,
    }),
    { present: 0, absent: 0, cancelled: 0, pending: 0 },
  );

  const overallCounted = totals.present + totals.absent;
  const overall = percentage(totals.present, totals.absent);

  return {
    overall: {
      percentage: overall,
      required: settings.requiredAttendance,
      attended: totals.present,
      missed: totals.absent,
      cancelled: totals.cancelled,
      pending: totals.pending,
      totalCounted: overallCounted,
      status: riskLevel(overall, settings.requiredAttendance, overallCounted),
    },
    subjects: bySubject,
    warnings: bySubject.filter((s) => s.status === 'BELOW' || s.status === 'AT_RISK'),
  };
}

function buildPredictionMessage(subjectName, p) {
  if (p.counted === 0) return `No ${subjectName} classes have been marked yet.`;
  if (p.current < p.required) {
    return p.needToAttend === null
      ? `${subjectName} is at ${p.current}% and cannot reach ${p.required}%.`
      : `Attend the next ${p.needToAttend} ${subjectName} ${
          p.needToAttend === 1 ? 'class' : 'classes'
        } to get back to ${p.required}%.`;
  }
  return `You can miss ${p.canMiss} upcoming ${subjectName} ${
    p.canMiss === 1 ? 'class' : 'classes'
  } and stay above ${p.required}%.`;
}

/** "How many classes can I miss?" for one subject. */
export async function getSubjectPrediction(subjectId, { target } = {}) {
  const settings = await getSettings();
  const subject = await getDb().get('SELECT * FROM subjects WHERE id = ?', [subjectId]);
  if (!subject) throw AppError.notFound('That subject was not found');

  const counts = (await countsBySubject()).get(subjectId) || EMPTY_COUNTS;
  const required = requirementFor(subject, settings);
  const targets = target ? [target] : [Math.max(required, 75), 80, 85];

  const prediction = buildPrediction({
    present: counts.present,
    absent: counts.absent,
    required,
    targets: [...new Set(targets)],
  });

  const upcoming = await getDb().get(
    `SELECT COUNT(*) AS n FROM attendance_sessions WHERE subject_id = ? AND status = 'PENDING' AND date >= ?`,
    [subjectId, todayStr()],
  );

  return {
    subject: { id: subject.id, name: subject.name, code: subject.code, color: subject.color },
    ...prediction,
    upcomingScheduled: upcoming?.n ?? 0,
    message: buildPredictionMessage(subject.name, prediction),
  };
}

/** Prediction for every subject at once (dashboard table). */
export async function getAllPredictions() {
  const subjects = await getDb().all('SELECT id FROM subjects WHERE archived = 0 ORDER BY name COLLATE NOCASE');
  const out = [];
  for (const subject of subjects) out.push(await getSubjectPrediction(subject.id));
  return out;
}

export async function getTodayAndUpcoming(upcomingDays = 7) {
  const today = todayStr();
  const sessions = await fetchSessions('a.date >= ? AND a.date <= ?', [today, addDays(today, upcomingDays)]);
  return {
    today: sessions.filter((s) => s.date === today),
    upcoming: sessions.filter((s) => s.date > today),
  };
}

/** The next class that has not happened yet, used for the "next up" notification. */
export async function getNextSession() {
  const today = todayStr();
  const minutes = nowMinutes();
  const candidates = await fetchSessions(`a.status = 'PENDING' AND a.date >= ?`, [today], 'ORDER BY a.date, a.start_time LIMIT 20');
  return candidates.find((s) => s.date > today || timeToMinutes(s.startTime) >= minutes) ?? null;
}
