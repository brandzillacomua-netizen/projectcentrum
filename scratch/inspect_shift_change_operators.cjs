const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://hurzutjytlcvtbvihnry.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function run() {
  console.log("=== INSPECTING WORK_CARD_HISTORY FOR ПЕРЕЗМІНКА RECORDS ===")
  
  // Find cards that had 2+ shift changes
  const { data: shiftHistories } = await supabase
    .from('work_card_history')
    .select('card_id, operator_name, stage_name, created_at')
    .eq('stage_name', 'Розкрій (перезмінка)')
    .order('created_at', { ascending: false })
    .limit(50)
    
  console.log("Total shift change records:", shiftHistories?.length)
  
  // Group by card_id to find cards with 2+ shift changes
  const byCard = {}
  shiftHistories?.forEach(h => {
    if (!byCard[h.card_id]) byCard[h.card_id] = []
    byCard[h.card_id].push(h)
  })
  
  const multiShiftCards = Object.entries(byCard).filter(([, history]) => history.length >= 2)
  console.log("Cards with 2+ shift changes:", multiShiftCards.length)
  
  for (const [cardId, history] of multiShiftCards.slice(0, 3)) {
    console.log(`\n=== Card: ${cardId} ===`)
    console.log("Shift change records:")
    history.forEach(h => console.log(`  - operator_name: "${h.operator_name}", stage: "${h.stage_name}", created_at: ${h.created_at}`))
    
    // Get full history for this card
    const { data: fullHistory } = await supabase
      .from('work_card_history')
      .select('operator_name, stage_name, created_at, card_info')
      .eq('card_id', cardId)
      .order('created_at', { ascending: true })
    
    console.log("Full history:")
    fullHistory?.forEach(h => console.log(`  [${h.stage_name}] "${h.operator_name}" created_at: ${h.created_at}`))
    
    // Get current card
    const { data: card } = await supabase.from('work_cards').select('operator_name, status').eq('id', cardId).maybeSingle()
    console.log("Current card operator_name:", card?.operator_name, "status:", card?.status)
    
    // Simulate BrakModule logic
    const operators = [...new Set([
      card?.operator_name,
      ...(fullHistory || [])
        .filter(row => row.stage_name !== 'Контроль ВКЯ')
        .map(row => row.operator_name)
    ]
      .map(name => String(name || '').trim())
      .filter(name => name && !name.toLowerCase().startsWith('вкя') && name !== 'Не вказано'))]
    
    console.log("Resolved operators list:", operators)
  }
}

run()
