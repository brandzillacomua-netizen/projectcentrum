const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

const SUPABASE_URL = urlMatch[1].trim();
const SUPABASE_ANON_KEY = keyMatch[1].trim();

async function inspectAndFix() {
  const headers = { 
    'apikey': SUPABASE_ANON_KEY, 
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  // 1. Delete newly created duplicate empty items (code starting with V2-FRAME-)
  let rDel = await fetch(SUPABASE_URL + '/rest/v1/nomenclatures_v2?code=like.V2-FRAME-*', {
    method: 'DELETE',
    headers
  });
  console.log('Deleted newly created V2-FRAME-* items:', rDel.status);

  // 2. Fetch all remaining items in nomenclatures_v2
  let rAll = await fetch(SUPABASE_URL + '/rest/v1/nomenclatures_v2?select=*&limit=1000', { 
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY } 
  });
  let data = await rAll.json();
  console.log('Remaining total items in nomenclatures_v2:', data.length);

  // Print all items in nomenclatures_v2 and check their group_id
  const groupCounts = {};
  data.forEach(d => {
    groupCounts[d.group_id] = (groupCounts[d.group_id] || 0) + 1;
  });
  console.log('Group counts:', groupCounts);
}

inspectAndFix().catch(console.error);
