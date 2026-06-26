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
  
  // 2. Main Nomenclature
  const { data: nomenclature } = await supabase.from('nomenclatures').select('*').eq('id', order.nomenclature_id).single();

  // 3. BOM items
  const { data: bomItems } = await supabase.from('bom_items').select('*').eq('parent_id', order.nomenclature_id);
  
  // Child Nomenclatures details
  const childIds = bomItems.map(b => b.child_id);
  const { data: childNoms } = await supabase.from('nomenclatures').select('*').in('id', childIds);
  
  // 4. Tasks for this order
  const { data: tasks } = await supabase.from('tasks').select('*').eq('order_id', orderId);
  const taskIds = tasks.map(t => t.id);

  // 5. Work cards for these tasks
  const { data: workCards } = await supabase.from('work_cards').select('*');
  const orderWorkCards = workCards.filter(wc => wc.order_id === orderId || taskIds.includes(wc.task_id));

  // Let's summarize the analysis
  const summary = {
    order: {
      id: order.id,
      order_num: order.order_num,
      customer: order.customer,
      quantity: order.quantity,
      status: order.status,
    },
    parent_nomenclature: {
      id: nomenclature.id,
      name: nomenclature.name,
      type: nomenclature.type,
    },
    bom: bomItems.map(b => {
      const child = childNoms.find(cn => cn.id === b.child_id);
      return {
        child_id: b.child_id,
        child_name: child ? child.name : 'Unknown',
        child_type: child ? child.type : 'Unknown',
        qty_per_parent: b.quantity
      };
    }),
    tasks: tasks.map(t => ({
      id: t.id,
      step: t.step,
      status: t.status,
      good_qty: t.good_qty,
      scrap_qty: t.scrap_qty,
      planned_sets: t.planned_sets,
    })),
    work_cards_summary: {
      total: orderWorkCards.length,
      by_status: orderWorkCards.reduce((acc, wc) => {
        acc[wc.status] = (acc[wc.status] || 0) + 1;
        return acc;
      }, {}),
      by_nomenclature: orderWorkCards.reduce((acc, wc) => {
        const nom = childNoms.find(cn => cn.id === wc.nomenclature_id) || { name: wc.nomenclature_id };
        acc[nom.name] = (acc[nom.name] || 0) + wc.quantity;
        return acc;
      }, {}),
      by_operation: orderWorkCards.reduce((acc, wc) => {
        acc[wc.operation] = (acc[wc.operation] || 0) + 1;
        return acc;
      }, {}),
      // List of unique nomenclatures in work cards
      nomenclatures_in_cards: [...new Set(orderWorkCards.map(wc => {
        const nom = childNoms.find(cn => cn.id === wc.nomenclature_id);
        return nom ? nom.name : wc.nomenclature_id;
      }))]
    }
  };

  fs.writeFileSync('a:/centrum/scratch/order_analysis_summary.json', JSON.stringify(summary, null, 2));
  console.log("Analysis saved to a:/centrum/scratch/order_analysis_summary.json");
  
  // Print some key details
  console.log("\n=== ORDER SUMMARY ===");
  console.log(`Order: ${order.order_num} for customer "${order.customer}"`);
  console.log(`Target Product: ${nomenclature.name} (${nomenclature.type})`);
  console.log(`Planned Quantity: ${order.quantity}`);
  
  console.log("\n=== BOM STRUCTURE ===");
  summary.bom.forEach(b => {
    console.log(`- ${b.child_name} (${b.child_type}): ${b.qty_per_parent} pcs per parent -> total needed for order: ${b.qty_per_parent * order.quantity}`);
  });

  console.log("\n=== WORK CARDS BY NOMENCLATURE (SUM OF QUANTITIES IN CARDS) ===");
  for (const [name, qty] of Object.entries(summary.work_cards_summary.by_nomenclature)) {
    console.log(`- ${name}: ${qty} pcs total across cards`);
  }

  console.log("\n=== WORK CARDS BY STATUS ===");
  console.log(summary.work_cards_summary.by_status);
}

run();
