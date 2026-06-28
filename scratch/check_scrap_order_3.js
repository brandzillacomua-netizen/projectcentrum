import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const taskId = 'c7055204-cbad-4f74-bae6-4a8a79c14b7e'
  const { data: cards } = await supabase.from('work_cards').select('id, card_info, nomenclature_id').eq('task_id', taskId)
  const cardIds = cards.map(c => c.id)
  
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*')
  const { data: hist } = await supabase.from('work_card_history').select('*').in('card_id', cardIds)

  const noms = {}
  cards.forEach(c => {
    const nom = nomenclatures.find(n => n.id === c.nomenclature_id)
    if (nom) noms[c.id] = nom.name
  })

  const groupScrap = {}
  hist?.forEach(h => {
    if (Number(h.scrap_qty) > 0) {
      const partName = noms[h.card_id] || 'Unknown'
      groupScrap[partName] = (groupScrap[partName] || 0) + Number(h.scrap_qty)
      console.log(`- Card ID: ${h.card_id} | Part: ${partName} | Scrap: ${h.scrap_qty} | Info: ${cards.find(c=>c.id===h.card_id)?.card_info}`)
    }
  })

  console.log('Totals by part name:')
  console.log(groupScrap)
}

main().catch(console.error)
