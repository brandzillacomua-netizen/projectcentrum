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

function countAsProduced(card) {
  return ['completed', 'at-shop2-buffer', 'at-buffer', 'waiting-buffer'].includes(card?.status)
}

async function run() {
  const taskId = '23ceb083-47f2-4f00-9922-339318478043'
  const nomId = 'c6e25b2b-5fec-432c-a0fc-fc16be80d271'

  const { data: cards } = await supabase.from('work_cards').select('*').eq('task_id', taskId).eq('nomenclature_id', nomId)
  console.log("=== CARDS FOR F415-ІП27-К-3-9 ===")
  let totalGross = 0
  let producedSum = 0

  cards.forEach(c => {
    const isProd = countAsProduced(c)
    totalGross += Number(c.quantity) || 0
    if (isProd) producedSum += Number(c.quantity) || 0
    console.log(`Card #${c.id.slice(-8)} | op: ${c.operation} | status: ${c.status} | qty: ${c.quantity} | countAsProduced: ${isProd} | info: "${c.card_info}"`)
  })

  console.log("\nTotal gross sum:", totalGross)
  console.log("Produced sum (countAsProduced):", producedSum)
}

run()
