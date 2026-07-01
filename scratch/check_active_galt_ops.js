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

const run = async () => {
  const { data: cards, error } = await supabase
    .from('work_cards')
    .select('id, operation, status, quantity, nomenclatures(name)')
    .neq('status', 'completed')
    
  if (error) {
    console.error('Error:', error)
    return
  }
  
  const galtCards = cards.filter(c => c.operation?.includes('Галтовка'))
  console.log('Active Tumbling cards in DB:', galtCards.map(c => ({
    id: c.id,
    name: c.nomenclatures?.name,
    operation: c.operation,
    status: c.status,
    qty: c.quantity
  })))
}

run()
