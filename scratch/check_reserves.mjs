const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const headers = {
  'apikey': supabaseAnonKey,
  'Authorization': `Bearer ${supabaseAnonKey}`,
  'x-mes-secret': 'CentrumMES2026SecretKey_a9f8',
  'Content-Type': 'application/json'
};

const TASK_ID = '35c6045a-4da1-47d2-b73f-7d269ba1e3a3';
const ORDER_ID = '2c4f89bf-293d-4f5f-9ddc-5aedf692ff52';
const WRONG_NOM_ID = '23a5c254-1993-4775-a748-acf80d12fb81'; // Фреза чотирьохпера 3х3х12х75

async function apiFetch(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  return res.json();
}

async function run() {
  console.log("=== CHECKING MATERIAL RESERVES & INVENTORY RESERVED QTY ===");

  // 1. Check material_reserves table if it exists
  const reserves = await apiFetch(`${supabaseUrl}/rest/v1/material_reserves?select=*`);
  if (reserves) {
    console.log(`Found ${reserves.length} material_reserves records.`);
    const matchingRes = reserves.filter(r => JSON.stringify(r).includes(TASK_ID) || JSON.stringify(r).includes(ORDER_ID) || JSON.stringify(r).includes(WRONG_NOM_ID));
    console.log("Matching material_reserves:", JSON.stringify(matchingRes, null, 2));
  } else {
    console.log("Table material_reserves does not exist or failed to fetch.");
  }

  // 2. Check inventory table reserved_qty for wrong cutter and target cutter
  const invWrong = await apiFetch(`${supabaseUrl}/rest/v1/inventory?nomenclature_id=eq.${WRONG_NOM_ID}`);
  console.log("\nWRONG CUTTER INVENTORY ITEMS:");
  for (const item of invWrong || []) {
    console.log(`ID: ${item.id} | Name: ${item.name} | total_qty: ${item.total_qty} | reserved_qty: ${item.reserved_qty} | warehouse: ${item.warehouse} | owner: ${item.pocket_owner}`);
  }

  const TARGET_NOM_ID = '0ab28738-6385-471f-b5aa-7881dfa3cb1c';
  const invTarget = await apiFetch(`${supabaseUrl}/rest/v1/inventory?nomenclature_id=eq.${TARGET_NOM_ID}`);
  console.log("\nTARGET CUTTER INVENTORY ITEMS:");
  for (const item of invTarget || []) {
    console.log(`ID: ${item.id} | Name: ${item.name} | total_qty: ${item.total_qty} | reserved_qty: ${item.reserved_qty} | warehouse: ${item.warehouse} | owner: ${item.pocket_owner}`);
  }
}

run().catch(err => console.error(err));
