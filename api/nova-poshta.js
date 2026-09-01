export default async function handler(req, res) {
  // Enable CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, errors: ['Method not allowed'] })
  }

  const serverApiKey = (
    process.env.NOVA_POSHTA_API_KEY ||
    process.env.VITE_NOVA_POSHTA_API_KEY ||
    process.env.VITE_NP_API_KEY ||
    process.env.NP_API_KEY ||
    ''
  ).trim()

  const clientApiKey = (req.body?.apiKey || '').trim()
  const requestApiKey = clientApiKey || serverApiKey

  if (!requestApiKey) {
    return res.status(400).json({
      success: false,
      errors: ['API ключ Нової Пошти не знайдено у Vercel. Вкажіть змінну NOVA_POSHTA_API_KEY у Vercel Settings -> Environment Variables, увімкніть галочку Production та зробіть Redeploy.']
    })
  }

  const { modelName, calledMethod, methodProperties } = req.body || {}

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
    return res.status(500).json({ success: false, errors: [err.message] })
  }
}
