import { createClient } from '@supabase/supabase-js'
import { buildScrapModel } from '../src/modules/Foreman2/features/scrap/scrapCalculations.js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
})

async function checkK39Observed() {
  const taskId = '23ceb083-47f2-4f00-9922-339318478043'
  const { data: nomList } = await supabase.from('nomenclatures').select('*')
  const k39Nom = nomList.find(n => n.name && n.name.includes('F415-ІП27-К-3-9'))

  const { data: cards } = await supabase.from('work_cards').select('*').eq('task_id', taskId)
  const { data: history } = await supabase.from('work_card_history').select('*').eq('task_id', taskId)

  const historyMap = new Map()
  history.forEach(row => {
    if (!row) return
    const key = String(row.id || `${row.card_id}-${row.created_at}`)
    historyMap.set(key, row)
  })

  const scrapModel = buildScrapModel(cards, Array.from(historyMap.values()))
  const observedScrap = scrapModel.scrapByTask?.[taskId]?.[k39Nom.id] || 0
  console.log('Observed Scrap for K-3-9:', observedScrap)

  const finalScrap = 72 // Cat 4 Utilt from db
  const qualityHold = Math.max(0, observedScrap - finalScrap)
  console.log('Quality Hold (НА ВКЯ) for K-3-9:', qualityHold)
}

checkK39Observed().catch(console.error)
