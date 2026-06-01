const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const headers = {
  'apikey': key,
  'Authorization': `Bearer ${key}`,
  'Content-Type': 'application/json'
};

async function run() {
  const invRes = await fetch('https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/inventory?type=in.("semi_shop2","bz_shop2")', { headers });
  const inventory = await invRes.json();
  console.log('--- INVENTORY ITEMS ---');
  console.table(inventory.map(i => ({
    id: i.id,
    nomenclature_id: i.nomenclature_id,
    name: i.name,
    total_qty: i.total_qty,
    reserved_qty: i.reserved_qty,
    type: i.type,
    updated_at: i.updated_at
  })));
}

run().catch(console.error);
