const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

const SUPABASE_URL = urlMatch[1].trim();
const SUPABASE_ANON_KEY = keyMatch[1].trim();

// EXACT names as written in the existing specifications in the user's browser (with "проект")
const exactSpecificationNames = [
  'Комплект карбонової рами',
  'Комплект карбонової рами (RND230) Рама JET 13"',
  'Рама (інд. проект 80) KHARAK 265 V2 Д-тех',
  'Рама (інд. проект 10), 11", Київ К',
  'Рама (інд. проект 14), Litavr 7, Київ К',
  'Рама (інд. проект 71), KR 385 V2, Скайтактік',
  'Рама (інд. проект 72), F5, Київ К',
  'Рама (інд. проект 24), F610, Київ К',
  'Рама (інд. проект 27), F415, Київ К',
  'Рама (інд. проект 28), F421, Київ К',
  'Рама (інд. проект 47), F613, Київ К',
  'Рама (RND 201), KHARAK 385 V2.0, Д-Тех',
  'Рама (RND 218), Mamont 15", Технетофарт Південь',
  'Рама (RND122) Kharak 325 Extended, Д-Тех',
  'Рама (RND202), KHARAK AIR 10", SKT',
  'Рама (RND242), KHARAK AIR 10", SKT V2',
  'Рама (RND87), Drozd 9" посилена',
  'Рама F10',
  'Рама (RND 217), Kharak 11(240)',
  'Рама (RND 220), Рама 10" V3',
  'Рама (RND 224), JET V2.5.1',
  'Рама (RND 227), Ракета 9"',
  'Рама (RND 228), KHARAK AIR 8"'
];

async function syncExactFrameNames() {
  const headers = { 
    'apikey': SUPABASE_ANON_KEY, 
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  // 1. Delete any items with code starting with V2-FRAME-
  let rDel = await fetch(SUPABASE_URL + '/rest/v1/nomenclatures_v2?code=like.V2-FRAME-*', {
    method: 'DELETE',
    headers
  });
  console.log('Deleted V2-FRAME-* empty duplicates status:', rDel.status);

  // 2. Fetch existing items in nomenclatures_v2
  let rAll = await fetch(SUPABASE_URL + '/rest/v1/nomenclatures_v2?select=id,code,name,group_id,rule_type&limit=1000', { 
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY } 
  });
  let data = await rAll.json();
  const existingNameMap = new Map();
  data.forEach(d => {
    existingNameMap.set(d.name.trim().toLowerCase(), d);
  });

  console.log(`Currently ${data.length} total items in nomenclatures_v2.`);

  let index = 1;
  const toInsert = [];
  const toUpdate = [];

  exactSpecificationNames.forEach(name => {
    const normName = name.trim().toLowerCase();
    const existing = existingNameMap.get(normName);

    if (existing) {
      if (existing.group_id !== 'grp_production_frames' || existing.rule_type !== 'full_frame') {
        toUpdate.push({
          id: existing.id,
          name: existing.name,
          group_id: 'grp_production_frames',
          rule_type: 'full_frame'
        });
      } else {
        console.log(`Item already correctly configured: [${existing.id}] '${existing.name}'`);
      }
    } else {
      const codeStr = `V2-PROD-${String(index).padStart(3, '0')}`;
      index++;
      toInsert.push({
        code: codeStr,
        name: name,
        group_id: 'grp_production_frames',
        unit: 'шт',
        rule_type: 'full_frame',
        rule_params: {
          name: name,
          projType: 'SERIAL',
          unit: 'шт'
        },
        status: 'active'
      });
    }
  });

  // Perform updates
  if (toUpdate.length > 0) {
    console.log(`Updating ${toUpdate.length} existing items in nomenclatures_v2...`);
    for (let u of toUpdate) {
      let rUpd = await fetch(SUPABASE_URL + '/rest/v1/nomenclatures_v2?id=eq.' + u.id, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          group_id: 'grp_production_frames',
          rule_type: 'full_frame',
          unit: 'шт'
        })
      });
      if (rUpd.ok) {
        console.log(`  ✅ Updated existing item: [${u.id}] '${u.name}'`);
      } else {
        console.error(`  ❌ Update failed for [${u.id}]:`, rUpd.status, await rUpd.text());
      }
    }
  }

  // Perform inserts
  if (toInsert.length > 0) {
    console.log(`\nInserting ${toInsert.length} exact specification products into nomenclatures_v2...`);
    let rIns = await fetch(SUPABASE_URL + '/rest/v1/nomenclatures_v2', {
      method: 'POST',
      headers,
      body: JSON.stringify(toInsert)
    });

    if (rIns.ok) {
      let inserted = await rIns.json();
      console.log(`✅ Successfully inserted ${inserted.length} exact products into nomenclatures_v2!`);
      inserted.forEach(i => console.log(`  - [${i.id}] ${i.code} | ${i.name}`));
    } else {
      let errText = await rIns.text();
      console.error('❌ Insert failed:', rIns.status, errText);
    }
  }

  // Final check
  let rFinal = await fetch(SUPABASE_URL + '/rest/v1/nomenclatures_v2?group_id=eq.grp_production_frames&select=id,code,name,rule_type', { 
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY } 
  });
  let finalProd = await rFinal.json();
  console.log(`\n🎉 Final count in group_id='grp_production_frames': ${finalProd.length}`);
  finalProd.forEach((p, idx) => console.log(`${idx + 1}. [${p.code}] ${p.name}`));
}

syncExactFrameNames().catch(console.error);
