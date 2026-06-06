// ─── Centrum Service Worker ───────────────────────────────────────────────────
const CACHE_NAME = 'centrum-v1';

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

// ─── FETCH EVENT: Необхідно для коректної роботи PWA в офлайні та фоні ─────────
self.addEventListener('fetch', function(event) {
  // Пропускаємо запити і за потреби повертаємо з кешу
  event.respondWith(
    fetch(event.request).catch(function() {
      return caches.match(event.request);
    })
  );
});

// ─── UTILS FOR SUBSCRIPTION RENEWAL ───────────────────────────────────────────
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function updateSubscriptionInDB(oldEndpoint, newSubscription) {
  const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
  const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
  
  const subJson = newSubscription.toJSON();
  const endpoint = subJson.endpoint;
  const p256dh = subJson.keys && subJson.keys.p256dh;
  const auth = subJson.keys && subJson.keys.auth;

  if (!endpoint || !p256dh || !auth) return Promise.resolve();

  if (oldEndpoint) {
    return fetch(`${supabaseUrl}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(oldEndpoint)}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        endpoint: endpoint,
        p256dh: p256dh,
        auth: auth,
        updated_at: new Date().toISOString()
      })
    }).then(res => {
      console.log('[SW] Subscription updated in DB:', res.status);
    }).catch(err => {
      console.error('[SW] Failed to update subscription in DB:', err);
    });
  }
  return Promise.resolve();
}

// ─── PUSH EVENT: отримуємо push від сервера і показуємо сповіщення ────────────
self.addEventListener('push', function(event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Centrum', body: event.data ? event.data.text() : 'Нове сповіщення' };
  }

  const title = data.title || 'Centrum MES';
  const iconUrl = new URL('/kulytsya.png', self.location.origin).href;
  
  const options = {
    body: data.body || '',
    icon: iconUrl,
    badge: iconUrl,
    tag: (data.notifData && data.notifData.tag) || data.tag || String(Date.now()),
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

  const path = (event.notification.data && event.notification.data.path) || '/';
  const state = (event.notification.data && event.notification.data.state) || null;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Шукаємо вже відкриту вкладку
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if ('focus' in client) {
          client.postMessage({ type: 'NAVIGATE', path: path, state: state });
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
  const oldEndpoint = event.oldSubscription ? event.oldSubscription.endpoint : null;
  const options = event.oldSubscription ? event.oldSubscription.options : {
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array('BKuq-VKlrw9HR3MIZu307Hqd0U_LHkJxVMbgNBfC6je6OjVoU3IcDe5mdynIy95cJXtfv9viv3PnQW6DS4vbeOM')
  };

  event.waitUntil(
    self.registration.pushManager.subscribe(options)
      .then(function(subscription) {
        // 1. Оновлюємо безпосередньо в БД
        return updateSubscriptionInDB(oldEndpoint, subscription).then(function() {
          // 2. Повідомляємо клієнт про нову підписку
          return clients.matchAll({ type: 'window' }).then(function(clientList) {
            clientList.forEach(function(client) {
              client.postMessage({ type: 'SUBSCRIPTION_CHANGED', subscription: subscription.toJSON() });
            });
          });
        });
      })
  );
});
