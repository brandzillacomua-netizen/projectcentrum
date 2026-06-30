const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
});

async function run() {
  const { data: docs } = await supabase.from('reception_docs')
    .select('*')
    .eq('order_id', '53741df6-bd90-476b-9000-2c4bec9e9080');
    
  console.log(`Found ${docs?.length || 0} reception documents for order:`);
  docs?.forEach(d => {
    console.log(`Doc ID: ${d.id} | Status: ${d.status} | Target: ${d.target_warehouse} | Source: ${d.source_warehouse} | Items:`, d.items);
  });
}

run().catch(console.error);
