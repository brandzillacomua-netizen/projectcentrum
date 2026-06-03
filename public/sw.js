// ─── Centrum Service Worker ───────────────────────────────────────────────────
const CACHE_NAME = 'centrum-v1';

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

// ─── PUSH EVENT: отримуємо push від сервера і показуємо сповіщення ────────────
self.addEventListener('push', function(event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Centrum', body: event.data ? event.data.text() : 'Нове сповіщення' };
  }

  const title = data.title || 'Centrum MES';
  const options = {
    body: data.body || '',
    icon: '/kulytsya.png',
    badge: '/kulytsya.png',
    tag: data.tag || String(Date.now()),
    data: { path: data.path || '/', notifData: data.notifData },
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: false,
    silent: false,
    actions: data.path ? [
      { action: 'open', title: 'Відкрити' },
      { action: 'dismiss', title: 'Закрити' }
    ] : []
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ─── NOTIFICATION CLICK ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const path = event.notification.data?.path || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Шукаємо вже відкриту вкладку
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if ('focus' in client) {
          client.postMessage({ type: 'NAVIGATE', path: path });
          return client.focus();
        }
      }
      // Якщо немає відкритих вкладок — відкриваємо нову
      if (clients.openWindow) {
        return clients.openWindow(path);
      }
    })
  );
});

// ─── PUSH SUBSCRIPTION CHANGE ─────────────────────────────────────────────────
// Якщо браузер автоматично змінив підписку — оновлюємо в БД
self.addEventListener('pushsubscriptionchange', function(event) {
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options)
      .then(function(subscription) {
        // Повідомляємо клієнт про нову підписку
        return clients.matchAll({ type: 'window' }).then(function(clientList) {
          clientList.forEach(function(client) {
            client.postMessage({ type: 'SUBSCRIPTION_CHANGED', subscription: subscription.toJSON() });
          });
        });
      })
  );
});
