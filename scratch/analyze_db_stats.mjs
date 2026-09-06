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

async function getCount(table, filterFn = null) {
  try {
    let query = supabase.from(table).select('id', { count: 'exact', head: true });
    if (filterFn) {
      query = filterFn(query);
    }
    const { count, error } = await query;
    if (error) return { count: null, error: error.message };
    return { count, error: null };
  } catch (e) {
    return { count: null, error: e.message };
  }
}

async function analyze() {
  console.log('--- Querying live database statistics ---');

  const tables = [
    'work_cards',
    'work_card_history',
    'tasks',
    'orders',
    'order_items',
    'inventory',
    'material_requests',
    'reception_docs',
    'purchase_requests',
    'system_users',
    'machines',
    'machine_operations',
    'machine_calls',
    'nomenclatures',
    'bom_items',
    'customers',
    'task_projects',
    'management_tasks'
  ];

  const counts = {};
  for (const table of tables) {
    const res = await getCount(table);
    counts[table] = res.count !== null ? res.count : `ERR: ${res.error}`;
  }

  // Segmented counts for critical operational tables
  const activeWorkCards = await getCount('work_cards', q => q.neq('status', 'completed'));
  const completedWorkCards = await getCount('work_cards', q => q.eq('status', 'completed'));
  const inProgressWorkCards = await getCount('work_cards', q => q.eq('status', 'in_progress'));

  const activeTasks = await getCount('tasks', q => q.neq('status', 'completed'));
  const completedTasks = await getCount('tasks', q => q.eq('status', 'completed'));

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const history24h = await getCount('work_card_history', q => q.gte('created_at', oneDayAgo));
  const history7d = await getCount('work_card_history', q => q.gte('created_at', sevenDaysAgo));
  const history30d = await getCount('work_card_history', q => q.gte('created_at', thirtyDaysAgo));

  const activeMaterialRequests = await getCount('material_requests', q => q.neq('status', 'completed'));
  const pendingMachineCalls = await getCount('machine_calls', q => q.eq('status', 'pending'));

  const result = {
    totals: counts,
    segments: {
      work_cards: {
        total: counts.work_cards,
        active: activeWorkCards.count,
        completed: completedWorkCards.count,
        in_progress: inProgressWorkCards.count
      },
      tasks: {
        total: counts.tasks,
        active: activeTasks.count,
        completed: completedTasks.count
      },
      throughput_transitions: {
        last_24h: history24h.count,
        last_7d: history7d.count,
        last_30d: history30d.count,
        avg_daily_7d: Math.round((history7d.count || 0) / 7),
        avg_daily_30d: Math.round((history30d.count || 0) / 30)
      },
      operational_queues: {
        active_material_requests: activeMaterialRequests.count,
        pending_machine_calls: pendingMachineCalls.count
      }
    }
  };

  console.log(JSON.stringify(result, null, 2));
}

analyze().catch(err => console.error('Analysis failed:', err));
