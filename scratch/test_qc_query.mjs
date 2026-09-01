import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data: cards, error: cErr } = await supabase.from('work_cards').select('id,quantity,status').limit(5)
  console.log('Cards:', cards, cErr)

  if (cards && cards.length > 0) {
    const cardId = cards[0].id
    const { data: qcHistory, error: qErr } = await supabase
      .from('work_card_history')
      .select('*')
      .eq('card_id', cardId)
      .eq('stage_name', 'Контроль ВКЯ')
      .gt('scrap_qty', 0)
      .order('created_at', { ascending: true })

    console.log('QC History for card', cardId, ':', qcHistory, qErr)
  }
}

test()
