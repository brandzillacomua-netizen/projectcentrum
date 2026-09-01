import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
})

async function checkTask() {
  const { data: tasks, error: tErr } = await supabase.from('tasks').select('*')
  if (tErr) console.error(tErr)

  const { data: orders } = await supabase.from('orders').select('*, order_items(*)')

  const targetOrder = (orders || []).find(o => o.order_num && o.order_num.includes('260820-3'))
  console.log('Target Order:', targetOrder ? { id: targetOrder.id, num: targetOrder.order_num, customer: targetOrder.customer } : 'NOT FOUND')

  const task = (tasks || []).find(t => {
    if (targetOrder && String(t.order_id) === String(targetOrder.id)) return true
    const num = t.order_num || t.plan_snapshot?._prep_num || t.plan_snapshot?._metadata?.order_num
    return (num && num.includes('260820-3')) || String(t.id).includes('260820-3')
  })

  if (!task) {
    console.log('Task 260820-3 not found! Sample orders:', orders?.slice(0, 10).map(o => o.order_num))
    return
  }

  console.log('=== TASK ===')
  console.log('ID:', task.id, 'Order ID:', task.order_id, 'Step:', task.step, 'Status:', task.status, 'PlannedSets:', task.planned_sets)
  console.log('PlanSnapshot metadata:', task.plan_snapshot?._metadata)

  const { data: cards } = await supabase.from('work_cards').select('*').eq('task_id', task.id)
  console.log('\n=== WORK CARDS (total:', cards?.length, ') ===')
  cards?.forEach(c => {
    console.log({
      id: c.id,
      nomenclature_id: c.nomenclature_id,
      status: c.status,
      quantity: c.quantity,
      actual_sheets: c.actual_sheets,
      scrap_qty: c.scrap_qty,
      card_info: c.card_info,
      is_rework: c.is_rework
    })
  })

  const cardIds = (cards || []).map(c => c.id)
  const { data: history } = await supabase.from('work_card_history').select('*').in('card_id', cardIds.length > 0 ? cardIds : ['none'])
  console.log('\n=== WORK CARD HISTORY (total:', history?.length, ') ===')
  history?.forEach(h => {
    console.log({
      card_id: h.card_id,
      nomenclature_id: h.nomenclature_id,
      qty_completed: h.qty_completed,
      scrap_qty: h.scrap_qty,
      stage_name: h.stage_name,
      completed_at: h.completed_at
    })
  })

  const { data: scrapTotals } = await supabase.from('work_card_scrap_totals').select('*').eq('task_id', task.id)
  console.log('\n=== SCRAP TOTALS ===', scrapTotals)

  const { data: nomList } = await supabase.from('nomenclatures').select('*')
  console.log('\n=== NOMENCLATURES & CARDS BREAKDOWN ===')
  cards?.forEach(c => {
    const nom = nomList?.find(n => String(n.id) === String(c.nomenclature_id))
    const cardHist = (history || []).filter(h => String(h.card_id) === String(c.id))
    const producedInHist = cardHist.reduce((acc, h) => acc + (Number(h.qty_completed) || 0), 0)
    const scrapInHist = cardHist.reduce((acc, h) => acc + (Number(h.scrap_qty) || 0), 0)
    console.log(`Card ${c.id.slice(-8)} | Nom: ${nom?.name} (${nom?.code}) | Status: ${c.status} | Qty: ${c.quantity} | Hist Produced: ${producedInHist} | Hist Scrap: ${scrapInHist} | Card ScrapQty: ${c.scrap_qty}`)
  })
}

checkTask().catch(console.error)
