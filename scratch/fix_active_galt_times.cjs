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
  console.log('Fetching active cards and history with future timestamps...');
  
  // Fetch active cards
  const { data: cards, error: cardsError } = await supabase.from('work_cards')
    .select('id, started_at, completed_at, operation')
    .eq('status', 'in-progress');

  if (cardsError) {
    console.error(cardsError);
    return;
  }

  const now = new Date();
  
  for (const card of cards) {
    let needsUpdate = false;
    const updatePayload = {};

    if (card.started_at && new Date(card.started_at) > now) {
      const originalStart = new Date(card.started_at);
      originalStart.setHours(originalStart.getHours() - 10);
      updatePayload.started_at = originalStart.toISOString();
      needsUpdate = true;
      console.log(`Card ${card.id}: Correcting started_at from ${card.started_at} to ${updatePayload.started_at}`);
    }

    if (card.completed_at && new Date(card.completed_at) > now) {
      const originalCompleted = new Date(card.completed_at);
      originalCompleted.setHours(originalCompleted.getHours() - 10);
      updatePayload.completed_at = originalCompleted.toISOString();
      needsUpdate = true;
      console.log(`Card ${card.id}: Correcting completed_at from ${card.completed_at} to ${updatePayload.completed_at}`);
    }

    if (needsUpdate) {
      const { error } = await supabase.from('work_cards')
        .update(updatePayload)
        .eq('id', card.id);
      if (error) {
        console.error(`Failed to update card ${card.id}:`, error);
      } else {
        console.log(`Successfully updated card ${card.id}`);
      }
    }
  }

  // Fetch history records with future timestamps
  const { data: history, error: historyError } = await supabase.from('work_card_history')
    .select('id, started_at, completed_at, stage_name')
    .or(`started_at.gt.${now.toISOString()},completed_at.gt.${now.toISOString()}`);

  if (historyError) {
    console.error(historyError);
    return;
  }

  for (const h of history) {
    let needsUpdate = false;
    const updatePayload = {};

    if (h.started_at && new Date(h.started_at) > now) {
      const originalStart = new Date(h.started_at);
      originalStart.setHours(originalStart.getHours() - 10);
      updatePayload.started_at = originalStart.toISOString();
      needsUpdate = true;
    }

    if (h.completed_at && new Date(h.completed_at) > now) {
      const originalCompleted = new Date(h.completed_at);
      originalCompleted.setHours(originalCompleted.getHours() - 10);
      updatePayload.completed_at = originalCompleted.toISOString();
      needsUpdate = true;
    }

    if (needsUpdate) {
      console.log(`History ${h.id} (${h.stage_name}): started_at: ${h.started_at} -> ${updatePayload.started_at || h.started_at}, completed_at: ${h.completed_at} -> ${updatePayload.completed_at || h.completed_at}`);
      const { error } = await supabase.from('work_card_history')
        .update(updatePayload)
        .eq('id', h.id);
      if (error) {
        console.error(`Failed to update history ${h.id}:`, error);
      }
    }
  }

  console.log('Cleanup finished!');
}

run();
