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

  // Filter active orders
  const activeOrders = orders.filter(o => o.status !== 'completed' && o.status !== 'shipped' && o.status !== 'cancelled')
  const activeOrderIds = new Set(activeOrders.map(o => String(o.id)))

  console.log(`Active orders: ${activeOrders.length}`)

  // Active cards
  const activeCards = cards.filter(c => c.order_id && activeOrderIds.has(String(c.order_id)))

  // Group by nomenclature_id
  const partMap = new Map()

  activeCards.forEach(c => {
    const nomId = String(c.nomenclature_id || '')
    if (!nomId) return
    const op = String(c.operation || '').toLowerCase()
    
    if (!partMap.has(nomId)) {
      partMap.set(nomId, { nomId, nomName: nomMap.get(nomId)?.name, bzCardQty: 0, snapStock: 0 })
    }
    const entry = partMap.get(nomId)

    if (op.includes('склад бз') || op.includes('склад bz')) {
      entry.bzCardQty += Number(c.quantity || 0)
    }
  })

  // Check plan_snapshot stock for active tasks
  tasks.filter(t => t.order_id && activeOrderIds.has(String(t.order_id))).forEach(t => {
    const snap = t.plan_snapshot
    if (snap && typeof snap === 'object') {
      Object.keys(snap).forEach(k => {
        if (!k.startsWith('_') && snap[k]?.stock > 0) {
          if (!partMap.has(k)) {
            partMap.set(k, { nomId: k, nomName: nomMap.get(k)?.name, bzCardQty: 0, snapStock: 0 })
          }
          const entry = partMap.get(k)
          entry.snapStock += Number(snap[k].stock)
        }
      })
    }
  })

  console.log('\nPart BZ Reservation summary for active orders:')
  partMap.forEach(e => {
    if (e.bzCardQty > 0 || e.snapStock > 0) {
      console.log(`  ${e.nomName} | bzCardQty: ${e.bzCardQty} | snapStock: ${e.snapStock}`)
    }
  })
}

run().catch(console.error)
