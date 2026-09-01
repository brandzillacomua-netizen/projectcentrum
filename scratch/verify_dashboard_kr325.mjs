import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
})

async function run() {
  const { data: cards } = await supabase.from('work_cards').select('*')
  const { data: nomList } = await supabase.from('nomenclatures').select('*')

  const nomMap = new Map(nomList.map(n => [n.id, n]))

  console.log('=== CHECKING qSort Math (status === at-shop2-buffer) ===')
  cards.filter(c => c.status === 'at-shop2-buffer').forEach(c => {
    const nom = nomMap.get(c.nomenclature_id)
    const q = Number(c.quantity) || 0
    const used = Number(c.used_in_shop2_qty) || 0
    const netBuf = Math.max(0, q - used)
    if (netBuf > 0) {
      console.log(`[AVAILABLE IN SHOP 2 BUFFER] Nom: ${nom?.name} | Card ${c.id.slice(-8)} | Qty: ${q} | Used: ${used} | NetBuf: ${netBuf}`)
    }
  })
}

run().catch(console.error)
