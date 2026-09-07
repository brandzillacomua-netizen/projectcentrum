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

async function inspectOrderCards() {
  await supabase.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: '12345'
  });

  const orderIds = ['002c6c1a-e206-4bd1-83d5-6060d4011c81', '684b2d55-af6d-4e38-8b1a-996014ddfb90'];
  
  // Find all work cards for these 2 orders
  const { data: cards } = await supabase.from('work_cards')
    .select('id, task_id, order_id, nomenclature_id, operation, machine, status, quantity, used_in_shop2_qty, card_info')
    .in('order_id', orderIds);

  console.log(`Work cards for orders count: ${cards?.length}`);
  for (const c of cards || []) {
    console.log(`Card ${c.id}: order=${c.order_id}, nom=${c.nomenclature_id}, op="${c.operation}", status="${c.status}", qty=${c.quantity}, usedShop2=${c.used_in_shop2_qty}, info="${c.card_info}"`);
  }

  // How does Foreman Dashboard / WIP calculate SGP for KR-10(210)-П-7-62?
}
inspectOrderCards();
