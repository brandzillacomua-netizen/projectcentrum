import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const { data: cards } = await supabase.from('work_cards').select('*')
  const { data: orders } = await supabase.from('orders').select('*')
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*')

  const activeOrdersMap = new Map()
  orders?.forEach(o => {
    if (o.status !== 'completed' && o.status !== 'shipped' && o.status !== 'cancelled') {
      activeOrdersMap.set(String(o.id), o)
    }
  })

  console.log('Active Orders count:', activeOrdersMap.size)
  activeOrdersMap.forEach(o => console.log(`Active Order: ${o.order_num} (${o.status})`))

  const activeCards = cards?.filter(c => c.order_id && activeOrdersMap.has(String(c.order_id)))
  console.log('\nCards belonging to Active Orders:', activeCards?.length)

  const nomMap = new Map(nomenclatures?.map(n => [n.id, n]))

  const partMap = new Map()

  activeCards?.forEach(card => {
    const nomId = String(card.nomenclature_id || '')
    if (!nomId) return
    const nom = nomMap.get(nomId)
    const op = String(card.operation || '')

    if (!partMap.has(nomId)) {
      partMap.set(nomId, {
        name: nom?.name || 'Unknown',
        totalReceived: 0,
        shop1WipQty: 0,
        inProgressShop2: 0,
        completedShop2: 0
      })
    }
    const entry = partMap.get(nomId)

    const isShop2Card = ['Пресування', 'Фарбування', 'Малярка', 'Доопрацювання', 'Пакування'].some(s => op.includes(s))

    if (!isShop2Card) {
      if (card.status === 'at-shop2-buffer' || op === 'Склад БЗ' || (op === 'Сортування' && ['at-buffer', 'at-shop2-buffer', 'completed'].includes(card.status)) || card.is_rework) {
        entry.totalReceived += Number(card.quantity || 0)
      } else if (['in-progress', 'new', 'waiting-machines', 'waiting-materials', 'paused', 'hold'].includes(card.status)) {
        entry.shop1WipQty += Number(card.quantity || 0)
      }
    } else {
      if (card.status === 'in-progress' || card.status === 'new') {
        entry.inProgressShop2 += Number(card.quantity || 0)
      } else if (card.status === 'completed') {
        entry.completedShop2 += Number(card.quantity || 0)
      }
    }
  })

  console.log('\n=== STRICT ACTIVE PART BREAKDOWN ===')
  partMap.forEach((entry, id) => {
    console.log(`Part: ${entry.name} | TotalReceived: ${entry.totalReceived} | Shop1WIP: ${entry.shop1WipQty} | Shop2InProgress: ${entry.inProgressShop2}`)
  })
}

main().catch(console.error)
