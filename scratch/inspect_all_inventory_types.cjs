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
    const res = await fetch(`https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/inventory?nomenclature_id=eq.${nid}`, { headers });
    const rows = await res.json();
    console.log(`\n=== Inventory rows for ${name} ===`);
    console.table(rows.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type,
      total_qty: r.total_qty,
      reserved_qty: r.reserved_qty,
      updated_at: r.updated_at
    })));
  }
}

run().catch(console.error);
