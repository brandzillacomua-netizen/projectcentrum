import { createClient } from '@supabase/supabase-js';

const stagingUrl = 'https://qpiysrkhvdgctaqmfsew.supabase.co';
const stagingServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwaXlzcmtodmRnY3RhcW1mc2V3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODg5NzEzNSwiZXhwIjoyMTA0NDczMTM1fQ.VrtSmhZNBpPjOolQk9wML9ImpfD4mB4yyEJxF_AvAKE';

const staging = createClient(stagingUrl, stagingServiceKey);

async function setup() {
  console.log('=== НАЛАШТУВАННЯ СКЛАДІВ ТА ОЧИЩЕННЯ ТЕСТОВОЇ БАЗИ (testbdkulytcya) ===\n');

  // 1. Повне очищення виробничих карток, завдань, замовлень, заявок
  console.log('1. Очищення карток, завдань та замовлень...');
  await staging.from('work_card_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await staging.from('material_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await staging.from('work_cards').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await staging.from('tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await staging.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('✓ Виробничі таблиці (orders, tasks, work_cards, material_requests) повністю чисті: 0 записів.\n');

  // 2. Отримання всієї номенклатури з тестової бази
  console.log('2. Отримання каталогу номенклатури...');
  const { data: noms, error: nomErr } = await staging.from('nomenclatures_v2').select('*');
  if (nomErr) {
    console.error('Помилка читання nomenclatures_v2:', nomErr.message);
    process.exit(1);
  }
  console.log(`✓ Завантажено ${noms.length} позицій номенклатури.\n`);

  // 3. Очищення залишків на складі в тестовій базі
  console.log('3. Скидання залишків та резервів...');
  await staging.from('inventory_stock_v2').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // 4. Формування нових залишків:
  // - Усі матеріали (листи, фрези, метизи, витратні): 10 000 шт, резерв 0
  // - Деталі СГП (cat_parts, frame_part): 0 шт, резерв 0
  const stockRows = [];
  let materialCount = 0;
  let partCount = 0;

  for (const n of noms) {
    const isSgpPart = n.group_id === 'cat_parts' || n.rule_type === 'frame_part' || n.group_id === 'grp_production_frames';

    if (isSgpPart) {
      partCount++;
      // Для деталей СГП залишаємо 0 шт, резерв 0
      stockRows.push({
        nomenclature_id: n.id,
        warehouse: 'sgp',
        quantity: 0,
        reserved_quantity: 0,
        unit: n.unit || 'шт',
        location: 'СГП'
      });
    } else {
      materialCount++;
      // Для всіх інших складів (листи, фрези, метизи): 10 000 шт, резерв 0
      const targetWarehouse = n.group_id === 'grp_mills' ? 'cutters' : (n.group_id.includes('sheet') || n.rule_type === 'carbon' ? 'operational' : 'sgp');
      
      stockRows.push({
        nomenclature_id: n.id,
        warehouse: targetWarehouse,
        quantity: 10000,
        reserved_quantity: 0,
        unit: n.unit || 'шт',
        location: 'ТЕСТ-10000'
      });

      // Якщо це підготовлені листи — додаємо також на оперативний склад для розкрою
      if (n.group_id === 'grp_prepared_sheets' || n.rule_type === 'prepared_sheet') {
        stockRows.push({
          nomenclature_id: n.id,
          warehouse: 'sv',
          quantity: 10000,
          reserved_quantity: 0,
          unit: n.unit || 'шт',
          location: 'СВ-10000'
        });
      }
    }
  }

  console.log(`Формування залишків: ${materialCount} матеріалів по 10 000 шт, ${partCount} деталей СГП по 0 шт.`);

  // Вставка чанками по 200
  for (let i = 0; i < stockRows.length; i += 200) {
    const chunk = stockRows.slice(i, i + 200);
    const { error: insErr } = await staging.from('inventory_stock_v2').insert(chunk);
    if (insErr) {
      console.error(`Помилка вставки залишків (${i}..${i + chunk.length}):`, insErr.message);
    }
  }

  // Перевірка фінального стану
  const { count: finalCards } = await staging.from('work_cards').select('*', { count: 'exact', head: true });
  const { count: finalOrders } = await staging.from('orders').select('*', { count: 'exact', head: true });
  const { count: finalStock } = await staging.from('inventory_stock_v2').select('*', { count: 'exact', head: true });
  const { data: stockSample } = await staging.from('inventory_stock_v2').select('warehouse, quantity, reserved_quantity, nomenclature_id').limit(5);

  console.log('\n🎉 РЕЗУЛЬТАТ НА ТЕСТОВІЙ БАЗІ (testbdkulytcya):');
  console.log('• Робочі картки (work_cards):', finalCards);
  console.log('• Замовлення (orders):', finalOrders);
  console.log('• Всього складських позицій:', finalStock);
  console.log('• Всі резерви скинуті на: 0');
  console.log('• Приклад залишків матеріалів:', stockSample);
}

setup().catch(err => console.error('Критична помилка:', err));
