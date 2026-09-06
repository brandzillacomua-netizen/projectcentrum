/**
 * @file telegramFormatter.js
 * @description Форматування діагностики та даних помилки у безпечну HTML-розмітку Telegram.
 */

/**
 * Безпечне екранування символів для Telegram HTML
 */
export function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Форматування повідомлення про аварійний збій
 * @param {Object} params
 * @param {Object} params.errorRecord - Дані помилки
 * @param {Object} params.rootCause - Результат роботи errorRootCauseAnalyzer
 * @returns {string} Валідний HTML-текст для Telegram
 */
export function formatCrashAlertMessage({ errorRecord = {}, rootCause = {} }) {
  const user = errorRecord.user || {}
  const userName = user.name ? `${user.name} (@${user.login || user.id || 'anonymous'})` : 'Неавторизований робітник'
  const userRole = user.role ? `[${user.role.toUpperCase()}]` : ''
  const location = errorRecord.url || window?.location?.pathname || 'Термінал MES'
  
  // Час у локальному зрозумілому форматі (Київський час)
  const now = new Date()
  const timeStr = now.toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv', hour12: false })

  const errName = escapeHtml(errorRecord.name || 'Error')
  const errMsg = escapeHtml(errorRecord.message || 'Невідома помилка виконання')
  
  // Обрізання стеку для дотримання ліміту Telegram (4096 символів)
  let cleanStack = ''
  if (errorRecord.stack) {
    const lines = String(errorRecord.stack).split('\n').slice(0, 5)
    cleanStack = lines.join('\n')
  } else if (errorRecord.componentStack) {
    const lines = String(errorRecord.componentStack).split('\n').slice(0, 4)
    cleanStack = lines.join('\n')
  }

  const stackBlock = cleanStack
    ? `\n\n🔍 <b>Стек виклику:</b>\n<pre>${escapeHtml(cleanStack)}</pre>`
    : ''

  const causeTitle = escapeHtml(rootCause.causeTitle || 'Не визначено')
  const causeDesc = escapeHtml(rootCause.causeDescription || '')
  const action = escapeHtml(rootCause.recommendedAction || 'Перезавантажити сторінку')

  return `🚨 <b>КРИТИЧНИЙ ЗБІЙ У ПРОГРАМІ (MES Terminal)</b>

👤 <b>Користувач:</b> ${escapeHtml(userName)} ${escapeHtml(userRole)}
📍 <b>Екран / URL:</b> <code>${escapeHtml(location)}</code>
⏰ <b>Час:</b> ${escapeHtml(timeStr)}
💥 <b>Помилка:</b> <code>${errName}: ${errMsg}</code>

💡 <b>МОЖЛИВА ПРИЧИНА:</b>
<b>${causeTitle}</b>
${causeDesc}

🛠️ <b>РЕКОМЕНДОВАНА ДІЯ:</b>
👉 <i>${action}</i>${stackBlock}`
}

/**
 * Форматування тестового сповіщення
 */
export function formatTestAlertMessage(customSender = 'Адміністратор') {
  const timeStr = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv', hour12: false })
  return `✅ <b>ТЕСТОВЕ СПОВІЩЕННЯ MES CENTRUM</b>

Система моніторингу та сповіщення про збої успішно підключена до цього чату!

👤 <b>Ініціатор:</b> ${escapeHtml(customSender)}
⏰ <b>Час перевірки:</b> ${escapeHtml(timeStr)}
🌐 <b>Статус:</b> Канал сповіщень активний та готовий до фіксації помилок.`
}
