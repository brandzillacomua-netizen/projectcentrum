const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

const SUPABASE_URL = urlMatch[1].trim();
const SUPABASE_ANON_KEY = keyMatch[1].trim();

async function fixParentFrames() {
  const headers = { 
    'apikey': SUPABASE_ANON_KEY, 
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  // 1. Delete all empty duplicate items created today (V2-FRAME-*)
  let rDel = await fetch(SUPABASE_URL + '/rest/v1/nomenclatures_v2?code=like.V2-FRAME-*', {
    method: 'DELETE',
    headers
  });
  console.log('Deleted V2-FRAME-* duplicates status:', rDel.status);

  // 2. Fetch all items in nomenclatures_v2
  let rAll = await fetch(SUPABASE_URL + '/rest/v1/nomenclatures_v2?select=*&limit=1000', { 
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY } 
  });
  let data = await rAll.json();
  console.log(`Total items in nomenclatures_v2: ${data.length}`);

  // Find all items in nomenclatures_v2 that represent full frame assemblies / products (e.g. items with name starting with "Рама" or "Комплект")
  const parentFrames = data.filter(d => {
    const name = (d.name || '').trim();
    const nameLower = name.toLowerCase();
    // Exclude individual parts (e.g. ones containing -П-, -В-, -Н-, -Х-, Промінь, Пластина, Мотормаунт, Кришка, Перемичка)
    const isPartDetail = (
      nameLower.includes('промінь') ||
      nameLower.includes('пластина') ||
      nameLower.includes('мотормаунт') ||
      nameLower.includes('кришка') ||
      nameLower.includes('перемичка') ||
      nameLower.includes('хрестик') ||
      nameLower.includes('конектор') ||
      nameLower.includes('акб') ||
      nameLower.includes('подкладка') ||
      nameLower.includes('підкладка') ||
      nameLower.includes('верх-') ||
      nameLower.includes('низ-') ||
      nameLower.includes('складова')
    );

    if (isPartDetail) return false;

    return (
      nameLower.startsWith('рама') ||
      nameLower.startsWith('комплект') ||
      d.group_id === 'grp_production_frames' ||
      d.rule_type === 'full_frame'
    );
  });

  console.log(`\nIdentified ${parentFrames.length} finished product/frame parent items:`);
  parentFrames.forEach(p => {
    console.log(`[ID: ${p.id}] code: ${p.code} | group_id: '${p.group_id}' -> UPDATE TO 'grp_production_frames' | name: '${p.name}'`);
  });

  // 3. Update their group_id to 'grp_production_frames' and rule_type to 'full_frame'
  const idsToUpdate = parentFrames.map(p => p.id);

  if (idsToUpdate.length > 0) {
    console.log(`\nUpdating ${idsToUpdate.length} parent frame items in nomenclatures_v2...`);
    let rUpd = await fetch(SUPABASE_URL + '/rest/v1/nomenclatures_v2?id=in.(' + idsToUpdate.join(',') + ')', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        group_id: 'grp_production_frames',
        rule_type: 'full_frame',
        unit: 'шт'
      })
    });

    if (rUpd.ok) {
      let updated = await rUpd.json();
      console.log(`✅ Successfully updated ${updated.length} items to group_id='grp_production_frames'!`);
    } else {
      let errText = await rUpd.text();
      console.error('❌ Update failed:', rUpd.status, errText);
    }
  }

  // 4. Verify total items in group_id='grp_production_frames'
  let rFinal = await fetch(SUPABASE_URL + '/rest/v1/nomenclatures_v2?group_id=eq.grp_production_frames&select=id,code,name,rule_type', { 
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY } 
  });
  let finalItems = await rFinal.json();
  console.log(`\n🎉 Verified total items in group_id='grp_production_frames': ${finalItems.length}`);
  finalItems.forEach((item, idx) => {
    console.log(`${idx + 1}. [${item.code}] ${item.name}`);
  });
}

fixParentFrames().catch(console.error);
