import { AppError } from './errors.js';
import { isValidDate, isValidTime, timeToMinutes } from './dates.js';

export const ATTENDANCE_STATUSES = ['PENDING', 'PRESENT', 'ABSENT', 'CANCELLED', 'NO_CLASS'];
export const CALENDAR_TYPES = [
  'HOLIDAY',
  'WORKING_DAY',
  'EXAM',
  'VACATION',
  'SEMESTER_START',
  'SEMESTER_END',
  'OTHER',
];

const HEX = /^#[0-9a-fA-F]{6}$/;

export function newId() {
  const hex = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${'89ab'[Math.floor(Math.random() * 4)]}${hex(3)}-${hex(12)}`;
}

export const nowIso = () => new Date().toISOString();

/** Trimmed text, or null when empty. Throws when longer than `max`. */
export function optionalText(value, max, label) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (text === '') return null;
  if (text.length > max) throw AppError.badRequest(`${label} can be at most ${max} characters`);
  return text;
}

export function requiredText(value, max, message, label = 'That') {
  const text = optionalText(value, max, label);
  if (text === null) throw AppError.badRequest(message);
  return text;
}

/** Whole number in [min, max], or null when blank. */
export function optionalInt(value, min, max, label) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw AppError.badRequest(`${label} must be a whole number from ${min} to ${max}`);
  }
  return number;
}

/** Number in [min, max], or null when blank. */
export function optionalNumber(value, min, max, label) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw AppError.badRequest(`${label} must be between ${min} and ${max}`);
  }
  return number;
}

export function requireDate(value, label = 'Date') {
  if (!isValidDate(value)) throw AppError.badRequest(`${label}: use a date like 2026-09-21`);
  return value;
}

export function requireTime(value, label = 'Time') {
  if (!isValidTime(value)) throw AppError.badRequest(`${label}: use a 24-hour time like 09:00`);
  return value;
}

export function assertTimeOrder(startTime, endTime) {
  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    throw AppError.badRequest('The class must end after it starts');
  }
}

export function requireColor(value) {
  if (!HEX.test(String(value))) throw AppError.badRequest('Use a colour like #2F6F4E');
  return String(value);
}

export function requireStatus(value) {
  if (!ATTENDANCE_STATUSES.includes(value)) throw AppError.badRequest('That status is not valid');
  return value;
}

export function requireCalendarType(value) {
  if (!CALENDAR_TYPES.includes(value)) throw AppError.badRequest('That calendar type is not valid');
  return value;
}

/** SQL placeholder list, e.g. placeholders(3) -> "?, ?, ?". */
export function placeholders(count) {
  return Array.from({ length: count }, () => '?').join(', ');
}

/** Splits a list into chunks so IN (...) queries stay well under SQLite's limits. */
export function chunk(items, size = 100) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
