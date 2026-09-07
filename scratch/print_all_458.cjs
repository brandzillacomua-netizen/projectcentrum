const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

const SUPABASE_URL = urlMatch[1].trim();
const SUPABASE_ANON_KEY = keyMatch[1].trim();

async function printAll458() {
  const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY };

  let r = await fetch(SUPABASE_URL + '/rest/v1/nomenclatures_v2?select=id,code,name,group_id,rule_type&limit=1000', { headers });
  let data = await r.json();

  console.log(`Total items in nomenclatures_v2: ${data.length}`);
  data.forEach((item, idx) => {
    if (idx < 50 || item.group_id === 'grp_production_frames' || item.name.includes('Рама') || item.name.includes('інд') || item.name.includes('RND')) {
      console.log(`[${idx+1}] ID: ${item.id} | code: ${item.code} | group: ${item.group_id} | rule: ${item.rule_type} | name: ${item.name}`);
    }
  });
}

printAll458().catch(console.error);
