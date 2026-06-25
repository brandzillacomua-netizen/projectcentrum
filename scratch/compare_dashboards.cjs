const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
});

async function run() {
  // Fetch nomenclatures
  const { data: noms, error: nErr } = await supabase.from('nomenclatures').select('*');
  if (nErr) {
    console.error('Noms Error:', nErr);
    return;
  }
  const f10 = noms.find(n => n.name.includes('Рама F10'));
  console.log('F10 nomenclature:', f10);

  // Fetch all tasks for F10 order
  const { data: tasks } = await supabase.from('tasks').select('*, orders(*)');
  const f10Tasks = tasks.filter(t => t.orders && t.orders.order_num === '22062026-03');
  console.log(`\nTasks for order 22062026-03:`);
  f10Tasks.forEach(t => {
    console.log(`- Task ID: ${t.id}, Status: ${t.status}, Step: ${t.step}, Order ID: ${t.order_id}`);
  });

  // Fetch ALL work cards in the database
  const { data: workCards } = await supabase.from('work_cards').select('*');
  console.log(`\nTotal work cards: ${workCards.length}`);

  // Let's filter work cards that match nomenclature F10's child parts
  const { data: bomItems } = await supabase.from('bom_items').select('*');
  const childIds = bomItems.filter(b => b.parent_id === f10.id).map(b => b.child_id);
  const childNoms = noms.filter(n => childIds.includes(n.id));
  const childNomMap = {};
  childNoms.forEach(n => childNomMap[n.id] = n.name);

  console.log(`\nF10 child parts in BOM:`, childNoms.map(n => n.name));

  const f10Cards = workCards.filter(c => childIds.includes(c.nomenclature_id));
  console.log(`\nWork cards for F10 child parts: ${f10Cards.length}`);

  // Show grouping of these cards by task_id and status
  const cardSummary = {};
  f10Cards.forEach(c => {
    const key = `${c.task_id || 'NULL'}_${c.status}`;
    if (!cardSummary[key]) {
      cardSummary[key] = {
        task_id: c.task_id,
        status: c.status,
        count: 0,
        qtySum: 0,
        nomNames: new Set()
      };
    }
    cardSummary[key].count++;
    cardSummary[key].qtySum += Number(c.quantity) || 0;
    cardSummary[key].nomNames.add(childNomMap[c.nomenclature_id] || c.nomenclature_id);
  });

  console.log('\nWork Cards Summary by (Task ID, Status):');
  Object.values(cardSummary).forEach(s => {
    console.log(`- Task: ${s.task_id}, Status: ${s.status} -> Count: ${s.count}, Qty Sum: ${s.qtySum}`);
    console.log(`  Parts:`, Array.from(s.nomNames));
  });

  // Let's see if there are other tasks for the same parent product
  const f10AllOrderIds = tasks.filter(t => {
    const order = t.orders;
    if (!order) return false;
    let pId = order.nomenclature_id;
    if (!pId && order.order_items && order.order_items.length > 0) {
      pId = order.order_items[0].nomenclature_id;
    }
    return String(pId) === String(f10.id);
  });
  console.log(`\nAll tasks for parent product F10:`);
  f10AllOrderIds.forEach(t => {
    console.log(`- Task ID: ${t.id}, Status: ${t.status}, Step: ${t.step}, Order Num: ${t.orders?.order_num}`);
  });
}

run();
