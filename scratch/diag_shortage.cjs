const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function diagnose() {
  // 1. Get all active tasks
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, status, step, order_id')
    .neq('status', 'completed')
  
  const taskIds = (tasks || []).map(t => t.id)
  console.log(`Active tasks: ${taskIds.length}`)
  
  // 2. Count total work cards for all active tasks (check if we hit the 1000-row limit)
  const { data: allCards } = await supabase
    .from('work_cards')
    .select('id, task_id, status')
    .in('task_id', taskIds)
    .limit(2000)
  
  console.log(`Total work cards (limit 2000): ${(allCards || []).length}`)
  if ((allCards || []).length >= 1000) {
    console.log('⚠️  Previously would have hit 1000-row limit!')
  }
  
  // 3. Find order 25062026-02
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_num')
    .ilike('order_num', '%25062026-02%')
  
  console.log('\nOrders matching 25062026-02:', orders?.map(o => `${o.id}: ${o.order_num}`).join(', '))
  
  if (orders && orders.length > 0) {
    const orderId = orders[0].id
    const { data: targetTasks } = await supabase
      .from('tasks')
      .select('id, status, step')
      .eq('order_id', orderId)
    
    console.log('Tasks for this order:')
    for (const t of (targetTasks || [])) {
      console.log(`  task_id=${t.id}, status=${t.status}, step=${t.step}`)
      
      // Get cards for this task
      const { data: taskCards } = await supabase
        .from('work_cards')
        .select('id, status, operation, nomenclature_id, quantity')
        .eq('task_id', t.id)
      
      console.log(`  Cards: ${(taskCards||[]).length} total`)
      const byStatus = {}
      taskCards?.forEach(c => { byStatus[c.status] = (byStatus[c.status] || 0) + 1 })
      console.log(`  By status:`, byStatus)
      
      // Check if any completed cards have scrap in history
      const cardIds = (taskCards || []).map(c => c.id)
      if (cardIds.length > 0) {
        const { data: hist } = await supabase
          .from('work_card_history')
          .select('id, card_id, scrap_qty')
          .in('card_id', cardIds)
        
        const withScrap = (hist || []).filter(h => Number(h.scrap_qty) > 0)
        console.log(`  History entries: ${(hist||[]).length}, with scrap: ${withScrap.length}`)
        withScrap.forEach(h => {
          const card = taskCards.find(c => c.id === h.card_id)
          console.log(`    → card_id=${h.card_id} status=${card?.status} operation=${card?.operation} scrap=${h.scrap_qty}`)
        })
      }
      
      // Check in the "big batch" query: is this task's cards visible?
      const tasksCardsForThisTask = (allCards || []).filter(c => c.task_id === t.id)
      console.log(`  Cards visible in batch query: ${tasksCardsForThisTask.length}`)
      if (tasksCardsForThisTask.length < (taskCards||[]).length) {
        console.log(`  ⚠️  MISSING ${(taskCards||[]).length - tasksCardsForThisTask.length} cards in batch query!`)
      }
    }
  }
}

diagnose().catch(console.error)
