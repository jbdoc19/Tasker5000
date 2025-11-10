import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseStoredTasks,
  buildTaskStoragePayload,
  saveTasksToStorage,
  loadStoredTasks,
} from '../taskStorage.js';

class MemoryStorage {
  constructor() {
    this.store = new Map();
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    this.store.set(key, String(value));
  }

  removeItem(key) {
    this.store.delete(key);
  }
}

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

test('buildTaskStoragePayload clones tasks and flags quick entries', () => {
  const tasks = [
    { id: '1', name: 'Regular', category: 'General', meta: { nested: true } },
    { id: '2', name: 'Quickie', category: 'Quick Task' },
  ];

  const payload = buildTaskStoragePayload(tasks);

  assert.equal(payload.allTasks.length, 2);
  assert.equal(payload.quickTasks.length, 1);
  assert.equal(payload.quickTasks[0].id, '2');
  assert.notStrictEqual(payload.allTasks[0], tasks[0]);
  assert.notStrictEqual(payload.allTasks[1], tasks[1]);
});

test('saveTasksToStorage writes structured payload to provided storage', () => {
  const storage = new MemoryStorage();
  const tasks = [
    { id: 'x', name: 'Keep me', category: 'General' },
    { id: 'q', name: 'Quick keep', category: 'Quick Task' },
  ];

  const result = saveTasksToStorage(tasks, storage);

  assert.equal(result.success, true);
  const raw = storage.getItem('tasks');
  const parsed = JSON.parse(raw);
  assert.equal(parsed.allTasks.length, 2);
  assert.equal(parsed.quickTasks.length, 1);
});

test('loadStoredTasks returns parsed data from provided storage', () => {
  const storage = new MemoryStorage();
  storage.setItem('tasks', JSON.stringify({
    allTasks: [{ id: 'a', name: 'Stored' }],
    quickTasks: [{ id: 'b', name: 'Quick stored' }],
  }));

  const snapshot = loadStoredTasks(storage);

  assert.equal(snapshot.storageAvailable, true);
  assert.equal(snapshot.tasks.length, 1);
  assert.equal(snapshot.tasks[0].id, 'a');
  assert.equal(snapshot.quickTasks.length, 1);
  assert.equal(snapshot.quickTasks[0].id, 'b');
  assert.equal(snapshot.error, null);
});
