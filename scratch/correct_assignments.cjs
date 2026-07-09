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

  const f15 = genericCutters.find(g => g.name === 'Фреза ф1.5');
  if (!f15) return;

  const namesToCorrect = [
    "Фреза Операція (2 сторона вирізка) Ф1.5мм",
    "Фреза уп2 ф1.5 лінії"
  ];

  for (const name of namesToCorrect) {
    const { error } = await supabase
      .from('nomenclatures')
      .update({ characteristic: f15.id })
      .eq('name', name);
    if (!error) {
      console.log(`Corrected: ${name} -> Фреза ф1.5`);
    }
  }
}

run();
