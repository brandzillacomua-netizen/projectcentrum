const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
});

async function run() {
  const nomIds = [
    '50947afc-4e40-4165-a682-780275d5feda',
    '5ecf63e5-802d-4f98-8291-aad9a52bfaa4',
    'b77e0883-0af2-40a4-a834-a1e47b6570da'
  ];
  
  const { data: ops } = await supabase.from('machine_operations')
    .select('*')
    .in('nomenclature_id', nomIds);
    
  console.log(`Found ${ops?.length} machine operations:`);
  ops.forEach(o => {
    console.log(`NomID: ${o.nomenclature_id} | MachineType: ${o.machine_type} | MachineID: ${o.machine_id} | CutOps:`, o.side2_cut_ops);
  });
}

run().catch(console.error);
