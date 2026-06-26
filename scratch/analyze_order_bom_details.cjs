const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

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
  const orderId = '53741df6-bd90-476b-9000-2c4bec9e9080';
  
  // 1. Order
  const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
  const orderQty = order.quantity; // 10000
  
  // 2. BOM
  const { data: bomItems } = await supabase.from('bom_items').select('*').eq('parent_id', order.nomenclature_id);
  const childIds = bomItems.map(b => b.child_id);
  const { data: childNoms } = await supabase.from('nomenclatures').select('*').in('id', childIds);

  // 3. Tasks
  const { data: tasks } = await supabase.from('tasks').select('*').eq('order_id', orderId);
  const taskIds = tasks.map(t => t.id);

  // 4. Work cards
  const { data: workCards } = await supabase.from('work_cards').select('*');
  const orderWorkCards = workCards.filter(wc => wc.order_id === orderId || taskIds.includes(wc.task_id));

  console.log(`=== ORDER: ${order.order_num} (${orderQty} sets of "Рама F10") ===`);

  // Let's find out how many parts of each type we need, and how many are in cards.
  const partBoms = bomItems.map(b => {
    const nom = childNoms.find(cn => cn.id === b.child_id);
    return {
      id: b.child_id,
      name: nom ? nom.name : 'Unknown',
      type: nom ? nom.type : 'Unknown',
      qty_per_parent: b.quantity_per_parent,
      total_needed: b.quantity_per_parent * orderQty
    };
  }).filter(b => b.type === 'part'); // only focus on manufactured parts, not hardware

  console.log("\n=== MANUFACTURED PARTS IN BOM ===");
  partBoms.forEach(pb => {
    console.log(`- ${pb.name}: qty per parent = ${pb.qty_per_parent}, total needed = ${pb.total_needed}`);
  });

  console.log("\n=== WORK CARDS ANALYSIS BY PART ===");
  partBoms.forEach(pb => {
    const cardsForPart = orderWorkCards.filter(wc => wc.nomenclature_id === pb.id);
    console.log(`\nPart: ${pb.name} (Need ${pb.total_needed} total)`);
    console.log(`  Total cards: ${cardsForPart.length}`);
    
    // Group cards by status and sum quantity
    const statusSummary = {};
    cardsForPart.forEach(wc => {
      if (!statusSummary[wc.status]) {
        statusSummary[wc.status] = { count: 0, total_qty: 0 };
      }
      statusSummary[wc.status].count++;
      statusSummary[wc.status].total_qty += wc.quantity;
    });

    console.log(`  Cards breakdown by status:`);
    let sumTotalQty = 0;
    for (const [status, data] of Object.entries(statusSummary)) {
      console.log(`    - Status: "${status}" -> ${data.count} cards, sum quantity = ${data.total_qty}`);
      sumTotalQty += data.total_qty;
    }
    console.log(`    - TOTAL QTY IN CARDS: ${sumTotalQty}`);
  });

  // Let's also check if there is any completed/scrap quantity in the tasks or work cards.
  // Wait, let's examine the operations.
  console.log("\n=== WORK CARDS BY OPERATION ===");
  const opSummary = {};
  orderWorkCards.forEach(wc => {
    const nom = childNoms.find(cn => cn.id === wc.nomenclature_id) || { name: wc.nomenclature_id };
    const key = `${wc.operation} [${nom.name}]`;
    if (!opSummary[key]) {
      opSummary[key] = { count: 0, qty: 0, status: {} };
    }
    opSummary[key].count++;
    opSummary[key].qty += wc.quantity;
    opSummary[key].status[wc.status] = (opSummary[key].status[wc.status] || 0) + wc.quantity;
  });

  for (const [opName, info] of Object.entries(opSummary)) {
    console.log(`- ${opName}: ${info.count} cards, total quantity = ${info.qty}`);
    console.log(`  Breakdown: ${JSON.stringify(info.status)}`);
  }
}

run();
