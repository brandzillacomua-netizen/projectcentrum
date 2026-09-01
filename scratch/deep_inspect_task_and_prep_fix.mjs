const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const headers = {
  'apikey': supabaseAnonKey,
  'Authorization': `Bearer ${supabaseAnonKey}`,
  'x-mes-secret': 'CentrumMES2026SecretKey_a9f8',
  'Content-Type': 'application/json'
};

const TASK_ID = '35c6045a-4da1-47d2-b73f-7d269ba1e3a3';
const REQ_ID = '2bca10d8-22c8-453a-9edd-cb04d4abc820';

const WRONG_INV_ID = 'fc8f5e59-ec11-40d5-8a27-2b318c12e450';
const TARGET_INV_ID = 'c448f726-f57a-400a-b62a-1c3b10a154d1';

const WRONG_NOM_ID = '23a5c254-1993-4775-a748-acf80d12fb81';
const TARGET_NOM_ID = '0ab28738-6385-471f-b5aa-7881dfa3cb1c';

async function apiFetch(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function run() {
  const [task] = await apiFetch(`${supabaseUrl}/rest/v1/tasks?id=eq.${TASK_ID}`);
  const snapStr = JSON.stringify(task.plan_snapshot, null, 2);
  
  console.log("=== CHECKING SNAPSHOT OCCURRENCES OF WRONG INVENTORY ID ===");
  console.log(`Contains ${WRONG_INV_ID}:`, snapStr.includes(WRONG_INV_ID));
  console.log(`Contains ${WRONG_NOM_ID}:`, snapStr.includes(WRONG_NOM_ID));

  const [req] = await apiFetch(`${supabaseUrl}/rest/v1/material_requests?id=eq.${REQ_ID}`);
  console.log("\n=== MATERIAL REQUEST TO UPDATE ===");
  console.log(JSON.stringify(req, null, 2));

  console.log("\n=== PROPOSED UPDATES ===");
  console.log("1) Update material_request", REQ_ID, "to:");
  console.log({
    nomenclature_id: TARGET_NOM_ID,
    inventory_id: TARGET_INV_ID,
    details: "ВИТРАТНІ МАТЕРІАЛИ ПІСЛЯ ЗМІНИ ВЕРСТАТА: Фреза кукурудза 3х3,175х12х38 — 291 од. [BALANCED_MACHINE_CHANGE]"
  });

  console.log("2) Update task", TASK_ID, "plan_snapshot:");
  const updatedSnapshot = JSON.parse(snapStr.replaceAll(WRONG_INV_ID, TARGET_INV_ID).replaceAll(WRONG_NOM_ID, TARGET_NOM_ID));
  console.log("Snapshot string modified successfully!");
}

run().catch(err => console.error(err));
