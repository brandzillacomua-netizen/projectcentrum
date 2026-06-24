import { createClient } from '@supabase/supabase-js';

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
  console.log('Fetching history records with future completed_at...');
  const { data: history, error: herr } = await supabase.from('work_card_history').select('*');
  if (herr) throw herr;
  
  const now = new Date();
  const futureHist = history.filter(r => r.completed_at && new Date(r.completed_at) > now);
  console.log(`Found ${futureHist.length} history records in the future.`);
  
  for (const r of futureHist) {
    // Set completed_at to created_at
    const newCompleted = r.created_at;
    
    // Set started_at to either started_at (if not in future) or newCompleted minus duration
    let newStarted = r.started_at;
    if (r.started_at && new Date(r.started_at) > now) {
      const origDuration = new Date(r.completed_at).getTime() - new Date(r.started_at).getTime();
      const newDuration = Math.max(0, Math.min(origDuration, 4 * 3600 * 1000)); // cap at 4 hours if something went wild
      newStarted = new Date(new Date(newCompleted).getTime() - newDuration).toISOString();
    }
    
    console.log(`Updating history ${r.id}: completed_at ${r.completed_at} -> ${newCompleted}, started_at ${r.started_at} -> ${newStarted}`);
    const { error: uerr } = await supabase.from('work_card_history').update({
      completed_at: newCompleted,
      started_at: newStarted
    }).eq('id', r.id);
    if (uerr) console.error('Failed to update history row:', uerr);
  }

  console.log('Fetching active work cards with future completed_at or started_at...');
  const { data: cards, error: cerr } = await supabase.from('work_cards').select('*');
  if (cerr) throw cerr;

  const futureCards = cards.filter(c => (c.completed_at && new Date(c.completed_at) > now) || (c.started_at && new Date(c.started_at) > now));
  console.log(`Found ${futureCards.length} work cards in the future.`);
  
  for (const c of futureCards) {
    const createdTime = c.created_at || now.toISOString();
    let newCompleted = c.completed_at;
    if (c.completed_at && new Date(c.completed_at) > now) {
      newCompleted = createdTime;
    }
    let newStarted = c.started_at;
    if (c.started_at && new Date(c.started_at) > now) {
      if (newCompleted) {
        newStarted = new Date(new Date(newCompleted).getTime() - 30 * 60 * 1000).toISOString(); // 30 mins before completion
      } else {
        newStarted = createdTime;
      }
    }
    console.log(`Updating card ${c.id}: completed_at ${c.completed_at} -> ${newCompleted}, started_at ${c.started_at} -> ${newStarted}`);
    const { error: uerr } = await supabase.from('work_cards').update({
      completed_at: newCompleted,
      started_at: newStarted
    }).eq('id', c.id);
    if (uerr) console.error('Failed to update card row:', uerr);
  }

  console.log('Database correction finished!');
}

run().catch(console.error);
