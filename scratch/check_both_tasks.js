import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const { data: tasks } = await supabase.from('tasks').select('*').eq('order_id', '53741df6-bd90-476b-9000-2c4bec9e9080')
  console.log(`Tasks for order 22062026-03:`)
  tasks?.forEach(t => {
    console.log(`- ID: ${t.id} | Step: "${t.step}" | Status: "${t.status}" | WarehouseConf: ${t.warehouse_conf} | EngineerConf: ${t.engineer_conf} | DirectorConf: ${t.director_conf}`)
  })
}

main().catch(console.error)
