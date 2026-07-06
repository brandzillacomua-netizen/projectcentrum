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
  const taskId = '0f224b77-fda4-4ffe-b8dd-ed9fb5436077';
  const nomId = 'b77e0883-0af2-40a4-a834-a1e47b6570da';

  // Get task info
  const { data: task } = await supabase.from('tasks').select('*').eq('id', taskId).single();
  console.log("Task status:", task.status);
  console.log("Plan snapshot entry for nom:", JSON.stringify(task.plan_snapshot?.[nomId]));
  
  // Get material requests for this task
  const { data: reqs } = await supabase.from('material_requests').select('*').eq('task_id', taskId);
  console.log("\nMaterial requests:", reqs?.length);
  reqs?.forEach(r => {
    console.log(`  [${r.status}] qty=${r.quantity} details=${r.details?.substring(0, 80)}`);
  });

  // Check for sheet requests that might be kitting requirements
  const sheetReqs = (reqs || []).filter(r => {
    const details = (r.details || '').toLowerCase();
    return details.includes('лист') || details.includes('sheet');
  });
  console.log("\nSheet requests that could be kitting blocks:", sheetReqs.length);
  sheetReqs.forEach(r => {
    console.log(`  [${r.status}] qty=${r.quantity} details=${r.details?.substring(0, 80)}`);
  });
  
  const issuedSheets = sheetReqs.filter(r => r.status === 'issued' || r.status === 'completed').length;
  const pendingSheets = sheetReqs.filter(r => r.status === 'pending').length;
  console.log(`\nissuedSheets=${issuedSheets} pendingSheets=${pendingSheets} hasKittingReqs=${sheetReqs.length > 0}`);
  
  if (sheetReqs.length > 0 && issuedSheets === 0) {
    console.log("\n🔴 KITTING BLOCKED: there are sheet requests but none are issued!");
    console.log("This means the button shows 'НЕМАЄ ЛИСТІВ' or generation is blocked.");
  }
}

main();
