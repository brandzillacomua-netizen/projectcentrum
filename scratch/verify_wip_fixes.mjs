import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'REVOKED_MES_SECRET_DO_NOT_USE' } }
})

async function testWipVkyaScrap() {
  const { data: cards } = await supabase.from('work_cards').select('*')
  const { data: tasks } = await supabase.from('tasks').select('*')
  const { data: orders } = await supabase.from('orders').select('*')
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*')
  const { data: bomItems } = await supabase.from('bom_items').select('*')
  const { data: history } = await supabase.from('work_card_history').select('*').gt('scrap_qty', 0)
  const { data: finalScrap } = await supabase.from('vkya_final_scrap_totals').select('*')

  const ordersMap = {}
  orders.forEach(o => { ordersMap[o.id] = o })

  const finalScrapMap = {}
  if (finalScrap) {
    finalScrap.forEach(r => {
      if (!finalScrapMap[r.task_id]) finalScrapMap[r.task_id] = {}
      finalScrapMap[r.task_id][String(r.nomenclature_id)] = Number(r.total_scrap) || 0
    })
  }

  const activeTask = tasks.find(t => ordersMap[t.order_id]?.order_num === '261001-5' && (t.step || '').toLowerCase().includes('розкрій'))
  if (!activeTask) {
    console.log('Task for 261001-5 not found')
    return
  }

  console.log(`=== TASK ${activeTask.id} (Order 261001-5) ===`)

  const orderTasks = tasks.filter(t => t.order_id === activeTask.order_id)
  const orderTaskIds = orderTasks.map(t => t.id)
  const orderCards = cards.filter(c => orderTaskIds.includes(c.task_id))

  const snap = activeTask.plan_snapshot || {}
  Object.keys(snap).forEach(nomId => {
    const nom = nomenclatures.find(n => String(n.id) === nomId)
    if (!nom || nom.type !== 'part') return

    const nomCards = orderCards.filter(c => String(c.nomenclature_id) === nomId)
    const cardIds = new Set(nomCards.map(c => c.id))

    const qScrap = finalScrapMap[activeTask.id]?.[nomId] || 0
    const observedScrap = history.filter(h => h.card_id && cardIds.has(h.card_id)).reduce((s, h) => s + (Number(h.scrap_qty) || 0), 0)
    const qVkya = Math.max(0, observedScrap - qScrap)

    console.log(`Part: ${nom.name.padEnd(30)} | Observed Scrap: ${String(observedScrap).padStart(4)} | Брак Утиль: ${String(qScrap).padStart(4)} | На ВКЯ: ${String(qVkya).padStart(4)}`)
  })
}

testWipVkyaScrap().catch(console.error)
