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
  const { data: existingCards } = await supabase.from('work_cards').select('nomenclature_id').limit(1);
  const nomId = existingCards[0].nomenclature_id;
  const localIso = new Date().toISOString();
  console.log('Inserting local ISO timestamp:', localIso);
  const { data, error } = await supabase.from('work_cards').insert([{
    nomenclature_id: nomId,
    status: 'new',
    operation: 'Test',
    started_at: localIso,
    card_info: 'test_timestamp'
  }]).select();
  
  if (error) {
    console.error(error);
  } else {
    console.log('Inserted card in DB:', data[0]);
    // Clean up
    await supabase.from('work_cards').delete().eq('id', data[0].id);
  }
}

run();
