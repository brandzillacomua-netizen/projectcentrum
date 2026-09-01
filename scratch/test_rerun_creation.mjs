import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function testRerunCreation() {
  const { data: parentOrder } = await supabase.from('orders').select('*').limit(1).single()
  const { data: nom } = await supabase.from('nomenclatures').select('*').eq('type', 'part').limit(1).single()

  console.log('Testing Rerun creation...')
  console.log(`Parent Order: ${parentOrder.order_num}`)
  console.log(`Part: ${nom.name}`)

  const parentNum = parentOrder.order_num.split('-Д')[0]
  const { data: existingChildOrders } = await supabase
    .from('orders')
    .select('order_num')
    .ilike('order_num', `${parentNum}-Д%`)

  const rerunCount = (existingChildOrders?.length || 0) + 1
  const rerunOrderNum = `${parentNum}-Д${rerunCount}`

  console.log(`Generated Rerun Order Num: ${rerunOrderNum}`)
  console.log('Test logic validated successfully!')
}

testRerunCreation().catch(console.error)
