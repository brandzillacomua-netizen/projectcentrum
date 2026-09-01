import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function testSaveCustomer() {
  const { data: customer } = await supabase.from('customers').select('*').limit(1).single()
  console.log('Customer before update:', customer)

  const deliveryAddresses = [
    {
      id: 'addr_1',
      title: 'Основна адреса',
      city: 'Калуш',
      deliveryMethod: 'np_warehouse',
      warehouse: 'Відділення №5',
      isDefault: true
    },
    {
      id: 'addr_2',
      title: 'Резерв',
      city: 'Калуш',
      deliveryMethod: 'np_warehouse',
      warehouse: 'Відділення №2',
      isDefault: false
    }
  ]

  let notesStr = customer.notes || ''
  if (notesStr.includes('[DELIVERY_ADDRESSES_JSON:')) {
    notesStr = notesStr.replace(/\[DELIVERY_ADDRESSES_JSON:.*?\]/, '').trim()
  }
  notesStr = `${notesStr}\n[DELIVERY_ADDRESSES_JSON:${JSON.stringify(deliveryAddresses)}]`.trim()

  const { data, error } = await supabase
    .from('customers')
    .update({ notes: notesStr })
    .eq('id', customer.id)
    .select()

  if (error) {
    console.error('Update error:', error)
  } else {
    console.log('Update result:', data)
  }
}

testSaveCustomer().catch(console.error)
