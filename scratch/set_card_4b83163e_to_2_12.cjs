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
  console.log('=== SETTING CARD #4B83163E EXACTLY TO 2/12 ===');
  const cards = await getTable('work_cards');
  const orderId = '6580533f-333b-453c-9f80-b8e8a088da7a';
  const nomId = '343417a7-4a5c-4e31-8f44-18abb41defec'; // Х-3-39

  const nomCards = cards.filter(c => c.order_id === orderId && c.nomenclature_id === nomId && c.operation !== 'Склад БЗ');
  const targetCard = nomCards.find(c => c.id.includes('4b83163e'));
  const currentCard2 = nomCards.find(c => String(c.card_info || '').startsWith('2/12') && !c.id.includes('4b83163e'));

  if (targetCard) {
    console.log(`Setting card ID ${targetCard.id} card_info -> '2/12 #4B83163E'`);
    await updateCard(targetCard.id, { card_info: '2/12 #4B83163E' });
  }

  if (currentCard2) {
    const sysId = currentCard2.id.slice(-8).toUpperCase();
    console.log(`Swapping old 2/12 card ID ${currentCard2.id} card_info -> '8/12 #${sysId}'`);
    await updateCard(currentCard2.id, { card_info: `8/12 #${sysId}` });
  }

  console.log('Successfully set card #4B83163E exactly to position 2/12!');
}

run();
