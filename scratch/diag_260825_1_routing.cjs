const https = require('https');

const BASE = 'hurzutjytlcvtbvihnry.supabase.co';
const KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

function q(path) {
  return new Promise((resolve, reject) => {
    https.get(`https://${BASE}/rest/v1/${path}`, {
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'x-mes-secret': 'REVOKED_MES_SECRET_DO_NOT_USE' }
    }, res => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

async function run() {
  // 1. Знайти наряд 260825-1
  const orders = await q('orders?select=id,order_num,status&order_num=ilike.*260825*');
  console.log('\n=== НАРЯДИ ~260825 ===');
  if (!Array.isArray(orders)) { console.log('Помилка:', orders); return; }
  orders.forEach(o => console.log(`  ID: ${o.id} | Номер: ${o.order_num} | Статус: ${o.status}`));

  const order = orders.find(o => o.order_num === '260825-1');
  if (!order) { console.log('\n  Наряд 260825-1 НЕ ЗНАЙДЕНО'); return; }
  console.log(`\nЦільовий наряд: id=${order.id}`);

  // 2. Завдання
  const tasks = await q(`tasks?select=id,step,status,batch_index&order_id=eq.${order.id}`);
  console.log('\n=== ЗАВДАННЯ ===');
  if (Array.isArray(tasks)) tasks.forEach(t => console.log(`  ${t.id} | step=${t.step} | batch=${t.batch_index} | status=${t.status}`));

  // 3. Всі запити на матеріали
  const reqs = await q(`material_requests?select=id,status,details,category,target_warehouse,nomenclature_id,quantity&order_id=eq.${order.id}&status=neq.cancelled`);
  console.log(`\n=== ЗАПИТИ НА МАТЕРІАЛИ (${Array.isArray(reqs) ? reqs.length : '?'}) ===`);
  if (!Array.isArray(reqs)) { console.log('Помилка:', reqs); return; }

  reqs.forEach(r => {
    const src    = r.details?.match(/\[PACKAGING_SOURCE:(SGP|BZ|SO)\]/)?.[1];
    const isKit  = r.details?.includes('ЗАПИТ НА КОМПЛЕКТУВАННЯ');
    const cat    = r.category;
    const tw     = r.target_warehouse;

    let route;
    if (tw === 'sgp' || cat === 'hardware')                         route = '→ СГП (явна мітка)';
    else if (tw === 'operational' || cat === 'sheet' || cat === 'cutter') route = '→ СО  (category/target_warehouse!)';
    else if (isKit && src === 'SGP')                                route = '→ СГП (кит. SGP)';
    else if (isKit && src === 'SO')                                 route = '→ СО  (кит. SO!)';
    else if (isKit && !src)                                         route = '→ ??? (кит. БЕЗ МАРКЕРА!)';
    else                                                            route = '→ СО  (за замовч.)';

    console.log(`  [${String(r.status).toUpperCase().padEnd(8)}] ${route}`);
    console.log(`    cat=${cat||'-'} | tw=${tw||'-'} | PACKAGING_SOURCE=${src||'немає'}`);
    console.log(`    details: ${(r.details||'').substring(0,130)}`);
    console.log();
  });
}

run().catch(console.error);
