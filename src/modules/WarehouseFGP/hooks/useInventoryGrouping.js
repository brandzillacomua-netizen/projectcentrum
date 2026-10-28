import { useMemo } from 'react'
import { resolveCanonicalNomId } from '../../Nomenclature/utils/nomenclatureHelpers.js'
import { isHardware, isSgpStockRow, isSemiStockRow, isFinishedStockRow, normalizeKey } from '../warehouseFgpInventory.js'

export function useInventoryGrouping({
  inventory,
  activeTab,
  nomenclatures,
  searchQuery = '',
  receiptRows,
  totalShop2BufferParts,
  receiptTotalCount = null,
  totalProductionWipParts = null
}) {
  const rawTabItems = useMemo(() => {
    if (activeTab === 'shop2_buffer' || activeTab === 'semi') return []
    return (inventory || []).filter(item => {
      const type = item.type || ''
      const nameLower = (item.name || '').toLowerCase()

      if (activeTab === 'hardware') {
        return isHardware(item)
      }
      if (activeTab === 'semi') {
        return isSemiStockRow(item)
      }
      if (activeTab === 'finished') {
        // Only real finished goods on the SGP shelf — no BZ/WIP buffers
        return isFinishedStockRow(item)
      }
      if (activeTab === 'scrap') {
        return !isHardware(item) && (type === 'scrap' || type === 'scrap_ready' || type.startsWith('scrap_cat_') || (type !== 'finished' && (nameLower.includes('брак') || nameLower.includes('карантин'))))
      }
      return false
    })
  }, [inventory, activeTab])

  const canonicalNomMap = useMemo(() => {
    const map = new Map()
    ;(nomenclatures || []).forEach(n => {
      if (!n) return
      const cid = String(n.id || n.v2_id || '')
      if (!cid) return
      map.set(cid, cid)
      if (n.v2_id) map.set(String(n.v2_id), cid)
      if (n.legacy_id) map.set(String(n.legacy_id), cid)
      if (Array.isArray(n.legacy_ids)) {
        n.legacy_ids.forEach(lid => {
          if (lid) map.set(String(lid), cid)
        })
      }
    })
    return map
  }, [nomenclatures])

  // Group items by unique product identity and aggregate quantities
  const groupedItems = useMemo(() => {
    const map = new Map()

    rawTabItems.forEach(item => {
      const cleanName = (item.name || '').trim()
      const normName = normalizeKey(cleanName)
      const rawNomId = item.nomenclature_id ? String(item.nomenclature_id) : null
      const canonicalNomId = rawNomId
        ? (canonicalNomMap.get(rawNomId) || resolveCanonicalNomId(rawNomId, nomenclatures))
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
    const counts = { finished: 0, semi: 0, hardware: 0, shop2_buffer: 0, scrap: 0, registry: 0 }
    ;(inventory || []).forEach(item => {
      const type = item.type || ''
      const q = Number(item.total_qty) || 0
      if (isHardware(item)) {
        counts.hardware += q
      } else if (isSemiStockRow(item)) {
        counts.semi += q
      } else if (isFinishedStockRow(item)) {
        counts.finished += q
      } else if (type === 'scrap' || type === 'scrap_ready' || type.startsWith('scrap_cat_')) {
        counts.scrap += q
      }
    })
    counts.semi = totalProductionWipParts !== null ? totalProductionWipParts : counts.semi
    counts.shop2_buffer = totalShop2BufferParts
    counts.registry = receiptTotalCount ?? (receiptRows || []).length
    return counts
  }, [inventory, receiptRows, receiptTotalCount, totalShop2BufferParts, totalProductionWipParts])

  return {
    rawTabItems,
    groupedItems,
    filteredItems,
    tabCounts
  }
}
