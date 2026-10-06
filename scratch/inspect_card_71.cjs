const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://hurzutjytlcvtbvihnry.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
})

async function run() {
  console.log("=== INSPECTING CARD 71 / 0FBF076A / 5F6A336C ===")

  // 1. Get cards
  const { data: cards, error: cardsErr } = await supabase
    .from('work_cards')
    .select('id, task_id, order_id, nomenclature_id, status, created_at, card_info')
  
  if (cardsErr) console.error('Cards error:', cardsErr)
  
  const matchCards = (cards || []).filter(c => 
    c.id.toLowerCase().includes('0fbf076a') ||
    c.id.toLowerCase().includes('5f6a336c')
  )

  console.log(`Matched work cards (${matchCards.length}):`)
  matchCards.forEach(c => {
    console.log(`- ID: ${c.id} | task: ${c.task_id} | nom: ${c.nomenclature_id} | status: ${c.status} | info: "${c.card_info}"`)
  })

  // 2. Query work_card_history for scrap on card 0fbf076a and 5f6a336c
  const cardIds = matchCards.map(c => c.id)
  if (cardIds.length > 0) {
    const { data: history, error: histErr } = await supabase
      .from('work_card_history')
      .select('*')
      .in('card_id', cardIds)
    console.log(`\nHistory for matched cards (${history?.length || 0}):`)
    console.log(JSON.stringify(history, null, 2))
  }

  // 3. Query all cards associated with nomenclature of part F415-ІП27-П-10-38
  const { data: noms } = await supabase
    .from('nomenclatures')
    .select('id, name, code')
    .ilike('code', '%F415-ІП27-П-10-38%')
  console.log('\nMatching nomenclature:', noms)

  if (noms && noms.length > 0) {
    const nomId = noms[0].id
    const cardsForNom = (cards || []).filter(c => c.nomenclature_id === nomId)
    console.log(`\nTotal work cards for part F415-ІП27-П-10-38: ${cardsForNom.length}`)
    cardsForNom.forEach(c => {
      console.log(`- Card ID: ${c.id} (ends with #${c.id.slice(-8).toUpperCase()}) | task: ${c.task_id} | status: ${c.status} | info: "${c.card_info}"`)
    })

    const { data: nomHistory } = await supabase
      .from('work_card_history')
      .select('*')
      .eq('nomenclature_id', nomId)
      .gt('scrap_qty', 0)
    console.log(`\nScrap history for part F415-ІП27-П-10-38 (${nomHistory?.length || 0}):`)
    console.log(JSON.stringify(nomHistory, null, 2))
  }
}

run()
