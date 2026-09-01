const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://hurzutjytlcvtbvihnry.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
})

async function run() {
  console.log("=== SEARCHING FOR ALL REISSUE / REWORK TASKS / CARDS ===")

  // Search orders for order_num like %260825% or %переробка% or %довипуск% or %ВБ%
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .or('order_num.ilike.%260825%,order_num.ilike.%ВБ%,source.ilike.%переробка%')

  console.log("Matching orders count:", orders?.length)
  orders?.forEach(o => {
    console.log(`Order ${o.order_num} | customer: ${o.customer} | status: ${o.status}`)
  })

  // Search work_cards with is_rework = true or card_info ilike %REDO%
  const { data: redoCards } = await supabase
    .from('work_cards')
    .select('*')
    .or('is_rework.eq.true,card_info.ilike.%[REDO]%')

  console.log(`\nAll REDO cards count in database: ${redoCards?.length}`)
  redoCards?.forEach(c => {
    console.log(`  Card #${c.id.slice(-8)} | task_id: ${c.task_id} | nom_id: ${c.nomenclature_id} | qty: ${c.quantity} | status: ${c.status} | info: ${c.card_info}`)
  })
}

run()
