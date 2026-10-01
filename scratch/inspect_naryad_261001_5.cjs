const { createClient } = require('@supabase/supabase-js');

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(url, key);

async function inspectNaryad() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  });
  if (authErr) {
    console.error('Auth error:', authErr.message);
    return;
  }

  console.log('=== SEARCHING FOR NARYAD / TASK / ORDER 261001-5 ===');

  // Search orders
  const { data: orders, error: ordErr } = await supabase
    .from('orders')
    .select('*')
    .ilike('order_num', '%261001-5%');
  console.log('Orders found:', orders);

  // Search tasks
  const { data: tasks, error: taskErr } = await supabase
    .from('tasks')
    .select('*')
    .or('id.ilike.%261001-5%,order_id.ilike.%261001-5%');
  console.log('Tasks found by ID/order_id:', tasks);

  // Search work_cards
  const { data: cards, error: cardErr } = await supabase
    .from('work_cards')
    .select('*')
    .or('card_number.ilike.%261001-5%,id.ilike.%261001-5%');
  console.log('Work cards found:', cards);

  // Search material_requests
  const { data: reqs, error: reqErr } = await supabase
    .from('material_requests')
    .select('*')
    .or('details.ilike.%261001-5%,id.ilike.%261001-5%');
  console.log('Material requests found by text:', reqs);

  // Also query recent orders created today (2026-10-01)
  const { data: recentOrders } = await supabase
    .from('orders')
    .select('*')
    .gte('created_at', '2026-10-01T00:00:00')
    .order('created_at', { ascending: false });
  console.log('Recent orders created today:', recentOrders?.map(o => ({ id: o.id, order_num: o.order_num, created_at: o.created_at, details: o.details })));

  // Query recent tasks created today
  const { data: recentTasks } = await supabase
    .from('tasks')
    .select('*')
    .gte('created_at', '2026-10-01T00:00:00')
    .order('created_at', { ascending: false });
  console.log('Recent tasks created today:', recentTasks?.map(t => ({ id: t.id, order_id: t.order_id, created_at: t.created_at, nomenclature_id: t.nomenclature_id, step: t.step, status: t.status, plan_snapshot: t.plan_snapshot })));

  // Query recent material_requests created today
  const { data: recentReqs } = await supabase
    .from('material_requests')
    .select('*')
    .gte('created_at', '2026-10-01T00:00:00')
    .order('created_at', { ascending: false });
  console.log('Recent material requests created today:', recentReqs);
}

inspectNaryad();
