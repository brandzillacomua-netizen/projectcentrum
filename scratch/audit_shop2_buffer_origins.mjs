import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function auditShop2BufferOrigins() {
  console.log('=== AUDITING CARDS WITH status = at-shop2-buffer ===')
  const { data: cards } = await supabase
    .from('work_cards')
    .select('id, task_id, status, operation, quantity, used_in_shop2_qty, nomenclature_id, order_id, card_info, created_at')
    .eq('status', 'at-shop2-buffer')

  console.log(`Total 'at-shop2-buffer' cards count: ${cards?.length || 0}`)
  
  const orderBreakdown = {}
  cards?.forEach(c => {
    const oId = c.order_id || 'no-order'
    if (!orderBreakdown[oId]) orderBreakdown[oId] = { count: 0, totalQty: 0, usedQty: 0 }
    orderBreakdown[oId].count++
    orderBreakdown[oId].totalQty += Number(c.quantity || 0)
    orderBreakdown[oId].usedQty += Number(c.used_in_shop2_qty || 0)
  })

  console.log('Breakdown by order_id:', orderBreakdown)

  console.log('\n=== AUDITING WMS INVENTORY (semi_shop2 & bz_shop2) ===')
  const { data: inv } = await supabase
    .from('inventory')
    .select('*')
    .in('type', ['semi_shop2', 'bz_shop2'])

  console.log(`Total inventory items count: ${inv?.length || 0}`)
  inv?.forEach(i => {
    console.log(`Item: nom_id=${i.nomenclature_id} | type=${i.type} | total_qty=${i.total_qty} | updated_at=${i.updated_at}`)
  })
}

auditShop2BufferOrigins().catch(console.error)
