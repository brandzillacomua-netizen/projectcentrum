import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Безпечне завантаження змінних оточення з .env або process.env
// Секрети та паролі НЕ повинні бути захардкоджені у відкритому вигляді
let url = process.env.VITE_SUPABASE_URL;
let key = process.env.VITE_SUPABASE_ANON_KEY;
let email = process.env.AUDIT_EMAIL;
let password = process.env.AUDIT_PASSWORD;

try {
  if (fs.existsSync('.env')) {
    const envContent = fs.readFileSync('.env', 'utf8');
    const uMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
    const kMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
    const eMatch = envContent.match(/AUDIT_EMAIL=(.*)/);
    const pMatch = envContent.match(/AUDIT_PASSWORD=(.*)/);
    if (uMatch && !url) url = uMatch[1].trim();
    if (kMatch && !key) key = kMatch[1].trim();
    if (eMatch && !email) email = eMatch[1].trim();
    if (pMatch && !password) password = pMatch[1].trim();
  }
} catch (e) {}

if (!url || !key) {
  console.error('ПОМИЛКА: Не вказано VITE_SUPABASE_URL або VITE_SUPABASE_ANON_KEY в оточенні або .env файлі.');
  process.exit(1);
}

const supabase = createClient(url, key);

// Функція повної вибірки з БД з пагінацією по 1000 рядків (обхід PostgREST max-rows cap)
async function fetchAll(tableName, select = '*') {
  let allRows = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select(select)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Помилка запиту до ${tableName}: ${error.message}`);
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allRows;
}

async function runAudit() {
  // Автентифікація, якщо передані кредеціали (для RLS перевірки)
  let callerEmail = 'anonymous';
  if (email && password) {
    const auth = await supabase.auth.signInWithPassword({ email, password });
    if (auth.error) {
      console.warn(`Попередження автентифікації: ${auth.error.message}. Продовження в поточному режимі.`);
    } else {
      callerEmail = auth.data.user.email;
    }
  }

  // 1. orders: перевірка наявності customer_id
  const orders = await fetchAll('orders', 'id, order_num, customer, customer_id');
  const totalOrders = orders.length;
  const ordersWithCust = orders.filter(o => Boolean(o.customer_id)).length;
  const ordersWithoutCust = orders.filter(o => !o.customer_id).length;

  // 2. nomenclatures_v2: деталі розкрою та їхній default_material_id
  const { data: parts, error: pErr } = await supabase
    .from('nomenclatures_v2')
    .select('id, name, group_id, rule_type, default_material_id')
    .or('group_id.eq.cat_parts,rule_type.eq.frame_part');
  if (pErr) throw pErr;
  const totalParts = parts.length;
  const partsWithMat = parts.filter(p => Boolean(p.default_material_id)).length;
  const partsWithoutMat = parts.filter(p => !p.default_material_id).length;

  // 3. work_cards: повнорозмірна вибірка всієї таблиці
  const cards = await fetchAll('work_cards', 'id, task_id, nomenclature_id, is_box_prepared, card_info');
  const totalCards = cards.length;
  const cardsTrue = cards.filter(c => c.is_box_prepared === true).length;
  const cardsFalse = cards.filter(c => c.is_box_prepared === false).length;
  const cardsNull = cards.filter(c => c.is_box_prepared === null || c.is_box_prepared === undefined).length;
  const cardsWithLegacyString = cards.filter(c => (c.card_info || '').includes('[BOX_PREPARED:true]')).length;

  // 4. tasks: перевірка на завдання-сироти (orphan tasks без існуючого order_id)
  const tasks = await fetchAll('tasks', 'id, order_id, step, status');
  const orderIdSet = new Set(orders.map(o => String(o.id)));
  const orphanTasks = tasks.filter(t => t.order_id && !orderIdSet.has(String(t.order_id)));

  // 5. tasks: активні дублі завдань на один і той самий технологічний етап (step)
  const tasksByOrder = {};
  tasks.forEach(t => {
    if (!t.order_id) return;
    const k = String(t.order_id);
    if (!tasksByOrder[k]) tasksByOrder[k] = [];
    tasksByOrder[k].push(t);
  });

  let duplicateActiveStageTasks = [];
  for (const [orderId, tList] of Object.entries(tasksByOrder)) {
    const byStep = {};
    tList.forEach(t => {
      const stepKey = (t.step || 'Без етапу').trim();
      if (!byStep[stepKey]) byStep[stepKey] = [];
      byStep[stepKey].push(t);
    });
    for (const [step, stepTasks] of Object.entries(byStep)) {
      const activeStepTasks = stepTasks.filter(t => t.status !== 'completed' && t.status !== 'canceled');
      if (activeStepTasks.length > 1) {
        duplicateActiveStageTasks.push({
          order_id: orderId,
          step,
          active_task_ids: activeStepTasks.map(t => t.id)
        });
      }
    }
  }

  // Чистий результуючий вивід фактів (без статичних моків чи Math.random)
  console.log(JSON.stringify({
    execution_info: {
      timestamp: new Date().toISOString(),
      endpoint: new URL(url).hostname,
      caller: callerEmail
    },
    orders_table: {
      total_records: totalOrders,
      with_customer_id: ordersWithCust,
      without_customer_id: ordersWithoutCust,
      percentage: totalOrders > 0 ? ((ordersWithCust / totalOrders) * 100).toFixed(2) + '%' : '0%'
    },
    cutting_parts_nomenclatures: {
      total_parts: totalParts,
      with_default_material_id: partsWithMat,
      without_default_material_id: partsWithoutMat,
      percentage: totalParts > 0 ? ((partsWithMat / totalParts) * 100).toFixed(2) + '%' : '0%'
    },
    work_cards_table: {
      total_records: totalCards,
      is_box_prepared_true: cardsTrue,
      is_box_prepared_false: cardsFalse,
      is_box_prepared_null: cardsNull,
      legacy_box_string_remaining: cardsWithLegacyString
    },
    task_integrity: {
      total_tasks: tasks.length,
      orphan_tasks_without_order: orphanTasks.length,
      active_tasks_count: tasks.filter(t => t.status !== 'completed' && t.status !== 'canceled').length,
      duplicate_active_stage_tasks_count: duplicateActiveStageTasks.length,
      duplicate_active_stage_tasks: duplicateActiveStageTasks
    }
  }, null, 2));
}

runAudit().catch(err => {
  console.error('Audit execution failed:', err);
  process.exit(1);
});
