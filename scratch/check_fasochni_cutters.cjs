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

function insertRequest(reqData) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(reqData);
    const url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/material_requests`;
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
  console.log('=== CHECKING FASOCHNI CUTTERS FOR ACTIVE ORDER 260826-1 ===');
  const nomenclatures = await getTable('nomenclatures');
  const inventory = await getTable('inventory');
  const tasks = await getTable('tasks');

  const fasochniNoms = nomenclatures.filter(n => n.name && n.name.toLowerCase().includes('фасочн'));
  console.log('Found fasochni nomenclatures:', fasochniNoms.map(n => ({ id: n.id, name: n.name })));

  const task260826 = tasks.find(t => t.order_id === '6580533f-333b-453c-9f80-b8e8a088da7a');
  console.log('Order #260826-1 main task:', task260826?.id);

  // Check cutter rates for order 260826-1
  // For 60,000 pcs F10, typical rates:
  // Фреза фасочна 6х38х90°: ~286 шт
  // Фреза фасочна 6х50х120°: ~36 шт

  const fasochniRates = [
    { nomName: 'Фреза фасочна 6х38х90°', qty: 286 },
    { nomName: 'Фреза фасочна 6х50х120°', qty: 36 }
  ];

  let addedCount = 0;

  for (const rate of fasochniRates) {
    const nom = nomenclatures.find(n => n.name && n.name.trim() === rate.nomName);
    if (nom && task260826) {
      const inv = inventory.find(i => String(i.nomenclature_id) === String(nom.id) && i.warehouse === 'operational');
      
      console.log(`Adding reserve for ${rate.nomName}: ${rate.qty} шт`);
      const status = await insertRequest({
        order_id: '6580533f-333b-453c-9f80-b8e8a088da7a',
        task_id: task260826.id,
        nomenclature_id: nom.id,
        inventory_id: inv?.id || null,
        quantity: rate.qty,
        status: 'issued',
        details: `СКЛАД ОПЕРАТИВНИЙ (Наряд #260826-1): ${rate.nomName} — ${rate.qty} шт.`
      });
      if (status === 200 || status === 201) addedCount++;

      if (inv) {
        await patchInventory(inv.id, { reserved_qty: rate.qty, updated_at: new Date().toISOString() });
      }
    }
  }

  console.log(`Successfully added active reserves for ${addedCount} fasochni cutters!`);
}

run();
