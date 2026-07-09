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
  const tables = ['cutter_types', 'nomenclatures', 'machine_operations'];
  for (const t of tables) {
    try {
      const { data: rows, error: err } = await supabase.from(t).select('*').limit(1);
      console.log(`Table ${t} exists?`, !err, err ? err.message : `yes, rows count: ${rows.length}`);
    } catch (e) {
      console.log(`Table ${t} check threw error:`, e.message);
    }
  }

  // Let's check RPCs by trying to call exec_sql or similar if we need to create a table.
  // Wait, is there an SQL RPC?
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1' });
    console.log("exec_sql RPC check:", { data, error });
  } catch (e) {
    console.log("exec_sql check error:", e.message);
  }
}

run();
