import { useMemo } from 'react'

export function useSuppliesReport({
  receptionDocs,
  requests,
  inventory,
  nomenclatures,
  filterByDate,
  searchQuery,
  normalize
}) {
  const parseMaterialName = (details) => {
    if (!details) return ''
    if (details.includes('ВИТРАТНІ МАТЕРІАЛИ')) {
      const match = details.match(/:\s*(.+)\s*—/)
      return match ? match[1].trim() : details
    }
    return details.split(': ')[1]?.split(' — ')[0]?.trim() || details
  }

  const supplyStats = useMemo(() => {
    const stats = {}
    
    ;(receptionDocs || []).filter(d => d.status === 'completed' && !d.source_warehouse && filterByDate(d.created_at)).forEach(doc => {
      (doc.items || []).forEach(item => {
        const nomId = item.nomenclature_id || (nomenclatures.find(n => normalize(n.name) === normalize(item.name || parseMaterialName(item.reqDetails || item.details)))?.id)
        const name = nomenclatures.find(n => String(n.id) === String(nomId))?.name || item.name || parseMaterialName(item.reqDetails || item.details) || 'Невідомий матеріал'
        
        const key = nomId ? String(nomId) : normalize(name)
        if (!stats[key]) stats[key] = { id: nomId, name, supplied: 0, used: 0, actual: 0 }
        stats[key].supplied += Number(item.qty || item.quantity || item.needed || 0)
      })
    })

    ;(requests || []).filter(r => (r.status === 'issued' || r.status === 'completed') && filterByDate(r.created_at)).forEach(r => {
      const nom = nomenclatures.find(n => String(n.id) === String(r.nomenclature_id))
      const name = nom ? nom.name : parseMaterialName(r.details)
      
      const key = r.nomenclature_id ? String(r.nomenclature_id) : normalize(name || 'Невідомий матеріал')
      if (!stats[key]) stats[key] = { id: r.nomenclature_id, name: name || 'Невідомий матеріал', supplied: 0, used: 0, actual: 0 }
      stats[key].used += Number(r.quantity || 0)
    })

    Object.keys(stats).forEach(key => {
      const stat = stats[key]
      const invItems = (inventory || []).filter(i => {
        if (stat.id) return String(i.nomenclature_id) === String(stat.id)
        const nomName = nomenclatures.find(n => String(n.id) === String(i.nomenclature_id))?.name || i.name || ''
        return normalize(nomName) === normalize(stat.name)
      })
      stat.actual = invItems.reduce((acc, curr) => acc + (Number(curr.total_qty) || 0), 0)
    })

    return Object.values(stats)
      .filter(s => (s.supplied > 0 || s.used > 0) && (!searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase())))
      .sort((a, b) => b.supplied - a.supplied)
  }, [receptionDocs, requests, inventory, nomenclatures, filterByDate, searchQuery, normalize])

  return { supplyStats }
}
