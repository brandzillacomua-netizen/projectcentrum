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
    .select('*')
    .eq('order_num', '27062026-01')
    .single();

  const { data: cards } = await supabase
    .from('work_cards')
    .select('*')
    .eq('order_id', orderData.id);

  console.log('WORK CARDS FOR ORDER:', orderData.order_num);
  cards.forEach(c => {
    console.log(`Card ID: ${c.id}`);
    console.log(`Nomenclature ID: ${c.nomenclature_id}`);
    console.log(`Status: ${c.status}`);
    console.log(`Quantity: ${c.quantity}`);
    console.log(`Card Info: ${c.card_info}`);
    console.log(`Operation: ${c.operation}`);
    console.log(`Created At: ${c.created_at}`);
    console.log('------------------------------');
  });
}

main();
