/**
 * @file alertRateLimiter.js
 * @description Контролер частоти сповіщень (Rate Limiting, Cooldown & Anti-Spam).
 */

const DEFAULT_COOLDOWN_MS = 60 * 1000 // 60 секунд на ідентичну помилку
const MAX_ALERTS_PER_WINDOW = 5       // Максимум 5 сповіщень на хвилину загалом
const WINDOW_DURATION_MS = 60 * 1000

class AlertRateLimiter {
  constructor(cooldownMs = DEFAULT_COOLDOWN_MS, maxAlerts = MAX_ALERTS_PER_WINDOW) {
    this.cooldownMs = cooldownMs
    this.maxAlerts = maxAlerts
    this.lastAlertTimestamps = new Map() // signature -> timestamp
    this.windowTimestamps = []           // [timestamp1, timestamp2, ...]
  }

  /**
   * Створення унікального відбитку помилки
   */
  getSignature(errorRecord = {}) {
    const name = errorRecord.name || 'Error'
    const msg = errorRecord.message || ''
    // Беремо першу строку стеку або повідомлення
    const firstStackLine = (errorRecord.stack || '').split('\n')[0] || ''
    return `${name}::${msg.slice(0, 100)}::${firstStackLine.slice(0, 100)}`
  }

  /**
   * Перевірка чи дозволено надсилати сповіщення
   * @param {Object} errorRecord
   * @returns {{ allowed: boolean, reason?: string }}
   */
  shouldSend(errorRecord = {}) {
    const now = Date.now()
    const signature = this.getSignature(errorRecord)

    // 1. Очищення застарілих записів у вікні частоти
    this.windowTimestamps = this.windowTimestamps.filter(ts => now - ts < WINDOW_DURATION_MS)

    // 2. Перевірка ліміту загальної кількості сповіщень за вікно
    if (this.windowTimestamps.length >= this.maxAlerts) {
      return {
        allowed: false,
        reason: `RATE_LIMIT_EXCEEDED: Досягнуто ліміт ${this.maxAlerts} сповіщень/хв.`
      }
    }

    // 3. Перевірка кулдауну для ідентичної помилки
    const lastTime = this.lastAlertTimestamps.get(signature)
    if (lastTime && now - lastTime < this.cooldownMs) {
      const waitSeconds = Math.ceil((this.cooldownMs - (now - lastTime)) / 1000)
      return {
        allowed: false,
        reason: `COOLDOWN_ACTIVE: Ідентична помилка вже надіслана. Очікування ще ${waitSeconds}с.`
      }
    }

    return { allowed: true }
  }

  /**
   * Реєстрація успішної відправки для оновлення лічильників
   */
  recordSent(errorRecord = {}) {
    const now = Date.now()
    const signature = this.getSignature(errorRecord)

    this.lastAlertTimestamps.set(signature, now)
    this.windowTimestamps.push(now)

    // Прибирання старих записів з Map, щоб не зростала пам'ять
    if (this.lastAlertTimestamps.size > 100) {
      for (const [sig, ts] of this.lastAlertTimestamps.entries()) {
        if (now - ts > this.cooldownMs * 2) {
          this.lastAlertTimestamps.delete(sig)
        }
      }
    }
  }

  reset() {
    this.lastAlertTimestamps.clear()
    this.windowTimestamps = []
  }
}

export const alertRateLimiter = new AlertRateLimiter()
export default alertRateLimiter
