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
  const parsedName = 'Гвинт М3x35';
  const escapedParsedName = `"${parsedName.replace(/"/g, '""')}"`;
  const wildcardName = `"${parsedName.replace(/"/g, '""')}%"`;

  const orFilters = [
    `name.eq.${escapedParsedName}`,
    `name.ilike.${wildcardName}`
  ];

  console.log("Filters:", orFilters.join(','));
  const { data, error } = await supabase.from('inventory')
    .select('*')
    .or(orFilters.join(','));

  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Results count:", data.length);
    console.log("Matched items:", data.map(d => ({ name: d.name, warehouse: d.warehouse, qty: d.total_qty })));
  }
}

main();
