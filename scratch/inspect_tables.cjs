const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkColumns() {
  const tables = ['material_requests', 'orders', 'purchase_requests', 'machine_calls', 'tasks'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (error) {
      console.error(`Error fetching ${t}:`, error);
    } else {
      console.log(`Table ${t} columns:`, data && data.length > 0 ? Object.keys(data[0]) : '(empty/no columns)');
      console.log(`Table ${t} first row:`, data && data.length > 0 ? data[0] : null);
    }
  }
}

checkColumns();
