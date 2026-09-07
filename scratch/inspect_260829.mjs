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

async function inspect260829() {
  await supabase.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: '12345'
  });

  const { data: ord } = await supabase.from('orders').select('*').eq('order_num', '260829-1').single();
  console.log('Order 260829-1:', ord);

  const { data: cards } = await supabase.from('work_cards')
    .select('*')
    .eq('order_id', ord.id);

  console.log(`Cards for 260829-1 (${cards?.length}):`);
  for (const c of cards || []) {
    const { data: nom } = await supabase.from('nomenclatures').select('id, name').eq('id', c.nomenclature_id).maybeSingle();
    console.log(`Card ${c.id}: nom="${nom?.name}" op="${c.operation}" status="${c.status}" qty=${c.quantity} usedShop2=${c.used_in_shop2_qty} info="${c.card_info}"`);
  }
}
inspect260829();
