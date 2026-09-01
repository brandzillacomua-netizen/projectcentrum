import fs from 'fs'

const filePath = 'b:/kylutsya/src/modules/Shop2Module.jsx'
let content = fs.readFileSync(filePath, 'utf8')

// Locate lines 960-985 in Shop2Module.jsx and replace displayBz & displayTotal computation
const oldBlock = `                          const displayNeed = plannedNeed
                           const plannedBz = arrival ? (Number(arrival.bz) || 0) : 0
                           const snapEntry = snap[String(item.nom?.id)] || {}
                           const unitsPerSheet = Number(snapEntry.units_per_sheet) || 1
                           
                           let displayTotal = plannedNeed + plannedBz
                           let displayBz = plannedBz
                           
                           if (actualArrived < plannedNeed) {
                             const shortage = plannedNeed - actualArrived
                             const sheetsNeeded = Math.ceil(shortage / unitsPerSheet)
                             const reissueQty = sheetsNeeded * unitsPerSheet
                             displayTotal = actualArrived + reissueQty
                             displayBz = displayTotal - plannedNeed
                          } else {
                            displayTotal = actualArrived
                            displayBz = actualArrived - plannedNeed
                          }`

const newBlock = `                          const s1SnapEntry = s1Task?.plan_snapshot?.[String(item.nom?.id)] || snap[String(item.nom?.id)] || {}
                          const unitsPerSheet = Number(s1SnapEntry.units_per_sheet) || Number(item.nom?.units_per_sheet) || 1
                          const s1Stock = Number(s1SnapEntry.stock) || 0

                          // Утиль (брак) з Цеху №1
                          const s1AllCards = [...(workCards || []), ...(completedCards || [])].filter(c =>
                            String(c.task_id) === String(s1TaskId) && String(c.nomenclature_id) === String(item.nom?.id)
                          )
                          const s1CardIds = new Set(s1AllCards.map(c => String(c.id)))
                          const s1UtilScrap = (workCardHistory || [])
                            .filter(h => s1CardIds.has(String(h.card_id)))
                            .reduce((sum, h) => sum + (Number(h.scrap_qty) || 0), 0)

                          // Загальна кількість розкроєних/запланованих деталей з листів у Цеху №1
                          let s1TotalPlannedFromSheets = 0
                          if (s1AllCards.length > 0) {
                            s1AllCards.forEach(c => {
                              if (c.operation === 'Розкрій') {
                                const q = Number(c.quantity) || 0
                                const scr = (workCardHistory || []).filter(h => String(h.card_id) === String(c.id)).reduce((s, h) => s + (Number(h.scrap_qty) || 0), 0)
                                s1TotalPlannedFromSheets += (q + scr)
                              }
                            })
                          }

                          if (s1TotalPlannedFromSheets === 0) {
                            const plannedBz = arrival ? (Number(arrival.bz) || 0) : 0
                            const plannedSheets = Number(s1SnapEntry.sheets) || Math.ceil((plannedNeed + plannedBz) / Math.max(1, unitsPerSheet))
                            s1TotalPlannedFromSheets = plannedSheets * unitsPerSheet
                          }

                          // Прогнозований вихід придатних деталей з Цеху №1 з урахуванням утилю та довипусків
                          const s1NetProjectedGood = Math.max(actualArrived, s1TotalPlannedFromSheets + s1Stock - s1UtilScrap)

                          const displayBz = Math.max(0, s1NetProjectedGood - plannedNeed)
                          const displayTotal = s1NetProjectedGood`

content = content.replace(/\r\n/g, '\n')
const oldNorm = oldBlock.replace(/\r\n/g, '\n')
const newNorm = newBlock.replace(/\r\n/g, '\n')

if (content.includes(oldNorm)) {
  content = content.replace(oldNorm, newNorm)
  fs.writeFileSync(filePath, content, 'utf8')
  console.log('Successfully updated accurate BZ calculation in Shop2Module.jsx!')
} else {
  console.error('Target block not matched in Shop2Module.jsx!')
}
