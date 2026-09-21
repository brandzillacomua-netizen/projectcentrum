import { createHash, createCipheriv, randomBytes } from 'node:crypto'
import { createReadStream, createWriteStream, statSync, writeFileSync, rmSync } from 'node:fs'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, isAbsolute, relative, resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { pipeline } from 'node:stream/promises'
import { validateProductionDatabaseUrl } from './configure-backup-credentials.mjs'
import { redactConnectionStrings } from './check-production-db-connectivity.mjs'

const PRODUCTION_PROJECT_REF = 'hurzutjytlcvtbvihnry'
const POSTGRES_IMAGE = 'postgres:17.6-alpine'

// CTRM (4 bytes) | Version 1 (1 byte) | GCM (4 bytes) | IV_LENGTH 12 (1 byte)
const MAGIC_HEADER = Buffer.from([0x43, 0x54, 0x52, 0x4D, 0x01, 0x47, 0x43, 0x4D, 0x20, 0x0C]);

const sha256 = filePath => {
  return new Promise((resolveHash, reject) => {
    const hash = createHash('sha256')
    const rs = createReadStream(filePath)
    rs.on('error', reject)
    rs.on('data', chunk => hash.update(chunk))
    rs.on('end', () => resolveHash(hash.digest('hex')))
  })
}

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

async function encryptFile(sourcePath, destPath, hexKey) {
  // Key must be exactly 32 bytes from hex
  const keyBuffer = Buffer.from(hexKey, 'hex');
  if (keyBuffer.length !== 32) {
    throw new Error('Encryption key must be exactly 32 bytes (64 hex characters) for AES-256');
  }
  
  const iv = randomBytes(12); // Standard GCM IV length
  const cipher = createCipheriv('aes-256-gcm', keyBuffer, iv);
  
  const input = createReadStream(sourcePath);
  const output = createWriteStream(destPath);
  
  // Write Header and IV
  output.write(MAGIC_HEADER);
  output.write(iv);
  
  await pipeline(input, cipher, output, { end: false });
  
  // Append Auth Tag at the very end
  const authTag = cipher.getAuthTag();
  output.end(authTag);
  
  // Wait for stream to fully close
  await new Promise(resolve => output.on('finish', resolve));
}

async function uploadToS3(filePath, objectKey) {
  if (!process.env.AWS_S3_BUCKET || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error(`[FATAL] S3 credentials missing. Scheduled backup MUST fail if offsite upload is impossible.`);
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

  const fileStream = createReadStream(filePath);
  const fileSize = statSync(filePath).size;
  const hash = await sha256(filePath);
  
  await s3.send(new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: objectKey,
    Body: fileStream,
    ContentLength: fileSize,
    Metadata: {
      'x-amz-meta-checksum-sha256': hash
    }
  }));

  // Verify parity via HeadObject
  const head = await s3.send(new HeadObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: objectKey
  }));
  
  if (head.ContentLength !== fileSize) {
    throw new Error(`S3 Parity mismatch for ${objectKey}: Expected ${fileSize} bytes, got ${head.ContentLength}`);
  }
  
  return { hash, size: fileSize };
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
  if (!encryptionKey || !/^[0-9a-fA-F]{64}$/.test(encryptionKey)) {
    throw new Error('BACKUP_ENCRYPTION_KEY is required and must be exactly 64 hex characters (32 bytes) for AES-256');
  }
  
  if (!process.env.AWS_S3_BUCKET) {
    throw new Error('AWS_S3_BUCKET is required for enterprise offsite backup');
  }

  const backupRoot = process.env.BACKUP_OUTPUT_DIR || resolve(tmpdir(), 'centrum-mes-backups')
  assertBackupOutsideRepository(backupRoot)
  const plan = createBackupPlan(backupRoot)
  mkdirSync(plan.directory, { recursive: true, mode: 0o700 })

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

  const files = [];

  for (const step of steps) {
    console.log(`Creating ${step.label} backup...`)
    try {
      runDockerDump({
        directory: plan.directory,
        filename: basename(step.file),
        command: step.command,
        password
      })
      if (!statSync(step.file).size) throw new Error(`${step.label} backup is empty`)
      
      // Encrypt the file
      const encFile = `${step.file}.enc`;
      console.log(`Encrypting ${step.label} with AES-256-GCM...`)
      await encryptFile(step.file, encFile, encryptionKey)
      
      // Upload to S3 and verify
      console.log(`Uploading ${step.label} to S3 Offsite Storage...`)
      const objectKey = `backups/${plan.stamp}/${basename(encFile)}`;
      const { hash, size } = await uploadToS3(encFile, objectKey)
      
      files.push({
        name: basename(encFile),
        bytes: size,
        sha256: hash,
        algorithm: 'aes-256-gcm',
        s3_key: objectKey
      })
      
      step.file = encFile;
    } finally {
      // 0600 cleanup guarantee
      rmSync(step.file.replace('.enc', ''), { force: true });
    }
  }

  const manifest = {
    status: 'BACKUP_CREATED_NOT_YET_RESTORE_VERIFIED',
    createdAt: new Date().toISOString(),
    sourceProjectRef: PRODUCTION_PROJECT_REF,
    scope: ['roles artifact', 'public schema/data', 'mes_private schema/data'],
    encryption: 'aes-256-gcm',
    format: 'MAGIC|VERSION|ALGORITHM|IV_LENGTH|IV|CIPHERTEXT|AUTH_TAG',
    files
  }
  
  const manifestFile = plan.manifest;
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  console.log(`Uploading manifest...`)
  await uploadToS3(manifestFile, `backups/${plan.stamp}/manifest.json`)

  console.log(`PASS production offsite backup completed, GCM encrypted, and uploaded to S3. Local dir: ${plan.directory}`)
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
