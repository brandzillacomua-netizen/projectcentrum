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
  console.log("Searching for Screws in inventory...");
  const { data: inv, error } = await supabase.from('inventory').select('*').ilike('name', '%гвинт%');
  if (error) {
    console.error("Error:", error);
    return;
  }
  console.log("Inventory items:", inv);

  console.log("\nSearching for requests for task #30062026-01 or order/task with screws:");
  const { data: reqs, error: reqsErr } = await supabase.from('material_requests').select('*').ilike('details', '%гвинт%').limit(10);
  if (reqsErr) {
    console.error("Error:", reqsErr);
    return;
  }
  console.log("Requests:", reqs);
}

main();
