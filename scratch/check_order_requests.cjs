const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read credentials from src/supabase.js
const supabaseJsPath = path.join(__dirname, '..', 'src', 'supabase.js');
const supabaseJsContent = fs.readFileSync(supabaseJsPath, 'utf8');

const urlMatch = supabaseJsContent.match(/const supabaseUrl = ['"]([^'"]+)['"]/);
const keyMatch = supabaseJsContent.match(/const supabaseAnonKey = ['"]([^'"]+)['"]/);

if (!urlMatch || !keyMatch) {
  console.error("Credentials not found in supabase.js!");
  process.exit(1);
}

const supabaseUrl = urlMatch[1];
const supabaseAnonKey = keyMatch[1];

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data: reqs, error: reqErr } = await supabase
    .from('material_requests')
    .select('*, orders(order_num)')
    .eq('status', 'issued')
    .limit(100);

  if (reqErr) {
    console.error("Requests error:", reqErr);
    return;
  }

  console.log("Active requests:");
  reqs.forEach(r => {
    const orderNum = r.orders?.order_num || '';
    if (orderNum.includes('13082026-01') || r.details?.includes('13082026-01') || r.quantity === 30) {
      console.log(`MATCH - ID: ${r.id}, OrderNum: "${orderNum}", Quantity: ${r.quantity}, Details: "${r.details}"`);
    }
  });
}

check();
