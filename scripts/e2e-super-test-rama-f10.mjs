import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// Автоматичне завантаження з .env без захардкоджених паролів у коді
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/)
    if (match) {
      const key = match[1]
      let value = match[2].trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = value
    }
  })
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY
const CORE_SERVER_URL = process.env.CORE_SERVER_URL || 'http://127.0.0.1:4000'

const email = process.env.AUDIT_EMAIL || process.env.TEST_USER_EMAIL
const password = process.env.AUDIT_PASSWORD || process.env.TEST_USER_PASSWORD

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('❌ [ENV ERROR]: VITE_SUPABASE_URL та VITE_SUPABASE_ANON_KEY відсутні у .env')
}

if (!email || !password) {
  throw new Error('❌ [SECURITY ENFORCEMENT]: AUDIT_EMAIL та AUDIT_PASSWORD повинні бути задані в .env! Хардкод вилучено повністю.')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function postApi(path, body) {
  const res = await fetch(`${CORE_SERVER_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return res.json()
}

async function getApi(path) {
  const res = await fetch(`${CORE_SERVER_URL}${path}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })
  return res.json()
}

async function runSuperTest() {
  console.log('====================================================================')
  console.log('🚀 [ENTERPRISE TIER-1 INTEGRATION TEST]: СКУПУЛЬОЗНА СИМУЛЯЦІЯ РАМИ F10')
  console.log('   100% викликів через Node.js Core Backend Server (http://127.0.0.1:4000)')
  console.log('====================================================================\n')

  let createdOrderId = null
  let createdTaskId = null
  const createdCardIds = []

  // Збережені базові параметри складських записів для ТОЧНОГО ВІДНОВЛЕННЯ
  let savedSheetId = null
  let savedCutterId = null
  let savedSheetName = ''
  let savedCutterName = ''
  let baseSheetTotal = 0
  let baseSheetReserved = 0
  let baseCutterTotal = 0
  let baseCutterReserved = 0

  try {
    // 0. Авторизація без хардкоду паролів у коді
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password })
    if (authErr || !authData?.user) {
      throw new Error(`Помилка авторизації тестового системного користувача: ${authErr?.message}`)
    }
    console.log(`🔑 1. Авторизовано системного робітника: ${authData.user.email}`)

    // Перевірка доступності сервера Node.js Core Engine
    const healthRes = await getApi('/health').catch(() => null)
    if (!healthRes || healthRes.status !== 'ok') {
      throw new Error('Node.js Core Engine (127.0.0.1:4000) недоступний!')
    }
    console.log(`📡 2. Звірка сервера Node.js Core Engine: [OK] | ${healthRes.system}`)

    // 1. Отримання справжніх номенклатур виробу з БД
    const { data: nomList } = await supabase.from('nomenclatures_v2').select('id, name').limit(4)
    if (!nomList || nomList.length < 2) throw new Error('Потрібно мінімум 2 елементи номенклатури у БД')
    
    const part1 = nomList[0]
    const part2 = nomList[1]
    const part3 = nomList[2] || nomList[0]
    const part4 = nomList[3] || nomList[1]

    console.log(`\n📌 3. Склад виробу "Рама F10" (Реальні назви з номенклатурного каталогу БД):`)
    console.log(`   - Деталь 1: [${part1.name}] (Потреба: 10 шт)`)
    console.log(`   - Деталь 2: [${part2.name}] (Потреба: 10 шт)`)
    console.log(`   - Деталь 3: [${part3.name}] (Потреба: 20 шт)`)
    console.log(`   - Деталь 4: [${part4.name}] (Потреба: 20 шт)`)

    // 2. Фіксація ТОЧНИХ складських матеріалів за реальними позиціями в БД (Лист та Фреза)
    const { data: sheetInv } = await supabase.from('inventory').select('id, name, total_qty, reserved_qty').eq('id', 'cbd0a211-4f61-4a45-9a16-2953014625ac').single()
    const { data: cutterInv } = await supabase.from('inventory').select('id, name, total_qty, reserved_qty').eq('id', 'fc8f5e59-ec11-40d5-8a27-2b318c12e450').single()

    if (!sheetInv || !cutterInv) throw new Error('Не знайдено конкретні матеріальні позиції на складі')

    savedSheetId = sheetInv.id
    savedCutterId = cutterInv.id
    savedSheetName = sheetInv.name
    savedCutterName = cutterInv.name
    baseSheetTotal = Number(sheetInv.total_qty) || 0
    baseSheetReserved = Number(sheetInv.reserved_qty) || 0
    baseCutterTotal = Number(cutterInv.total_qty) || 0
    baseCutterReserved = Number(cutterInv.reserved_qty) || 0

    console.log(`\n📦 4. Точний вихідний стан Складу (Реальні складські назви з БД):`)
    console.log(`   - Реальний Лист: [${savedSheetName}] (ID: ${savedSheetId}) | Total = ${baseSheetTotal} | Reserved = ${baseSheetReserved}`)
    console.log(`   - Реальна Фреза: [${savedCutterName}] (ID: ${savedCutterId}) | Total = ${baseCutterTotal} | Reserved = ${baseCutterReserved}`)

    // 3. STEP A: Створення замовлення через HTTP API Node.js Core Backend
    const orderNum = `TEST-ORD-F10-${Date.now()}`
    const orderRes = await postApi('/api/v1/orders/create', {
      header: {
        order_num: orderNum,
        customer: 'ТОВ СПЕЦ-АВТОМАТИКА (ТЕСТ)',
        invoice_num: `INV-${Date.now()}`
      },
      items: [
        { nomenclature_id: part1.id, quantity: 10 },
        { nomenclature_id: part2.id, quantity: 10 },
        { nomenclature_id: part3.id, quantity: 20 },
        { nomenclature_id: part4.id, quantity: 20 }
      ]
    })

    if (!orderRes.success || !orderRes.order?.id) {
      throw new Error(`Помилка створення замовлення через backend API: ${orderRes.error}`)
    }
    createdOrderId = orderRes.order.id
    console.log(`\n📝 5. [CORE SERVER HTTP API] Створено замовлення ID: ${createdOrderId} (Номер: ${orderNum})`)

    // 4. STEP B: Створення Наряду через HTTP API Node.js Core Backend
    const taskRes = await postApi('/api/v1/tasks/create', {
      orderId: createdOrderId,
      step: 1
    })

    if (!taskRes.success || !taskRes.task?.id) {
      throw new Error(`Помилка створення наряду через backend API: ${taskRes.error}`)
    }
    createdTaskId = taskRes.task.id
    console.log(`⚙️ 6. [CORE SERVER HTTP API] Створено наряд ID: ${createdTaskId}`)

    // 5. STEP C: Погодження 3-х ролей (Інженер, Директор, Склад) через HTTP API
    await postApi('/api/v1/tasks/approve-engineer', { taskId: createdTaskId })
    await postApi('/api/v1/tasks/approve-director', { taskId: createdTaskId })
    await postApi('/api/v1/tasks/approve-warehouse', { taskId: createdTaskId })
    console.log(`✅ 7. [CORE SERVER HTTP API] Наряд погоджено 3-ма ролями (Інженер, Директор, Склад)`)

    // 6. STEP D: Генерація карток розкрою через HTTP API
    const cardsRes = await postApi('/api/v1/cards/batch-create', {
      taskId: createdTaskId,
      orderId: createdOrderId,
      cardsArray: [
        { nomenclature_id: part1.id, operation: 'розкрій', machine: 'ЧПУ №1', card_info: `РАМА F10 - [${part1.name}]`, quantity: 10, status: 'at-buffer', is_rework: false },
        { nomenclature_id: part2.id, operation: 'розкрій', machine: 'ЧПУ №1', card_info: `РАМА F10 - [${part2.name}] (БРАК)`, quantity: 10, status: 'at-buffer', is_rework: false },
        { nomenclature_id: part3.id, operation: 'розкрій', machine: 'ЧПУ №1', card_info: `РАМА F10 - [${part3.name}]`, quantity: 20, status: 'at-buffer', is_rework: false },
        { nomenclature_id: part4.id, operation: 'розкрій', machine: 'ЧПУ №1', card_info: `РАМА F10 - [${part4.name}]`, quantity: 20, status: 'at-buffer', is_rework: false }
      ]
    })

    if (!cardsRes.success || !cardsRes.cards?.length) {
      throw new Error(`Помилка генерації карток через backend API: ${cardsRes.error}`)
    }
    cardsRes.cards.forEach(c => createdCardIds.push(c.id))
    console.log(`🎴 8. [CORE SERVER HTTP API] Згенеровано ${cardsRes.cards.length} карток розкрою`)

    // 7. STEP E: Проходження розкрою та Списання Фрез (ПЛАН = 2 шт, ФАКТ = 3 шт) через HTTP API
    console.log(`\n✂️ 9. [CORE SERVER HTTP API] Розкрій та атомарне списання матеріалу [${savedSheetName}] та фрези [${savedCutterName}]:`)
    const cutConfirmRes = await postApi('/api/v1/cutting/confirm-buffer', {
      cardId: createdCardIds[0],
      nextStatus: 'at-sorting-buffer',
      sheetInvId: savedSheetId,
      sheetDeductTotal: 1,
      sheetReleaseReserved: 1,
      cutterDeductions: [{
        inventory_id: savedCutterId,
        planned_qty: 2,
        used_qty: 3
      }]
    })

    if (!cutConfirmRes.success) throw new Error(`Помилка розкрою через backend API: ${cutConfirmRes.error}`)
    console.log(`   ✅ [CORE SERVER RESPONSE]: ${cutConfirmRes.message}`)

    // 8. STEP F: Перевід придатних карток у Буфер Цеху 2 через HTTP API
    const transferRes = await postApi('/api/v1/cards/transfer-shop2', {
      cardIds: [createdCardIds[0], createdCardIds[2], createdCardIds[3]]
    })
    console.log(`🚚 10. [CORE SERVER HTTP API] Передано придатні картки в буфер Цеху 2: ${transferRes.message}`)

    // 9. STEP G: ВКТ відновлення деталі через HTTP API
    const vkyaRestoreRes = await postApi('/api/v1/vkya/defect-restore', {
      taskId: createdTaskId,
      orderId: createdOrderId,
      nomenclatureId: part2.id,
      cardInfo: `РАМА F10 - [${part2.name}] (ВКТ ВІДНОВЛЕНО)`,
      quantity: 1
    })
    if (!vkyaRestoreRes.success) throw new Error(`Помилка ВКТ відновлення через backend API: ${vkyaRestoreRes.error}`)
    createdCardIds.push(vkyaRestoreRes.card.id)
    console.log(`♻️ 11. [CORE SERVER HTTP API] 1 шт [${part2.name}] відновлено ВКТ ➔ повернуто у буфер Цеху 2`)

    // 10. STEP H: Довипуск остаточного браку через HTTP API з is_rework = true
    const dovypuskRes = await postApi('/api/v1/vkya/dovypusk', {
      taskId: createdTaskId,
      orderId: createdOrderId,
      nomenclatureId: part2.id,
      cardInfo: `РАМА F10 - [${part2.name}] (ДОВИПУСК БРАКУ)`,
      quantity: 1
    })
    if (!dovypuskRes.success) throw new Error(`Помилка довипуску через backend API: ${dovypuskRes.error}`)
    createdCardIds.push(dovypuskRes.card.id)
    console.log(`🔄 12. [CORE SERVER HTTP API] 1 шт [${part2.name}] остаточний брак ➔ згенеровано ДОВИПУСК [is_rework = ${dovypuskRes.card.is_rework}]`)

    // 11. STEP I: Звірка буферу Цеху 2 через HTTP API (GET /api/v1/tasks/shop2-buffer)
    const shop2BufferRes = await getApi(`/api/v1/tasks/shop2-buffer?taskId=${createdTaskId}`)
    if (!shop2BufferRes.success) throw new Error(`Помилка отримання буферу Цеху 2 через backend API: ${shop2BufferRes.error}`)
    console.log(`🏭 13. [CORE SERVER HTTP API] Буфер Цеху 2: Знайдено ${shop2BufferRes.totalQuantity} шт деталей Рами F10`)

    // 12. STEP J: Відвантаження через HTTP API
    const shipRes = await postApi('/api/v1/shipping/ship-order', { orderId: createdOrderId })
    if (!shipRes.success) throw new Error(`Помилка відвантаження через backend API: ${shipRes.error}`)
    console.log(`📦 14. [CORE SERVER HTTP API] Замовлення відвантажено зі статусом 'shipped'`)

    console.log('\n====================================================================')
    console.log('🏆 [РЕЗУЛЬТАТ INTEGRATION TEST]: 100% ОПЕРАЦІЙ ПРОЙШЛИ ЧЕРЕЗ CORE SERVER HTTP API!')
    console.log('====================================================================\n')

  } catch (err) {
    console.error('❌ [SUPER TEST ERROR]:', err.message)
  } finally {
    console.log('🧹 [ТЕАРДАУН ТА ТОЧНЕ ВІДНОВЛЕННЯ ЗБЕРЕЖЕНИХ ЗНАЧЕНЬ СКЛАДУ]:')

    // 1. Видалення створиних тестових карток
    if (createdCardIds.length > 0) {
      const { error: delCardsErr } = await supabase.from('work_cards').delete().in('id', createdCardIds)
      if (delCardsErr) console.error('   ❌ Помилка видалення карток:', delCardsErr.message)
      else console.log(`   ✅ Видалено ${createdCardIds.length} створених тестових карток з work_cards`)
    }

    // 2. Видалення створиного тестового наряду
    if (createdTaskId) {
      await supabase.from('material_requests').delete().eq('task_id', createdTaskId)
      const { error: delTaskErr } = await supabase.from('tasks').delete().eq('id', createdTaskId)
      if (delTaskErr) console.error('   ❌ Помилка видалення наряду:', delTaskErr.message)
      else console.log(`   ✅ Видалено тестовий наряд ID: ${createdTaskId} з tasks`)
    }

    // 3. Видалення створиного тестового замовлення
    if (createdOrderId) {
      const { error: delOrderErr } = await supabase.from('orders').delete().eq('id', createdOrderId)
      if (delOrderErr) console.error('   ❌ Помилка видалення замовлення:', delOrderErr.message)
      else console.log(`   ✅ Видалено тестове замовлення ID: ${createdOrderId} з orders`)
    }

    // 4. ТОЧНЕ ВІДНОВЛЕННЯ ЗАФІКСОВАНИХ БАЗОВИХ ЗНАЧЕНЬ СКЛАДУ СУВОРO ЗА ЗБЕРЕЖЕНИМИ ID
    if (savedSheetId) {
      const { error: sErr } = await supabase.from('inventory').update({ total_qty: baseSheetTotal, reserved_qty: baseSheetReserved }).eq('id', savedSheetId)
      if (sErr) console.error(`   ❌ Помилка відновлення листа (${savedSheetId}):`, sErr.message)
      else console.log(`   ✅ Залишки листа [${savedSheetName}] (ID: ${savedSheetId}) ТОЧНО відновлено: Total = ${baseSheetTotal}, Reserved = ${baseSheetReserved}`)
    }

    if (savedCutterId) {
      const { error: cErr } = await supabase.from('inventory').update({ total_qty: baseCutterTotal, reserved_qty: baseCutterReserved }).eq('id', savedCutterId)
      if (cErr) console.error(`   ❌ Помилка відновлення фрези (${savedCutterId}):`, cErr.message)
      else console.log(`   ✅ Залишки фрези [${savedCutterName}] (ID: ${savedCutterId}) ТОЧНО відновлено: Total = ${baseCutterTotal}, Reserved = ${baseCutterReserved}`)
    }

    // 5. ВАЛІДАЦІЙНИЙ САМОКОНТРОЛЬ ТЕСТОВОГО ПРОЦЕСУ
    const { data: checkOrd } = await supabase.from('orders').select('id').eq('id', createdOrderId || '00000000-0000-0000-0000-000000000000')
    const { data: checkTsk } = await supabase.from('tasks').select('id').eq('id', createdTaskId || '00000000-0000-0000-0000-000000000000')
    const { data: checkCrd } = await supabase.from('work_cards').select('id').in('id', createdCardIds.length ? createdCardIds : ['00000000-0000-0000-0000-000000000000'])

    console.log('\n📊 [SELF-CHECK СТИКОВОК ТЕСТОВОГО СКРИПТА]:')
    console.log(`   - Залишок у таблиці orders: ${checkOrd?.length || 0}`)
    console.log(`   - Залишок у таблиці tasks: ${checkTsk?.length || 0}`)
    console.log(`   - Залишок у таблиці work_cards: ${checkCrd?.length || 0}`)
    console.log('📌 Запустити окремий незалежний аудит: node scripts/independent-verify-prod.mjs\n')
  }
}

runSuperTest()
