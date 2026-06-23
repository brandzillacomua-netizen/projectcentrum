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
  const { data: cards, error } = await supabase.from('work_cards').select('*');
  if (error) {
    console.error(error);
    return;
  }
  const { data: noms } = await supabase.from('nomenclatures').select('*');
  const matchingNoms = noms.filter(n => n.name && n.name.includes('B-3-30'));
  console.log('Matching nomenclatures:', matchingNoms.map(n => ({ id: n.id, name: n.name })));
  
  const mNomIds = matchingNoms.map(n => n.id);
  const match = cards.filter(c => mNomIds.includes(c.nomenclature_id) || (c.card_info && c.card_info.includes('B-3-30')));
  console.log('Cards matching:', match.map(c => ({
    id: c.id,
    nomenclature_id: c.nomenclature_id,
    status: c.status,
    operation: c.operation,
    machine: c.machine,
    card_info: c.card_info
  })));
  
  const inProgressWithMachine = cards.filter(c => c.status === 'in-progress' && c.machine && c.machine.includes('1200'));
  console.log('Cards in progress with machine containing "1200":', inProgressWithMachine.map(c => ({
    id: c.id,
    status: c.status,
    operation: c.operation,
    machine: c.machine,
    card_info: c.card_info
  })));
}

run();
