const baseUrl = String(process.env.RELEASE_URL || 'https://projectcentrum88.vercel.app').replace(/\/$/, '')
const checks = []

const record = (name, ok, detail) => {
  checks.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${detail}`)
}

async function expectStatus(name, path, init, acceptedStatuses) {
  try {
    const response = await fetch(`${baseUrl}${path}`, { redirect: 'error', ...init })
    record(name, acceptedStatuses.includes(response.status), `HTTP ${response.status}`)
    return response
  } catch (error) {
    record(name, false, error?.message || 'network error')
    return null
  }
}

const appResponse = await expectStatus('application health', '/', { method: 'GET' }, [200])

if (appResponse) {
  const requiredHeaders = {
    'strict-transport-security': 'max-age=',
    'content-security-policy': "default-src 'self'",
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY'
  }

  for (const [header, expectedFragment] of Object.entries(requiredHeaders)) {
    const value = appResponse.headers.get(header) || ''
    record(`security header ${header}`, value.includes(expectedFragment), value || 'missing')
  }

  const html = await appResponse.text()
  const entryMatch = html.match(/<script[^>]+src="([^"]*\/assets\/index-[^"]+\.js)"/)
  if (!entryMatch) {
    record('entry asset discovery', false, 'entry script missing from HTML')
  } else {
    const assetUrl = new URL(entryMatch[1], baseUrl)
    const assetResponse = await fetch(assetUrl, { method: 'HEAD', redirect: 'error' }).catch(() => null)
    record('entry asset available', assetResponse?.ok === true, assetResponse ? `HTTP ${assetResponse.status}` : 'network error')
  }
}

await expectStatus('manifest available', '/manifest.json', { method: 'GET' }, [200])
await expectStatus('Nova Poshta anonymous deny', '/api/nova-poshta', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}'
}, [401])
await expectStatus('Telegram anonymous deny', '/api/telegram-alert', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}'
}, [401])

if (checks.some(check => !check.ok)) process.exit(1)
console.log(`Public production smoke passed (${checks.length} checks).`)
