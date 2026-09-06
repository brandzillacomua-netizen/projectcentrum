import { useMemo } from 'react'
import { matchesOperator } from './useEmployeeReport'

export const normalizeScrapReasonName = (reason) => {
  const name = reason || 'Причина не вказана'
  if (name.trim().toLowerCase() === 'легенькі сколи -потребує косметичного ремонту') {
    return 'Легкі сколи-потребує косметичного ремонту'
  }
  return name
}

export function useScrapReport({
  workCardHistory,
  scrapClassificationsList,
  scrapReasonsDb,
  classifiedHistoryIds,
  nomenclatures,
  filterByDate,
  selectedShiftFilter,
  selectedEmployeeFilter,
  searchQuery
}) {
  // Scrap Stats
  const scrapStats = useMemo(() => {
    let totalScrapFromHistory = 0
    let totalScrapFromClassifications = 0
    let totalCat123 = 0
    let totalCat4 = 0
    let totalQuarantine = 0
    let totalUnclassified = 0

    const historyList = workCardHistory
      .filter(h => Number(h.scrap_qty) > 0 && filterByDate(h.completed_at, h.created_at) && (selectedShiftFilter === 'all' || h.shift_name === selectedShiftFilter) && matchesOperator(h.operator_name, selectedEmployeeFilter))
      .map(h => {
        const nom = nomenclatures.find(n => n.id === h.nomenclature_id)
        const qtyScrap = Number(h.scrap_qty) || 0
        totalScrapFromHistory += qtyScrap
        
        let cat1 = 0, cat2 = 0, cat3 = 0, cat4 = 0
        if (h.qc_scrap_comment && h.qc_scrap_comment.includes('SCRAP_CAT:')) {
          try {
            const match = h.qc_scrap_comment.match(/\[SCRAP_CAT:([^\]]+)\]/)
            if (match) {
              const cats = JSON.parse(match[1])
              cat1 = Number(cats.cat1 || 0)
              cat2 = Number(cats.cat2 || 0)
              cat3 = Number(cats.cat3 || 0)
              cat4 = Number(cats.cat4 || 0)
            }
          } catch (e) {}
        }
        
        const totalClassified = cat1 + cat2 + cat3 + cat4
        const unclassified = Math.max(0, qtyScrap - totalClassified)

        totalCat123 += (cat1 + cat2)
        totalQuarantine += cat3
        totalCat4 += cat4
        totalUnclassified += unclassified

        return {
          id: h.id,
          dateForSort: h.completed_at || h.created_at,
          nom_name: nom ? nom.name : 'Невідома деталь',
          operator_name: h.operator_name || 'Не вказано',
          stage_name: h.stage_name || 'Невказаний етап',
          cat1, cat2, cat3, cat4, unclassified,
          scrap_qty: qtyScrap
        }
      })

    const classificationsList = (scrapClassificationsList || [])
      .filter(c => filterByDate(c.classified_at, c.created_at) && matchesOperator(c.source_operator_name, selectedEmployeeFilter))
      .map(c => {
        const nom = nomenclatures.find(n => n.id === c.nomenclature_id)
        const qtyScrap = Number(c.quantity) || 0
        totalScrapFromClassifications += qtyScrap

        return {
          id: `class-${c.id}`,
          dateForSort: c.classified_at || c.created_at,
          nom_name: nom ? nom.name : ('Деталь ' + (c.order_number || '')),
          operator_name: c.source_operator_name || 'Оператор',
          stage_name: c.source_stage_name || 'Контроль ВКЯ',
          cat1: 0, cat2: 0, cat3: 0, cat4: qtyScrap, unclassified: 0,
          scrap_qty: qtyScrap
        }
      })

    const displayList = classificationsList.length > 0 ? classificationsList : historyList
    const list = displayList
      .filter(h => !searchQuery || h.nom_name.toLowerCase().includes(searchQuery.toLowerCase()) || (h.operator_name || '').toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => new Date(b.dateForSort || 0) - new Date(a.dateForSort || 0))

    const totalScrap = Math.max(totalScrapFromClassifications, totalScrapFromHistory)

    const byStage = list.reduce((acc, curr) => {
      const stName = curr.stage_name || 'Інше'
      acc[stName] = (acc[stName] || 0) + Number(curr.scrap_qty)
      return acc
    }, {})

    return { 
      list, 
      totalScrap, 
      totalCat123, 
      totalCat4, 
      totalQuarantine, 
      totalUnclassified,
      byStage 
    }
  }, [workCardHistory, scrapClassificationsList, nomenclatures, filterByDate, searchQuery, selectedShiftFilter, selectedEmployeeFilter])

  // Scrap Reasons Analytics
  const scrapReasonsStats = useMemo(() => {
    const reasonsMap = {}
    let totalScrapQty = 0

    scrapReasonsDb.forEach(row => {
      if (selectedEmployeeFilter !== 'all' && !matchesOperator(row.source_operator_name, selectedEmployeeFilter)) return

      const reason = normalizeScrapReasonName(row.reason_name || 'Причина не вказана')
      const qty = Number(row.quantity) || 0
      if (qty <= 0) return

      const nom = nomenclatures.find(n => n.id === row.nomenclature_id)
      const nomName = nom ? nom.name : 'Невідома деталь'
      totalScrapQty += qty

      if (!reasonsMap[reason]) {
        reasonsMap[reason] = { name: reason, quantity: 0, items: {}, operators: {} }
      }
      reasonsMap[reason].quantity += qty
      reasonsMap[reason].items[nomName] = (reasonsMap[reason].items[nomName] || 0) + qty
      reasonsMap[reason].operators[row.source_operator_name || 'Невідомий'] = (reasonsMap[reason].operators[row.source_operator_name || 'Невідомий'] || 0) + qty
    })

    workCardHistory
      .filter(h => !classifiedHistoryIds.has(h.id) && Number(h.scrap_qty) > 0 && filterByDate(h.completed_at) && (selectedShiftFilter === 'all' || h.shift_name === selectedShiftFilter) && matchesOperator(h.operator_name, selectedEmployeeFilter))
      .forEach(h => {
        let reasons = {}
        if (h.qc_scrap_comment && h.qc_scrap_comment.includes('SCRAP_REASONS:')) {
          try {
            const match = h.qc_scrap_comment.match(/\[SCRAP_REASONS:([^\]]+)\]/)
            if (match) reasons = JSON.parse(match[1])
          } catch (e) {}
        } else {
          let reasonName = h.qc_scrap_comment || 'Причина не вказана'
          if (reasonName.includes('Причина:')) reasonName = reasonName.split('Причина:')[1].trim()
          reasonName = reasonName.replace(/\[SCRAP_CAT:[^\]]+\]/g, '').replace(/\[SCRAP_REASONS:[^\]]+\]/g, '').trim()
          if (!reasonName) reasonName = 'Причина не вказана'
          reasons[reasonName] = Number(h.scrap_qty) || 0
        }

        const nom = nomenclatures.find(n => n.id === h.nomenclature_id)
        const nomName = nom ? nom.name : 'Невідома деталь'

        Object.entries(reasons).forEach(([rawReason, qty]) => {
          const reason = normalizeScrapReasonName(rawReason)
          const numQty = Number(qty)
          if (numQty <= 0) return

          totalScrapQty += numQty

          if (!reasonsMap[reason]) {
            reasonsMap[reason] = { name: reason, quantity: 0, items: {}, operators: {} }
          }

          reasonsMap[reason].quantity += numQty
          reasonsMap[reason].items[nomName] = (reasonsMap[reason].items[nomName] || 0) + numQty
          reasonsMap[reason].operators[h.operator_name || 'Невідомий'] = (reasonsMap[reason].operators[h.operator_name || 'Невідомий'] || 0) + numQty
        })
      })

    return Object.values(reasonsMap)
      .map(r => {
        const topItem = Object.entries(r.items).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
        const topOperator = Object.entries(r.operators).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
        return {
          ...r,
          percentage: totalScrapQty > 0 ? ((r.quantity / totalScrapQty) * 100).toFixed(1) : '0.0',
          topItem,
          topOperator
        }
      })
      .sort((a, b) => b.quantity - a.quantity)
  }, [workCardHistory, scrapReasonsDb, classifiedHistoryIds, nomenclatures, filterByDate, selectedShiftFilter, selectedEmployeeFilter])

  return { scrapStats, scrapReasonsStats }
}
