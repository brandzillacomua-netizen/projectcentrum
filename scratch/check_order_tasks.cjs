const https = require('https');

const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

function fetchQuery(path) {
  return new Promise((resolve, reject) => {
    const url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/${path}`;
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
  console.log('--- Finding Order 260902-2 ---');
  const orders = await fetchQuery('orders?order_num=eq.260902-2&select=*');
  console.log('Orders found:', orders);

  if (orders.length > 0) {
    const orderId = orders[0].id;
    console.log(`\n--- Finding tasks for order_id: ${orderId} ---`);
    const tasks = await fetchQuery(`tasks?order_id=eq.${orderId}&select=*`);
    console.log('Tasks found:', tasks);
  }
}

run();
