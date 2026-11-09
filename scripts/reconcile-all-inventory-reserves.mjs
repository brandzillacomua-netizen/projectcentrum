import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

const TERMINAL_TASK_STATUSES = new Set(['completed', 'cancelled', 'archived']);
const TERMINAL_ORDER_STATUSES = new Set(['completed', 'delivered', 'shipped', 'cancelled', 'archived']);

async function run() {
  console.log('🔄 [Reconcile Inventory Reserves] Початок автоматичної синхронізації...\n');

  // Try signing in with admin or audit account
  let authSuccess = false;
  try {
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: process.env.AUDIT_EMAIL || 'vvv@centrum.local',
      password: process.env.AUDIT_PASSWORD || 'vvv'
    });
    if (!authErr) {
      authSuccess = true;
      console.log('✅ Авторизовано в системі як адміністратор');
    } else {
      console.warn('⚠️ Авторизація через пароль:', authErr.message);
    }
  } catch (e) {
    console.warn('⚠️ Помилка авторизації:', e.message);
  }

  // 1. Fetch all tasks and orders to know terminal statuses
  const { data: tasks, error: tasksErr } = await supabase.from('tasks').select('id, status');
  if (tasksErr) throw tasksErr;

  const { data: orders, error: ordersErr } = await supabase.from('orders').select('id, status');
  if (ordersErr) throw ordersErr;

  const taskMap = new Map((tasks || []).map(t => [String(t.id), String(t.status || '').toLowerCase().trim()]));
  const orderMap = new Map((orders || []).map(o => [String(o.id), String(o.status || '').toLowerCase().trim()]));

  // 2. Fetch all issued material requests
  let allIssued = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('material_requests')
      .select('id, inventory_id, task_id, order_id, quantity, status')
      .eq('status', 'issued')
      .range(from, from + pageSize - 1);

    if (error) throw error;
    allIssued.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  console.log(`📋 Усього знайдено виданих заявок (issued): ${allIssued.length}`);

  // 3. Separate active vs stale requests
  const staleRequests = [];
  const activeRequestsByInv = new Map();

  for (const req of allIssued) {
    const taskStatus = req.task_id ? taskMap.get(String(req.task_id)) : null;
    const orderStatus = req.order_id ? orderMap.get(String(req.order_id)) : null;

    const isTaskTerminal = taskStatus && TERMINAL_TASK_STATUSES.has(taskStatus);
    const isOrderTerminal = orderStatus && TERMINAL_ORDER_STATUSES.has(orderStatus);

    if (isTaskTerminal || isOrderTerminal) {
      staleRequests.push(req);
    } else {
      const invId = req.inventory_id ? String(req.inventory_id) : null;
      if (invId) {
        activeRequestsByInv.set(invId, (activeRequestsByInv.get(invId) || 0) + (Number(req.quantity) || 0));
      }
    }
  }

  console.log(`⚠️ Знайдено застарілих (мертвих) заявок від закритих нарядів: ${staleRequests.length}`);

  // 4. Close stale requests in batches of 100
  if (staleRequests.length > 0) {
    const staleIds = staleRequests.map(r => r.id);
    const batchSize = 100;
    let closedCount = 0;

    for (let i = 0; i < staleIds.length; i += batchSize) {
      const chunk = staleIds.slice(i, i + batchSize);
      const { error: updErr } = await supabase
        .from('material_requests')
        .update({ status: 'completed' })
        .in('id', chunk);

      if (updErr) {
        console.error(`Помилка оновлення пачки заявок: ${updErr.message}`);
      } else {
        closedCount += chunk.length;
      }
    }
    console.log(`✅ Успішно переведено в статус 'completed': ${closedCount} заявок`);
  }

  // 5. Fetch all inventory on Operational and other relevant warehouses
  const { data: invRows, error: invErr } = await supabase
    .from('inventory')
    .select('id, name, warehouse, total_qty, reserved_qty');

  if (invErr) throw invErr;

  let fixedCount = 0;
  console.log(`\n📦 Перевірка лічильників резерву для ${invRows.length} позицій складу...`);

  for (const inv of invRows || []) {
    const currentReserved = Number(inv.reserved_qty) || 0;
    const realActiveReserved = activeRequestsByInv.get(String(inv.id)) || 0;

    if (currentReserved !== realActiveReserved) {
      const diff = currentReserved - realActiveReserved;
      console.log(`   🔧 [${inv.name}] (склад: ${inv.warehouse || 'СО'}): Було в БД: ${currentReserved} шт -> Стало: ${realActiveReserved} шт (виправлено фантомний залишок: ${diff > 0 ? '-' + diff : '+' + Math.abs(diff)} шт)`);

      const { error: invUpdErr } = await supabase
        .from('inventory')
        .update({ reserved_qty: realActiveReserved })
        .eq('id', inv.id);

      if (invUpdErr) {
        console.error(`      ❌ Помилка оновлення для ${inv.id}: ${invUpdErr.message}`);
      } else {
        fixedCount++;
      }
    }
  }

  console.log(`\n🎉 ГОТОВО! Виправлено позицій складу: ${fixedCount}. Тепер усі лічильники відповідають реальним відкритим нарядам.`);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

