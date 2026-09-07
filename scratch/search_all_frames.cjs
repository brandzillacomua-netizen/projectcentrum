const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

const SUPABASE_URL = urlMatch[1].trim();
const SUPABASE_ANON_KEY = keyMatch[1].trim();

async function searchAllFrameCandidates() {
  const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY };

  let r = await fetch(SUPABASE_URL + '/rest/v1/nomenclatures_v2?select=*&limit=1000', { headers });
  let data = await r.json();

  console.log(`Total items in nomenclatures_v2: ${data.length}`);

  const keywords = ['проєкт', 'project', '80', '10', '14', '71', '72', '24', '27', '28', '47', '201', '218', '122', '202', '242', '87', 'f10', '217', '220', '224', '227', '228'];

  const foundItems = data.filter(d => {
    const nameLower = (d.name || '').toLowerCase();
    return keywords.some(kw => nameLower.includes(kw));
  });

  console.log(`Found ${foundItems.length} candidate items in nomenclatures_v2:`);
  foundItems.forEach(i => {
    console.log(`[ID: ${i.id}] code: ${i.code} | group_id: '${i.group_id}' | rule_type: '${i.rule_type}' | name: '${i.name}'`);
  });
}

searchAllFrameCandidates().catch(console.error);
