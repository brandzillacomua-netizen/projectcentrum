import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
  const { data: bomData } = await supabase.from('bom_items').select('*').limit(1)
  console.log('BOM items columns:', bomData ? Object.keys(bomData[0] || {}) : 'null')
  console.log('BOM item row:', bomData)

  const { data: orderItemData } = await supabase.from('order_items').select('*').limit(1)
  console.log('Order items columns:', orderItemData ? Object.keys(orderItemData[0] || {}) : 'null')
  console.log('Order item row:', orderItemData)
}

run()
