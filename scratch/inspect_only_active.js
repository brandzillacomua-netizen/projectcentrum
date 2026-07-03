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

async function main() {
  const { data: orderData } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('order_num', '27062026-01')
    .single();

  const { data: tasksData } = await supabase
    .from('tasks')
    .select('*')
    .eq('order_id', orderData.id);

  console.log('ORDER QTY:', orderData.quantity);
  console.log('ORDER ITEMS QTYs:', orderData.order_items.map(i => ({ id: i.id, nomenclature_id: i.nomenclature_id, quantity: i.quantity })));

  tasksData.forEach(t => {
    console.log('\n--- TASK:', t.id, 'Step:', t.step);
    console.log('Status:', t.status);
    console.log('Arrivals:', t.plan_snapshot?.arrivals);
    // Print entries inside plan_snapshot
    Object.entries(t.plan_snapshot || {}).forEach(([k, v]) => {
      if (k !== 'arrivals' && k !== '_metadata' && k !== 'materials' && k !== 'cutters') {
        console.log(`Key ${k}: name="${v.name}" need=${v.need} plan=${v.plan} stock=${v.stock} sheets=${v.sheets} units_per_sheet=${v.units_per_sheet}`);
      }
    });
  });
}

main();
