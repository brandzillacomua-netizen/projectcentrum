import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function analyzeFullOrder() {
  const taskId = '35c6045a-4da1-47d2-b73f-7d269ba1e3a3'
  const nomId3 = '5ecf63e5-802d-4f98-8291-aad9a52bfaa4'
  const unitsPerSheet = 30
  const plannedSheets = 334

  const { data: allCards } = await supabase.from('work_cards').select('*').eq('task_id', taskId).eq('nomenclature_id', nomId3)

  console.log(`Total cards for detail В-3-30: ${allCards.length}`)
  console.log(`Planned sheets: ${plannedSheets} (${plannedSheets * unitsPerSheet} units)`)
  console.log()

  // Compute sheets per card
  let totalSheets = 0
  const cardSheets = allCards.map(c => {
    const info = String(c.card_info || '')
    const reqMatch = info.match(/\[REQ:(\d+)\]/)
    const reqQty = reqMatch ? Number(reqMatch[1]) : Number(c.quantity)
    const sheets = Math.ceil(reqQty / unitsPerSheet)
    totalSheets += sheets
    return { ...c, reqQty, sheets }
  })

  console.log(`Actual total sheets: ${totalSheets}  (${totalSheets * unitsPerSheet} units)`)
  console.log(`Extra sheets beyond plan: ${totalSheets - plannedSheets}`)
  console.log()

  // Find the "extra" cards - those that push total above plannedSheets
  // Sort by creation time to find the last ones added
  const sorted = [...cardSheets].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  
  console.log('=== CARD ORDER BY CREATION TIME (first 5 and last 10) ===')
  const last10 = sorted.slice(-10)
  last10.forEach(c => {
    const info = String(c.card_info || '')
    const cardNumMatch = info.match(/^(\d+)\/(\d+)/)
    const cardNum = cardNumMatch ? `${cardNumMatch[1]}/${cardNumMatch[2]}` : '?'
    const isRework = c.is_rework ? 'IS_REWORK!' : ''
    const hasRedo = info.includes('[REDO]') ? 'HAS_REDO!' : ''
    const bzMatch = info.match(/\[BZ:(\d+)\]/)
    const bz = bzMatch ? `BZ=${bzMatch[1]}` : ''
    console.log(`  [${cardNum}] ${isRework}${hasRedo} REQ=${c.reqQty} sheets=${c.sheets} status=${c.status} created=${c.created_at?.substring(0,19)} ${bz}`)
  })

  console.log()
  console.log('=== CARDS WITH BZ > 0 (possible reissue markers) ===')
  cardSheets.filter(c => {
    const bz = String(c.card_info||'').match(/\[BZ:(\d+)\]/)?.[1]
    return Number(bz) > 0
  }).forEach(c => {
    const info = String(c.card_info || '')
    const reqMatch = info.match(/\[REQ:(\d+)\]/)
    const bzMatch = info.match(/\[BZ:(\d+)\]/)
    console.log(`  card ${c.id}: REQ=${reqMatch?.[1]} BZ=${bzMatch?.[1]} sheets=${c.sheets} status=${c.status} created=${c.created_at?.substring(0,19)}`)
    console.log(`    info: ${info.substring(0, 300)}`)
  })

  console.log()
  console.log('=== CARDS CREATED AFTER THE FIRST SCRAP EVENT ===')
  // First scrap was 2026-08-28T08
  const afterScrap = cardSheets
    .filter(c => new Date(c.created_at) > new Date('2026-08-28T08:30:00'))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  console.log(`Cards created after first scrap (2026-08-28T08:30): ${afterScrap.length}`)
  afterScrap.forEach(c => {
    const info = String(c.card_info || '')
    const cardNumMatch = info.match(/^(\d+)\/(\d+)/)
    const cardNum = cardNumMatch ? `${cardNumMatch[1]}/${cardNumMatch[2]}` : '?'
    console.log(`  [${cardNum}] REQ=${c.reqQty} sheets=${c.sheets} status=${c.status} is_rework=${c.is_rework} created=${c.created_at?.substring(0,19)}`)
    const extraFlags = info.match(/\[[A-Z_]+:[^\]]+\]/g)?.filter(f => !f.includes('NEED') && !f.includes('REQ') && !f.includes('BZ') && !f.includes('BOX') && !f.includes('MATERIALS') && !f.includes('SHOP') && !f.includes('ORIGINAL') && !f.includes('CUTTERS'))
    if (extraFlags?.length) console.log(`    extra flags: ${extraFlags.join(' ')}`)
  })
}

analyzeFullOrder().catch(console.error)
