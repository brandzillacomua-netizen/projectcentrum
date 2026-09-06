import { useMemo } from 'react'

export const matchesOperator = (opName, filterVal) => {
  if (!filterVal || filterVal === 'all') return true
  if (!opName) return false

  const clean = (str) => str.toLowerCase().replace(/\s+/g, ' ').trim()
  const oClean = clean(opName)
  const fClean = clean(filterVal)

  if (oClean === fClean) return true

  const oParts = oClean.split(' ')
  const fParts = fClean.split(' ')

  const match1 = fParts.every(p => oParts.includes(p) || oParts.some(op => op.includes(p) || p.includes(op)))
  const match2 = oParts.every(p => fParts.includes(p) || fParts.some(fp => fp.includes(p) || p.includes(fp)))

  return match1 || match2
}

export function useEmployeeReport({
  systemUsers,
  workCardHistory,
  filterByDate,
  selectedShiftFilter,
  selectedEmployeeFilter,
  searchQuery
}) {
  const employeeStats = useMemo(() => {
    const stats = {}
    
    systemUsers.forEach(u => {
      stats[u.login] = { 
        name: `${u.first_name} ${u.last_name}`, 
        position: u.position, 
        department: u.department,
        produced: 0, 
        scrap: 0, 
        cat1: 0,
        cat2: 0,
        cat3: 0,
        cat4: 0,
        operations: 0 
      }
    })

    workCardHistory
      .filter(h => filterByDate(h.completed_at, h.created_at) && (selectedShiftFilter === 'all' || h.shift_name === selectedShiftFilter))
      .forEach(h => {
        const user = systemUsers.find(u => u.login === h.operator_name || `${u.first_name} ${u.last_name}` === h.operator_name)
        const key = user ? user.login : h.operator_name
        
        if (!stats[key]) {
          stats[key] = { name: key, position: 'Невідомо', department: '-', produced: 0, scrap: 0, cat1: 0, cat2: 0, cat3: 0, cat4: 0, operations: 0 }
        }
        
        stats[key].produced += Number(h.qty_completed) || 0
        stats[key].scrap += Number(h.scrap_qty) || 0
        stats[key].operations += 1

        if (h.qc_scrap_comment && h.qc_scrap_comment.includes('SCRAP_CAT:')) {
          try {
            const match = h.qc_scrap_comment.match(/\[SCRAP_CAT:([^\]]+)\]/)
            if (match) {
              const cats = JSON.parse(match[1])
              stats[key].cat1 += Number(cats.cat1 || 0)
              stats[key].cat2 += Number(cats.cat2 || 0)
              stats[key].cat3 += Number(cats.cat3 || 0)
              stats[key].cat4 += Number(cats.cat4 || 0)
            }
          } catch (e) {}
        }
      })

    return Object.values(stats)
      .filter(s => (s.operations > 0 || (searchQuery && s.name.toLowerCase().includes(searchQuery.toLowerCase()))) && matchesOperator(s.name, selectedEmployeeFilter))
      .sort((a, b) => b.produced - a.produced)
  }, [systemUsers, workCardHistory, filterByDate, searchQuery, selectedShiftFilter, selectedEmployeeFilter])

  return { employeeStats }
}
