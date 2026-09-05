import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' }
  }
})

async function main() {
  const { data: reqs } = await supabase
    .from('material_requests')
    .select('*')
    .eq('order_id', 'ac91435d-a0a2-43d6-80d4-b356c18e5654')
  
  console.log('--- ALL REQUESTS FOR ORDER 260905-1 ---')
  for (const r of reqs || []) {
    console.log(`${r.status.toUpperCase()} | Qty: ${r.quantity} | NomID: ${r.nomenclature_id} | Details: ${r.details}`)
  }
}

main().catch(console.error)
