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
  const orders = await getTable('orders');
  const tasks = await getTable('tasks');
  const boxes = await getTable('packaging_boxes');
  const requests = await getTable('material_requests');

  console.log('=== ORDERS count:', Array.isArray(orders) ? orders.length : orders);
  if (Array.isArray(orders)) {
    console.log(orders.map(o => ({ id: o.id, num: o.order_num, status: o.status })));
  }

  console.log('=== TASKS count:', Array.isArray(tasks) ? tasks.length : tasks);
  if (Array.isArray(tasks)) {
    console.log(tasks.map(t => ({ id: t.id, order_id: t.order_id, step: t.step, status: t.status, is_packaged: t.plan_snapshot?._metadata?.is_packaged })));
  }

  console.log('=== PACKAGING BOXES ===');
  console.log(boxes);

  console.log('=== MATERIAL REQUESTS FOR PACKAGING ===');
  if (Array.isArray(requests)) {
    console.log(requests.filter(r => r.details?.includes('КОМПЛЕКТУВАННЯ')).map(r => ({ id: r.id, order_id: r.order_id, nom_id: r.nomenclature_id, status: r.status, details: r.details })));
  }
}

run();
