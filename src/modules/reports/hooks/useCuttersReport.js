import { useMemo } from 'react'
import { matchesOperator } from './useEmployeeReport'

export const isCutterNomenclature = (n) => {
  if (!n) return false
  const nameLower = String(n.name || '').trim().toLowerCase()
  if (!nameLower) return false
  const catLower = String(n.category || '').trim().toLowerCase()
  const ruleLower = String(n.rule_type || '').trim().toLowerCase()
  const typeLower = String(n.type || '').trim().toLowerCase()
  const groupLower = String(n.group_id || '').trim().toLowerCase()

  if (catLower.includes('cutter') || catLower.includes('фрез')) return true
  if (ruleLower.includes('cutter') || ruleLower.includes('фрез')) return true
  if (typeLower.includes('cutter') || typeLower.includes('фрез')) return true
  if (groupLower.includes('cutter') || groupLower.includes('фрез')) return true

  return (
    nameLower.includes('фреза') ||
    nameLower.includes('фрези') ||
    nameLower.includes('фрез') ||
    nameLower.startsWith('cut-') ||
    nameLower.includes('тип ф')
  )
}

export function useCuttersReport({
  receptionDocs,
  requests,
  workCardHistory,
  cutterUsageEvents = [],
  inventory,
  nomenclatures,
  filterByDate,
  selectedShiftFilter,
  selectedEmployeeFilter,
  searchQuery
}) {
  const { cuttersStats, cutterEventsList, totalCuttersUsed, totalCuttersSupplied } = useMemo(() => {
    const stats = {}
    const eventsList = []
    const processedEventKeys = new Set()

    // 1. Initialize known cutter nomenclatures
    ;(nomenclatures || [])
      .filter(isCutterNomenclature)
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

    // Helper to get or create stat entry
    const getStatEntry = (nom) => {
      if (!nom) return null
      const cleanName = String(nom.name || '').trim()
      if (!cleanName) return null
      if (!stats[cleanName]) {
        stats[cleanName] = {
          id: nom.id,
          name: cleanName,
          supplied: 0,
          used: 0,
          actual: 0,
          reserved: 0
        }
      }
      return stats[cleanName]
    }

    // 2. Process Warehouse Reception Docs (Supplied)
    ;(receptionDocs || [])
      .filter(d => d.status === 'completed' && filterByDate(d.created_at))
      .forEach(doc => {
        (doc.items || []).forEach(item => {
          const qty = Number(item.qty || item.quantity || item.needed || 0)
          if (qty <= 0) return
          const nom = (nomenclatures || []).find(n => String(n.id) === String(item.nomenclature_id))
          if (nom && isCutterNomenclature(nom)) {
            const entry = getStatEntry(nom)
            if (entry) {
              entry.supplied += qty
            }
          }
        })
      })

    // 3. Process Direct Cutter Usage Events (cutter_usage_events table)
    ;(cutterUsageEvents || [])
      .filter(e => Number(e.quantity) > 0 && filterByDate(e.created_at) && matchesOperator(e.actor_name, selectedEmployeeFilter))
      .forEach(e => {
        const nom = (nomenclatures || []).find(n => String(n.id) === String(e.nomenclature_id))
        const cleanName = nom ? nom.name.trim() : (e.cutter_name || 'Невідома фреза')
        const qty = Number(e.quantity) || 0
        if (qty <= 0) return

        if (nom) {
          const entry = getStatEntry(nom)
          if (entry) entry.used += qty
        } else if (stats[cleanName]) {
          stats[cleanName].used += qty
        } else {
          stats[cleanName] = { id: e.nomenclature_id, name: cleanName, supplied: 0, used: qty, actual: 0, reserved: 0 }
        }

        const eventKey = `usage-${e.id}`
        if (!processedEventKeys.has(eventKey)) {
          processedEventKeys.add(eventKey)
          eventsList.push({
            id: eventKey,
            date: e.created_at,
            cutterName: cleanName,
            quantity: qty,
            operator: e.actor_name || 'Оператор',
            machine: e.pocket_owner || 'Виробнича лінія',
            cardId: e.source_card_id || '—',
            source: 'Реєстрація на верстаті'
          })
        }
      })

    // 4. Process Material/Cutter Requests (status issued or completed)
    ;(requests || [])
      .filter(r => Number(r.quantity) > 0 && (r.status === 'issued' || r.status === 'completed') && filterByDate(r.created_at || r.updated_at))
      .forEach(r => {
        const nom = (nomenclatures || []).find(n => String(n.id) === String(r.nomenclature_id))
        if (nom && isCutterNomenclature(nom)) {
          const cleanName = nom.name.trim()
          const qty = Number(r.quantity || 0)
          if (qty <= 0) return
          const entry = getStatEntry(nom)

          const eventKey = `req-${r.id}`
          if (!processedEventKeys.has(eventKey)) {
            processedEventKeys.add(eventKey)
            if (entry && cutterUsageEvents.length === 0) {
              entry.used += qty
            }
            eventsList.push({
              id: eventKey,
              date: r.created_at || r.updated_at,
              cutterName: cleanName,
              quantity: qty,
              operator: r.requested_by || 'Склад',
              machine: 'Видача зі складу',
              cardId: r.card_id || '—',
              source: 'Видано зі складу'
            })
          }
        }
      })

    // 5. Process Work Card History (Cutters breakdown in card info)
    ;(workCardHistory || [])
      .filter(h => filterByDate(h.completed_at || h.created_at) && (selectedShiftFilter === 'all' || h.shift_name === selectedShiftFilter) && matchesOperator(h.operator_name, selectedEmployeeFilter))
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
                const numQty = Number(qty) || 0
                if (numQty <= 0) return

                if (stats[cleanCutterName] && cutterUsageEvents.length === 0 && (requests || []).length === 0) {
                  stats[cleanCutterName].used += numQty
                }
                const eventKey = `hist-${h.id}-${cleanCutterName}`
                if (!processedEventKeys.has(eventKey)) {
                  processedEventKeys.add(eventKey)
                  eventsList.push({
                    id: eventKey,
                    date: h.completed_at || h.created_at,
                    cutterName: cleanCutterName,
                    quantity: numQty,
                    operator: h.operator_name || 'Оператор',
                    machine: h.stage_name || 'Невказаний етап',
                    cardId: h.card_id || '—',
                    source: 'Звіт з історії картки'
                  })
                }
              })
            }
          } catch (e) {}
        }
      })

    // 6. Process Warehouse Inventory Stock
    ;(inventory || []).forEach(i => {
      const nom = (nomenclatures || []).find(n => String(n.id) === String(i.nomenclature_id))
      if (nom && isCutterNomenclature(nom)) {
        const entry = getStatEntry(nom)
        if (entry) {
          entry.actual += Number(i.total_qty || 0)
          entry.reserved += Number(i.reserved_qty || 0)
        }
      }
    })

    const filteredStatsList = Object.values(stats)
      .filter(s => 
        (s.supplied > 0 || s.used > 0 || s.actual > 0) && 
        (!searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      .sort((a, b) => b.used - a.used)

    const totalUsedSum = filteredStatsList.reduce((acc, s) => acc + (s.used || 0), 0)
    const totalSuppliedSum = filteredStatsList.reduce((acc, s) => acc + (s.supplied || 0), 0)

    const sortedEvents = eventsList
      .filter(e => e.quantity > 0 && (!searchQuery || e.cutterName.toLowerCase().includes(searchQuery.toLowerCase()) || (e.operator || '').toLowerCase().includes(searchQuery.toLowerCase())))
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))

    return {
      cuttersStats: filteredStatsList,
      cutterEventsList: sortedEvents,
      totalCuttersUsed: totalUsedSum,
      totalCuttersSupplied: totalSuppliedSum
    }
  }, [receptionDocs, requests, workCardHistory, cutterUsageEvents, inventory, nomenclatures, filterByDate, searchQuery, selectedShiftFilter, selectedEmployeeFilter])

  return { cuttersStats, cutterEventsList, totalCuttersUsed, totalCuttersSupplied }
}
