import test from 'node:test';
import assert from 'node:assert/strict';

import generateAdaptiveItinerary, {
  toMinutes,
} from '../timeBlockEngine.js';

const SAMPLE_WINDOWS = [
  { block: 'AM', type: 'Admin', start: '08:00', end: '09:30' },
  { block: 'AM', type: 'Clinical-Parallel', start: '09:30', end: '11:30' },
  { block: 'PM', type: 'Admin', start: '13:00', end: '15:30' },
  { block: 'PM', type: 'Admin', start: '15:30', end: '17:00' },
];

test('generateAdaptiveItinerary enforces quotas and quick win placement', () => {
  const ctx = {
    windows: SAMPLE_WINDOWS,
    quotas: { AM: 0.4, PM: 0.8 },
    tasks: [
      { name: 'Rapid Chart Peek', minutes: 15, quickWin: true },
      { name: 'Chart Sprint', minutes: 90, yield: 5, meta: ['charts'] },
      { name: 'Results Sweep', minutes: 80, yield: 4 },
      { name: 'Call Burst', minutes: 50, yield: 3 },
    ],
    basket: {
      Results: { count: 6, minutesPerItem: 5 },
      Calls: { count: 4, minutesPerItem: 8 },
      Charts: { count: 5, minutesPerItem: 6 },
      Advice: { count: 2, minutesPerItem: 6 },
    },
  };

  const itinerary = generateAdaptiveItinerary(ctx, {});

  assert.ok(itinerary.some(block => block.title.startsWith('Quick Win — Rapid Chart Peek')));

  const amBlocks = itinerary.filter(
    block =>
      block.segment === 'AM'
      && block.minutes > 0
      && !['QuickWin', 'CarryoverLog', 'WindDown', 'SignOff'].includes(block.kind),
  );
  const pmBlocks = itinerary.filter(
    block =>
      block.segment === 'PM'
      && block.minutes > 0
      && !['QuickWin', 'CarryoverLog', 'WindDown', 'SignOff'].includes(block.kind),
  );

  const amWindows = SAMPLE_WINDOWS.filter(win => win.block === 'AM');
  for (const win of amWindows) {
    const capacity = Math.floor((toMinutes(win.end) - toMinutes(win.start)) * 0.4);
    const total = amBlocks
      .filter(block => {
        const start = toMinutes(block.start);
        return start >= toMinutes(win.start) && start < toMinutes(win.end);
      })
      .reduce((sum, block) => sum + block.minutes, 0);
    assert.ok(total <= capacity + 1, `AM window ${win.start}-${win.end} respects quota`);
  }

  const pmWindows = SAMPLE_WINDOWS.filter(win => win.block === 'PM');
  for (const win of pmWindows) {
    const capacity = Math.floor((toMinutes(win.end) - toMinutes(win.start)) * 0.8);
    const total = pmBlocks
      .filter(block => {
        const start = toMinutes(block.start);
        return start >= toMinutes(win.start) && start < toMinutes(win.end);
      })
      .reduce((sum, block) => sum + block.minutes, 0);
    assert.ok(total <= capacity + 1, `PM window ${win.start}-${win.end} respects quota`);
  }
});

test('parallel windows create slices in priority order', () => {
  const ctx = {
    windows: [
      { block: 'AM', type: 'Clinical-Parallel', start: '09:00', end: '11:00' },
    ],
    quotas: { AM: 0.8 },
    tasks: [],
    basket: {
      Results: { minutes: 80 },
      Calls: { minutes: 60 },
      Charts: { minutes: 40 },
      Advice: { minutes: 40 },
    },
  };

  const itinerary = generateAdaptiveItinerary(ctx, {});
  const titles = itinerary.map(block => block.title);
  assert.ok(titles[0] === 'Results Sweep');
  assert.ok(titles[1] === 'Calls Sweep');
  assert.ok(itinerary.every(block => block.minutes >= 20 && block.minutes <= 40));
});

test('auto-slide shifts blocks forward and records carryover', () => {
  const ctx = {
    windows: [
      { block: 'AM', type: 'Admin', start: '08:00', end: '08:45' },
      { block: 'AM', type: 'Admin', start: '08:45', end: '09:15' },
    ],
    quotas: { AM: 1 },
    tasks: [
      { name: 'Quick Chart', minutes: 12, quickWin: true },
      { name: 'Documentation', minutes: 40, yield: 2 },
      { name: 'Prep Review', minutes: 30, yield: 1 },
    ],
    basket: {},
  };

  const itinerary = generateAdaptiveItinerary(ctx, {});
  const docBlock = itinerary.find(block => block.title === 'Documentation');
  assert.equal(docBlock.start, '08:12');
  assert.equal(docBlock.end, '08:52');

  const shortened = itinerary.find(block => block.title === 'Prep Review' && block.meta?.includes('shortened'));
  assert.ok(shortened, 'expect final block shortened to fit window');
});

test('PM compression retains key tasks when user ends early', () => {
  const ctx = {
    windows: [
      { block: 'PM', type: 'Admin', start: '13:00', end: '17:00' },
    ],
    quotas: { PM: 0.9 },
    tasks: [
      { name: 'Chart Sprint', minutes: 90, yield: 5, meta: ['charts'] },
      { name: 'Results Sweep', minutes: 60, yield: 4 },
      { name: 'Calls Burst', minutes: 45, yield: 3 },
      { name: 'Advice Wrap', minutes: 30, yield: 2 },
    ],
    basket: {
      Results: { minutes: 60 },
      Calls: { minutes: 45 },
      Charts: { minutes: 30 },
    },
    userEndTime: '16:00',
  };

  const itinerary = generateAdaptiveItinerary(ctx, {});
  const titles = itinerary.filter(block => block.segment === 'PM').map(block => block.title);

  assert.ok(titles.includes('Chart Sprint'));
  assert.equal(titles.filter(title => /Results Sweep/.test(title)).length, 1);
  assert.equal(titles.filter(title => /Calls Burst/.test(title)).length, 1);
  assert.ok(titles.some(title => /Wind-down/i.test(title)));
  const latestEnd = Math.max(...itinerary.map(block => toMinutes(block.end)));
  assert.ok(latestEnd <= toMinutes('16:00'));
  const carryover = itinerary.find(block => block.kind === 'CarryoverLog');
  assert.ok(carryover);
  assert.match(carryover.title, /Advice Wrap/);
});
