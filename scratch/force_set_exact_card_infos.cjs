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

function updateCard(id, patchData) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(patchData);
    const url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/work_cards?id=eq.${id}`;
    const req = https.request(url, {
      method: 'PATCH',
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'x-mes-secret': 'CentrumMES2026SecretKey_a9f8',
        'Content-Type': 'application/json'
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
  console.log('=== FORCE UPDATING EXACT CARD_INFO BY SPECIFIC FULL UUID ===');
  const cards = await getTable('work_cards');
  const nomId = '343417a7-4a5c-4e31-8f44-18abb41defec'; // Х-3-39

  const nomCards = cards.filter(c => c.nomenclature_id === nomId && c.operation !== 'Склад БЗ');
  console.log(`Found ${nomCards.length} CNC cards for Х-3-39:`);
  nomCards.forEach(c => console.log(`   ID: ${c.id} | Status: ${c.status} | info: ${c.card_info}`));

  // 1. Target card with ID ending in 41395656 -> '8/12 #41395656'
  const card4139 = nomCards.find(c => c.id.toLowerCase().endsWith('41395656'));
  if (card4139) {
    console.log(`Setting ID ${card4139.id} -> '8/12 #41395656'`);
    await updateCard(card4139.id, { card_info: '8/12 #41395656' });
  }

  // 2. Target card with ID ending in 4b83163e -> '2/12 #4B83163E'
  const card4B83 = nomCards.find(c => c.id.toLowerCase().endsWith('4b83163e'));
  if (card4B83) {
    console.log(`Setting ID ${card4B83.id} -> '2/12 #4B83163E'`);
    await updateCard(card4B83.id, { card_info: '2/12 #4B83163E' });
  }

  // Verify
  const freshCards = await getTable('work_cards');
  const freshNomCards = freshCards.filter(c => c.nomenclature_id === nomId && c.operation !== 'Склад БЗ');
  console.log('\nFresh verification:');
  freshNomCards.forEach(c => console.log(`   ID: ${c.id} | Status: ${c.status} | info: ${c.card_info}`));
}

run();
