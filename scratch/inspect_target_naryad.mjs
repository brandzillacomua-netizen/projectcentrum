const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const headers = {
  'apikey': supabaseAnonKey,
  'Authorization': `Bearer ${supabaseAnonKey}`,
  'x-mes-secret': 'CentrumMES2026SecretKey_a9f8',
  'Content-Type': 'application/json'
};

async function run() {
  console.log("=== SEARCHING FOR NARYAD 260827-2 ===");

  // 1. Search work_cards
  let res = await fetch(`${supabaseUrl}/rest/v1/work_cards?naryad_number=ilike.*260827*`, { headers });
  let cards = await res.json();
  console.log(`work_cards matching 260827: ${cards.length}`);
  console.log("Work Cards:", JSON.stringify(cards, null, 2));

  // 2. Search tasks by title / task_name
  res = await fetch(`${supabaseUrl}/rest/v1/tasks?title=ilike.*260827*`, { headers });
  let tasks = await res.json();
  if (tasks.length === 0) {
    res = await fetch(`${supabaseUrl}/rest/v1/tasks?task_name=ilike.*260827*`, { headers });
    tasks = await res.json();
  }
  console.log(`tasks matching 260827: ${tasks.length}`);
  console.log("Tasks:", JSON.stringify(tasks, null, 2));

  // 3. Search material_requests
  res = await fetch(`${supabaseUrl}/rest/v1/material_requests?select=*`, { headers });
  let reqs = await res.json();
  const matchedReqs = reqs.filter(r => JSON.stringify(r).includes('260827'));
  console.log(`material_requests matching 260827: ${matchedReqs.length}`);
  console.log("Reqs:", JSON.stringify(matchedReqs, null, 2));

  // 4. Search inventory / nomenclatures to find the exact two cutters from the images
  // Image 1: "Фреза чотирьохпера 3x3x12x75 — вільно 2394 шт" (or similar 2394 pcs free)
  // Image 2: "Фреза кукурудза 3x3,175x12x38 — вільно 474 шт"
  res = await fetch(`${supabaseUrl}/rest/v1/nomenclatures?name=ilike.*Фреза*`, { headers });
  let noms = await res.json();
  console.log(`nomenclatures matching Фреза: ${noms.length}`);
  for (const n of noms) {
    if (n.name.includes('3x3') || n.name.includes('кукурудза') || n.name.includes('чотирьохпера') || n.name.includes('2394') || n.name.includes('474')) {
      console.log(`NOM: id=${n.id}, name="${n.name}", quantity=${n.quantity}, code=${n.code}, category=${n.category}`);
    }
  }

  res = await fetch(`${supabaseUrl}/rest/v1/inventory?select=*`, { headers });
  let inv = await res.json();
  console.log(`inventory items: ${inv.length}`);
  for (const i of inv) {
    const itemStr = JSON.stringify(i);
    if (itemStr.includes('кукурудза') || itemStr.includes('чотирьохпера') || itemStr.includes('474') || itemStr.includes('2394')) {
      console.log("INV ITEM:", JSON.stringify(i, null, 2));
    }
  }
}

run().catch(err => console.error(err));
