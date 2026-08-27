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
  console.log('=== SETTING EXACT UUID ENDING IN 4B83163E FOR CARD 2/12 ===');
  const cards = await getTable('work_cards');
  const targetCard = cards.find(c => c.id.includes('4b83163e') || (c.card_info && c.card_info.includes('4B83163E')));

  const exactUuid = '26082610-0002-4000-8000-00004b83163e';

  if (targetCard) {
    console.log(`Current Card 2/12 ID: ${targetCard.id}, card_info: ${targetCard.card_info}`);
    await deleteCard(targetCard.id);

    const payload = {
      ...targetCard,
      id: exactUuid,
      card_info: '2/12 #4B83163E'
    };
    delete payload.updated_at;

    const res = await insertCard(payload);
    console.log(`Inserted card with exact UUID ${exactUuid}: status ${res}`);
  }
}

run();
