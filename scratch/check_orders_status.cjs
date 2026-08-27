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

  console.log('=== ORDERS STATUS SUMMARY ===');
  const counts = {};
  orders.forEach(o => {
    counts[o.status] = (counts[o.status] || 0) + 1;
  });
  console.log('Status counts:', counts);

  console.log('\n=== ORDERS DETAILED LIST ===');
  orders.forEach(o => {
    const oTasks = tasks.filter(t => t.order_id === o.id);
    const completedTasks = oTasks.filter(t => t.status === 'completed');
    const isPackaged = oTasks.some(t => t.plan_snapshot?._metadata?.is_packaged === true);
    console.log(`Order: ${o.order_num} (id: ${o.id}) | Status: ${o.status} | Total Tasks: ${oTasks.length} | Completed: ${completedTasks.length} | Packaged: ${isPackaged}`);
  });
}

run();
