const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkInventory() {
  const { data, error } = await supabase.from('inventory').select('*').eq('nomenclature_id', 'c5f695ec-77a3-483e-ad29-efbf48668771');
  if (error) {
    console.error(error);
    return;
  }
  console.log(`Inventory records for Киев К, ИП14, Р7-П-6-78:`);
  console.log(JSON.stringify(data, null, 2));
}

checkInventory();
