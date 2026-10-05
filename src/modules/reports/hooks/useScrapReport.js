import { buildScrapStats } from './scrapReportTotals.js'
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
  const scrapStats = useMemo(() => buildScrapStats({
    workCardHistory, scrapClassificationsList, nomenclatures, filterByDate,
    selectedShiftFilter, selectedEmployeeFilter, searchQuery
  }), [workCardHistory, scrapClassificationsList, nomenclatures, filterByDate, selectedShiftFilter, selectedEmployeeFilter, searchQuery])

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
