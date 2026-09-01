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
  const { data: cards } = await supabase.from('work_cards').select('*')
  const { data: tasks } = await supabase.from('tasks').select('*')
  const { data: orders } = await supabase.from('orders').select('*')
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*')
  const { data: bomItems } = await supabase.from('bom_items').select('*')

  const nomMap = new Map(nomenclatures.map(n => [n.id, n]))
  const ordersMap = {}
  orders.forEach(o => { ordersMap[o.id] = o })

  // Find cards with avail > 0
  cards.filter(c => c.status === 'at-shop2-buffer').forEach(c => {
    const q = Number(c.quantity) || 0
    const used = Number(c.used_in_shop2_qty) || 0
    const avail = Math.max(0, q - used)
    if (avail > 0) {
      const task = tasks.find(t => t.id === c.task_id)
      const order = ordersMap[task?.order_id]
      console.log(`[AVAIL CARD] ${c.id.slice(-8)} | Nom: ${nomMap.get(c.nomenclature_id)?.name} (${c.nomenclature_id}) | Avail: ${avail} | TaskId: ${c.task_id} | OrderId: ${task?.order_id} | OrderNum: ${order?.order_num} | OrderNomId: ${order?.nomenclature_id}`)
      console.log(`  Task plan_snapshot keys:`, Object.keys(task?.plan_snapshot || {}))
      console.log(`  Task planned_sets:`, task?.planned_sets)
    }
  })
}

run().catch(console.error)
