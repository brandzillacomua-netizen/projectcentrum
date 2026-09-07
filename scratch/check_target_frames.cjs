const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

const SUPABASE_URL = urlMatch[1].trim();
const SUPABASE_ANON_KEY = keyMatch[1].trim();

const targetFrameNames = [
  'Комплект карбонової рами',
  'Комплект карбонової рами (RND230) Рама JET 13"',
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

async function checkTargetFrames() {
  const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY };

  let r = await fetch(SUPABASE_URL + '/rest/v1/nomenclatures_v2?select=*&limit=1000', { headers });
  let data = await r.json();

  console.log('Total items in nomenclatures_v2:', data.length);
  
  targetFrameNames.forEach((name, idx) => {
    const found = data.find(d => d.name.trim().toLowerCase() === name.trim().toLowerCase() || d.name.includes(name));
    if (found) {
      console.log(`${idx+1}. EXISTS: [${found.id}] '${found.name}' -> group_id: '${found.group_id}'`);
    } else {
      console.log(`${idx+1}. MISSING: '${name}'`);
    }
  });
}

checkTargetFrames().catch(console.error);
