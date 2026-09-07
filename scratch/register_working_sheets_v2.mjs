import crypto from 'crypto';

const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const baseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';

async function run() {
  const loginRes = await fetch(baseUrl + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alexinj@centrum.local', password: '12345' })
  });
  const token = (await loginRes.json()).access_token;

  // 1. Get all prepared sheets from v1
  const v1Res = await fetch(baseUrl + '/rest/v1/nomenclatures?name=ilike.*Підготовлений*&select=id,name', {
    headers: { apikey: key, Authorization: 'Bearer ' + token }
  });
  const v1Items = await v1Res.json();
  const prepV1Map = {};
  v1Items.forEach(item => {
    if (item.name.includes('[Підготовлений]')) {
      const clean = item.name.replace(/\s*\[Підготовлений\]\s*/gi, '').replace(/\(8мм\)/g, '').trim();
      prepV1Map[clean] = item.id;
    }
  });

  // Also map (8мм)
  prepV1Map['Лист Т300 (8мм)'] = 'c557da60-4458-4ea2-896d-1b4eecb829db';
  prepV1Map['Лист Т700 (8мм)'] = 'e607735b-fb69-4d1e-9a3c-b4a992b835e8';

  // 2. List of 23 target working sheets
  const targetSheets = [
    'Лист Т300 (1мм)',
    'Лист Т300 (2мм)',
    'Лист Т300 (2.5мм)',
    'Лист Т300 (3мм)',
    'Лист Т300 (4мм)',
    'Лист Т300 (5мм)',
    'Лист Т300 (6мм)',
    'Лист Т300 (7мм)',
    'Лист Т300 (8мм)',
    'Лист Т300 (9мм)',
    'Лист Т300 (10мм)',
    'Лист Т300 (11мм)',
    'Лист Т300 (12мм)',
    'Лист Т700 (1мм)',
    'Лист Т700 (2мм)',
    'Лист Т700 (2.5мм)',
    'Лист Т700 (3мм)',
    'Лист Т700 (4мм)',
    'Лист Т700 (5мм)',
    'Лист Т700 (6мм)',
    'Лист Т700 (7мм)',
    'Лист Т700 (8мм)',
    'Лист Т700 (10мм)'
  ];

  let index = 1;
  const toUpsert = [];

  for (const sheetName of targetSheets) {
    let matchedId = prepV1Map[sheetName] || 
      prepV1Map[sheetName.replace('2.5мм', '2,5мм')] || 
      prepV1Map[sheetName.replace('2,5мм', '2.5мм')] ||
      crypto.randomUUID();

    const code = `V2-SHT-${String(index).padStart(3, '0')}`;
    index++;

    toUpsert.push({
      id: matchedId,
      code,
      name: sheetName,
      group_id: 'grp_prepared_sheets',
      unit: 'лист',
      rule_type: 'generic',
      rule_params: {
        type: 'working_sheet',
        unit: 'лист'
      },
      status: 'active'
    });
  }

  console.log(`Upserting ${toUpsert.length} sheets to nomenclatures_v2...`);
  const upsertRes = await fetch(baseUrl + '/rest/v1/nomenclatures_v2', {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify(toUpsert)
  });

  const resData = await upsertRes.json();
  console.log('Upsert status:', upsertRes.status, 'Rows count:', Array.isArray(resData) ? resData.length : resData);
}

run();
