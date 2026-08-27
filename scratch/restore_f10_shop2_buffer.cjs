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
  console.log('=== RESTORING SHOP 2 BUFFER FOR F10 FRAME PARTS ===');

  const restorationTargets = [
    { name: 'Київ К-ІП9-10-П-7-46', qty: 1562 },
    { name: 'Київ К-ІП9/10/31/36/37-9-10-11-В-3-30', qty: 5130 },
    { name: 'Київ К-ІП9/10/31/36/37-9-10-11-Н-3-14', qty: 3211 },
    { name: 'Київ К-ІП9/10/31/36/37-9-10-11-Х-3-39', qty: 274 }
  ];

  let restoredCount = 0;

  for (const target of restorationTargets) {
    const item = inv.find(i => i.name && i.name.trim() === target.name && i.type === 'semi_shop2');
    if (item) {
      console.log(`Restoring ${target.name} to ${target.qty} шт (ID: ${item.id})`);
      const status = await patchInventory(item.id, { total_qty: target.qty, updated_at: new Date().toISOString() });
      if (status === 200 || status === 204) restoredCount++;
    } else {
      console.log(`Warning: item ${target.name} with type semi_shop2 not found in inventory.`);
    }
  }

  console.log(`Successfully restored ${restoredCount} buffer inventory items in Shop 2.`);
}

run();
