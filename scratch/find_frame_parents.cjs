const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

const SUPABASE_URL = urlMatch[1].trim();
const SUPABASE_ANON_KEY = keyMatch[1].trim();

async function findFrameParents() {
  const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY };

  let r = await fetch(SUPABASE_URL + '/rest/v1/nomenclatures_v2?select=*&limit=1000', { headers });
  let data = await r.json();

  console.log(`Total items in nomenclatures_v2: ${data.length}`);

  // Find items whose name starts with "Рама" or "Комплект" or contains "Комплект карбонової рами"
  const frames = data.filter(d => {
    const nameLower = (d.name || '').toLowerCase();
    return nameLower.includes('рама') || nameLower.includes('комплект');
  });

  console.log(`Found ${frames.length} items containing 'Рама' or 'Комплект':`);
  frames.forEach(f => {
    console.log(`[ID: ${f.id}] code: ${f.code} | group_id: '${f.group_id}' | rule_type: '${f.rule_type}' | name: '${f.name}'`);
  });
}

findFrameParents().catch(console.error);
