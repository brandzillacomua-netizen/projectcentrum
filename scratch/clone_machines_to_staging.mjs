import { createClient } from '@supabase/supabase-js';

// 1. PROD
const prodUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const prodAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const prod = createClient(prodUrl, prodAnonKey);

// 2. STAGING
const stagingUrl = 'https://qpiysrkhvdgctaqmfsew.supabase.co';
const stagingServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwaXlzcmtodmRnY3RhcW1mc2V3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODg5NzEzNSwiZXhwIjoyMTA0NDczMTM1fQ.VrtSmhZNBpPjOolQk9wML9ImpfD4mB4yyEJxF_AvAKE';
const staging = createClient(stagingUrl, stagingServiceKey);

async function clone() {
  console.log('=== КЛОНУВАННЯ СТАНКІВ ТА ОПЕРАЦІЙ З PROD В STAGING ===\n');

  // 1. Клонування machines
  console.log('1. Читання machines з PROD...');
  const { data: machines, error: mErr } = await prod.from('machines').select('*');
  if (mErr) {
    console.error('Помилка читання machines:', mErr.message);
    return;
  }
  console.log(`✓ Прочитано ${machines.length} верстатів.`);

  console.log('2. Вставка machines у STAGING...');
  const cleanMachines = machines.map(m => ({
    ...m,
    status: 'idle',
    maintenance_pending_since: null,
    maintenance_started_at: null,
    completed_cards_count_since_maintenance: 0
  }));

  const { error: insErr } = await staging.from('machines').upsert(cleanMachines, { onConflict: 'id' });
  if (insErr) {
    console.error('Помилка запису в staging machines:', insErr.message);
    if (insErr.code === 'PGRST205') {
      console.log('\n⚠️ ТАБЛИЦЯ MACHINES ЩЕ НЕ СТВОРЕНА В SUPABASE STAGING!');
      console.log('Будь ласка, виконайте supabase/staging_machines_schema.sql у SQL Editor.');
    }
    return;
  }
  console.log(`✓ Успішно перенесено ${cleanMachines.length} верстатів у тестову базу!\n`);

  // 2. Клонування machine_operations
  console.log('3. Читання machine_operations з PROD...');
  const { data: ops, error: opErr } = await prod.from('machine_operations').select('*');
  if (opErr) {
    console.error('Помилка читання machine_operations:', opErr.message);
    return;
  }
  console.log(`✓ Прочитано ${ops.length} операцій.`);

  console.log('4. Вставка machine_operations у STAGING...');
  const { error: opInsErr } = await staging.from('machine_operations').upsert(ops, { onConflict: 'id' });
  if (opInsErr) {
    console.error('Помилка запису machine_operations:', opInsErr.message);
  } else {
    console.log(`✓ Успішно перенесено ${ops.length} технологічних операцій верстатів!`);
  }

  console.log('\n=== ГОТОВО! УСІ ВЕРСТАТИ ТА ОПЕРАЦІЇ В ТЕСТОВІЙ БАЗІ ===');
}

clone().catch(console.error);
