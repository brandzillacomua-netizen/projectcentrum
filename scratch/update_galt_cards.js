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
  console.log('Finding active cards with operation = "Галтовка"...')
  const { data: cards, error: fetchErr } = await supabase
    .from('work_cards')
    .select('id, status, operation, quantity')
    .eq('operation', 'Галтовка')
    .neq('status', 'completed')
  
  if (fetchErr) {
    console.error('Error fetching cards:', fetchErr)
    return
  }
  
  console.log(`Found ${cards.length} active cards on 'Галтовка'. Updating to 'Галтовка (Сушка)'...`)
  
  if (cards.length > 0) {
    const { data: updated, error: updateErr } = await supabase
      .from('work_cards')
      .update({ operation: 'Галтовка (Сушка)' })
      .eq('operation', 'Галтовка')
      .neq('status', 'completed')
      .select()
      
    if (updateErr) {
      console.error('Error updating cards:', updateErr)
    } else {
      console.log(`Successfully updated ${updated.length} cards!`)
    }
  } else {
    console.log('No cards need updating.')
  }
}

run()
