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

async function run() {
  const { data: cards } = await supabase.from('work_cards').select('*').in('id', ['620972af-9fd5-45cb-a035-7cecb10c2c31', 'ae4fa179-8d76-4700-ab64-4e314ea3b0fe'])
  const { data: allCards } = await supabase.from('work_cards').select('*').eq('status', 'at-shop2-buffer')
  const { data: tasks } = await supabase.from('tasks').select('*')
  const { data: orders } = await supabase.from('orders').select('*')
  const { data: nomList } = await supabase.from('nomenclatures').select('*')
  const { data: boms } = await supabase.from('bom_items').select('*')

  console.log('=== KR-325 AT-SHOP2-BUFFER CARDS ===')
  allCards.forEach(c => {
    const qty = Number(c.quantity) || 0
    const used = Number(c.used_in_shop2_qty) || 0
    const avail = Math.max(0, qty - used)
    const task = tasks.find(t => t.id === c.task_id)
    const order = orders.find(o => o.id === (c.order_id || task?.order_id))
    const nom = nomList.find(n => n.id === c.nomenclature_id)
    console.log(`Card ${c.id} | Nom: ${nom?.name} | Qty: ${qty} | Used: ${used} | Avail: ${avail} | TaskId: ${c.task_id} | TaskStatus: ${task?.status} | OrderId: ${c.order_id || task?.order_id} | OrderStatus: ${order?.status}`)
  })

  // Check all active tasks (same filter as relevantTasks/activeTasks in ForemanDashboardModule)
  const relevantTasks = tasks.filter(t => {
    const stepName = (t.step || '').toLowerCase()
    const isLaser = stepName.includes('розкрій') || stepName.includes('різка')

    const hasActiveShop2Task = tasks.some(s2 =>
      String(s2.order_id) === String(t.order_id) &&
      s2.batch_index === t.batch_index &&
      (s2.step?.includes('Пресування') || s2.step?.includes('ЦЕХ №2') || s2.step?.includes('Доопрацювання')) &&
      s2.status !== 'completed'
    )

    if (t.status !== 'completed' || hasActiveShop2Task) {
      return (t.warehouse_conf === 'true' || t.warehouse_conf === 'partial') && t.engineer_conf && t.director_conf && isLaser
    }
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    const isRecent = (t.completed_at && new Date(t.completed_at) > threeDaysAgo) ||
      (t.updated_at && new Date(t.updated_at) > threeDaysAgo)
    return isRecent && (isLaser || !t.step)
  })

  console.log(`\nRelevant tasks count: ${relevantTasks.length}`)
  const relTaskIds = new Set(relevantTasks.map(t => t.id))

  allCards.forEach(c => {
    const qty = Number(c.quantity) || 0
    const used = Number(c.used_in_shop2_qty) || 0
    const avail = Math.max(0, qty - used)
    if (avail > 0) {
      console.log(`Card ${c.id.slice(-8)} avail=${avail}: task ${c.task_id} is in relevantTasks? ${relTaskIds.has(c.task_id)}`)
    }
  })
}

run().catch(console.error)
