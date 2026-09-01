import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function checkNomTask() {
  const { data: noms } = await supabase.from('nomenclatures').select('*').ilike('name', '%Київ К-ІП9-10-П-7-46%')
  console.log('Nomenclatures matching:', noms)

  if (noms && noms.length > 0) {
    const nomId = noms[0].id
    const { data: cards } = await supabase.from('work_cards').select('*').eq('nomenclature_id', nomId)
    const { data: tasks } = await supabase.from('tasks').select('*')
    const { data: orders } = await supabase.from('orders').select('*')

    console.log('\nCards for this nomenclature:', cards.map(c => ({
      id: c.id.slice(-8),
      task_id: c.task_id,
      order_id: c.order_id,
      status: c.status,
      quantity: c.quantity,
      info: c.card_info
    })))

    tasks.forEach(t => {
      const parts = t.plan_snapshot?.parts || []
      const foundInPlan = parts.find(p => String(p.nomenclature_id || p.id) === String(nomId))
      if (foundInPlan) {
        const order = orders.find(o => o.id === t.order_id)
        console.log(`Task ${t.id} | Order ${order?.order_num || t.order_num} has part ${noms[0].name}`)
      }
    })
  }
}

checkNomTask().catch(console.error)
