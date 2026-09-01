import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function inspectData() {
  const { data: customers } = await supabase.from('customers').select('*')
  console.log('--- CUSTOMERS TABLE ---')
  console.log(customers?.map(c => ({ id: c.id, name: c.name })))

  const { data: orders } = await supabase.from('orders').select('id, order_number, customer, client_name')
  console.log('\n--- ORDERS SAMPLE WITH NUMERIC/ORDER_NUMBER CUSTOMER ---')
  const numericCustOrders = orders?.filter(o => {
    const c = (o.customer || o.client_name || '').trim()
    return /^\d[\d-]*$/.test(c) || c === o.order_number
  })
  console.log('Count:', numericCustOrders?.length)
  console.log(numericCustOrders?.slice(0, 10))
}

inspectData().catch(console.error)
