const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const headers = {
  'apikey': supabaseAnonKey,
  'Authorization': `Bearer ${supabaseAnonKey}`,
  'x-mes-secret': 'CentrumMES2026SecretKey_a9f8',
  'Content-Type': 'application/json'
};

const TASK_ID = '35c6045a-4da1-47d2-b73f-7d269ba1e3a3';
const PART_ID = '50947afc-4e40-4165-a682-780275d5feda';

async function apiFetch(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function run() {
  console.log("=== TESTING CARD GENERATION CUTTER RESOLUTION ===");

  const [task] = await apiFetch(`${supabaseUrl}/rest/v1/tasks?id=eq.${TASK_ID}`);
  const inventory = await apiFetch(`${supabaseUrl}/rest/v1/inventory?select=*`);
  const nomenclatures = await apiFetch(`${supabaseUrl}/rest/v1/nomenclatures?select=*`);

  const partSelectedCutters = task?.plan_snapshot?.[PART_ID]?.selected_cutters || task?.plan_snapshot?.selectedCutters;
  console.log("partSelectedCutters from DB snapshot:", partSelectedCutters);

  // Test resolving "Фреза ф3" or "1ba4c09f-2fcf-4fc8-957d-80fca75d371a" (3mm cutter characteristic)
  const cleanName = "Фреза ф3";
  const invId = partSelectedCutters[cleanName] || partSelectedCutters[cleanName.toLowerCase()] || partSelectedCutters["1ba4c09f-2fcf-4fc8-957d-80fca75d371a"];
  console.log(`\nSelected invId for 3mm cutter: ${invId}`);

  const invItem = inventory.find(i => String(i.id) === String(invId));
  console.log("Inventory Item found:", invItem);

  const resolvedNom = nomenclatures.find(n => String(n.id) === String(invItem?.nomenclature_id));
  console.log("\n-> RESOLVED NOMENCLATURE FOR CUTTER BOXES REQUEST:");
  console.log(`ID: ${resolvedNom?.id}`);
  console.log(`NAME: "${resolvedNom?.name}"`);

  if (resolvedNom?.name === 'Фреза кукурудза 3х3,175х12х38') {
    console.log("\n✅ SUCCESS! Clicking 'ГЕНЕРУВАТИ' will generate a request for 'Фреза кукурудза 3х3,175х12х38'.");
  } else {
    console.log("\n❌ FAIL! Resolved to wrong cutter:", resolvedNom?.name);
  }
}

run().catch(err => console.error(err));
