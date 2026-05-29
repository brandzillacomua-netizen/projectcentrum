import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const mergePairs = [
    {
      // KR-10(210)-H-3-18 (Latin H) -> KR-10(210)-Н-3-18 (Cyrillic Н)
      keep: 'bf1ce16a-4fac-4fff-adf7-43327d662229',
      del: '84e40f79-01e4-46c7-8651-39c9fb77ced4'
    },
    {
      // KH-10(210)-X-4-109 (Latin X) -> KH-10(210)-Х-4-109 (Cyrillic Х)
      keep: 'c93b2a4f-580b-41bc-8c16-97b293f9e6aa',
      del: '43f406fa-faa3-4a17-994f-cfeaddc701d0'
    },
    {
      // KR-210-415-B-3-28 (Latin B) -> KR-Line-210-415-В-3-28 (Cyrillic В)
      keep: '6050ebfa-630d-4887-8ef9-66587644a503',
      del: 'd6555dfc-9795-4db0-a3a2-350a4c11c8ba'
    }
  ]
  
  const run = async () => {
    console.log("=== Starting Merge and Cleanup ===")
    
    // 1. Delete the incorrect 218 -> 210 link (c58ea74d-88f1-4ad4-8dd9-e30728d4bdc7)
    console.log("Deleting incorrect BOM link between KHARAK 218 and KR-Line-210 part...")
    const { error: delLinkErr } = await supabase
      .from('bom_items')
      .delete()
      .eq('id', 'c58ea74d-88f1-4ad4-8dd9-e30728d4bdc7')
    if (delLinkErr) console.error("Error deleting incorrect link:", delLinkErr)
    else console.log("Incorrect link deleted successfully.")
    
    // 2. Perform nomenclature merges
    for (const pair of mergePairs) {
      console.log(`\nMerging ID: ${pair.del} into ID: ${pair.keep}...`)
      
      // Update inventory
      const { error: invErr } = await supabase.from('inventory').update({ nomenclature_id: pair.keep }).eq('nomenclature_id', pair.del)
      if (invErr) console.error("  Error updating inventory:", invErr)
      
      // Update material_requests
      const { error: reqErr } = await supabase.from('material_requests').update({ nomenclature_id: pair.keep }).eq('nomenclature_id', pair.del)
      if (reqErr) console.error("  Error updating material_requests:", reqErr)
      
      // Update work_cards
      const { error: cardErr } = await supabase.from('work_cards').update({ nomenclature_id: pair.keep }).eq('nomenclature_id', pair.del)
      if (cardErr) console.error("  Error updating work_cards:", cardErr)
      
      // Update work_card_history
      const { error: histErr } = await supabase.from('work_card_history').update({ nomenclature_id: pair.keep }).eq('nomenclature_id', pair.del)
      if (histErr) console.error("  Error updating work_card_history:", histErr)
      
      // Update bom_items parent_id & child_id
      const { error: bomParentErr } = await supabase.from('bom_items').update({ parent_id: pair.keep }).eq('parent_id', pair.del)
      if (bomParentErr) console.error("  Error updating bom_items parent_id:", bomParentErr)
      
      const { error: bomChildErr } = await supabase.from('bom_items').update({ child_id: pair.keep }).eq('child_id', pair.del)
      if (bomChildErr) console.error("  Error updating bom_items child_id:", bomChildErr)
      
      // Update tasks plan_snapshots
      const { data: tasks } = await supabase.from('tasks').select('id, plan_snapshot')
      if (tasks) {
        for (const t of tasks) {
          if (t.plan_snapshot && t.plan_snapshot[pair.del]) {
            const snapshot = { ...t.plan_snapshot }
            const item = snapshot[pair.del]
            delete snapshot[pair.del]
            snapshot[pair.keep] = { ...item, id: pair.keep }
            
            const { error: tErr } = await supabase.from('tasks').update({ plan_snapshot: snapshot }).eq('id', t.id)
            if (tErr) console.error(`  Error updating task ${t.id} snapshot:`, tErr)
          }
        }
      }
      
      // Delete duplicate nomenclature row
      const { error: delNomErr } = await supabase.from('nomenclatures').delete().eq('id', pair.del)
      if (delNomErr) console.error("  Error deleting nomenclature:", delNomErr)
      else console.log(`  Successfully deleted duplicate nomenclature ${pair.del}`)
    }
    
    // 3. Deduplicate bom_items
    console.log("\nChecking for duplicate links in bom_items...")
    const { data: bom } = await supabase.from('bom_items').select('*')
    if (bom) {
      const seen = new Set()
      const duplicatesToDelete = []
      
      for (const item of bom) {
        const key = `${item.parent_id}_${item.child_id}`
        if (seen.has(key)) {
          duplicatesToDelete.push(item.id)
        } else {
          seen.add(key)
        }
      }
      
      if (duplicatesToDelete.length > 0) {
        console.log(`Deleting ${duplicatesToDelete.length} duplicate bom_items...`)
        const { error: delBomErr } = await supabase.from('bom_items').delete().in('id', duplicatesToDelete)
        if (delBomErr) console.error("Error deleting duplicates:", delBomErr)
        else console.log("Redundant BOM links deleted successfully.")
      } else {
        console.log("No duplicate BOM links found.")
      }
    }
    
    console.log("\n=== Merge and Cleanup Completed successfully ===")
  }
  
  run()
}
