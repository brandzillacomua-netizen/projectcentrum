const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://hurzutjytlcvtbvihnry.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJleHAiOjIwODExMTM0NTB9.bB4x6bWnK16L4zB36Nqg-N8i40-X10lK6e4H6737y5U');

async function testScrap() {
  const { data: nom } = await supabase.from('nomenclatures').select('*');
  let targetNom = (nom||[]).find(n => n.name === 'F415-ІП27-П-10-38' || n.code === 'F415-ІП27-П-10-38');
  console.log("Nom:", targetNom?.id);
  
  const { data: q } = await supabase.from('vkya_classification_queue_projection').select('payload, source_type, source_id').eq('is_active', true);
  console.log("Vkya q:", (q||[]).filter(x => x.payload?.nomenclature_id == targetNom?.id));
  
  const { data: r } = await supabase.from('vkya_restoration_cards').select('*').eq('nomenclature_id', targetNom?.id);
  console.log("Vkya rest:", r);
}
testScrap().catch(console.error);
