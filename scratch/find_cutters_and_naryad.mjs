const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const headers = {
  'apikey': supabaseAnonKey,
  'Authorization': `Bearer ${supabaseAnonKey}`,
  'x-mes-secret': 'CentrumMES2026SecretKey_a9f8',
  'Content-Type': 'application/json'
};

async function run() {
  console.log("=== SEARCHING ALL NOMENCLATURES FOR CUTTERS ===");
  const resN = await fetch(`${supabaseUrl}/rest/v1/nomenclatures?select=*`, { headers });
  const noms = await resN.json();

  let cutter1 = null; // 4-flute 3x3x12x75 (2394 pcs)
  let cutter2 = null; // corn 3x3.175x12x38 (474 pcs)

  for (const n of noms) {
    if (n.name.includes('3х3х12х75') || n.name.includes('3x3x12x75') || n.name.includes('чотирьохпера 3')) {
      console.log("CUTTER 1 CANDIDATE:", n);
      cutter1 = n;
    }
    if (n.name.includes('3х3,175х12х38') || n.name.includes('3x3.175x12x38') || n.name.includes('3х3,175') || n.name.includes('474')) {
      console.log("CUTTER 2 CANDIDATE:", n);
      cutter2 = n;
    }
  }

  // Also list all nomenclatures that start with "Фреза"
  const allCutters = noms.filter(n => n.name && n.name.startsWith('Фреза'));
  console.log("\nALL CUTTERS IN NOMENCLATURES:");
  for (const c of allCutters) {
    console.log(`- [${c.id}] ${c.name} (qty: ${c.quantity}, code: ${c.code})`);
  }

  console.log("\n=== SEARCHING ALL TASKS ===");
  const resT = await fetch(`${supabaseUrl}/rest/v1/tasks?select=*`, { headers });
  const tasks = await resT.json();

  // Search by naryad info or text in tasks
  for (const t of tasks) {
    const tStr = JSON.stringify(t);
    if (tStr.includes('260827') || tStr.includes('К-ІП9') || tStr.includes('1200x800') || tStr.includes('1200х800')) {
      console.log("FOUND TASK:", t.id, t.title || t.task_name || t.name);
      console.log("TASK DETAILS:", JSON.stringify(t, null, 2));
    }
  }

  console.log("\n=== SEARCHING ALL WORK_CARDS ===");
  const resWC = await fetch(`${supabaseUrl}/rest/v1/work_cards?select=*`, { headers });
  const cards = await resWC.json();

  for (const c of cards) {
    const cStr = JSON.stringify(c);
    if (cStr.includes('260827') || cStr.includes('К-ІП9') || cStr.includes('1200x800') || cStr.includes('1200х800')) {
      console.log("FOUND WORK_CARD:", c.id, c.naryad_number);
      console.log("CARD DETAILS:", JSON.stringify(c, null, 2));
    }
  }

  console.log("\n=== SEARCHING ALL MATERIAL_REQUESTS ===");
  const resMR = await fetch(`${supabaseUrl}/rest/v1/material_requests?select=*`, { headers });
  const reqs = await resMR.json();

  for (const r of reqs) {
    const rStr = JSON.stringify(r);
    if (rStr.includes('260827') || rStr.includes('К-ІП9') || rStr.includes('1200x800') || rStr.includes('1200х800')) {
      console.log("FOUND MAT REQUEST:", r.id, r.status);
      console.log("REQ DETAILS:", JSON.stringify(r, null, 2));
    }
  }
}

run().catch(err => console.error(err));
