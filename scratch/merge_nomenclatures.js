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
  
  const merge = async () => {
    // 1. Get all nomenclatures
    const { data: noms, error: errNoms } = await supabase
      .from('nomenclatures')
      .select('*')
    
    if (errNoms) {
      console.error("Error fetching nomenclatures:", errNoms)
      return
    }

    // Find duplicates by exact name
    const nameGroups = {}
    noms.forEach(n => {
      if (!nameGroups[n.name]) nameGroups[n.name] = []
      nameGroups[n.name].push(n)
    })

    console.log("Analyzing duplicates...")
    const duplicates = Object.entries(nameGroups).filter(([name, list]) => list.length > 1)

    for (const [name, list] of duplicates) {
      console.log(`\n=== Merging duplicates for "${name}" ===`)
      // Sort so that the oldest one (often with earliest created_at or most populated fields) is the main one
      list.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
      
      const mainNom = list[0]
      const duplicateNoms = list.slice(1)
      
      console.log(`Main ID: ${mainNom.id} (${mainNom.type}, created: ${mainNom.created_at})`)
      
      for (const dup of duplicateNoms) {
        console.log(`Duplicate to merge: ${dup.id} (${dup.type}, created: ${dup.created_at})`)
        
        // Update inventory pointing to dup.id -> mainNom.id
        const { data: inv, error: errInv } = await supabase
          .from('inventory')
          .select('*')
          .eq('nomenclature_id', dup.id)
        
        if (inv && inv.length > 0) {
          console.log(`Found ${inv.length} inventory records referencing duplicate ID.`)
          for (const item of inv) {
            // Check if mainNom.id already has a matching inventory record (same warehouse, type)
            const { data: existingMain } = await supabase
              .from('inventory')
              .select('*')
              .eq('nomenclature_id', mainNom.id)
              .eq('warehouse', item.warehouse)
              .eq('type', item.type)
              .single()
            
            if (existingMain) {
              // Merge quantities
              const newTotal = (Number(existingMain.total_qty) || 0) + (Number(item.total_qty) || 0)
              const newReserved = (Number(existingMain.reserved_qty) || 0) + (Number(item.reserved_qty) || 0)
              console.log(`Merging inventory qty: ${item.total_qty} into existing main inventory (${existingMain.total_qty} -> ${newTotal})`)
              await supabase
                .from('inventory')
                .update({ total_qty: newTotal, reserved_qty: newReserved })
                .eq('id', existingMain.id)
              
              // Delete the duplicate inventory item
              await supabase
                .from('inventory')
                .delete()
                .eq('id', item.id)
            } else {
              // Just update the nomenclature_id
              console.log(`Updating nomenclature_id on inventory record ${item.id}`)
              await supabase
                .from('inventory')
                .update({ nomenclature_id: mainNom.id })
                .eq('id', item.id)
            }
          }
        }

        // Update bom_items parent_id pointing to dup.id -> mainNom.id
        const { data: bomParents } = await supabase
          .from('bom_items')
          .select('*')
          .eq('parent_id', dup.id)
        
        if (bomParents && bomParents.length > 0) {
          console.log(`Updating ${bomParents.length} bom_items where dup is parent.`)
          for (const b of bomParents) {
            // Check if mainNom already has this child
            const { data: existing } = await supabase
              .from('bom_items')
              .select('*')
              .eq('parent_id', mainNom.id)
              .eq('child_id', b.child_id)
              .single()
            
            if (existing) {
              await supabase.from('bom_items').delete().eq('id', b.id)
            } else {
              await supabase.from('bom_items').update({ parent_id: mainNom.id }).eq('id', b.id)
            }
          }
        }

        // Update bom_items child_id pointing to dup.id -> mainNom.id
        const { data: bomChildren } = await supabase
          .from('bom_items')
          .select('*')
          .eq('child_id', dup.id)
        
        if (bomChildren && bomChildren.length > 0) {
          console.log(`Updating ${bomChildren.length} bom_items where dup is child.`)
          for (const b of bomChildren) {
            // Check if parent already has mainNom as child
            const { data: existing } = await supabase
              .from('bom_items')
              .select('*')
              .eq('parent_id', b.parent_id)
              .eq('child_id', mainNom.id)
              .single()
            
            if (existing) {
              // Delete duplicate relation
              await supabase.from('bom_items').delete().eq('id', b.id)
            } else {
              await supabase.from('bom_items').update({ child_id: mainNom.id }).eq('id', b.id)
            }
          }
        }

        // Update order_items pointing to dup.id -> mainNom.id
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('*')
          .eq('nomenclature_id', dup.id)
        
        if (orderItems && orderItems.length > 0) {
          console.log(`Updating ${orderItems.length} order_items pointing to dup.`)
          for (const oi of orderItems) {
            await supabase.from('order_items').update({ nomenclature_id: mainNom.id }).eq('id', oi.id)
          }
        }

        // Finally, delete the duplicate nomenclature
        console.log(`Deleting duplicate nomenclature ${dup.id}`)
        const { error: delErr } = await supabase
          .from('nomenclatures')
          .delete()
          .eq('id', dup.id)
        if (delErr) console.error("Error deleting duplicate nomenclature:", delErr)
      }
    }

    // 2. Clean up any remaining duplicate name/child_id links inside bom_items globally
    const { data: boms } = await supabase.from('bom_items').select('*')
    const parentBOMs = {}
    boms?.forEach(b => {
      if (!parentBOMs[b.parent_id]) parentBOMs[b.parent_id] = []
      parentBOMs[b.parent_id].push(b)
    })

    console.log("\nCleaning up redundant/duplicate child_id entries in bom_items...")
    for (const [parentId, items] of Object.entries(parentBOMs)) {
      const childCounts = {}
      items.forEach(b => {
        if (!childCounts[b.child_id]) childCounts[b.child_id] = []
        childCounts[b.child_id].push(b)
      })

      for (const [childId, list] of Object.entries(childCounts)) {
        if (list.length > 1) {
          console.log(`Parent ${parentId} has ${list.length} relations to child ${childId}. Keeping one.`)
          // Keep the first, delete the others
          for (let i = 1; i < list.length; i++) {
            await supabase.from('bom_items').delete().eq('id', list[i].id)
          }
        }
      }
    }

    console.log("\nMerge and clean up complete!")
  }
  
  merge()
} else {
  console.error('Could not find Supabase credentials')
}
