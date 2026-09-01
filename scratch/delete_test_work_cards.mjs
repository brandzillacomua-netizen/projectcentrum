import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  console.log('Finding test nomenclatures...')
  const { data: testNoms } = await supabase
    .from('nomenclatures')
    .select('id, name')
    .ilike('name', '%Тест-Деталь%')

  console.log('Test nomenclatures:', testNoms)

  if (testNoms && testNoms.length > 0) {
    const nomIds = testNoms.map(n => n.id)

    // Find work cards for test nomenclatures
    const { data: cards, error: cardErr } = await supabase
      .from('work_cards')
      .select('id, task_id, nomenclature_id, card_info, status')
      .in('nomenclature_id', nomIds)

    if (cardErr) {
      console.error('Error finding work_cards:', cardErr)
      return
    }

    console.log(`Found ${cards?.length || 0} work_cards for test details:`)
    console.table(cards)

    if (cards && cards.length > 0) {
      const cardIds = cards.map(c => c.id)

      // 1. Delete work_card_history if any
      const { error: histErr } = await supabase
        .from('work_card_history')
        .delete()
        .in('card_id', cardIds)

      if (histErr) console.warn('Error deleting work_card_history:', histErr.message)

      // 2. Delete material_requests linked to these cards
      const { error: reqErr } = await supabase
        .from('material_requests')
        .delete()
        .in('card_id', cardIds)

      if (reqErr) console.warn('Error deleting material_requests by card_id:', reqErr.message)

      // 3. Delete work_cards
      const { data: deleted, error: delErr } = await supabase
        .from('work_cards')
        .delete()
        .in('id', cardIds)
        .select()

      if (delErr) {
        console.error('Error deleting work_cards:', delErr)
      } else {
        console.log(`✅ Successfully deleted ${deleted?.length || cards.length} work_cards!`)
      }
    }
  }
}

main().catch(console.error)
