import fs from 'fs'

const filePath = 'b:/kylutsya/src/modules/Shop2Module.jsx'
let content = fs.readFileSync(filePath, 'utf8')

const oldBlock = `                          // Загальна кількість розкроєних/запланованих деталей з листів у Цеху №1
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

const newBlock = `                          // Повний план випуску з листів у Цеху №1 (знімки раскрою + додаткові довипуски)
                          const plannedSheets = Number(s1SnapEntry.sheets) || 0
                          const basePlannedFromSheets = plannedSheets > 0 ? (plannedSheets * unitsPerSheet) : Number(s1SnapEntry.plan || plannedNeed)
                          
                          // Якщо створювалися додаткові картки довипуску в Цеху №1:
                          const s1ReissueCards = s1AllCards.filter(c => c.is_rework || c.card_info?.includes('[REDO]') || c.card_info?.includes('Довипуск'))
                          const reissueQty = s1ReissueCards.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

                          const s1TotalPlannedFromSheets = basePlannedFromSheets + reissueQty

                          // Прогнозований вихід придатних деталей з Цеху №1 з урахуванням утилю та довипусків
                          const s1NetProjectedGood = Math.max(actualArrived, s1TotalPlannedFromSheets + s1Stock - s1UtilScrap)

                          const displayBz = Math.max(0, s1NetProjectedGood - plannedNeed)
                          const displayTotal = s1TotalPlannedFromSheets + s1Stock`

content = content.replace(/\r\n/g, '\n')
const oldNorm = oldBlock.replace(/\r\n/g, '\n')
const newNorm = newBlock.replace(/\r\n/g, '\n')

if (content.includes(oldNorm)) {
  content = content.replace(oldNorm, newNorm)
  fs.writeFileSync(filePath, content, 'utf8')
  console.log('Successfully updated Shop2Module BZ calculation to use full nesting plan!')
} else {
  console.error('Target block not matched in Shop2Module.jsx!')
}
