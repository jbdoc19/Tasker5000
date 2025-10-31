self.addEventListener('notificationclick', event => {
  const routineId = event.notification?.data?.routineId || null;
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      if (clientList.length > 0) {
        const client = clientList[0];
        if (routineId) {
          client.postMessage({ type: 'routine-reminder', routineId });
        }
        return client.focus();
      }
      const scopeUrl = self.registration.scope || '/';
      const targetUrl = routineId ? `${scopeUrl}#routine-${routineId}` : scopeUrl;
      return clients.openWindow(targetUrl);
    })
  );
});
