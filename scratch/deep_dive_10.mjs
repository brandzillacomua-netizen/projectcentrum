import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function deepDive() {
  const taskId = '35c6045a-4da1-47d2-b73f-7d269ba1e3a3'
  const nomId = '50947afc-4e40-4165-a682-780275d5feda' // Н-3-14

  // The 4 card IDs with unaccounted scrap
  const missingCards = [
    '763e3390-036c-4de5-b322-f5c9054982de', // 4 шт @ Контроль ВКЯ
    '35ab1bbb-bd9d-4b0b-a8e1-196e7870060b', // 3 шт @ Сортування
    'b1a1f371-5022-43c6-b950-2cec1b5c9d48', // 1 шт @ Контроль ВКЯ
    'be917322-c568-4960-b07b-d5eb105f1f83', // 2 шт @ Розкрій
  ]

  console.log('=== РОБОЧІ КАРТКИ З НЕВІДОМИМ БРАКОМ ===\n')
  for (const cardId of missingCards) {
    const { data: card } = await supabase.from('work_cards').select('*').eq('id', cardId).single()
    const { data: hist } = await supabase.from('work_card_history').select('*').eq('card_id', cardId).gt('scrap_qty', 0)
    
    console.log(`Картка: ${cardId}`)
    console.log(`  status: ${card?.status}`)
    console.log(`  operation: ${card?.operation}`)
    console.log(`  quantity: ${card?.quantity}`)
    console.log(`  is_rework: ${card?.is_rework}`)
    console.log(`  card_info: ${String(card?.card_info || '').substring(0, 200)}`)
    hist?.forEach(h => {
      console.log(`  БРАК: ${h.scrap_qty} шт @ ${h.stage_name} | is_archived=${h.is_archived_scrap} | scrap_category=${h.scrap_category || 'NULL'} | created=${h.created_at?.substring(0,19)}`)
      // Print ALL fields to find hidden category
      const extraKeys = ['bz_qty', 'good_qty', 'repair_qty', 'notes', 'operator_id', 'classification', 'category']
      extraKeys.forEach(k => { if (h[k]) console.log(`    ${k}: ${h[k]}`) })
    })
    
    // Full history for this card (all stages)
    const { data: fullHist } = await supabase.from('work_card_history').select('stage_name,good_qty,scrap_qty,bz_qty,created_at').eq('card_id', cardId).order('created_at', { ascending: true })
    console.log(`  Повна історія:`)
    fullHist?.forEach(h => console.log(`    ${h.stage_name}: good=${h.good_qty} scrap=${h.scrap_qty} bz=${h.bz_qty} at=${h.created_at?.substring(0,19)}`))
    console.log()
  }

  // Check all scrap history columns
  const { data: sampleHist } = await supabase.from('work_card_history').select('*').eq('card_id', missingCards[0]).gt('scrap_qty', 0).limit(1)
  if (sampleHist?.[0]) {
    console.log('=== ВСІ ПОЛЯ ЗАПИСУ БРАКУ ===')
    Object.entries(sampleHist[0]).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== 0 && v !== false && v !== '') {
        console.log(`  ${k}: ${v}`)
      }
    })
    console.log()
    console.log('=== ВСІ ПОЛЯ (включаючи порожні) ===')
    Object.entries(sampleHist[0]).forEach(([k, v]) => console.log(`  ${k}: ${JSON.stringify(v)}`))
  }
}

deepDive().catch(console.error)
