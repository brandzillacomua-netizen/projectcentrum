const https = require('https');

const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

function sendRequest(method, path) {
  return new Promise((resolve, reject) => {
    const url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/${path}`;
    const req = https.request(url, {
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'x-mes-secret': 'CentrumMES2026SecretKey_a9f8',
        'Content-Type': 'application/json'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  const inv = await sendRequest('GET', 'inventory?select=*');
  const all3mm = inv.filter(i => (i.name && i.name.toLowerCase().includes('3мм') && i.name.toLowerCase().includes('700')));
  console.log('All 3mm T700 in DB across all warehouses:', all3mm);
}

run();
