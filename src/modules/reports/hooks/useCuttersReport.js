import { useMemo } from 'react'
import { matchesOperator } from './useEmployeeReport'

export function useCuttersReport({
  receptionDocs,
  requests,
  workCardHistory,
  inventory,
  nomenclatures,
  filterByDate,
  selectedShiftFilter,
  selectedEmployeeFilter,
  searchQuery
}) {
  const cuttersStats = useMemo(() => {
    const stats = {}

    nomenclatures
      .filter(n => n.type === 'consumable' && n.name.trim().toLowerCase() !== 'фреза' && n.name.toLowerCase().includes('фреза'))
      .forEach(n => {
        const cleanName = n.name.trim()
        if (!stats[cleanName]) {
          stats[cleanName] = {
            id: n.id,
            name: cleanName,
            supplied: 0,
            used: 0,
            actual: 0,
            reserved: 0
          }
        }
      })

    ;(receptionDocs || []).filter(d => d.status === 'completed' && filterByDate(d.created_at)).forEach(doc => {
      (doc.items || []).forEach(item => {
        const nom = nomenclatures.find(n => String(n.id) === String(item.nomenclature_id))
        if (nom && nom.type === 'consumable' && nom.name.toLowerCase().includes('фреза')) {
          const cleanName = nom.name.trim()
          if (stats[cleanName]) {
            stats[cleanName].supplied += Number(item.qty || item.quantity || item.needed || 0)
          }
        }
      })
    })

    workCardHistory
      .filter(h => filterByDate(h.completed_at) && (selectedShiftFilter === 'all' || h.shift_name === selectedShiftFilter) && matchesOperator(h.operator_name, selectedEmployeeFilter))
      .forEach(h => {
        const info = String(h.card_info || '')
        const markerIdx = info.indexOf('[CUTTERS_BREAKDOWN:')
        if (markerIdx !== -1) {
          try {
            const start = markerIdx + '[CUTTERS_BREAKDOWN:'.length
            let depth = 0
            let end = -1
            for (let i = start; i < info.length; i++) {
              if (info[i] === '{') depth++
              else if (info[i] === '}') {
                depth--
                if (depth === 0) {
                  end = i + 1
                  break
                }
              }
            }
            if (end !== -1) {
              const jsonStr = info.substring(start, end)
              const breakdown = JSON.parse(jsonStr)
              Object.entries(breakdown).forEach(([cutterName, qty]) => {
                const cleanCutterName = cutterName.trim()
                if (stats[cleanCutterName]) {
                  stats[cleanCutterName].used += Number(qty) || 0
                }
              })
            }
          } catch (e) {}
        }
      })

    ;(requests || []).filter(r => (r.status === 'issued' || r.status === 'completed') && filterByDate(r.created_at)).forEach(r => {
      const nom = nomenclatures.find(n => String(n.id) === String(r.nomenclature_id))
      if (nom && nom.type === 'consumable' && nom.name.toLowerCase().includes('фреза')) {
        const cleanName = nom.name.trim()
        if (stats[cleanName]) {
          stats[cleanName].used += Number(r.quantity || 0)
        }
      }
    })

    ;(inventory || []).forEach(i => {
      const nom = nomenclatures.find(n => String(n.id) === String(i.nomenclature_id))
      if (nom && nom.type === 'consumable' && nom.name.toLowerCase().includes('фреза')) {
        const cleanName = nom.name.trim()
        if (stats[cleanName]) {
          stats[cleanName].actual += Number(i.total_qty || 0)
          stats[cleanName].reserved += Number(i.reserved_qty || 0)
        }
      }
    })

    return Object.values(stats)
      .filter(s => (s.supplied > 0 || s.used > 0 || s.actual > 0) && (!searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase())))
      .sort((a, b) => b.used - a.used)
  }, [receptionDocs, requests, workCardHistory, inventory, nomenclatures, filterByDate, searchQuery, selectedShiftFilter, selectedEmployeeFilter])

  return { cuttersStats }
}
