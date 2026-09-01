import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function whereAre10() {
  const taskId = '35c6045a-4da1-47d2-b73f-7d269ba1e3a3'
  const nomId = '50947afc-4e40-4165-a682-780275d5feda' // Н-3-14

  const { data: cards } = await supabase.from('work_cards').select('id,status,quantity,card_info').eq('task_id', taskId).eq('nomenclature_id', nomId)
  const cardIds = cards.map(c => c.id)

  // All scrap history
  const { data: hist } = await supabase.from('work_card_history').select('*').in('card_id', cardIds).gt('scrap_qty', 0)
  console.log('=== ВЕСЬ ЗАФІКСОВАНИЙ БРАК (work_card_history) ===')
  let total = 0
  hist.forEach(h => {
    total += Number(h.scrap_qty)
    console.log(`  ${h.scrap_qty} шт @ ${h.stage_name} | is_archived_scrap=${h.is_archived_scrap} | card=${h.card_id}`)
  })
  console.log(`  ВСЬОГО: ${total} шт`)

  // vkya_final_scrap_totals - cat4 only
  const { data: vfst } = await supabase.from('vkya_final_scrap_totals').select('*').eq('task_id', taskId).eq('nomenclature_id', nomId)
  console.log('\n=== vkya_final_scrap_totals (підтверджений CAT4 = УТИЛЬ) ===')
  let totalVkya = 0
  vfst?.forEach(r => {
    totalVkya += Number(r.total_scrap)
    console.log(`  ${r.total_scrap} шт | card=${r.card_id}`)
  })
  console.log(`  ВСЬОГО: ${totalVkya} шт`)

  // scrap_classifications - actual VKYA classification decisions
  const { data: sc, error: sce } = await supabase.from('scrap_classifications').select('*').in('work_card_history_id', hist.map(h => h.id))
  console.log('\n=== scrap_classifications (рішення ВКЯ по кожному запису) ===', sce?.message || '')
  if (sc?.length) {
    sc.forEach(r => console.log(`  history=${r.work_card_history_id} | category=${r.classification_category_id} | qty=${r.classified_qty} | created=${r.created_at?.substring(0,19)}`))
  } else {
    console.log('  ПОРОЖНЬО — жодного рішення ВКЯ не знайдено')
  }

  // vkya_scrap_lot_allocations
  const { data: lots, error: le } = await supabase.from('vkya_scrap_lot_allocations').select('*').in('work_card_history_id', hist.map(h => h.id))
  console.log('\n=== vkya_scrap_lot_allocations ===', le?.message || '')
  if (lots?.length) {
    lots.forEach(r => console.log(`  ${JSON.stringify(r)}`))
  } else {
    console.log('  ПОРОЖНЬО')
  }

  // Check if those card_ids have any vkya inventory entries
  const { data: inv, error: ie } = await supabase.from('vkya_inventory').select('*').eq('nomenclature_id', nomId)
  console.log('\n=== vkya_inventory для цієї деталі ===', ie?.message || '')
  if (inv?.length) {
    inv.forEach(r => console.log(`  type=${r.type} qty=${r.total_qty} | ${JSON.stringify(r)}`))
  } else {
    console.log('  ПОРОЖНЬО')
  }

  // workcard_history with their is_archived status
  console.log('\n=== ВИСНОВОК ===')
  console.log(`Брак зафіксовано: ${total} шт`)
  console.log(`ВКЯ класифікував як УТИЛЬ (cat4): ${totalVkya} шт`)
  console.log(`НЕ ОБЛІКОВАНО НІКУДИ: ${total - totalVkya} шт`)
  console.log()
  const missing = hist.filter(h => !vfst?.find(v => v.card_id === h.card_id && Number(v.total_scrap) > 0))
  missing.forEach(h => {
    console.log(`  → ${h.scrap_qty} шт @ "${h.stage_name}" (is_archived=${h.is_archived_scrap})`)
    console.log(`    Що це: брак зафіксований оператором але ВКЯ НЕ виніс рішення cat4 по ньому`)
  })
}

whereAre10().catch(console.error)
