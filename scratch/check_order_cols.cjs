const https = require('https');

const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

function checkOrderColumns() {
  return new Promise((resolve, reject) => {
    const url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/orders?select=*&limit=1`;
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
        try {
          const rows = JSON.parse(body);
          console.log('Order keys:', Object.keys(rows[0] || {}));
          console.log('Sample order:', rows[0]);
          resolve(rows[0]);
        } catch (e) { resolve(body); }
      });
    });
    req.on('error', reject);
  });
}

checkOrderColumns();
