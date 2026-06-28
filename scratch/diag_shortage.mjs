// Diagnostic: check what staticCompletedCards and staticHistory would have for task 25062026-02
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Read env from .env
const env = readFileSync('a:/centrum/.env', 'utf8')
const url = env.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim()
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim()

const supabase = createClient(url, key)

async function diagnose() {
  // 1. Get all active tasks
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, status, step, plan_snapshot')
    .neq('status', 'completed')
  
  const taskIds = (tasks || []).map(t => t.id)
  console.log(`Active tasks: ${taskIds.length}`)
  
  // 2. Count total work cards for all active tasks (without limit)
  const { data: allCards, error: cardsErr } = await supabase
    .from('work_cards')
    .select('id, task_id, nomenclature_id, quantity, operation, status, card_info', { count: 'exact' })
    .in('task_id', taskIds)
  
  console.log(`Total work cards (default limit): ${(allCards || []).length}, error: ${cardsErr?.message || 'none'}`)
  
  // Check if we're hitting the default 1000 row limit
  if ((allCards || []).length === 1000) {
    console.log('⚠️  HIT 1000-row Supabase limit! Some cards are missing!')
  }
  
  // 3. Find task with number 25062026-02 (look in plan_snapshot or match order)
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_num')
    .ilike('order_num', '%25062026-02%')
  
  console.log('\n=== Orders matching 25062026-02:', JSON.stringify(orders))
  
  if (orders && orders.length > 0) {
    const orderId = orders[0].id
    const { data: targetTasks } = await supabase
      .from('tasks')
      .select('id, status, step')
      .eq('order_id', orderId)
      .neq('status', 'completed')
    
    console.log('Target tasks:', JSON.stringify(targetTasks))
    
    if (targetTasks && targetTasks.length > 0) {
      const targetTaskId = targetTasks[0].id
      
      // 4. Get ALL work cards for this specific task
      const { data: taskCards } = await supabase
        .from('work_cards')
        .select('id, task_id, nomenclature_id, quantity, operation, status, card_info')
        .eq('task_id', targetTaskId)
      
      console.log(`\nWork cards for task ${targetTaskId}:`)
      taskCards?.forEach(c => {
        console.log(`  - id=${c.id}, status=${c.status}, operation=${c.operation}, qty=${c.quantity}`)
      })
      
      // 5. Check if these cards appear in the global staticCompletedCards query (first 1000 rows)
      const cardIds = (taskCards || []).map(c => c.id)
      const completedCards = (taskCards || []).filter(c => c.status === 'completed')
      console.log(`\n  Completed cards: ${completedCards.length}`)
      
      // 6. Get history for this task's cards
      if (cardIds.length > 0) {
        const { data: history } = await supabase
          .from('work_card_history')
          .select('id, card_id, scrap_qty')
          .in('card_id', cardIds)
        
        const withScrap = (history || []).filter(h => (h.scrap_qty || 0) > 0)
        console.log(`  History entries: ${(history||[]).length}, entries with scrap: ${withScrap.length}`)
        withScrap.forEach(h => console.log(`    - card=${h.card_id}, scrap=${h.scrap_qty}`))
      }
      
      // 7. Now simulate: does this card appear in the first 1000 rows of the .in('task_id', taskIds) query?
      const position = (allCards || []).findIndex(c => c.task_id === targetTaskId)
      if (position === -1) {
        console.log(`\n⚠️  FOUND THE BUG! Task ${targetTaskId} cards are NOT in the first 1000 rows returned by the batch query!`)
        console.log(`   This means staticCompletedCards misses these cards → shortage = 0 for this task when not selected`)
      } else {
        console.log(`\n✓ Task ${targetTaskId} cards ARE in the batch query (first card at position ${position})`)
        const inBatchCompleted = (allCards || []).filter(c => c.task_id === targetTaskId && c.status === 'completed')
        console.log(`  Completed cards in batch: ${inBatchCompleted.length}`)
      }
    }
  }
}

diagnose().catch(console.error)
