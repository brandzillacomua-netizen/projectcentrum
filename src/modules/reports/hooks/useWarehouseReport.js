import { useState, useMemo } from 'react'

export function useWarehouseReport(inventory, nomenclatures) {
  const [whFilter, setWhFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [itemFilter, setItemFilter] = useState('all')
  const [itemSearchText, setItemSearchText] = useState('')
  const [isItemDropdownOpen, setIsItemDropdownOpen] = useState(false)
  const [generatedReport, setGeneratedReport] = useState(null)

  const warehouseOptions = useMemo(() => {
    const whs = new Set(['operational', 'production', 'sgp', 'sz', 'scrap'])
    inventory.forEach(i => {
      if (i.warehouse) whs.add(i.warehouse)
      else if (i.type === 'bz') whs.add('sz')
      else if (i.type === 'finished' || i.type === 'product') whs.add('sgp')
      else if (i.type === 'raw') whs.add('production')
    })
    return Array.from(whs)
  }, [inventory])

  const typeOptions = useMemo(() => {
    const types = new Set()
    nomenclatures.forEach(n => {
      if (n.type) types.add(n.type)
    })
    return Array.from(types).filter(Boolean)
  }, [nomenclatures])

  const itemOptions = useMemo(() => {
    let noms = nomenclatures
    if (typeFilter !== 'all') {
      noms = noms.filter(n => n.type === typeFilter)
    }
    return noms.sort((a,b) => a.name.localeCompare(b.name))
  }, [nomenclatures, typeFilter])

  const filteredItems = useMemo(() => {
    if (!itemSearchText) return itemOptions
    const lower = itemSearchText.toLowerCase()
    return itemOptions.filter(i => 
      i.name.toLowerCase().includes(lower) || 
      String(i.base_code || '').includes(lower) ||
      String(i.id).includes(lower)
    )
  }, [itemOptions, itemSearchText])

  const handleGenerateReport = () => {
    let data = inventory.map(i => ({...i}))

    if (whFilter !== 'all') {
      data = data.filter(i => {
        let w = i.warehouse
        if (!w) {
          if (i.type === 'bz') w = 'sz'
          else if (i.type === 'finished' || i.type === 'product') w = 'sgp'
          else if (i.type === 'raw') w = 'production'
          else if (i.type?.startsWith('scrap')) w = 'scrap'
          else w = 'operational'
        } else {
          if (i.type === 'bz') w = 'sz'
          if (i.type === 'finished' || i.type === 'product') w = 'sgp'
          if (i.type?.startsWith('scrap')) w = 'scrap'
        }
        return w === whFilter
      })
    }

    if (typeFilter !== 'all') {
      data = data.filter(i => {
        const nom = nomenclatures.find(n => String(n.id) === String(i.nomenclature_id))
        const itemType = (nom && nom.type) ? nom.type : i.type
        return itemType === typeFilter
      })
    }

    if (itemFilter !== 'all') {
      data = data.filter(i => String(i.nomenclature_id) === String(itemFilter))
    }

    data = data.filter(i => (Number(i.total_qty) || 0) > 0 || (Number(i.reserved_qty) || 0) > 0)

    const grouped = {}
    let totalQtyAll = 0
    let totalResAll = 0

    data.forEach(item => {
      let w = item.warehouse
      if (!w) {
        if (item.type === 'bz') w = 'sz'
        else if (item.type === 'finished' || item.type === 'product') w = 'sgp'
        else if (item.type?.startsWith('scrap')) w = 'scrap'
        else if (item.type === 'raw') w = 'production'
        else w = 'operational'
      } else {
        if (item.type === 'bz') w = 'sz'
        if (item.type === 'finished' || item.type === 'product') w = 'sgp'
        if (item.type?.startsWith('scrap')) w = 'scrap'
      }

      const nom = nomenclatures.find(n => String(n.id) === String(item.nomenclature_id))
      const t = (nom && nom.type) ? nom.type : (item.type || 'Без групи')

      if (!grouped[w]) grouped[w] = { name: w, total: 0, reserved: 0, groups: {} }
      if (!grouped[w].groups[t]) grouped[w].groups[t] = { name: t, total: 0, reserved: 0, items: [] }

      const qty = Number(item.total_qty) || 0
      const res = Number(item.reserved_qty) || 0

      grouped[w].total += qty
      grouped[w].reserved += res
      grouped[w].groups[t].total += qty
      grouped[w].groups[t].reserved += res
      grouped[w].groups[t].items.push({...item, nom_name: nom?.name || item.name})

      totalQtyAll += qty
      totalResAll += res
    })

    setGeneratedReport({
      timestamp: new Date(),
      totalItems: data.length,
      totalQtyAll,
      totalResAll,
      grouped
    })
  }

  return {
    whFilter,
    setWhFilter,
    typeFilter,
    setTypeFilter,
    itemFilter,
    setItemFilter,
    itemSearchText,
    setItemSearchText,
    isItemDropdownOpen,
    setIsItemDropdownOpen,
    generatedReport,
    warehouseOptions,
    typeOptions,
    filteredItems,
    handleGenerateReport
  }
}
