import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const { data: orders } = await supabase.from('orders').select('*').ilike('order_num', '%260831-2%');
  console.log('=== ORDERS ===');
  console.log(orders);

  if (orders && orders.length > 0) {
    const orderId = orders[0].id;
    const { data: tasks } = await supabase.from('tasks').select('*').eq('order_id', orderId);
    console.log('\n=== TASKS ===');
    console.log(tasks);

    const { data: cards } = await supabase.from('work_cards').select('*').eq('order_id', orderId);
    console.log('\n=== WORK CARDS ===');
    console.log(cards);
  }
}

main().catch(console.error);
