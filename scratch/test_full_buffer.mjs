import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function run() {
  const { data: cards } = await supabase.from('work_cards').select('*')
  const { data: tasks } = await supabase.from('tasks').select('*')
  const { data: orders } = await supabase.from('orders').select('*')
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*')
  const nomMap = new Map(nomenclatures.map(n => [n.id, n]))

  const activeOrders = orders.filter(o => o.status !== 'completed' && o.status !== 'shipped' && o.status !== 'cancelled')
  const activeOrderIds = new Set(activeOrders.map(o => String(o.id)))

  const partMap = new Map()

  cards.forEach(card => {
    const nomId = String(card.nomenclature_id || '')
    const orderId = String(card.order_id || '')
    if (!nomId || !orderId || !activeOrderIds.has(orderId)) return

    const op = String(card.operation || '').toLowerCase()
    const status = String(card.status || '')

    if (!partMap.has(nomId)) {
      partMap.set(nomId, { nomId, nomName: nomMap.get(nomId)?.name, atBuffer: 0, bzCard: 0, used: 0, completed: 0 })
    }
    const entry = partMap.get(nomId)

    if (status === 'at-shop2-buffer') {
      entry.atBuffer += Number(card.quantity || 0)
      entry.used += Number(card.used_in_shop2_qty || 0)
    } else if (op.includes('склад бз') || op.includes('склад bz')) {
      entry.bzCard += Number(card.quantity || 0)
    } else if (status === 'completed' && ['пресування', 'фарбування', 'малярка', 'доопрацювання', 'пакування', 'сгп'].some(o => op.includes(o))) {
      entry.completed += Number(card.quantity || 0)
    }
  })

  // Check plan_snapshot stock for active tasks
  tasks.filter(t => t.order_id && activeOrderIds.has(String(t.order_id))).forEach(t => {
    const snap = t.plan_snapshot
    if (snap && typeof snap === 'object') {
      Object.keys(snap).forEach(k => {
        if (!k.startsWith('_') && snap[k]?.stock > 0) {
          if (!partMap.has(k)) {
            partMap.set(k, { nomId: k, nomName: nomMap.get(k)?.name, atBuffer: 0, bzCard: 0, used: 0, completed: 0, snapStock: 0 })
          }
          const entry = partMap.get(k)
          entry.snapStock = (entry.snapStock || 0) + Number(snap[k].stock)
        }
      })
    }
  })

  console.log('--- PART SUMMARY FOR ACTIVE ORDERS ---')
  partMap.forEach(e => {
    const totalRec = e.atBuffer + Math.max(e.bzCard, e.snapStock || 0)
    const avail = Math.max(0, totalRec - e.used)
    console.log(`${e.nomName}: atBuffer=${e.atBuffer}, bzCard=${e.bzCard}, snapStock=${e.snapStock || 0} => totalRec=${totalRec}, used=${e.used}, avail=${avail}, completedSGP=${e.completed}`)
  })
}

run().catch(console.error)
