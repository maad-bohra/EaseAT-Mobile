import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPrediction,
  classesCanMiss,
  classesNeededToReach,
  percentage,
  projectMiss,
  riskLevel,
} from '../src/engine/attendance-math.js';

// The worked example from the project README: 24 present, 6 absent, 75% required.
test('README example: 80% now, 2 missable, 72.7% after missing 3', () => {
  assert.equal(percentage(24, 6), 80);
  assert.equal(classesCanMiss(24, 6, 75), 2);
  assert.equal(projectMiss(24, 6, 2), 75); // 24/32 is exactly 75%
  assert.equal(projectMiss(24, 6, 3), 72.7);
});

test('nothing counted yet is 0% and cannot be missed', () => {
  assert.equal(percentage(0, 0), 0);
  assert.equal(classesCanMiss(0, 0, 75), 0);
  assert.equal(riskLevel(0, 75, 0), 'NO_DATA');
});

test('below the requirement: how many must be attended', () => {
  // 6 present, 6 absent = 50%. Need (6+k)/(12+k) >= 0.75 -> k = 12.
  assert.equal(classesNeededToReach(6, 6, 75), 12);
  assert.equal(classesCanMiss(6, 6, 75), 0);
  assert.equal(riskLevel(50, 75, 12), 'BELOW');
});

test('already at target needs zero more classes', () => {
  assert.equal(classesNeededToReach(24, 6, 75), 0);
});

test('100% target can never be reached after an absence', () => {
  assert.equal(classesNeededToReach(9, 1, 100), null);
});

test('risk levels', () => {
  assert.equal(riskLevel(76, 75, 10), 'AT_RISK');
  assert.equal(riskLevel(90, 75, 10), 'SAFE');
});

test('buildPrediction bundles the projections', () => {
  const p = buildPrediction({ present: 24, absent: 6, required: 75 });
  assert.equal(p.current, 80);
  assert.equal(p.canMiss, 2);
  assert.equal(p.projections.ifMissNext1, 77.4);
  assert.equal(p.status, 'SAFE');
  assert.deepEqual(p.targets.map((t) => t.target), [80, 85]);
});
