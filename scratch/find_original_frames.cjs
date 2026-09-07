const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

const SUPABASE_URL = urlMatch[1].trim();
const SUPABASE_ANON_KEY = keyMatch[1].trim();

async function findOriginalFrameItems() {
  const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY };

  let r = await fetch(SUPABASE_URL + '/rest/v1/nomenclatures_v2?select=id,code,name,group_id,rule_type,created_at&limit=1000', { headers });
  let data = await r.json();

  let rBom = await fetch(SUPABASE_URL + '/rest/v1/bom_items?select=parent_id', { headers });
  let boms = await rBom.json();
  const bomCounts = {};
  boms.forEach(b => {
    bomCounts[b.parent_id] = (bomCounts[b.parent_id] || 0) + 1;
  });

  console.log(`Total bom_items in DB: ${boms.length}`);
  console.log('Distinct parent IDs in bom_items:', Object.keys(bomCounts).length);

  // Check items in nomenclatures_v2 that have bom_items > 0
  const parentsWithBom = data.filter(d => bomCounts[d.id] > 0);
  console.log(`nomenclatures_v2 items with BOM children > 0: ${parentsWithBom.length}`);
  parentsWithBom.forEach(p => {
    console.log(`[ID: ${p.id}] '${p.name}' | group_id: '${p.group_id}' | rule_type: '${p.rule_type}' | bomCount: ${bomCounts[p.id]}`);
  });

  // Check items in grp_production_frames
  const prodFrames = data.filter(d => d.group_id === 'grp_production_frames');
  console.log(`\nItems currently in grp_production_frames: ${prodFrames.length}`);
  prodFrames.forEach(p => {
    console.log(`[ID: ${p.id}] '${p.name}' | code: ${p.code} | bomCount: ${bomCounts[p.id] || 0} | created: ${p.created_at}`);
  });
}

findOriginalFrameItems().catch(console.error);
