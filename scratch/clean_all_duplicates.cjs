const https = require('https');

const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

function fetchQuery(path) {
  return new Promise((resolve, reject) => {
    const url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/${path}`;
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
  console.log('--- Fetching all Nomenclatures ---');
  const allNom = await fetchQuery('nomenclatures?select=*');
  console.log('Total nomenclatures in DB:', allNom.length);

  // Group by name
  const nameMap = new Map();
  for (const item of allNom) {
    const normName = item.name ? item.name.trim() : '';
    if (!nameMap.has(normName)) {
      nameMap.set(normName, []);
    }
    nameMap.get(normName).push(item);
  }

  const duplicates = Array.from(nameMap.entries()).filter(([name, items]) => items.length > 1);
  console.log(`Found ${duplicates.length} nomenclature names with duplicates:\n`);

  let totalDeleted = 0;

  for (const [name, items] of duplicates) {
    console.log(`========================================`);
    console.log(`Duplicate Name: "${name}" (${items.length} records)`);
    
    // Evaluate each item in group
    const enriched = [];
    for (const item of items) {
      const boms = await fetchQuery(`bom_items?parent_id=eq.${item.id}&select=id`);
      const orders = await fetchQuery(`orders?nomenclature_id=eq.${item.id}&select=id`);
      const orderItems = await fetchQuery(`order_items?nomenclature_id=eq.${item.id}&select=id`);
      const workCards = await fetchQuery(`work_cards?nomenclature_id=eq.${item.id}&select=id`);

      enriched.push({
        ...item,
        bomCount: Array.isArray(boms) ? boms.length : 0,
        orderCount: (Array.isArray(orders) ? orders.length : 0) + (Array.isArray(orderItems) ? orderItems.length : 0),
        workCardCount: Array.isArray(workCards) ? workCards.length : 0
      });
    }

    // Sort by bomCount DESC, orderCount DESC, created_at DESC
    enriched.sort((a, b) => {
      if (b.bomCount !== a.bomCount) return b.bomCount - a.bomCount;
      if (b.orderCount !== a.orderCount) return b.orderCount - a.orderCount;
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

    const winner = enriched[0];
    const losers = enriched.slice(1);

    console.log(`Winner ID: ${winner.id} | BOM count: ${winner.bomCount} | Orders: ${winner.orderCount}`);
    console.log(`Losers to remove: ${losers.length}`);

    for (const loser of losers) {
      console.log(`  - Re-pointing references from loser ${loser.id} (BOM: ${loser.bomCount}) to winner ${winner.id}...`);
      
      await sendRequest('PATCH', `orders?nomenclature_id=eq.${loser.id}`, { nomenclature_id: winner.id });
      await sendRequest('PATCH', `order_items?nomenclature_id=eq.${loser.id}`, { nomenclature_id: winner.id });
      await sendRequest('PATCH', `work_cards?nomenclature_id=eq.${loser.id}`, { nomenclature_id: winner.id });
      await sendRequest('PATCH', `inventory?nomenclature_id=eq.${loser.id}`, { nomenclature_id: winner.id });
      await sendRequest('DELETE', `nomenclature_catalog_profiles?nomenclature_id=eq.${loser.id}`);
      
      const delRes = await sendRequest('DELETE', `nomenclatures?id=eq.${loser.id}`);
      if (Array.isArray(delRes) && delRes.length > 0) {
        console.log(`  ✓ Successfully deleted loser ${loser.id}`);
        totalDeleted++;
      } else {
        console.log(`  ❌ Failed to delete loser ${loser.id}:`, delRes);
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`FINISHED! Total duplicate records deleted: ${totalDeleted}`);
}

run();
