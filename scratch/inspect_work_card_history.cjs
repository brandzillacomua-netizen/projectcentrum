const https = require('https');

const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

function fetchHistoryRange(from, to) {
  return new Promise((resolve, reject) => {
    const url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/work_card_history?select=*`;
    const req = https.get(url, {
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'x-mes-secret': 'CentrumMES2026SecretKey_a9f8',
        'Range': `${from}-${to}`
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
  console.log('=== CHECKING WORK CARD HISTORY FOR ORIGINAL TIMESTAMPS ===');
  let historyRows = [];
  for (let from = 0; from < 20000; from += 1000) {
    const chunk = await fetchHistoryRange(from, from + 999);
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    historyRows.push(...chunk);
    if (chunk.length < 1000) break;
  }

  console.log('Total work_card_history rows in DB:', historyRows.length);

  const targetCards = [
    '7d759bd4-e98b-4250-9ed5-359c785f2d88',
    '2d0a1dd7-73dc-4740-b6a9-1c0e1f2d9d62',
    '8be42257-7550-4975-99eb-d303bc318dd7',
    '01af2d98-6705-40a4-8d1a-aaeac7907648',
    '49ff1ba6-8c56-4b40-b46e-1c340e44771c'
  ];

  const matched = historyRows.filter(h => targetCards.includes(h.card_id));
  console.log(`Found ${matched.length} history records for target cards:`);
  matched.forEach(h => {
    console.log(`   CardID: ${h.card_id} | Stage: ${h.stage_name} | Operator: ${h.operator_name} | StartedAt: ${h.started_at} | CompletedAt: ${h.completed_at}`);
  });
}

run();
