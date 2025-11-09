import assert from 'node:assert/strict';
import test from 'node:test';
import { parseStoredTasks } from '../taskStorage.js';

test('parseStoredTasks returns sanitized task objects', () => {
  const saved = JSON.stringify([
    { id: '1', name: 'Valid' },
    null,
    { id: '2', name: 'Also valid' },
    'skip-me'
  ]);

  const result = parseStoredTasks(saved);

  assert.equal(result.tasks.length, 2);
  assert.equal(result.discarded, 2);
  assert.equal(result.quickTasks.length, 0);
  assert.deepEqual(result.tasks[0], { id: '1', name: 'Valid' });
  assert.deepEqual(result.tasks[1], { id: '2', name: 'Also valid' });
  assert.equal(result.error, null);
});

test('parseStoredTasks supports legacy object wrapper', () => {
  const saved = JSON.stringify({ tasks: [{ id: 'legacy', name: 'Wrapper' }] });
  const result = parseStoredTasks(saved);

  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].id, 'legacy');
  assert.equal(result.discarded, 0);
  assert.equal(result.quickTasks.length, 0);
});

test('parseStoredTasks surfaces JSON errors', () => {
  const result = parseStoredTasks('{ bad json }');

  assert.equal(result.tasks.length, 0);
  assert.equal(result.quickTasks.length, 0);
  assert.ok(result.error instanceof Error);
});

test('parseStoredTasks reads structured payload with quick tasks', () => {
  const saved = JSON.stringify({
    version: 2,
    savedAt: '2024-05-01T12:00:00.000Z',
    allTasks: [
      { id: 'a', name: 'All task' },
      null,
      'ignore'
    ],
    quickTasks: [
      { id: 'quick-1', name: 'Quick task' },
      42,
      null
    ]
  });

  const result = parseStoredTasks(saved);

  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].id, 'a');
  assert.equal(result.discarded, 2);
  assert.equal(result.quickTasks.length, 1);
  assert.equal(result.quickTasks[0].id, 'quick-1');
  assert.equal(result.quickDiscarded, 2);
  assert.equal(result.error, null);
});
