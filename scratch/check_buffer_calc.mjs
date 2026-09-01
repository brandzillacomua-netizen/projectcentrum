import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function checkBufferCalculation() {
  const { data: workCards } = await supabase.from('work_cards').select('*')
  const { data: inventory } = await supabase.from('inventory').select('*')

  const streamingIncoming = (workCards || [])
    .filter(c => c.status === 'at-shop2-buffer')
    .reduce((a, c) => a + (Number(c.quantity) || 0) - (Number(c.used_in_shop2_qty) || 0), 0)

  const totalIncoming = (inventory || [])
    .filter(i => i.type === 'semi_shop2' || i.type === 'bz_shop2')
    .reduce((a, i) => a + (Number(i.total_qty) || 0), 0)

  const totalTaken = workCards
    .filter(c => c.card_info?.includes('[ЦЕХ №2]') && (c.status === 'in-progress' || c.status === 'at-buffer' || c.status === 'waiting-buffer'))
    .reduce((a, c) => a + (c.quantity || 0), 0)

  console.log('streamingIncoming (cards at-shop2-buffer):', streamingIncoming)
  console.log('totalIncoming (inventory semi_shop2 + bz_shop2):', totalIncoming)
  console.log('totalTaken (shop2 work cards in progress):', totalTaken)
  console.log('Math.max(streamingIncoming, totalIncoming - totalTaken):', Math.max(streamingIncoming, Math.max(0, totalIncoming - totalTaken)))

  // Also calculate totalBufferPartsCount as in renderStorageExplorer:
  // How renderStorageExplorer calculates totalBufferPartsCount:
  // 1. Cards in at-shop2-buffer (19251)
  // 2. Inventory semi_shop2 and bz_shop2 (6408)
  // Total = 19251 + 6408 = 25659!
}

checkBufferCalculation().catch(console.error)
