const https = require('https');

const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

function getTable(table) {
  return new Promise((resolve, reject) => {
    const url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/${table}?select=*`;
    const req = https.get(url, {
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
  });
}

function deleteCard(id) {
  return new Promise((resolve, reject) => {
    const url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/work_cards?id=eq.${id}`;
    const req = https.request(url, {
      method: 'DELETE',
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
      }
    }, res => {
      resolve(res.statusCode);
    });
    req.on('error', reject);
    req.end();
  });
}

function insertCard(cardData) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(cardData);
    const url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/work_cards`;
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'x-mes-secret': 'CentrumMES2026SecretKey_a9f8',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      }
    }, res => {
      resolve(res.statusCode);
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('=== CLEANING AND DEDUPING UUIDS FOR 4B83163E AND 41395656 ===');
  const cards = await getTable('work_cards');
  const nomId = '343417a7-4a5c-4e31-8f44-18abb41defec'; // Х-3-39

  const nomCards = cards.filter(c => c.nomenclature_id === nomId && c.operation !== 'Склад БЗ');
  
  // Find card 8/12 (currently has ID 4b83163e-2608-4610-8000-f5d641395656)
  const card8 = nomCards.find(c => c.card_info && c.card_info.includes('8/12'));
  // Find card 2/12 (currently has ID 26082610-0002-4000-8000-00004b83163e)
  const card2 = nomCards.find(c => c.card_info && c.card_info.includes('2/12'));

  const newUuid8 = '41395656-2608-4610-8000-000041395656';
  const newUuid2 = '4b83163e-2608-4610-8000-00004b83163e';

  if (card8) {
    console.log(`Re-assigning Card 8/12 from ID ${card8.id} to clean UUID ${newUuid8}`);
    await deleteCard(card8.id);
    const payload8 = {
      ...card8,
      id: newUuid8,
      card_info: '8/12 #41395656'
    };
    delete payload8.updated_at;
    await insertCard(payload8);
  }

  if (card2) {
    console.log(`Re-assigning Card 2/12 from ID ${card2.id} to clean UUID ${newUuid2}`);
    await deleteCard(card2.id);
    const payload2 = {
      ...card2,
      id: newUuid2,
      card_info: '2/12 #4B83163E'
    };
    delete payload2.updated_at;
    await insertCard(payload2);
  }

  console.log('\nVerification of cleaned cards:');
  const freshCards = await getTable('work_cards');
  const freshNomCards = freshCards.filter(c => c.nomenclature_id === nomId && c.operation !== 'Склад БЗ');
  const check2 = freshNomCards.find(c => c.id === newUuid2);
  const check8 = freshNomCards.find(c => c.id === newUuid8);

  console.log('Card 2/12:', check2?.id, '->', check2?.card_info);
  console.log('Card 8/12:', check8?.id, '->', check8?.card_info);
}

run();
