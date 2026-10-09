import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCards() {
  const { data: orders } = await supabase.from('orders').select('*');
  const order = orders.find(o => (o.order_number || '').includes('261001-5'));
  if (!order) return console.log('Order not found');

  const { data: tasks } = await supabase.from('tasks').select('*').eq('order_id', order.id);
  const taskIds = tasks.map(t => t.id);

  const { data: cards } = await supabase.from('work_cards')
    .select('id, nomenclature_id, quantity, status, operation, task_id, card_info, used_in_shop2_qty, step')
    .in('task_id', taskIds);
  
  const { data: noms } = await supabase.from('nomenclatures').select('id, name, code').in('id', [...new Set(cards.map(c => c.nomenclature_id))]);
  
  const targetNom = noms.find(n => (n.code || '').includes('90800') || (n.name || '').includes('F415-421'));
  if (!targetNom) return console.log('Target nomenclature not found among cards');
  
  const targetCards = cards.filter(c => c.nomenclature_id === targetNom.id);
  
  let totalQty = 0;
  for (const c of targetCards) {
    totalQty += Number(c.quantity) || 0;
    console.log(`Qty: ${c.quantity} | Op: "${c.operation}" | Stat: "${c.status}" | Info: "${c.card_info}" | ID: ${c.id}`);
  }
  console.log(`\nGrand Total: ${totalQty}`);
}

checkCards();
