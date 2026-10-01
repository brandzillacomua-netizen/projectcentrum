const { createClient } = require('@supabase/supabase-js');

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(url, key);

async function inspectCards() {
  await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  });

  const taskId = 'aeee6441-e6e4-4112-b570-5bb173107910';

  const { data: cards } = await supabase
    .from('work_cards')
    .select('*')
    .eq('task_id', taskId);

  console.log(`=== ALL WORK CARDS FOR TASK ${taskId} (${cards?.length || 0} cards) ===`);
  cards?.forEach(c => {
    console.log(`ID: ${c.id} | NomId: ${c.nomenclature_id} | Op: ${c.operation} | Qty: ${c.quantity} | Status: ${c.status} | Info: ${c.card_info}`);
  });
}

inspectCards();
