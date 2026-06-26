const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
});

async function run() {
  console.log("Searching for '22062026-03' in orders and tasks...");
  
  // Search in orders
  const { data: orders, error: orderErr } = await supabase.from('orders').select('*');
  if (orderErr) {
    console.error("Orders query error:", orderErr);
  } else {
    console.log(`Total orders: ${orders.length}`);
    if (orders.length > 0) {
      console.log("Order 0 keys:", Object.keys(orders[0]));
      console.log("Sample orders (first 5):");
      orders.slice(0, 5).forEach(o => {
        console.log(`- ID: ${o.id}, Order Number: ${o.order_number || o.number || o.name || o.id}`);
      });
      const matchOrders = orders.filter(o => JSON.stringify(o).toLowerCase().includes('22062026') || JSON.stringify(o).toLowerCase().includes('03'));
      console.log(`Potential matching orders (filtering by '22062026' or '03'): ${matchOrders.length}`);
      matchOrders.slice(0, 5).forEach(o => {
        console.log(`- Match ID: ${o.id}, Number: ${o.order_number}`);
      });
    }
  }

  // Search in tasks (which might represent Naryad)
  const { data: tasks, error: tasksErr } = await supabase.from('tasks').select('*');
  if (tasksErr) {
    console.error("Tasks query error:", tasksErr);
  } else {
    console.log(`Total tasks: ${tasks.length}`);
    if (tasks.length > 0) {
      console.log("Task 0 keys:", Object.keys(tasks[0]));
      console.log("Sample tasks (first 5):");
      tasks.slice(0, 5).forEach(t => {
        console.log(`- ID: ${t.id}, Step: ${t.step}, Order ID: ${t.order_id}`);
      });
    }
  }
}

run();
