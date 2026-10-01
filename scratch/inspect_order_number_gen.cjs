const { createClient } = require('@supabase/supabase-js');

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(url, key);

async function inspectOrderNumbers() {
  await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  });

  console.log('=== CHECKING ALL ORDERS IN DB WITH ORDER_NUM CONTAINING 261001 ===');
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_num, customer, status, created_at')
    .or('order_num.ilike.%261001%,created_at.gte.2026-10-01T00:00:00')
    .order('created_at', { ascending: true });

  console.log('Orders found:', orders);

  console.log('\n=== CHECKING MES_COUNTERS TABLE ===');
  const { data: counters, error: counterErr } = await supabase
    .from('mes_counters')
    .select('*');

  if (counterErr) {
    console.log('mes_counters error:', counterErr.message);
  } else {
    console.log('mes_counters data:', counters);
  }
}

inspectOrderNumbers();
