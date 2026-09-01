import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function inspectFT() {
  const { data: customers } = await supabase.from('customers').select('*')
  console.log('FT customers in DB:', customers?.filter(c => (c.name||'').toUpperCase().includes('FT') || (c.name||'').toUpperCase().includes('ФТ')))

  const { data: orders } = await supabase.from('orders').select('*')
  console.log('Total orders in DB:', orders?.length)
  const ftOrders = orders?.filter(o => {
    const c = (o.customer || o.client_name || '').toUpperCase()
    return c.includes('FT') || c.includes('ФТ')
  })
  console.log('Orders for FT / ФТ in DB:', ftOrders)
}

inspectFT().catch(console.error)
