const baseUrl = String(process.env.RELEASE_URL || 'https://projectcentrum88.vercel.app').replace(/\/$/, '')
const expectedSha = String(process.env.EXPECTED_RELEASE_SHA || '').trim().toLowerCase()

if (!/^[0-9a-f]{40}$/.test(expectedSha)) {
  console.error('EXPECTED_RELEASE_SHA must contain the full 40-character Git commit SHA')
  process.exit(2)
}

const response = await fetch(`${baseUrl}/api/release?check=${Date.now()}`, {
  headers: { 'Cache-Control': 'no-cache' },
  redirect: 'error'
})
const release = await response.json().catch(() => null)

if (!response.ok) {
  throw new Error(`Release identity endpoint failed: HTTP ${response.status}`)
}
if (release?.service !== 'centrum-mes') {
  throw new Error('Release identity endpoint returned an unexpected service')
}
if (!/^[0-9a-f]{40}$/.test(release?.commit || '')) {
  throw new Error('Deployed release does not expose a valid Git commit SHA')
}
if (release.commit.toLowerCase() !== expectedSha) {
  throw new Error(`Deployment mismatch: expected ${expectedSha}, received ${release.commit}`)
}

console.log(`PASS deployed release: ${release.commit}`)
console.log(`PASS environment: ${release.environment || 'unknown'}`)
