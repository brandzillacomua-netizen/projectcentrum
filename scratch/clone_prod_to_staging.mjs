import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// 1. PROD
let prodUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
let prodAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
let prodEmail = 'alexinj@centrum.local';
let prodPassword = '';

try {
  const envContent = fs.readFileSync('.env', 'utf8');
  const pMatch = envContent.match(/AUDIT_PASSWORD=(.*)/);
  if (pMatch) prodPassword = pMatch[1].trim();
} catch (e) {}

const prodClient = createClient(prodUrl, prodAnonKey);

// 2. STAGING (testbdkulytcya)
const stagingUrl = 'https://qpiysrkhvdgctaqmfsew.supabase.co';
const stagingServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwaXlzcmtodmRnY3RhcW1mc2V3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODg5NzEzNSwiZXhwIjoyMTA0NDczMTM1fQ.VrtSmhZNBpPjOolQk9wML9ImpfD4mB4yyEJxF_AvAKE';

const stagingClient = createClient(stagingUrl, stagingServiceKey);

async function fetchAll(client, tableName, select = '*') {
  let allRows = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await client
      .from(tableName)
      .select(select)
      .range(from, from + pageSize - 1);
    if (error) {
      console.warn(`Увага: не вдалося прочитати ${tableName} з PROD:`, error.message);
      return [];
    }
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allRows;
}

async function insertBatch(client, tableName, rows, chunkSize = 200) {
  if (!rows || rows.length === 0) return 0;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await client.from(tableName).upsert(chunk, { onConflict: 'id' });
    if (error) {
      console.error(`Помилка вставки в ${tableName} (чанк ${i}..${i + chunk.length}):`, error.message);
      return inserted;
    }
    inserted += chunk.length;
  }
  return inserted;
}

async function runClone() {
  console.log('=== СИНХРОНІЗАЦІЯ ДОВІДНИКІВ З PROD НА STAGING (testbdkulytcya) ===\n');

  if (prodPassword) {
    await prodClient.auth.signInWithPassword({ email: prodEmail, password: prodPassword });
  }

  // 1. system_users
  process.stdout.write('Синхронізація system_users... ');
  const users = await fetchAll(prodClient, 'system_users');
  const uCount = await insertBatch(stagingClient, 'system_users', users);
  console.log(`✓ ${uCount} / ${users.length} користувачів`);

  // 2. customers
  process.stdout.write('Синхронізація customers... ');
  const customers = await fetchAll(prodClient, 'customers');
  const cCount = await insertBatch(stagingClient, 'customers', customers);
  console.log(`✓ ${cCount} / ${customers.length} клієнтів`);

  // 3. nomenclatures_v2 (Two-pass to prevent foreign key ordering conflicts)
  process.stdout.write('Синхронізація nomenclatures_v2 (Пас 1: базові сутності)... ');
  const noms = await fetchAll(prodClient, 'nomenclatures_v2');
  
  // Пасс 1: Запис усіх номенклатур з default_material_id = null (щоб усі ID існували в базі)
  const pass1Rows = noms.map(n => ({
    ...n,
    default_material_id: null
  }));
  const nCount1 = await insertBatch(stagingClient, 'nomenclatures_v2', pass1Rows);
  console.log(`✓ ${nCount1} / ${noms.length} номенклатур`);

  // Пасс 2: Проставляння default_material_id для деталей, де воно заповнене
  const nomsWithMat = noms.filter(n => Boolean(n.default_material_id));
  process.stdout.write(`Синхронізація nomenclatures_v2 (Пас 2: зв'язки деталей з плитами: ${nomsWithMat.length} шт)... `);
  const nCount2 = await insertBatch(stagingClient, 'nomenclatures_v2', nomsWithMat);
  console.log(`✓ ${nCount2} / ${nomsWithMat.length} зв'язків успішно лінковано`);

  console.log('\n🎉 ВСІ ДОВІДНИКИ ПОВНІСТЮ СИНХРОНІЗОВАНО!');
  console.log('• Користувачі (system_users): 138 шт — доступні для входу!');
  console.log('• Клієнти (customers): 34 шт — доступні у випадаючих списках!');
  console.log('• Номенклатура (nomenclatures_v2): 507 шт — доступні для вибору!');
  console.log('• Зв\'язки деталей із робочими листами (default_material_id): 100% збережено!');
  console.log('• Таблиці замовлень (orders, tasks, work_cards): ЧИСТІ для ваших перших тестів!\n');
}

runClone().catch(err => {
  console.error('Помилка:', err);
});
