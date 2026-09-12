import { createClient } from '@supabase/supabase-js'

const STAGING_URL = 'https://qpiysrkhvdgctaqmfsew.supabase.co'
const STAGING_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwaXlzcmtodmRnY3RhcW1mc2V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4OTcxMzUsImV4cCI6MjEwNDQ3MzEzNX0.Jvx-saMNE97zyy8IaXk9dd7C1q-quoK-R0IopUsVXI8'

const supabase = createClient(STAGING_URL, STAGING_ANON_KEY)

async function main() {
  const { data: orders } = await supabase.from('orders').select('*').limit(20)
  console.log('Staging Orders sample order_nums:', orders?.map(o => o.order_num))

  const { data: matched } = await supabase.from('orders').select('*').ilike('order_num', '%260826%')
  console.log('Staging Matched orders:', matched?.map(o => ({ id: o.id, num: o.order_num, customer: o.customer })))

  if (matched && matched.length > 0) {
    const orderId = matched[0].id
    const { data: tasks } = await supabase.from('tasks').select('*').eq('order_id', orderId)
    console.log('Tasks:', tasks?.map(t => ({ id: t.id, status: t.status, batch_index: t.batch_index })))

    for (const task of tasks) {
      const { data: cards } = await supabase.from('work_cards').select('*').eq('task_id', task.id)
      console.log(`Task ${task.id} cards count: ${cards?.length}`)
      if (cards) {
        cards.forEach(c => {
          console.log(` Card ${c.id.substring(0,8)}... code/nom: ${c.nomenclature_id} qty: ${c.quantity} comp: ${c.completed_quantity} scrap: ${c.scrap_quantity} status: ${c.status}`)
        })
        const cardIds = cards.map(c => c.id)
        const { data: history } = await supabase.from('work_card_history').select('*').in('card_id', cardIds)
        console.log(` History records count: ${history?.length}`)
        const historyScrap = (history || []).reduce((sum, h) => sum + (Number(h.scrap_qty) || 0), 0)
        const cardScrap = (cards || []).reduce((sum, c) => sum + (Number(c.scrap_quantity) || 0), 0)
        const historyAccepted = (history || []).filter(h => h.stage_name === 'Прийомка' || h.stage_name === 'completed').reduce((sum, h) => sum + (Number(h.qty_completed) || 0), 0)
        const cardAccepted = (cards || []).reduce((sum, c) => sum + (Number(c.completed_quantity) || (c.status === 'completed' ? Number(c.quantity) : 0)), 0)

        console.log(` SUMMARY for Task ${task.id}:`)
        console.log(`   History scrap sum: ${historyScrap}`)
        console.log(`   Card scrap_quantity sum: ${cardScrap}`)
        console.log(`   History accepted sum: ${historyAccepted}`)
        console.log(`   Card completed_quantity sum: ${cardAccepted}`)
      }
    }
  }
}

main().catch(console.error)
