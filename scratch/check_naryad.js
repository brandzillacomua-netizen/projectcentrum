const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Searching for '22062026-03' in orders and tasks...");
  
  // Search in orders
  const { data: orders, error: orderErr } = await supabase.from('orders').select('*');
  if (orderErr) {
    console.error("Orders query error:", orderErr);
  } else {
    const matchOrders = orders.filter(o => JSON.stringify(o).includes('22062026-03'));
    console.log(`Matching orders count: ${matchOrders.length}`);
    matchOrders.forEach(o => {
      console.log("Order details:", o);
    });
  }

  // Search in tasks (which might represent Naryad)
  const { data: tasks, error: tasksErr } = await supabase.from('tasks').select('*');
  if (tasksErr) {
    console.error("Tasks query error:", tasksErr);
  } else {
    const matchTasks = tasks.filter(t => JSON.stringify(t).includes('22062026-03'));
    console.log(`Matching tasks count: ${matchTasks.length}`);
    matchTasks.forEach(t => {
      console.log("Task details ID:", t.id, "Step:", t.step, "Status:", t.status);
    });
  }
}

run();
