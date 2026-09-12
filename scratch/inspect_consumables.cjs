const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseFile = fs.readFileSync(path.resolve(__dirname, '../src/supabase.js'), 'utf8');
const url = supabaseFile.match(/const\s+supabaseUrl\s*=\s*['"`]([^'"`]+)['"`]/)[1];
const key = supabaseFile.match(/export\s+const\s+supabaseAnonKey\s*=\s*['"`]([^'"`]+)['"`]/)[1];

const supabase = createClient(url, key, {
  global: {
    headers: {
      'x-mes-secret': 'REVOKED_MES_SECRET_DO_NOT_USE'
    }
  }
});

async function run() {
  const { data: rows, error: err } = await supabase
    .from('nomenclatures')
    .select('*')
    .eq('type', 'consumable')
    .limit(10);
  console.log("CONSUMABLE ROWS:", rows);
}

run();
