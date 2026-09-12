/**
 * Telegram transport. Credentials never enter the browser bundle or storage;
 * an authenticated same-origin serverless endpoint owns the integration.
 */
import { supabase } from '../../supabase.js'

const STORAGE_KEY_TOKEN = 'TELEGRAM_ALERT_BOT_TOKEN'
const STORAGE_KEY_CHAT_ID = 'TELEGRAM_ALERT_CHAT_ID'
const STORAGE_KEY_ENABLED = 'TELEGRAM_ALERT_ENABLED'

class TelegramTransport {
  getConfig() {
    localStorage.removeItem(STORAGE_KEY_TOKEN)
    localStorage.removeItem(STORAGE_KEY_CHAT_ID)
    return {
      isEnabled: localStorage.getItem(STORAGE_KEY_ENABLED) !== 'false',
      serverManaged: true
    }
  }

  saveConfig({ isEnabled } = {}) {
    localStorage.removeItem(STORAGE_KEY_TOKEN)
    localStorage.removeItem(STORAGE_KEY_CHAT_ID)
    if (isEnabled !== undefined) localStorage.setItem(STORAGE_KEY_ENABLED, String(Boolean(isEnabled)))
  }

  async sendMessage(htmlMessage, options = {}) {
    const config = this.getConfig()
    if (!config.isEnabled && options.kind !== 'test') {
      return { success: false, error: 'Сповіщення Telegram вимкнено в налаштуваннях.' }
    }
    const { data, error } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    if (error || !token) return { success: false, error: 'Потрібна активна сесія користувача.' }

    try {
      const response = await fetch('/api/telegram-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: String(htmlMessage || ''), kind: options.kind || 'crash' }),
        keepalive: true
      })
      const payload = await response.json().catch(() => ({}))
      if (response.ok && payload.success) return payload
      return { success: false, error: payload.errors?.[0] || `HTTP ${response.status}` }
    } catch (requestError) {
      return { success: false, error: requestError?.message || 'Network error' }
    }
  }
}

export const telegramTransport = new TelegramTransport()
export default telegramTransport
