import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function checkExactVkya() {
  const { data: orders } = await supabase.from('orders').select('*')
  const { data: tasks } = await supabase.from('tasks').select('*')
  const { data: cards } = await supabase.from('work_cards').select('*')
  const { data: history } = await supabase.from('work_card_history').select('*')

  const targetOrder = orders.find(o => o.order_num === '260827-2')
  const s1Task = tasks.find(t => t.order_id === targetOrder.id && t.step?.includes('Розкрій'))

  const nomId = '50947afc-4e40-4165-a682-780275d5feda' // Detail 2 (Київ К-ІП9/10/31/36/37-9-10-11-Н-3-14)

  const s1Cards = cards.filter(c => c.task_id === s1Task.id && String(c.nomenclature_id) === String(nomId))
  const cardIds = new Set(s1Cards.map(c => String(c.id)))

  const nomHist = history.filter(h => h.card_id && cardIds.has(String(h.card_id)))

  console.log('Nom History total entries:', nomHist.length)

  // Find all entries in history that contributed scrap
  const scrapEntries = nomHist.filter(h => Number(h.scrap_qty) > 0)
  console.log('Scrap History Entries count:', scrapEntries.length)
  scrapEntries.forEach(h => {
    console.log(`Scrap history entry: id=${h.id}, card_id=${h.card_id}, stage=${h.stage_name}, scrap_qty=${h.scrap_qty}, is_archived=${h.is_archived_scrap}, notes=${h.notes}, comment=${h.qc_scrap_comment}`)
  })

  const observedScrap = scrapEntries.reduce((sum, h) => sum + Number(h.scrap_qty), 0)
  const confirmedUtilScrap = scrapEntries.filter(h => h.is_archived_scrap).reduce((sum, h) => sum + Number(h.scrap_qty), 0)

  console.log('\n--- Summary for Detail 2 ---')
  console.log('Observed total scrap in history:', observedScrap)
  console.log('Confirmed UTIL scrap (is_archived_scrap = true):', confirmedUtilScrap)
  console.log('Pending in VKYA quarantine (observedScrap - confirmedUtilScrap):', observedScrap - confirmedUtilScrap)
}

checkExactVkya().catch(console.error)
