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
  const specNomId = '077e12b5-ca83-4ce2-b7dd-f8fbc7d2b3fc'; // Гвинт М3x35
  const reqId = '327af8c2-0be1-458d-ae14-ce9aeb135386'; // screw request with qty 12000

  console.log("1. Renaming Nomenclature in database...");
  const { data: updatedNom, error: errorNom } = await supabase.from('nomenclatures')
    .update({ name: 'Гвинт М3x35 (ISO 7380)' })
    .eq('id', specNomId)
    .select();

  if (errorNom) {
    console.error("Error updating nomenclature:", errorNom);
  } else {
    console.log("Updated Nomenclature:", updatedNom);
  }

  console.log("\n2. Updating Material Request details in database...");
  const { data: updatedReq, error: errorReq } = await supabase.from('material_requests')
    .update({ details: 'ЗАПИТ НА КОМПЛЕКТУВАННЯ (СГП) (30062026-01): Гвинт М3x35 (ISO 7380) — 12000 шт.' })
    .eq('id', reqId)
    .select();

  if (errorReq) {
    console.error("Error updating request:", errorReq);
  } else {
    console.log("Updated Material Request:", updatedReq);
  }
}

main();
