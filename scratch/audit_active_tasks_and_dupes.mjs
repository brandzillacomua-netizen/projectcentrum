import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function fetchAll(tableName, select = '*') {
  let allRows = []
  let from = 0
  const pageSize = 1000
  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select(select)
      .range(from, from + pageSize - 1)
    
    if (error) {
      throw new Error(`Failed to fetch ${tableName}: ${error.message}`)
    }
    if (!data || data.length === 0) break
    allRows = allRows.concat(data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return allRows
}

async function run() {
  const logLines = []
  const log = (msg = '') => {
    console.log(msg)
    logLines.push(msg)
  }

  log('=== АВТОРИЗАЦІЯ В CENTRUM MES... ===')
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: '12345'
  })
  if (authErr) {
    throw new Error(`Auth failed: ${authErr.message}`)
  }
  log(`✓ Успішний вхід як ${authData.user.email} (ID: ${authData.user.id})\n`)

  log('=== АУДИТ АКТИВНИХ ТА ДУБЛЬОВАНИХ НАРЯДІВ І ЗАВДАНЬ ===\n')

  const [orders, tasks, workCards, materialRequests] = await Promise.all([
    fetchAll('orders', '*'),
    fetchAll('tasks', '*'),
    fetchAll('work_cards', '*'),
    fetchAll('material_requests', '*')
  ])

  const orderMap = new Map(orders.map(o => [String(o.id), o]))

  // 1. Останні замовлення
  log('--- 1. ОСТАННІ 15 ЗАМОВЛЕНЬ ---')
  const sortedOrders = [...orders].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
  sortedOrders.slice(0, 15).forEach(o => {
    log(`  - ${o.order_num} [ID: ${o.id}] status=${o.status} created=${o.created_at}`)
  })

  // 2. Пошук дублів завдань по всіх замовленнях
  log('\n--- 2. ПОШУК ДУБЛЬОВАНИХ ЗАВДАНЬ (TASKS) ДЛЯ ОДНОГО ЗАМОВЛЕННЯ ---')
  const tasksByOrder = {}
  tasks.forEach(t => {
    if (!t.order_id) return
    const key = String(t.order_id)
    if (!tasksByOrder[key]) tasksByOrder[key] = []
    tasksByOrder[key].push(t)
  })

  let dupeTaskCount = 0
  for (const [orderId, tList] of Object.entries(tasksByOrder)) {
    const order = orderMap.get(orderId)
    const orderNum = order?.order_num || `Order-${orderId.substring(0, 8)}`
    
    // Групуємо за етапом (step)
    const byStep = {}
    tList.forEach(t => {
      const stepKey = (t.step || 'Без етапу').trim()
      if (!byStep[stepKey]) byStep[stepKey] = []
      byStep[stepKey].push(t)
    })

    for (const [step, stepTasks] of Object.entries(byStep)) {
      const activeStepTasks = stepTasks.filter(t => t.status !== 'completed' && t.status !== 'canceled')
      if (activeStepTasks.length > 1) {
        dupeTaskCount++
        log(`⚠️ ДУБЛЬ ЕТАПУ [${step}] у замовленні ${orderNum} (ID: ${orderId}): ${activeStepTasks.length} активних завдань!`)
        activeStepTasks.forEach(t => {
          const cards = workCards.filter(c => String(c.task_id) === String(t.id))
          log(`     -> Task ${t.id}: status=${t.status}, created=${t.created_at}, machine=${t.assigned_machine || t.machine_id || 'None'}, cards=${cards.length}`)
        })
      }
    }
  }
  if (dupeTaskCount === 0) {
    log('✓ Дублів активних завдань на однаковий етап не знайдено.')
  }

  // 3. Активні завдання на невідповідних верстатах / пакування на ЧПК
  log('\n--- 3. ЗАВДАННЯ З НЕВІДПОВІДНИМИ ЕТАПАМИ / ВЕРСТАТАМИ ---')
  const abnormalTasks = tasks.filter(t => {
    if (t.status === 'completed' || t.status === 'canceled') return false
    const stepLower = (t.step || '').toLowerCase()
    const machLower = (t.assigned_machine || t.machine_id || '').toLowerCase()
    
    const isPackOnCnc = stepLower.includes('пакув') && (machLower.includes('cnc') || machLower.includes('фея') || machLower.includes('дракон'))
    const isCncWithPack = (stepLower.includes('розкрій') || stepLower.includes('чпк')) && machLower.includes('pack')
    const isPackTermActive = machLower.includes('pack-term')
    return isPackOnCnc || isCncWithPack || isPackTermActive
  })

  if (abnormalTasks.length > 0) {
    log(`Знайдено ${abnormalTasks.length} завдань з конфліктом етапу/верстата:`)
    abnormalTasks.forEach(t => {
      const order = orderMap.get(String(t.order_id))
      log(`  - Task ${t.id}: order=${order?.order_num || t.order_id}, step=[${t.step}], machine=[${t.assigned_machine || t.machine_id}], status=${t.status}`)
    })
  } else {
    log('✓ Завдань із прямим конфліктом верстат-етап не знайдено.')
  }

  // 4. Пошук карток-дублів (work_cards)
  log('\n--- 4. ПОШУК ДУБЛЬОВАНИХ АКТИВНИХ КАРТОК (WORK_CARDS) ---')
  const activeCards = workCards.filter(c => c.status !== 'completed' && c.status !== 'archived' && c.status !== 'canceled')
  log(`Всього активних карток у системі: ${activeCards.length}`)

  const cardsGrouped = {}
  activeCards.forEach(c => {
    const key = `${c.task_id}_${c.nomenclature_id}_${c.operation || 'new'}`
    if (!cardsGrouped[key]) cardsGrouped[key] = []
    cardsGrouped[key].push(c)
  })

  let dupeCardsGroupCount = 0
  for (const [key, cList] of Object.entries(cardsGrouped)) {
    if (cList.length > 1) {
      dupeCardsGroupCount++
      const cSample = cList[0]
      const order = orderMap.get(String(cSample.order_id))
      log(`⚠️ Потенційний дубль карток (${cList.length} шт.): order=${order?.order_num}, task=${cSample.task_id}, nom=${cSample.nomenclature_id}, op=${cSample.operation}`)
      cList.forEach(c => log(`     -> Card ${c.id}: qty=${c.quantity}, sheets=${c.actual_sheets}, status=${c.status}, created=${c.created_at}`))
    }
  }
  if (dupeCardsGroupCount === 0) {
    log('✓ Дублів карток на однакову деталь в одному завданні не знайдено.')
  }

  // 5. Завдання-сироти (без діючого замовлення)
  log('\n--- 5. ЗАВДАННЯ-СИРОТИ (БЕЗ ДІЮЧОГО ЗАМОВЛЕННЯ) ---')
  const orphanTasks = tasks.filter(t => t.order_id && !orderMap.has(String(t.order_id)) && t.status !== 'completed' && t.status !== 'canceled')
  if (orphanTasks.length > 0) {
    log(`⚠️ Знайдено ${orphanTasks.length} активних завдань без замовлення:`)
    orphanTasks.forEach(t => log(`  - Task ${t.id}: step=${t.step}, order_id=${t.order_id}`))
  } else {
    log('✓ Завдань-сиріт без замовлення не виявлено.')
  }

  // 6. Активні завдання на верстатах ЧПК (Цех 1)
  log('\n--- 6. АКТИВНІ ЗАВДАННЯ НА ДОШЦІ ЧПК (ЦЕХ 1) ---')
  const cncActiveTasks = tasks.filter(t => {
    if (t.status === 'completed' || t.status === 'canceled') return false
    const step = (t.step || '').toLowerCase()
    const mach = (t.assigned_machine || t.machine_id || '').toLowerCase()
    return step.includes('розкрій') || step.includes('чпк') || mach.includes('cnc') || mach.includes('фея') || mach.includes('дракон')
  })
  log(`Активних завдань ЧПК: ${cncActiveTasks.length}`)
  cncActiveTasks.forEach(t => {
    const o = orderMap.get(String(t.order_id))
    const cards = workCards.filter(c => String(c.task_id) === String(t.id))
    log(`  - [${o?.order_num || t.order_id}] Task ${t.id}: step="${t.step}", mach="${t.assigned_machine || t.machine_id}", status="${t.status}", cards=${cards.length}`)
  })

  // 7. Пошук завдань розкрою без карток
  log('\n--- 7. АКТИВНІ ЗАВДАННЯ РОЗКРОЮ БЕЗ КАРТОК ---')
  const emptyCncTasks = cncActiveTasks.filter(t => {
    const cards = workCards.filter(c => String(c.task_id) === String(t.id))
    return cards.length === 0
  })
  if (emptyCncTasks.length > 0) {
    log(`Знайдено ${emptyCncTasks.length} активних завдань розкрою без жодної картки:`)
    emptyCncTasks.forEach(t => {
      const o = orderMap.get(String(t.order_id))
      log(`  - [${o?.order_num || t.order_id}] Task ${t.id}: step="${t.step}", status="${t.status}", mach="${t.assigned_machine || t.machine_id}"`)
    })
  } else {
    log('✓ Всі активні завдання розкрою мають відповідні картки.')
  }

  // 8. Підготовка (Підготовчі наряди) без замовлення
  log('\n--- 8. ПІДГОТОВЧІ ЗАВДАННЯ (ПІДГОТОВКА) ТА ЇХ СТАТУС ---')
  const prepTasks = tasks.filter(t => (t.step || '').toLowerCase().includes('підготов'))
  const activePrepTasks = prepTasks.filter(t => t.status !== 'completed' && t.status !== 'canceled')
  log(`Всього завдань "Підготовка": ${prepTasks.length}, з них активних: ${activePrepTasks.length}`)
  const prepWithoutOrder = activePrepTasks.filter(t => !t.order_id)
  log(`Активних підготовок без прив'язки до замовлення (вільні наряди підготовки): ${prepWithoutOrder.length}`)

  // 9. Останні замовлення за вересень 2026 (260908, 260907, тощо)
  log('\n--- 9. СТАН ОСТАННІХ ЗАМОВЛЕНЬ ЗА ВЕРЕСЕНЬ 2026 ---')
  const sepOrders = orders.filter(o => (o.order_num || '').startsWith('2609'))
  sepOrders.sort((a, b) => (b.order_num || '').localeCompare(a.order_num || ''))
  for (const o of sepOrders) {
    const oTasks = tasks.filter(t => String(t.order_id) === String(o.id))
    const oCards = workCards.filter(c => String(c.order_id) === String(o.id))
    log(`Замовлення ${o.order_num} (status: ${o.status}): ${oTasks.length} завдань, ${oCards.length} карток`)
    oTasks.forEach(t => {
      const tCards = oCards.filter(c => String(c.task_id) === String(t.id))
      log(`   └─ Task ${t.id}: step="${t.step}", status="${t.status}", machine="${t.assigned_machine || t.machine_id}", cards=${tCards.length}`)
    })
  }

  log('\n=== КІНЕЦЬ АУДИТУ ===')
  fs.writeFileSync('scratch/audit_report.txt', logLines.join('\n'), 'utf-8')
}

run().catch(err => {
  console.error('Помилка аудиту:', err)
})
