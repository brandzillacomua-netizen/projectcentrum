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

async function inspectShop2Buffer() {
  const { data: cards } = await supabase.from('work_cards').select('*').eq('status', 'at-shop2-buffer')
  const { data: tasks } = await supabase.from('tasks').select('*')
  const { data: orders } = await supabase.from('orders').select('*')
  const { data: nomList } = await supabase.from('nomenclatures').select('*')
  const { data: inventory } = await supabase.from('inventory').select('*').in('type', ['semi_shop2', 'bz_shop2'])

  console.log('=== WORK CARDS AT SHOP 2 BUFFER ===')
  cards.forEach(c => {
    const task = tasks.find(t => t.id === c.task_id)
    const order = orders.find(o => o.id === c.order_id)
    const nom = nomList.find(n => n.id === c.nomenclature_id)
    const orderNum = order?.order_num || task?.order_num || c.card_info?.match(/Наряд №(\d+(?:-\d+)?)/)?.[1] || 'Без наряду'
    console.log(`Card ${c.id.slice(-8)} | Task ${orderNum} | Nom: ${nom?.name} | Qty: ${c.quantity}`)
  })

  console.log('\n=== INVENTORY ITEMS SHOP 2 ===')
  inventory.forEach(i => {
    const nom = nomList.find(n => n.id === i.nomenclature_id)
    console.log(`Inv ${i.id} | Nom: ${nom?.name || i.name} | Qty: ${i.total_qty} | type: ${i.type}`)
  })
}

inspectShop2Buffer().catch(console.error)
