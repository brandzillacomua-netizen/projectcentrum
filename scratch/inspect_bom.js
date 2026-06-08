import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1], {
    global: {
      headers: {
        'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
      }
    }
  })
  
  const check = async () => {
    const { data: boms, error: errBoms } = await supabase
      .from('bom_items')
      .select('*')
    const { data: noms, error: errNoms } = await supabase
      .from('nomenclatures')
      .select('id, name, type')
    
    console.log("Total BOM items:", boms?.length)
    const nomMap = {}
    noms.forEach(n => { nomMap[n.id] = n })

    // Group by parent_id
    const parentBOMs = {}
    boms.forEach(b => {
      if (!parentBOMs[b.parent_id]) parentBOMs[b.parent_id] = []
      parentBOMs[b.parent_id].push(b)
    })

    console.log("Checking for duplicate child names in parent BOMs:")
    Object.entries(parentBOMs).forEach(([parentId, items]) => {
      const parentNom = nomMap[parentId]
      const nameCounts = {}
      items.forEach(b => {
        const childNom = nomMap[b.child_id]
        if (childNom) {
          if (!nameCounts[childNom.name]) nameCounts[childNom.name] = []
          nameCounts[childNom.name].push(b)
        }
      })

      Object.entries(nameCounts).forEach(([childName, list]) => {
        if (list.length > 1) {
          console.log(`Parent "${parentNom ? parentNom.name : parentId}" has duplicate child name "${childName}":`)
          list.forEach(b => console.log(`  - bom_id: ${b.id}, child_id: ${b.child_id}, qty: ${b.quantity_per_parent}, created: ${b.created_at}`))
        }
      })
    })
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials')
}
