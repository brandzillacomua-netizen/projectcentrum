const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const headers = {
  'apikey': key,
  'Authorization': `Bearer ${key}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

async function run() {
  const row = {
    id: '59497743-8a5f-4e43-a293-2ea86ed1c617',
    name: 'ІП-72-F5-Н-3-50',
    unit: 'шт',
    total_qty: 100, // keep same for test first
    reserved_qty: 0,
    type: 'semi_shop2',
    nomenclature_id: 'dcef3b2e-de4d-4540-90a5-63ebcbab1545'
  };

  const res = await fetch(`https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/inventory?id=eq.${row.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ total_qty: 100 })
  });
  console.log('PATCH Status:', res.status);
  console.log('PATCH Response:', await res.text());
}

run().catch(console.error);
