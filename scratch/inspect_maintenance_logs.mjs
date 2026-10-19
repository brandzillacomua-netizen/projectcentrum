import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

async function main() {
  await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  });

  const { data: recent, error } = await supabase
    .from('machine_maintenance_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('Error:', error);
  console.log('Recent 5 logs:', JSON.stringify(recent, null, 2));

  // Test insert with maintenance_type
  const testPayload = {
    maintenance_type: 'Торцування столу та заміна колишків',
    machine_head: null,
    spare_part: null,
    notes: 'test'
  };
  
  if (recent && recent[0]) {
    const testUpdate = await supabase
      .from('machine_maintenance_logs')
      .update(testPayload)
      .eq('id', recent[0].id);
    console.log('Test update error:', testUpdate.error);
  }
}

main();
