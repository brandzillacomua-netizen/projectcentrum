import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  const { data: orders } = await supabase.from('orders').select('*').ilike('order_num', '%22062026-03%')
  const order = orders[0]
  const orderId = order.id

  const { data: tasks } = await supabase.from('tasks').select('*').eq('order_id', orderId)
  const taskIds = tasks.map(t => t.id)
  const taskWithSnapshot = tasks.find(t => t.plan_snapshot && Object.keys(t.plan_snapshot).some(k => uuidRegex.test(k)))
  const plannedSets = Number(taskWithSnapshot?.planned_sets) || 1

  const bomEntries = Object.entries(taskWithSnapshot.plan_snapshot)
    .filter(([k]) => uuidRegex.test(k))
    .map(([childId, entry]) => ({
      childId,
      need: Number(entry.need) || 0,
      stock: Number(entry.stock) || 0,
      qtyPerParent: plannedSets > 0 ? Math.round((Number(entry.need) || 0) / plannedSets) : 0
    }))
    .filter(e => e.qtyPerParent > 0)

  const bomNomIds = bomEntries.map(e => e.childId)
  const { data: workCards } = await supabase.from('work_cards').select('*').in('task_id', taskIds)
  const { data: inventory } = await supabase.from('inventory').select('*').in('nomenclature_id', bomNomIds)
  const { data: noms } = await supabase.from('nomenclatures').select('id, name, type').in('id', bomNomIds)

  console.log(`\n📋 Наряд: ${order.order_num}, статус: ${order.status}, demand: ${plannedSets} к-тів`)
  console.log(`🔧 BOM деталей: ${bomEntries.length}, Карт: ${workCards?.length}, Tasks: ${tasks.length}\n`)

  // Calculate bzReservedSets (actual "На СГП зараз")
  const snapshotMinSets = Math.min(...bomEntries.map(e => Math.floor(e.stock / e.qtyPerParent)))
  const completedSets = tasks.filter(t => t.status === 'completed').reduce((s, t) => s + (Number(t.planned_sets) || 0), 0)
  const sgpInventory = snapshotMinSets + completedSets

  console.log(`✅ На СГП зараз: ${sgpInventory} к-тів (bzReserved=${snapshotMinSets}, completed=${completedSets})`)

  // Simulate FIXED UI calculation
  let minPotential = Infinity
  let minWipSets = Infinity
  const bottlenecksList = []

  console.log('\n=== АНАЛІЗ ПО КОЖНІЙ ДЕТАЛІ (FIXED LOGIC) ===\n')

  bomEntries.forEach(bomEntry => {
    const nom = noms?.find(n => String(n.id) === String(bomEntry.childId))
    if (!nom || nom.type !== 'part') return

    const { childId, qtyPerParent, stock } = bomEntry
    const snapshotStock = stock // From ONE task (taskWithSnapshot)

    const taskCards = workCards?.filter(c => taskIds.includes(c.task_id) && String(c.nomenclature_id) === String(childId)) || []

    const qCutWait = taskCards.filter(c => c.operation === 'Розкрій' && c.status === 'new').reduce((s, c) => s + (Number(c.quantity) || 0), 0)
    const qCut = taskCards.filter(c => c.operation === 'Розкрій' && c.status === 'in-progress').reduce((s, c) => s + (Number(c.quantity) || 0), 0)
    const qCutBuf = taskCards.filter(c => c.operation === 'Розкрій' && c.status === 'at-buffer').reduce((s, c) => s + (Number(c.quantity) || 0), 0)
    const qGalt = taskCards.filter(c => c.operation === 'Галтовка' && c.status === 'in-progress').reduce((s, c) => s + (Number(c.quantity) || 0), 0)
    const qGaltBuf = taskCards.filter(c => c.operation === 'Галтовка' && c.status === 'at-buffer').reduce((s, c) => s + (Number(c.quantity) || 0), 0)
    const qPriy = taskCards.filter(c => c.operation === 'Прийомка').reduce((s, c) => s + (Number(c.quantity) || 0), 0)
    const qSortAct = taskCards.filter(c => c.operation === 'Сортування' && ['in-progress','at-buffer'].includes(c.status)).reduce((s, c) => s + (Number(c.quantity) || 0), 0)
    const qSortCards = taskCards.filter(c => c.status === 'at-shop2-buffer').reduce((s, c) => s + Math.max(0, (Number(c.quantity) || 0) - (Number(c.used_in_shop2_qty) || 0)), 0)
    const qMalWait = taskCards.filter(c => ['Фарбування','Малярка'].includes(c.operation) && c.status === 'new').reduce((s, c) => s + (Number(c.quantity) || 0), 0)
    const qMal = taskCards.filter(c => ['Фарбування','Малярка'].includes(c.operation) && c.status === 'in-progress').reduce((s, c) => s + (Number(c.quantity) || 0), 0)
    const qMalBuf = taskCards.filter(c => ['Фарбування','Малярка'].includes(c.operation) && c.status === 'at-buffer').reduce((s, c) => s + (Number(c.quantity) || 0), 0)
    const qPres = taskCards.filter(c => c.operation === 'Пресування' && ['new','in-progress'].includes(c.status)).reduce((s, c) => s + (Number(c.quantity) || 0), 0)
    const qPresBuf = taskCards.filter(c => c.operation === 'Пресування' && c.status === 'at-buffer').reduce((s, c) => s + (Number(c.quantity) || 0), 0)
    const qDoop = taskCards.filter(c => c.operation === 'Доопрацювання' && ['new','in-progress'].includes(c.status)).reduce((s, c) => s + (Number(c.quantity) || 0), 0)
    const qDoopBuf = taskCards.filter(c => c.operation === 'Доопрацювання' && c.status === 'at-buffer').reduce((s, c) => s + (Number(c.quantity) || 0), 0)

    const inv = inventory?.filter(i => String(i.nomenclature_id) === String(childId)) || []
    const qBz = inv.filter(i => i.type === 'bz').reduce((s, i) => s + (Number(i.total_qty) || 0), 0)
    const qBzShop2 = inv.filter(i => i.type === 'bz_shop2').reduce((s, i) => s + (Number(i.total_qty) || 0), 0)
    // Note: qSgp (type:finished) EXCLUDED - captured by snapshotStock
    // Note: qSortInv/qPriyInv/qWipBz EXCLUDED - mirror of card statuses

    const activeWipQty = qCutWait + qCut + qCutBuf + qGalt + qGaltBuf + qPriy + qSortAct + qSortCards + qMalWait + qMal + qMalBuf + qPres + qPresBuf + qDoop + qDoopBuf
    const sumVal = activeWipQty + qBz + qBzShop2 + snapshotStock

    const potentialSets = Math.floor(sumVal / qtyPerParent)
    const wipSets = Math.floor(activeWipQty / qtyPerParent) // "В роботі" = only active

    if (potentialSets < minPotential) minPotential = potentialSets
    if (wipSets < minWipSets) minWipSets = wipSets

    const isBottleneck = potentialSets < plannedSets
    if (isBottleneck) {
      bottlenecksList.push({
        name: nom.name,
        potential: potentialSets,
        qty: sumVal,
        needed: plannedSets * qtyPerParent,
        deficit: plannedSets * qtyPerParent - sumVal
      })
    }

    console.log(`📦 ${nom.name}`)
    console.log(`   qty/к-т: ${qtyPerParent}`)
    console.log(`   Активний WIP: ${activeWipQty} шт → ${wipSets} к-тів`)
    console.log(`   BZ/BZShop2: ${qBz}/${qBzShop2}`)
    console.log(`   SnapshotStock (ONE task): ${snapshotStock}`)
    console.log(`   sumVal total: ${sumVal} → ${potentialSets} к-тів`)
    console.log(`   ${isBottleneck ? '⛔ ВУЗЬКЕ МІСЦЕ' : '✅ НІ'}`)
    console.log()
  })

  console.log('\n=== ПІДСУМОК ДЛЯ UI КАРТКИ ===\n')
  const finalWip = minWipSets === Infinity ? 0 : minWipSets
  const remainingDemand = Math.max(0, plannedSets - sgpInventory - finalWip)
  
  console.log(`📊 Наряд №22062026-03 (Рама F10):`)
  console.log(`   🟢 На СГП зараз:    ${sgpInventory} к-тів`)
  console.log(`   🔵 В роботі:        ${finalWip} к-тів`)
  console.log(`   🟡 Залишок потреби: ${remainingDemand} к-тів`)
  console.log(`   📈 Потреба (demand): ${plannedSets} к-тів`)
  console.log(`   minPotential: ${minPotential === Infinity ? 0 : minPotential}`)
  console.log()
  console.log(`⚡ Вузькі місця (${bottlenecksList.length}):`)
  if (bottlenecksList.length === 0) {
    console.log('   ✅ Вузьких місць не виявлено (всі деталі покривають потребу)')
  } else {
    bottlenecksList.forEach((b, i) => {
      console.log(`   ${i+1}. ${b.name}: є ${b.qty} шт (${b.potential} к-тів) < потрібно ${b.needed} шт (${plannedSets} к-тів). Дефіцит: -${b.deficit} шт`)
    })
  }
}

main().catch(console.error)
