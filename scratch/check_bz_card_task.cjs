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
  const { data: cards } = await supabase.from('work_cards')
    .select('*')
    .eq('order_id', '53741df6-bd90-476b-9000-2c4bec9e9080')
    .eq('nomenclature_id', '5ecf63e5-802d-4f98-8291-aad9a52bfaa4');
  
  console.log("Cards count for B-3-30:", cards.length);
  cards.forEach(c => {
    console.log(`ID: ${c.id}, Info: ${c.card_info}, Op: ${c.operation}, Status: ${c.status}, Qty: ${c.quantity}, Task ID: ${c.task_id}`);
  });
}

run();
