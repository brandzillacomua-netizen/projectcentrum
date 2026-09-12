const https = require('https');

const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

function getTable(table) {
  return new Promise((resolve, reject) => {
    const url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/${table}?select=*`;
    const req = https.get(url, {
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'x-mes-secret': 'REVOKED_MES_SECRET_DO_NOT_USE'
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
  const inv = await getTable('inventory');
  console.log('Total inventory items:', inv.length);

  const targets = [
    'Київ К-ІП9-10-П-7-46',
    'Київ К-ІП9/10/31/36/37-9-10-11-В-3-30',
    'Київ К-ІП9/10/31/36/37-9-10-11-Н-3-14',
    'Київ К-ІП9/10/31/36/37-9-10-11-Х-3-39'
  ];

  targets.forEach(t => {
    const found = inv.filter(i => i.name && i.name.includes(t.slice(0, 15)));
    console.log(`\nTarget search "${t}":`, found.length);
    found.forEach(item => {
      console.log(`   ID: ${item.id} | Name: ${item.name} | Qty: ${item.quantity} | Total: ${item.total_units || item.total_quantity} | Wh: ${item.warehouse}`);
    });
  });
}

run();
