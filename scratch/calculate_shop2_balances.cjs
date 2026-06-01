const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const headers = {
  'apikey': key,
  'Authorization': `Bearer ${key}`,
  'Content-Type': 'application/json'
};

const nomIds = {
  'В-3-45': '90c17a0c-2c69-485e-a2cf-ed10909c816d',
  'Н-3-50': 'dcef3b2e-de4d-4540-90a5-63ebcbab1545',
  'Х-2-63': '17908962-8294-4809-b80c-b906fbca25a4',
  'П-5-147': 'e32a6389-7dbf-4b3c-bc9d-06b2a3d0eec7'
};

async function run() {
  const orderId = '9df3ef35-491f-4e8b-af52-2a6cc410f553';
  
  // 1. Fetch all work cards for this order
  const cardsRes = await fetch(`https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/work_cards?order_id=eq.${orderId}`, { headers });
  const cards = await cardsRes.json();
  
  // 2. Fetch inventory for these nomenclatures
  const invRes = await fetch('https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/inventory', { headers });
  const inventory = await invRes.json();

  console.log('=== CALCULATION BY NOMENCLATURE ===');
  for (const [keyName, nid] of Object.entries(nomIds)) {
    console.log(`\n--- Nomenclature: ${keyName} (${nid}) ---`);
    
    // Inventory
    const invItems = inventory.filter(i => String(i.nomenclature_id) === String(nid));
    console.log('Inventory states:');
    console.table(invItems.map(i => ({ type: i.type, total_qty: i.total_qty })));
    
    // Work cards at-shop2-buffer
    const bufCards = cards.filter(c => String(c.nomenclature_id) === String(nid) && c.status === 'at-shop2-buffer');
    const totalBufQty = bufCards.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0);
    const totalBufUsed = bufCards.reduce((sum, c) => sum + (Number(c.used_in_shop2_qty) || 0), 0);
    console.log(`Buffer Cards: Count=${bufCards.length}, TotalQty=${totalBufQty}, TotalUsed=${totalBufUsed}`);
    console.table(bufCards.map(c => ({ id: c.id, quantity: c.quantity, used_in_shop2_qty: c.used_in_shop2_qty, card_info: c.card_info })));
    
    // Completed cards at Shop 2 (completed stage, task in shop 2)
    // Wait, Shop 2 task ids:
    // /1: 2e64fb03-4c2c-4ce5-b319-dc2e2314f6fa
    // /2: ece177e3-07c4-4e22-8e85-37698935d434
    // /3: 81e570a6-92f6-4f1d-a030-d005d2460005
    const s2TaskIds = ['2e64fb03-4c2c-4ce5-b319-dc2e2314f6fa', 'ece177e3-07c4-4e22-8e85-37698935d434', '81e570a6-92f6-4f1d-a030-d005d2460005'];
    const compCards = cards.filter(c => String(c.nomenclature_id) === String(nid) && c.status === 'completed' && s2TaskIds.includes(String(c.task_id)));
    const totalCompQty = compCards.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0);
    console.log(`Completed Shop 2 Cards: Count=${compCards.length}, TotalQty=${totalCompQty}`);
    console.table(compCards.map(c => ({ id: c.id, quantity: c.quantity, card_info: c.card_info })));
  }
}

run().catch(console.error);
