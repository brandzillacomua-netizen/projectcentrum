import { pathToFileURL } from 'node:url'
import { redactConnectionStrings } from './check-production-db-connectivity.mjs'
import { runReadOnlyProductionSql } from './verify-production-restore-parity.mjs'

const STORAGE_AUDIT_SQL = `SELECT json_build_object(
  'bucket', (
    SELECT json_build_object(
      'id', b.id,
      'public', b.public,
      'file_size_limit', b.file_size_limit,
      'allowed_mime_types', b.allowed_mime_types,
      'object_count', (SELECT count(*) FROM storage.objects o WHERE o.bucket_id = b.id),
      'object_bytes', (SELECT coalesce(sum((o.metadata->>'size')::bigint), 0) FROM storage.objects o WHERE o.bucket_id = b.id)
    )
    FROM storage.buckets b WHERE b.id = 'chat-attachments'
  ),
  'policies', (
    SELECT coalesce(json_agg(json_build_object(
      'name', policyname,
      'roles', roles,
      'command', cmd,
      'using', qual,
      'check', with_check
    ) ORDER BY policyname), '[]'::json)
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'chat_attachments_%'
  ),
  'anon_privileges', json_build_object(
    'schema_usage', has_schema_privilege('anon', 'storage', 'USAGE'),
    'select', has_table_privilege('anon', 'storage.objects', 'SELECT'),
    'insert', has_table_privilege('anon', 'storage.objects', 'INSERT'),
    'update', has_table_privilege('anon', 'storage.objects', 'UPDATE'),
    'delete', has_table_privilege('anon', 'storage.objects', 'DELETE')
  )
);`

export function classifyStorageAudit(audit) {
  const policies = audit?.policies || []
  const unsafePolicies = policies.filter(policy => {
    const roles = policy.roles || []
    const expression = `${policy.using || ''} ${policy.check || ''}`.toLowerCase()
    const publicRole = roles.includes('public') || roles.includes('anon')
    const requiresIdentity = expression.includes('auth.uid') || expression.includes('authenticated')
    return publicRole && !requiresIdentity
  })
  const anon = audit?.anon_privileges || {}
  const anonWriteGrant = Boolean(anon.insert || anon.update || anon.delete)
  return {
    status: unsafePolicies.length ? 'EXPOSED' : 'PASS',
    unsafePolicies: unsafePolicies.map(policy => policy.name),
    anonWriteGrant
  }
}

function main() {
  const output = runReadOnlyProductionSql(STORAGE_AUDIT_SQL)
  const audit = JSON.parse(output.split(/\r?\n/).find(line => line.trim().startsWith('{')))
  const classification = classifyStorageAudit(audit)
  console.log(JSON.stringify({ production_storage_audit: { classification, audit } }, null, 2))
  if (classification.status !== 'PASS') process.exitCode = 2
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try { main() } catch (error) {
    console.error(`Storage audit failed safely: ${redactConnectionStrings(error?.message || error)}`)
    process.exit(1)
  }
}
