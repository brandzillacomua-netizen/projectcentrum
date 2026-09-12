import {
  enforceRateLimit,
  enforceSameOrigin,
  requireMesUser,
  setApiSecurityHeaders
} from './_security.js'

export default async function handler(req, res) {
  setApiSecurityHeaders(res)
  if (!enforceSameOrigin(req, res)) return
  if (req.method !== 'GET') return res.status(405).json({ success: false, errors: ['Method not allowed'] })
  if (!enforceRateLimit(req, res, { limit: 20, scope: 'nova-poshta-print' })) return
  const user = await requireMesUser(req, res, ['shipping', 'manager', 'crm', 'director', 'admin'])
  if (!user) return

  const apiKey = String(process.env.NOVA_POSHTA_API_KEY || '').trim()
  const ref = String(req.query?.ref || '')
  const kind = req.query?.kind === 'document' ? 'document' : 'marking'
  if (!apiKey || !/^[a-f0-9-]{20,64}$/i.test(ref)) {
    return res.status(400).json({ success: false, errors: ['Invalid print request'] })
  }

  try {
    const path = kind === 'document' ? 'printDocument' : 'printMarking100x100'
    const upstream = await fetch(`https://my.novaposhta.ua/orders/${path}/orders[]/${encodeURIComponent(ref)}/type/pdf/apiKey/${encodeURIComponent(apiKey)}`)
    if (!upstream.ok) return res.status(502).json({ success: false, errors: ['Print document is unavailable'] })

    const payload = Buffer.from(await upstream.arrayBuffer())
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="nova-poshta-${kind}.pdf"`)
    return res.status(200).send(payload)
  } catch (error) {
    console.error('[nova-poshta-print] upstream request failed', { message: error?.message, userId: user.id })
    return res.status(502).json({ success: false, errors: ['Print document is unavailable'] })
  }
}
