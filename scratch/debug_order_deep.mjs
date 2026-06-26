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
  console.log(`Order: ${order.order_num}, quantity: ${order.quantity}, nom_id: ${order.nomenclature_id}`)

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
      qtyPerParent: plannedSets > 0 ? Math.round((Number(entry.need) || 0) / plannedSets) : (Number(entry.need) || 0)
    }))
  
  const bomNomIds = bomEntries.map(e => e.childId)
  
  const { data: workCards } = await supabase.from('work_cards').select('*').in('task_id', taskIds)
  const { data: inventory } = await supabase.from('inventory').select('*').in('nomenclature_id', bomNomIds)
  const { data: noms } = await supabase.from('nomenclatures').select('id, name, type').in('id', bomNomIds)

  console.log(`\nplannedSets (demand): ${plannedSets}`)
  console.log(`BOM деталей: ${bomEntries.length}`)
  console.log(`Карт: ${workCards?.length}`)
  console.log(`Інвентар рядків: ${inventory?.length}\n`)

  // Show all inventory types
  const invTypes = {}
  inventory?.forEach(i => {
    const key = `type:${i.type}|wh:${i.warehouse}`
    invTypes[key] = (invTypes[key] || 0) + 1
  })
  console.log('Типи інвентаря:')
  Object.entries(invTypes).forEach(([k, v]) => console.log(`  ${k} -> ${v} записів`))

  console.log('\n=== ДЕТАЛЬНИЙ АНАЛІЗ ПО КОЖНІЙ ДЕТАЛІ ===\n')
  
  bomEntries.forEach(bomEntry => {
    const nom = noms?.find(n => String(n.id) === String(bomEntry.childId))
    if (!nom) { console.log(`!! Номенклатура ${bomEntry.childId} не знайдена у типі 'part'!`); return }
    
    const { childId, need, stock, qtyPerParent } = bomEntry
    
    // Work cards
    const taskCards = workCards?.filter(c => taskIds.includes(c.task_id) && String(c.nomenclature_id) === String(childId)) || []
    const cardTotal = taskCards.reduce((s, c) => s + (Number(c.quantity) || 0), 0)
    
    // Card statuses breakdown
    const statusBreakdown = {}
    taskCards.forEach(c => {
      const key = `${c.operation}/${c.status}`
      statusBreakdown[key] = (statusBreakdown[key] || 0) + (Number(c.quantity) || 0)
    })
    
    // Inventory
    const inv = inventory?.filter(i => String(i.nomenclature_id) === String(childId)) || []
    const qSgp = inv.filter(i => i.type === 'finished' || i.warehouse === 'sgp' || i.warehouse === 'SGP').reduce((s, i) => s + (Number(i.total_qty) || 0), 0)
    const qBz = inv.filter(i => i.type === 'bz').reduce((s, i) => s + (Number(i.total_qty) || 0), 0)
    const qPriyInv = inv.filter(i => i.type === 'semi').reduce((s, i) => s + (Number(i.total_qty) || 0), 0)
    const qSortInv = inv.filter(i => i.type === 'semi_shop2').reduce((s, i) => s + (Number(i.total_qty) || 0), 0)
    const qBzShop2 = inv.filter(i => i.type === 'bz_shop2').reduce((s, i) => s + (Number(i.total_qty) || 0), 0)
    const qWipBz = inv.filter(i => i.type === 'wip_bz').reduce((s, i) => s + (Number(i.total_qty) || 0), 0)
    const invTotal = inv.reduce((s, i) => s + (Number(i.total_qty) || 0), 0)
    
    // Sum all tasks snapshot stocks
    let snapshotStockSum = 0
    tasks?.forEach(t => {
      if (t.plan_snapshot && t.plan_snapshot[String(childId)]) {
        snapshotStockSum += (Number(t.plan_snapshot[String(childId)].stock) || 0)
      }
    })
    
    // Total per code in DashboardModule
    const sumVal = cardTotal + qSgp + qBz + qPriyInv + qSortInv + qBzShop2 + qWipBz + snapshotStockSum
    const potentialSets = qtyPerParent > 0 ? Math.floor(sumVal / qtyPerParent) : 0
    
    // What the current UI code checks for bottleneck
    const isBottleneck = potentialSets < plannedSets
    
    console.log(`📦 ${nom.name} (${nom.type})`)
    console.log(`   Потрібно: ${need} шт, qty/к-т: ${qtyPerParent}, plannedSets: ${plannedSets}`)
    console.log(`   Карт усього: ${cardTotal} шт від ${taskCards.length} карт`)
    console.log(`   Інвентар: фінішних(SGP-matched): ${qSgp}, BZ: ${qBz}, semi: ${qPriyInv}, semi_shop2: ${qSortInv}, wip_bz: ${qWipBz}`)
    console.log(`   Snapshot stock: ${stock} (all tasks: ${snapshotStockSum})`)
    console.log(`   SumVal = ${sumVal}, potentialSets = ${potentialSets}`)
    console.log(`   ВУЗЬКЕ МІСЦЕ? ${isBottleneck ? '⛔ ТАК (дефіцит: -' + (need - sumVal) + ')' : '✅ НІ'}`)
    
    if (Object.keys(statusBreakdown).length > 0) {
      console.log(`   Розбивка карт:`)
      Object.entries(statusBreakdown).forEach(([k, v]) => console.log(`     ${k}: ${v} шт`))
    }
    
    console.log(`   Всі типи інвентаря:`)
    inv.forEach(i => console.log(`     type:${i.type}, wh:${i.warehouse}, qty:${i.total_qty}`))
    
    // Now check what the FULL current DashboardModule code would compute
    // The key issue: snapshotStock in DM is the SUM across all tasks
    // But in the UI it uses SINGLE taskWithSnapshot. Let me check both task snapshots
    let taskSnapStocks = {}
    tasks.forEach(t => {
      taskSnapStocks[t.id] = t.plan_snapshot?.[String(childId)]?.stock || 0
    })
    console.log(`   Snapshot stocks per task:`, taskSnapStocks)
    console.log()
  })

  // Show the current UI logic: hasGroup check
  console.log('\n=== ПРОБЛЕМА З hasGroup перевіркою ===')
  console.log(`Продукт (nom_id): ${order.nomenclature_id}`)
  console.log('UI перевіряє: groupedDashboardData.some(g => String(g.id) === String(prodId))')
  console.log('Якщо wipOnly=true, то group.rows повинні бути непусті')
  console.log('Якщо group.rows порожні (немає активних demand), картка не відображається')
  console.log('\nВ нашому випадку:')
  console.log(`  actual (bzReservedSets + completedTasks): 5007 + 0 = 5007`)
  console.log(`  demand: 10000`)
  console.log(`  wip = potential - actual = ? - 5007`)
  
  // Now understand what "wip" means in UI:
  // wip = Math.max(0, trend.potential - trend.actual)
  // trend.potential = minPotential (min potential sets across all BOM parts)
  // trend.actual = sgpInventory = bzReservedSets + completedTasksSets
  
  // bzReservedSets = min(stock/qtyPerParent) across all BOM parts using snapshot stock
  const minStockSets = Math.min(...bomEntries.filter(e => e.qtyPerParent > 0).map(e => Math.floor(e.stock / e.qtyPerParent)))
  console.log(`\n  bzReservedSets = min(stock/qty) = ${minStockSets}`)
  
  // minPotential recalculate
  let minPotential = Infinity
  bomEntries.forEach(bomEntry => {
    const nom = noms?.find(n => String(n.id) === String(bomEntry.childId))
    if (!nom || nom.type !== 'part' || bomEntry.qtyPerParent === 0) return
    
    const taskCards = workCards?.filter(c => taskIds.includes(c.task_id) && String(c.nomenclature_id) === String(bomEntry.childId)) || []
    const cardTotal = taskCards.reduce((s, c) => s + (Number(c.quantity) || 0), 0)
    
    const inv = inventory?.filter(i => String(i.nomenclature_id) === String(bomEntry.childId)) || []
    const qSgp = inv.filter(i => i.type === 'finished' || i.warehouse === 'sgp' || i.warehouse === 'SGP').reduce((s, i) => s + (Number(i.total_qty) || 0), 0)
    const qBz = inv.filter(i => i.type === 'bz').reduce((s, i) => s + (Number(i.total_qty) || 0), 0)
    const qPriyInv = inv.filter(i => i.type === 'semi').reduce((s, i) => s + (Number(i.total_qty) || 0), 0)
    const qSortInv = inv.filter(i => i.type === 'semi_shop2').reduce((s, i) => s + (Number(i.total_qty) || 0), 0)
    const qBzShop2 = inv.filter(i => i.type === 'bz_shop2').reduce((s, i) => s + (Number(i.total_qty) || 0), 0)
    const qWipBz = inv.filter(i => i.type === 'wip_bz').reduce((s, i) => s + (Number(i.total_qty) || 0), 0)
    
    let snapshotStockSum = 0
    tasks?.forEach(t => {
      if (t.plan_snapshot && t.plan_snapshot[String(bomEntry.childId)]) {
        snapshotStockSum += (Number(t.plan_snapshot[String(bomEntry.childId)].stock) || 0)
      }
    })
    
    const sumVal = cardTotal + qSgp + qBz + qPriyInv + qSortInv + qBzShop2 + qWipBz + snapshotStockSum
    const potential = Math.floor(sumVal / bomEntry.qtyPerParent)
    console.log(`  ${nom.name}: sumVal=${sumVal}, qtyPerParent=${bomEntry.qtyPerParent}, potential=${potential}`)
    if (potential < minPotential) minPotential = potential
  })
  console.log(`\n  minPotential = ${minPotential}`)
  console.log(`  sgpInventory (actual) = ${minStockSets}`)
  console.log(`  wip in UI = max(0, ${minPotential} - ${minStockSets}) = ${Math.max(0, minPotential - minStockSets)}`)
  
  // BOTTLENECK CHECK - this is the critical part
  // In UI: potentialSets < totalDemand => bottleneck
  // totalDemand = planned_sets = 10000
  // potentialSets = Math.floor(sumVal / qtyPerProduct)
  console.log(`\n  Перевірка вузьких місць (potentialSets < totalDemand=${plannedSets}):`)
  bomEntries.forEach(bomEntry => {
    const nom = noms?.find(n => String(n.id) === String(bomEntry.childId))
    if (!nom || nom.type !== 'part' || bomEntry.qtyPerParent === 0) return
    
    const taskCards = workCards?.filter(c => taskIds.includes(c.task_id) && String(c.nomenclature_id) === String(bomEntry.childId)) || []
    const cardTotal = taskCards.reduce((s, c) => s + (Number(c.quantity) || 0), 0)
    
    const inv = inventory?.filter(i => String(i.nomenclature_id) === String(bomEntry.childId)) || []
    const qSgp = inv.filter(i => i.type === 'finished' || i.warehouse === 'sgp' || i.warehouse === 'SGP').reduce((s, i) => s + (Number(i.total_qty) || 0), 0)
    
    let snapshotStockSum = 0
    tasks?.forEach(t => {
      if (t.plan_snapshot && t.plan_snapshot[String(bomEntry.childId)]) {
        snapshotStockSum += (Number(t.plan_snapshot[String(bomEntry.childId)].stock) || 0)
      }
    })
    
    const sumVal = cardTotal + qSgp + snapshotStockSum
    const potential = Math.floor(sumVal / bomEntry.qtyPerParent)
    const isBottleneck = potential < plannedSets
    
    console.log(`  ${nom.name}: cards=${cardTotal}, SGP_inv=${qSgp}, snapStock=${snapshotStockSum}`)
    console.log(`    sumVal=${sumVal}, potential=${potential}, needed=${plannedSets} => ${isBottleneck ? '⛔ ВУЗЬКЕ МІСЦЕ!' : '✅ ОК'}`)
  })
}

main().catch(console.error)
