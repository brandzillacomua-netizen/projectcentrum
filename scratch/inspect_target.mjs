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

async function inspectTarget() {
  await supabase.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: '12345'
  });

  const { data: noms } = await supabase.from('nomenclatures')
    .select('id, name')
    .ilike('name', '%KR-10(210)-П-7-62%');
  const nomId = noms[0]?.id;
  console.log('Nom:', nomId, noms[0]?.name);

  // Cards for this nom in order 260902-2 or 260829-1
  const { data: cards } = await supabase.from('work_cards')
    .select('*')
    .eq('nomenclature_id', nomId)
    .in('order_id', ['002c6c1a-e206-4bd1-83d5-6060d4011c81', '684b2d55-af6d-4e38-8b1a-996014ddfb90']);

  console.log(`Cards for KR-10(210)-П-7-62 in these 2 orders (${cards?.length}):`);
  for (const c of cards || []) {
    console.log({
      id: c.id,
      order: c.order_id === '684b2d55-af6d-4e38-8b1a-996014ddfb90' ? '260902-2' : '260829-1',
      operation: c.operation,
      status: c.status,
      quantity: c.quantity,
      used_in_shop2_qty: c.used_in_shop2_qty,
      card_info: c.card_info
    });
  }

  // Also check tasks for these orders
  const { data: tasks } = await supabase.from('tasks')
    .select('*')
    .in('order_id', ['002c6c1a-e206-4bd1-83d5-6060d4011c81', '684b2d55-af6d-4e38-8b1a-996014ddfb90']);
  console.log('\nTasks for these orders:');
  for (const t of tasks || []) {
    console.log({
      id: t.id,
      order: t.order_id === '684b2d55-af6d-4e38-8b1a-996014ddfb90' ? '260902-2' : '260829-1',
      step: t.step,
      status: t.status,
      good: t.good_qty,
      snap: t.plan_snapshot?.[nomId]
    });
  }
}
inspectTarget();
