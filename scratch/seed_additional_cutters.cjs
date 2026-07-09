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

const cutterTypes = [
  { name: 'Фреза ф1.5', material_type: '1.5' },
  { name: 'Фреза ф2', material_type: '2' },
  { name: 'Фреза ф3', material_type: '3' },
  { name: 'Фреза ф4', material_type: '4' },
  { name: 'Фреза ф6', material_type: '6' },
  { name: 'Фреза ф3.175 (90)', material_type: '3.175' },
  { name: 'Фреза ф6 (90)', material_type: '6' },
  { name: 'Фреза ф6 (120)', material_type: '6' }
];

async function seed() {
  console.log("Seeding all cutter types from the dropdown screenshot...");
  for (const cutter of cutterTypes) {
    const { data: existing, error: checkErr } = await supabase
      .from('nomenclatures')
      .select('*')
      .eq('name', cutter.name)
      .limit(1);

    if (checkErr) {
      console.error(`Error checking ${cutter.name}:`, checkErr.message);
      continue;
    }

    if (existing && existing.length > 0) {
      const record = existing[0];
      // Update existing to have type: 'cutter_type'
      const { error: updErr } = await supabase
        .from('nomenclatures')
        .update({ type: 'cutter_type', material_type: cutter.material_type })
        .eq('id', record.id);
      if (updErr) {
        console.error(`Error updating ${cutter.name}:`, updErr.message);
      } else {
        console.log(`Updated: ${cutter.name} -> cutter_type`);
      }
    } else {
      // Insert new
      const { data: inserted, error: insErr } = await supabase
        .from('nomenclatures')
        .insert([{ name: cutter.name, type: 'cutter_type', material_type: cutter.material_type }])
        .select();

      if (insErr) {
        console.error(`Error inserting ${cutter.name}:`, insErr.message);
      } else {
        console.log(`Created new cutter type: ${cutter.name}`);
      }
    }
  }
  console.log("All cutter types seeded successfully!");
}

seed();
