const { createClient } = require('@supabase/supabase-js');

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
  const { data: cards } = await supabase.from('work_cards').select('*');
  const { data: tasks } = await supabase.from('tasks').select('*');
  const { data: noms } = await supabase.from('nomenclatures').select('*');
  const { data: bomItems } = await supabase.from('bom_items').select('*');

  const orders = [
    { id: '53741df6-bd90-476b-9000-2c4bec9e9080', num: '22062026-03 (10000)' },
    { id: '227e62dc-8c6e-42a0-bee8-9ad8743169c7', num: '25062026-02 (2000)' }
  ];

  for (const o of orders) {
    console.log(`\n=================== ORDER ${o.num} ===================`);
    const oTasks = tasks.filter(t => t.order_id === o.id);
    const oTaskIds = oTasks.map(t => t.id);
    const oCards = cards.filter(c => oTaskIds.includes(c.task_id));
    
    // Find parent product BOM
    const parentId = '26a77a50-d932-4a02-a65d-b4cd608ec6ac'; // F10
    const boms = bomItems.filter(b => b.parent_id === parentId);
    
    for (const b of boms) {
      const nom = noms.find(n => n.id === b.child_id);
      if (!nom || nom.type !== 'part') continue;
      const qtyPerProduct = b.quantity_per_parent || 1;
      
      const partCards = oCards.filter(c => c.nomenclature_id === nom.id && c.operation !== 'Склад БЗ' && c.status !== 'completed');
      const partWipQty = partCards.reduce((sum, c) => {
        if (c.status === 'at-shop2-buffer') {
          return sum + Math.max(0, (Number(c.quantity) || 0) - (Number(c.used_in_shop2_qty) || 0));
        }
        return sum + (Number(c.quantity) || 0);
      }, 0);
      
      const wipSets = Math.floor(partWipQty / qtyPerProduct);
      if (wipSets > 0 || nom.name.includes('Х-3-39') || nom.name.includes('П-7-46')) {
        console.log(`  Part: ${nom.name} (${nom.code || ''})`);
        console.log(`    WIP Qty: ${partWipQty}, Qty Per Product: ${qtyPerProduct} => WIP Sets: ${wipSets}`);
      }
    }
  }
}

run();
