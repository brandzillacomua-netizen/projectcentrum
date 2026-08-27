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
  console.log('=== CHECKING WORK CARD OPERATIONS & STATUSES ===');
  const cards = await getTable('work_cards');
  const activeOrderIds = new Set([
    '6580533f-333b-453c-9f80-b8e8a088da7a',
    '50a32d8b-27ca-4037-956c-9bafc8e83e4a'
  ]);

  const targetCards = cards.filter(c => activeOrderIds.has(c.order_id));
  console.log(`Found ${targetCards.length} work cards.`);

  const CHAIN = [
    'Розкрій',
    'Галтовка (Вібростіл)',
    'Галтовка (Мийка)',
    'Галтовка (Галтовка)',
    'Галтовка (Сушка)',
    'Прийомка',
    'Сортування'
  ];

  let invalidOps = 0;
  targetCards.forEach(c => {
    const isNew = c.status === 'new' || !c.operation || c.operation === 'Нова';
    const isInChain = CHAIN.includes(c.operation) || c.operation === 'Галтовка';
    const isSorting = c.status === 'at-buffer' && c.operation === 'Сортування';

    if (!isNew && !isInChain && !isSorting) {
      console.log(`INVALID SHOP 1 CARD: ID ${c.id} | operation: "${c.operation}" | status: "${c.status}" | card_info: "${c.card_info}"`);
      invalidOps++;
    }
  });

  console.log(`Total invalid operations for Shop 1: ${invalidOps}`);
}

run();
