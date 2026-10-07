const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function run() {
  const code = fs.readFileSync('src/supabase.js', 'utf8');
  const urlMatch = code.match(/supabaseUrl\s*=\s*['"]([^'"]+)['"]/);
  const keyMatch = code.match(/supabaseAnonKey\s*=\s*['"]([^'"]+)['"]/);
  if(urlMatch && keyMatch) {
    const supabase = createClient(urlMatch[1], keyMatch[1]);
    
    // First, find the order ID for 261001-5
    const { data: orders } = await supabase.from('orders').select('id').eq('order_num', '261001-5');
    if (!orders || orders.length === 0) {
      console.log('Order not found');
      return;
    }
    const orderId = orders[0].id;
    
    // Get all cards for this order
    const { data: cards, error } = await supabase.from('work_cards')
      .select('id, nomenclature_id, operation, quantity, status, completed_at, created_at, card_info')
      .eq('order_id', orderId);
      
    if (error) {
      console.error(error);
      return;
    }
    
    // Group by operation
    const summary = {};
    let totalCompleted = 0;
    
    cards.forEach(c => {
      summary[c.operation] = summary[c.operation] || { count: 0, sum: 0 };
      summary[c.operation].count++;
      summary[c.operation].sum += Number(c.quantity);
      if (c.status === 'completed' && ['Пакування/СГП', 'Паквання', 'Пакування', 'Склад СГП'].includes(c.operation)) {
         totalCompleted += Number(c.quantity);
      }
    });
    
    console.log('Cards for 261001-5:', cards.length);
    console.log('Summary by operation:', summary);
    console.log('Total completed (SGP/Pack):', totalCompleted);
    
    const packCards = cards.filter(c => ['Пакування/СГП', 'Паквання', 'Пакування'].includes(c.operation));
    console.log('Pack cards:', packCards.map(c => `${c.operation} | status=${c.status} | qty=${c.quantity} | info=${c.card_info}`).slice(0, 20));
  }
}
run();
