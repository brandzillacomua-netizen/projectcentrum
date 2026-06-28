import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const orderId = '53741df6-bd90-476b-9000-2c4bec9e9080'
  
  const { data, error } = await supabase
    .from('material_requests')
    .select('*, nomenclatures(name)')
    .eq('order_id', orderId)

  if (error) {
    console.error(error)
    return
  }

  console.log(`Found ${data.length} requests for order ${orderId}:`)
  data.forEach(r => {
    console.log(`- ID: ${r.id} | Qty: ${r.quantity} | NomName: "${r.nomenclatures?.name || '???'}" | Details: "${r.details}" | TaskId: ${r.task_id}`)
  })
}

main().catch(console.error)
