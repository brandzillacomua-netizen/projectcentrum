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

async function inspectCards() {
  await supabase.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: '12345'
  });

  const { data: noms } = await supabase.from('nomenclatures').select('id, name').ilike('name', '%KR-10(210)-П-7-62%');
  const nomId = noms[0]?.id;

  const { data: cards } = await supabase.from('work_cards')
    .select('id, order_id, operation, status, quantity, used_in_shop2_qty, card_info, created_at')
    .eq('nomenclature_id', nomId)
    .in('order_id', ['002c6c1a-e206-4bd1-83d5-6060d4011c81', '684b2d55-af6d-4e38-8b1a-996014ddfb90']);

  console.log(`Total cards: ${cards?.length}`);
  const statusGroup = {};
  for (const c of cards || []) {
    const key = `${c.operation} | ${c.status}`;
    statusGroup[key] = (statusGroup[key] || 0) + Number(c.quantity);
  }
  console.log('Grouped by operation and status:', statusGroup);

  // Group by order
  for (const ordId of ['002c6c1a-e206-4bd1-83d5-6060d4011c81', '684b2d55-af6d-4e38-8b1a-996014ddfb90']) {
    const ordName = ordId === '684b2d55-af6d-4e38-8b1a-996014ddfb90' ? '260902-2' : '260829-1';
    const ordCards = (cards || []).filter(c => c.order_id === ordId);
    const ordGroup = {};
    for (const c of ordCards) {
      const key = `${c.operation} | ${c.status}`;
      ordGroup[key] = (ordGroup[key] || 0) + Number(c.quantity);
    }
    console.log(`Order ${ordName}:`, ordGroup);
  }
}
inspectCards();
