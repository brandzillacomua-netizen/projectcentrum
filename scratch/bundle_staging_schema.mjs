import fs from 'fs';
import path from 'path';

const baseDdl = fs.readFileSync('supabase/base_tables_ddl.sql', 'utf8');

const dir = 'supabase/migrations';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
console.log('Total migrations to bundle:', files.length);

let combined = '-- ═══════════════════════════════════════════════════════════════════════════\n';
combined += '-- CENTRUM MES: Consolidated Schema Initializer for Staging (testbdkulytcya)\n';
combined += '-- ═══════════════════════════════════════════════════════════════════════════\n\n';

combined += baseDdl + '\n\n';

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');
  combined += `-- ─── MIGRATION: ${file} ───\n`;
  combined += content + '\n\n';
}

fs.writeFileSync('supabase/staging_schema_init.sql', combined, 'utf8');
console.log('Successfully updated supabase/staging_schema_init.sql, size:', (combined.length / 1024).toFixed(1) + ' KB');
