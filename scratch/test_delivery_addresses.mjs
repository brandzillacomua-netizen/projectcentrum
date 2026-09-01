import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function testUpdateColumn() {
  const { data: customer } = await supabase.from('customers').select('id').limit(1).single()
  if (!customer) return console.log('No customer found')

  const { data, error } = await supabase
    .from('customers')
    .update({
      delivery_addresses: [
        {
          id: 'addr_1',
          title: 'Головне відділення',
          city: 'Калуш',
          deliveryMethod: 'np_warehouse',
          warehouse: 'Відділення №1: вул. Дзвонарська, 5',
          recipientName: 'FT',
          recipientPhone: '+380671234567',
          isDefault: true
        }
      ]
    })
    .eq('id', customer.id)
    .select()

  if (error) {
    console.log('Update error (column probably does not exist yet):', error)
  } else {
    console.log('Update SUCCESS! Column delivery_addresses exists and works!', data)
  }
}

testUpdateColumn().catch(console.error)
