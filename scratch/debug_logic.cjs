const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
})

async function run() {
    const { data: orders } = await supabase.from('orders').select('*').eq('order_num', '09072026-01');
    if (!orders.length) return;
    const { data: tasks } = await supabase.from('tasks').select('*').eq('order_id', orders[0].id);
    const task = tasks[0];

    const { data: nomenclatures } = await supabase.from('nomenclatures').select('*').ilike('name', '%Київ К-ІП9-10-П-7-46%');
    const nom = nomenclatures[0];
    
    console.log("Snapshot for nom:", JSON.stringify((task.plan_snapshot || {})[nom.id]));
}

run().catch(console.error);
