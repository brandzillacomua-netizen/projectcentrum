const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

const SUPABASE_URL = urlMatch[1].trim();
const SUPABASE_ANON_KEY = keyMatch[1].trim();

async function findPotentialParents() {
  const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY };

  let r = await fetch(SUPABASE_URL + '/rest/v1/nomenclatures_v2?select=*&limit=1000', { headers });
  let data = await r.json();

  console.log(`Total items in nomenclatures_v2: ${data.length}`);

  // Find items in cat_parts that DON'T look like sub-parts (e.g. don't have -П-, -В-, -Н-, -Х-, Промінь, Пластина, etc.)
  const candidateParents = data.filter(d => {
    const name = (d.name || '').toLowerCase();
    return (
      !name.includes('промінь') &&
      !name.includes('пластина') &&
      !name.includes('мотормаунт') &&
      !name.includes('кришка') &&
      !name.includes('перемичка') &&
      !name.includes('хрестик') &&
      !name.includes('конектор') &&
      !name.includes('акб') &&
      !name.includes('подкладка') &&
      !name.includes('підкладка') &&
      !name.includes('верх') &&
      !name.includes('низ') &&
      !name.includes('складова') &&
      !name.includes('фреза') &&
      !name.includes('фарба') &&
      !name.includes('гвинт') &&
      !name.includes('гайка') &&
      !name.includes('стійка') &&
      !name.includes('гума')
    );
  });

  console.log(`\nFound ${candidateParents.length} non-part candidate items in nomenclatures_v2:`);
  candidateParents.forEach(c => {
    console.log(`[ID: ${c.id}] code: ${c.code} | group_id: '${c.group_id}' | rule_type: '${c.rule_type}' | name: '${c.name}'`);
  });
}

findPotentialParents().catch(console.error);
