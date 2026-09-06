/**
 * @file telegramTransport.js
 * @description Мережевий транспорт для взаємодії з Telegram Bot API.
 */

const STORAGE_KEY_TOKEN = 'TELEGRAM_ALERT_BOT_TOKEN'
const STORAGE_KEY_CHAT_ID = 'TELEGRAM_ALERT_CHAT_ID'
const STORAGE_KEY_ENABLED = 'TELEGRAM_ALERT_ENABLED'

export function sanitizeChatId(raw) {
  if (!raw) return ''
  let cleaned = String(raw).trim()
  // Очищення префіксів "ID:", "id:", "chat_id:", пробілів тощо
  cleaned = cleaned.replace(/^(id|chat_id|chat|id\s*груп[иа]|id\s*чату)\s*[:=-]\s*/i, '').trim()
  cleaned = cleaned.replace(/\s+/g, '')
  return cleaned
}

class TelegramTransport {
  /**
   * Отримання поточної конфігурації (LocalStorage або ENV)
   */
  getConfig() {
    const localToken = localStorage.getItem(STORAGE_KEY_TOKEN)
    const localChatId = localStorage.getItem(STORAGE_KEY_CHAT_ID)
    const localEnabled = localStorage.getItem(STORAGE_KEY_ENABLED)

    const envToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN
    const envChatId = import.meta.env.VITE_TELEGRAM_CHAT_ID

    const botToken = (localToken || envToken || '').trim()
    const chatId = sanitizeChatId(localChatId || envChatId || '')
    // За замовчуванням увімкнено, якщо наявні токен та chat_id, або якщо localEnabled !== 'false'
    const isEnabled = localEnabled !== null ? localEnabled === 'true' : Boolean(botToken && chatId)

    return { botToken, chatId, isEnabled }
  }

  /**
   * Збереження налаштувань в LocalStorage
   */
  saveConfig({ botToken, chatId, isEnabled }) {
    if (botToken !== undefined) localStorage.setItem(STORAGE_KEY_TOKEN, botToken.trim())
    if (chatId !== undefined) localStorage.setItem(STORAGE_KEY_CHAT_ID, sanitizeChatId(chatId))
    if (isEnabled !== undefined) localStorage.setItem(STORAGE_KEY_ENABLED, String(isEnabled))
  }

  /**
   * Безпечна неблокуюча відправка повідомлення в Telegram
   * @param {string} htmlMessage - Текст повідомлення у форматі HTML
   * @param {Object} [overrideConfig] - Тимчасові налаштування (для тестування)
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async sendMessage(htmlMessage, overrideConfig = null) {
    const rawConfig = overrideConfig || this.getConfig()
    const config = {
      botToken: (rawConfig.botToken || '').trim(),
      chatId: sanitizeChatId(rawConfig.chatId),
      isEnabled: rawConfig.isEnabled
    }

    if (!config.isEnabled && !overrideConfig) {
      return { success: false, error: 'Сповіщення Telegram вимкнено в налаштуваннях.' }
    }

    if (!config.botToken || !config.chatId) {
      return { success: false, error: 'Не задано Bot Token або Chat ID.' }
    }

    // Кандидати для авто-підбору формату Chat ID (для груп, супергруп та звичайних чатів)
    const candidates = [config.chatId]
    const rawDigits = config.chatId.replace(/^-/, '')
    
    if (config.chatId.startsWith('-100')) {
      candidates.push(`-${config.chatId.slice(4)}`)
    } else if (config.chatId.startsWith('-')) {
      candidates.push(`-100${rawDigits}`)
    } else {
      candidates.push(`-${rawDigits}`)
      candidates.push(`-100${rawDigits}`)
    }

    let lastError = null

    for (const testId of candidates) {
      try {
        const endpoint = `https://api.telegram.org/bot${config.botToken}/sendMessage`
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            chat_id: testId,
            text: htmlMessage,
            parse_mode: 'HTML',
            disable_web_page_preview: true
          }),
          keepalive: true
        })

        const data = await response.json()

        if (response.ok && data.ok) {
          // Якщо спрацював скоригований Chat ID (наприклад з префіксом -100) — оновлюємо збережений
          if (testId !== config.chatId) {
            this.saveConfig({ chatId: testId })
            console.info(`[TelegramTransport] Автоматично скориговано Chat ID: ${testId}`)
          }
          return { success: true, data, resolvedChatId: testId }
        }

        lastError = data.description || `HTTP ${response.status}`
        // Якщо помилка не "chat not found", немає сенсу пробувати інші префікси
        if (!lastError.includes('chat not found')) {
          break
        }
      } catch (err) {
        lastError = err?.message || 'Network error'
      }
    }

    let friendlyError = lastError
    if (lastError?.includes('chat not found')) {
      friendlyError = 'Чат не знайдено (Bad Request: chat not found). Будь ласка, перевірте: 1) Чи додано бота в учасники цієї групи? 2) Якщо це особистий чат — обов\'язково відкрийте бота і натисніть «START» (/start).'
    } else if (lastError?.includes('Unauthorized')) {
      friendlyError = 'Невірний Bot Token (Unauthorized). Будь ласка, перевірте токен, виданий @BotFather.'
    }

    console.warn('[TelegramTransport] Помилка відправки в Telegram:', friendlyError)
    return { success: false, error: friendlyError }
  }
}

export const telegramTransport = new TelegramTransport()
export default telegramTransport
