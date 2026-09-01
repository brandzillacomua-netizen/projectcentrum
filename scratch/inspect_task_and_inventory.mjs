const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const headers = {
  'apikey': supabaseAnonKey,
  'Authorization': `Bearer ${supabaseAnonKey}`,
  'x-mes-secret': 'CentrumMES2026SecretKey_a9f8',
  'Content-Type': 'application/json'
};

const TASK_ID = '35c6045a-4da1-47d2-b73f-7d269ba1e3a3';
const WRONG_NOM_ID = '23a5c254-1993-4775-a748-acf80d12fb81'; // Фреза чотирьохпера 3х3х12х75
const TARGET_NOM_ID = '0ab28738-6385-471f-b5aa-7881dfa3cb1c'; // Фреза кукурудза 3х3,175х12х38

async function apiFetch(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function run() {
  console.log("=== INSPECTING TASK 35c6045a-4da1-47d2-b73f-7d269ba1e3a3 ===");
  const [task] = await apiFetch(`${supabaseUrl}/rest/v1/tasks?id=eq.${TASK_ID}`);
  console.log("TASK BASIC INFO:", {
    id: task.id,
    title: task.title,
    task_name: task.task_name,
    order_id: task.order_id,
    machine_name: task.machine_name,
    warehouse_conf: task.warehouse_conf
  });

  console.log("\nPLAN SNAPSHOT KEYS:", Object.keys(task.plan_snapshot || {}));

  // Find where selected_cutters or cutters are stored in plan_snapshot
  for (const [key, val] of Object.entries(task.plan_snapshot || {})) {
    if (typeof val === 'object' && val !== null) {
      if (val.selected_cutters || val.cutters || JSON.stringify(val).includes(WRONG_NOM_ID) || JSON.stringify(val).includes('fc8f5e59')) {
        console.log(`\nEntry [${key}] (${val.name}):`);
        console.log("selected_cutters:", val.selected_cutters);
      }
    }
  }

  console.log("\n=== ALL MATERIAL REQUESTS FOR TASK ===");
  const reqs = await apiFetch(`${supabaseUrl}/rest/v1/material_requests?task_id=eq.${TASK_ID}`);
  console.log(`Found ${reqs.length} material requests for task:`);
  for (const r of reqs) {
    console.log(`- REQ [${r.id}]: nom_id=${r.nomenclature_id}, inv_id=${r.inventory_id}, qty=${r.quantity}, status=${r.status}`);
    console.log(`  details: "${r.details}"`);
  }

  console.log("\n=== INVENTORY RECORDS FOR BOTH CUTTERS ===");
  const invWrong = await apiFetch(`${supabaseUrl}/rest/v1/inventory?nomenclature_id=eq.${WRONG_NOM_ID}`);
  console.log("WRONG CUTTER INVENTORY:", JSON.stringify(invWrong, null, 2));

  const invTarget = await apiFetch(`${supabaseUrl}/rest/v1/inventory?nomenclature_id=eq.${TARGET_NOM_ID}`);
  console.log("TARGET CUTTER INVENTORY:", JSON.stringify(invTarget, null, 2));
}

run().catch(err => console.error(err));
