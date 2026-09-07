const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

const SUPABASE_URL = urlMatch[1].trim();
const SUPABASE_ANON_KEY = keyMatch[1].trim();

const framesToInsert = [
  { name: 'Комплект карбонової рами', projNum: '' },
  { name: 'Комплект карбонової рами (RND230) Рама JET 13"', projNum: '230' },
  { name: 'Рама (інд. проєкт 80) KHARAK 265 V2 Д-тех', projNum: '80' },
  { name: 'Рама (інд. проєкт 10), 11", Київ К', projNum: '10' },
  { name: 'Рама (інд. проєкт 14), Litavr 7, Київ К', projNum: '14' },
  { name: 'Рама (інд. проєкт 71), KR 385 V2, Скайтактік', projNum: '71' },
  { name: 'Рама (інд. проєкт 72), F5, Київ К', projNum: '72' },
  { name: 'Рама (інд. проєкт 24), F610, Київ К', projNum: '24' },
  { name: 'Рама (інд. проєкт 27), F415, Київ К', projNum: '27' },
  { name: 'Рама (інд. проєкт 28), F421, Київ К', projNum: '28' },
  { name: 'Рама (інд. проєкт 47), F613, Київ К', projNum: '47' },
  { name: 'Рама (RND 201), KHARAK 385 V2.0, Д-Тех', projNum: '201' },
  { name: 'Рама (RND 218), Mamont 15", Технетофарт Південь', projNum: '218' },
  { name: 'Рама (RND122) Kharak 325 Extended, Д-Тех', projNum: '122' },
  { name: 'Рама (RND202), KHARAK AIR 10", SKT', projNum: '202' },
  { name: 'Рама (RND242), KHARAK AIR 10", SKT V2', projNum: '242' },
  { name: 'Рама (RND87), Drozd 9" посилена', projNum: '87' },
  { name: 'Рама F10', projNum: '' },
  { name: 'Рама (RND 217), Kharak 11(240)', projNum: '217' },
  { name: 'Рама (RND 220), Рама 10" V3', projNum: '220' },
  { name: 'Рама (RND 224), JET V2.5.1', projNum: '224' },
  { name: 'Рама (RND 227), Ракета 9"', projNum: '227' },
  { name: 'Рама (RND 228), KHARAK AIR 8"', projNum: '228' }
];

async function seedFrames() {
  const headers = { 
    'apikey': SUPABASE_ANON_KEY, 
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  let rEx = await fetch(SUPABASE_URL + '/rest/v1/nomenclatures_v2?select=id,name,code', { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY } });
  let existingData = await rEx.json();
  const existingNames = new Set(existingData.map(d => d.name.trim().toLowerCase()));

  console.log(`Currently ${existingData.length} total items in nomenclatures_v2.`);

  const toInsert = [];
  let index = 1;

  framesToInsert.forEach(f => {
    if (!existingNames.has(f.name.trim().toLowerCase())) {
      const codeStr = `V2-FRAME-${String(index).padStart(3, '0')}-${Date.now().toString().slice(-4)}`;
      index++;
      toInsert.push({
        code: codeStr,
        name: f.name,
        group_id: 'grp_production_frames',
        unit: 'шт',
        rule_type: 'full_frame',
        rule_params: {
          name: f.name,
          projNum: f.projNum,
          projType: 'SERIAL',
          unit: 'шт'
        },
        status: 'active'
      });
    } else {
      console.log(`Skipping existing item: '${f.name}'`);
    }
  });

  if (toInsert.length > 0) {
    console.log(`Inserting ${toInsert.length} new finished products into nomenclatures_v2...`);
    let rIns = await fetch(SUPABASE_URL + '/rest/v1/nomenclatures_v2', {
      method: 'POST',
      headers,
      body: JSON.stringify(toInsert)
    });

    if (rIns.ok) {
      let inserted = await rIns.json();
      console.log(`✅ Successfully inserted ${inserted.length} items into nomenclatures_v2!`);
      inserted.forEach(i => console.log(`  - [${i.id}] ${i.code} | ${i.name}`));
    } else {
      let err = await rIns.text();
      console.error('❌ Insert failed:', rIns.status, err);
    }
  } else {
    console.log('All products already exist in nomenclatures_v2!');
  }

  let rFinal = await fetch(SUPABASE_URL + '/rest/v1/nomenclatures_v2?group_id=eq.grp_production_frames&select=id,name,code', { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY } });
  let finalProd = await rFinal.json();
  console.log(`\n🎉 Total items in group_id='grp_production_frames': ${finalProd.length}`);
}

seedFrames().catch(console.error);
