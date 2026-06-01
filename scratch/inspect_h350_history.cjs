const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const headers = {
  'apikey': key,
  'Authorization': `Bearer ${key}`,
  'Content-Type': 'application/json'
};

const h350 = 'dcef3b2e-de4d-4540-90a5-63ebcbab1545';

async function run() {
  const res = await fetch(`https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/work_card_history?nomenclature_id=eq.${h350}&stage_name=eq.Пакування/СГП`, { headers });
  const history = await res.json();
  console.log(`\n=== SGP completions for Н-3-50 ===`);
  console.table(history.map(h => ({
    id: h.id,
    card_id: h.card_id,
    operator_name: h.operator_name,
    qty_completed: h.qty_completed,
    completed_at: h.completed_at
  })));
}

run().catch(console.error);
