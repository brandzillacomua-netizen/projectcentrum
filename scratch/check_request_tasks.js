import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const orderId = '53741df6-bd90-476b-9000-2c4bec9e9080'
  const { data: reqs } = await supabase
    .from('material_requests')
    .select('*, nomenclatures(name), tasks(id, step)')
    .eq('order_id', orderId)
    .in('status', ['pending', 'issued'])

  console.log(`Active material requests for order 22062026-03:`)
  reqs?.forEach(r => {
    console.log(`- Material: "${r.nomenclatures?.name}" | Qty: ${r.quantity} | Task ID: ${r.task_id} | Task Step: "${r.tasks?.step}" | Details: "${r.details}"`)
  })
}

main().catch(console.error)
