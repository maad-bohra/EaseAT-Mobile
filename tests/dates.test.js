import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  dayOfWeek,
  eachDateInRange,
  endOfMonth,
  formatDate,
  formatDateLong,
  isValidDate,
  isValidTime,
  monthMatrix,
  shiftMonth,
  timeToMinutes,
  todayStr,
} from '../src/utils/dates.js';

test('validates dates and times', () => {
  assert.ok(isValidDate('2026-09-21'));
  assert.ok(!isValidDate('2026-02-30'));
  assert.ok(!isValidDate('21-09-2026'));
  assert.ok(isValidTime('09:00'));
  assert.ok(isValidTime('23:59'));
  assert.ok(!isValidTime('24:00'));
  assert.ok(!isValidTime('9:00'));
});

test('addDays crosses month, year and leap-day boundaries', () => {
  assert.equal(addDays('2026-09-30', 1), '2026-10-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('day of week matches the calendar (0 = Sunday)', () => {
  assert.equal(dayOfWeek('2026-09-19'), 6); // Saturday
  assert.equal(dayOfWeek('2026-09-21'), 1); // Monday
  assert.equal(dayOfWeek('2026-09-20'), 0); // Sunday
});

test('ranges are inclusive', () => {
  assert.deepEqual(eachDateInRange('2026-09-29', '2026-10-02'), ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
});

test('todayStr uses the local calendar date', () => {
  assert.equal(todayStr(new Date(2026, 8, 19, 23, 59)), '2026-09-19');
  assert.equal(todayStr(new Date(2026, 0, 5, 0, 1)), '2026-01-05');
});

test('month helpers', () => {
  assert.equal(endOfMonth(2028, 2), '2028-02-29');
  assert.deepEqual(shiftMonth(2026, 12, 1), { year: 2027, month: 1 });
  assert.deepEqual(shiftMonth(2026, 1, -1), { year: 2025, month: 12 });
  const cells = monthMatrix(2026, 9);
  assert.equal(cells.length, 42);
  assert.equal(dayOfWeek(cells[0].iso), 0); // grid starts on a Sunday
  assert.ok(cells.filter((c) => c.inMonth).length === 30);
});

test('display formats are stable and locale-free', () => {
  assert.equal(formatDate('2026-09-21'), 'Mon, 21 Sep');
  assert.equal(formatDateLong('2026-09-21'), 'Monday, 21 September');
  assert.equal(timeToMinutes('14:30'), 870);
});
