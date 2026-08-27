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
  console.log('=== RESTORING ORIGINAL CREATED_AT (26.08.2026) FOR ORDER 260826-1 ===');
  const cards = await getTable('work_cards');

  const targetCards = cards.filter(c => c.order_id === '6580533f-333b-453c-9f80-b8e8a088da7a');
  console.log(`Found ${targetCards.length} work cards for order #260826-1.`);

  const originalDateStr = '2026-08-26T17:20:00.000Z';

  let updatedCount = 0;
  for (const card of targetCards) {
    const patch = {
      created_at: originalDateStr,
      started_at: originalDateStr
    };
    if (card.status === 'at-buffer') {
      patch.completed_at = '2026-08-26T18:00:00.000Z';
    }

    const status = await updateCard(card.id, patch);
    if (status === 200 || status === 204) updatedCount++;
  }

  console.log(`Successfully restored original timestamps (26.08.2026) for ${updatedCount} work cards!`);
}

run();
