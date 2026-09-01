import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function inspectOrders() {
  const { data: orders, error } = await supabase.from('orders').select('id, order_num, customer')
  console.log('Orders count:', orders?.length, 'Error:', error)
  console.log('Sample orders:', orders?.slice(0, 30))

  const orderNumberCustomers = orders?.filter(o => {
    const cust = (o.customer || '').trim()
    const num = (o.order_num || '').trim()
    return cust === num || /^\d[\d-]*$/.test(cust)
  })
  console.log('\nOrders where customer is order_num or numeric:', orderNumberCustomers)
}

inspectOrders().catch(console.error)
