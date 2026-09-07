const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

const SUPABASE_URL = urlMatch[1].trim();
const SUPABASE_ANON_KEY = keyMatch[1].trim();

async function checkV1AndV2() {
  const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY };

  let r1 = await fetch(SUPABASE_URL + '/rest/v1/nomenclatures?select=*&limit=1000', { headers });
  let data1 = await r1.json();
  console.log(`nomenclatures (V1) total items: ${data1.length}`);

  let r2 = await fetch(SUPABASE_URL + '/rest/v1/nomenclatures_v2?select=*&limit=1000', { headers });
  let data2 = await r2.json();
  console.log(`nomenclatures_v2 total items: ${data2.length}`);

  const targetNames = [
    'Рама (інд. проєкт 80) KHARAK 265 V2 Д-тех',
    'Рама (інд. проєкт 10), 11", Київ К',
    'Рама (інд. проєкт 14), Litavr 7, Київ К',
    'Рама (інд. проєкт 71), KR 385 V2, Скайтактік',
    'Рама (інд. проєкт 72), F5, Київ К',
    'Рама (інд. проєкт 24), F610, Київ К',
    'Рама (інд. проєкт 27), F415, Київ К',
    'Рама (інд. проєкт 28), F421, Київ К',
    'Рама (інд. проєкт 47), F613, Київ К',
    'Рама (RND 201), KHARAK 385 V2.0, Д-Тех',
    'Рама (RND 218), Mamont 15", Технетофарт Південь',
    'Рама (RND122) Kharak 325 Extended, Д-Тех',
    'Рама (RND202), KHARAK AIR 10", SKT',
    'Рама (RND242), KHARAK AIR 10", SKT V2',
    'Рама (RND87), Drozd 9" посилена',
    'Рама F10'
  ];

  console.log('\n--- SEARCH IN V1 (nomenclatures) ---');
  targetNames.forEach(t => {
    const found = data1.filter(d => (d.name || '').toLowerCase().includes(t.toLowerCase().slice(0, 10)));
    if (found.length > 0) {
      found.forEach(f => console.log(`  MATCH V1: [${f.id}] ${f.name} (type: ${f.type}, cat: ${f.category})`));
    }
  });

  console.log('\n--- SEARCH IN V2 (nomenclatures_v2) ---');
  targetNames.forEach(t => {
    const found = data2.filter(d => (d.name || '').toLowerCase().includes(t.toLowerCase().slice(0, 10)));
    if (found.length > 0) {
      found.forEach(f => console.log(`  MATCH V2: [${f.id}] ${f.name} (group: ${f.group_id}, rule: ${f.rule_type})`));
    }
  });
}

checkV1AndV2().catch(console.error);
