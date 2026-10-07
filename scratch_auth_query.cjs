const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://hurzutjytlcvtbvihnry.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
);

async function run() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: '9eFAZQ6yaDjA-kwRp7dKkg!A9z'
  });
  
  if (authError) {
    console.error("Auth error:", authError);
    return;
  }
  
  // Find F415 tasks
  const { data: tasks } = await supabase.from('tasks').select('id, name').ilike('name', '%F415%').limit(10);
  console.log("Tasks found:", tasks);
  
  if (!tasks || tasks.length === 0) return;
  const taskId = tasks[0].id;
  
  // Get cards for this task
  const { data: cards, error } = await supabase.from('work_cards')
    .select('id, task_id, nomenclature_id, status, quantity, card_info')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });
    
  if (error) console.error("Cards error:", error);
  else {
    console.log(`Found ${cards.length} cards for task ${tasks[0].name}`);
    console.log("Recent cards:", JSON.stringify(cards.slice(0, 10), null, 2));
    
    // Also get history
    const { data: history } = await supabase.from('work_card_history')
      .select('id, card_id, task_id, scrap_qty')
      .eq('task_id', taskId)
      .gt('scrap_qty', 0);
    console.log(`Found ${history?.length || 0} history rows with scrap for this task`);
  }
}

run();
