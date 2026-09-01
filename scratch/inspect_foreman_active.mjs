import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function inspectForemanCards() {
  const { data: cards } = await supabase
    .from('work_cards')
    .select('id, nomenclature_id, operation, status, quantity, used_in_shop2_qty, task_id')
    .filter('status', 'neq', 'completed')
    .filter('status', 'neq', 'cancelled')

  console.log('Total non-completed cards in DB:', cards?.length)

  // Group by operation
  const byOp = {}
  cards?.forEach(c => {
    const key = `${c.operation} | ${c.status}`
    byOp[key] = (byOp[key] || 0) + (Number(c.quantity) || 0)
  })
  console.log('\n--- Non-completed cards by (Operation | Status) ---')
  console.table(byOp)

  // Find cards related to sorting or shop 2 buffer
  console.log('\n--- Details of cards with operation or status matching sorting/buffer ---')
  cards?.forEach(c => {
    const op = (c.operation || '').toLowerCase()
    const st = (c.status || '').toLowerCase()
    if (op.includes('сорт') || st.includes('buffer')) {
      console.log(`ID: ${c.id.slice(-8)} | NomID: ${c.nomenclature_id} | Op: "${c.operation}" | Status: "${c.status}" | Qty: ${c.quantity} | TaskID: ${c.task_id}`)
    }
  })
}

inspectForemanCards()
