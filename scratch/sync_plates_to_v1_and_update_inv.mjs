const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const baseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';

async function run() {
  const loginRes = await fetch(baseUrl + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alexinj@centrum.local', password: '12345' })
  });
  const token = (await loginRes.json()).access_token;

  // 1. Fetch all carbon plates from nomenclatures_v2
  const platesRes = await fetch(baseUrl + '/rest/v1/nomenclatures_v2?name=ilike.*Карбонова пластина*&select=id,code,name,unit', {
    headers: { apikey: key, Authorization: 'Bearer ' + token }
  });
  const plates = await platesRes.json();
  console.log(`Found ${plates.length} plates in nomenclatures_v2.`);

  // 2. Upsert them into nomenclatures (v1) to satisfy FK constraints
  const v1Payload = plates.map(p => ({
    id: p.id,
    name: p.name,
    type: 'raw',
    unit: p.unit || 'шт'
  }));

  const upsertPlatesRes = await fetch(baseUrl + '/rest/v1/nomenclatures', {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify(v1Payload)
  });

  console.log('Upsert plates into nomenclatures v1 status:', upsertPlatesRes.status);

  // 3. Build lookup map for 500*600 plates
  const plateMap = {};
  plates.forEach(p => {
    const brand = p.name.includes('Т700') ? 'Т700' : 'Т300';
    const thickMatch = p.name.match(/(\d+(?:[.,]\d+)?)\s*мм/i);
    const thick = thickMatch ? thickMatch[1].replace(',', '.') : '';
    if (p.name.includes('500*600') && !p.name.includes('преференція') && !p.name.includes('0/45/90')) {
      plateMap[`${brand}_${thick}`] = p;
    }
  });

  // 4. Fetch production inventory rows with [Непідготовлений]
  const invRes = await fetch(baseUrl + '/rest/v1/inventory?warehouse=eq.production&name=ilike.*Непідготовлений*&select=*', {
    headers: { apikey: key, Authorization: 'Bearer ' + token }
  });
  const invRows = await invRes.json();
  console.log(`\nUpdating ${invRows.length} inventory rows on warehouse 'production'...\n`);

  let successCount = 0;
  for (const row of invRows) {
    const brand = row.name.includes('Т700') ? 'Т700' : 'Т300';
    const thickMatch = row.name.match(/(\d+(?:[.,]\d+)?)\s*мм/i);
    const thick = thickMatch ? thickMatch[1].replace(',', '.') : '';
    const keyMatch = `${brand}_${thick}`;

    const targetPlate = plateMap[keyMatch];
    if (!targetPlate) {
      console.warn(`⚠️ No target plate found for: "${row.name}"`);
      continue;
    }

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

    if (updateRes.ok) {
      console.log(`✅ [${row.total_qty} шт] "${row.name}" -> "${targetPlate.name}"`);
      successCount++;
    } else {
      console.error(`❌ Failed: ${row.name}`, await updateRes.text());
    }
  }

  console.log(`\nSuccessfully converted ${successCount} / ${invRows.length} inventory records on СВ!`);
}

run();
