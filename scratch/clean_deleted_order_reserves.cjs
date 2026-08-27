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

function deleteRequest(id) {
  return new Promise((resolve, reject) => {
    const url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/material_requests?id=eq.${id}`;
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
  console.log('=== CLEANING RESERVES FOR DELETED ORDER 07082026-03 ===');
  const orders = await getTable('orders');
  const tasks = await getTable('tasks');
  const requests = await getTable('material_requests');
  const inventory = await getTable('inventory');

  const order0708 = orders.filter(o => o.order_num && String(o.order_num).includes('07082026-03'));
  console.log('Found orders matching 07082026-03:', order0708.map(o => ({ id: o.id, num: o.order_num, status: o.status })));

  const targetOrderIds = new Set(order0708.map(o => o.id));
  tasks.filter(t => t.naryad_number && String(t.naryad_number).includes('07082026-03')).forEach(t => targetOrderIds.add(t.order_id));

  // Find requests matching order 07082026-03 or mentioning 07082026-03 in details
  const targetRequests = requests.filter(r => {
    if (r.order_id && targetOrderIds.has(r.order_id)) return true;
    if (r.details && r.details.includes('07082026-03')) return true;
    return false;
  });

  console.log(`\nFound ${targetRequests.length} material_requests for order 07082026-03:`);
  targetRequests.forEach(r => {
    console.log(`   ID: ${r.id} | NomID: ${r.nomenclature_id} | Qty: ${r.quantity} | Status: ${r.status} | Details: ${r.details}`);
  });

  let deletedCount = 0;
  for (const req of targetRequests) {
    const status = await deleteRequest(req.id);
    if (status === 200 || status === 204) deletedCount++;
  }

  console.log(`\nSuccessfully deleted ${deletedCount} reserve requests for order 07082026-03.`);

  // Recalculate reserved_qty on all inventory items based on remaining active material_requests
  console.log('\n=== RECALCULATING INVENTORY RESERVED_QTY ===');
  const freshRequests = await getTable('material_requests');
  const activeReqs = freshRequests.filter(r => r.status === 'approved' || r.status === 'reserved' || r.status === 'issued');

  let invUpdated = 0;
  for (const item of inventory) {
    const matchingReqs = activeReqs.filter(r => 
      (r.inventory_id && String(r.inventory_id) === String(item.id)) ||
      (!r.inventory_id && r.nomenclature_id && String(r.nomenclature_id) === String(item.nomenclature_id) && item.warehouse === 'operational')
    );

    const actualReserved = matchingReqs.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

    if (Number(item.reserved_qty || 0) !== actualReserved) {
      console.log(`Updating ${item.name} (${item.warehouse || 'SO'}): current reserved ${item.reserved_qty} -> actual reserved ${actualReserved}`);
      const status = await patchInventory(item.id, { reserved_qty: actualReserved, updated_at: new Date().toISOString() });
      if (status === 200 || status === 204) invUpdated++;
    }
  }

  console.log(`Successfully recalculated and fixed reserved_qty for ${invUpdated} inventory items!`);
}

run();
