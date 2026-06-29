import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
});

async function main() {
  const orderId = '53741df6-bd90-476b-9000-2c4bec9e9080';
  const { data: tasks } = await supabase.from('tasks').select('*').eq('order_id', orderId);
  const taskIds = tasks.map(t => t.id);
  const taskWithSnapshot = tasks.find(t => t.plan_snapshot && Object.keys(t.plan_snapshot).some(k => /^[0-9a-f]{8}-/.test(k)));
  const plannedSets = Number(taskWithSnapshot?.planned_sets) || 1;

  const { data: cards } = await supabase.from('work_cards').select('*').in('task_id', taskIds);
  const nomIds = [...new Set(cards.map(c => c.nomenclature_id))];
  const { data: noms } = await supabase.from('nomenclatures').select('id, name, code').in('id', nomIds);
  const nomMap = {};
  (noms || []).forEach(n => { nomMap[n.id] = n; });

  const snapshotMap = {};
  if (taskWithSnapshot?.plan_snapshot) {
    Object.entries(taskWithSnapshot.plan_snapshot).forEach(([nomId, entry]) => {
      if (/^[0-9a-f]{8}-/.test(nomId)) {
        snapshotMap[nomId] = {
          need: Number(entry.need) || 0,
          stock: Number(entry.stock) || 0,
          qtyPerProduct: plannedSets > 0 ? Math.round((Number(entry.need) || 0) / plannedSets) : 0
        };
      }
    });
  }

  const grouped = {};
  cards.forEach(c => {
    if (!grouped[c.nomenclature_id]) grouped[c.nomenclature_id] = [];
    grouped[c.nomenclature_id].push(c);
  });

  console.log('=== АНАЛІЗ ПОТОКУ БЗ ПО НАРЯДУ №22062026-03 ===\n');
  console.log('Логіка потоку:');
  console.log('  БЗ склад (reserved) → Сортування → буфер Цех2 → Пакування/СГП → ГОТОВО');
  console.log('  Склад БЗ [completed] = скільки деталей прийнято з БЗ в наряд');
  console.log('  Пакування/СГП [completed] = скільки з них вже готово');
  console.log('  В РОБОТІ = БЗ прийнято - вже готово (ще в процесі Цех2 або чекають)');
  console.log('');

  let minSgpSets = Infinity;
  let minWipSets = Infinity;
  const totalDemand = 10000;

  for (const [nomId, list] of Object.entries(grouped)) {
    const nom = nomMap[nomId] || { name: nomId, code: '' };
    const snap = snapshotMap[nomId];
    const qtyPerProduct = snap?.qtyPerProduct || 1;
    const need = snap?.need || 0;

    // BZ stock = Склад БЗ completed (total reserved from BZ warehouse for this order)
    const bzStockQty = list.filter(c => c.operation === 'Склад БЗ' && c.status === 'completed')
      .reduce((s, c) => s + Number(c.quantity), 0);

    // SGP completed = Пакування/СГП completed (truly finished, on shelf)
    const sgpCompletedQty = list.filter(c => (c.operation === 'Пакування/СГП' || c.operation === 'Склад СГП') && c.status === 'completed')
      .reduce((s, c) => s + Number(c.quantity), 0);

    // Active at-shop2-buffer (remaining, not yet used by Shop 2)
    const shop2BufferQty = list.filter(c => c.status === 'at-shop2-buffer')
      .reduce((s, c) => s + Math.max(0, Number(c.quantity) - Number(c.used_in_shop2_qty || 0)), 0);

    // Other active WIP (in-progress, at-buffer, new, waiting-materials - NOT BZ, NOT SGP)
    const otherWipQty = list.filter(c => {
      if (c.status === 'completed') return false;
      if (c.operation === 'Склад БЗ') return false;
      if (c.operation === 'Пакування/СГП' || c.operation === 'Склад СГП') return false;
      if (c.status === 'at-shop2-buffer') return false; // counted above
      return true;
    }).reduce((s, c) => s + Number(c.quantity), 0);

    // "Still in BZ" = BZ reserved - (SGP completed + shop2 buffer + other wip)
    const alreadyAccountedFor = sgpCompletedQty + shop2BufferQty + otherWipQty;
    const stillInBZ = Math.max(0, bzStockQty - alreadyAccountedFor);

    // Total WIP = still in BZ + shop2 buffer + other active WIP
    const totalWipQty = stillInBZ + shop2BufferQty + otherWipQty;

    const sgpSets = qtyPerProduct > 0 ? Math.floor(sgpCompletedQty / qtyPerProduct) : 0;
    const wipSets = qtyPerProduct > 0 ? Math.floor(totalWipQty / qtyPerProduct) : 0;

    if (sgpSets < minSgpSets) minSgpSets = sgpSets;
    if (wipSets < minWipSets) minWipSets = wipSets;

    console.log(`📦 ${nom.name} (${nom.code}) / ${qtyPerProduct} шт. на виріб`);
    console.log(`   Потреба: ${need} шт.`);
    console.log(`   Прийнято з БЗ (Склад БЗ completed): ${bzStockQty} шт.`);
    console.log(`   ✅ Готово на СГП (Пакування/СГП completed): ${sgpCompletedQty} шт. = ${sgpSets} компл.`);
    console.log(`   🔄 В буфері Цех2 (залишок at-shop2-buffer): ${shop2BufferQty} шт.`);
    console.log(`   ⚙️  Інший WIP (різання, галтовка тощо): ${otherWipQty} шт.`);
    console.log(`   🏭 Ще на складі БЗ (чекають Цех2): ${stillInBZ} шт.`);
    console.log(`   📊 РАЗОМ В РОБОТІ (БЗ pipeline): ${totalWipQty} шт. = ${wipSets} компл.`);
    console.log(`   📊 РАЗОМ В СИСТЕМІ: ${sgpCompletedQty + totalWipQty} шт. / потреба ${need} шт.`);
    console.log('');
  }

  if (minSgpSets === Infinity) minSgpSets = 0;
  if (minWipSets === Infinity) minWipSets = 0;
  const remaining = Math.max(0, totalDemand - minSgpSets - minWipSets);

  console.log('====================================');
  console.log(`НА СГП ЗАРАЗ:    ${minSgpSets} компл.`);
  console.log(`В РОБОТІ:        ${minWipSets} компл.`);
  console.log(`ЗАЛИШОК ПОТРЕБИ: ${remaining} компл.`);
  console.log(`ЗАГАЛЬНА ПОТРЕБА: ${totalDemand} компл.`);
}

main().catch(console.error);
