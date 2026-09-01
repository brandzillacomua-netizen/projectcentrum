import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function trueShortage() {
  const taskId = '35c6045a-4da1-47d2-b73f-7d269ba1e3a3'
  const nomId = '5ecf63e5-802d-4f98-8291-aad9a52bfaa4'
  const unitsPerSheet = 30
  const need = 10000
  const plannedSheets = 334
  const stock = 0

  const { data: cards } = await supabase.from('work_cards').select('*').eq('task_id', taskId).eq('nomenclature_id', nomId)

  console.log('=== ДЕТАЛЬНИЙ РОЗРАХУНОК ЛИСТІВ ПО КАРТКАХ ===\n')
  
  let totalSheets = 0
  let bugSheets = 0
  
  cards.forEach(c => {
    const info = String(c.card_info || '')
    const reqMatch = info.match(/\[REQ:(\d+)\]/)
    const bzMatch = info.match(/\[BZ:(\d+)\]/)
    const req = reqMatch ? Number(reqMatch[1]) : null
    const bz = bzMatch ? Number(bzMatch[1]) : 0
    const actualSheetsField = Number(c.actual_sheets || c.actualSheets || c.sheets) || 0
    const cardNum = info.match(/^(\d+)\/(\d+)/)?.[1] || '?'
    
    // How getCardSheets ACTUALLY computes (with the bug):
    let sheetsComputed
    if (actualSheetsField > 0) {
      sheetsComputed = actualSheetsField
    } else if (req !== null && req > 0) {
      sheetsComputed = Math.ceil(req / unitsPerSheet)
    } else {
      // BUG: REQ=0 falls back to quantity!
      sheetsComputed = Math.ceil(Number(c.quantity) / unitsPerSheet)
    }
    
    // How it SHOULD compute:
    let sheetsCorrect
    if (actualSheetsField > 0) {
      sheetsCorrect = actualSheetsField
    } else if (req !== null) {
      // If REQ=0, no sheets needed (it's a BZ-only card)
      sheetsCorrect = req > 0 ? Math.ceil(req / unitsPerSheet) : 0
    } else {
      sheetsCorrect = Math.ceil(Number(c.quantity) / unitsPerSheet)
    }
    
    if (sheetsComputed !== sheetsCorrect) {
      console.log(`⚠️  БАГОВАЯ КАРТКА [${cardNum}]: REQ=${req}, BZ=${bz}, qty=${c.quantity}, actual_sheets_db=${actualSheetsField}`)
      console.log(`     Система рахує: ${sheetsComputed} листів  |  Правильно: ${sheetsCorrect} листів  ← РІЗНИЦЯ: +${sheetsComputed - sheetsCorrect}`)
      bugSheets += (sheetsComputed - sheetsCorrect)
    }
    
    totalSheets += sheetsComputed
  })
  
  console.log(`\n=== ПІДСУМОК ===`)
  console.log(`Плановано листів: ${plannedSheets}`)
  console.log(`Система рахує актуальних листів: ${totalSheets}  (з помилкою +${bugSheets})`)
  console.log(`Правильна кількість листів: ${totalSheets - bugSheets}`)
  
  const spareWrong = totalSheets * unitsPerSheet + stock - need
  const spareCorrect = (totalSheets - bugSheets) * unitsPerSheet + stock - need
  
  // Get scrap data
  const { data: vfst } = await supabase.from('vkya_final_scrap_totals').select('*').eq('task_id', taskId).eq('nomenclature_id', nomId)
  const finalScrap = vfst?.reduce((s, r) => s + Number(r.total_scrap), 0) || 0
  
  const { data: histCards } = await supabase.from('work_cards').select('id').eq('task_id', taskId).eq('nomenclature_id', nomId)
  const { data: hist } = await supabase.from('work_card_history').select('scrap_qty,stage_name,is_archived_scrap').in('card_id', histCards.map(c => c.id)).gt('scrap_qty', 0)
  const observedScrap = hist?.reduce((s, r) => s + Number(r.scrap_qty), 0) || 0

  console.log(`\n=== БРАК ===`)
  console.log(`Зафіксований брак (усі стадії): ${observedScrap} шт`)
  hist?.forEach(h => console.log(`  - ${h.scrap_qty} шт @ ${h.stage_name}  (is_archived: ${h.is_archived_scrap})`))
  console.log(`Підтверджений утиль ВКЯ (vkya_final_scrap_totals): ${finalScrap} шт`)
  console.log(`Незакритий брак (різниця): ${observedScrap - finalScrap} шт (брак на розкрої не через ВКЯ)`)
  
  console.log(`\n=== НЕСТАЧА ===`)
  console.log(`─── З помилкою (як зараз на екрані):`)
  console.log(`    spareFromSheets = ${totalSheets}×${unitsPerSheet} - ${need} = ${spareWrong}`)
  console.log(`    shortage = max(0, ${finalScrap} - ${spareWrong}) = ${Math.max(0, finalScrap - spareWrong)}  ← на екрані: 46 ✓`)
  console.log(``)
  console.log(`─── ПРАВИЛЬНО (без помилки в листах):`)
  console.log(`    spareFromSheets = ${totalSheets - bugSheets}×${unitsPerSheet} - ${need} = ${spareCorrect}`)
  console.log(`    shortage з VKYA-скрапом = max(0, ${finalScrap} - ${spareCorrect}) = ${Math.max(0, finalScrap - spareCorrect)}`)
  console.log(`    shortage з усім скрапом  = max(0, ${observedScrap} - ${spareCorrect}) = ${Math.max(0, observedScrap - spareCorrect)}`)
  console.log(``)
  console.log(`═══ ВИСНОВОК: СПРАВЖНЯ НЕСТАЧА = ${Math.max(0, observedScrap - spareCorrect)} шт (враховуючи весь зафіксований брак)`)
  console.log(`              або ${Math.max(0, finalScrap - spareCorrect)} шт (тільки VKYA-підтверджений утиль)`)
}

trueShortage().catch(console.error)
