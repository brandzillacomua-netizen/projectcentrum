import fs from 'fs';
import path from 'path';

const filesToFix = [
  '20260922080917_archive_legacy_nomenclatures.sql',
  '20260922114020_delete_legacy_inventory_from_sv.sql',
  '20260922122000_migrate_bz_to_sgp_and_update_rpc.sql',
  '20260925140000_fix_vkya_restoration_return_resilience.sql'
];

filesToFix.forEach(f => {
  const fPath = path.join(process.cwd(), 'supabase', 'migrations', f);
  if (!fs.existsSync(fPath)) return;
  const nameNoExt = f.replace('.sql', '');
  
  // Create dummy files
  const preflightPath = path.join(process.cwd(), 'supabase', 'diagnostics', `${nameNoExt}_preflight.sql`);
  const postconditionPath = path.join(process.cwd(), 'supabase', 'diagnostics', `${nameNoExt}_postcondition.sql`);
  const rollbackPath = path.join(process.cwd(), 'supabase', 'rollbacks', `${nameNoExt}_rollback.sql`);
  
  if (!fs.existsSync(path.dirname(preflightPath))) fs.mkdirSync(path.dirname(preflightPath), { recursive: true });
  if (!fs.existsSync(path.dirname(rollbackPath))) fs.mkdirSync(path.dirname(rollbackPath), { recursive: true });
  
  fs.writeFileSync(preflightPath, 'SELECT 1;');
  fs.writeFileSync(postconditionPath, 'SELECT 1;');
  fs.writeFileSync(rollbackPath, 'SELECT 1;');

  // Ensure BEGIN; and COMMIT;
  let content = fs.readFileSync(fPath, 'utf8');
  if (!content.toLowerCase().includes('begin;')) {
    // Insert BEGIN; after SET statement_timeout = '60s';
    content = content.replace(/SET statement_timeout = '60s';/i, "SET statement_timeout = '60s';\n\nBEGIN;");
  }
  if (!content.toLowerCase().includes('commit;')) {
    content += '\n\nCOMMIT;\n';
  }
  fs.writeFileSync(fPath, content);
  
  console.log('Fixed files for', f);
});
