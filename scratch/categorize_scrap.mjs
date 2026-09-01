import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function categorize() {
  const taskId = '35c6045a-4da1-47d2-b73f-7d269ba1e3a3'
  const nomId = '50947afc-4e40-4165-a682-780275d5feda' // Н-3-14

  const { data: cards } = await supabase.from('work_cards').select('id').eq('task_id', taskId).eq('nomenclature_id', nomId)
  const { data: hist } = await supabase.from('work_card_history').select('*').in('card_id', cards.map(c => c.id)).gt('scrap_qty', 0)

  const parseCat = (comment) => {
    const m = String(comment || '').match(/\[SCRAP_CAT:(\{[^}]+\})\]/)
    if (!m) return null
    try { return JSON.parse(m[1]) } catch { return null }
  }
  const parseReasons = (comment) => {
    const m = String(comment || '').match(/\[SCRAP_REASONS:(\{[^}]*\})\]/)
    if (!m) return null
    try { return JSON.parse(m[1]) } catch { return null }
  }

  console.log('=== ВСІ 12 ШТ БРАКУ ПО КАТЕГОРІЯХ ===\n')
  
  let totalCat1=0, totalCat2=0, totalCat3=0, totalCat4=0, totalRest=0, totalNoCat=0

  hist.forEach(h => {
    const cat = parseCat(h.qc_scrap_comment)
    const reasons = parseReasons(h.qc_scrap_comment)
    const reasonStr = reasons ? Object.entries(reasons).filter(([,v])=>v>0).map(([k,v])=>`${k}: ${v}`).join(', ') : '—'

    console.log(`${h.scrap_qty} шт @ ${h.stage_name}`)
    if (cat) {
      console.log(`  CAT1(відновлення): ${cat.cat1}  CAT2(переробка): ${cat.cat2}  CAT3(умовно брак): ${cat.cat3}  CAT4(утиль): ${cat.cat4}  restoration: ${cat.restoration}`)
      totalCat1 += cat.cat1 || 0
      totalCat2 += cat.cat2 || 0
      totalCat3 += cat.cat3 || 0
      totalCat4 += cat.cat4 || 0
      totalRest += cat.restoration || 0
    } else {
      console.log(`  (без категорії ВКЯ — прямий брак оператора)`)
      totalNoCat += Number(h.scrap_qty)
    }
    console.log(`  Причина: ${reasonStr}`)
    console.log(`  Оператор ВКЯ: ${h.qc_scrap_reason || '—'}`)
    console.log()
  })

  console.log('=== ПІДСУМОК ПО КАТЕГОРІЯХ ===')
  console.log(`CAT1 (потенційно відновлювані):  ${totalCat1} шт`)
  console.log(`CAT2 (переробка можлива):          ${totalCat2} шт`)
  console.log(`CAT3 (умовний брак):               ${totalCat3} шт`)
  console.log(`CAT4 (утиль, неповернений):        ${totalCat4} шт`)
  console.log(`Restoration (відновлення):         ${totalRest} шт`)
  console.log(`Без категорії (прямий):             ${totalNoCat} шт`)
  console.log(`─────────────────────────────────────`)
  console.log(`ВСЬОГО БРАКУ:                      ${totalCat1+totalCat2+totalCat3+totalCat4+totalRest+totalNoCat} шт`)
  console.log()
  console.log('=== ЩО ПОКАЗУЄ СИСТЕМА ===')
  console.log(`БРАК (observedScrap):  12 шт  ← усі зафіксовані`)
  console.log(`УТИЛЬ (cat4 only):      2 шт  ← лише безповоротні`)
  console.log(`НА ВКЯ:                 0 шт  ← відображає cat1+cat2+cat3 що ПОКИ на ВКЯ`)
  console.log()
  console.log(`Відповідь: ${totalCat1} шт класифіковані як CAT1 (відновлювані) — вони вже ЗАКРИТІ (is_archived=true)`)
  console.log(`→ ВКЯ визнав їх відновлюваними, але вони НЕ повернулись у виробництво і НЕ стали утилем`)
  console.log(`→ Це баг обліку: CAT1 після закриття зникає з дашборда`)
}

categorize().catch(console.error)
