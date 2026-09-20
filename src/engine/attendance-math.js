/**
 * Pure attendance maths. No database, no side effects.
 *
 * Only PRESENT and ABSENT sessions are countable. CANCELLED, NO_CLASS and
 * PENDING sessions never move the percentage, which is what makes holidays and
 * cancelled classes harmless for the student.
 */

export const COUNTABLE_STATUSES = ['PRESENT', 'ABSENT'];

export function round(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** present/(present+absent) as a percentage. Returns 0 when nothing counts yet. */
export function percentage(present, absent) {
  const total = present + absent;
  if (total === 0) return 0;
  return round((present / total) * 100);
}

/**
 * How many further classes can be skipped while staying at or above `required`.
 * Solves  present / (total + k) >= r  for the largest integer k >= 0.
 */
export function classesCanMiss(present, absent, required) {
  const total = present + absent;
  const r = required / 100;
  if (r <= 0) return Infinity;
  if (total === 0) return 0;
  if (percentage(present, absent) < required) return 0;
  return Math.max(0, Math.floor(present / r - total));
}

/**
 * How many consecutive classes must be attended to reach `target`.
 * Solves  (present + k) / (total + k) >= r  for the smallest integer k >= 0.
 * Returns null when the target can never be reached (r >= 100%).
 */
export function classesNeededToReach(present, absent, target) {
  const total = present + absent;
  const r = target / 100;
  if (percentage(present, absent) >= target && total > 0) return 0;
  if (r >= 1) return present === total ? 0 : null;
  return Math.max(0, Math.ceil((r * total - present) / (1 - r)));
}

/** Percentage after attending the next `n` classes. */
export function projectAttend(present, absent, n) {
  return percentage(present + n, absent);
}

/** Percentage after missing the next `n` classes. */
export function projectMiss(present, absent, n) {
  return percentage(present, absent + n);
}

export function riskLevel(current, required, countedTotal) {
  if (countedTotal === 0) return 'NO_DATA';
  if (current < required) return 'BELOW';
  if (current < required + 5) return 'AT_RISK';
  return 'SAFE';
}

/**
 * Full prediction block for one subject (or for the whole semester when the
 * counts are aggregated). Everything here is plain arithmetic.
 */
export function buildPrediction({ present, absent, required, targets = [80, 85] }) {
  const counted = present + absent;
  const current = percentage(present, absent);
  const canMiss = classesCanMiss(present, absent, required);

  return {
    present,
    absent,
    counted,
    current,
    required,
    status: riskLevel(current, required, counted),
    canMiss: Number.isFinite(canMiss) ? canMiss : null,
    needToAttend: classesNeededToReach(present, absent, required),
    projections: {
      ifAttendNext1: projectAttend(present, absent, 1),
      ifAttendNext3: projectAttend(present, absent, 3),
      ifAttendNext5: projectAttend(present, absent, 5),
      ifMissNext1: projectMiss(present, absent, 1),
      ifMissNext3: projectMiss(present, absent, 3),
    },
    targets: targets.map((target) => ({
      target,
      classesNeeded: classesNeededToReach(present, absent, target),
    })),
  };
}
