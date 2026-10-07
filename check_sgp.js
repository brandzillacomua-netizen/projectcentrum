const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function run() {
  const code = fs.readFileSync('src/supabase.js', 'utf8');
  const urlMatch = code.match(/supabaseUrl\s*=\s*['"]([^'"]+)['"]/);
  const keyMatch = code.match(/supabaseAnonKey\s*=\s*['"]([^'"]+)['"]/);
  if(urlMatch && keyMatch) {
    const supabase = createClient(urlMatch[1], keyMatch[1]);
    const { data: cards, error: err1 } = await supabase.from('work_cards')
      .select('*')
      .eq('operation', 'Пакування/СГП')
      .gte('completed_at', '2026-10-06T00:00:00Z')
      .lte('completed_at', '2026-10-07T23:59:59Z');
      
    console.log('Cards to SGP on Oct 6-7:', cards?.length || 0);
    if(err1) console.error(err1);
    
    // Check receipts? SGP Receipts usually come from material_requests or work_cards
    const { data: reqs, error: err2 } = await supabase.from('material_requests')
      .select('*')
      .eq('request_type', 'sgp_receipt')
      .gte('created_at', '2026-10-06T00:00:00Z')
      .lte('created_at', '2026-10-07T23:59:59Z');
      
    console.log('SGP Receipts from material_requests on Oct 6-7:', reqs?.length || 0);
    if(err2) console.error(err2);
  }
}
run();
