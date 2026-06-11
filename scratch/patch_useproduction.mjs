import { readFileSync, writeFileSync } from 'fs'

const filePath = 'a:/centrum/src/contexts/useProduction.js'
let src = readFileSync(filePath, 'utf8')
const hasCRLF = src.includes('\r\n')
if (hasCRLF) src = src.replace(/\r\n/g, '\n')

// ── PATCH 1: Update createNaryad signature to accept customCutters ───────────
const signatureOld = `  const createNaryad = async (orderId, machineName, customQuantities = null, customDeadline = null, customRowMachines = null, customMaterialSplits = null) => {`
const signatureNew = `  const createNaryad = async (orderId, machineName, customQuantities = null, customDeadline = null, customRowMachines = null, customMaterialSplits = null, customCutters = null) => {`

if (!src.includes(signatureOld)) { console.error('Signature anchor not found'); process.exit(1) }
src = src.replace(signatureOld, signatureNew)
console.log('✓ Signature updated')

// ── PATCH 2: Bind custom selected cutter inventory item IDs in material requests ─
const insertAnchor = `      // Add machine-specific cutters`

const insertReplacement = `      // Update specific cutters using customCutters selected by foreman
      if (customCutters && Object.keys(customCutters).length > 0) {
        Object.entries(customCutters).forEach(([cutterName, inventoryItemId]) => {
          if (!inventoryItemId) return
          const selectedInv = inventory.find(i => String(i.id) === String(inventoryItemId))
          if (!selectedInv) return

          // Find if we already generated a material request for this nomenclature in the upcoming list
          // and bind the custom selected inventory item ID
          const existingReq = requestsToInsert.find(r => String(r.nomenclature_id) === String(selectedInv.nomenclature_id))
          if (existingReq) {
            existingReq.inventory_id = selectedInv.id
            existingReq.details = \`СКЛАД ОПЕРАТИВНИЙ (ОБРАНО ВРУЧНУ): \${selectedInv.name} — \${existingReq.quantity} шт.\`
          } else {
            // If it's not a machine-specific cutter and not pre-generated, search consumablesSnapshot and add it
            const matchedCons = nomenclatures.find(n => String(n.id) === String(selectedInv.nomenclature_id))
            if (matchedCons) {
              const matchedSnapshotVal = (customQuantities ? 1 : totalActualSheets) * (Number(matchedCons.consumption_per_sheet) || 1)
              const neededQty = Math.ceil(matchedSnapshotVal)
              requestsToInsert.push({
                order_id: orderId,
                task_id: tData.id,
                quantity: neededQty,
                status: 'pending',
                inventory_id: selectedInv.id,
                nomenclature_id: selectedInv.nomenclature_id,
                details: \`СКЛАД ОПЕРАТИВНИЙ (ОБРАНО ВРУЧНУ): \${selectedInv.name} — \${neededQty} шт.\`
              })
            }
          }
        })
      }

      // Add machine-specific cutters`

if (!src.includes(insertAnchor)) { console.error('Insert anchor not found'); process.exit(1) }
src = src.replace(insertAnchor, insertReplacement)
console.log('✓ createNaryad logic updated to respect customCutters selections')

if (hasCRLF) src = src.replace(/\n/g, '\r\n')
writeFileSync(filePath, src, 'utf8')
console.log('✓ useProduction.js written successfully')
