const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

const SUPABASE_URL = urlMatch[1].trim();
const SUPABASE_ANON_KEY = keyMatch[1].trim();

async function dumpAll() {
  const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY };

  let r = await fetch(SUPABASE_URL + '/rest/v1/nomenclatures_v2?select=id,code,name,group_id,rule_type&limit=1000', { headers });
  let data = await r.json();

  let out = `Total items in nomenclatures_v2: ${data.length}\n\n`;
  data.forEach((item, idx) => {
    out += `[${idx+1}] ID: ${item.id} | code: ${item.code} | group_id: '${item.group_id}' | rule_type: '${item.rule_type}' | name: '${item.name}'\n`;
  });

  fs.writeFileSync('scratch/all_noms_v2.txt', out, 'utf8');
  console.log('Saved all 458 items to scratch/all_noms_v2.txt');
}

dumpAll().catch(console.error);
