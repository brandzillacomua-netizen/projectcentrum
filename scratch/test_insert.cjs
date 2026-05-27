const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const taskId = 'fc4284b5-9aed-4fff-baba-2c6e6309ce86';
  const orderId = 'df392cec-5f41-47a4-8d04-f64d40f3a686';
  const nomId = 'a3498c79-c914-4526-8abf-a56fd0735794';
  const qty = 16;
  const stage = 'Доопрацювання';

  console.log('Testing insert into work_cards...');
  const { data, error } = await supabase
    .from('work_cards')
    .insert([{
      task_id: taskId,
      order_id: orderId,
      nomenclature_id: nomId,
      quantity: qty,
      status: 'new',
      operation: stage,
      card_info: `[REWORK] [ЦЕХ №2] Test — ДООПРАЦЮВАННЯ БРАКУ`,
      buffer_qty: 0
    }])
    .select();

  if (error) {
    console.error('Insert Error:', error);
  } else {
    console.log('Success:', data);
  }
}

run();
