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

async function inspect() {
  const { data, error } = await supabase.from('nomenclatures').select('*').limit(5);
  if (error) {
    console.error("Error:", error);
    return;
  }
  console.log("Nomenclature records count:", data.length);
  if (data.length > 0) {
    console.log("Nomenclature columns:", Object.keys(data[0]));
    console.log("First record:", data[0]);
  } else {
    console.log("Table is empty.");
  }
}

inspect();
