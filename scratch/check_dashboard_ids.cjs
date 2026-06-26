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
  const orderId = '53741df6-bd90-476b-9000-2c4bec9e9080';
  
  const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*');
  const { data: bomItems } = await supabase.from('bom_items').select('*');
  const { data: tasks } = await supabase.from('tasks').select('*');
  const { data: workCards } = await supabase.from('work_cards').select('*');
  
  const orderTasks = tasks.filter(t => t.order_id === order.id);
  const orderTaskIds = orderTasks.map(t => t.id);

  // Find task with snapshot
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const taskWithSnapshot = orderTasks.find(t => t.plan_snapshot && Object.keys(t.plan_snapshot).some(k => uuidRegex.test(k)));
  
  console.log("Found task with snapshot:", taskWithSnapshot ? taskWithSnapshot.id : "None");

  const orderBoms = [];
  if (taskWithSnapshot) {
    const plannedSets = Number(taskWithSnapshot.planned_sets) || 1;
    Object.entries(taskWithSnapshot.plan_snapshot).forEach(([childId, entry]) => {
      if (!uuidRegex.test(childId)) return;
      const need = Number(entry.need) || 0;
      orderBoms.push({
        child_id: childId,
        quantity_per_parent: plannedSets > 0 ? Math.round(need / plannedSets) : need
      });
    });
  }

  console.log("Order BOMs count:", orderBoms.length);

  orderBoms.forEach(bomEntry => {
    const nom = nomenclatures.find(n => String(n.id) === String(bomEntry.child_id));
    if (!nom || nom.type !== 'part') return;

    const qtyPerProduct = Number(bomEntry.quantity_per_parent) || 1;
    const snapshot = taskWithSnapshot?.plan_snapshot?.[String(nom.id)];
    
    let need = 0;
    if (snapshot) {
      need = Number(snapshot.need) || 0;
    }

    const taskCards = (workCards || []).filter(c => orderTaskIds.includes(c.task_id) && String(c.nomenclature_id) === String(nom.id));
    
    const groupProduced = taskCards.reduce((sum, c) => {
      const isCompleted = c.status === 'completed' || c.status === 'at-shop2-buffer';
      return sum + (isCompleted ? (Number(c.quantity) || 0) : 0);
    }, 0);

    const stockBZ = snapshot ? (Number(snapshot.stock) || 0) : 0;
    const shortage = Math.max(0, need - (groupProduced + stockBZ));

    console.log(`\nPart: ${nom.name}`);
    console.log(`  need: ${need}`);
    console.log(`  stockBZ: ${stockBZ}`);
    console.log(`  groupProduced (cards completed + at-shop2-buffer): ${groupProduced}`);
    console.log(`  groupProduced + stockBZ = ${groupProduced + stockBZ}`);
    console.log(`  shortage (need - (groupProduced + stockBZ)): ${shortage}`);
  });
}

run();
