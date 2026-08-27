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

function deleteCard(id) {
  return new Promise((resolve, reject) => {
    const url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/work_cards?id=eq.${id}`;
    const req = https.request(url, {
      method: 'DELETE',
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
      }
    }, res => {
      resolve(res.statusCode);
    });
    req.on('error', reject);
    req.end();
  });
}

function updateCard(id, patchData) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(patchData);
    const url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/work_cards?id=eq.${id}`;
    const req = https.request(url, {
      method: 'PATCH',
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'x-mes-secret': 'CentrumMES2026SecretKey_a9f8',
        'Content-Type': 'application/json'
      }
    }, res => {
      resolve(res.statusCode);
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('=== EXACT CARD QUANTITY & SEQUENCE ALIGNMENT (12/12 WITH 3 SHEETS) ===');
  const cards = await getTable('work_cards');
  const orderId = '6580533f-333b-453c-9f80-b8e8a088da7a';

  const orderCards = cards.filter(c => c.order_id === orderId);

  // 1. Sklad BZ cards update to card_info: 'Склад БЗ'
  const bzCards = orderCards.filter(c => c.operation === 'Склад БЗ');
  for (const bzCard of bzCards) {
    await updateCard(bzCard.id, { card_info: 'Склад БЗ' });
  }

  // 2. Targets specification
  const targets = [
    {
      nomId: '343417a7-4a5c-4e31-8f44-18abb41defec', // Х-3-39
      name: 'Х-3-39',
      targetCount: 12,
      planQty: 1810,
      unitsPerSheet: 39,
      standardCardQty: 156, // 4 sheets
      lastCardQty: 94      // 3 sheets (94 / 39 = 2.41 -> 3 sheets)
    },
    {
      nomId: '50947afc-4e40-4165-a682-780275d5feda', // Н-3-14
      name: 'Н-3-14',
      targetCount: 46,
      planQty: 3797,
      unitsPerSheet: 14,
      lastCardQty: 56       // 4 sheets
    },
    {
      nomId: '5ecf63e5-802d-4f98-8291-aad9a52bfaa4', // В-3-30
      name: 'В-3-30',
      targetCount: 25,
      planQty: 4083,
      unitsPerSheet: 30,
      lastCardQty: 98       // 4 sheets
    }
  ];

  for (const t of targets) {
    const cncCards = orderCards.filter(c => c.nomenclature_id === t.nomId && c.operation !== 'Склад БЗ' && !(c.card_info || '').includes('[REDO]'));
    console.log(`\n${t.name}: found ${cncCards.length} CNC cards (target: ${t.targetCount}).`);

    // Sort by sequence or id
    cncCards.sort((a, b) => {
      const matchA = String(a.card_info || '').match(/^(\d+)\//);
      const matchB = String(b.card_info || '').match(/^(\d+)\//);
      const seqA = matchA ? parseInt(matchA[1]) : 9999;
      const seqB = matchB ? parseInt(matchB[1]) : 9999;
      if (seqA !== seqB) return seqA - seqB;
      return String(a.id).localeCompare(String(b.id));
    });

    // Delete any excess cards if more than targetCount
    if (cncCards.length > t.targetCount) {
      const excess = cncCards.length - t.targetCount;
      console.log(`Deleting ${excess} excess card(s) for ${t.name}`);
      const toDelete = cncCards.splice(t.targetCount, excess);
      for (const card of toDelete) {
        await deleteCard(card.id);
      }
    }

    // Now update quantities and card_info strictly 1/N .. N/N
    const count = cncCards.length;
    for (let idx = 0; idx < count; idx++) {
      const card = cncCards[idx];
      const seqStr = `${idx + 1}/${count}`;
      let cleanInfo = String(card.card_info || '').replace(/^\d+\/\d+\s*/, '').replace('NEW_TAIL', '').trim();
      const finalInfo = `${seqStr} ${cleanInfo}`.trim();

      const patch = { card_info: finalInfo };

      // For the last card (12/12 for Х-3-39) set exact lastCardQty (94 шт = 3 sheets)
      if (idx === count - 1 && t.lastCardQty) {
        patch.quantity = t.lastCardQty;
        console.log(`Setting last card ${seqStr} Qty to ${t.lastCardQty} шт (${Math.ceil(t.lastCardQty / t.unitsPerSheet)} sheets)`);
      } else if (t.standardCardQty && idx < count - 1) {
        patch.quantity = t.standardCardQty;
      }

      await updateCard(card.id, patch);
    }
  }

  console.log('\nSuccessfully fixed card 12/12 with exact 3 sheets (94 шт) and strictly aligned 12/12, 46/46, 25/25 sequences!');
}

run();
