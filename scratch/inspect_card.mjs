import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

async function main() {
  await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  });

  const cardId = 'a1e99966-7be8-47a3-a803-30e22f2424fd';

  // 1. Check card details
  const { data: card, error: cardErr } = await supabase
    .from('work_cards')
    .select('*')
    .eq('id', cardId)
    .single();

  console.log('--- Card 1 ---', cardErr || card);

  // 2. Check all cards for this task
  if (card?.task_id) {
    const { data: taskCards } = await supabase
      .from('work_cards')
      .select('id, card_info, status, operation, quantity')
      .eq('task_id', card.task_id);
    console.log('--- Task Cards ---', taskCards);
  }

  // 3. Check receipts via exec_sql
  const { data: receipts, error: receiptsErr } = await supabase.rpc('exec_sql', {
    sql: `SELECT card_id, consumption_key, inventory_id, payload, result, consumed_at 
          FROM mes_private.cutting_consumption_receipts 
          WHERE card_id = '${cardId}';`
  });
  console.log('--- Receipts for card ---', receiptsErr || receipts);
}

main();
