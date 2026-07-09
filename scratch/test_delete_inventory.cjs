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
  // Let's find "Фреза ф6" (generic cutter) which is the one user tried to delete
  const { data: nom } = await supabase
    .from('nomenclatures')
    .select('id')
    .eq('name', 'Фреза ф6')
    .limit(1);

  if (!nom || nom.length === 0) {
    console.log("Фреза ф6 not found");
    return;
  }

  const id = nom[0].id;
  console.log(`Testing deletion for Фреза ф6 (ID: ${id})`);

  // Try to delete inventory first and print error
  const { error: invErr } = await supabase
    .from('inventory')
    .delete()
    .eq('nomenclature_id', id);

  if (invErr) {
    console.error("INVENTORY DELETE ERROR:", invErr.message, invErr.details, invErr.hint);
  } else {
    console.log("Inventory deleted successfully or no rows found!");
  }
}

run();
