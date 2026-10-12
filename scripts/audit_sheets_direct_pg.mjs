import pg from 'pg';
import { readFileSync } from 'fs';

// Read connection string from .env.restore.local
let dbUrl = process.env.PRODUCTION_DATABASE_URL;
if (!dbUrl) {
  const envText = readFileSync('a:/centrum/.env.restore.local', 'utf-8');
  const m = envText.match(/PRODUCTION_DATABASE_URL=([^\r\n]+)/);
  if (m) dbUrl = m[1].trim();
}

if (!dbUrl) {
  console.error('Missing PRODUCTION_DATABASE_URL');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

await client.connect();
console.log('Connected to PostgreSQL successfully.');

try {
  // 1. Fetch operational sheet items
  const { rows: sheets } = await client.query(`
    SELECT id, name, nomenclature_id, total_qty, reserved_qty, updated_at 
    FROM inventory 
    WHERE (warehouse = 'operational' OR warehouse IS NULL) 
      AND (name ILIKE '%лист%' OR name ILIKE '%sheet%')
    ORDER BY name;
  `);

  console.log(`\nFound ${sheets.length} sheet rows in operational inventory:`);

  // 2. Fetch all active requests
  const { rows: allReqs } = await client.query(`
    SELECT id, order_id, task_id, card_id, nomenclature_id, inventory_id, quantity, status, details, category, created_at 
    FROM material_requests 
    WHERE status IN ('approved', 'reserved', 'issued', 'pending');
  `);

  // 3. Fetch active tasks
  const { rows: activeTasks } = await client.query(`
    SELECT id, step, status, warehouse_conf, plan_snapshot, naryad_number, nomenclature_id, created_at 
    FROM tasks 
    WHERE status NOT IN ('completed', 'cancelled');
  `);

  // 4. Fetch bz reservations
  const { rows: bzRes } = await client.query(`
    SELECT id, nomenclature_id, allocated_qty, status, order_id, task_id 
    FROM bz_inventory_reservations 
    WHERE status = 'allocated';
  `);

  console.log(`\n=== AUDIT RESULTS (CURRENT DB VS CALCULATED TRUE RESERVE) ===`);

  const results = [];

  for (const s of sheets) {
    // Matched requests for this inventory item or nomenclature
    const matchedReqs = allReqs.filter(r =>
      (String(r.inventory_id) === String(s.id) || (s.nomenclature_id && String(r.nomenclature_id) === String(s.nomenclature_id)))
    );
    const reqQty = matchedReqs.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

    // Active prep tasks
    let prepQty = 0;
    activeTasks.filter(t => t.step === 'Підготовка' && t.status === 'pending' && t.warehouse_conf === 'true').forEach(t => {
      let snapshot = t.plan_snapshot;
      if (typeof snapshot === 'string') {
        try { snapshot = JSON.parse(snapshot); } catch (e) { snapshot = {}; }
      }
      if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
        Object.values(snapshot).forEach(part => {
          if (!part || typeof part !== 'object') return;
          const nomId = String(part.id || part.nomenclature_id || '');
          const pName = (part.name || '').replace(/\[(Непідготовлений|Підготовлений)\]/gi, '').trim();
          const iName = (s.name || '').replace(/\[(Непідготовлений|Підготовлений)\]/gi, '').trim();
          if ((nomId && String(nomId) === String(s.nomenclature_id)) || pName === iName) {
            prepQty += Number(part.sheets || part.plan || part.need || 0);
          }
        });
      }
    });

    // BZ
    let bzQty = 0;
    bzRes.filter(res => String(res.nomenclature_id) === String(s.nomenclature_id)).forEach(res => {
      bzQty += Number(res.allocated_qty || 0);
    });

    // Active tasks snapshot stock
    let taskStockQty = 0;
    activeTasks.forEach(t => {
      let snapshot = t.plan_snapshot;
      if (typeof snapshot === 'string') {
        try { snapshot = JSON.parse(snapshot); } catch (e) { snapshot = {}; }
      }
      if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
        const partKey = String(s.nomenclature_id || '');
        const partData = snapshot[partKey] || Object.values(snapshot).find(p => p && (String(p.id) === partKey || p.name === s.name));
        if (partData && Number(partData.stock || 0) > 0) {
          taskStockQty += Number(partData.stock);
        }
      }
    });

    const trueReserve = reqQty + prepQty + bzQty + taskStockQty;
    const dbReserved = Number(s.reserved_qty) || 0;
    const totalQty = Number(s.total_qty) || 0;
    const diff = dbReserved - trueReserve;

    results.push({
      name: s.name,
      id: s.id,
      total_qty: totalQty,
      db_reserved: dbReserved,
      true_reserve: trueReserve,
      diff: diff,
      reqQty,
      prepQty,
      bzQty,
      taskStockQty,
      activeRequests: matchedReqs.map(r => ({ id: r.id, qty: r.quantity, status: r.status, details: r.details }))
    });
  }

  // Print summary table
  console.table(results.map(r => ({
    "Позиція": r.name,
    "В базі (total)": r.total_qty,
    "В базі (reserve)": r.db_reserved,
    "Реальний резерв": r.true_reserve,
    "Завислий резерв (diff)": r.diff
  })));

  // Show positions with mismatch
  const mismatched = results.filter(r => r.diff !== 0);
  console.log(`\nЗнайдено ${mismatched.length} позицій із розбіжністю резерву:`);
  for (const m of mismatched) {
    console.log(`\n• ${m.name}:`);
    console.log(`  Наявність: ${m.total_qty}, Зафіксовано в БД: ${m.db_reserved}, Дійсно в активних нарядах/запитах: ${m.true_reserve} (Зависло: ${m.diff})`);
    if (m.activeRequests.length > 0) {
      console.log(`  Активні запити:`, m.activeRequests);
    }
  }

} finally {
  await client.end();
}
