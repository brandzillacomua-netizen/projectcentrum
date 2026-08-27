const https = require('https');

const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

function callRpc(rpcName, params) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(params);
    const url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/rpc/${rpcName}`;
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'x-mes-secret': 'CentrumMES2026SecretKey_a9f8',
        'Content-Type': 'application/json'
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); } catch (e) { resolve({ status: res.statusCode, body }); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  const result = await callRpc('mes_fulfillment_queue', {
    p_queue: 'packaging',
    p_open_batch_limit: 300,
    p_archive_batch_limit: 60
  });

  console.log('=== RPC mes_fulfillment_queue result ===');
  console.log('Status:', result.status);
  console.log('Data:', JSON.stringify(result.data, null, 2));
}

run();
