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
  console.log('=== VERIFYING EXACT CURRENT DB STATE ===');
  const cards = await getTable('work_cards');
  
  const card4139 = cards.find(c => c.id === '4b83163e-2608-4610-8000-f5d641395656');
  const card4B83 = cards.find(c => c.id === '26082610-0002-4000-8000-00004b83163e');

  console.log('Card #41395656 DB Record:');
  console.log('   ID:', card4139?.id);
  console.log('   Status:', card4139?.status);
  console.log('   card_info:', card4139?.card_info);

  console.log('\nCard #4B83163E DB Record:');
  console.log('   ID:', card4B83?.id);
  console.log('   Status:', card4B83?.status);
  console.log('   card_info:', card4B83?.card_info);
}

run();
