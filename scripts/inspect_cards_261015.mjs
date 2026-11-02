import { createClient } from '@supabase/supabase-js'

const url = 'https://hurzutjytlcvtbvihnry.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(url, key)

async function main() {
  await supabase.auth.signInWithPassword({ email: 'vvv@centrum.local', password: 'vvv' })

  // Find work_cards for order 77150d12 and F415-ІП27-К-3-9 (f47ae25f-05bf-415d-bd3e-91ec9163befa)
  const { data: cards } = await supabase
    .from('work_cards')
    .select('id, operation, status, quantity, card_info, created_at, completed_at')
    .eq('order_id', '77150d12-f973-4a8a-97e5-971412978f00')
    .eq('nomenclature_id', 'f47ae25f-05bf-415d-bd3e-91ec9163befa')

  console.log(`Cards for F415-ІП27-К-3-9 (${cards?.length} cards):`);
  let totalQty = 0
  cards?.forEach(c => {
    totalQty += Number(c.quantity || 0)
    console.log(`id=${c.id.slice(-8)} op="${c.operation}" st=${c.status} qty=${c.quantity} info="${c.card_info}"`)
  })
  console.log('Total qty across all cards:', totalQty)
}

main().catch(console.error)

