const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

const SUPABASE_URL = urlMatch[1].trim();
const SUPABASE_ANON_KEY = keyMatch[1].trim();

async function inspectDuplicates() {
  const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY };

  let r = await fetch(SUPABASE_URL + '/rest/v1/nomenclatures_v2?select=id,code,name,group_id,rule_type,created_at&limit=1000', { headers });
  let data = await r.json();

  let rBom = await fetch(SUPABASE_URL + '/rest/v1/bom_items?select=parent_id', { headers });
  let boms = await rBom.json();
  const bomCounts = {};
  boms.forEach(b => {
    bomCounts[b.parent_id] = (bomCounts[b.parent_id] || 0) + 1;
  });

  // Group by name
  const nameMap = {};
  data.forEach(item => {
    const norm = item.name.trim().toLowerCase();
    nameMap[norm] = nameMap[norm] || [];
    nameMap[norm].push({
      ...item,
      bomCount: bomCounts[item.id] || 0
    });
  });

  console.log('--- ITEMS WITH MULTIPLE RECORDS OR MATCHING SPECIFICATION NAMES ---');
  Object.keys(nameMap).forEach(name => {
    if (nameMap[name].length > 1) {
      console.log(`\nDUPLICATE NAME: '${name}'`);
      nameMap[name].forEach(i => {
        console.log(`  - [ID: ${i.id}] code: ${i.code} | group: '${i.group_id}' | rule: '${i.rule_type}' | bomPositions: ${i.bomCount} | created: ${i.created_at}`);
      });
    }
  });
}

inspectDuplicates().catch(console.error);
