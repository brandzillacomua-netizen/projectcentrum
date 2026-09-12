import {
  enforceRateLimit,
  enforceSameOrigin,
  hasValidBodySize,
  requireMesUser,
  setApiSecurityHeaders
} from './_security.js'

export default async function handler(req, res) {
  setApiSecurityHeaders(res)
  if (!enforceSameOrigin(req, res)) return
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ success: false, errors: ['Method not allowed'] })
  if (!enforceRateLimit(req, res, { limit: 10, scope: 'telegram-alert' })) return
  if (!hasValidBodySize(req, res, 16 * 1024)) return

  const kind = req.body?.kind === 'test' ? 'test' : 'crash'
  const user = await requireMesUser(req, res, kind === 'test' ? ['settings', 'director', 'admin'] : [])
  if (!user) return

  const botToken = String(process.env.TELEGRAM_BOT_TOKEN || '').trim()
  const chatId = String(process.env.TELEGRAM_CHAT_ID || '').trim()
  const message = String(req.body?.message || '').trim().slice(0, 4000)
  if (!botToken || !chatId) return res.status(503).json({ success: false, errors: ['Telegram integration is not configured'] })
  if (!message) return res.status(400).json({ success: false, errors: ['Message is required'] })

  try {
    const upstream = await fetch(`https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML', disable_web_page_preview: true })
    })
    const data = await upstream.json().catch(() => ({}))
    if (!upstream.ok || !data.ok) {
      console.error('[telegram-alert] delivery failed', { status: upstream.status, userId: user.id })
      return res.status(502).json({ success: false, errors: ['Telegram delivery failed'] })
    }
    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('[telegram-alert] upstream request failed', { message: error?.message, userId: user.id })
    return res.status(502).json({ success: false, errors: ['Telegram upstream request failed'] })
  }
}
