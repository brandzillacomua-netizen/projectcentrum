import fs from 'fs'

const filePath = 'a:/centrum/src/modules/SettingsModule.jsx'
const content = fs.readFileSync(filePath, 'utf8')
const lines = content.split(/\r?\n/)

const targetIndex = lines.findIndex(line => line.includes('await Promise.all(dbWrites)'))

if (targetIndex !== -1) {
  console.log("Found Promise.all line at index:", targetIndex)
  
  const inventoryPatch = `
      // 7. Adjust Inventory balances for BZ and Finished/SGP
      const partIds = corrSnapshotParts.map(p => p.nomenclature_id)
      const { data: currentInventory, error: invFetchErr } = await supabase
        .from('inventory')
        .select('*')
        .in('nomenclature_id', partIds)
        
      if (!invFetchErr && currentInventory) {
        corrSnapshotParts.forEach(p => {
          const originalPart = corrSelectedTask.plan_snapshot?.[p.nomenclature_id]
          const oldStock = originalPart ? (Number(originalPart.stock) || 0) : 0
          const diff = p.stock - oldStock
          
          if (diff !== 0) {
            // Adjust BZ stock (type: 'bz')
            const bzItem = currentInventory.find(i => 
              String(i.nomenclature_id) === String(p.nomenclature_id) && 
              i.type === 'bz'
            )
            if (bzItem) {
              dbWrites.push(
                supabase.from('inventory').update({
                  total_qty: Math.max(0, (Number(bzItem.total_qty) || 0) - diff),
                  updated_at: new Date().toISOString()
                }).eq('id', bzItem.id)
              )
            }

            // Adjust Finished stock (type: 'finished')
            const finishedItem = currentInventory.find(i => 
              String(i.nomenclature_id) === String(p.nomenclature_id) && 
              i.type === 'finished'
            )
            if (finishedItem) {
              dbWrites.push(
                supabase.from('inventory').update({
                  total_qty: Math.max(0, (Number(finishedItem.total_qty) || 0) + diff),
                  updated_at: new Date().toISOString()
                }).eq('id', finishedItem.id)
              )
            } else if (diff > 0) {
              dbWrites.push(
                supabase.from('inventory').insert([{
                  nomenclature_id: p.nomenclature_id,
                  name: p.name,
                  unit: 'шт',
                  total_qty: diff,
                  reserved_qty: 0,
                  type: 'finished',
                  updated_at: new Date().toISOString()
                }])
              )
            }
          }
        })
      }
  `
  
  lines.splice(targetIndex, 0, inventoryPatch)
  fs.writeFileSync(filePath, lines.join('\r\n'), 'utf8')
  console.log("Successfully patched handleSaveCorrection with inventory adjustments!")
} else {
  console.error("Could not find Promise.all line.")
}
