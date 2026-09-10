const { createClient } = require('@supabase/supabase-js');

const STAGING_URL = 'https://qpiysrkhvdgctaqmfsew.supabase.co';
const STAGING_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwaXlzcmtodmRnY3RhcW1mc2V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4OTcxMzUsImV4cCI6MjEwNDQ3MzEzNX0.Jvx-saMNE97zyy8IaXk9dd7C1q-quoK-R0IopUsVXI8';

async function main() {
  const client = createClient(STAGING_URL, STAGING_KEY);
  const { data: cards } = await client.from('work_cards').select('*');
  const { data: orders } = await client.from('orders').select('*');
  const { data: noms } = await client.from('nomenclatures').select('*');

  console.log(`Checking cards with status 'at-shop2-buffer' or 'at-buffer':`);
  const bufferCards = cards.filter(c => c.status === 'at-shop2-buffer' || c.status === 'at-buffer');
  console.log(`Found ${bufferCards.length} buffer cards:`);

  for (const c of bufferCards) {
    const nom = noms.find(n => n.id === c.nomenclature_id);
    const ord = orders.find(o => o.id === c.order_id);
    console.log(`\nCard ID: ${c.id}`);
    console.log(`  Nom: ${nom?.name || c.nomenclature_id}`);
    console.log(`  Order: ${ord ? ord.order_num : c.order_id} (OrderStatus: ${ord?.status})`);
    console.log(`  Op: ${c.operation}, Status: ${c.status}`);
    console.log(`  Qty: ${c.quantity}, UsedInShop2: ${c.used_in_shop2_qty || 0}`);
    console.log(`  Info: ${c.card_info}`);
  }
}

main();
