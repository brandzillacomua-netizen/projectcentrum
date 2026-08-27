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

async function run() {
  console.log('=== CONFIRMING CARD #4B83163E SEQUENCE AND POSITION ===');
  const cards = await getTable('work_cards');
  const targetCard = cards.find(c => c.id.includes('4b83163e'));

  if (targetCard) {
    console.log('Found card #4B83163E:');
    console.log('   ID:', targetCard.id);
    console.log('   card_info:', targetCard.card_info);
    console.log('   quantity:', targetCard.quantity);
    console.log('   machine:', targetCard.machine);
    console.log('   status:', targetCard.status);
  } else {
    console.log('Warning: card #4B83163E not found!');
  }
}

run();
