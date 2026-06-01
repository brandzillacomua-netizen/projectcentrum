const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const headers = { 'apikey': key, 'Authorization': `Bearer ${key}` };

async function run() {
  const orderId = '9df3ef35-491f-4e8b-af52-2a6cc410f553';
  const cardRes = await fetch(`https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/work_cards?order_id=eq.${orderId}`, { headers });
  const cards = await cardRes.json();
  
  console.log('--- All Cards for Order 29052026-07 ---');
  for (const c of cards) {
    if (c.status !== 'completed' && c.status !== 'cancelled') {
      console.log(`ACTIVE Card: ID=${c.id}, NomID=${c.nomenclature_id}, Qty=${c.quantity}, UsedQty=${c.used_in_shop2_qty || 0}, Status=${c.status}, Op=${c.operation}, TaskID=${c.task_id}`);
    }
  }
}

run().catch(console.error);
