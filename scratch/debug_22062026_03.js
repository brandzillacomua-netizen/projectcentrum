import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://hurzutjytlcvtbvihnry.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI', {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
});

async function main() {
  const { data: order } = await supabase.from('orders').select('id').eq('order_num', '22062026-03').single();
  
  const { data: tasks } = await supabase.from('tasks').select('id, step, status').eq('order_id', order.id);
  
  console.log('\n=== TASKS ===');
  tasks.forEach(t => console.log(`[${t.status}] ${t.step} (id: ${t.id})`));

  console.log('\n=== CARDS BY TASK ===');
  for (const t of tasks) {
    const { data: cards } = await supabase.from('work_cards').select('id, status, operation, quantity').eq('task_id', t.id);
    console.log(`\nTask: ${t.step} (${t.status})`);
    if (!cards || cards.length === 0) {
      console.log('  (no cards)');
    } else {
      const byStatus = {};
      cards.forEach(c => {
        if (!byStatus[c.status]) byStatus[c.status] = 0;
        byStatus[c.status]++;
      });
      console.log('  Card statuses:', byStatus);
      const notDone = cards.filter(c => c.status !== 'completed');
      if (notDone.length > 0) {
        console.log('  ⚠️ NON-COMPLETED cards:');
        notDone.slice(0, 5).forEach(c => console.log(`    [${c.status}] op=${c.operation} qty=${c.quantity}`));
      }
    }
  }
}

main();
