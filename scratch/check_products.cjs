const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

const SUPABASE_URL = urlMatch[1].trim();
const SUPABASE_ANON_KEY = keyMatch[1].trim();

async function findEngineerProducts() {
  const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY };

  let r = await fetch(SUPABASE_URL + '/rest/v1/nomenclatures_v2?select=*&limit=1000', { headers });
  let data = await r.json();

  // Same logic as engineerHelpers.jsx
  const mapped = data.map(v => {
    const isProduct = (v.group_id === 'grp_production_frames' || v.group_id === 'grp_test_samples' || v.group_id === 'cat_fg' || v.rule_type === 'full_frame' || (v.name || '').toLowerCase().includes('рама'));
    return {
      ...v,
      isProduct,
      type: isProduct ? 'product' : (v.rule_type === 'frame_part' ? 'part' : 'consumable')
    };
  });

  const products = mapped.filter(m => m.isProduct);
  console.log('Total products identified by Engineer logic:', products.length);
  products.forEach((p, i) => {
    console.log(`${i+1}. ID: ${p.id} | group_id: ${p.group_id} | rule_type: ${p.rule_type} | name: ${p.name}`);
  });
}

findEngineerProducts().catch(console.error);
