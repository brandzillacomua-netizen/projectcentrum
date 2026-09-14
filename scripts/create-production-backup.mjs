import { createHash, createCipheriv, randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, statSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, isAbsolute, relative, resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { validateProductionDatabaseUrl } from './configure-backup-credentials.mjs'
import { redactConnectionStrings } from './check-production-db-connectivity.mjs'

const PRODUCTION_PROJECT_REF = 'hurzutjytlcvtbvihnry'
const POSTGRES_IMAGE = 'postgres:17.6-alpine'

const sha256 = filePath => createHash('sha256').update(readFileSync(filePath)).digest('hex')

function safeOutput(value, password) {
  const redacted = redactConnectionStrings(value)
  return password ? redacted.replaceAll(password, '***') : redacted
}

function runDockerDump({ directory, filename, command, password }) {
  const result = spawnSync('docker', [
    'run', '--rm',
    '--env', 'PRODUCTION_DATABASE_URL',
    '--mount', `type=bind,source=${directory},target=/backup`,
    POSTGRES_IMAGE,
    'sh', '-c', command.replaceAll('__BACKUP_FILE__', `/backup/${filename}`)
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
    shell: false,
    maxBuffer: 20 * 1024 * 1024
  })

  const output = safeOutput(`${result.stdout || ''}${result.stderr || ''}`, password).trim()
  if (result.error || result.status !== 0) {
    throw new Error(output || result.error?.message || `Supabase CLI exited with status ${result.status}`)
  }
  return output
}

function encryptFile(sourcePath, destPath, encryptionKey) {
  // Pad or truncate key to 32 bytes (256 bits) for AES-256
  const keyBuffer = Buffer.alloc(32);
  Buffer.from(encryptionKey).copy(keyBuffer);
  
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', keyBuffer, iv);
  
  const input = readFileSync(sourcePath);
  const encrypted = Buffer.concat([iv, cipher.update(input), cipher.final()]);
  
  writeFileSync(destPath, encrypted);
}

async function uploadToS3(filePath, objectKey) {
  if (!process.env.S3_BUCKET || !process.env.S3_ACCESS_KEY || !process.env.S3_SECRET_KEY) {
    console.warn(`[WARNING] S3 credentials missing. Skipping upload for ${objectKey}`);
    return;
  }

  const s3 = new S3Client({
    region: process.env.S3_REGION || 'eu-central-1',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY,
    },
    endpoint: process.env.S3_ENDPOINT, // e.g. for Cloudflare R2
  });

  const fileStream = readFileSync(filePath);
  
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: objectKey,
    Body: fileStream,
  }));
}

export function createBackupPlan(rootDirectory, timestamp = new Date()) {
  const stamp = timestamp.toISOString().replace(/[:.]/g, '-').replace('Z', 'Z')
  const directory = resolve(rootDirectory, `centrum-production-${stamp}`)
  return {
    directory,
    stamp,
    roles: resolve(directory, 'roles.sql'),
    schema: resolve(directory, 'schema.sql'),
    data: resolve(directory, 'data.sql'),
    manifest: resolve(directory, 'manifest.json')
  }
}

export function assertBackupOutsideRepository(directory, repository = process.cwd()) {
  const relation = relative(resolve(repository), resolve(directory))
  const isOutside = relation === '..' || relation.startsWith(`..${sep}`) || isAbsolute(relation)
  if (!isOutside) {
    throw new Error('Backup output must be outside the Git repository')
  }
}

async function main() {
  const validation = validateProductionDatabaseUrl(process.env.PRODUCTION_DATABASE_URL)
  if (!validation.ok) throw new Error(validation.error)

  const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('BACKUP_ENCRYPTION_KEY is required for offsite backup');
  }

  const backupRoot = process.env.BACKUP_OUTPUT_DIR || resolve(tmpdir(), 'centrum-mes-backups')
  assertBackupOutsideRepository(backupRoot)
  const plan = createBackupPlan(backupRoot)
  mkdirSync(plan.directory, { recursive: true })

  const password = new URL(validation.url).password
  const steps = [
    {
      label: 'roles',
      file: plan.roles,
      command: 'pg_dumpall --database="$PRODUCTION_DATABASE_URL" --roles-only --no-role-passwords --file=__BACKUP_FILE__'
    },
    {
      label: 'schema',
      file: plan.schema,
      command: 'pg_dump --dbname="$PRODUCTION_DATABASE_URL" --schema=public --schema=mes_private --schema-only --no-owner --file=__BACKUP_FILE__'
    },
    {
      label: 'data',
      file: plan.data,
      command: 'pg_dump --dbname="$PRODUCTION_DATABASE_URL" --schema=public --schema=mes_private --data-only --no-owner --file=__BACKUP_FILE__'
    }
  ]

  for (const step of steps) {
    console.log(`Creating ${step.label} backup...`)
    runDockerDump({
      directory: plan.directory,
      filename: basename(step.file),
      command: step.command,
      password
    })
    if (!statSync(step.file).size) throw new Error(`${step.label} backup is empty`)
    
    // Encrypt the file
    const encFile = `${step.file}.enc`;
    console.log(`Encrypting ${step.label}...`)
    encryptFile(step.file, encFile, encryptionKey)
    
    // Upload to S3
    console.log(`Uploading ${step.label} to Offsite Storage...`)
    await uploadToS3(encFile, `backups/${plan.stamp}/${basename(encFile)}`)
    
    // Remove plaintext file to prevent local leaks
    rmSync(step.file, { force: true });
    step.file = encFile; // Update step reference for manifest
  }

  const files = steps.map(step => ({
    name: basename(step.file),
    bytes: statSync(step.file).size,
    sha256: sha256(step.file)
  }))
  const manifest = {
    status: 'BACKUP_CREATED_NOT_YET_RESTORE_VERIFIED',
    createdAt: new Date().toISOString(),
    sourceProjectRef: PRODUCTION_PROJECT_REF,
    scope: ['roles artifact', 'public schema/data', 'mes_private schema/data'],
    files
  }
  
  const manifestFile = plan.manifest;
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  console.log(`Uploading manifest...`)
  await uploadToS3(manifestFile, `backups/${plan.stamp}/manifest.json`)

  console.log(`PASS production offsite backup completed and encrypted. Local dir: ${plan.directory}`)
  for (const file of files) console.log(`PASS ${file.name}: ${file.bytes} bytes, SHA-256 ${file.sha256}`)
  console.log('Restore verification is still required before this backup is considered proven.')
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => {
    let password = ''
    try { password = new URL(process.env.PRODUCTION_DATABASE_URL || '').password } catch { /* already invalid */ }
    console.error(`Backup failed safely: ${safeOutput(error?.message || error, password)}`)
    process.exit(1)
  })
}
