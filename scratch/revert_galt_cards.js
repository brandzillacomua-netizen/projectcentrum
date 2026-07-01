import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
})

const targetIds = [
  '93d41862-bdc4-414c-861a-f73292bc7cd0',
  '74ad4df5-55f2-4aa7-9439-aab7ac5df497',
  'eccfd356-5e8a-4a39-9442-309d5ae97b63',
  'd606748f-d10f-45be-8e4d-f0ebc3e9d389'
]

const run = async () => {
  console.log('Reverting target 4 cards back to "Галтовка (Галтовка)"...')
  const { data, error } = await supabase
    .from('work_cards')
    .update({ operation: 'Галтовка (Галтовка)' })
    .in('id', targetIds)
    .select()
    
  if (error) {
    console.error('Error:', error)
  } else {
    console.log('Successfully reverted cards:', data.map(c => ({ id: c.id, operation: c.operation, status: c.status })))
  }
}

run()
