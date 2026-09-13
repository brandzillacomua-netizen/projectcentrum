import { createHash } from 'node:crypto'
import { createReadStream, readFileSync, writeFileSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, resolve } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const RESTORE_CONTAINER = 'centrum-restore-drill'
export const RESTORE_DATABASE = 'centrum_restore'
export const RESTORE_PURPOSE = 'isolated-restore-drill'
export const REQUIRED_POSTGRES_MAJOR = 17

export async function sha256File(filePath) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(filePath)) hash.update(chunk)
  return hash.digest('hex')
}

export async function verifyBackupManifest(directory) {
  const manifestPath = resolve(directory, 'manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (manifest.sourceProjectRef !== 'hurzutjytlcvtbvihnry') {
    throw new Error('Backup manifest is not from the expected production project')
  }
  if (!Array.isArray(manifest.files) || manifest.files.length !== 3) {
    throw new Error('Backup manifest must describe exactly three files')
  }

  for (const expected of manifest.files) {
    if (!['roles.sql', 'schema.sql', 'data.sql'].includes(expected.name)) {
      throw new Error(`Unexpected backup file in manifest: ${expected.name}`)
    }
    const filePath = resolve(directory, expected.name)
    const details = await stat(filePath)
    if (details.size !== expected.bytes) throw new Error(`${expected.name} size does not match manifest`)
    if (await sha256File(filePath) !== expected.sha256) {
      throw new Error(`${expected.name} SHA-256 does not match manifest`)
    }
  }
  return { manifest, manifestPath }
}

export function validateRestoreContainerInspection(inspection) {
  const details = Array.isArray(inspection) ? inspection[0] : inspection
  const image = details?.Config?.Image || ''
  const purpose = details?.Config?.Labels?.['centrum.purpose']
  const running = details?.State?.Running === true
  const health = details?.State?.Health?.Status
  const major = Number(image.match(/^postgres:(\d+)/)?.[1])
  const issues = []
  if (purpose !== RESTORE_PURPOSE) issues.push('container purpose label mismatch')
  if (major !== REQUIRED_POSTGRES_MAJOR) issues.push('container PostgreSQL major must be 17')
  if (!running) issues.push('container is not running')
  if (health && health !== 'healthy') issues.push(`container health is ${health}`)
  return issues
}

async function latestBackupDirectory(root) {
  const entries = await readdir(root, { withFileTypes: true })
  const directories = []
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('centrum-production-')) continue
    const directory = resolve(root, entry.name)
    directories.push({ directory, modified: (await stat(directory)).mtimeMs })
  }
  directories.sort((a, b) => b.modified - a.modified)
  if (!directories[0]) throw new Error(`No production backup found in ${root}`)
  return directories[0].directory
}

function dockerSync(args) {
  const result = spawnSync('docker', args, { encoding: 'utf8', shell: false, maxBuffer: 20 * 1024 * 1024 })
  if (result.error || result.status !== 0) {
    throw new Error(`${result.stdout || ''}${result.stderr || ''}`.trim() || result.error?.message)
  }
  return (result.stdout || '').trim()
}

function psqlArgs(extra = []) {
  return ['exec', '-i', RESTORE_CONTAINER, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', RESTORE_DATABASE, ...extra]
}

function runSql(sql) {
  return dockerSync([...psqlArgs(), '-Atc', sql])
}

function importSqlFile(filePath, { skipPublicSchemaCreation = false, disableTriggers = false } = {}) {
  return new Promise((resolvePromise, reject) => {
    const args = ['exec']
    if (disableTriggers) args.push('-e', 'PGOPTIONS=-c session_replication_role=replica')
    args.push('-i', RESTORE_CONTAINER, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', RESTORE_DATABASE)
    const child = spawn('docker', args, { shell: false, stdio: ['pipe', 'pipe', 'pipe'] })
    let output = ''
    let inputError = null
    child.stdout.on('data', chunk => { output += chunk.toString() })
    child.stderr.on('data', chunk => { output += chunk.toString() })
    child.stdin.on('error', error => {
      if (!['EPIPE', 'EOF'].includes(error.code)) inputError = error
    })
    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) resolvePromise(output.trim())
      else reject(new Error(`${basename(filePath)} restore failed: ${output.trim() || inputError?.message || `docker exited ${code}`}`))
    })

    const source = createReadStream(filePath, { encoding: 'utf8' })
    if (!skipPublicSchemaCreation) {
      source.pipe(child.stdin)
      return
    }

    let carry = ''
    source.on('data', chunk => {
      carry += chunk
      const lines = carry.split(/(?<=\n)/)
      carry = lines.pop() || ''
      for (const line of lines) {
        if (line.trim() !== 'CREATE SCHEMA public;') child.stdin.write(line)
      }
    })
    source.on('end', () => {
      if (carry.trim() !== 'CREATE SCHEMA public;') child.stdin.write(carry)
      child.stdin.end()
    })
    source.on('error', error => child.stdin.destroy(error))
  })
}

