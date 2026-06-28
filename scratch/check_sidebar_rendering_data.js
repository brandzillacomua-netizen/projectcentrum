import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

function countAsProduced(card) {
  return card.status === 'completed' || card.operation === 'Склад БЗ'
}

async function main() {
  const { data: tasks } = await supabase.from('tasks').select('*, orders(order_num)')
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*')
  const { data: workCards } = await supabase.from('work_cards').select('*')
  const { data: history } = await supabase.from('work_card_history').select('*')

  const activeTaskIds = new Set(tasks.filter(t => t.status !== 'completed').map(t => t.id))
  
  // activeCards contains only non-completed cards
  const activeCards = workCards.filter(c => c.status !== 'completed' && activeTaskIds.has(c.task_id))
  
  // staticCompletedCards
  const completedCards = workCards.filter(c => c.status === 'completed')

  const allCardsCache = [...activeCards, ...completedCards]

  const activeCardIds = new Set(activeCards.map(c => c.id))
  const activeHistory = history.filter(h => h.card_id && activeCardIds.has(h.card_id))
  const staticHistory = history.filter(h => h.card_id && !activeCardIds.has(h.card_id))
  const allHistory = [...staticHistory, ...activeHistory]

  const csCache = {}
  const sCache = {}
  allHistory.forEach(h => {
    csCache[h.card_id] = (csCache[h.card_id] || 0) + (Number(h.scrap_qty) || 0)
    const card = allCardsCache.find(c => c.id === h.card_id)
    if (card) {
      const tid = card.task_id
      const nid = String(card.nomenclature_id)
      if (!sCache[tid]) sCache[tid] = {}
      sCache[tid][nid] = (sCache[tid][nid] || 0) + (Number(h.scrap_qty) || 0)
    }
  })

  // taskShortageMap
  const taskShortageMap = {}
  tasks.forEach(task => {
    if (task.status === 'completed') { taskShortageMap[task.id] = false; return }
    const snapshot = task.plan_snapshot || {}
    const taskScrap = sCache[task.id] || {}
    const taskCards = allCardsCache.filter(c => c.task_id === task.id)

    let hasShortage = false
    Object.keys(snapshot).forEach(nomIdStr => {
      if (hasShortage) return
      const nom = nomenclatures.find(n => String(n.id) === String(nomIdStr))
      if (nom?.type !== 'part') return
      const snap = snapshot[nomIdStr]
      if (!snap) return

      const need = snap.need || 0
      const stockBZ = snap.stock || 0
      const unitsPerSheet = snap.units_per_sheet || 1

      const activeCards = taskCards.filter(c => String(c.nomenclature_id) === String(nomIdStr))
      const activeProductionCards = activeCards.filter(c => c.operation !== 'Склад БЗ')
      if (activeProductionCards.length === 0) return

      const totalSheets = activeCards.reduce((sum, c) => {
        if (c.operation === 'Склад БЗ') return sum
        const cardScrap = csCache[c.id] || 0
        const originalQty = (Number(c.quantity) || 0) + cardScrap
        return sum + (c.actualSheets ? Number(c.actualSheets) : Math.ceil(originalQty / unitsPerSheet))
      }, 0)

      const plannedSheets = snap.sheets || 0
      const totalSheetsMax = Math.max(plannedSheets, totalSheets)
      const totalBZ = (totalSheetsMax * unitsPerSheet) + stockBZ - need
      const groupScrap = taskScrap[nomIdStr] || 0
      const shortage = (totalBZ - groupScrap) < 0 ? Math.abs(totalBZ - groupScrap) : 0

      if (shortage > 0) {
        hasShortage = true
        console.log(`Task: ${task.id} (${task.orders?.order_num}) has shortage for nom ${nom.name}: totalBZ=${totalBZ}, groupScrap=${groupScrap}`)
      }
    })
    taskShortageMap[task.id] = hasShortage
  })

  console.log('Result taskShortageMap:', taskShortageMap)
}

main().catch(console.error)
