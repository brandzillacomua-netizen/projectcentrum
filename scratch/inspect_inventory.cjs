const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: inv, error } = await supabase.from('inventory').select('*');
  if (error) {
    console.error('Error fetching inventory:', error);
    return;
  }
  
  console.log(`Total inventory records: ${inv.length}`);
  const types = {};
  inv.forEach(i => {
    types[i.type] = (types[i.type] || 0) + 1;
  });
  console.log('Inventory types and counts:', types);
  
  console.log('\nSample records:');
  console.log(inv.slice(0, 10));
}

run();
