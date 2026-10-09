const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://hurzutjytlcvtbvihnry.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJleHAiOjIwODExMTM0NTB9.bB4x6bWnK16L4zB36Nqg-N8i40-X10lK6e4H6737y5U');

async function testScrap() {
  const { data: nom } = await supabase.from('nomenclatures').select('id, name, code').ilike('name', '%П-10-38%');
  console.log("Nom:", nom);
}
testScrap().catch(console.error);
