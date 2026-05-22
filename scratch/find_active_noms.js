import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
  const ids = [
    // Latin
    'd6555dfc-9795-4db0-a3a2-350a4c11c8ba', // KR-210-415-B-3-28
    '84e40f79-01e4-46c7-8651-39c9fb77ced4', // KR-10(210)-H-3-18
    '43f406fa-faa3-4a17-994f-cfeaddc701d0', // KH-10(210)-X-4-109
    // Cyrillic
    '6050ebfa-630d-4887-8ef9-66587644a503', // KR-Line-210-415-В-3-28
    'bf1ce16a-4fac-4fff-adf7-43327d662229', // KR-10(210)-Н-3-18
    'c93b2a4f-580b-41bc-8c16-97b293f9e6aa'  // KH-10(210)-Х-4-109
  ]

  for (const id of ids) {
    const { data: nom } = await supabase.from('nomenclatures').select('*').eq('id', id).single()
    
    // Sum of inventory quantities
    const { data: inv } = await supabase.from('inventory').select('*').eq('nomenclature_id', id)
    const totalInv = inv ? inv.reduce((sum, item) => sum + (Number(item.total_qty) || 0), 0) : 0
    
    // Sum of work cards
    const { data: cards } = await supabase.from('work_cards').select('*').eq('nomenclature_id', id)
    const totalCards = cards ? cards.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) : 0
    
    console.log(`\n"${nom.name}" (${id}) - Created At: ${nom.created_at}`)
    console.log(`- Total Inventory Qty (sum): ${totalInv}`)
    console.log(`- Total Work Cards Qty (sum): ${totalCards}`)
    console.log(`- Total Work Cards count: ${cards?.length || 0}`)
    if (cards && cards.length > 0) {
      console.log('  * Cards:', cards.map(c => `[id: ${c.id.slice(0, 6)}, qty: ${c.quantity}, status: ${c.status}, info: ${c.card_info}]`))
    }
  }
}

run()
