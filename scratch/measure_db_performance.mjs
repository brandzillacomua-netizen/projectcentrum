import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
});

async function measure(name, fn) {
  const start = performance.now();
  try {
    const res = await fn();
    const duration = Math.round(performance.now() - start);
    return { name, duration, ok: true, rows: Array.isArray(res.data) ? res.data.length : (res.data ? 1 : 0) };
  } catch (err) {
    const duration = Math.round(performance.now() - start);
    return { name, duration, ok: false, error: err.message };
  }
}

async function runBenchmark() {
  console.log('--- Running DB Benchmark across Key Queries ---');

  const benchmarks = [
    // 1. Active work cards (operator/foreman critical query)
    ['Active Work Cards (neq completed)', () => supabase.from('work_cards').select('*').neq('status', 'completed').limit(1000)],
    
    // 2. Tasks operational slice
    ['Operational Tasks (recent 30d)', () => supabase.from('tasks').select('*').neq('status', 'completed').limit(500)],

    // 3. Inventory read (3000 rows limit)
    ['Inventory Full Catalog', () => supabase.from('inventory').select('*').order('name').limit(3000)],

    // 4. History slice (latest 500 rows)
    ['History Slice (latest 500)', () => supabase.from('work_card_history').select('*').order('created_at', { ascending: false }).limit(500)],

    // 5. Material requests active
    ['Active Material Requests', () => supabase.from('material_requests').select('*').neq('status', 'completed').limit(500)],

    // 6. Orders with order_items JOIN (latest 50)
    ['Orders JOIN order_items (latest 50)', () => supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).range(0, 49)],

    // 7. System users
    ['System Users List', () => supabase.from('system_users').select('id, login, first_name, last_name, position, access_rights').order('login')]
  ];

  const results = [];
  for (const [name, fn] of benchmarks) {
    results.push(await measure(name, fn));
  }

  console.log(JSON.stringify(results, null, 2));
}

runBenchmark();
