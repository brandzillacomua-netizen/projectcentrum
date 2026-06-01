const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

async function debug() {
  const taskId = '4bc6d29f-2d75-438b-b8c0-6e1c99878e63';
  
  // Fetch task
  const taskRes = await fetch(`https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/tasks?id=eq.${taskId}`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const task = (await taskRes.json())[0];
  console.log(`Task status: ${task.status}`);

  // Fetch order
  const orderRes = await fetch(`https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/orders?id=eq.${task.order_id}`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const order = (await orderRes.json())[0];

  // Fetch order_items with nomenclatures
  const orderItemsRes = await fetch(`https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/order_items?order_id=eq.${task.order_id}`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const orderItems = await orderItemsRes.json();

  // Fetch nomenclatures
  const nomRes = await fetch('https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/nomenclatures', {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const nomenclatures = await nomRes.json();

  // Fetch BOM items
  const bomRes = await fetch('https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/bom_items', {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const bomItems = await bomRes.json();

  // Fetch cards
  const cardsRes = await fetch(`https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/work_cards?order_id=eq.${task.order_id}`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const allCards = await cardsRes.json();
  const taskCards = allCards.filter(c => c.task_id === taskId);

  // Fetch work card history
  const historyRes = await fetch('https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/work_card_history', {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const staticHistory = await historyRes.json();
  
  // Scrap cache simulation
  const scrapCache = {};
  const activeCardIds = new Set(taskCards.map(c => c.id));
  const activeHistory = staticHistory.filter(h => h.card_id && activeCardIds.has(h.card_id));
  activeHistory.forEach(h => {
    const card = taskCards.find(c => c.id === h.card_id);
    if (card) {
      const tid = card.task_id;
      const nid = String(h.nomenclature_id);
      if (!scrapCache[tid]) scrapCache[tid] = {};
      scrapCache[tid][nid] = (scrapCache[tid][nid] || 0) + (Number(h.scrap_qty) || 0);
    }
  });

  const countAsProduced = (card) => {
    if (card.status === 'completed' && card.operation === 'Прийомка') return true;
    if (card.status === 'completed' && card.operation === 'Склад БЗ') return true;
    if (card.status === 'completed' && !card.operation) return true;
    if (card.status === 'at-shop2-buffer') return true;
    return false;
  };

  const getBOMParts = (nomenclatureId) => {
    const parts = [];
    const traverse = (nomId, qtyMultiplier = 1) => {
      const children = bomItems.filter(b => b.parent_id === nomId);
      if (children.length === 0) {
        const nom = nomenclatures.find(n => n.id === nomId);
        if (nom) {
          parts.push({ nom, quantity_per_parent: qtyMultiplier });
        }
        return;
      }
      children.forEach(child => {
        traverse(child.child_id, qtyMultiplier * (Number(child.quantity) || 1));
      });
    };
    traverse(nomenclatureId, 1);
    return parts;
  };

  console.log('\n--- Evaluating isTaskComplete ---');
  let isTaskComplete = true;

  for (const item of orderItems) {
    const parts = getBOMParts(item.nomenclature_id);
    const rows = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === item.nomenclature_id), quantity_per_parent: 1 }];
    const shop1Parts = rows.filter(r => r.nom?.type === 'part');

    console.log(`\nOrder Item Name: ${nomenclatures.find(n => n.id === item.nomenclature_id)?.name} (ID: ${item.nomenclature_id}), qty: ${item.quantity}`);
    
    for (const part of shop1Parts) {
      const snapshot = task.plan_snapshot?.[String(part.nom?.id)];
      const need = snapshot ? snapshot.need : (Number(item.quantity) * (Number(part.quantity_per_parent) || 1));
      
      const matchingCards = taskCards.filter(c => String(c.nomenclature_id) === String(part.nom?.id));
      const produced = matchingCards.reduce((sum, c) => sum + (countAsProduced(c) ? Number(c.quantity) : 0), 0);
      const scrap = scrapCache[task.id]?.[String(part.nom?.id)] || 0;
      const isPartComplete = (produced - scrap) >= need;
      
      console.log(`  Part Name: ${part.nom?.name}`);
      console.log(`    Need: ${need}`);
      console.log(`    Produced: ${produced}`);
      console.log(`    Scrap: ${scrap}`);
      console.log(`    Produced-Scrap >= Need: ${produced - scrap} >= ${need} ? ${isPartComplete}`);
      
      if (!isPartComplete) {
        isTaskComplete = false;
      }
    }
  }
  
  console.log(`\nFinal isTaskComplete: ${isTaskComplete}`);
}

debug();
