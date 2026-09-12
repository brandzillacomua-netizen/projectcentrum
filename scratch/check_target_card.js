import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'REVOKED_MES_SECRET_DO_NOT_USE'
    }
  }
})

const run = async () => {
  console.log('Fetching active cards...')
  const { data: cards, error } = await supabase
    .from('work_cards')
    .select('*')
    .neq('status', 'completed')
    
  if (error) {
    console.error('Error:', error)
    return
  }
  
  const matched = cards.filter(c => c.id.toUpperCase().endsWith('4390AD29'))
  console.log('Matched cards:', matched)
}

run()
