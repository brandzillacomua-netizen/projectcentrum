import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v) env[k.trim()] = v.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function debugBufferCalculation() {
  await supabase.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: '12345'
  });

  const { data: noms } = await supabase.from('nomenclatures').select('*');
  const { data: orders } = await supabase.from('orders').select('*');
  const { data: tasks } = await supabase.from('tasks').select('*');
  const { data: workCards } = await supabase.from('work_cards').select('*');

  // isShop2WorkCard logic
  const shop2TaskIdsSet = new Set();
  tasks.forEach(t => {
    const step = String(t.step || '').toLowerCase();
    const name = String(t.name || '').toLowerCase();
    if (step.includes('цех №2') || step.includes('цех 2') || step.includes('пресування') || step.includes('фарбування') || step.includes('маляр') ||
        name.includes('цех №2') || name.includes('цех 2') || name.includes('пресування') || name.includes('фарбування') || name.includes('маляр')) {
      shop2TaskIdsSet.add(String(t.id));
    }
  });

  function isShop2WorkCard(card) {
    if (!card) return false;
    if (shop2TaskIdsSet.has(String(card.task_id))) return true;
    const info = String(card.card_info || '');
    if (info.includes('[SHOP:2]') || info.includes('[ЦЕХ №2]') || info.includes('[ЦЕХ 2]')) return true;
    const op = String(card.operation || '').toLowerCase();
    if (['пресування', 'фарбування', 'малярка', 'доопрацювання', 'пакування', 'сгп'].some(o => op.includes(o))) return true;
    return false;
  }

  const targetNom = noms.find(n => n.name.includes('KR-10(210)-П-7-62'));
  const nomId = targetNom?.id;
  console.log('Target Nom:', nomId, targetNom?.name);

  const targetCards = workCards.filter(c => String(c.nomenclature_id) === String(nomId));
  console.log(`Total cards for nom: ${targetCards.length}`);

  let totalReceived = 0;
  let usedInShop2Qty = 0;
  let inProgressQty = 0;
  let completedQty = 0;
  let shop2ScrapQty = 0;

  for (const card of targetCards) {
    const isShop2 = isShop2WorkCard(card);
    const orderId = String(card.order_id || '');
    const ord = orders.find(o => String(o.id) === orderId);
    
    // Check if skipped
    if (orderId && ord && (ord.status === 'completed' || ord.status === 'shipped' || ord.status === 'cancelled')) {
      console.log(`SKIPPED card ${card.id} because order ${ord.order_num} is ${ord.status} (qty=${card.quantity})`);
      continue;
    }

    if (!isShop2) {
      if (card.status === 'at-shop2-buffer') {
        totalReceived += Number(card.quantity || 0);
        usedInShop2Qty += Number(card.used_in_shop2_qty || 0);
      }
    } else {
      const qty = Number(card.quantity || 0);
      if (['new', 'in-progress', 'waiting-cutters', 'waiting-materials', 'waiting-buffer', 'at-buffer'].includes(card.status)) {
        inProgressQty += qty;
      } else if (card.status === 'completed') {
        completedQty += qty;
        console.log(`Counted completed Shop 2 card: ${card.id} (qty=${qty}, op=${card.operation}, ord=${ord?.order_num})`);
      }
    }
  }

  console.log('Final Calculated:', {
    totalReceived,
    usedInShop2Qty,
    availableQty: totalReceived - usedInShop2Qty,
    inProgressQty,
    completedQty
  });
}
debugBufferCalculation();
