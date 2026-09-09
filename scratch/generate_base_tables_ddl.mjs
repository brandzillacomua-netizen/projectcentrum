import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let url = 'https://hurzutjytlcvtbvihnry.supabase.co';
let anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
let email = 'alexinj@centrum.local';
let password = '';

try {
  const envContent = fs.readFileSync('.env', 'utf8');
  const pMatch = envContent.match(/AUDIT_PASSWORD=(.*)/);
  if (pMatch) password = pMatch[1].trim();
} catch (e) {}

const supabase = createClient(url, anonKey);

const baseTables = [
  'system_users',
  'customers',
  'management_tasks',
  'task_projects',
  'orders',
  'tasks',
  'work_cards',
  'work_card_history',
  'nomenclatures',
  'nomenclatures_v2',
  'bom_items',
  'material_requests',
  'purchase_requests',
  'reception_docs',
  'inventory_stock_v2',
  'scrap_ledger',
  'chat_channels',
  'chat_messages',
  'chat_direct_threads'
];

function inferType(val, colName) {
  if (colName === 'id') return 'uuid primary key default gen_random_uuid()';
  if (colName.endsWith('_id') || colName === 'order_id' || colName === 'task_id' || colName === 'customer_id') return 'uuid';
  if (typeof val === 'boolean') return 'boolean';
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return 'bigint';
    return 'numeric';
  }
  if (typeof val === 'object' && val !== null) return 'jsonb';
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) return 'timestamptz';
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) return 'uuid';
  }
  return 'text';
}

async function run() {
  if (password) {
    await supabase.auth.signInWithPassword({ email, password });
  }

  let ddl = '-- ═══════════════════════════════════════════════════════════════════════════\n';
  ddl += '-- BASE TABLES DDL GENERATED FROM PRODUCTION SCHEMA\n';
  ddl += '-- ═══════════════════════════════════════════════════════════════════════════\n\n';
  ddl += 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\nCREATE EXTENSION IF NOT EXISTS "pgcrypto";\n\n';

  for (const table of baseTables) {
    const { data, error } = await supabase.from(table).select('*').limit(5);
    if (error) {
      console.warn(`Could not select from ${table}:`, error.message);
      continue;
    }
    if (!data || data.length === 0) {
      console.warn(`No rows for ${table}, trying minimal schema...`);
      continue;
    }

    // Merge keys across sample rows to capture optional columns
    const colTypes = {};
    for (const row of data) {
      for (const [k, v] of Object.entries(row)) {
        if (!colTypes[k] || colTypes[k] === 'text') {
          colTypes[k] = inferType(v, k);
        }
      }
    }

    // Always ensure id column
    if (!colTypes['id']) {
      colTypes['id'] = 'uuid primary key default gen_random_uuid()';
    }

    ddl += `CREATE TABLE IF NOT EXISTS public.${table} (\n`;
    const colDefs = [];
    // Ensure id is first
    colDefs.push(`  id ${colTypes['id']}`);
    for (const [col, t] of Object.entries(colTypes)) {
      if (col === 'id') continue;
      colDefs.push(`  "${col}" ${t}`);
    }
    ddl += colDefs.join(',\n');
    ddl += `\n);\n\n`;
    ddl += `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;\n`;
    ddl += `DROP POLICY IF EXISTS "staging_permissive_access" ON public.${table};\n`;
    ddl += `CREATE POLICY "staging_permissive_access" ON public.${table} FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);\n\n`;
  }

  fs.writeFileSync('supabase/base_tables_ddl.sql', ddl, 'utf8');
  console.log('Successfully wrote supabase/base_tables_ddl.sql');
}

run();
