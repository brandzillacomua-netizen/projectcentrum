const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
});

async function run() {
  const { data, error } = await supabase.rpc('inspect_table_columns', { table_name: 'machine_operations' });
  if (error) {
    // If RPC doesn't exist, we can use a direct SELECT or run a query using postgrest if allowed.
    // Or select all columns of the first 10 rows to see if any have other columns.
    console.log('inspect_table_columns RPC failed, selecting a wider set or trying select *');
    const { data: colsData, error: colsError } = await supabase
      .from('machine_operations')
      .select('*')
      .limit(10);
      
    if (colsError) {
      console.error(colsError);
    } else if (colsData && colsData.length > 0) {
      // Find all unique keys across all fetched rows
      const keys = new Set();
      colsData.forEach(row => Object.keys(row).forEach(k => keys.add(k)));
      console.log('All unique columns in machine_operations:', Array.from(keys));
    } else {
      console.log('No rows returned.');
    }
  } else {
    console.log('Columns from RPC:', data);
  }
}
run();
