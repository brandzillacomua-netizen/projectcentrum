const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://hurzutjytlcvtbvihnry.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function run() {
  // Find cards that had 2+ DISTINCT operators in history with stage_name = 'Розкрій (перезмінка)'
  // where the "middle" operator might be missing from work_cards.operator_name
  
  const { data: shiftHistories } = await supabase
    .from('work_card_history')
    .select('card_id, operator_name, stage_name, created_at, card_info')
    .eq('stage_name', 'Розкрій (перезмінка)')
    .order('created_at', { ascending: false })
    .limit(100)
    
  const byCard = {}
  shiftHistories?.forEach(h => {
    if (!byCard[h.card_id]) byCard[h.card_id] = []
    byCard[h.card_id].push(h)
  })
  
  const multiShiftCards = Object.entries(byCard).filter(([, history]) => history.length >= 2)
  console.log(`Cards with 2+ shift changes: ${multiShiftCards.length}`)
  
  for (const [cardId, history] of multiShiftCards) {
    // Check if card_info of the card itself has REPLACED_BY markers
    const { data: card } = await supabase.from('work_cards').select('operator_name, status, card_info').eq('id', cardId).maybeSingle()
    
    // Parse all operators from card_info REPLACED_BY markers
    const replacedByMatches = (card?.card_info || '').match(/\[REPLACED_BY:([^\]]+)\]/g) || []
    const replacedByNames = replacedByMatches.map(m => m.match(/\[REPLACED_BY:([^(]+)/)?.[1]?.trim()).filter(Boolean)
    
    // History operators
    const historyOps = history.map(h => h.operator_name).filter(Boolean)
    
    // All operators we'd see in BrakModule list
    const fullHistory = [...new Set([
      card?.operator_name,
      ...historyOps
    ].map(n => String(n || '').trim()).filter(n => n && !n.toLowerCase().startsWith('вкя') && n !== 'Не вказано'))]
    
    if (fullHistory.length >= 3) {
      console.log(`\n=== Card ${cardId.slice(-8)} ===`)
      console.log('Status:', card?.status)
      console.log('History operators:', historyOps)
      console.log('card_info REPLACED_BY:', replacedByNames)
      console.log('Final BrakModule operator list:', fullHistory)
      console.log('Count:', fullHistory.length)
    }
  }
}

run()
