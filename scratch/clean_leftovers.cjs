const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const idsToClean = [
    '1173cbdc-d52a-4a57-86a0-6336e12fb64c', // ІП-72-F5-В-3-45
    '59497743-8a5f-4e43-a293-2ea86ed1c617', // ІП-72-F5-Н-3-50
    '37e7fec7-bba7-4f0a-90ed-ba70a58bcdbf'  // ІП-72-F5-Х-2-63
  ];

  console.log('Starting cleanup...');
  const { data, error } = await supabase
    .from('inventory')
    .update({ total_qty: 0 })
    .in('id', idsToClean)
    .select();

  if (error) {
    console.error('Error cleaning up:', error);
  } else {
    console.log('Cleanup completed successfully. Updated rows:', data);
  }
}

run().catch(console.error);
