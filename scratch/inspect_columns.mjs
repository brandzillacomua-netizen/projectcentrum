import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

async function main() {
  await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  });

  const { data: recent } = await supabase
    .from('machine_maintenance_logs')
    .select('*')
    .limit(1);

  console.log('Existing columns in sample row:', Object.keys(recent[0]));

  const candidateColumns = [
    'maintenance_type',
    'notes',
    'comment',
    'description',
    'spare_part',
    'machine_head',
    'type',
    'reason',
    'work_type',
    'details',
    'metadata'
  ];

  for (const col of candidateColumns) {
    const res = await supabase
      .from('machine_maintenance_logs')
      .select(col)
      .limit(1);
    if (!res.error) {
      console.log(`Column "${col}" EXISTS!`);
    } else {
      console.log(`Column "${col}" DOES NOT EXIST (${res.error.message})`);
    }
  }
}

main();
