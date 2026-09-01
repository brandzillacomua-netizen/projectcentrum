import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const taskId = '99190e0a-91b0-4a44-ab5e-b1a1ec393ffe'
  console.log('Finding test work cards...')

  const { data: testNoms } = await supabase
    .from('nomenclatures')
    .select('id, name')
    .ilike('name', '%Тест-Деталь%')

  const nomIds = testNoms?.map(n => n.id) || []

  // 1. Find work cards by task_id OR nomenclature_ids
  const { data: cards } = await supabase
    .from('work_cards')
    .select('id, task_id, nomenclature_id, card_info')
    .or(`task_id.eq.${taskId},nomenclature_id.in.(${nomIds.join(',')})`)

  console.log(`Found ${cards?.length || 0} work_cards:`, cards)

  if (cards && cards.length > 0) {
    const cardIds = cards.map(c => c.id)

    // Delete work_card_history
    await supabase.from('work_card_history').delete().in('card_id', cardIds)

    // Delete material_requests linked to card_ids
    await supabase.from('material_requests').delete().in('card_id', cardIds)

    // Delete work_cards
    const { data: deletedCards } = await supabase
      .from('work_cards')
      .delete()
      .in('id', cardIds)
      .select()

    console.log(`✅ Successfully deleted ${deletedCards?.length || cards.length} work_cards!`)
  }

  // Also clean up any pending material_requests for this test task
  const { data: deletedReqs } = await supabase
    .from('material_requests')
    .delete()
    .eq('task_id', taskId)
    .eq('status', 'pending')
    .select()

  console.log(`✅ Cleaned up ${deletedReqs?.length || 0} pending material_requests for test task.`)
}

main().catch(console.error)
