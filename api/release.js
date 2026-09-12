const SHA_PATTERN = /^[0-9a-f]{40}$/i

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const commit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || null
  const environment = process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown'

  return res.status(200).json({
    service: 'centrum-mes',
    commit: SHA_PATTERN.test(commit || '') ? commit.toLowerCase() : null,
    environment
  })
}
