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
  // Find all work_cards in progress or at-buffer starting with Галтовка that have future dates
  const { data: cards, error } = await supabase
    .from('work_cards')
    .select('id, started_at, completed_at, operation')
    .like('operation', 'Галтовка%');

  if (error) {
    console.error(error);
    return;
  }

  const now = new Date();

  for (const card of cards) {
    let updateNeeded = false;
    const updateObj = {};

    if (card.started_at && new Date(card.started_at) > now) {
      const oldTime = new Date(card.started_at);
      const newTime = new Date(oldTime.getTime() - 10 * 3600000); // subtract 10 hours
      updateObj.started_at = newTime.toISOString();
      updateNeeded = true;
      console.log(`Fixing started_at for card ${card.id}: ${card.started_at} -> ${updateObj.started_at}`);
    }

    if (card.completed_at && new Date(card.completed_at) > now) {
      const oldTime = new Date(card.completed_at);
      const newTime = new Date(oldTime.getTime() - 10 * 3600000); // subtract 10 hours
      updateObj.completed_at = newTime.toISOString();
      updateNeeded = true;
      console.log(`Fixing completed_at for card ${card.id}: ${card.completed_at} -> ${updateObj.completed_at}`);
    }

    if (updateNeeded) {
      await supabase.from('work_cards').update(updateObj).eq('id', card.id);
    }
  }
  console.log('Database correction finished.');
}

run();
