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

async function main() {
  // Get ALL active Розкрій tasks that have 0 work cards
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, order_id, status, step, machine_name, plan_snapshot')
    .eq('step', 'Розкрій')
    .neq('status', 'completed');

  for (const task of tasks || []) {
    const { data: cards } = await supabase
      .from('work_cards')
      .select('id, nomenclature_id, status, operation, is_rework')
      .eq('task_id', task.id);

    const partIds = Object.keys(task.plan_snapshot || {})
      .filter(k => !k.startsWith('_') && k !== 'materialSummary' && k !== 'selectedCutters' && k !== 'consumables');

    for (const nomId of partIds) {
      const partInfo = task.plan_snapshot[nomId];
      if (!partInfo || (Number(partInfo.sheets) || 0) <= 0) continue;

      const nomCards = (cards || []).filter(c => c.nomenclature_id === nomId && !c.is_rework && c.operation !== 'Склад БЗ');
      
      if (nomCards.length === 0) {
        const splits = partInfo.splits || [];
        console.log(`\n🔴 TASK ${task.id} | Nom=${nomId} | sheets=${partInfo.sheets} | machine=${partInfo.machine || partInfo.selected_machine}`);
        console.log(`   NO CARDS GENERATED! splits count=${splits.length}`);
        if (splits.length > 0) {
          console.log('   Splits:', JSON.stringify(splits));
        }
        console.log('   plan_snapshot entry:', JSON.stringify({ sheets: partInfo.sheets, plan: partInfo.plan, need: partInfo.need, machine: partInfo.machine, selected_machine: partInfo.selected_machine }));
        
        // try inserting a test card for this task
        const testInsert = await supabase.from('work_cards').insert([{
          task_id: task.id,
          order_id: task.order_id,
          nomenclature_id: nomId,
          operation: 'Розкрій',
          machine: partInfo.machine || 'TEST',
          quantity: 1,
          estimated_time: 0,
          status: 'new',
          is_rework: false,
          card_info: 'DEBUG_TEST'
        }]).select();
        
        if (testInsert.error) {
          console.log('   ❌ INSERT ERROR:', testInsert.error);
        } else {
          console.log('   ✅ INSERT OK:', testInsert.data[0]?.id);
          // cleanup
          await supabase.from('work_cards').delete().eq('id', testInsert.data[0].id);
        }
      }
    }
  }
}

main();
