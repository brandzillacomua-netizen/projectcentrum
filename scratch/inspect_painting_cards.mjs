import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function inspectDashboardWipLogic() {
  const { data: cards } = await supabase.from('work_cards').select('*')
  const { data: tasks } = await supabase.from('tasks').select('*')
  const { data: noms } = await supabase.from('nomenclatures').select('id, name, nomenclature_code')

  console.log('=== INSPECTING WORK CARDS FOR PAINTING / SHOP 2 ===')
  
  // Let's find cards matching F415-421-ІП27-В-3-28 or operations like 'Малярка', 'Фарбування', etc.
  const paintingCards = cards?.filter(c => {
    const op = String(c.operation || '').toLowerCase()
    const info = String(c.card_info || '').toLowerCase()
    return op.includes('маляр') || op.includes('фарб') || info.includes('маляр') || info.includes('фарб')
  })

  console.log(`Found ${paintingCards?.length || 0} painting cards`)

  paintingCards?.forEach(c => {
    console.log(`Card ${c.id}: status=${c.status} | operation=${c.operation} | quantity=${c.quantity} | nomId=${c.nomenclature_id} | taskId=${c.task_id} | card_info=${c.card_info}`)
  })
}

inspectDashboardWipLogic().catch(console.error)
