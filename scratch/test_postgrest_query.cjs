const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const headers = {
  'apikey': key,
  'Authorization': `Bearer ${key}`,
  'Content-Type': 'application/json'
};

async function run() {
  const nomId = '90c17a0c-2c69-485e-a2cf-ed10909c816d';
  const nomName = '[ЦЕХ №2] [NEED:250] [BZ:0] [MACHINE_ID:] [MACHINE_NAME:—] [ЦЕХ №2] [NEED:300] [BZ:0] Наряд №№29052026-07/3';
  const typesToFetch = ['semi_shop2', 'bz_shop2', 'finished', 'bz'];
  
  const orFilters = []
  if (nomId) orFilters.push(`nomenclature_id.eq.${nomId}`)
  if (nomName) orFilters.push(`name.eq."${nomName.replace(/"/g, '""')}"`)

  const url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/inventory?type=in.(${typesToFetch.map(t => `"${t}"`).join(',')})&or=(${encodeURIComponent(orFilters.join(','))})`;
  console.log('Fetching:', url);
  const res = await fetch(url, { headers });
  const data = await res.json();
  console.log('Response Status:', res.status);
  console.log('Response Data:', data);
}

run().catch(console.error);
