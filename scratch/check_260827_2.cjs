const https = require('https');

const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmihncnkiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc3NDAyNzg3OSwiZXhwIjoyMDg5NjAzODc5fQ.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

function sendRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/${path}`;
    const req = https.request(url, {
      method: method,
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'x-mes-secret': 'CentrumMES2026SecretKey_a9f8',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('--- Checking order 260827-2 ---');
  const orders = await sendRequest('GET', 'orders?order_num=eq.260827-2');
  console.log('Order:', orders);
  if (orders && orders.length > 0) {
    const orderId = orders[0].id;
    const tasks = await sendRequest('GET', `tasks?order_id=eq.${orderId}`);
    console.log('Tasks:', tasks.map(t => ({ id: t.id, step: t.step })));
    for (const t of tasks) {
      const cards = await sendRequest('GET', `work_cards?task_id=eq.${t.id}`);
      console.log(`Cards for task ${t.step} (${t.id}): total ${cards.length}`);
      const reworks = cards.filter(c => c.is_rework);
      console.log(`Rework cards count: ${reworks.length}`);
    }
  }
}

run();
