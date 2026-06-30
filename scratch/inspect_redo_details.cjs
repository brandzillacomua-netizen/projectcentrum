const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
});

async function run() {
  const { data: cards } = await supabase.from('work_cards')
    .select('*')
    .in('id', [
      'bfc9d283-c39b-4f2e-a04f-b9adcdf95b19', 
      '8c5d0644-8efe-4bb5-b324-9374e1630be4', 
      '93e936d6-9455-4bf7-8357-24e7f1940bd4'
    ]);
  
  console.log("Detailed REDO cards:");
  cards.forEach(c => {
    console.log(`ID: ${c.id} | Info: "${c.card_info}" | NomID: "${c.nomenclature_id}" | Machine: "${c.machine}" | MachineName: "${c.machine_name}"`);
  });
}

run().catch(console.error);
