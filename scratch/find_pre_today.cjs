const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

const SUPABASE_URL = urlMatch[1].trim();
const SUPABASE_ANON_KEY = keyMatch[1].trim();

async function findOriginalItemsBeforeToday() {
  const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY };

  let r = await fetch(SUPABASE_URL + '/rest/v1/nomenclatures_v2?created_at=lt.2026-09-07T00:00:00Z&select=*&limit=1000', { headers });
  let data = await r.json();

  console.log(`Found ${data.length} items in nomenclatures_v2 created before today:`);
  
  // Filter items whose name contains 'Рама' or 'Комплект' or 'F5' or 'Litavr' or 'KHARAK' or 'F610'
  const keywords = ['рама', 'комплект', 'litavr', 'kharak', 'f5', 'f610', 'f415', 'f421', 'f613', 'mamont', 'drozd', 'f10'];
  const matched = data.filter(d => {
    const nameLower = (d.name || '').toLowerCase();
    return keywords.some(kw => nameLower.includes(kw));
  });

  console.log(`Matched ${matched.length} frame/kit items created before today:`);
  matched.forEach(m => {
    console.log(`[ID: ${m.id}] code: ${m.code} | group_id: '${m.group_id}' | rule_type: '${m.rule_type}' | name: '${m.name}'`);
  });
}

findOriginalItemsBeforeToday().catch(console.error);
