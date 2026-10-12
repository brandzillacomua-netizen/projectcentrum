import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load .env
const envText = readFileSync('a:/centrum/.env', 'utf-8');
const env = {};
envText.split('\n').forEach(line => {
  const m = line.match(/^\s*([^#=]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
});

const url = env.VITE_SUPABASE_URL || 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = env.VITE_SUPABASE_ANON_KEY;
const secret = env.VITE_MES_SECRET || 'CentrumMES2026SecretKey_a9f8';

const supabase = createClient(url, key, {
  global: {
    headers: {
      'x-mes-secret': secret
    }
  }
});

// Log in as audit user if needed to have authenticated RLS
if (env.AUDIT_EMAIL && env.AUDIT_PASSWORD) {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: env.AUDIT_EMAIL,
    password: env.AUDIT_PASSWORD
  });
  if (authError) {
    console.warn('Auth login error (proceeding with anon):', authError.message);
  } else {
    console.log('Authenticated as:', env.AUDIT_EMAIL);
  }
}

// 1. Fetch all inventory sheet items on operational warehouse
const { data: invItems, error: invErr } = await supabase
  .from('inventory')
  .select('id, name, total_qty, reserved_qty, warehouse, nomenclature_id, updated_at')
  .or('warehouse.eq.operational,warehouse.is.null')
  .ilike('name', '%лист%')
  .order('name');

if (invErr) {
  console.error('Error fetching inventory:', invErr);
  process.exit(1);
}

// 2. Fetch all active requests
const { data: requests, error: reqErr } = await supabase
  .from('material_requests')
  .select('*')
  .in('status', ['approved', 'reserved', 'issued', 'pending']);

if (reqErr) {
  console.error('Error fetching material_requests:', reqErr);
  process.exit(1);
}

// 3. Fetch active tasks
const { data: tasks, error: taskErr } = await supabase
  .from('tasks')
  .select('id, step, status, warehouse_conf, plan_snapshot, naryad_number, created_at, nomenclature_id')
  .neq('status', 'completed')
  .neq('status', 'cancelled');

// 4. Fetch bz reservations
const { data: bzRes, error: bzErr } = await supabase
  .from('bz_inventory_reservations')
  .select('*')
  .eq('status', 'allocated');

// Calculate true reserve for each sheet (same logic as ReserveAnalysisModal)
const report = [];

for (const item of invItems) {
  const matchedRequests = (requests || []).filter(r =>
    (String(r.inventory_id) === String(item.id) || (r.nomenclature_id && String(r.nomenclature_id) === String(item.nomenclature_id)))
  );

  const reqQty = matchedRequests.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

  // Active prep tasks
  let prepQty = 0;
  (tasks || []).filter(t => t.step === 'Підготовка' && t.status === 'pending' && t.warehouse_conf === 'true').forEach(t => {
    let snapshot = t.plan_snapshot;
    if (typeof snapshot === 'string') {
      try { snapshot = JSON.parse(snapshot); } catch (e) { snapshot = {}; }
    }
    if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
      Object.values(snapshot).forEach(part => {
        if (!part || typeof part !== 'object') return;
        const nomId = String(part.id || part.nomenclature_id || '');
        const pName = (part.name || '').replace(/\[(Непідготовлений|Підготовлений)\]/gi, '').trim();
        const iName = (item.name || '').replace(/\[(Непідготовлений|Підготовлений)\]/gi, '').trim();
        if ((nomId && String(nomId) === String(item.nomenclature_id)) || pName === iName) {
          prepQty += Number(part.sheets || part.plan || part.need || 0);
        }
      });
    }
  });

  // BZ reservations
  let bzQty = 0;
  (bzRes || []).filter(res => String(res.nomenclature_id) === String(item.nomenclature_id)).forEach(res => {
    bzQty += Number(res.allocated_qty || 0);
  });

  // Task stock snapshots
  let taskStockQty = 0;
  (tasks || []).forEach(t => {
    let snapshot = t.plan_snapshot;
    if (typeof snapshot === 'string') {
      try { snapshot = JSON.parse(snapshot); } catch (e) { snapshot = {}; }
    }
    if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
      const partKey = String(item.nomenclature_id || '');
      const partData = snapshot[partKey] || Object.values(snapshot).find(p => p && (String(p.id) === partKey || p.name === item.name));
      if (partData && Number(partData.stock || 0) > 0) {
        taskStockQty += Number(partData.stock);
      }
    }
  });

  const trueReserve = reqQty + prepQty + bzQty + taskStockQty;
  const currentDbReserve = Number(item.reserved_qty) || 0;
  const currentTotal = Number(item.total_qty) || 0;

  report.push({
    id: item.id,
    name: item.name,
    nomenclature_id: item.nomenclature_id,
    currentTotal,
    currentDbReserve,
    trueReserve,
    reserveMismatch: currentDbReserve - trueReserve,
    matchedRequestsCount: matchedRequests.length,
    reqQty,
    prepQty,
    bzQty,
    taskStockQty,
    matchedRequestsSummary: matchedRequests.map(r => ({ id: r.id, task_id: r.task_id, qty: r.quantity, status: r.status, details: r.details }))
  });
}

console.log(JSON.stringify(report, null, 2));
