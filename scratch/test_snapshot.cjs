const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'a:/centrum/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testFetch() {
  const threeDaysAgoTasks = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  
  console.time('fetch tasks without snapshot');
  const { data: d1 } = await supabase.from('tasks').select('id,order_id,step,status,planned_sets').or(`status.neq.completed,completed_at.gte.${threeDaysAgoTasks}`).order('created_at', { ascending: false });
  console.timeEnd('fetch tasks without snapshot');

  console.time('fetch tasks with snapshot');
  const { data: d2 } = await supabase.from('tasks').select('id,order_id,step,status,planned_sets,plan_snapshot').or(`status.neq.completed,completed_at.gte.${threeDaysAgoTasks}`).order('created_at', { ascending: false });
  console.timeEnd('fetch tasks with snapshot');

  console.log('Task count:', d1.length);
}

testFetch();
