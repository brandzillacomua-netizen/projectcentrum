const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

const SUPABASE_URL = urlMatch[1].trim();
const SUPABASE_ANON_KEY = keyMatch[1].trim();

// Target names from the user's screenshot at the bottom (existing specifications)
const targetNames = [
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

async function matchTargetSpecs() {
  const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY };

  let r = await fetch(SUPABASE_URL + '/rest/v1/nomenclatures_v2?select=*&limit=1000', { headers });
  let data = await r.json();

  console.log(`Total items in nomenclatures_v2: ${data.length}`);

  // Try matching by exact name, fuzzy substring, or project numbers
  targetNames.forEach((target, i) => {
    const tLower = target.toLowerCase();
    const matches = data.filter(d => {
      const dLower = (d.name || '').toLowerCase();
      if (dLower === tLower) return true;
      if (dLower.includes(tLower) || tLower.includes(dLower)) return true;
      
      // Extract numbers
      const tNums = tLower.match(/\d+/g) || [];
      const dNums = dLower.match(/\d+/g) || [];
      if (tNums.length > 0 && dNums.length > 0) {
        if (tNums.join('-') === dNums.join('-') && (dLower.includes('рама') || dLower.includes('комплект'))) {
          return true;
        }
      }
      return false;
    });

    console.log(`\n${i+1}. TARGET: '${target}'`);
    if (matches.length > 0) {
      matches.forEach(m => {
        console.log(`   -> MATCH: [ID: ${m.id}] code: ${m.code} | group_id: '${m.group_id}' | rule_type: '${m.rule_type}' | name: '${m.name}'`);
      });
    } else {
      console.log('   -> NO MATCH FOUND');
    }
  });
}

matchTargetSpecs().catch(console.error);
