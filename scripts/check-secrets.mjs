import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)
const findings = []
const textExtensions = /\.(?:[cm]?[jt]sx?|json|ya?ml|md|txt|html|css|sql|env|toml)$/i
const secretPatterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['Telegram bot token', /\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/],
  ['GitHub token', /\b(?:ghp|github_pat)_[A-Za-z0-9_]{30,}\b/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['client-exposed secret variable', /\bVITE_[A-Z0-9_]*(?:SECRET|PASSWORD|PRIVATE_KEY|BOT_TOKEN|API_KEY)\b/]
]

if (tracked.some(file => file === '.env' || /^\.env\.(?!example$)/.test(file))) {
  findings.push('.env: environment file must not be tracked')
}

for (const file of tracked) {
  if (!textExtensions.test(file) || file === 'scripts/check-secrets.mjs') continue
  let content
  try { content = readFileSync(file, 'utf8') } catch { continue }
  if (content.includes('\0')) continue
  const activeContent = content.split(/\r?\n/).filter(line => !line.includes('REVOKED_')).join('\n')
  for (const [label, pattern] of secretPatterns) {
    if (pattern.test(activeContent)) findings.push(`${file}: ${label}`)
  }
}

const browserFiles = tracked.filter(file => /^(src|public)\//.test(file) && textExtensions.test(file))
for (const file of browserFiles) {
  const content = readFileSync(file, 'utf8')
  if (/api\.telegram\.org\/bot|api\.novaposhta\.ua\/v2\.0/.test(content)) {
    findings.push(`${file}: privileged third-party API called directly from browser code`)
  }
}

if (findings.length) {
  console.error(`Secret boundary check failed:\n${findings.map(item => `- ${item}`).join('\n')}`)
  process.exit(1)
}
console.log(`Secret boundary check passed (${tracked.length} tracked files inspected).`)
