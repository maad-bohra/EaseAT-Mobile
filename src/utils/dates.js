/**
 * Every class day is a plain "YYYY-MM-DD" string and every time is "HH:mm".
 * Working with strings (and doing calendar arithmetic in UTC) keeps dates free
 * of timezone drift. "Today" always means the phone's local date.
 */

const pad = (n) => String(n).padStart(2, '0');

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(value) {
  return typeof value === 'string' && TIME_RE.test(value);
}

export function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function parseDate(value) {
  if (!isValidDate(value)) throw new Error(`Invalid date: ${value}`);
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** The phone's local calendar date as "YYYY-MM-DD". */
export function todayStr(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Minutes since local midnight, used to find the next class. */
export function nowMinutes(now = new Date()) {
  return now.getHours() * 60 + now.getMinutes();
}

export function addDays(value, days) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday, matching timetable_entries.day_of_week. */
export function dayOfWeek(value) {
  return parseDate(value).getUTCDay();
}

export function daysBetween(from, to) {
  return Math.round((parseDate(to) - parseDate(from)) / 86400000);
}

export function eachDateInRange(from, to) {
  const out = [];
  const total = daysBetween(from, to);
  for (let i = 0; i <= total; i += 1) out.push(addDays(from, i));
  return out;
}

/** "HH:mm" to minutes since midnight. */
export function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function startOfMonth(year, month /* 1-12 */) {
  return `${year}-${pad(month)}-01`;
}

export function endOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

export function shiftMonth(year, month, delta) {
  const next = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1 };
}

/** Six weeks of cells (Sunday first) that cover the month. */
export function monthMatrix(year, month) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + i);
    return { iso: date.toISOString().slice(0, 10), inMonth: date.getUTCMonth() === month - 1 };
  });
}

/** "Mon, 21 Sep" */
export function formatDate(value) {
  const date = parseDate(value);
  return `${DAY_SHORT[date.getUTCDay()]}, ${date.getUTCDate()} ${MONTH_SHORT[date.getUTCMonth()]}`;
}

/** "Monday, 21 September" */
export function formatDateLong(value) {
  const date = parseDate(value);
  return `${DAY_NAMES[date.getUTCDay()]}, ${date.getUTCDate()} ${MONTH_NAMES[date.getUTCMonth()]}`;
}

/** "21 Sep 2026" */
export function formatDateFull(value) {
  const date = parseDate(value);
  return `${date.getUTCDate()} ${MONTH_SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function formatMonthYear(year, month) {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** "21 Sep, 14:05" in the phone's local time. */
export function formatTimestamp(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getDate()} ${MONTH_SHORT[date.getMonth()]}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** JS Date (local noon) for a "YYYY-MM-DD" string, for native pickers. */
export function dateStrToLocalDate(value) {
  if (!isValidDate(value)) return new Date();
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function localDateToDateStr(date) {
  return todayStr(date);
}

export function timeStrToLocalDate(value) {
  const base = new Date();
  if (!isValidTime(value)) return base;
  const [h, m] = value.split(':').map(Number);
  base.setHours(h, m, 0, 0);
  return base;
}

export function localDateToTimeStr(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
