import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAdaptiveDayPlan } from '../adaptivePlanner.js';

const SAMPLE_SCHEDULE = {
  Monday: {
    AM: {
      start: '09:00',
      patients: [
        { id: 'alpha', time: '09:30' },
        {},
      ],
    },
  },
};

const SAMPLE_BUCKET = [
  { type: 'Prep Work', avgTime: 15 },
  { type: 'Chart Review', avgTime: 10 },
];

test('buildAdaptiveDayPlan merges bucket tasks and patients in chronological order', () => {
  const plan = buildAdaptiveDayPlan(
    { currentDay: 'Monday', currentBlock: 'AM' },
    SAMPLE_SCHEDULE,
    SAMPLE_BUCKET,
  );

  assert.equal(plan.length, 4);
  assert.deepEqual(
    plan.map(entry => entry.label),
    ['Prep Work', 'Chart Review', 'Patient Slot 2', 'alpha'],
  );
  assert.deepEqual(
    plan.map(entry => entry.time),
    ['08:30', '08:40', '09:00', '09:30'],
  );
  assert.ok(plan.every(entry => ['task', 'patient'].includes(entry.type)));
});

test('buildAdaptiveDayPlan handles missing schedule information defensively', () => {
  assert.deepEqual(
    buildAdaptiveDayPlan({}, SAMPLE_SCHEDULE, SAMPLE_BUCKET),
    [],
  );

  assert.deepEqual(
    buildAdaptiveDayPlan(
      { currentDay: 'Monday', currentBlock: 'PM' },
      SAMPLE_SCHEDULE,
      SAMPLE_BUCKET,
    ),
    [],
  );
});

