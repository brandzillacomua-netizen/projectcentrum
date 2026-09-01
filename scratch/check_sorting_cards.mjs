import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function checkSorting() {
  const { data: cards } = await supabase
    .from('work_cards')
    .select('id, nomenclature_id, operation, status, quantity, used_in_shop2_qty, task_id')
    .ilike('operation', '%сортування%')

  console.log('Total sorting cards in DB:', cards?.length)
  const byStatus = {}
  cards?.forEach(c => {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1
    if (c.status !== 'completed') {
      console.log(`ID: ${c.id.slice(-8)} | Nom: ${c.nomenclature_id} | Status: "${c.status}" | Qty: ${c.quantity} | Used: ${c.used_in_shop2_qty} | TaskID: ${c.task_id}`)
    }
  })
  console.log('\nSorting cards by status:', byStatus)
}

checkSorting()
