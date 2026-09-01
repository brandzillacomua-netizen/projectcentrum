import fs from 'fs'

const filePath = 'b:/kylutsya/src/modules/Shop2Module.jsx'
let content = fs.readFileSync(filePath, 'utf8')

// 1. Add import
if (!content.includes('getScrapBreakdown')) {
  content = content.replace("import { useScrapReasons } from '../hooks/useScrapReasons'", "import { useScrapReasons } from '../hooks/useScrapReasons'\nimport { getScrapBreakdown } from './Foreman/utils/foremanHelpers'")
}

// 2. Update scrap calculation block
const oldBlock = `                          // Утиль (брак) з Цеху №1
                          const s1AllCards = [...(workCards || []), ...(completedCards || [])].filter(c =>
                            String(c.task_id) === String(s1TaskId) && String(c.nomenclature_id) === String(item.nom?.id)
                          )
                          const s1CardIds = new Set(s1AllCards.map(c => String(c.id)))
                          const s1UtilScrap = (workCardHistory || [])
                            .filter(h => s1CardIds.has(String(h.card_id)))
                            .reduce((sum, h) => sum + (Number(h.scrap_qty) || 0), 0)

                          // Повний план випуску з листів у Цеху №1 (знімки раскрою + додаткові довипуски)
                          const plannedSheets = Number(s1SnapEntry.sheets) || 0
                          const basePlannedFromSheets = plannedSheets > 0 ? (plannedSheets * unitsPerSheet) : Number(s1SnapEntry.plan || plannedNeed)
                          
                          // Якщо створювалися додаткові картки довипуску в Цеху №1:
                          const s1ReissueCards = s1AllCards.filter(c => c.is_rework || c.card_info?.includes('[REDO]') || c.card_info?.includes('Довипуск'))
                          const reissueQty = s1ReissueCards.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

                          const s1TotalPlannedFromSheets = basePlannedFromSheets + reissueQty

                          // Прогнозований вихід придатних деталей з Цеху №1 з урахуванням утилю та довипусків
                          const s1NetProjectedGood = Math.max(actualArrived, s1TotalPlannedFromSheets + s1Stock - s1UtilScrap)`

const newBlock = `                          // Картки та історія розкрою Цеху №1 для цієї деталі
                          const s1AllCards = (workCards || []).filter(c =>
                            (String(c.task_id) === String(s1TaskId) || c.order_id === task.order_id || c.card_info?.includes(order?.order_num)) &&
                            String(c.nomenclature_id) === String(item.nom?.id) &&
                            c.operation !== 'Склад БЗ'
                          )
                          const s1CardIds = new Set(s1AllCards.map(c => String(c.id)))

                          const s1GroupHistory = (workCardHistory || []).filter(h =>
                            (h.card_id && s1CardIds.has(String(h.card_id))) ||
                            (String(h.nomenclature_id) === String(item.nom?.id) && (String(h.task_id) === String(s1TaskId) || h.card_info?.includes(order?.order_num)))
                          )

                          const s1Breakdown = getScrapBreakdown(s1AllCards, s1GroupHistory, workCards)
                          const s1UtilScrap = s1Breakdown?.util || 0

                          // Повний план випуску з листів у Цеху №1 (знімки раскрою + додаткові довипуски)
                          const plannedSheets = Number(s1SnapEntry.sheets) || 0
                          const basePlannedFromSheets = plannedSheets > 0 ? (plannedSheets * unitsPerSheet) : Number(s1SnapEntry.plan || plannedNeed)
                          
                          // Якщо створювалися додаткові картки довипуску в Цеху №1:
                          const s1ReissueCards = s1AllCards.filter(c => c.is_rework || c.card_info?.includes('[REDO]') || c.card_info?.includes('Довипуск'))
                          const reissueQty = s1ReissueCards.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

                          const s1TotalPlannedFromSheets = basePlannedFromSheets + reissueQty

                          // Прогнозований вихід придатних деталей з Цеху №1 з урахуванням утилю та довипусків
                          const s1NetProjectedGood = Math.max(actualArrived, s1TotalPlannedFromSheets + s1Stock - s1UtilScrap)`

content = content.replace(/\r\n/g, '\n')
const oldNorm = oldBlock.replace(/\r\n/g, '\n')
const newNorm = newBlock.replace(/\r\n/g, '\n')

if (content.includes(oldNorm)) {
  content = content.replace(oldNorm, newNorm)
  fs.writeFileSync(filePath, content, 'utf8')
  console.log('Successfully updated Shop2Module to use getScrapBreakdown for S1 util scrap!')
} else {
  console.error('Target block not matched in Shop2Module.jsx!')
}
