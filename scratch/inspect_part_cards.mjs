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

async function inspectPart() {
  await supabase.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: '12345'
  });

  // 1. Find nomenclature for KR-10(210)-П-7-62
  const { data: noms } = await supabase.from('nomenclatures')
    .select('id, name, type')
    .ilike('name', '%KR-10(210)-П-7-62%');
  console.log('Nomenclatures matching:', noms);
  const nomId = noms?.[0]?.id;

  // 2. Find all work cards for this nomenclature
  const { data: cards } = await supabase.from('work_cards')
    .select('id, task_id, order_id, operation, machine, status, quantity, used_in_shop2_qty, card_info, created_at, completed_at')
    .eq('nomenclature_id', nomId);
  console.log(`Total work cards for ${nomId}: ${cards?.length}`);
  for (const c of cards || []) {
    console.log(`Card ${c.id}: op="${c.operation}", status="${c.status}", qty=${c.quantity}, usedShop2=${c.used_in_shop2_qty}, order=${c.order_id}, task=${c.task_id}, info="${c.card_info}"`);
  }

  // 3. Find tasks for orders 260902-2 and 260829-1
  const { data: orders } = await supabase.from('orders')
    .select('id, order_num, status')
    .in('order_num', ['260902-2', '260829-1']);
  console.log('Orders:', orders);

  if (orders?.length) {
    const orderIds = orders.map(o => o.id);
    const { data: tasks } = await supabase.from('tasks')
      .select('id, order_id, step, status, name, good_qty, plan_snapshot')
      .in('order_id', orderIds);
    console.log('Tasks for orders:', tasks?.map(t => ({
      id: t.id,
      order: t.order_id,
      step: t.step,
      status: t.status,
      good: t.good_qty,
      snapPart: t.plan_snapshot?.[nomId]
    })));
  }

  // 4. Also check SGP / Finished goods inventory or handover or wherever 11735 is
  // Where does the Foreman Dashboard / WIP Table get SGP 11735?
}
inspectPart();