function bootstrapLocalSupabaseDependencies() {
  const sql = `
    DROP SCHEMA IF EXISTS public CASCADE;
    DROP SCHEMA IF EXISTS mes_private CASCADE;
    DROP SCHEMA IF EXISTS auth CASCADE;
    DROP SCHEMA IF EXISTS extensions CASCADE;
    CREATE SCHEMA public;
    CREATE SCHEMA auth;
    CREATE SCHEMA extensions;
    DO $roles$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN CREATE ROLE supabase_admin NOLOGIN; END IF;
    END
    $roles$;
    CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
    CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
      LANGUAGE sql STABLE AS 'SELECT NULL::uuid';
  `
  runSql(sql)
}

function collectMetrics() {
  const raw = runSql(`
    SELECT json_build_object(
      'tables', (SELECT count(*) FROM pg_tables WHERE schemaname = 'public'),
      'functions', (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'),
      'policies', (SELECT count(*) FROM pg_policies WHERE schemaname='public'),
      'rls_tables', (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity),
      'private_tables', (SELECT count(*) FROM pg_tables WHERE schemaname = 'mes_private'),
      'orders', CASE WHEN to_regclass('public.orders') IS NULL THEN NULL ELSE (SELECT count(*) FROM public.orders) END,
      'tasks', CASE WHEN to_regclass('public.tasks') IS NULL THEN NULL ELSE (SELECT count(*) FROM public.tasks) END,
      'work_cards', CASE WHEN to_regclass('public.work_cards') IS NULL THEN NULL ELSE (SELECT count(*) FROM public.work_cards) END,
      'material_requests', CASE WHEN to_regclass('public.material_requests') IS NULL THEN NULL ELSE (SELECT count(*) FROM public.material_requests) END,
      'system_users', CASE WHEN to_regclass('public.system_users') IS NULL THEN NULL ELSE (SELECT count(*) FROM public.system_users) END
    );
  `)
  return JSON.parse(raw)
}

async function main() {
  const backupRoot = process.env.BACKUP_OUTPUT_DIR || resolve(tmpdir(), 'centrum-mes-backups')
  const directory = process.env.BACKUP_DIRECTORY || await latestBackupDirectory(backupRoot)
  const { manifest, manifestPath } = await verifyBackupManifest(directory)
  console.log(`PASS backup integrity verified: ${directory}`)

  const inspection = JSON.parse(dockerSync(['inspect', RESTORE_CONTAINER]))
  const containerIssues = validateRestoreContainerInspection(inspection)
  if (containerIssues.length) throw new Error(`Unsafe restore target: ${containerIssues.join('; ')}`)
  console.log('PASS isolated PostgreSQL 17 restore target verified')

  bootstrapLocalSupabaseDependencies()
  console.log('PASS local Supabase compatibility dependencies prepared')
  await importSqlFile(resolve(directory, 'schema.sql'), { skipPublicSchemaCreation: true })
  console.log('PASS public + mes_private schemas restored')
  await importSqlFile(resolve(directory, 'data.sql'), { disableTriggers: true })
  console.log('PASS public data restored with local business triggers disabled during import')

  const metrics = collectMetrics()
  if (!metrics.tables || !metrics.functions || !metrics.private_tables || !metrics.work_cards) {
    throw new Error(`Restore postcondition failed: ${JSON.stringify(metrics)}`)
  }
  const restoredManifest = {
    ...manifest,
    status: 'RESTORE_VERIFIED_MES_DATABASE_SCOPE',
    restoreVerification: {
      verifiedAt: new Date().toISOString(),
      target: 'local isolated Docker PostgreSQL 17.6',
      containerPurpose: RESTORE_PURPOSE,
      rolesArtifactApplied: false,
      authSchemaRestored: false,
      storageObjectsRestored: false,
      metrics
    }
  }
  writeFileSync(manifestPath, `${JSON.stringify(restoredManifest, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  console.log(`PASS restore postcondition: ${JSON.stringify(metrics)}`)
  console.log('PASS MES public + mes_private schema/data backup is restore-verified; Auth and Storage remain outside this drill scope')
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => {
    console.error(`Restore drill failed safely: ${error?.message || error}`)
    process.exit(1)
  })
}
