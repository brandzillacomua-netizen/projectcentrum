import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  // 1) Find the order by order_num
  console.log('\n=== 1. Пошук наряду 22062026-03 ===')
  const { data: orders, error: ordErr } = await supabase
    .from('orders')
    .select('*')
    .ilike('order_num', '%22062026-03%')
  
  if (ordErr) { console.error('Error:', ordErr); return }
  console.log('Знайдено нарядів:', orders?.length)
  orders?.forEach(o => {
    console.log(`  ID: ${o.id}, order_num: ${o.order_num}, status: ${o.status}, nomenclature_id: ${o.nomenclature_id}, quantity: ${o.quantity}`)
    if (o.order_items) console.log('  order_items:', JSON.stringify(o.order_items))
  })

  if (!orders || orders.length === 0) {
    console.log('Наряд не знайдено!')
    return
  }

  const order = orders[0]
  const orderId = order.id
  console.log('\n=== 2. Задачі наряду ===')
  const { data: tasks, error: taskErr } = await supabase
    .from('tasks')
    .select('*')
    .eq('order_id', orderId)
  
  if (taskErr) { console.error('Error:', taskErr); return }
  console.log('Знайдено задач:', tasks?.length)
  tasks?.forEach(t => {
    const snapshotKeys = t.plan_snapshot ? Object.keys(t.plan_snapshot).filter(k => !k.startsWith('_') && !['materialSummary','selectedCutters','consumables'].includes(k)) : []
    console.log(`  Task ID: ${t.id}, status: ${t.status}, planned_sets: ${t.planned_sets}, batch_index: ${t.batch_index}`)
    console.log(`  plan_snapshot keys count: ${snapshotKeys.length}`)
    if (snapshotKeys.length > 0) {
      console.log(`  Перші 5 ключів snapshot:`, snapshotKeys.slice(0, 5))
    }
  })

  if (!tasks || tasks.length === 0) return

  const taskIds = tasks.map(t => t.id)
  const taskWithSnapshot = tasks.find(t => t.plan_snapshot && Object.keys(t.plan_snapshot).some(k => !k.startsWith('_') && !['materialSummary','selectedCutters','consumables'].includes(k)))

  console.log('\n=== 3. Snapshot аналіз ===')
  if (taskWithSnapshot) {
    const plannedSets = Number(taskWithSnapshot.planned_sets) || 1
    console.log(`Task з snapshot: ${taskWithSnapshot.id}, planned_sets: ${plannedSets}`)
    
    const snapshotEntries = Object.entries(taskWithSnapshot.plan_snapshot).filter(([k]) => !k.startsWith('_') && !['materialSummary','selectedCutters','consumables'].includes(k))
    console.log(`Кількість деталей у snapshot: ${snapshotEntries.length}`)
    
    // Show some entries
    snapshotEntries.slice(0, 10).forEach(([childId, entry]) => {
      const qtyPerParent = plannedSets > 0 ? Math.round((entry.need || 0) / plannedSets) : (entry.need || 0)
      console.log(`  NomID: ${childId}, need: ${entry.need}, stock: ${entry.stock}, qty_per_parent: ${qtyPerParent}`)
    })
  } else {
    console.log('УВАГА: Snapshot не знайдено! Буде використано статичний BOM.')
  }

  console.log('\n=== 4. Робочі карти наряду ===')
  const { data: workCards, error: wcErr } = await supabase
    .from('work_cards')
    .select('*')
    .in('task_id', taskIds)
  
  if (wcErr) { console.error('Error:', wcErr); return }
  console.log('Знайдено робочих карт:', workCards?.length)
  
  // Group by nomenclature
  const cardsByNom = {}
  workCards?.forEach(c => {
    const nomId = String(c.nomenclature_id)
    if (!cardsByNom[nomId]) cardsByNom[nomId] = []
    cardsByNom[nomId].push(c)
  })
  console.log('Кількість унікальних номенклатур у картах:', Object.keys(cardsByNom).length)

  console.log('\n=== 5. Інвентар (готова продукція - SGP) ===')
  // Get nomenclature IDs from BOM
  // UUID regex to filter only valid UUID keys
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  let bomNomIds = []
  if (taskWithSnapshot) {
    bomNomIds = Object.keys(taskWithSnapshot.plan_snapshot).filter(k => 
      !k.startsWith('_') && 
      !['materialSummary','selectedCutters','consumables','arrivals'].includes(k) &&
      uuidRegex.test(k)
    )
  }

  if (bomNomIds.length > 0) {
    const { data: inventory, error: invErr } = await supabase
      .from('inventory')
      .select('*')
      .in('nomenclature_id', bomNomIds)
    
    if (invErr) { console.error('Error:', invErr); return }
    console.log('Інвентар записів:', inventory?.length)
    
    const invBySgp = inventory?.filter(i => i.type === 'finished' || i.warehouse === 'sgp' || i.warehouse === 'SGP') || []
    console.log('SGP записів:', invBySgp.length)
    invBySgp.forEach(i => {
      console.log(`  NomID: ${i.nomenclature_id}, qty: ${i.total_qty}, type: ${i.type}, warehouse: ${i.warehouse}`)
    })
  }

  console.log('\n=== 6. Детальний аналіз вузьких місць ===')
  // Get nomenclatures for BOM items
  if (bomNomIds.length === 0 || !taskWithSnapshot) {
    console.log('Немає snapshot - аналіз неможливий')
    return
  }

  const { data: noms, error: nomErr } = await supabase
    .from('nomenclatures')
    .select('id, name, type')
    .in('id', bomNomIds)
  
  if (nomErr) { console.error('Error:', nomErr); return }

  const { data: allInventory, error: allInvErr } = await supabase
    .from('inventory')
    .select('*')
    .in('nomenclature_id', bomNomIds)
  
  const plannedSets = Number(taskWithSnapshot.planned_sets) || 1

  let bottlenecks = []

  noms?.filter(n => n.type === 'part').forEach(nom => {
    const snapshotEntry = taskWithSnapshot.plan_snapshot[String(nom.id)]
    if (!snapshotEntry) return

    const need = Number(snapshotEntry.need) || 0
    const qtyPerProduct = plannedSets > 0 ? Math.round(need / plannedSets) : need
    if (qtyPerProduct === 0) return

    // Cards
    const taskCards = workCards?.filter(c => taskIds.includes(c.task_id) && String(c.nomenclature_id) === String(nom.id)) || []
    
    const qCutWait = taskCards.filter(c => c.operation === 'Розкрій' && c.status === 'new').reduce((s, c) => s + (Number(c.quantity) || 0), 0)
    const qCut = taskCards.filter(c => c.operation === 'Розкрій' && c.status === 'in-progress').reduce((s, c) => s + (Number(c.quantity) || 0), 0)
    const qCutBuf = taskCards.filter(c => c.operation === 'Розкрій' && c.status === 'at-buffer').reduce((s, c) => s + (Number(c.quantity) || 0), 0)
    const qGalt = taskCards.filter(c => c.operation === 'Галтовка' && c.status === 'in-progress').reduce((s, c) => s + (Number(c.quantity) || 0), 0)
    const qGaltBuf = taskCards.filter(c => c.operation === 'Галтовка' && c.status === 'at-buffer').reduce((s, c) => s + (Number(c.quantity) || 0), 0)
    const qPriy = taskCards.filter(c => c.operation === 'Прийомка').reduce((s, c) => s + (Number(c.quantity) || 0), 0)
    const qSortAct = taskCards.filter(c => c.operation === 'Сортування' && ['in-progress','at-buffer'].includes(c.status)).reduce((s, c) => s + (Number(c.quantity) || 0), 0)
    const qSortCards = taskCards.filter(c => c.status === 'at-shop2-buffer').reduce((s, c) => s + Math.max(0, (Number(c.quantity) || 0) - (Number(c.used_in_shop2_qty) || 0)), 0)
    const qMal = taskCards.filter(c => ['Фарбування','Малярка'].includes(c.operation) && ['new','in-progress'].includes(c.status)).reduce((s, c) => s + (Number(c.quantity) || 0), 0)
    const qMalBuf = taskCards.filter(c => ['Фарбування','Малярка'].includes(c.operation) && c.status === 'at-buffer').reduce((s, c) => s + (Number(c.quantity) || 0), 0)
    const qPres = taskCards.filter(c => c.operation === 'Пресування' && ['new','in-progress'].includes(c.status)).reduce((s, c) => s + (Number(c.quantity) || 0), 0)
    const qPresBuf = taskCards.filter(c => c.operation === 'Пресування' && c.status === 'at-buffer').reduce((s, c) => s + (Number(c.quantity) || 0), 0)
    const qDoop = taskCards.filter(c => c.operation === 'Доопрацювання' && ['new','in-progress'].includes(c.status)).reduce((s, c) => s + (Number(c.quantity) || 0), 0)
    const qDoopBuf = taskCards.filter(c => c.operation === 'Доопрацювання' && c.status === 'at-buffer').reduce((s, c) => s + (Number(c.quantity) || 0), 0)

    const inv = allInventory?.filter(i => String(i.nomenclature_id) === String(nom.id)) || []
    const qSgp = inv.filter(i => i.type === 'finished' || i.warehouse === 'sgp' || i.warehouse === 'SGP').reduce((s, i) => s + (Number(i.total_qty) || 0), 0)
    const qBz = inv.filter(i => i.type === 'bz').reduce((s, i) => s + (Number(i.total_qty) || 0), 0)
    const qPriyInv = inv.filter(i => i.type === 'semi').reduce((s, i) => s + (Number(i.total_qty) || 0), 0)
    const qSortInv = inv.filter(i => i.type === 'semi_shop2').reduce((s, i) => s + (Number(i.total_qty) || 0), 0)
    const qBzShop2 = inv.filter(i => i.type === 'bz_shop2').reduce((s, i) => s + (Number(i.total_qty) || 0), 0)
    const qWipBz = inv.filter(i => i.type === 'wip_bz').reduce((s, i) => s + (Number(i.total_qty) || 0), 0)

    let snapshotStock = 0
    tasks?.forEach(t => {
      if (t.plan_snapshot && t.plan_snapshot[String(nom.id)]) {
        snapshotStock += (Number(t.plan_snapshot[String(nom.id)].stock) || 0)
      }
    })

    const sumVal = qCutWait + qCut + qCutBuf + qGalt + qGaltBuf + qPriy + qSortAct + qSortCards + qMal + qMalBuf + qPres + qPresBuf + qDoop + qDoopBuf + qSgp + qBz + qPriyInv + qSortInv + qBzShop2 + qWipBz + snapshotStock

    const potentialSets = Math.floor(sumVal / qtyPerProduct)
    const needed = need // totalDemand * qtyPerProduct = plannedSets * qtyPerProduct ≈ need

    if (potentialSets < plannedSets) {
      bottlenecks.push({
        name: nom.name,
        code: nom.code,
        qtyPerProduct,
        sumVal,
        potentialSets,
        needed,
        deficit: needed - sumVal,
        hasCards: taskCards.length > 0,
        cardBreakdown: { qCutWait, qCut, qCutBuf, qGalt, qGaltBuf, qPriy, qSortAct, qSortCards, qMal, qMalBuf, qPres, qPresBuf, qDoop, qDoopBuf, qSgp, qBz, qPriyInv, qSortInv, snapshotStock }
      })
    }
  })

  bottlenecks.sort((a, b) => a.potentialSets - b.potentialSets)

  console.log(`\nЗнайдено вузьких місць: ${bottlenecks.length} (з ${plannedSets} потрібних комплектів)\n`)
  bottlenecks.forEach((b, i) => {
    console.log(`${i+1}. ${b.name} (${b.code || '-'})`)
    console.log(`   Потрібно: ${b.needed} шт (${b.qtyPerProduct}/к-т), є: ${b.sumVal}, потенційно к-тів: ${b.potentialSets}/${plannedSets}`)
    console.log(`   Дефіцит: -${b.deficit} шт`)
    console.log(`   Карти: ${b.hasCards ? 'є' : 'НЕМАє'}`)
    if (b.hasCards || b.sumVal > 0) {
      const bd = b.cardBreakdown
      const parts = []
      if (bd.qCutWait) parts.push(`CutWait:${bd.qCutWait}`)
      if (bd.qCut) parts.push(`Cut:${bd.qCut}`)
      if (bd.qCutBuf) parts.push(`CutBuf:${bd.qCutBuf}`)
      if (bd.qGalt) parts.push(`Galt:${bd.qGalt}`)
      if (bd.qGaltBuf) parts.push(`GaltBuf:${bd.qGaltBuf}`)
      if (bd.qPriy) parts.push(`Priy:${bd.qPriy}`)
      if (bd.qSortAct) parts.push(`Sort:${bd.qSortAct}`)
      if (bd.qSortCards) parts.push(`SortCards:${bd.qSortCards}`)
      if (bd.qMal) parts.push(`Mal:${bd.qMal}`)
      if (bd.qMalBuf) parts.push(`MalBuf:${bd.qMalBuf}`)
      if (bd.qPres) parts.push(`Pres:${bd.qPres}`)
      if (bd.qSgp) parts.push(`SGP:${bd.qSgp}`)
      if (bd.qBz) parts.push(`BZ:${bd.qBz}`)
      if (bd.qPriyInv) parts.push(`PriyInv:${bd.qPriyInv}`)
      if (bd.qSortInv) parts.push(`SortInv:${bd.qSortInv}`)
      if (bd.snapshotStock) parts.push(`SnapStock:${bd.snapshotStock}`)
      if (parts.length) console.log(`   Де є: ${parts.join(', ')}`)
    }
    console.log()
  })

  // Also show what's in the trend panel: actual (SGP/BZ reserved)
  console.log('\n=== 7. SGP та WIP інфо для наряду (як у UI) ===')
  let bzReservedSets = Infinity
  let hasSnapshot = false
  const snapshotEntries = Object.entries(taskWithSnapshot.plan_snapshot).filter(([k]) => !k.startsWith('_') && !['materialSummary','selectedCutters','consumables'].includes(k))
  
  if (taskWithSnapshot.plan_snapshot) {
    hasSnapshot = true
    snapshotEntries.forEach(([childId, entry]) => {
      const nom = noms?.find(n => String(n.id) === String(childId))
      if (!nom || nom.type !== 'part') return
      const need = Number(entry.need) || 0
      const qtyPerProduct = plannedSets > 0 ? Math.round(need / plannedSets) : need
      if (qtyPerProduct === 0) return
      const stock = Number(entry.stock) || 0
      const sets = Math.floor(stock / qtyPerProduct)
      if (sets < bzReservedSets) bzReservedSets = sets
    })
  }
  if (bzReservedSets === Infinity || !hasSnapshot) bzReservedSets = 0

  const completedTasksSets = tasks?.filter(t => t.status === 'completed').reduce((s, t) => s + (Number(t.planned_sets) || 0), 0) || 0
  const sgpInventory = bzReservedSets + completedTasksSets

  console.log(`bzReservedSets: ${bzReservedSets}`)
  console.log(`completedTasksSets: ${completedTasksSets}`)
  console.log(`sgpInventory (actual у UI): ${sgpInventory}`)
  console.log(`plannedSets (demand у UI): ${plannedSets}`)
  console.log(`WIP у UI: ${Math.max(0, /* потенційний мін */ 0 - sgpInventory)}`)

  // Min potential
  let minPotential = Infinity
  snapshotEntries.forEach(([childId, entry]) => {
    const nom = noms?.find(n => String(n.id) === String(childId))
    if (!nom || nom.type !== 'part') return
    const need = Number(entry.need) || 0
    const qtyPerProduct = plannedSets > 0 ? Math.round(need / plannedSets) : need
    if (qtyPerProduct === 0) return

    const taskCards = workCards?.filter(c => taskIds.includes(c.task_id) && String(c.nomenclature_id) === String(nom.id)) || []
    const inv = allInventory?.filter(i => String(i.nomenclature_id) === String(nom.id)) || []
    const snapshotStock = Number(taskWithSnapshot.plan_snapshot[String(nom.id)]?.stock) || 0

    const qAll = taskCards.reduce((s, c) => s + (Number(c.quantity) || 0), 0)
    const qSgp = inv.filter(i => i.type === 'finished' || i.warehouse === 'sgp' || i.warehouse === 'SGP').reduce((s, i) => s + (Number(i.total_qty) || 0), 0)
    const qBz = inv.filter(i => i.type === 'bz').reduce((s, i) => s + (Number(i.total_qty) || 0), 0)
    const qPriyInv = inv.filter(i => i.type === 'semi').reduce((s, i) => s + (Number(i.total_qty) || 0), 0)
    const qSortInv = inv.filter(i => i.type === 'semi_shop2').reduce((s, i) => s + (Number(i.total_qty) || 0), 0)
    const qBzShop2 = inv.filter(i => i.type === 'bz_shop2').reduce((s, i) => s + (Number(i.total_qty) || 0), 0)
    const qWipBz = inv.filter(i => i.type === 'wip_bz').reduce((s, i) => s + (Number(i.total_qty) || 0), 0)

    const sumVal = qAll + qSgp + qBz + qPriyInv + qSortInv + qBzShop2 + qWipBz + snapshotStock
    const potential = Math.floor(sumVal / qtyPerProduct)
    if (potential < minPotential) minPotential = potential
  })

  console.log(`\nМінімальний потенціал (потенційний мін WIP-кількість): ${minPotential === Infinity ? 0 : minPotential}`)
  console.log(`wip у картці: ${Math.max(0, (minPotential === Infinity ? 0 : minPotential) - sgpInventory)}`)
}

main().catch(console.error)
