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
});

test('parseStoredTasks recovers from nested wrappers and strings', () => {
  const legacy = {
    data: {
      payload: JSON.stringify({
        taskList: {
          0: { id: 'nested-0', name: 'Nested Zero' },
          1: { id: 'nested-1', name: 'Nested One' },
        },
      }),
    },
  };

  const saved = JSON.stringify(legacy);
  const result = parseStoredTasks(saved);

  assert.equal(result.tasks.length, 2);
  assert.deepEqual(result.tasks.map(task => task.id), ['nested-0', 'nested-1']);
});

test('parseStoredTasks ignores unparsable nested strings', () => {
  const saved = JSON.stringify({ tasks: ['{ nope }', { id: 'valid', name: 'Task' }] });
  const result = parseStoredTasks(saved);

  assert.equal(result.tasks.length, 1);
  assert.equal(result.discarded, 1);
  assert.equal(result.tasks[0].id, 'valid');
});

test('parseStoredTasks surfaces JSON errors', () => {
  const result = parseStoredTasks('{ bad json }');

  assert.equal(result.tasks.length, 0);
  assert.ok(result.error instanceof Error);
});
