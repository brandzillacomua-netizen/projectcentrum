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

  console.log('Total Orders in DB:', orders.length);
  console.log('Orders with status != active/in-progress/completed:', orders.filter(o => o.status !== 'in-progress' && o.status !== 'completed' && o.status !== 'shipped' && o.status !== 'new'));

  const validOrderIds = new Set(orders.filter(o => o.status !== 'deleted' && o.status !== 'cancelled').map(o => o.id));

  // Find tasks belonging to deleted/missing orders
  const tasksForDeletedOrders = tasks.filter(t => t.order_id && !validOrderIds.has(t.order_id));
  console.log('\nTasks belonging to missing or deleted orders:', tasksForDeletedOrders.length);
  tasksForDeletedOrders.forEach(t => console.log(`   Task ${t.id} | Step: ${t.step} | Status: ${t.status} | OrderId: ${t.order_id}`));

  // Find packaging_boxes belonging to missing/deleted orders or tasks
  const boxesForDeletedOrders = boxes.filter(b => b.order_id && !validOrderIds.has(b.order_id));
  console.log('\nPackaging boxes belonging to missing or deleted orders:', boxesForDeletedOrders.length);

  // Find material_requests for packaging belonging to missing/deleted orders
  const reqsForDeletedOrders = requests.filter(r => r.order_id && !validOrderIds.has(r.order_id));
  console.log('\nMaterial requests belonging to missing or deleted orders:', reqsForDeletedOrders.length);
}

run();
