const https = require('https');

const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

function queryCards() {
  return new Promise((resolve, reject) => {
    const url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/work_cards?select=*&limit=3000`;
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

async function run() {
  const cards = await queryCards();
  console.log('Total cards fetched:', cards.length);
  if (cards.length > 0) {
    console.log('Sample card keys:', Object.keys(cards[0]));
    console.log('Sample card:', cards[0]);
  }

  const matching = cards.filter(c => {
    const str = JSON.stringify(c);
    return str.includes('ІП9') || str.includes('ІП10') || str.includes('C7907648') || str.includes('73BFB17A') || str.includes('8C318007') || str.includes('1F2D9D62') || str.includes('4374696B');
  });

  console.log(`\nFound ${matching.length} cards matching query or card IDs in screenshot:`);
  matching.forEach(c => {
    console.log(c);
  });

  let deleted = 0;
  for (const c of matching) {
    const status = await deleteCard(c.id);
    if (status === 200 || status === 204) deleted++;
  }
  console.log(`Deleted ${deleted} stuck cards.`);
}

run();
