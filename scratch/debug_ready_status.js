import { createClient } from '@supabase/supabase-js';
const s = createClient('https://hurzutjytlcvtbvihnry.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI',{global:{headers:{'x-mes-secret':'CentrumMES2026SecretKey_a9f8'}}});

async function checkOrder(orderNum) {
  const { data: o } = await s.from('orders').select('id').eq('order_num', orderNum).single();
  const { data: tasks } = await s.from('tasks').select('id,step,status').eq('order_id', o.id);
  console.log(`\n=== ${orderNum} ===`);
  for (const t of tasks) {
    const { data: cards } = await s.from('work_cards').select('status,quantity').eq('task_id', t.id);
    const byStatus = {};
    cards?.forEach(c => { byStatus[c.status] = (byStatus[c.status]||0) + 1; });
    const isShop2 = t.step?.includes('Пресування') || t.step?.includes('ЦЕХ №2') || t.step?.includes('Доопрацювання');
    const notDone = cards?.filter(c => c.status !== 'completed') || [];
    console.log(`[${t.status}] ${t.step} ${isShop2 ? '← ЦЕХ 2' : ''}`);
    console.log(`  Картки: ${JSON.stringify(byStatus)}`);
    if (isShop2 && notDone.length > 0) console.log(`  ⚠️ Shop2 незавершені: ${notDone.length}`);
    if (isShop2 && notDone.length === 0 && cards?.length > 0) console.log(`  ✅ Shop2 всі завершені`);
    if (isShop2 && cards?.length === 0) console.log(`  ⚠️ Shop2 карток немає взагалі`);
  }
}

await checkOrder('24062026-01');
await checkOrder('25062026-01');
