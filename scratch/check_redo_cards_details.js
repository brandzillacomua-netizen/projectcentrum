import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const taskId = 'c7055204-cbad-4f74-bae6-4a8a79c14b7e'
  const { data: cards } = await supabase.from('work_cards').select('id, card_info, quantity, status, created_at, nomenclature_id').eq('task_id', taskId)
  
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*')
  
  console.log('Redo/Reissue cards for task c7055204-cbad-4f74-bae6-4a8a79c14b7e:')
  cards?.forEach(c => {
    if ((c.card_info || '').includes('[REDO]') || (c.card_info || '').includes('допуск') || (c.card_info || '').includes('Допуск')) {
      const nom = nomenclatures.find(n => n.id === c.nomenclature_id)
      console.log(`- ID: ${c.id} | Nom: ${nom?.name} | Qty: ${c.quantity} | Status: ${c.status} | Created: ${c.created_at} | Info: ${c.card_info}`)
    }
  })
}

main().catch(console.error)
