const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjcvRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const headers = {
  'apikey': key,
  'Authorization': `Bearer ${key}`,
  'Content-Type': 'application/json'
};

const nomIds = {
  'В-3-45': '90c17a0c-2c69-485e-a2cf-ed10909c816d',
  'Н-3-50': 'dcef3b2e-de4d-4540-90a5-63ebcbab1545',
  'Х-2-63': '17908962-8294-4809-b80c-b906fbca25a4'
};

async function run() {
  const orderId = '9df3ef35-491f-4e8b-af52-2a6cc410f553';
  
  // 1. Fetch all work cards for this order
  const cardsRes = await fetch(`https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/work_cards?order_id=eq.${orderId}`, { headers });
  const cards = await cardsRes.json();

  console.log('=== DETAILED CARD ANALYSIS ===');
  for (const [keyName, nid] of Object.entries(nomIds)) {
    console.log(`\n================== ${keyName} ==================`);
    const bufCards = cards.filter(c => String(c.nomenclature_id) === String(nid) && c.status === 'at-shop2-buffer');
    const compCards = cards.filter(c => String(c.nomenclature_id) === String(nid) && c.status === 'completed');
    
    console.log('--- BUFFER CARDS (at-shop2-buffer) ---');
    bufCards.forEach(c => {
      console.log(`Card ID: ${c.id} | Qty: ${c.quantity} | Used: ${c.used_in_shop2_qty} | Info: ${c.card_info}`);
    });
    
    console.log('--- COMPLETED CARDS (completed) ---');
    compCards.forEach(c => {
      console.log(`Card ID: ${c.id} | Task: ${c.task_id} | Qty: ${c.quantity} | Info: ${c.card_info}`);
    });
  }
}

run().catch(console.error);
