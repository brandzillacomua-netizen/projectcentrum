import { createHash, createDecipheriv } from 'node:crypto'
import { createReadStream, readFileSync, writeFileSync, openSync, readSync, closeSync, createWriteStream, rmSync, mkdirSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, resolve, join } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

export const RESTORE_CONTAINER = 'centrum-restore-drill'
export const RESTORE_DATABASE = 'centrum_restore'
export const RESTORE_PURPOSE = 'isolated-restore-drill'
export const REQUIRED_POSTGRES_MAJOR = 17

const MAGIC_HEADER = Buffer.from([0x43, 0x54, 0x52, 0x4D, 0x01, 0x47, 0x43, 0x4D, 0x20, 0x0C]);

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

  // We now expect .enc files if encrypted
  const expectedNames = manifest.encryption === 'aes-256-gcm' 
    ? ['roles.sql.enc', 'schema.sql.enc', 'data.sql.enc']
    : ['roles.sql', 'schema.sql', 'data.sql']

  for (const expected of manifest.files) {
    if (!expectedNames.includes(expected.name)) {
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

async function decryptGcmFileToSafeTemp(sourceFile, destFile, hexKey) {
  const keyBuffer = Buffer.from(hexKey, 'hex');
  if (keyBuffer.length !== 32) throw new Error('Encryption key must be exactly 32 bytes (64 hex characters)');

  const fd = openSync(sourceFile, 'r');
  const size = statSync(sourceFile).size;
  
  // Read Auth Tag
  const authTag = Buffer.alloc(16);
  readSync(fd, authTag, 0, 16, size - 16);
  
  // Read Header and IV
  const headerIv = Buffer.alloc(22);
  readSync(fd, headerIv, 0, 22, 0);
  closeSync(fd);

  if (Buffer.compare(headerIv.subarray(0, 10), MAGIC_HEADER) !== 0) {
    throw new Error(`[FATAL] Invalid Magic Header for ${basename(sourceFile)}. The file is either corrupted or tampered with.`);
  }

  const iv = headerIv.subarray(10, 22);
  const decipher = createDecipheriv('aes-256-gcm', keyBuffer, iv);
  decipher.setAuthTag(authTag); // Set Auth Tag BEFORE decryption

  // Stream ciphertext only
  const input = createReadStream(sourceFile, { start: 22, end: size - 17 });
  const output = createWriteStream(destFile, { mode: 0o600 });
  
  try {
    await pipeline(input, decipher, output);
  } catch (err) {
    // Pipeline throws if Auth Tag fails
    rmSync(destFile, { force: true });
    throw new Error(`[FATAL] Authenticated Decryption Failed for ${basename(sourceFile)}. Ciphertext or Auth Tag was tampered with! Details: ${err.message}`);
  }
}

async function downloadFromS3(s3Key, destPath) {
  if (!process.env.AWS_S3_BUCKET || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error(`[FATAL] S3 credentials missing. Cannot download ${s3Key}`);
  }

  const s3 = new S3Client({
    region: process.env.AWS_REGION || 'eu-central-1',
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: !!process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
  });

  const response = await s3.send(new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: s3Key
  }));
  
  const output = createWriteStream(destPath);
  await pipeline(response.Body, output);
}

async function downloadFullBackupFromS3(stamp, tempDir) {
  mkdirSync(tempDir, { recursive: true, mode: 0o700 });
  console.log(`Downloading manifest from S3 for backup ${stamp}...`);
  const manifestPath = join(tempDir, 'manifest.json');
  await downloadFromS3(`backups/${stamp}/manifest.json`, manifestPath);
  
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  for (const file of manifest.files) {
    console.log(`Downloading ${file.name} from S3...`);
    await downloadFromS3(`backups/${stamp}/${file.name}`, join(tempDir, file.name));
  }
  return tempDir;
}

async function processAndImportEncrypted(directory, fileName, decryptionKey, importOptions) {
  const encFile = resolve(directory, fileName);
  const plainFile = resolve(directory, fileName.replace('.enc', ''));
  
  console.log(`Decrypting ${fileName} (verifying GCM Auth Tag)...`);
  await decryptGcmFileToSafeTemp(encFile, plainFile, decryptionKey);
  
  try {
    console.log(`Importing ${fileName.replace('.enc', '')}...`);
    await importSqlFile(plainFile, importOptions);
  } finally {
    // 0600 cleanup guarantee
    rmSync(plainFile, { force: true });
  }
}

async function main() {
  const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;
  if (!encryptionKey || !/^[0-9a-fA-F]{64}$/.test(encryptionKey)) {
    throw new Error('BACKUP_ENCRYPTION_KEY is required and must be exactly 64 hex characters (32 bytes) for AES-256');
  }

  const s3Stamp = process.env.RESTORE_S3_STAMP; // e.g. 2026-09-14T23-35-09-954Z
  let directory;
  
  if (s3Stamp) {
    const dlRoot = resolve(tmpdir(), 'centrum-s3-restore', s3Stamp);
    directory = await downloadFullBackupFromS3(s3Stamp, dlRoot);
  } else {
    const backupRoot = process.env.BACKUP_OUTPUT_DIR || resolve(tmpdir(), 'centrum-mes-backups')
    directory = process.env.BACKUP_DIRECTORY || await latestBackupDirectory(backupRoot)
  }

  const { manifest, manifestPath } = await verifyBackupManifest(directory)
  if (manifest.encryption !== 'aes-256-gcm') {
    throw new Error(`[FATAL] Backup encryption is ${manifest.encryption || 'none'}, expected aes-256-gcm. Legacy CBC backups are UNRESTORABLE / DEPRECATED for security reasons.`);
  }
  console.log(`PASS backup integrity verified: ${directory}`)

  const inspection = JSON.parse(dockerSync(['inspect', RESTORE_CONTAINER]))
  const containerIssues = validateRestoreContainerInspection(inspection)
  if (containerIssues.length) throw new Error(`Unsafe restore target: ${containerIssues.join('; ')}`)
  console.log('PASS isolated PostgreSQL 17 restore target verified')

  bootstrapLocalSupabaseDependencies()
  console.log('PASS local Supabase compatibility dependencies prepared')
  
  // Roles is not executed via psql importSqlFile directly in the same way because roles often fail on existing roles
  // We skip roles here or just run it. The original script didn't import roles, it just bootstrapped dependencies.
  
  await processAndImportEncrypted(directory, 'schema.sql.enc', encryptionKey, { skipPublicSchemaCreation: true });
  console.log('PASS public + mes_private schemas restored')
  
  await processAndImportEncrypted(directory, 'data.sql.enc', encryptionKey, { disableTriggers: true });
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
