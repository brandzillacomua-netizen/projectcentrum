const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const h = { apikey: key, Authorization: 'Bearer ' + key, 'x-mes-secret': 'REVOKED_MES_SECRET_DO_NOT_USE' };

const ORDER_NUM = '260825-1';

// 1. all material_requests with КОМПЛЕКТУВАННЯ
const r1 = await fetch(url + '/rest/v1/material_requests?select=id,order_id,status,details,category,target_warehouse&details=like.*КОМПЛЕКТУВАННЯ*', { headers: h });
const allKit = await r1.json();
const matched = Array.isArray(allKit) ? allKit.filter(x => (x.details||'').includes('260825')) : [];
console.log(`=== КІТТИНГ запити для ${ORDER_NUM}: знайдено ${matched.length} ===`);
matched.forEach(req => {
  const src = req.details?.match(/\[PACKAGING_SOURCE:(SGP|BZ|SO)\]/)?.[1];
  let route;
  if (req.target_warehouse === 'sgp' || req.category === 'hardware') route = 'SGP (явна мітка)';
  else if (req.target_warehouse === 'operational' || req.category === 'sheet' || req.category === 'cutter') route = '!!! СО (category/tw override !!!)';
  else if (src === 'SGP') route = 'SGP (PACKAGING_SOURCE:SGP)';
  else if (src === 'SO')  route = '!!! СО (PACKAGING_SOURCE:SO !!!)';
  else if (src === 'BZ')  route = 'SGP/BZ (PACKAGING_SOURCE:BZ)';
  else                    route = '!!! СО за замовч. (НЕМАЄ МАРКЕРА !!!)';
  console.log(`  [${req.status}] --> ${route}`);
  console.log(`    details: ${(req.details||'').substring(0, 160)}`);
  console.log();
});

if (matched.length === 0) {
  console.log('  Кіттинг запитів НЕ ЗНАЙДЕНО. Перевіряємо всі матеріальні запити з 260825...');
  const r2 = await fetch(url + '/rest/v1/material_requests?select=id,order_id,status,details,category,target_warehouse&details=like.*260825*', { headers: h });
  const all = await r2.json();
  console.log(`  Загальних запитів з 260825 в details: ${Array.isArray(all) ? all.length : '?'}`);
  if (Array.isArray(all)) all.forEach(req => {
    console.log(`  [${req.status}] cat=${req.category} tw=${req.target_warehouse}`);
    console.log(`    ${(req.details||'').substring(0,130)}`);
  });
}
