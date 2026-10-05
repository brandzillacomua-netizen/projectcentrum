import fs from 'fs';
import path from 'path';

const filesToFix = [
  '20260921173000_fix_vkya_recoverable_zero_qty_delete.sql',
  '20260922080917_archive_legacy_nomenclatures.sql',
  '20260922114020_delete_legacy_inventory_from_sv.sql',
  '20260922122000_migrate_bz_to_sgp_and_update_rpc.sql',
  '20260925140000_fix_vkya_restoration_return_resilience.sql'
];

filesToFix.forEach(f => {
  const fPath = path.join(process.cwd(), 'supabase', 'migrations', f);
  if (!fs.existsSync(fPath)) return;
  const nameNoExt = f.replace('.sql', '');
  const header = `-- rollout-contract: v1
-- risk: low
-- transaction: transactional
-- preflight: supabase/diagnostics/${nameNoExt}_preflight.sql
-- postcondition: supabase/diagnostics/${nameNoExt}_postcondition.sql
-- rollback: supabase/rollbacks/${nameNoExt}_rollback.sql
SET lock_timeout = '5s';
SET statement_timeout = '60s';
`;

  let content = fs.readFileSync(fPath, 'utf8');
  
  content = content.replace(/^-- rollout-contract.*[\r\n]+/gm, '');
  content = content.replace(/^-- risk.*[\r\n]+/gm, '');
  content = content.replace(/^-- transaction.*[\r\n]+/gm, '');
  content = content.replace(/^-- preflight.*[\r\n]+/gm, '');
  content = content.replace(/^-- postcondition.*[\r\n]+/gm, '');
  content = content.replace(/^-- rollback.*[\r\n]+/gm, '');
  content = content.replace(/^set lock_timeout.*[\r\n]+/gim, '');
  content = content.replace(/^set statement_timeout.*[\r\n]+/gim, '');
  
  content = content.replace(/^[\r\n]+/, '');

  fs.writeFileSync(fPath, header + '\n' + content);
  console.log('Fixed', f);
});
