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
  const { data: cards, error } = await supabase.from('work_cards').select('*').limit(1);
  if (error) {
    console.error("Cards Error:", error);
    return;
  }
  console.log('Work Card Columns:', Object.keys(cards[0] || {}));

  const { data: history, error: hErr } = await supabase.from('work_card_history').select('*').limit(1);
  if (hErr) {
    console.error("History Error:", hErr);
    return;
  }
  console.log('History Columns:', Object.keys(history[0] || {}));
}

run();
