import test from 'node:test';
import assert from 'node:assert/strict';

const eventHandlers = new Map();

const resetGlobals = () => {
  eventHandlers.clear?.();
  globalThis.clients = {
    matchAll: async () => [],
    openWindow: async () => ({})
  };
  globalThis.self = {
    registration: { scope: '/app/' },
    addEventListener: (type, handler) => {
      eventHandlers.set(type, handler);
    },
  };
};

resetGlobals();

await import('../service-worker.js');

const getNotificationHandler = () => {
  const handler = eventHandlers.get('notificationclick');
  if (!handler) {
    throw new Error('notificationclick handler not registered');
  }
  return handler;
};

test('service worker focuses existing client and forwards reminder message', async () => {
  const focusCalls = [];
  const messagePayloads = [];
  const closeCalls = [];
  const focusedClient = {
    focus: async () => {
      focusCalls.push(true);
    },
    postMessage: payload => {
      messagePayloads.push(payload);
    },
  };

  globalThis.clients.matchAll = async () => [focusedClient];
  globalThis.clients.openWindow = async () => {
    throw new Error('openWindow should not be called when a client exists');
  };

  const handler = getNotificationHandler();
  let waitUntilPromise;
  const event = {
    notification: {
      data: { routineId: '123' },
      close: () => closeCalls.push(true),
    },
    waitUntil(promise) {
      waitUntilPromise = promise;
    },
  };

  handler(event);
  await waitUntilPromise;

  assert.equal(closeCalls.length, 1);
  assert.equal(focusCalls.length, 1);
  assert.deepEqual(messagePayloads, [{ type: 'routine-reminder', routineId: '123' }]);
});

test('service worker opens new window when no clients are available', async () => {
  const closeCalls = [];
  const openedTargets = [];

  globalThis.clients.matchAll = async () => [];
  globalThis.clients.openWindow = async url => {
    openedTargets.push(url);
  };

  const handler = getNotificationHandler();
  let waitUntilPromise;
  const event = {
    notification: {
      data: { routineId: null },
      close: () => closeCalls.push(true),
    },
    waitUntil(promise) {
      waitUntilPromise = promise;
    },
  };

  handler(event);
  await waitUntilPromise;

  assert.equal(closeCalls.length, 1);
  assert.deepEqual(openedTargets, ['/app/']);
});

