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

function patchMaterialRequest(id, patchData) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(patchData);
    const url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/material_requests?id=eq.${id}`;
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
  console.log('=== INSPECTING AND FIXING RESERVES FOR ACTIVE ORDERS ===');
  const orders = await getTable('orders');
  const tasks = await getTable('tasks');
  const requests = await getTable('material_requests');
  const inventory = await getTable('inventory');
  const nomenclatures = await getTable('nomenclatures');

  const activeOrders = orders.filter(o => o.status === 'in-progress' || o.status === 'active' || o.status === 'new');
  const activeOrderIds = new Set(activeOrders.map(o => o.id));

  console.log('Active Orders count:', activeOrders.length);
  activeOrders.forEach(o => console.log(`   Order #${o.order_num} (ID: ${o.id})`));

  const activeRequests = requests.filter(r => r.order_id && activeOrderIds.has(r.order_id) && r.status !== 'completed' && r.status !== 'cancelled');

  console.log(`\nFound ${activeRequests.length} active material requests for current orders:`);
  activeRequests.forEach(r => {
    const nom = nomenclatures.find(n => n.id === r.nomenclature_id);
    console.log(`   ReqID: ${r.id} | Nom: ${nom?.name || r.details} | Qty: ${r.quantity} | Status: ${r.status} | OrderID: ${r.order_id}`);
  });

  // 1. Ensure all active requests for sheets and cutters are marked as 'approved' or 'reserved' or 'issued'
  let statusUpdated = 0;
  for (const r of activeRequests) {
    if (r.status === 'pending' || !r.status) {
      const status = await patchMaterialRequest(r.id, { status: 'issued' });
      if (status === 200 || status === 204) statusUpdated++;
    }
  }
  console.log(`Updated status to 'issued' for ${statusUpdated} pending requests.`);

  // 2. Recalculate inventory reserved_qty for ALL inventory items
  const freshRequests = await getTable('material_requests');
  const validReserves = freshRequests.filter(r => r.status === 'approved' || r.status === 'reserved' || r.status === 'issued' || r.status === 'pending');

  let invFixed = 0;
  for (const item of inventory) {
    // Only count raw materials, sheets, cutters, hardware for operational warehouse
    const isOperationalMat = item.warehouse === 'operational' || !item.warehouse;
    if (!isOperationalMat) continue;

    const matching = validReserves.filter(r => {
      if (r.inventory_id && String(r.inventory_id) === String(item.id)) return true;
      if (!r.inventory_id && r.nomenclature_id && String(r.nomenclature_id) === String(item.nomenclature_id)) return true;
      return false;
    });

    const sumReserved = matching.reduce((acc, r) => acc + (Number(r.quantity) || 0), 0);

    if (Number(item.reserved_qty || 0) !== sumReserved) {
      console.log(`Updating ${item.name}: reserved_qty ${item.reserved_qty} -> ${sumReserved}`);
      const status = await patchInventory(item.id, { reserved_qty: sumReserved, updated_at: new Date().toISOString() });
      if (status === 200 || status === 204) invFixed++;
    }
  }

  console.log(`Successfully updated reserved_qty for ${invFixed} operational inventory items!`);
}

run();
