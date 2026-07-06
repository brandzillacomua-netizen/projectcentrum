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
  console.log("Querying ALL tasks with status in-progress or completed...");
  // Let's look for tasks that are shown in foreman module
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, order_id, status, step, machine_name, plan_snapshot')
    .neq('status', 'completed')
    .in('step', ['Розкрій', 'Підготовка'])
    .limit(20);

  if (!tasks || tasks.length === 0) {
    console.log("No active tasks found");
    return;
  }

  console.log("Tasks:");
  tasks.forEach(t => {
    const partIds = Object.keys(t.plan_snapshot || {})
      .filter(k => !k.startsWith('_') && k !== 'materialSummary' && k !== 'selectedCutters' && k !== 'consumables');
    console.log(`  ID=${t.id}, step=${t.step}, status=${t.status}, partIds=${partIds.length}`);
  });

  // Check work cards for each task
  for (const task of tasks) {
    const partIds = Object.keys(task.plan_snapshot || {})
      .filter(k => !k.startsWith('_') && k !== 'materialSummary' && k !== 'selectedCutters' && k !== 'consumables');
    
    for (const nomId of partIds) {
      const partInfo = task.plan_snapshot[nomId];
      if (!partInfo || !partInfo.sheets) continue;

      const { data: cards } = await supabase
        .from('work_cards')
        .select('id, status, operation, is_rework, card_info')
        .eq('task_id', task.id)
        .eq('nomenclature_id', nomId);

      const dbCardsCount = (cards || []).filter(c => !c.is_rework && c.operation !== 'Склад БЗ').length;
      const sheets = Number(partInfo.sheets) || 0;
      
      // Default capacity - let's estimate from snapshot
      const capacity = Number(partInfo.capacity) || 4; // guess
      const maxCards = Math.ceil(sheets / capacity);

      console.log(`\nTask ${task.id} | NomId=${nomId} | Sheets=${sheets} | DB Cards (non-rework)=${dbCardsCount} | MaxCards(cap=${capacity})=${maxCards}`);
      console.log(`  Cards:`, (cards || []).map(c => `${c.id.slice(-6)} [${c.status}] op=${c.operation} rework=${c.is_rework}`));
      
      if (dbCardsCount >= maxCards && maxCards > 0) {
        console.log("  ⚠️  BLOCKED: dbCardsCount >= maxCards. Generation would result in finalCount <= 0");
      }
    }
  }
}

main();
