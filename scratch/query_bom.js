import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const query = async () => {
    // 1. Get all nomenclatures with KHARAK in name
    const { data: noms, error: nErr } = await supabase
      .from('nomenclatures')
      .select('*')
      .ilike('name', '%KHARAK%')
    
    if (nErr) {
      console.error("Error fetching nomenclatures:", nErr)
      return
    }
    
    console.log(`Found ${noms.length} KHARAK products/parts:`)
    noms.forEach(n => {
      console.log(`- [${n.type}] ID: ${n.id}, Code: ${n.code}, Name: "${n.name}"`)
    })
    
    const productIds = noms.filter(n => n.type === 'product').map(n => n.id)
    if (productIds.length > 0) {
      // 2. Fetch all bom items for these products
      const { data: bom, error: bErr } = await supabase
        .from('bom_items')
        .select('*')
        .in('parent_id', productIds)
        
      if (bErr) {
        console.error("Error fetching BOM:", bErr)
        return
      }
      
      console.log(`\nFound ${bom.length} BOM links:`)
      for (const item of bom) {
        const parent = noms.find(n => n.id === item.parent_id) || { name: `Unknown (${item.parent_id})` }
        // Fetch child name if not already in noms
        let child = noms.find(n => n.id === item.child_id)
        if (!child) {
          const { data: cData } = await supabase.from('nomenclatures').select('name,type').eq('id', item.child_id).single()
          child = cData || { name: `Unknown (${item.child_id})` }
        }
        console.log(`- Product: "${parent.name}" ---> Part: "${child.name}" (Qty: ${item.quantity_per_parent})`)
      }
    }
  }
  
  query()
} else {
  console.error('Could not find Supabase credentials in src/supabase.js')
}
