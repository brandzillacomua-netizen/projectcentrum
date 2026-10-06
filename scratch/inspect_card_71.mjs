import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envFile = fs.readFileSync('a:/centrum/.env', 'utf8')
let url = ''
let key = ''
let email = ''
let password = ''
for (const line of envFile.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim().replace(/['"]/g, '')
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim().replace(/['"]/g, '')
  if (line.startsWith('AUDIT_EMAIL=')) email = line.split('=')[1].trim().replace(/['"]/g, '')
  if (line.startsWith('AUDIT_PASSWORD=')) password = line.split('=')[1].trim().replace(/['"]/g, '')
}

const supabase = createClient(url, key)

async function run() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({ email, password })
  if (authErr) {
    console.error('Auth failed:', authErr)
    return
  }
  console.log('Logged in successfully as:', auth.user.email)

  // Query RPC or projection or history
  const { data: proj, error: projErr } = await supabase.rpc('vkya_classification_queue_changes', { p_after_seq: 0 })
  console.log('Projection RPC error:', projErr)
  
  const changes = proj?.changes || []
  console.log(`Projection changes count: ${changes.length}`)

  // Find card with F415-ІП27-П-10-38 or matching card #71
  for (const c of changes) {
    const payload = c.payload
    if (payload.id?.toLowerCase().includes('0fbf076a') || payload.card_id?.toLowerCase().includes('0fbf076a') || payload.card_id?.toLowerCase().includes('5f6a336c')) {
      console.log('FOUND MATCHING PROJECTION ROW:', JSON.stringify(c, null, 2))
    }
  }

  // Also query work_cards for 0fbf076a and 5f6a336c
  const { data: cards } = await supabase
    .from('work_cards')
    .select('*')
  
  const matches = (cards || []).filter(c => 
    c.id.toLowerCase().includes('0fbf076a') || 
    c.id.toLowerCase().includes('5f6a336c')
  )
  console.log('Matching work cards in DB:', JSON.stringify(matches, null, 2))

  if (matches.length > 0) {
    const cardIds = matches.map(m => m.id)
    const { data: hist } = await supabase
      .from('work_card_history')
      .select('*')
      .in('card_id', cardIds)
    console.log('Matching history in DB:', JSON.stringify(hist, null, 2))
  }
}

run()
