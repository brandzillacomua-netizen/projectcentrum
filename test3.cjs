const fs = require('fs');
const env = fs.readFileSync('a:/centrum/.env', 'utf8').split('\n').reduce((acc, line) => {
  const [k, ...vs] = line.split('=');
  const v = vs.join('=');
  if (k && v) acc[k.trim()] = v.trim().replace(/^["']|["']$/g, '');
  return acc;
}, {});

const URL = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY;
const headers = { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' };

async function run() {
  const res = await fetch(URL + '/rest/v1/nomenclatures?name=ilike.*панель*&select=name,material_type', { headers });
  const items = await res.json();
  console.log('V1 items:', JSON.stringify(items, null, 2));
}

run().catch(console.error);
