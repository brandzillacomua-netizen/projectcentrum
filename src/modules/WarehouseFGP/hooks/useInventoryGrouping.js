import { useMemo } from 'react'
import { isHardware, normalizeKey } from '../warehouseFgpInventory.js'

export function useInventoryGrouping({
  inventory,
  activeTab,
  nomenclatures,
  searchQuery = '',
  workCardHistory,
  totalShop2BufferParts
}) {
  const rawTabItems = useMemo(() => {
    if (activeTab === 'shop2_buffer') return []
    return (inventory || []).filter(item => {
      const type = item.type || ''
      const nameLower = (item.name || '').toLowerCase()

      if (activeTab === 'hardware') {
        return isHardware(item)
      }
      if (activeTab === 'finished') {
        // Exclude empty non-sgp operational/buffer ghost rows
        if (item.warehouse !== 'sgp' && (Number(item.total_qty) || 0) <= 0 && (Number(item.reserved_qty) || 0) <= 0) {
          return false
        }
        return !isHardware(item) && (
          type === 'finished' || type === 'part' || type === 'product' ||
          type === 'bz' || type === 'bz_shop2' || type === 'wip_bz' ||
          type === 'semi' || type === 'semi_shop2' ||
          nameLower.includes('бз') || nameLower.includes('буфер')
        )
      }
      if (activeTab === 'scrap') {
        return !isHardware(item) && (type === 'scrap' || type === 'scrap_ready' || type.startsWith('scrap_cat_') || (type !== 'finished' && (nameLower.includes('брак') || nameLower.includes('карантин'))))
      }
      return false
    })
  }, [inventory, activeTab])

  // Group items by unique product identity and aggregate quantities
  const groupedItems = useMemo(() => {
    const map = new Map()

    // Map normalized name to canonical nomenclature id for resilient grouping
    const nomNameToId = new Map()
    ;(nomenclatures || []).forEach(n => {
      const norm = normalizeKey(n.name)
      if (norm && !nomNameToId.has(norm)) nomNameToId.set(norm, String(n.id))
    })

    rawTabItems.forEach(item => {
      const cleanName = (item.name || '').trim()
      const normName = normalizeKey(cleanName)
      const canonicalNomId = nomNameToId.get(normName) || (item.nomenclature_id ? String(item.nomenclature_id) : null)
      const key = canonicalNomId ? `nom_${canonicalNomId}` : `name_${normName}`

      if (!map.has(key)) {
        map.set(key, {
          key,
          nomenclature_id: canonicalNomId || item.nomenclature_id,
          name: cleanName,
          unit: item.unit || 'шт',
          total_qty: 0,
          reserved_qty: 0,
          rawItems: []
        })
      }

      const grp = map.get(key)
      const tQty = Number(item.total_qty) || 0
      const rQty = Number(item.reserved_qty) || 0
      grp.total_qty += tQty
      grp.reserved_qty += rQty
      grp.rawItems.push(item)
    })

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'uk'))
  }, [rawTabItems, nomenclatures])

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return groupedItems
    const q = searchQuery.toLowerCase().trim()
    return groupedItems.filter(item => (item.name || '').toLowerCase().includes(q))
  }, [groupedItems, searchQuery])

  // Compute accurate tab counts
  const tabCounts = useMemo(() => {
    const counts = { finished: 0, hardware: 0, shop2_buffer: 0, scrap: 0, registry: 0 }
    ;(inventory || []).forEach(item => {
      const type = item.type || ''
      const nameLower = (item.name || '').toLowerCase()
      const q = Number(item.total_qty) || 0
      if (isHardware(item)) {
        counts.hardware += q
      } else if (
        type === 'finished' || type === 'part' || type === 'product' ||
        type === 'bz' || type === 'bz_shop2' || type === 'wip_bz' ||
        type === 'semi' || type === 'semi_shop2' ||
        nameLower.includes('бз') || nameLower.includes('буфер')
      ) {
        counts.finished += q
      } else if (type === 'scrap' || type === 'scrap_ready' || type.startsWith('scrap_cat_')) {
        counts.scrap += q
      }
    })
    counts.shop2_buffer = totalShop2BufferParts
    counts.registry = (workCardHistory || []).filter(h => h.status === 'completed').length
    return counts
  }, [inventory, workCardHistory, totalShop2BufferParts])

  return {
    rawTabItems,
    groupedItems,
    filteredItems,
    tabCounts
  }
}
