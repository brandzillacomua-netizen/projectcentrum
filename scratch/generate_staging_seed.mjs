import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const prodUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const prodAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const prod = createClient(prodUrl, prodAnonKey);

function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return isNaN(val) ? 'NULL' : String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function main() {
  console.log('1. Authenticating with PROD...');
  const { error: authErr } = await prod.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: '9eFAZQ6yaDjA-kwRp7dKkg!A9z'
  });
  if (authErr) throw new Error('PROD Auth failed: ' + authErr.message);
  console.log('✓ Authenticated to PROD');

  console.log('2. Fetching machines...');
  const { data: machines, error: mErr } = await prod.from('machines').select('*');
  if (mErr) throw mErr;
  console.log(`✓ Fetched ${machines.length} machines`);

  console.log('3. Fetching machine operations...');
  const { data: ops, error: opErr } = await prod.from('machine_operations').select('*');
  if (opErr) throw opErr;
  console.log(`✓ Fetched ${ops.length} machine operations`);

  console.log('4. Fetching inventory...');
  const { data: inv, error: invErr } = await prod.from('inventory').select('*');
  if (invErr) throw invErr;
  console.log(`✓ Fetched ${inv.length} inventory rows`);

  // Build SQL
  let sql = `-- ═══════════════════════════════════════════════════════════════════════════
-- ⚙️ CENTRUM MES: Full Staging Schema & Data Seed (testbdkulytcya)
-- Machines: 61 | Machine Operations: 14 | Inventory: ${inv.length} positions
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. СТВОРЕННЯ / ОНОВЛЕННЯ СХЕМИ ТАБЛИЦЬ

-- Machines
CREATE TABLE IF NOT EXISTS public.machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sheet_capacity integer DEFAULT 1,
  inventory_no text,
  floor text,
  description text,
  type text,
  sequence_number text,
  status text DEFAULT 'idle',
  completed_cards_count_since_maintenance integer DEFAULT 0,
  maintenance_pending_since timestamptz,
  maintenance_started_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Machine Operations
CREATE TABLE IF NOT EXISTS public.machine_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomenclature_id uuid,
  machine_id text,
  side1_ops jsonb DEFAULT '[]'::jsonb,
  side2_ops jsonb DEFAULT '[]'::jsonb,
  side2_cut_ops jsonb DEFAULT '[]'::jsonb,
  machine_type text,
  created_at timestamptz DEFAULT now()
);

-- Machine Calls
CREATE TABLE IF NOT EXISTS public.machine_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid,
  called_role text NOT NULL,
  status text DEFAULT 'pending',
  reason text,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolved_by text
);

-- Inventory (базове створення або розширення колонками)
CREATE TABLE IF NOT EXISTS public.inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  category text,
  quantity numeric DEFAULT 0,
  reserved numeric DEFAULT 0,
  unit text DEFAULT 'шт',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Додавання обов'язкових колонок для складів СО, СВ, СГП
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS nomenclature_id uuid;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS warehouse text DEFAULT 'production';
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS total_qty numeric DEFAULT 0;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS reserved_qty numeric DEFAULT 0;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS type text DEFAULT 'raw';
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS pocket_owner text;

-- Індекси
CREATE INDEX IF NOT EXISTS idx_machines_status ON public.machines(status);
CREATE INDEX IF NOT EXISTS idx_machines_name ON public.machines(name);
CREATE INDEX IF NOT EXISTS idx_machine_operations_nom ON public.machine_operations(nomenclature_id);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON public.inventory(warehouse);
CREATE INDEX IF NOT EXISTS idx_inventory_nomenclature_id ON public.inventory(nomenclature_id);

-- RLS та Дозволи
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staging_all_access_machines" ON public.machines;
CREATE POLICY "staging_all_access_machines" ON public.machines FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staging_all_access_machine_operations" ON public.machine_operations;
CREATE POLICY "staging_all_access_machine_operations" ON public.machine_operations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staging_all_access_machine_calls" ON public.machine_calls;
CREATE POLICY "staging_all_access_machine_calls" ON public.machine_calls FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staging_all_access_inventory" ON public.inventory;
CREATE POLICY "staging_all_access_inventory" ON public.inventory FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.machines TO anon, authenticated, service_role;
GRANT ALL ON public.machine_operations TO anon, authenticated, service_role;
GRANT ALL ON public.machine_calls TO anon, authenticated, service_role;
GRANT ALL ON public.inventory TO anon, authenticated, service_role;

-- Realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE 
    public.machines, 
    public.machine_operations, 
    public.machine_calls, 
    public.inventory;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. НАПОВНЕННЯ ВЕРСТАТІВ (61 СТАНОК З ПРОДУ, ЧИСТИЙ СТАТУС IDLE)
-- ═══════════════════════════════════════════════════════════════════════════
`;

  // Machines INSERT
  const machineRows = machines.map(m => {
    return `(${escapeSql(m.id)}, ${escapeSql(m.name)}, ${escapeSql(m.sheet_capacity || 1)}, ${escapeSql(m.inventory_no)}, ${escapeSql(m.floor)}, ${escapeSql(m.description)}, ${escapeSql(m.type)}, ${escapeSql(m.sequence_number)}, 'idle', 0, NULL, NULL, ${escapeSql(m.created_at)})`;
  });

  sql += `INSERT INTO public.machines (id, name, sheet_capacity, inventory_no, floor, description, type, sequence_number, status, completed_cards_count_since_maintenance, maintenance_pending_since, maintenance_started_at, created_at)
VALUES
${machineRows.join(',\n')}
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sheet_capacity = EXCLUDED.sheet_capacity,
  inventory_no = EXCLUDED.inventory_no,
  floor = EXCLUDED.floor,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  sequence_number = EXCLUDED.sequence_number,
  status = 'idle',
  completed_cards_count_since_maintenance = 0,
  maintenance_pending_since = NULL,
  maintenance_started_at = NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. НАПОВНЕННЯ ОПЕРАЦІЙ ВЕРСТАТІВ (14 ОПЕРАЦІЙ З ПРОДУ)
-- ═══════════════════════════════════════════════════════════════════════════
`;

  if (ops.length > 0) {
    const opRows = ops.map(o => {
      return `(${escapeSql(o.id)}, ${escapeSql(o.nomenclature_id)}, ${escapeSql(o.machine_id)}, ${escapeSql(o.side1_ops || [])}, ${escapeSql(o.side2_ops || [])}, ${escapeSql(o.side2_cut_ops || [])}, ${escapeSql(o.machine_type)}, ${escapeSql(o.created_at)})`;
    });
    sql += `INSERT INTO public.machine_operations (id, nomenclature_id, machine_id, side1_ops, side2_ops, side2_cut_ops, machine_type, created_at)
VALUES
${opRows.join(',\n')}
ON CONFLICT (id) DO UPDATE SET
  nomenclature_id = EXCLUDED.nomenclature_id,
  machine_id = EXCLUDED.machine_id,
  side1_ops = EXCLUDED.side1_ops,
  side2_ops = EXCLUDED.side2_ops,
  side2_cut_ops = EXCLUDED.side2_cut_ops,
  machine_type = EXCLUDED.machine_type;
`;
  }

  sql += `
-- ═══════════════════════════════════════════════════════════════════════════
-- 4. НАПОВНЕННЯ СКЛАДІВ СО, СВ, СГП (${inv.length} ПОЗИЦІЙ)
-- Правило: СО і СВ = 10000 шт, без резервів (0). СГП і кишені = 0 шт, без резервів (0).
-- ═══════════════════════════════════════════════════════════════════════════
`;

  // Process inventory rows
  const invRows = inv.map(i => {
    const isSgpOrPocket = i.warehouse === 'sgp' || i.warehouse === 'pocket';
    const totalQty = isSgpOrPocket ? 0 : 10000;
    const reservedQty = 0;
    const qty = totalQty;
    const res = 0;

    return `(${escapeSql(i.id)}, ${escapeSql(i.name)}, ${escapeSql(i.category)}, ${qty}, ${res}, ${escapeSql(i.unit || 'шт')}, ${escapeSql(i.nomenclature_id)}, ${escapeSql(i.warehouse || 'production')}, ${totalQty}, ${reservedQty}, ${escapeSql(i.type || 'raw')}, ${escapeSql(i.pocket_owner)}, ${escapeSql(i.created_at)}, now())`;
  });

  // Batch insert into inventory in chunks of 200
  const chunkSize = 200;
  for (let i = 0; i < invRows.length; i += chunkSize) {
    const chunk = invRows.slice(i, i + chunkSize);
    sql += `
INSERT INTO public.inventory (id, name, category, quantity, reserved, unit, nomenclature_id, warehouse, total_qty, reserved_qty, type, pocket_owner, created_at, updated_at)
VALUES
${chunk.join(',\n')}
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  quantity = EXCLUDED.quantity,
  reserved = EXCLUDED.reserved,
  unit = EXCLUDED.unit,
  nomenclature_id = EXCLUDED.nomenclature_id,
  warehouse = EXCLUDED.warehouse,
  total_qty = EXCLUDED.total_qty,
  reserved_qty = EXCLUDED.reserved_qty,
  type = EXCLUDED.type,
  pocket_owner = EXCLUDED.pocket_owner,
  updated_at = now();
`;
  }

  // Write files
  const outPath1 = path.resolve('a:/centrum/supabase/staging_machines_schema.sql');
  const outPath2 = path.resolve('a:/centrum/supabase/staging_seed_full.sql');

  fs.writeFileSync(outPath1, sql, 'utf8');
  fs.writeFileSync(outPath2, sql, 'utf8');

  console.log(`\n🎉 Успішно згенеровано повний SQL файл:`);
  console.log(`- ${outPath1} (${(sql.length / 1024).toFixed(1)} KB)`);
  console.log(`- ${outPath2}`);
  console.log(`Всього верстатів: ${machines.length}`);
  console.log(`Всього операцій: ${ops.length}`);
  console.log(`Всього позицій складу: ${inv.length}`);
}

main().catch(console.error);
