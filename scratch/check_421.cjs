const https = require('https');

const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const oldId = 'be855eff-fefa-4747-8d36-cb6f6dee16c1';
const validId = 'bc18871b-4659-447c-ba8f-e56bc9a87cd0';

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
  console.log('--- Step 1: Re-pointing order_items from empty ID to valid ID ---');
  const resOrderItems = await sendRequest('PATCH', `order_items?nomenclature_id=eq.${oldId}`, { nomenclature_id: validId });
  console.log('Re-pointed order_items:', resOrderItems);

  console.log('\n--- Step 2: Deleting last empty duplicate ---');
  const resDel = await sendRequest('DELETE', `nomenclatures?id=eq.${oldId}`);
  console.log('Deleted result:', resDel);

  console.log('\n--- Final Verification ---');
  const remaining = await sendRequest('GET', 'nomenclatures?name=eq.Рама (інд.проект 28), F421, Київ К&select=*');
  console.log('Remaining matching nomenclatures count:', remaining.length);
  for (const item of remaining) {
    const boms = await sendRequest('GET', `bom_items?parent_id=eq.${item.id}&select=*`);
    console.log(`Item ID: ${item.id} | Name: ${item.name} | Specification BOM Count: ${boms.length}`);
  }
}

run();
