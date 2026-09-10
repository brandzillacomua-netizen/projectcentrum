/**
 * test_v2_sgp_integrity.cjs
 * ──────────────────────────────────────────────────────────────────
 * Діагностика: перевіряємо стан системи ПЕРЕД будь-якими змінами.
 * 1. Чи є rpc_generate_shop2_cards_atomic у БД і яка сигнатура
 * 2. Які nomenclature_id використовуються у work_cards (legacy vs v2)
 * 3. Які inventory-рядки СГП мають legacy nomenclature_id
 * 4. Тест RPC з v2 UUID vs legacy UUID (dry run — без реального INSERT)
 */

const https = require('https')

const SUPABASE_URL = 'https://hurzutjytlcvtbvihnry.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const MES_SECRET = 'CentrumMES2026SecretKey_a9f8'

const headers = {
  'apikey': ANON_KEY,
  'Authorization': 'Bearer ' + ANON_KEY,
  'x-mes-secret': MES_SECRET,
  'Content-Type': 'application/json'
}

function restGet(path) {
  return new Promise((resolve, reject) => {
    const url = `${SUPABASE_URL}/rest/v1/${path}`
    https.get(url, { headers }, res => {
      let body = ''
      res.on('data', c => body += c)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }) }
        catch (e) { resolve({ status: res.statusCode, body }) }
      })
    }).on('error', reject)
  })
}

function callRpc(rpcName, params) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(params)
    const url = `${SUPABASE_URL}/rest/v1/rpc/${rpcName}`
    const req = https.request(url, { method: 'POST', headers }, res => {
      let body = ''
      res.on('data', c => body += c)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }) }
        catch (e) { resolve({ status: res.statusCode, body }) }
      })
    })
    req.on('error', reject)
    req.write(postData)
    req.end()
  })
}

