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

function patchInventory(id, patchData) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(patchData);
    const url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/inventory?id=eq.${id}`;
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
  const inv = await getTable('inventory');
  const targetNames = [
    'Київ К-ІП9-10-П-7-46',
    'Київ К-ІП9/10/31/36/37-9-10-11-В-3-30',
    'Київ К-ІП9/10/31/36/37-9-10-11-Н-3-14',
    'Київ К-ІП9/10/31/36/37-9-10-11-Х-3-39'
  ];

  console.log('=== CLEARING SHOP 2 BUFFER FOR F10 FRAME PARTS ===');
  let clearedCount = 0;

  for (const item of inv) {
    if (item.name && targetNames.some(tn => item.name.trim() === tn)) {
      if (item.type === 'semi_shop2' && item.total_qty > 0) {
        console.log(`Clearing ${item.name} (type: ${item.type}, current qty: ${item.total_qty}, ID: ${item.id})`);
        const status = await patchInventory(item.id, { total_qty: 0, reserved_qty: 0, updated_at: new Date().toISOString() });
        if (status === 200 || status === 204) clearedCount++;
      }
    }
  }

  console.log(`Successfully cleared ${clearedCount} buffer inventory items.`);
}

run();
