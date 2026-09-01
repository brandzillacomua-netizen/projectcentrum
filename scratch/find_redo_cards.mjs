import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function findRedoCards() {
  const taskId = '35c6045a-4da1-47d2-b73f-7d269ba1e3a3'
  const nomId3 = '5ecf63e5-802d-4f98-8291-aad9a52bfaa4'

  const { data: cards } = await supabase.from('work_cards').select('*').eq('task_id', taskId).eq('nomenclature_id', nomId3)

  console.log(`Total cards for this nom: ${cards.length}`)
  
  // Print ALL card_info substrings to find any redo/repair/reissue markers
  const uniqueFlags = new Set()
  cards.forEach(c => {
    const info = String(c.card_info || '')
    // Extract all bracketed tags
    const tags = info.match(/\[[^\]]+\]/g) || []
    tags.forEach(t => uniqueFlags.add(t.split(':')[0] + ']'))
    
    if (c.is_rework) console.log(`REWORK card: ${c.id} status=${c.status} qty=${c.quantity}`)
    if (info.includes('[REDO]')) console.log(`REDO card: ${c.id} status=${c.status} qty=${c.quantity}`)
    if (info.includes('[REPAIR]')) console.log(`REPAIR card: ${c.id} status=${c.status} qty=${c.quantity}`)
    if (info.includes('[REISSUE]')) console.log(`REISSUE card: ${c.id} status=${c.status}`)
    if (info.includes('[DOVYPUSK]')) console.log(`DOVYPUSK card: ${c.id} status=${c.status}`)
  })

  console.log('\nAll unique card_info tag types:', [...uniqueFlags].join(', '))
  console.log('\n=== ALL is_rework flags ===')
  cards.forEach(c => {
    if (c.is_rework !== false && c.is_rework !== null && c.is_rework !== undefined) {
      console.log(`is_rework=${c.is_rework}: ${c.id} qty=${c.quantity} status=${c.status}`)
    }
  })

  // Print a sample card_info from each unique style
  const seen = new Set()
  cards.forEach(c => {
    const info = String(c.card_info || '')
    const key = info.substring(0, 30)
    if (!seen.has(key)) {
      seen.add(key)
      console.log(`\nSample card ${c.id}: is_rework=${c.is_rework} status=${c.status}`)
      console.log(`  info: ${info.substring(0, 200)}`)
    }
  })
}

findRedoCards().catch(console.error)
