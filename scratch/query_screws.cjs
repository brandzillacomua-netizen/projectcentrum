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
  const reqNomId = '077e12b5-ca83-4ce2-b7dd-f8fbc7d2b3fc';
  const invNomId = '6e8ba44c-2bc6-4677-aedf-6aa281e5470a';

  console.log("Fetching Nomenclatures...");
  const { data: nom1 } = await supabase.from('nomenclatures').select('*').eq('id', reqNomId).maybeSingle();
  const { data: nom2 } = await supabase.from('nomenclatures').select('*').eq('id', invNomId).maybeSingle();
  console.log("Nom 1 (Request):", nom1);
  console.log("Nom 2 (Inventory):", nom2);

  console.log("\nFetching Inventory for both:");
  const { data: inv1 } = await supabase.from('inventory').select('*').eq('nomenclature_id', reqNomId);
  const { data: inv2 } = await supabase.from('inventory').select('*').eq('nomenclature_id', invNomId);
  console.log("Inventory for Nom 1:", inv1);
  console.log("Inventory for Nom 2:", inv2);
}

main();