function sep(title) {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  ${title}`)
  console.log('═'.repeat(60))
}

async function run() {
  // ── 1. Отримати всі v2 nomenclature IDs ─────────────────────────
  sep('1. Завантажуємо nomenclatures_v2 (перші 10 для тесту)')
  const v2Res = await restGet('nomenclatures_v2?select=id,name,code&limit=10&order=name')
  const v2List = v2Res.data || []
  console.log(`Статус: ${v2Res.status}, знайдено записів у вибірці: ${v2List.length}`)
  if (v2List.length > 0) {
    console.log('Перший v2 запис:', JSON.stringify(v2List[0]))
  }

  // ── 2. Знайти work_cards з non-v2 nomenclature_id ───────────────
  sep('2. Аналіз work_cards з активним статусом (не completed/cancelled)')
  const wcRes = await restGet(
    'work_cards?select=id,nomenclature_id,operation,status,card_info' +
    '&status=neq.completed&status=neq.cancelled&limit=50&order=created_at.desc'
  )
  const wc = wcRes.data || []
  console.log(`Активних карток (вибірка до 50): ${wc.length}`)

  if (v2List.length > 0) {
    const v2Ids = new Set(v2List.map(n => n.id))
    // Перевіряємо з повним списком v2
    const v2FullRes = await restGet('nomenclatures_v2?select=id&limit=2000')
    const v2FullIds = new Set((v2FullRes.data || []).map(n => n.id))

    const withLegacy = wc.filter(c => c.nomenclature_id && !v2FullIds.has(c.nomenclature_id))
    console.log(`Карток з non-v2 nomenclature_id: ${withLegacy.length}`)
    if (withLegacy.length > 0) {
      console.log('Приклади (перші 3):')
      withLegacy.slice(0, 3).forEach(c => {
        console.log(`  id=${c.id.substring(0,8)}... nom_id=${c.nomenclature_id} op=${c.operation} status=${c.status}`)
      })
    }

    // ── 3. Аналіз inventory (SGP) ──────────────────────────────────
    sep('3. Inventory СГП — перевіряємо nomenclature_id на v2 відповідність')
    const invRes = await restGet(
      "inventory?select=id,nomenclature_id,name,type,warehouse,total_qty" +
      "&or=(warehouse.eq.sgp,type.eq.finished)&limit=100"
    )
    const inv = invRes.data || []
    console.log(`Рядків inventory (sgp/finished): ${inv.length}`)

    const invLegacy = inv.filter(i => i.nomenclature_id && !v2FullIds.has(i.nomenclature_id))
    const invV2 = inv.filter(i => i.nomenclature_id && v2FullIds.has(i.nomenclature_id))
    const invNull = inv.filter(i => !i.nomenclature_id)

    console.log(`  → з v2 nomenclature_id:    ${invV2.length}`)
    console.log(`  → з legacy nomenclature_id: ${invLegacy.length}  ← ЦЕ ПРОБЛЕМА`)
    console.log(`  → без nomenclature_id:      ${invNull.length}`)

    if (invLegacy.length > 0) {
      console.log('\nПриклади legacy inventory (перші 5):')
      invLegacy.slice(0, 5).forEach(i => {
        console.log(`  name="${i.name}" type=${i.type} qty=${i.total_qty} nom_id=${i.nomenclature_id}`)
      })
    }

    // ── 4. Тест RPC rpc_generate_shop2_cards_atomic ────────────────
    sep('4. Тест RPC rpc_generate_shop2_cards_atomic')

    // Знаходимо один v2 nomenclature_id для тесту
    const testV2NomId = v2FullIds.size > 0 ? Array.from(v2FullIds)[0] : null
    // Знаходимо один legacy id (якщо є)
    const testLegacyNomId = invLegacy.length > 0 ? invLegacy[0].nomenclature_id : null

    const dummyCard = {
      task_id: null,
      order_id: null,
      nomenclature_id: null,
      operation: 'Пресування',
      machine: 'TEST',
      quantity: 1,
      card_info: '[TEST] [DRY-RUN]',
      status: 'new',
      completed_at: null,
      is_rework: false
    }

    if (testV2NomId) {
      console.log(`\n→ Тест з v2 UUID: ${testV2NomId}`)
      const res = await callRpc('rpc_generate_shop2_cards_atomic', {
        p_order_id: null,
        p_nomenclature_id: testV2NomId,
        p_cards_payload: [{ ...dummyCard, nomenclature_id: testV2NomId }],
        p_total_qty_to_deduct: 0,
        p_user_id: 'TEST_DRY_RUN'
      })
      console.log(`  Статус: ${res.status}`)
      if (res.status === 400) {
        console.log('  ⚠️  400 навіть з v2 UUID! Проблема в RPC, не в ID.')
        console.log('  Відповідь:', JSON.stringify(res.data).substring(0, 300))
      } else {
        console.log('  ✅ RPC приймає v2 UUID')
        console.log('  Відповідь:', JSON.stringify(res.data).substring(0, 200))
      }
    }

    if (testLegacyNomId) {
      console.log(`\n→ Тест з legacy UUID: ${testLegacyNomId}`)
      const res = await callRpc('rpc_generate_shop2_cards_atomic', {
        p_order_id: null,
        p_nomenclature_id: testLegacyNomId,
        p_cards_payload: [{ ...dummyCard, nomenclature_id: testLegacyNomId }],
        p_total_qty_to_deduct: 0,
        p_user_id: 'TEST_DRY_RUN'
      })
      console.log(`  Статус: ${res.status}`)
      if (res.status === 400) {
        console.log('  ⚠️  400 з legacy UUID — підтверджено FK/check у RPC')
        console.log('  Відповідь:', JSON.stringify(res.data).substring(0, 300))
      } else {
        console.log('  ✅ RPC приймає legacy UUID (RPC не є причиною 400)')
      }
    }

    // ── 5. Перевірити таблицю aliases ─────────────────────────────
    sep('5. Стан таблиці aliases (для резолюції legacy → v2)')
    const aliasRes = await restGet('nomenclature_aliases?select=legacy_id,v2_id&limit=5')
    if (aliasRes.status === 200) {
      console.log(`Alias-таблиця доступна, приклад: ${JSON.stringify(aliasRes.data?.[0])}`)
    } else {
      // Спробувати альтернативну назву
      const aliasRes2 = await restGet('nomenclatures_aliases?select=*&limit=2')
      console.log(`Альтернативна alias-таблиця: статус ${aliasRes2.status}`)
      if (aliasRes2.status !== 200) {
        console.log('  → Alias-таблиця не знайдена під жодною з назв. Резолюція тільки через JS unified list.')
      }
    }
  }

  sep('DONE — дивись вище, визначай що треба фіксити')
  console.log('\nЯкщо inventory legacy > 0 → потрібен SQL backfill')
  console.log('Якщо RPC 400 навіть з v2 UUID → проблема в самому RPC (не в ID)')
  console.log('Якщо RPC 200 з v2 UUID, 400 з legacy → потрібна резолюція на фронті\n')
}

run().catch(console.error)
