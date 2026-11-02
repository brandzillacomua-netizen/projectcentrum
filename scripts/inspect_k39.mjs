import { createClient } from '@supabase/supabase-js'

const url = 'https://hurzutjytlcvtbvihnry.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(url, key)

async function main() {
  await supabase.auth.signInWithPassword({ email: 'vvv@centrum.local', password: 'vvv' })

  const nomId = 'f47ae25f-05bf-415d-bd3e-91ec9163befa' // F415-ІП27-К-3-9

  const { data: inv } = await supabase
    .from('inventory')
    .select('*')
    .eq('nomenclature_id', nomId)

  console.log('All inventory for F415-ІП27-К-3-9:');
  inv?.forEach(i => console.log(`wh=${i.warehouse} type=${i.type} total=${i.total_qty} res=${i.reserved_qty} id=${i.id}`));

  // Check reception_docs / arrivals / transfers for this nom
  const { data: receipts } = await supabase
    .from('work_cards')
    .select('id, quantity, operation, status, completed_at, card_info')
    .eq('nomenclature_id', nomId)
    .eq('operation', 'Пакування/СГП')
    .eq('status', 'completed')

  console.log('Completed handover cards to SGP:', receipts)
}

main().catch(console.error)

