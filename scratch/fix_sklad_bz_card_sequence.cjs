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
  console.log('=== FIXING SKLAD BZ CARDS AND EXCLUDING THEM FROM CNC CUTTING SEQUENCES ===');
  const cards = await getTable('work_cards');
  const orderId = '6580533f-333b-453c-9f80-b8e8a088da7a';

  const orderCards = cards.filter(c => c.order_id === orderId);

  const targets = [
    { nomId: '343417a7-4a5c-4e31-8f44-18abb41defec', name: 'Х-3-39', cncTarget: 12 },
    { nomId: '50947afc-4e40-4165-a682-780275d5feda', name: 'Н-3-14', cncTarget: 46 },
    { nomId: '5ecf63e5-802d-4f98-8291-aad9a52bfaa4', name: 'В-3-30', cncTarget: 25 }
  ];

  for (const t of targets) {
    const nomCards = orderCards.filter(c => c.nomenclature_id === t.nomId);
    const bzCards = nomCards.filter(c => c.operation === 'Склад БЗ');
    const cncCards = nomCards.filter(c => c.operation !== 'Склад БЗ' && !(c.card_info || '').includes('[REDO]'));

    console.log(`\n${t.name}: found ${bzCards.length} Sklad BZ card(s), ${cncCards.length} CNC cutting card(s) (target: ${t.cncTarget}).`);

    // 1. Update Sklad BZ card info to 'Склад БЗ' (no sequence number)
    for (const bzCard of bzCards) {
      console.log(`Updating Sklad BZ card ID ${bzCard.id} (Qty: ${bzCard.quantity}) card_info -> 'Склад БЗ'`);
      await updateCard(bzCard.id, { card_info: 'Склад БЗ' });
    }

    // 2. If cncCards count > cncTarget, remove the extra tail card that was added
    if (cncCards.length > t.cncTarget) {
      const extraCount = cncCards.length - t.cncTarget;
      console.log(`Need to remove ${extraCount} extra CNC card(s) for ${t.name}`);

      // Sort by created_at descending to remove newest tail card
      cncCards.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      const toRemove = cncCards.slice(0, extraCount);

      for (const rmCard of toRemove) {
        console.log(`Deleting extra tail card: ID ${rmCard.id} | Qty: ${rmCard.quantity}`);
        await deleteCard(rmCard.id);
      }
    }
  }

  // Refetch and re-number CNC cutting cards strictly 1/N ... N/N
  console.log('\n=== RE-NUMBERING CNC CUTTING CARDS STRICTLY 1/N TO N/N ===');
  const freshCards = await getTable('work_cards');
  const freshOrderCards = freshCards.filter(c => c.order_id === orderId);

  for (const t of targets) {
    const nomCncCards = freshOrderCards.filter(c => c.nomenclature_id === t.nomId && c.operation !== 'Склад БЗ' && !(c.card_info || '').includes('[REDO]'));
    
    // Sort CNC cards deterministically by created_at or id so card 1 comes first
    nomCncCards.sort((a, b) => {
      const matchA = String(a.card_info || '').match(/^(\d+)\//);
      const matchB = String(b.card_info || '').match(/^(\d+)\//);
      const seqA = matchA ? parseInt(matchA[1]) : 9999;
      const seqB = matchB ? parseInt(matchB[1]) : 9999;
      if (seqA !== seqB) return seqA - seqB;
      return String(a.id).localeCompare(String(b.id));
    });

    const total = nomCncCards.length;
    console.log(`${t.name}: re-numbering ${total} CNC cutting cards (1/${total} .. ${total}/${total})`);

    for (let idx = 0; idx < total; idx++) {
      const card = nomCncCards[idx];
      const seqStr = `${idx + 1}/${total}`;
      let cleanInfo = String(card.card_info || '').replace(/^\d+\/\d+\s*/, '').replace('NEW_TAIL', '').trim();
      const finalInfo = `${seqStr} ${cleanInfo}`.trim();

      await updateCard(card.id, { card_info: finalInfo });
    }
  }

  console.log('Successfully separated Sklad BZ cards and re-numbered CNC cutting cards strictly 1/12..12/12, 1/46..46/46, 1/25..25/25!');
}

run();
