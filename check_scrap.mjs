import { createClient } from '@supabase/supabase-js';

// The anon key has permissive RLS for select
const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkScrap() {
  const { data: orders } = await supabase.from('orders').select('id, order_num').ilike('order_num', '%261001%');
  if (!orders || orders.length === 0) return console.log('Order not found');
  const orderId = orders[0].id;
  console.log('Found order:', orders[0].order_num);

  const { data: tasks } = await supabase.from('tasks').select('id, step').eq('order_id', orderId);
  const taskIds = tasks.map(t => t.id);

  const { data: noms } = await supabase.from('nomenclatures').select('id, name, code').ilike('name', '%F415-ІП27-П-10-38%');
  if (!noms || noms.length === 0) return console.log('Nomenclature not found');
  const nomId = noms[0].id;

  console.log(`Order: ${orders[0].order_num} | Nomenclature: ${noms[0].name}`);

  // Get history
  const { data: history } = await supabase.from('work_card_history')
    .select('id, card_id, stage_name, operator_name, scrap_qty, qty_completed, created_at, qc_scrap_reason')
    .eq('nomenclature_id', nomId)
    .in('task_id', taskIds);
    
  if (!history || history.length === 0) {
    console.log('No history found for this nomenclature in this order.');
  }

  const scrapEvents = history.filter(h => Number(h.scrap_qty) > 0);
  
  if (scrapEvents.length === 0) {
    console.log('No scrap events recorded.');
  } else {
    console.log(`\nFound ${scrapEvents.length} scrap event(s):`);
    
    // Group by card to show deduplication
    const scrapByCard = {};
    for (const h of scrapEvents) {
      const qty = Number(h.scrap_qty) || 0;
      console.log(`- Card ${h.card_id.slice(0,8)} | Stage: ${h.stage_name} | Scrap: ${qty} | Reason: ${h.qc_scrap_reason || 'N/A'} | Date: ${new Date(h.created_at).toLocaleString()}`);
      if (!scrapByCard[h.card_id]) scrapByCard[h.card_id] = 0;
      scrapByCard[h.card_id] = Math.max(scrapByCard[h.card_id], qty);
    }
    
    let totalDeduplicated = 0;
    Object.values(scrapByCard).forEach(v => totalDeduplicated += v);
    
    let rawSum = 0;
    scrapEvents.forEach(h => rawSum += Number(h.scrap_qty));
    
    console.log(`\nRaw sum of all history rows (The bugged calculation): ${rawSum}`);
    console.log(`True physical scrap (Max per card): ${totalDeduplicated}`);
  }
}

checkScrap();
