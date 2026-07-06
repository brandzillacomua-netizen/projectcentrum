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
  const specNomId = '077e12b5-ca83-4ce2-b7dd-f8fbc7d2b3fc'; // Гвинт М3x35 (BOM / spec)
  const wrongInvId = 'a87dc390-1abd-4327-8971-e9701174e775'; // 12000 qty operational

  console.log("Checking the current inventory item details...");
  const { data: currentInv } = await supabase.from('inventory').select('*').eq('id', wrongInvId).single();
  console.log("Current item:", currentInv);

  if (currentInv) {
    console.log(`Re-assigning inventory item ${wrongInvId} to correct nomenclature ${specNomId} and moving to finished products type...`);
    
    const { data: updated, error } = await supabase.from('inventory')
      .update({
        nomenclature_id: specNomId,
        name: 'Гвинт М3x35 (M3×35 ISO 7380‑1 (BH) 10.9)',
        type: 'finished', // This will display it on the "Готова продукція / СГП" tab
        updated_at: new Date().toISOString()
      })
      .eq('id', wrongInvId)
      .select();

    if (error) {
      console.error("Error updating database:", error);
    } else {
      console.log("Updated inventory item:", updated);
    }
  }
}

main();
