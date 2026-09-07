const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

const SUPABASE_URL = urlMatch[1].trim();
const SUPABASE_ANON_KEY = keyMatch[1].trim();

async function cleanupAndFix() {
  const headers = { 
    'apikey': SUPABASE_ANON_KEY, 
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    'Content-Type': 'application/json'
  };

  // 1. Get all items in nomenclatures_v2
  let r = await fetch(SUPABASE_URL + '/rest/v1/nomenclatures_v2?select=*&limit=1000', { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY } });
  let data = await r.json();

  console.log(`Total items in nomenclatures_v2: ${data.length}`);

  // Find newly inserted items (with code starting with V2-FRAME-)
  const newInserted = data.filter(d => d.code && d.code.startsWith('V2-FRAME-'));
  console.log(`Found ${newInserted.length} newly created empty items (V2-FRAME-*).`);

  // Print all pre-existing items that have 'Рама' or 'Комплект' or 'KHARAK' or 'Litavr' or 'F5' or 'F610' or 'F415' or 'F421' or 'F613' or 'Mamont' or 'Drozd' in name
  const existingItems = data.filter(d => !d.code || !d.code.startsWith('V2-FRAME-'));
  
  const keywords = ['рама', 'комплект', 'litavr', 'kharak', 'f5', 'f610', 'f415', 'f421', 'f613', 'mamont', 'drozd', 'f10', 'rnd', 'проєкт', 'проект'];
  const matchedPreExisting = existingItems.filter(d => {
    const nameLower = (d.name || '').toLowerCase();
    return keywords.some(kw => nameLower.includes(kw));
  });

  console.log(`\nMatched ${matchedPreExisting.length} pre-existing items in nomenclatures_v2:`);
  matchedPreExisting.forEach((m, i) => {
    console.log(`${i+1}. [ID: ${m.id}] code: ${m.code} | group_id: '${m.group_id}' | rule_type: '${m.rule_type}' | name: '${m.name}'`);
  });
}

cleanupAndFix().catch(console.error);
