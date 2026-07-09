const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseFile = fs.readFileSync(path.resolve(__dirname, '../src/supabase.js'), 'utf8');
const url = supabaseFile.match(/const\s+supabaseUrl\s*=\s*['"`]([^'"`]+)['"`]/)[1];
const key = supabaseFile.match(/export\s+const\s+supabaseAnonKey\s*=\s*['"`]([^'"`]+)['"`]/)[1];

const supabase = createClient(url, key, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
});

async function run() {
  const { data: genericCutters } = await supabase
    .from('nomenclatures')
    .select('*')
    .eq('type', 'cutter_type');

  const { data: physicalCutters } = await supabase
    .from('nomenclatures')
    .select('*')
    .eq('type', 'consumable');

  const cuttersOnly = physicalCutters.filter(n => n.name.toLowerCase().includes('фреза'));
  const findGeneric = (gName) => genericCutters.find(g => g.name === gName);

  const updates = [];

  for (const pc of cuttersOnly) {
    const name = pc.name;
    const nameLower = name.toLowerCase();

    let targetGeneric = null;

    if (nameLower.includes('3.175') && nameLower.includes('90')) {
      targetGeneric = findGeneric('Фреза ф3.175 (90)');
    } else if (nameLower.includes('120') && (nameLower.includes('6x') || nameLower.includes('6х') || nameLower.includes(' ф6') || nameLower.startsWith('фреза ф6') || nameLower.includes('6*'))) {
      targetGeneric = findGeneric('Фреза ф6 (120)');
    } else if (nameLower.includes('90') && (nameLower.includes('6x') || nameLower.includes('6х') || nameLower.includes(' ф6') || nameLower.startsWith('фреза ф6') || nameLower.includes('6*'))) {
      targetGeneric = findGeneric('Фреза ф6 (90)');
    } else {
      // General match: find the first number in the name
      // Example: "Фреза чотирьохпера 2х4х12х50" -> "2"
      // Example: "Фреза двопера 3,175х3,175х42х65" -> "3.175"
      // Example: "Фреза кукурудза 2,5х3,175х10х38" -> "2.5"
      const match = nameLower.match(/(?:фреза|уп[0-9.]+)\s+[^0-9]*\s*([0-9]+(?:[.,][0-9]+)?)/);
      if (match) {
        const firstNum = parseFloat(match[1].replace(',', '.'));
        if (firstNum === 1.5) targetGeneric = findGeneric('Фреза ф1.5');
        else if (firstNum === 2) targetGeneric = findGeneric('Фреза ф2');
        else if (firstNum === 3) targetGeneric = findGeneric('Фреза ф3');
        else if (firstNum === 4) targetGeneric = findGeneric('Фреза ф4');
        else if (firstNum === 6) targetGeneric = findGeneric('Фреза ф6');
        else if (firstNum === 3.175) targetGeneric = findGeneric('Фреза ф3') || findGeneric('Фреза ф3.175 (90)'); // 3.175 usually maps to Ф3 if no specific 3.175 standard type exists, or stays unmapped. Wait, is there a standard Ф3? Yes!
      }
    }

    if (targetGeneric) {
      console.log(`[MATCH] "${name}" -> "${targetGeneric.name}"`);
      updates.push({ id: pc.id, characteristic: targetGeneric.id });
    } else {
      console.log(`[NO MATCH] "${name}"`);
    }
  }

  console.log(`Applying ${updates.length} updates...`);
  for (const upd of updates) {
    await supabase
      .from('nomenclatures')
      .update({ characteristic: upd.characteristic })
      .eq('id', upd.id);
  }
  console.log("Complete!");
}

run();
