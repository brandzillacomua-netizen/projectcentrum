const { createClient } = require('@supabase/supabase-js');

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(url, key);

async function inspectColumns() {
  await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  });

  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .limit(1);

  if (data && data[0]) {
    console.log('Inventory table columns and types:');
    for (const [k, v] of Object.entries(data[0])) {
      console.log(`  ${k}: ${typeof v} (example value: ${JSON.stringify(v)})`);
    }
  }
}

inspectColumns();
