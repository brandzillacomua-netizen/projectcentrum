/**
 * pushService.js
 * Центральний сервіс для Web Push підписок та відправки сповіщень.
 * 
 * Архітектура:
 *   - Кожен пристрій/браузер підписується окремо
 *   - Підписка зберігається в таблиці push_subscriptions (user_id, endpoint, keys)
 *   - Для відправки -> викликаємо Supabase Edge Function "send-push"
 */

import { supabase, supabaseAnonKey, supabaseUrl } from '../supabase.js';

// ─── VAPID PUBLIC KEY ─────────────────────────────────────────────────────────
// Публічний ключ (приватний зберігається в Supabase Secrets як VAPID_PRIVATE_KEY)
export const VAPID_PUBLIC_KEY = 'BKuq-VKlrw9HR3MIZu307Hqd0U_LHkJxVMbgNBfC6je6OjVoU3IcDe5mdynIy95cJXtfv9viv3PnQW6DS4vbeOM';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

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

// ─── ПІДПИСКА НА PUSH ─────────────────────────────────────────────────────────

/**
 * Підписує поточний пристрій і зберігає підписку в БД.
 * Запускати при логіні або при зміні дозволу.
 * @param {number|string} userId - ID поточного користувача
 * @returns {Promise<boolean>} - true якщо підписано успішно
 */
export async function subscribeToPush(userId) {
  if (!userId) return false;
  
  try {
    // Перевіряємо підтримку
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[Push] Web Push не підтримується цим браузером');
      return false;
    }

    // Запитуємо дозвіл (тільки якщо ще не надано)
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') {
      console.warn('[Push] Дозвіл відхилено:', permission);
      return false;
    }

    // Чекаємо реєстрацію SW
    const registration = await navigator.serviceWorker.ready;

    // Підписуємось через PushManager
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    const subJson = subscription.toJSON();
    const endpoint = subJson.endpoint;
    const p256dh = subJson.keys?.p256dh;
    const auth = subJson.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      console.error('[Push] Підписка не містить ключів');
      return false;
    }

    // Визначаємо тип пристрою
    const deviceInfo = navigator.userAgent.substring(0, 200);

    // Зберігаємо в БД (upsert за endpoint щоб не дублювати)
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        device_info: deviceInfo,
        updated_at: new Date().toISOString()
      }, { onConflict: 'endpoint' });

    if (error) {
      console.error('[Push] Помилка збереження підписки:', error);
      return false;
    }

    console.log('[Push] ✅ Пристрій підписано успішно');
    return true;

  } catch (err) {
    console.error('[Push] Помилка підписки:', err);
    return false;
  }
}

/**
 * Відписує поточний пристрій.
 * @param {number|string} userId
 */
export async function unsubscribeFromPush(userId) {
  try {
    if (!('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      // Видаляємо з БД
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
      console.log('[Push] Відписано');
    }
  } catch (err) {
    console.error('[Push] Помилка відписки:', err);
  }
}

/**
 * Перевіряє чи поточний пристрій вже підписаний.
 * @returns {Promise<boolean>}
 */
export async function isPushSubscribed() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}

// ─── ВІДПРАВКА PUSH ───────────────────────────────────────────────────────────

/**
 * Відправляє push сповіщення конкретному користувачу на всі його пристрої.
 * Викликає Supabase Edge Function "send-push".
 * 
 * @param {number|string} userId - кому відправляємо
 * @param {string} title - заголовок
 * @param {string} body - текст
 * @param {string} path - шлях для переходу при кліку (напр. '/warehouse')
 * @param {object} [notifData] - додаткові дані (для навігації)
 */
export async function sendPushToUser(userId, title, body, path = '/', notifData = {}) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`
      },
      body: JSON.stringify({ user_id: userId, title, body, path, notifData })
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (err) {
    // Не критична помилка — логуємо і продовжуємо
    console.warn('[Push] Не вдалось відправити push:', err?.message || err);
    return null;
  }
}

/**
 * Відправляє push сповіщення кільком користувачам одночасно.
 * @param {Array<number|string>} userIds
 * @param {string} title
 * @param {string} body
 * @param {string} path
 * @param {object} [notifData]
 */
export async function sendPushToUsers(userIds, title, body, path = '/', notifData = {}) {
  if (!userIds || userIds.length === 0) return;
  await Promise.allSettled(
    userIds.map(uid => sendPushToUser(uid, title, body, path, notifData))
  );
}
