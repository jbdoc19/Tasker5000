import test from 'node:test';
import assert from 'node:assert/strict';

import { SessionState } from '../sessionState.js';
import computeStateFitMultiplier from '../stateFitMultiplier.js';

test('computeStateFitMultiplier blends ease, engagement, and context factors', () => {
  SessionState.energyLevel = 3;
  SessionState.contextLocation = 'home_solo';

  const multiplier = computeStateFitMultiplier({
    timeToStart: 3,
    difficulty: 3,
    novelty: 3,
    interest: 3,
  });

  assert.ok(multiplier > 0.45 && multiplier < 0.5, 'baseline midpoint produces moderate readiness');
});

test('computeStateFitMultiplier climbs toward 1 for easy, engaging tasks with support', () => {
  SessionState.energyLevel = 5;
  SessionState.contextLocation = 'zoom_buddy';

  const multiplier = computeStateFitMultiplier({
    timeToStart: 5,
    difficulty: 1,
    novelty: 5,
    interest: 5,
  });

  assert.equal(multiplier, 1);
});

test('computeStateFitMultiplier respects tunable weights', () => {
  SessionState.energyLevel = 2;
  SessionState.contextLocation = 'home_solo';

  const multiplier = computeStateFitMultiplier(
    {
      timeToStart: 2,
      difficulty: 4,
      novelty: 1,
      interest: 2,
    },
    { alpha: 0.5, kEase: 0.6, kEng: 0.2, kSocial: 0.25 },
  );

  assert.ok(multiplier < 0.4, 'heavier ease weighting penalizes higher friction tasks');
});
