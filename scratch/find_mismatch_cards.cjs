const { createClient } = require('@supabase/supabase-js');

const PROD_URL = 'https://hurzutjytlcvtbvihnry.supabase.co';
const PROD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const STAGING_URL = 'https://qpiysrkhvdgctaqmfsew.supabase.co';
const STAGING_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwaXlzcmtodmRnY3RhcW1mc2V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4OTcxMzUsImV4cCI6MjEwNDQ3MzEzNX0.Jvx-saMNE97zyy8IaXk9dd7C1q-quoK-R0IopUsVXI8';

async function test(url, key, name) {
  const client = createClient(url, key);
  const { data: cards } = await client.from('work_cards').select('*');
  const { data: tasks } = await client.from('tasks').select('*');
  const { data: noms } = await client.from('nomenclatures').select('*');

  console.log(`\n=== DB: ${name} ===`);
  console.log(`Total cards: ${cards ? cards.length : 0}`);

  const shop2TaskIdsSet = new Set();
  (tasks || []).forEach(t => {
    const step = String(t.step || '').toLowerCase();
    const tName = String(t.name || '').toLowerCase();
    if (step.includes('цех №2') || step.includes('цех 2') || step.includes('пресування') || step.includes('фарбування') || step.includes('маляр') ||
        tName.includes('цех №2') || tName.includes('цех 2') || tName.includes('пресування') || tName.includes('фарбування') || tName.includes('маляр')) {
      shop2TaskIdsSet.add(String(t.id));
    }
  });

  function isShop2WorkCard(card) {
    if (!card) return false;
    if (shop2TaskIdsSet.has(String(card.task_id))) return true;
    const info = String(card.card_info || '');
    if (info.includes('[SHOP:2]') || info.includes('[ЦЕХ №2]') || info.includes('[ЦЕХ 2]')) return true;
    const op = String(card.operation || '');
    if (['Пресування', 'Фарбування', 'Малярка', 'Доопрацювання', 'Пакування'].includes(op)) return true;
    return false;
  }

  for (const c of (cards || [])) {
    const isS2 = isShop2WorkCard(c);
    const nom = noms ? noms.find(n => String(n.id) === String(c.nomenclature_id)) : null;
    console.log(`Card ID: ${c.id}`);
    console.log(`  Nom: ${nom ? nom.name : c.nomenclature_id}`);
    console.log(`  Status: ${c.status}`);
    console.log(`  Op: ${c.operation}`);
    console.log(`  isShop2WorkCard: ${isS2}`);
    console.log(`  Qty: ${c.quantity}, UsedInShop2: ${c.used_in_shop2_qty}`);
    console.log(`  Info: ${c.card_info}`);
  }
}

async function main() {
  await test(PROD_URL, PROD_KEY, 'PROD');
  await test(STAGING_URL, STAGING_KEY, 'STAGING');
}

main();
