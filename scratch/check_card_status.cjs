const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
});

async function run() {
  const now = new Date();
  console.log('=== Browser/Node "now" ===', now.toISOString());

  const { data: cards, error } = await supabase.from('work_cards').select('*');
  if (error) { console.error(error); return; }

  const activeCards = cards.filter(c => c.status === 'in-progress' || c.status === 'at-buffer');
  console.log('\n=== Active cards (%d) ===', activeCards.length);

  activeCards.forEach(c => {
    const startedAt = c.started_at ? new Date(c.started_at) : null;
    const completedAt = c.completed_at ? new Date(c.completed_at) : null;
    const diffStartedSec = startedAt ? Math.floor((now - startedAt) / 1000) : null;
    const diffCompletedSec = completedAt ? Math.floor((now - completedAt) / 1000) : null;

    console.log({
      id: c.id?.slice(-8),
      status: c.status,
      operation: c.operation,
      operator: c.operator_name,
      started_at: c.started_at,
      completed_at: c.completed_at,
      diff_started_sec: diffStartedSec,   // negative = started_at is in the FUTURE
      diff_completed_sec: diffCompletedSec,
      card_info_snippet: (c.card_info || '').slice(0, 80)
    });
  });
}

run();
