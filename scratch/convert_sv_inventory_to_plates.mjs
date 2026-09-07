const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const baseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';

async function convert() {
  const loginRes = await fetch(baseUrl + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alexinj@centrum.local', password: '12345' })
  });
  const token = (await loginRes.json()).access_token;

  // 1. Fetch all plates from nomenclatures_v2
  const platesRes = await fetch(baseUrl + '/rest/v1/nomenclatures_v2?name=ilike.*Карбонова пластина*&select=id,code,name', {
    headers: { apikey: key, Authorization: 'Bearer ' + token }
  });
  const plates = await platesRes.json();
  const plateMap = {};
  plates.forEach(p => {
    // e.g. key "Т300_500*600_10"
    const brand = p.name.includes('Т700') ? 'Т700' : 'Т300';
    const thickMatch = p.name.match(/(\d+(?:[.,]\d+)?)\s*мм/i);
    const thick = thickMatch ? thickMatch[1].replace(',', '.') : '';
    if (p.name.includes('500*600') && !p.name.includes('преференція') && !p.name.includes('0/45/90')) {
      plateMap[`${brand}_${thick}`] = p;
    }
  });

  console.log('Available 500*600 plates in V2:');
  Object.entries(plateMap).forEach(([k, v]) => console.log(`  ${k} -> ${v.name} (${v.id})`));

  // 2. Fetch current inventory on production warehouse
  const invRes = await fetch(baseUrl + '/rest/v1/inventory?warehouse=eq.production&name=ilike.*Непідготовлений*&select=*', {
    headers: { apikey: key, Authorization: 'Bearer ' + token }
  });
  const invRows = await invRes.json();
  console.log(`\nFound ${invRows.length} inventory rows on warehouse 'production' with [Непідготовлений]`);

  for (const row of invRows) {
    const brand = row.name.includes('Т700') ? 'Т700' : 'Т300';
    const thickMatch = row.name.match(/(\d+(?:[.,]\d+)?)\s*мм/i);
    const thick = thickMatch ? thickMatch[1].replace(',', '.') : '';
    const keyMatch = `${brand}_${thick}`;

    const targetPlate = plateMap[keyMatch];
    if (!targetPlate) {
      console.warn(`⚠️ No target plate found for ${row.name} (key: ${keyMatch})`);
      continue;
    }

    console.log(`Converting inventory ID ${row.id}:`);
    console.log(`  Old: "${row.name}" (${row.total_qty} шт)`);
    console.log(`  New: "${targetPlate.name}" (ID: ${targetPlate.id})`);

    const updateRes = await fetch(`${baseUrl}/rest/v1/inventory?id=eq.${row.id}`, {
      method: 'PATCH',
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        name: targetPlate.name,
        nomenclature_id: targetPlate.id
      })
    });

    if (!updateRes.ok) {
      console.error(`  ❌ Failed to update row ${row.id}:`, await updateRes.text());
    } else {
      console.log(`  ✅ Updated!`);
    }
  }

  console.log('\n--- Done converting production inventory rows ---');
}

convert();
