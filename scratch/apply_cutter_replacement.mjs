const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const headers = {
  'apikey': supabaseAnonKey,
  'Authorization': `Bearer ${supabaseAnonKey}`,
  'x-mes-secret': 'CentrumMES2026SecretKey_a9f8',
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

const TASK_ID = '35c6045a-4da1-47d2-b73f-7d269ba1e3a3';
const REQ_ID = '2bca10d8-22c8-453a-9edd-cb04d4abc820';

const WRONG_INV_ID = 'fc8f5e59-ec11-40d5-8a27-2b318c12e450';
const TARGET_INV_ID = 'c448f726-f57a-400a-b62a-1c3b10a154d1';

const TARGET_NOM_ID = '0ab28738-6385-471f-b5aa-7881dfa3cb1c'; // Фреза кукурудза 3х3,175х12х38

async function run() {
  console.log("=== EXECUTING CUTTER REPLACEMENT IN SUPABASE ===");

  // 1. Update Material Request
  console.log(`Updating material_requests table for ID ${REQ_ID}...`);
  const reqUpdateBody = {
    nomenclature_id: TARGET_NOM_ID,
    inventory_id: TARGET_INV_ID,
    details: "ВИТРАТНІ МАТЕРІАЛИ ПІСЛЯ ЗМІНИ ВЕРСТАТА: Фреза кукурудза 3х3,175х12х38 — 291 од. [BALANCED_MACHINE_CHANGE]"
  };

  const reqRes = await fetch(`${supabaseUrl}/rest/v1/material_requests?id=eq.${REQ_ID}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(reqUpdateBody)
  });

  if (!reqRes.ok) {
    throw new Error(`Failed to update material request: ${reqRes.statusText} - ${await reqRes.text()}`);
  }
  const reqData = await reqRes.json();
  console.log("Material Request Updated Successfully:", reqData);

  // 2. Fetch Task and update plan_snapshot
  console.log(`Fetching task ${TASK_ID}...`);
  const tRes = await fetch(`${supabaseUrl}/rest/v1/tasks?id=eq.${TASK_ID}`, { headers });
  const [task] = await tRes.json();

  const snapStr = JSON.stringify(task.plan_snapshot);
  const newSnapStr = snapStr.replaceAll(WRONG_INV_ID, TARGET_INV_ID);
  const newPlanSnapshot = JSON.parse(newSnapStr);

  console.log(`Updating tasks table plan_snapshot for ID ${TASK_ID}...`);
  const taskRes = await fetch(`${supabaseUrl}/rest/v1/tasks?id=eq.${TASK_ID}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ plan_snapshot: newPlanSnapshot })
  });

  if (!taskRes.ok) {
    throw new Error(`Failed to update task: ${taskRes.statusText} - ${await taskRes.text()}`);
  }
  const taskData = await taskRes.json();
  console.log("Task plan_snapshot Updated Successfully!");

  console.log("=== ALL UPDATES COMPLETED SUCCESSFULLY ===");
}

run().catch(err => console.error("EXECUTION ERROR:", err));
