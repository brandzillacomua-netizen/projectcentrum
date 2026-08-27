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
  console.log('=== INSPECTING CARD QUANTITIES AND SHEET CALCULATIONS ===');
  const cards = await getTable('work_cards');
  const orderId = '6580533f-333b-453c-9f80-b8e8a088da7a';

  const orderCards = cards.filter(c => c.order_id === orderId && c.operation !== 'Склад БЗ');

  const targets = [
    { nomId: '343417a7-4a5c-4e31-8f44-18abb41defec', name: 'Х-3-39', plan: 1810, unitsPerSheet: 39, cap: 4 },
    { nomId: '50947afc-4e40-4165-a682-780275d5feda', name: 'Н-3-14', plan: 3797, unitsPerSheet: 14, cap: 8 },
    { nomId: '5ecf63e5-802d-4f98-8291-aad9a52bfaa4', name: 'В-3-30', plan: 4083, unitsPerSheet: 30, cap: 8 }
  ];

  for (const t of targets) {
    const nomCards = orderCards.filter(c => c.nomenclature_id === t.nomId && !(c.card_info || '').includes('[REDO]'));
    const totalSheetsNeeded = Math.ceil(t.plan / t.unitsPerSheet);

    let generatedSheetsCalc = 0;
    let totalQtyInCards = 0;

    console.log(`\n--- ${t.name} (Plan: ${t.plan}, UnitsPerSheet: ${t.unitsPerSheet}, SheetsNeeded: ${totalSheetsNeeded}) ---`);
    console.log(`Card count: ${nomCards.length}`);

    nomCards.forEach((c, idx) => {
      const q = Number(c.quantity) || 0;
      const sh = Math.ceil(q / t.unitsPerSheet);
      totalQtyInCards += q;
      generatedSheetsCalc += sh;
      console.log(`  Card #${idx + 1} (${c.card_info || c.id}): Qty = ${q} -> ${sh} sheets`);
    });

    const remainingSheets = Math.max(0, totalSheetsNeeded - generatedSheetsCalc);
    const totalTargetLoads = nomCards.length + Math.ceil(remainingSheets / t.cap);

    console.log(`Total Qty in Cards: ${totalQtyInCards} (Plan is ${t.plan})`);
    console.log(`Generated Sheets Calc: ${generatedSheetsCalc} / ${totalSheetsNeeded}`);
    console.log(`Remaining Sheets Calc: ${remainingSheets}`);
    console.log(`Active Cards Count: ${nomCards.length} / Total Target Loads: ${totalTargetLoads}`);
  }
}

run();
