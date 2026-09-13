import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const PRODUCTION_PROJECT_REF = 'hurzutjytlcvtbvihnry'

export function validateProductionDatabaseUrl(value) {
  let url
  try {
    url = new URL(String(value || '').trim())
  } catch {
    return { ok: false, error: 'Connection string is not a valid URL' }
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    return { ok: false, error: 'Connection string must use postgres:// or postgresql://' }
  }
  if (!url.password) return { ok: false, error: 'Connection string does not contain a database password' }

  const directRef = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i)?.[1]
  const poolerRef = decodeURIComponent(url.username).match(/^postgres\.([a-z0-9]+)$/i)?.[1]
  const projectRef = String(directRef || poolerRef || '').toLowerCase()

  if (projectRef !== PRODUCTION_PROJECT_REF) {
    return { ok: false, error: 'Connection string does not belong to the configured production project' }
  }

  return { ok: true, url: url.toString(), projectRef }
}

function readHiddenLine(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('Run this command in an interactive terminal')
  }

  process.stdout.write(prompt)
  process.stdin.setEncoding('utf8')
  process.stdin.setRawMode(true)
  process.stdin.resume()

  return new Promise((resolveLine, reject) => {
    let input = ''

    const finish = () => {
      process.stdin.setRawMode(false)
      process.stdin.pause()
      process.stdin.removeListener('data', onData)
      process.stdout.write('\n')
      resolveLine(input.trim())
    }

    const onData = chunk => {
      for (const character of chunk) {
        if (character === '\u0003') {
          process.stdin.setRawMode(false)
          process.stdin.pause()
          process.stdin.removeListener('data', onData)
          process.stdout.write('\n')
          reject(new Error('Credential setup cancelled'))
          return
        }
        if (character === '\r' || character === '\n') {
          finish()
          return
        }
        if (character === '\u007f' || character === '\b') {
          input = input.slice(0, -1)
          continue
        }
        input += character
      }
    }

    process.stdin.on('data', onData)
  })
}

async function main() {
  const value = await readHiddenLine('Paste the complete production PostgreSQL URI (input is hidden): ')
  const validation = validateProductionDatabaseUrl(value)

  if (!validation.ok) {
    console.error(`Credential setup failed: ${validation.error}. The supplied value was not saved.`)
    process.exit(1)
  }

  const outputPath = resolve(process.cwd(), '.env.restore.local')
  writeFileSync(
    outputPath,
    `# Local-only restore drill credentials. Never commit or share this file.\nPRODUCTION_DATABASE_URL=${validation.url}\n`,
    { encoding: 'utf8', mode: 0o600 }
  )
  console.log('Production database URI saved locally in .env.restore.local (Git-ignored).')
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => {
    console.error(error?.message || 'Credential setup failed')
    process.exit(1)
  })
}
