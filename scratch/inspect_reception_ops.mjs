import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function checkOperations() {
  const { data: cards } = await supabase
    .from('work_cards')
    .select('id, operation, status, quantity, card_info')

  const ops = {}
  ;(cards || []).forEach(c => {
    const key = `${c.operation} | status: ${c.status}`
    ops[key] = (ops[key] || 0) + 1
  })

  console.log('=== Operations & Statuses in work_cards ===')
  console.log(ops)

  const { data: inv } = await supabase
    .from('inventory')
    .select('id, type, quantity')

  const invTypes = {}
  ;(inv || []).forEach(i => {
    invTypes[i.type] = (invTypes[i.type] || 0) + Number(i.quantity || 0)
  })

  console.log('\n=== Inventory Types & Total Qty ===')
  console.log(invTypes)
}

checkOperations().catch(console.error)
