const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    console.log('--- Orders ---');
    const { data: orders, error: errOrders } = await supabase
      .from('orders')
      .select('*')
      .like('order_num', 'ВБ%')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (errOrders) console.error(errOrders);
    else console.log(JSON.stringify(orders, null, 2));

    if (orders && orders.length > 0) {
      const orderIds = orders.map(o => o.id);
      console.log('--- Tasks ---');
      const { data: tasks, error: errTasks } = await supabase
        .from('tasks')
        .select('*')
        .in('order_id', orderIds);
      if (errTasks) console.error(errTasks);
      else console.log(JSON.stringify(tasks, null, 2));

      console.log('--- Work Cards ---');
      const { data: cards, error: errCards } = await supabase
        .from('work_cards')
        .select('*')
        .in('order_id', orderIds);
      if (errCards) console.error(errCards);
      else console.log(JSON.stringify(cards, null, 2));
    }
  } catch (e) {
    console.error(e);
  }
}

run();
