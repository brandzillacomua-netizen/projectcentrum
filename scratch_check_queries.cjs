const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const threeDaysAgoTasks = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  
  const queries = [
    { name: 'system_users', q: supabase.from('system_users').select('*').order('login') },
    { name: 'machines', q: supabase.from('machines').select('*').order('name') },
    { name: 'management_tasks', q: supabase.from('management_tasks').select('*').neq('status', 'completed').order('created_at', { ascending: false }) },
    { name: 'customers', q: supabase.from('customers').select('id,name,official_name').limit(50).order('name') },
    { name: 'orders', q: supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).range(0, 99) },
    { name: 'tasks', q: supabase.from('tasks').select('id,order_id,step,status,planned_sets,estimated_time,engineer_conf,warehouse_conf,director_conf,plan_snapshot,batch_index,planned_deadline,machine_name,created_at,completed_at').or(`status.neq.completed,completed_at.gte.${threeDaysAgoTasks}`).order('created_at', { ascending: false }) },
    { name: 'nomenclatures', q: supabase.from('nomenclatures').select('*').limit(2000) },
    { name: 'bom_items', q: supabase.from('bom_items').select('*').limit(4000) },
    { name: 'work_cards', q: supabase.from('work_cards').select('*').neq('status', 'completed').order('created_at', { ascending: true }) },
    { name: 'company_structure', q: supabase.from('company_structure').select('*').order('name') },
    { name: 'company_positions', q: supabase.from('company_positions').select('*').order('name') },
    { name: 'inventory', q: supabase.from('inventory').select('*').order('name').limit(3000) },
    { name: 'material_requests', q: supabase.from('material_requests').select('*').neq('status', 'completed').order('created_at', { ascending: false }) },
    { name: 'reception_docs', q: supabase.from('reception_docs').select('*').order('created_at', { ascending: false }).limit(300) },
    { name: 'purchase_requests', q: supabase.from('purchase_requests').select('*').order('created_at', { ascending: false }).limit(300) },
    { name: 'work_card_history', q: supabase.from('work_card_history').select('*').order('created_at', { ascending: false }).limit(200) },
    { name: 'machine_operations', q: supabase.from('machine_operations').select('*') }
  ];

  for (const query of queries) {
    try {
      const { data, error } = await query.q;
      if (error) {
        console.error(`Error on query ${query.name}:`, error);
      } else {
        console.log(`Success on ${query.name}: fetched ${data ? data.length : 0} rows`);
      }
    } catch (e) {
      console.error(`Threw error on ${query.name}:`, e);
    }
  }
}

run();
