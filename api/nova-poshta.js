import {
  enforceRateLimit,
  enforceSameOrigin,
  hasValidBodySize,
  requireMesUser,
  setApiSecurityHeaders
} from './_security.js'

const ALLOWED_OPERATIONS = new Set([
  'Address.searchSettlements',
  'Address.searchSettlementStreets',
  'Address.getWarehouses',
  'Counterparty.getCounterparties',
  'Counterparty.getCounterpartyContactPersons',
  'Counterparty.getCounterpartyAddresses',
  'Counterparty.searchCounterparties',
  'Counterparty.save',
  'InternetDocument.save'
])

export default async function handler(req, res) {
  setApiSecurityHeaders(res)
  if (!enforceSameOrigin(req, res)) return

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, errors: ['Method not allowed'] })
  }

  if (!enforceRateLimit(req, res, { limit: 40, scope: 'nova-poshta' })) return
  if (!hasValidBodySize(req, res)) return
  const user = await requireMesUser(req, res, ['shipping', 'manager', 'crm', 'director', 'admin'])
  if (!user) return

  const requestApiKey = String(process.env.NOVA_POSHTA_API_KEY || '').trim()

  if (!requestApiKey) {
    return res.status(400).json({
      success: false,
      errors: ['Nova Poshta integration is not configured on the server']
    })
  }

  const { modelName, calledMethod, methodProperties } = req.body || {}
  if (!ALLOWED_OPERATIONS.has(`${modelName}.${calledMethod}`)) {
    return res.status(403).json({ success: false, errors: ['Nova Poshta operation is not allowed'] })
  }

  try {
    const response = await fetch('https://api.novaposhta.ua/v2.0/json/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: requestApiKey,
        modelName,
        calledMethod,
        methodProperties: methodProperties || {}
      })
    })

    const data = await response.json()
    return res.status(200).json(data)
  } catch (err) {
    console.error('[nova-poshta] upstream request failed', { message: err?.message, userId: user.id })
    return res.status(502).json({ success: false, errors: ['Nova Poshta upstream request failed'] })
  }
}
