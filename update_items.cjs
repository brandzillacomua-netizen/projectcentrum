const fs = require('fs');
const env = fs.readFileSync('a:/centrum/.env', 'utf8').split('\n').reduce((acc, line) => {
  const [k, ...vs] = line.split('=');
  const v = vs.join('=');
  if (k && v) acc[k.trim()] = v.trim().replace(/^["']|["']$/g, '');
  return acc;
}, {});

const URL = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY;
const headers = { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' };

async function run() {
  const res = await fetch(URL + '/rest/v1/nomenclature_catalog_groups?name=eq.' + encodeURIComponent('Пластик') + '&select=id', { headers });
  const groups = await res.json();
  if (!groups || groups.length === 0) { console.log('Groups response:', groups); return; }
  const groupId = groups[0].id;
  console.log('Group ID:', groupId);

  const codes = [];
  for (let i = 91112; i <= 91126; i++) codes.push('V2-' + i);
  
  const updateRes = await fetch(URL + '/rest/v1/nomenclatures_v2?code=in.(' + codes.join(',') + ')', {
    method: 'PATCH',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify({ group_id: groupId })
  });
  const updated = await updateRes.json();
  console.log('Updated V2:', updated.length || updated);
}

run().catch(console.error);
