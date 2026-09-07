const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

const SUPABASE_URL = urlMatch[1].trim();
const SUPABASE_ANON_KEY = keyMatch[1].trim();

async function findMatchingNoms() {
  const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY };

  let r = await fetch(SUPABASE_URL + '/rest/v1/nomenclatures_v2?select=*&limit=1000', { headers });
  let data = await r.json();

  console.log(`Total items in nomenclatures_v2: ${data.length}`);

  // Find all items where group_id = 'cat_parts' or 'grp_production_frames'
  const parts = data.filter(d => d.group_id === 'cat_parts' || d.group_id === 'grp_production_frames');
  
  console.log(`Searching across ${parts.length} items in cat_parts / grp_production_frames...`);

  // Target project patterns
  const patterns = [
    { key: '80', search: '80' },
    { key: '10', search: '10' },
    { key: '14', search: '14' },
    { key: '71', search: '71' },
    { key: '72', search: '72' },
    { key: '24', search: '24' },
    { key: '27', search: '27' },
    { key: '28', search: '28' },
    { key: '47', search: '47' },
    { key: '201', search: '201' },
    { key: '218', search: '218' },
    { key: '122', search: '122' },
    { key: '202', search: '202' },
    { key: '242', search: '242' },
    { key: '87', search: '87' },
    { key: 'F10', search: 'f10' }
  ];

  patterns.forEach(p => {
    const matches = parts.filter(item => {
      const name = (item.name || '').toLowerCase();
      const code = (item.code || '').toLowerCase();
      return name.includes(p.search) || code.includes(p.search);
    });
    console.log(`\nPattern '${p.key}' matched ${matches.length} items:`);
    matches.forEach(m => {
      console.log(`  - [ID: ${m.id}] code: ${m.code} | group: '${m.group_id}' | rule: '${m.rule_type}' | name: '${m.name}'`);
    });
  });
}

findMatchingNoms().catch(console.error);
