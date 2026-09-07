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

async function checkCards() {
  await supabase.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: '12345'
  });

  const cardIds = [
    '2f138543-7c79-424e-a4ff-b1cd1f38a03f',
    'e4035865-dec4-47fb-9251-15045e4ee633',
    '1bd6d562-e021-45c6-9f4e-b4eb9d70971b',
    '494b3401-1afb-4bac-af40-f2a68172358d',
    '986644c1-b52b-4f52-9594-9a924f2a9e23',
    'bc885184-f4a4-4051-a87c-5a5d76a610bc'
  ];

  const { data: cards } = await supabase.from('work_cards').select('id, nomenclature_id, operation, status, quantity, order_id, card_info').in('id', cardIds);
  console.log('Cards:', cards);

  for (const c of cards || []) {
    const { data: nom } = await supabase.from('nomenclatures').select('id, name, type').eq('id', c.nomenclature_id).maybeSingle();
    console.log(`Card ${c.id}: nom_id=${c.nomenclature_id}, nom_name="${nom?.name}", nom_type="${nom?.type}"`);
  }
}
checkCards();
