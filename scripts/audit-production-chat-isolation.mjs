import { pathToFileURL } from 'node:url'
import { redactConnectionStrings } from './check-production-db-connectivity.mjs'
import { runReadOnlyProductionSql } from './verify-production-restore-parity.mjs'

const CHAT_TABLES = [
  'chat_threads',
  'chat_participants',
  'chat_messages',
  'chat_message_reactions',
  'chat_polls',
  'chat_poll_options',
  'chat_poll_votes'
]

const CHAT_ISOLATION_SQL = `SELECT json_build_object(
  'counts', json_build_object(
    'threads', (SELECT count(*) FROM public.chat_threads),
    'participants', (SELECT count(*) FROM public.chat_participants),
    'messages', (SELECT count(*) FROM public.chat_messages),
    'direct_threads', (SELECT count(*) FROM public.chat_threads WHERE thread_type = 'direct'),
    'group_threads', (SELECT count(*) FROM public.chat_threads WHERE thread_type = 'group')
  ),
  'integrity', json_build_object(
    'threads_without_participants', (
      SELECT count(*) FROM public.chat_threads t
      WHERE NOT EXISTS (SELECT 1 FROM public.chat_participants p WHERE p.thread_id = t.id)
    ),
    'participants_without_mes_user', (
      SELECT count(*) FROM public.chat_participants p
      LEFT JOIN public.system_users u ON u.id = p.user_id
      WHERE u.id IS NULL
    ),
    'participants_without_auth_binding', (
      SELECT count(*) FROM public.chat_participants p
      JOIN public.system_users u ON u.id = p.user_id
      WHERE u.auth_user_id IS NULL
    ),
    'storage_objects_without_thread', (
      SELECT count(*) FROM storage.objects o
      WHERE o.bucket_id = 'chat-attachments'
        AND NOT EXISTS (
          SELECT 1 FROM public.chat_threads t
          WHERE t.id::text = split_part(o.name, '/', 1)
        )
    ),
    'attachment_messages_without_object', (
      SELECT count(*) FROM public.chat_messages m
      WHERE m.attachment_path IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM storage.objects o
          WHERE o.bucket_id = 'chat-attachments' AND o.name = m.attachment_path
        )
    )
  ),
  'policies', (
    SELECT coalesce(json_agg(json_build_object(
      'table', tablename,
      'name', policyname,
      'roles', roles,
      'command', cmd,
      'using', qual,
      'check', with_check
    ) ORDER BY tablename, policyname), '[]'::json)
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY(ARRAY[${CHAT_TABLES.map(name => `'${name}'`).join(', ')}])
  )
);`

export function classifyChatIsolationAudit(audit) {
  const policies = audit?.policies || []
  const unscopedPolicies = policies.filter(policy => {
    const expression = `${policy.using || ''} ${policy.check || ''}`.replaceAll(/[()\s]/g, '').toLowerCase()
    return expression === 'true' || expression === 'truetrue'
  })
  const integrity = audit?.integrity || {}
  const blockingIntegrityKeys = new Set([
    'threads_without_participants',
    'participants_without_mes_user',
    'participants_without_auth_binding',
    'storage_objects_without_thread'
  ])
  const blockers = Object.entries(integrity)
    .filter(([name]) => blockingIntegrityKeys.has(name))
    .filter(([, count]) => Number(count) > 0)
    .map(([name, count]) => ({ name, count }))
  const warnings = Object.entries(integrity)
    .filter(([name]) => !blockingIntegrityKeys.has(name))
    .filter(([, count]) => Number(count) > 0)
    .map(([name, count]) => ({ name, count }))
  return {
    status: unscopedPolicies.length ? 'EXPOSED' : 'PASS',
    unscopedPolicies: unscopedPolicies.map(policy => `${policy.table}.${policy.name}`),
    isolationMigrationReady: blockers.length === 0,
    blockers,
    warnings
  }
}

function main() {
  const output = runReadOnlyProductionSql(CHAT_ISOLATION_SQL)
  const audit = JSON.parse(output.split(/\r?\n/).find(line => line.trim().startsWith('{')))
  const classification = classifyChatIsolationAudit(audit)
  console.log(JSON.stringify({ production_chat_isolation_audit: { classification, audit } }, null, 2))
  if (classification.status !== 'PASS') process.exitCode = 2
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try { main() } catch (error) {
    console.error(`Chat isolation audit failed safely: ${redactConnectionStrings(error?.message || error)}`)
    process.exit(1)
  }
}
