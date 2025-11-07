import test from 'node:test';
import assert from 'node:assert/strict';

import { dayState } from '../dayState.js';
import {
  cloneDayState,
  clonePatientSlots,
  cloneBasketItems,
  cloneSlotTimes,
} from '../scheduleBridge.js';
import { CLINIC_BASKET_ITEMS, SLOT_TIMES } from '../scheduleData.js';

test('cloneDayState produces a defensive copy of the shared day state', () => {
  dayState.currentDay = 'Tuesday';
  dayState.currentBlock = 'PM';
  dayState.clinicType = 'Continuity';
  dayState.clinicSelections = { 'Tuesday|PM': 'Continuity' };
  dayState.blockResidentPresence = { 'Tuesday|PM': true };
  dayState.residentMap = { 'Tuesday|PM|0': true };
  dayState.patientSlots = {
    'Tuesday|PM': [
      { id: 'slot-1', time: '13:00', label: 'Visit', resident: false, isCustom: false },
    ],
  };

  const copy = cloneDayState();

  assert.notStrictEqual(copy, dayState);
  assert.equal(copy.currentDay, 'Tuesday');
  assert.equal(copy.currentBlock, 'PM');
  assert.equal(copy.clinicType, 'Continuity');
  assert.deepEqual(copy.clinicSelections, dayState.clinicSelections);
  assert.notStrictEqual(copy.clinicSelections, dayState.clinicSelections);
  assert.deepEqual(copy.blockResidentPresence, dayState.blockResidentPresence);
  assert.notStrictEqual(copy.blockResidentPresence, dayState.blockResidentPresence);
  assert.deepEqual(copy.residentMap, dayState.residentMap);
  assert.notStrictEqual(copy.residentMap, dayState.residentMap);
  assert.deepEqual(copy.patientSlots, dayState.patientSlots);
  assert.notStrictEqual(copy.patientSlots, dayState.patientSlots);
  assert.notStrictEqual(
    copy.patientSlots['Tuesday|PM'],
    dayState.patientSlots['Tuesday|PM'],
  );

  copy.patientSlots['Tuesday|PM'][0].label = 'Changed';
  copy.clinicSelections['Tuesday|PM'] = 'Faculty';

  assert.equal(dayState.patientSlots['Tuesday|PM'][0].label, 'Visit');
  assert.equal(dayState.clinicSelections['Tuesday|PM'], 'Continuity');
});

test('clonePatientSlots deeply copies slot arrays for reuse', () => {
  dayState.patientSlots = {
    alpha: [
      { id: '1', time: '09:00', label: 'Visit A', resident: true, isCustom: false },
      { id: '2', time: '10:00', label: 'Visit B', resident: false, isCustom: false },
    ],
  };

  const copy = clonePatientSlots();

  assert.deepEqual(copy, dayState.patientSlots);
  assert.notStrictEqual(copy.alpha, dayState.patientSlots.alpha);
  copy.alpha[0].label = 'Mutated';
  assert.equal(dayState.patientSlots.alpha[0].label, 'Visit A');
});

test('cloneBasketItems returns new item objects for refactoring safety', () => {
  const items = cloneBasketItems();
  assert.equal(items.length, CLINIC_BASKET_ITEMS.length);
  items.forEach((item, index) => {
    assert.deepEqual(item, CLINIC_BASKET_ITEMS[index]);
    assert.notStrictEqual(item, CLINIC_BASKET_ITEMS[index]);
  });
});

test('cloneSlotTimes copies each block array defensively', () => {
  const slots = cloneSlotTimes();
  assert.deepEqual(slots, SLOT_TIMES);
  Object.keys(slots).forEach(block => {
    assert.notStrictEqual(slots[block], SLOT_TIMES[block]);
  });
});

