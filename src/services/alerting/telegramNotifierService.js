/**
 * @file telegramNotifierService.js
 * @description Фасад-оркестратор підсистеми сповіщень про аварійні збої в Telegram.
 * Поєднує Root Cause Analyzer, Rate Limiter, Formatter та Transport.
 */

import { analyzeRootCause } from './errorRootCauseAnalyzer.js'
import { alertRateLimiter } from './alertRateLimiter.js'
import { formatCrashAlertMessage, formatTestAlertMessage } from './telegramFormatter.js'
import { telegramTransport } from './telegramTransport.js'

class TelegramNotifierService {
  /**
   * Обробка та миттєва відправка сповіщення про аварійний збій
   * @param {Object} errorRecord - Детальні відомості про зафіксовану помилку
   * @returns {Promise<{ sent: boolean, reason?: string, rootCause?: Object }>}
   */
  async sendTelegramCrashAlert(errorRecord = {}) {
    // 1. Перевірка активності конфігурації
    const config = telegramTransport.getConfig()
    if (!config.isEnabled || !config.botToken || !config.chatId) {
      return { sent: false, reason: 'NOT_CONFIGURED_OR_DISABLED' }
    }

    // 2. Перевірка обмеження частоти (Rate Limiter / Cooldown)
    const rateCheck = alertRateLimiter.shouldSend(errorRecord)
    if (!rateCheck.allowed) {
      console.info(`[TelegramNotifier] Сповіщення пропущено: ${rateCheck.reason}`)
      return { sent: false, reason: rateCheck.reason }
    }

    // 3. Евристичний аналіз першопричини (Root Cause Analysis)
    const rootCause = analyzeRootCause(errorRecord)

    // 4. Форматування HTML-повідомлення
    const htmlMessage = formatCrashAlertMessage({ errorRecord, rootCause })

    // 5. Відправка повідомлення через мережевий транспорт
    const result = await telegramTransport.sendMessage(htmlMessage)

    if (result.success) {
      alertRateLimiter.recordSent(errorRecord)
      console.info('[TelegramNotifier] Сповіщення про збій успішно надіслано в Telegram!')
      return { sent: true, rootCause }
    } else {
      return { sent: false, reason: result.error, rootCause }
    }
  }

  /**
   * Відправка тестового повідомлення з вікна налаштувань
   */
  async sendTestNotification(overrideConfig = null, senderName = 'Адміністратор') {
    const htmlMessage = formatTestAlertMessage(senderName)
    return await telegramTransport.sendMessage(htmlMessage, overrideConfig)
  }

  getConfig() {
    return telegramTransport.getConfig()
  }

  saveConfig(config) {
    telegramTransport.saveConfig(config)
  }
}

export const telegramNotifierService = new TelegramNotifierService()
export default telegramNotifierService
