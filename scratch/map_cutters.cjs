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
  // Fetch generic cutter types
  const { data: genericCutters, error: gErr } = await supabase
    .from('nomenclatures')
    .select('*')
    .eq('type', 'cutter_type');

  if (gErr) {
    console.error("Error fetching generic cutters:", gErr.message);
    return;
  }

  // Fetch physical stock cutters
  const { data: physicalCutters, error: pErr } = await supabase
    .from('nomenclatures')
    .select('*')
    .eq('type', 'consumable');

  if (pErr) {
    console.error("Error fetching physical cutters:", pErr.message);
    return;
  }

  const cuttersOnly = physicalCutters.filter(n => n.name.toLowerCase().includes('фреза'));
  console.log(`Found ${cuttersOnly.length} physical cutters. Mappings:`);

  const updates = [];

  for (const pc of cuttersOnly) {
    const name = pc.name;
    const nameLower = name.toLowerCase();

    let targetGeneric = null;

    // Helper to find generic by name
    const findGeneric = (gName) => genericCutters.find(g => g.name === gName);

    // Rule matching:
    // 1) 3.175 (90)
    if (nameLower.includes('3.175') && nameLower.includes('90')) {
      targetGeneric = findGeneric('Фреза ф3.175 (90)');
    }
    // 2) 6 (120)
    else if (nameLower.includes('120') && (nameLower.includes('6x') || nameLower.includes('6х') || nameLower.includes(' ф6') || nameLower.startsWith('фреза ф6') || nameLower.includes('6*'))) {
      targetGeneric = findGeneric('Фреза ф6 (120)');
    }
    // 3) 6 (90)
    else if (nameLower.includes('90') && (nameLower.includes('6x') || nameLower.includes('6х') || nameLower.includes(' ф6') || nameLower.startsWith('фреза ф6') || nameLower.includes('6*'))) {
      targetGeneric = findGeneric('Фреза ф6 (90)');
    }
    else {
      // Extract the first number after "фреза" and descriptors (like "кукурудза", "двопера", "однопера", "фасочна", etc.)
      // Examples:
      // "Фреза кукурудза 3х3,175х9х45" -> first number is 3
      // "Фреза кукурудза 4х4х12х50" -> first number is 4
      // "Фреза ф2" -> first number is 2
      // Let's strip the prefix "фреза [descriptor]" and grab the first decimal number
      const cleanName = nameLower
        .replace(/^фреза\s+(?:кукурудза|двопера|однопера|фасочна|спіральна|торцева|шарова|радіусна|гравер|конічна)\s*/, '')
        .replace(/^фреза\s+ф/, '')
        .replace(/^фреза\s+f/, '')
        .replace(/^фреза\s*/, '')
        .trim();

      const match = cleanName.match(/^([0-9]+(?:[.,][0-9]+)?)/);
      if (match) {
        const firstNum = parseFloat(match[1].replace(',', '.'));
        if (firstNum === 1.5) {
          targetGeneric = findGeneric('Фреза ф1.5');
        } else if (firstNum === 2) {
          targetGeneric = findGeneric('Фреза ф2');
        } else if (firstNum === 3) {
          targetGeneric = findGeneric('Фреза ф3');
        } else if (firstNum === 4) {
          targetGeneric = findGeneric('Фреза ф4');
        } else if (firstNum === 6) {
          targetGeneric = findGeneric('Фреза ф6');
        }
      }
    }

    if (targetGeneric) {
      console.log(`[MATCH] "${name}" -> "${targetGeneric.name}" (ID: ${targetGeneric.id})`);
      updates.push({ id: pc.id, characteristic: targetGeneric.id });
    } else {
      console.log(`[NO MATCH] "${name}"`);
    }
  }

  console.log(`Applying ${updates.length} updates...`);
  for (const upd of updates) {
    const { error } = await supabase
      .from('nomenclatures')
      .update({ characteristic: upd.characteristic })
      .eq('id', upd.id);
    if (error) {
      console.error(`Failed to update ${upd.id}:`, error.message);
    }
  }
  console.log("Auto-assignment complete!");
}

run();
