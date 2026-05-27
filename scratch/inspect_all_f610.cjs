const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  // Let's find all nomenclatures that might be related to F610-ІП24
  const { data: noms } = await supabase
    .from('nomenclatures')
    .select('*')
    .ilike('name', '%F610%');
  
  console.log('Nomenclatures matching F610:', noms);
  
  if (noms && noms.length > 0) {
    const nomIds = noms.map(n => n.id);
    const { data: inv } = await supabase
      .from('inventory')
      .select('*')
      .in('nomenclature_id', nomIds);
    console.log('Inventory for all F610 noms:', inv);
  }
}

run();
