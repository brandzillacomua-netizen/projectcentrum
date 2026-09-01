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

async function checkK39Cards() {
  const taskId = '23ceb083-47f2-4f00-9922-339318478043'
  const { data: cards } = await supabase.from('work_cards').select('*').eq('task_id', taskId)
  const { data: nomList } = await supabase.from('nomenclatures').select('*')
  const { data: tasks } = await supabase.from('tasks').select('*').eq('id', taskId)

  const task = tasks[0]
  const k39Nom = nomList.find(n => n.name && n.name.includes('F415-ІП27-К-3-9'))
  const nomCards = cards.filter(c => String(c.nomenclature_id) === String(k39Nom.id))

  console.log('=== K-3-9 ALL CARDS ===')
  nomCards.forEach(c => {
    console.log(`Card ${c.id.slice(-8)} | status: ${c.status} | op: ${c.operation} | Qty: ${c.quantity} | is_rework: ${c.is_rework} | actual_sheets: ${c.actual_sheets} | info: ${c.card_info || ''}`)
  })
}

checkK39Cards().catch(console.error)
