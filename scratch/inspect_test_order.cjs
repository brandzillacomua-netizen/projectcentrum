const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://hurzutjytlcvtbvihnry.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
})

async function run() {
  console.log("=== INSPECTING ORDERS & ORDER_ITEMS ===")

  const { data: order, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('order_num', 'ТЕСТ-ВАФЕЛЬ-01')
    .maybeSingle()

  console.log("Order result:", order)
  console.log("Order items:", order?.order_items)

  const { data: allItems } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', order?.id)

  console.log("Direct query order_items:", allItems)
}

run()
