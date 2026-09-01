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

async function checkK39Vkya() {
  const taskId = '23ceb083-47f2-4f00-9922-339318478043'
  const { data: nomList } = await supabase.from('nomenclatures').select('*')
  const k39Nom = nomList.find(n => n.name && n.name.includes('F415-ІП27-К-3-9'))

  const { data: cards } = await supabase.from('work_cards').select('*').eq('task_id', taskId).eq('nomenclature_id', k39Nom.id)
  const cardIds = cards.map(c => c.id)

  const { data: history } = await supabase.from('work_card_history').select('*').in('card_id', cardIds)
  const { data: classifications } = await supabase.from('scrap_classifications').select('*').in('source_history_id', history.map(h => h.id))
  const { data: resolutions } = await supabase.from('vkya_quality_resolutions').select('*').eq('task_id', taskId).eq('nomenclature_id', k39Nom.id)
  const { data: finalScrap } = await supabase.from('vkya_final_scrap_totals').select('*').eq('task_id', taskId).eq('nomenclature_id', k39Nom.id)

  console.log('=== K-3-9 WORK CARD HISTORY (Scrap reported at terminals) ===')
  history.forEach(h => {
    console.log(`History ID ${h.id} | card_id: ${h.card_id.slice(-8)} | op: ${h.operation} | scrap_qty: ${h.scrap_qty} | status: ${h.status}`)
  })

  console.log('\n=== SCRAP CLASSIFICATIONS (VKYA decisions) ===')
  console.log(classifications)

  console.log('\n=== VKYA RESOLUTIONS ===')
  console.log(resolutions)

  console.log('\n=== VKYA FINAL SCRAP TOTALS (Cat 4 Utilt) ===')
  console.log(finalScrap)
}

checkK39Vkya().catch(console.error)
