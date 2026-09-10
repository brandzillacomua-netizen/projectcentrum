const { createClient } = require('@supabase/supabase-js');

const PROD_URL = 'https://hurzutjytlcvtbvihnry.supabase.co';
const PROD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const STAGING_URL = 'https://qpiysrkhvdgctaqmfsew.supabase.co';
const STAGING_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwaXlzcmtodmRnY3RhcW1mc2V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4OTcxMzUsImV4cCI6MjEwNDQ3MzEzNX0.Jvx-saMNE97zyy8IaXk9dd7C1q-quoK-R0IopUsVXI8';

function isShop2WorkCard(card) {
  if (!card) return false
  const info = String(card.card_info || '')
  if (info.includes('[SHOP:2]') || info.includes('[ЦЕХ №2]') || info.includes('[ЦЕХ 2]')) return true
  const op = String(card.operation || '')
  if (['Пресування', 'Фарбування', 'Малярка', 'Доопрацювання', 'Пакування'].includes(op)) return true
  return false
}

async function debugDb(url, key, envName) {
  console.log(`\n=================== DB: ${envName} ===================`);
  const client = createClient(url, key);
  const { data: cards } = await client.from('work_cards').select('*');
  const { data: orders } = await client.from('orders').select('*');
  const { data: noms } = await client.from('nomenclatures').select('*');

  console.log(`Total cards: ${cards.length}`);
  
  const atShop2BufferCards = cards.filter(c => c.status === 'at-shop2-buffer');
  console.log(`Cards with status === 'at-shop2-buffer': ${atShop2BufferCards.length}`);

  for (const c of atShop2BufferCards) {
    const isS2 = isShop2WorkCard(c);
    const ord = orders.find(o => String(o.id) === String(c.order_id));
    const nom = noms.find(n => String(n.id) === String(c.nomenclature_id));
    const qty = Number(c.quantity || 0);
    const used = Number(c.used_in_shop2_qty || 0);
    const avail = Math.max(0, qty - used);

    console.log(`Card ID: ${c.id}`);
    console.log(`  Nom: ${nom?.name || c.nomenclature_id}`);
    console.log(`  Order: ${ord ? ord.order_num : c.order_id} (Status: ${ord?.status || 'NO_ORDER'})`);
    console.log(`  Op: ${c.operation}, Status: ${c.status}`);
    console.log(`  isShop2Card: ${isS2}`);
    console.log(`  Qty: ${qty}, Used: ${used}, Avail: ${avail}`);
    console.log(`  Info: ${c.card_info}`);
  }

  // Also check all non-shop2 cards
  const nonShop2Cards = cards.filter(c => !isShop2WorkCard(c));
  console.log(`\nNon-Shop2 cards total: ${nonShop2Cards.length}`);
  for (const c of nonShop2Cards) {
    if (c.status === 'at-shop2-buffer' || c.status === 'at-buffer' || c.status === 'completed') {
      const ord = orders.find(o => String(o.id) === String(c.order_id));
      console.log(`  Non-Shop2 Card ID: ${c.id} | Op: ${c.operation} | Status: ${c.status} | Order: ${ord?.order_num} (${ord?.status}) | Qty: ${c.quantity}`);
    }
  }
}

async function main() {
  await debugDb(PROD_URL, PROD_KEY, 'PROD');
  await debugDb(STAGING_URL, STAGING_KEY, 'STAGING');
}

main();
