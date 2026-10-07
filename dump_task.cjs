const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function run() {
  const env = fs.readFileSync('.env', 'utf8');
  const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: '9eFAZQ6yaDjA-kwRp7dKkg!A9z'
  });

  if (authError) {
    console.error('Auth error:', authError.message);
    return;
  }

  const { data: task } = await supabase.from('tasks').select('*').eq('id', 'aeee6441-e6e4-4112-b570-5bb173107910').single();
  const { data: cards } = await supabase.from('work_cards').select('id, nomenclature_id, card_info, quantity, status, operation, actual_sheets').eq('task_id', 'aeee6441-e6e4-4112-b570-5bb173107910');
  const { data: history } = await supabase.from('work_card_history').select('id, card_id, scrap_qty, qty_at_start').eq('task_id', 'aeee6441-e6e4-4112-b570-5bb173107910');

  fs.writeFileSync('task_data.json', JSON.stringify({ task, cards, history }, null, 2));
  console.log('Saved to task_data.json');
}
run();
