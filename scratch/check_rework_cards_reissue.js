import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const orderId = '53741df6-bd90-476b-9000-2c4bec9e9080'
  const { data: cards, error } = await supabase
    .from('work_cards')
    .select('*, nomenclatures(name)')
    .eq('order_id', orderId)
    .eq('is_rework', true)

  if (error) {
    console.error(error)
    return
  }

  console.log(`Found ${cards.length} rework/redo cards:`)
  cards.forEach(c => {
    console.log(`- Card ID: ${c.id} | Qty: ${c.quantity} | sheets: ${c.actualSheets} | Info: "${c.card_info}" | NomName: "${c.nomenclatures?.name}" | Machine: "${c.machine}"`)
  })
}

main().catch(console.error)
