import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseKey)

async function inspectActiveOrders() {
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_num, status, customer, nomenclature_id, planned_qty, quantity, order_items(*)')
    .not('status', 'in', '("completed","shipped","cancelled")')

  console.log(`Active orders in DB: ${orders?.length || 0}`)
  orders?.forEach(o => {
    console.log(`Order №${o.order_num} (ID: ${o.id}) | Status: ${o.status} | Customer: ${o.customer} | Items: ${o.order_items?.length || 0}`)
  })

  const { data: bomItems } = await supabase.from('bom_items').select('*')
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('id, name, type')
  const { data: workCards } = await supabase.from('work_cards').select('id, order_id, nomenclature_id, quantity, status, operation')

  console.log(`\nTotal work cards in DB: ${workCards?.length || 0}`)
}

inspectActiveOrders()
