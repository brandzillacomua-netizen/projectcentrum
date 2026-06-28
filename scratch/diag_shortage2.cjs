const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function diagnose() {
  // Cards with scrap for task 25062026-02
  const scrapCardIds = [
    'faf610a7-61bb-4947-a2a0-9cafa7ea6edc',
    '1fbd1792-9b3d-48d4-bc0f-c7fd1c091a29',
    '0d15a9c2-d7c4-4ab4-9a2e-eb9367564c47',
    'f374eeb0-3e34-4651-97db-f8c20420fd42'
  ]
  
  // Check what the global workCardHistory (latest 500) contains
  const { data: globalHistory } = await supabase
    .from('work_card_history')
    .select('id, card_id, scrap_qty, created_at')
    .order('created_at', { ascending: false })
    .limit(500)
  
  console.log(`Global workCardHistory (latest 500): ${(globalHistory||[]).length} entries`)
  
  // Check which scrap entries from our target task are visible in the global 500
  const scrapCardSet = new Set(scrapCardIds)
  const visibleScrap = (globalHistory||[]).filter(h => scrapCardSet.has(h.card_id) && Number(h.scrap_qty) > 0)
  console.log(`\nScrap entries from 25062026-02 visible in global 500 latest:`)
  if (visibleScrap.length === 0) {
    console.log('  ⚠️  NONE! Scrap entries are too old and fell outside the 500-row limit!')
    console.log('  This is the root cause of the bug!')
  } else {
    visibleScrap.forEach(h => console.log(`  card_id=${h.card_id} scrap=${h.scrap_qty} date=${h.created_at}`))
  }
  
  // Show when those scrap entries were created
  console.log('\nAll scrap entries for these cards (full history):')
  const { data: scrapHistory } = await supabase
    .from('work_card_history')
    .select('id, card_id, scrap_qty, created_at')
    .in('card_id', scrapCardIds)
    .gt('scrap_qty', 0)
  
  scrapHistory?.forEach(h => console.log(`  card_id=${h.card_id} scrap=${h.scrap_qty} date=${h.created_at}`))
  
  // Check the oldest entry in global 500
  const oldest = globalHistory?.[globalHistory.length - 1]
  console.log(`\nOldest entry in global 500: ${oldest?.created_at}`)
  const newest = globalHistory?.[0]
  console.log(`Newest entry in global 500: ${newest?.created_at}`)
}

diagnose().catch(console.error)
