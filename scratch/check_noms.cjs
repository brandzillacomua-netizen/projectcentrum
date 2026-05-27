const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkNoms() {
  const { data, error } = await supabase.from('nomenclatures').select('*');
  if (error) {
    console.error(error);
    return;
  }
  console.log(`Fetched ${data.length} nomenclatures`);
  data.forEach(n => {
    console.log(`ID: ${n.id} | Name: "${n.name}" | Code: "${n.nomenclature_code}" | Type: "${n.type}" | Material: "${n.material_type}"`);
  });
}

checkNoms();
