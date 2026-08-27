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

  const orderIds = new Set(orders.map(o => o.id));
  const activeOrderIds = new Set(orders.filter(o => o.status !== 'deleted' && o.status !== 'cancelled').map(o => o.id));
  const taskIds = new Set(tasks.map(t => t.id));

  console.log('Total Orders:', orders.length);
  console.log('Deleted/Cancelled Orders:', orders.filter(o => o.status === 'deleted' || o.status === 'cancelled').map(o => ({ id: o.id, num: o.order_num, status: o.status })));

  console.log('\n--- Orphan Tasks (order_id missing or order deleted) ---');
  const orphanTasks = tasks.filter(t => t.order_id && (!orderIds.has(t.order_id) || !activeOrderIds.has(t.order_id)));
  console.log('Count:', orphanTasks.length);
  console.log(orphanTasks.map(t => ({ id: t.id, order_id: t.order_id, step: t.step, status: t.status })));

  console.log('\n--- Orphan Packaging Boxes (order_id missing or order deleted or task missing) ---');
  const orphanBoxes = boxes.filter(b => (b.order_id && !activeOrderIds.has(b.order_id)) || (b.task_id && !taskIds.has(b.task_id)));
  console.log('Count:', orphanBoxes.length);
  console.log(orphanBoxes);

  console.log('\n--- Orphan Material Requests (order_id missing or deleted) ---');
  const orphanReqs = requests.filter(r => r.details?.includes('КОМПЛЕКТУВАННЯ') && r.order_id && !activeOrderIds.has(r.order_id));
  console.log('Count:', orphanReqs.length);
  console.log(orphanReqs);
}

run();
