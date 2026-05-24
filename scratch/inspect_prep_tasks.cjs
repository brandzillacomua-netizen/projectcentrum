const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'a:/centrum/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('step', 'Підготовка')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching prep tasks:', error);
    return;
  }

  console.log('Total prep tasks:', data.length);
  data.slice(0, 5).forEach(t => {
    console.log(`ID: ${t.id}`);
    console.log(`Status: ${t.status}`);
    console.log(`Warehouse Conf: ${t.warehouse_conf}`);
    console.log(`Plan Snapshot:`, JSON.stringify(t.plan_snapshot, null, 2));
    console.log('---');
  });
}

main();
