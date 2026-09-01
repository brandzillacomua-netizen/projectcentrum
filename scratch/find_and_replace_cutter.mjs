const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const headers = {
  'apikey': supabaseAnonKey,
  'Authorization': `Bearer ${supabaseAnonKey}`,
  'x-mes-secret': 'CentrumMES2026SecretKey_a9f8',
  'Content-Type': 'application/json'
};

const WRONG_NOM_ID = '23a5c254-1993-4775-a748-acf80d12fb81'; // Фреза чотирьохпера 3х3х12х75
const TARGET_NOM_ID = '0ab28738-6385-471f-b5aa-7881dfa3cb1c'; // Фреза кукурудза 3х3,175х12х38

async function apiFetchAll(table) {
  let allRows = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const rangeHeader = { ...headers, 'Range': `${page * pageSize}-${(page + 1) * pageSize - 1}` };
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*`, { headers: rangeHeader });
    if (!res.ok) throw new Error(`HTTP error ${res.status} fetching ${table}`);
    const rows = await res.json();
    allRows = allRows.concat(rows);
    if (rows.length < pageSize) break;
    page++;
  }
  return allRows;
}

async function run() {
  console.log("=== SEARCHING TASKS WITH WRONG NOM OR NARYAD 260827-2 ===");

  const tasks = await apiFetchAll('tasks');
  console.log(`Fetched ${tasks.length} total tasks.`);

  const matchedTasks = [];
  for (const t of tasks) {
    const s = JSON.stringify(t);
    if (s.includes('260827-2') || s.includes(WRONG_NOM_ID) || s.includes('Фреза чотирьохпера 3х3х12х75') || s.includes('Фреза чотирьохпера 3x3x12x75')) {
      matchedTasks.push(t);
    }
  }

  console.log(`\nFound ${matchedTasks.length} tasks containing wrong cutter ID/name or 260827-2:`);
  for (const t of matchedTasks) {
    console.log("\n------------------------------------------------");
    console.log("TASK ID:", t.id);
    console.log("TITLE / NAME:", t.title || t.task_name || t.name);
    console.log("ORDER ID:", t.order_id);
    console.log("MACHINE:", t.machine_name || t.machine_id);
    console.log("PLAN_SNAPSHOT:", JSON.stringify(t.plan_snapshot, null, 2));
    console.log("WAREHOUSE_CONF:", JSON.stringify(t.warehouse_conf, null, 2));
    console.log("SELECTED_CUTTERS / CUTTERS:", t.selected_cutters, t.cutters);
  }

  console.log("\n=== SEARCHING MATERIAL_REQUESTS FOR WRONG NOM OR 260827-2 ===");
  const reqs = await apiFetchAll('material_requests');
  console.log(`Fetched ${reqs.length} total material_requests.`);

  const matchedReqs = [];
  for (const r of reqs) {
    const s = JSON.stringify(r);
    if (s.includes('260827-2') || s.includes(WRONG_NOM_ID) || r.nomenclature_id === WRONG_NOM_ID) {
      matchedReqs.push(r);
    }
  }

  console.log(`\nFound ${matchedReqs.length} material_requests matching:`);
  for (const r of matchedReqs) {
    console.log("\nREQ ID:", r.id);
    console.log("TASK ID:", r.task_id);
    console.log("ORDER ID:", r.order_id);
    console.log("NOMENCLATURE ID:", r.nomenclature_id);
    console.log("STATUS:", r.status);
    console.log("QUANTITY:", r.quantity);
    console.log("FULL REQ:", JSON.stringify(r, null, 2));
  }
}

run().catch(err => console.error(err));
