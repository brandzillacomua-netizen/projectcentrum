const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const nomId = '7e8d056d-06b2-42a7-88e1-12186b914948'; // F610-ІП24-Н-3-14

  console.log('1. Reading current inventory quantity...');
  const { data: invBefore } = await supabase.from('inventory').select('*').eq('nomenclature_id', nomId).eq('type', 'scrap').maybeSingle();
  console.log('Inventory before:', invBefore);

  console.log('2. Inserting test record into work_card_history...');
  const { data: histRow, error: errHist } = await supabase
    .from('work_card_history')
    .insert([{
      nomenclature_id: nomId,
      stage_name: 'Test Trigger Stage',
      operator_name: 'Test Trigger',
      qty_at_start: 10,
      qty_completed: 0,
      scrap_qty: 10,
      is_archived_scrap: true,
      completed_at: new Date().toISOString()
    }])
    .select();

  if (errHist) {
    console.error('History insert error:', errHist);
    return;
  }
  console.log('History row inserted:', histRow);

  console.log('3. Reading inventory quantity after history insert...');
  const { data: invAfter } = await supabase.from('inventory').select('*').eq('nomenclature_id', nomId).eq('type', 'scrap').maybeSingle();
  console.log('Inventory after:', invAfter);

  // Clean up
  console.log('4. Cleaning up test history row...');
  await supabase.from('work_card_history').delete().eq('id', histRow[0].id);

  console.log('5. Reading inventory quantity after cleanup...');
  const { data: invFinal } = await supabase.from('inventory').select('*').eq('nomenclature_id', nomId).eq('type', 'scrap').maybeSingle();
  console.log('Inventory final:', invFinal);
}

run();
