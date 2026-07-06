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

async function main() {
  // Try inserting a test work card to see the actual error
  const { data, error } = await supabase.from('work_cards').insert([{
    task_id: '0457a332-3c8a-4682-ab34-e18ca003137b',
    order_id: 'e037c400-9797-421d-9c79-3e3651f30ac7',
    nomenclature_id: 'ef976ad5-8c88-4f03-a53e-2b914f15d4ba',
    operation: 'Нова',
    machine: 'TEST',
    quantity: 1,
    estimated_time: 0,
    status: 'new',
    is_rework: false,
    card_info: 'TEST_CARD'
  }]).select();

  if (error) {
    console.error("INSERT WORK_CARD ERROR:", JSON.stringify(error, null, 2));
  } else {
    console.log("SUCCESS - inserted card:", data);
    // Cleanup - delete the test card
    if (data && data[0]) {
      await supabase.from('work_cards').delete().eq('id', data[0].id);
      console.log("Cleaned up test card");
    }
  }
}

main();
