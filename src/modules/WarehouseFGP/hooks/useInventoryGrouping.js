import { useMemo } from 'react'
import { resolveCanonicalNomId } from '../../Nomenclature/utils/nomenclatureHelpers.js'
import { isHardware, isSgpStockRow, normalizeKey } from '../warehouseFgpInventory.js'

export function useInventoryGrouping({
  inventory,
  activeTab,
  nomenclatures,
  searchQuery = '',
  receiptRows,
  totalShop2BufferParts,
  receiptTotalCount = null
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
        return isSgpStockRow(item)
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

    rawTabItems.forEach(item => {
      const cleanName = (item.name || '').trim()
      const normName = normalizeKey(cleanName)
      const canonicalNomId = item.nomenclature_id
        ? resolveCanonicalNomId(item.nomenclature_id, nomenclatures)
        : null
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
      const q = Number(item.total_qty) || 0
      if (isHardware(item)) {
        counts.hardware += q
      } else if (isSgpStockRow(item)) {
        counts.finished += q
      } else if (type === 'scrap' || type === 'scrap_ready' || type.startsWith('scrap_cat_')) {
        counts.scrap += q
      }
    })
    counts.shop2_buffer = totalShop2BufferParts
    counts.registry = receiptTotalCount ?? (receiptRows || []).length
    return counts
  }, [inventory, receiptRows, receiptTotalCount, totalShop2BufferParts])

  return {
    rawTabItems,
    groupedItems,
    filteredItems,
    tabCounts
  }
}
