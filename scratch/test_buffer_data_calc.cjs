const { createClient } = require('@supabase/supabase-js');

const PROD_URL = 'https://hurzutjytlcvtbvihnry.supabase.co';
const PROD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

async function main() {
  console.log(`Checking PROD DB...`);
  const client = createClient(PROD_URL, PROD_KEY, {
    global: { headers: { 'x-mes-secret': 'REVOKED_MES_SECRET_DO_NOT_USE' } }
  });
  const { data: cards, error: cErr } = await client.from('work_cards').select('*');
  const { data: orders, error: oErr } = await client.from('orders').select('*');
  const { data: noms, error: nErr } = await client.from('nomenclatures').select('*');

  if (cErr) console.error('cErr:', cErr);
  console.log(`PROD Work Cards count: ${cards ? cards.length : 0}`);

  if (cards && cards.length > 0) {
    for (const c of cards) {
      console.log(`Card ID: ${c.id} | NomId: ${c.nomenclature_id} | Status: ${c.status} | Qty: ${c.quantity} | Used: ${c.used_in_shop2_qty}`);
    }
  }
}

main();
