import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const idsToCheck = [
  'd6555dfc-9795-4db0-a3a2-350a4c11c8ba', // KR-210-415-B-3-28 (Latin B)
  '6050ebfa-630d-4887-8ef9-66587644a503', // KR-Line-210-415-В-3-28 (Cyrillic В)
  
  '84e40f79-01e4-46c7-8651-39c9fb77ced4', // KR-10(210)-H-3-18 (Latin H)
  'bf1ce16a-4fac-4fff-adf7-43327d662229', // KR-10(210)-Н-3-18 (Cyrillic Н)
  
  '43f406fa-faa3-4a17-994f-cfeaddc701d0', // KH-10(210)-X-4-109 (Latin X)
  'c93b2a4f-580b-41bc-8c16-97b293f9e6aa'  // KH-10(210)-Х-4-109 (Cyrillic Х)
]

async function checkUsage() {
  console.log('=== Checking Nomenclature Usage ===')
  for (const id of idsToCheck) {
    // Get details
    const { data: nom } = await supabase.from('nomenclatures').select('*').eq('id', id).single()
    if (!nom) {
      console.log(`ID ${id} not found in nomenclatures`)
      continue
    }
    
    // Check inventory
    const { data: inv } = await supabase.from('inventory').select('*').eq('nomenclature_id', id)
    
    // Check work_cards
    const { data: cards } = await supabase.from('work_cards').select('id, status, quantity').eq('nomenclature_id', id)
    
    // Check bom parent links
    const { data: parentBoms } = await supabase.from('bom_items').select('*').eq('child_id', id)
    
    console.log(`\nNomenclature: "${nom.name}" (${id})`)
    console.log(`- Created At: ${nom.created_at}`)
    console.log(`- Type: ${nom.type}, Material: ${nom.material_type}, Units/Sheet: ${nom.units_per_sheet}`)
    console.log(`- Inventory items found: ${inv?.length || 0}`)
    if (inv && inv.length > 0) {
      inv.forEach(i => console.log(`  * Inv Type: ${i.type}, Qty: ${i.total_qty}, Reserved: ${i.reserved_qty}`))
    }
    console.log(`- Work cards count: ${cards?.length || 0}`)
    if (cards && cards.length > 0) {
      const stats = {}
      cards.forEach(c => stats[c.status] = (stats[c.status] || 0) + c.quantity)
      console.log(`  * Quantities by status:`, stats)
    }
    console.log(`- Parent BOM items count: ${parentBoms?.length || 0}`)
    if (parentBoms && parentBoms.length > 0) {
      for (const pb of parentBoms) {
        const { data: parentNom } = await supabase.from('nomenclatures').select('name').eq('id', pb.parent_id).single()
        console.log(`  * Parent: "${parentNom?.name}" (qty: ${pb.quantity_per_parent})`)
      }
    }
  }
}

checkUsage()
