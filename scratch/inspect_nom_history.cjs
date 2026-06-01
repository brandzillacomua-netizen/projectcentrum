const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const headers = {
  'apikey': key,
  'Authorization': `Bearer ${key}`,
  'Content-Type': 'application/json'
};

const nomIds = {
  'В-3-45': '90c17a0c-2c69-485e-a2cf-ed10909c816d',
  'Н-3-50': 'dcef3b2e-de4d-4540-90a5-63ebcbab1545',
  'Х-2-63': '17908962-8294-4809-b80c-b906fbca25a4'
};

async function run() {
  for (const [name, nid] of Object.entries(nomIds)) {
    const res = await fetch(`https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/work_card_history?nomenclature_id=eq.${nid}&order=completed_at.desc`, { headers });
    const history = await res.json();
    console.log(`\n=== Card History for ${name} ===`);
    console.table(history.map(h => ({
      id: h.id,
      card_id: h.card_id,
      stage_name: h.stage_name,
      operator_name: h.operator_name,
      qty_at_start: h.qty_at_start,
      qty_completed: h.qty_completed,
      completed_at: h.completed_at
    })));
  }
}

run().catch(console.error);
