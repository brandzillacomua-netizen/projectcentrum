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

async function checkP1038Sheets() {
  const taskId = '23ceb083-47f2-4f00-9922-339318478043'
  const { data: cards } = await supabase.from('work_cards').select('*').eq('task_id', taskId)
  const { data: nomList } = await supabase.from('nomenclatures').select('*')
  const { data: history } = await supabase.from('work_card_history').select('*')

  const p1038Nom = nomList.find(n => n.name && n.name.includes('F415-ІП27-П-10-38'))
  const p1038Cards = cards.filter(c => String(c.nomenclature_id) === String(p1038Nom.id))

  console.log('=== P-10-38 CARDS ===')
  p1038Cards.forEach(c => {
    const cHist = history.filter(h => String(h.card_id) === String(c.id))
    const totalHistScrap = cHist.reduce((s, h) => s + (Number(h.scrap_qty) || 0), 0)
    console.log(`Card ${c.id.slice(-8)} | Qty: ${c.quantity} | ScrapQty: ${c.scrap_qty} | HistScrap: ${totalHistScrap} | CardSheets: ${c.actual_sheets || c.sheets} | Info: ${c.card_info || ''}`)
  })
}

checkP1038Sheets().catch(console.error)
