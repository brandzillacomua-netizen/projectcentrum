const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const headers = {
  'apikey': supabaseAnonKey,
  'Authorization': `Bearer ${supabaseAnonKey}`,
  'x-mes-secret': 'CentrumMES2026SecretKey_a9f8',
  'Content-Type': 'application/json'
};

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
  console.log("=== WRONG & TARGET CUTTERS ===");
  console.log("WRONG: 23a5c254-1993-4775-a748-acf80d12fb81 (Фреза чотирьохпера 3х3х12х75)");
  console.log("TARGET: 0ab28738-6385-471f-b5aa-7881dfa3cb1c (Фреза кукурудза 3х3,175х12х38)");

  // 1. Check tasks
  console.log("\n--- Checking TASKS ---");
  const tasks = await apiFetchAll('tasks');
  console.log(`Total tasks: ${tasks.length}`);
  const matchingTasks = tasks.filter(t => {
    const s = JSON.stringify(t);
    return s.includes('260827-2') || s.includes('260827_2') || s.includes('260827') || s.includes('К-ІП9');
  });
  console.log(`Matching tasks (${matchingTasks.length}):`);
  for (const t of matchingTasks) {
    console.log("TASK ID:", t.id, "TITLE/NAME:", t.title || t.task_name, "MACHINE:", t.machine_name || t.machine_id);
    console.log("SELECTED_CUTTERS:", t.selected_cutters);
    console.log("WAREHOUSE_CONF:", t.warehouse_conf);
    console.log("FULL TASK:", JSON.stringify(t, null, 2));
  }

  // 2. Check work_cards
  console.log("\n--- Checking WORK_CARDS ---");
  const cards = await apiFetchAll('work_cards');
  console.log(`Total work_cards: ${cards.length}`);
  const matchingCards = cards.filter(c => {
    const s = JSON.stringify(c);
    return s.includes('260827-2') || s.includes('260827') || s.includes('К-ІП9');
  });
  console.log(`Matching work_cards (${matchingCards.length}):`);
  for (const c of matchingCards) {
    console.log("CARD ID:", c.id, "CARD_INFO:", c.card_info);
    console.log("STAGE:", c.stage_name, "MACHINE:", c.machine_name);
    console.log("CUTTERS_USED:", c.cutters_used);
    console.log("FULL CARD:", JSON.stringify(c, null, 2));
  }

  // 3. Check material_requests
  console.log("\n--- Checking MATERIAL_REQUESTS ---");
  const reqs = await apiFetchAll('material_requests');
  console.log(`Total material_requests: ${reqs.length}`);
  const matchingReqs = reqs.filter(r => {
    const s = JSON.stringify(r);
    return s.includes('260827-2') || s.includes('260827') || s.includes('23a5c254-1993-4775-a748-acf80d12fb81') || s.includes('0ab28738-6385-471f-b5aa-7881dfa3cb1c');
  });
  console.log(`Matching material_requests (${matchingReqs.length}):`);
  for (const r of matchingReqs) {
    console.log("REQ ID:", r.id, "STATUS:", r.status, "NOM_ID:", r.nomenclature_id);
    console.log("FULL REQ:", JSON.stringify(r, null, 2));
  }
}

run().catch(err => console.error(err));
