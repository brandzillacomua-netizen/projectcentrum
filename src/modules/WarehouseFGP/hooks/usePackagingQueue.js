import { useMemo, useState } from 'react'
import { supabase } from '../../../supabase'
import {
  getGroupedSgpAvailableStock,
  getGroupedSgpIssueAllocations,
  getGroupedSgpIssueRow,
  getGroupedSgpRow,
  isSgpStockRow,
  isHardware,
  normalizeKey
} from '../warehouseFgpInventory.js'
import { resolveCanonicalNomId } from '../../Nomenclature/utils/nomenclatureHelpers.js'

export function usePackagingQueue({
  liveRequests,
  requests,
  orders,
  tasks,
  nomenclatures,
  inventory,
  groupedInventory,
  requestQueueTab,
  isDark,
  currentUser,
  fetchData,
  fetchQueueFromDb,
  refreshTable
}) {
  const [isIssuingReq, setIsIssuingReq] = useState(false)
  const [collapsedOrders, setCollapsedOrders] = useState(() => new Set())

  // Merge live requests with context requests
  const effectiveRequests = useMemo(() => {
    if (liveRequests && Array.isArray(liveRequests) && liveRequests.length > 0) {
      const map = new Map()
      liveRequests.forEach(r => { if (r && r.id) map.set(String(r.id), r) })
      ;(requests || []).forEach(r => { if (r && r.id && !map.has(String(r.id))) map.set(String(r.id), r) })
      return Array.from(map.values())
    }
    return requests || []
  }, [liveRequests, requests])

  const isPackagingRequest = (r) => {
    if (!r || !r.details) return false
    const d = r.details.toUpperCase()
    return (
      d.includes('ЗАПИТ НА КОМПЛЕКТУВАННЯ') ||
      d.includes('КОМПЛЕКТУВАННЯ') ||
      d.includes('ПАКУВАННЯ') ||
      d.includes('PACKAGING_SOURCE')
    )
  }

  const allPackagingRequests = useMemo(() => {
    return effectiveRequests.filter(isPackagingRequest)
  }, [effectiveRequests])

  const activePackagingRequests = useMemo(() => {
    return allPackagingRequests.filter(r => {
      if (r.status === 'completed' || r.status === 'issued' || r.status === 'cancelled') return false
      return true
    })
  }, [allPackagingRequests])

  const completedPackagingRequests = useMemo(() => {
    return allPackagingRequests.filter(r => r.status === 'completed' || r.status === 'issued')
  }, [allPackagingRequests])

  const pendingPackagingRequests = useMemo(() => {
    if (requestQueueTab === 'history') return completedPackagingRequests
    if (requestQueueTab === 'all') return allPackagingRequests
    return activePackagingRequests
  }, [requestQueueTab, completedPackagingRequests, allPackagingRequests, activePackagingRequests])

  const groupedPackagingRequests = useMemo(() => {
    const groups = {}
    pendingPackagingRequests.forEach(req => {
      const order = (orders || []).find(o => String(o.id) === String(req.order_id))
      const task = (tasks || []).find(t => String(t.id) === String(req.task_id))
      const key = req.task_id ? `task-${req.task_id}` : `order-${req.order_id}`
      if (!groups[key]) {
        groups[key] = {
          key,
          orderId: req.order_id,
          taskId: req.task_id,
          orderNum: order?.order_num || (req.details?.match(/ЗАПИТ НА КОМПЛЕКТУВАННЯ\s*\(([^)]+)\)/i)?.[1] || '???'),
          batchIndex: task?.batch_index || '',
          customer: order?.customer || '',
          items: []
        }
      }
      groups[key].items.push(req)
    })
    return Object.values(groups)
  }, [pendingPackagingRequests, orders, tasks])

  const toggleOrderCollapse = (orderKey) => {
    setCollapsedOrders(prev => {
      const next = new Set(prev)
      if (next.has(orderKey)) next.delete(orderKey)
      else next.add(orderKey)
      return next
    })
  }

  const collapseAll = () => {
    setCollapsedOrders(new Set(groupedPackagingRequests.map(g => g.key)))
  }

  const expandAll = () => {
    setCollapsedOrders(new Set())
  }

  const getItemDisplayName = (req) => {
    if (req.nomenclature_id) {
      const nom = (nomenclatures || []).find(n => String(n.id) === String(req.nomenclature_id))
      if (nom?.name) return nom.name
    }
    const details = req.details || ''
    const matchWithSource = details.match(/\[PACKAGING_SOURCE:[^\]]+\]\s*(?:\[[^\]]+\]\s*)*:\s*([^—\n\r]+)/i)
    if (matchWithSource?.[1]) {
      return matchWithSource[1].trim()
    }
    const colonParts = details.split(':')
    if (colonParts.length > 1) {
      const lastPart = colonParts[colonParts.length - 1]
      return lastPart.split('—')[0].trim()
    }
    return details.split('—')[0].trim() || 'Комплектуюче'
  }

  const getItemCategoryBadge = (req, displayName) => {
    const details = req?.details || ''
    if (
      details.includes('AUTO_SGP_RESERVATION') ||
      details.toUpperCase().includes('БУФЕР') ||
      details.toUpperCase().includes('БЗ')
    ) {
      return isDark
        ? { label: 'БУФЕР (БЗ)', color: '#fbbf24', bg: '#451a03', border: '#b45309' }
        : { label: 'БУФЕР (БЗ)', color: '#b45309', bg: '#fef3c7', border: '#fde68a' }
    }
    const nom = (nomenclatures || []).find(n => String(n.id) === String(req.nomenclature_id))
    const nameLower = (nom?.name || displayName || '').toLowerCase()
    const type = (nom?.type || '').toLowerCase()
    if (nameLower.includes('гвинт') || nameLower.includes('гайка') || nameLower.includes('болт') || nameLower.includes('шайба') || type.includes('hardware')) {
      return isDark
        ? { label: 'МЕТИЗ', color: '#7dd3fc', bg: '#0c4a6e', border: '#0284c7' }
        : { label: 'МЕТИЗ', color: '#0369a1', bg: '#e0f2fe', border: '#bae6fd' }
    }
    if (nameLower.includes('стійка') || type.includes('стійк')) {
      return isDark
        ? { label: 'СТІЙКА', color: '#c4b5fd', bg: '#4c1d95', border: '#7c3aed' }
        : { label: 'СТІЙКА', color: '#6d28d9', bg: '#ede9fe', border: '#ddd6fe' }
    }
    if (nameLower.includes('кріплення') || nameLower.includes('друк') || nameLower.includes('3д')) {
      return isDark
        ? { label: 'КРІПЛЕННЯ', color: '#fde047', bg: '#713f12', border: '#ca8a04' }
        : { label: 'КРІПЛЕННЯ', color: '#b45309', bg: '#fef3c7', border: '#fde68a' }
    }
    if (nameLower.includes('накладка') || nameLower.includes('тримач') || nameLower.includes('упаковка') || nameLower.includes('пакет') || nameLower.includes('гума')) {
      return isDark
        ? { label: 'АКСЕСУАР', color: '#5eead4', bg: '#134e4a', border: '#0d9488' }
        : { label: 'АКСЕСУАР', color: '#0f766e', bg: '#ccfbf1', border: '#99f6e4' }
    }
    return isDark
      ? { label: 'ДЕТАЛЬ СГП', color: '#a5b4fc', bg: '#312e81', border: '#4f46e5' }
      : { label: 'ДЕТАЛЬ СГП', color: '#4338ca', bg: '#e0e7ff', border: '#c7d2fe' }
  }

  // Group ALL relevant inventory rows (SGP + Buffers + Hardware) by canonical nomenclature,
  // ensuring packaging queue stock is independent of which tab was active in the Inventory view.
  const allGroupedInventory = useMemo(() => {
    const map = new Map()
    ;(inventory || []).forEach(item => {
      if (!item) return
      if (!isSgpStockRow(item) && !isHardware(item)) return
      const canonicalNomId = item.nomenclature_id
        ? resolveCanonicalNomId(item.nomenclature_id, nomenclatures)
        : null
      const normName = normalizeKey(item.name)
      const key = canonicalNomId ? `nom_${canonicalNomId}` : `name_${normName}`
      if (!map.has(key)) {
        map.set(key, {
          key,
          nomenclature_id: canonicalNomId || item.nomenclature_id,
          name: item.name,
          unit: item.unit || 'шт',
          total_qty: 0,
          reserved_qty: 0,
          rawItems: []
        })
      }
      const entry = map.get(key)
      entry.total_qty += Number(item.total_qty) || 0
      entry.reserved_qty += Number(item.reserved_qty) || 0
      entry.rawItems.push(item)
    })
    return Array.from(map.values())
  }, [inventory, nomenclatures])

  const getSgpStock = req => {
    if (!req) return 0
    const isIssued = req.status === 'completed' || req.status === 'issued'
    const groupedRow = getGroupedSgpRow(allGroupedInventory, nomenclatures, req)
    if (!groupedRow) return 0
    if (isIssued) {
      return Number(groupedRow.total_qty) || 0
    }
    return Math.max(0, (Number(groupedRow.total_qty) || 0) - (Number(groupedRow.reserved_qty) || 0))
  }

  const issueRequest = async (req) => {
    if (!req) throw new Error('Запит не знайдено')
      const issuerName = `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim() || currentUser?.login || 'Комірник СГП'
      const groupedIssueRow = getGroupedSgpIssueRow(allGroupedInventory, nomenclatures, req)
      const hasLegacyMismatchedId = groupedIssueRow?.nomenclature_id &&
        String(groupedIssueRow.nomenclature_id) !== String(req.nomenclature_id)
      
      let rpcSuccess = false
      let rpcFailureMessage = ''
      if (!hasLegacyMismatchedId) {
        try {
          const { data: rpcRes, error: rpcErr } = await supabase.rpc('issue_packaging_request_from_sgp', {
            p_request_id: req.id,
            p_issuer_name: issuerName
          })
          if (!rpcErr && rpcRes?.success) {
            rpcSuccess = true
          } else {
            rpcFailureMessage = rpcRes?.message || rpcErr?.message || ''
          }
        } catch (e) {
          rpcFailureMessage = e?.message || String(e)
        }
      }

      if (!rpcSuccess) {
        const neededQty = Number(req.quantity) || 0
        const displayName = getItemDisplayName(req)
        let allocationResult = getGroupedSgpIssueAllocations(allGroupedInventory, nomenclatures, req, neededQty)
        if (allocationResult.allocations.length === 0) {
          const fallbackRows = (inventory || []).filter(item =>
            String(item.nomenclature_id) === String(req.nomenclature_id) && isSgpStockRow(item)
          )
          allocationResult = getGroupedSgpIssueAllocations([
            { nomenclature_id: req.nomenclature_id, name: displayName, rawItems: fallbackRows }
          ], [{ id: req.nomenclature_id, name: displayName }], req, neededQty)
        }

        if (allocationResult.allocations.length === 0) throw new Error(rpcFailureMessage || `Не знайдено залишок СГП для «${displayName}»`)
        const availableQty = allocationResult.availableQty
        if (availableQty < neededQty) throw new Error(`Недостатньо залишку СГП: доступно ${availableQty} шт, потрібно ${neededQty} шт`)

        const dateStr = new Date().toLocaleDateString('uk-UA') + ' ' + new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
        const [firstAllocation, ...additionalAllocations] = allocationResult.allocations
        const issueMarker = `[ВИДАНО СГП: ${issuerName} ${dateStr}]`
        const updatePromise = supabase.from('material_requests').update({
          status: 'issued',
          quantity: firstAllocation.quantity,
          inventory_id: firstAllocation.inventory.id,
          details: `${req.details || ''} ${issueMarker}`
        }).eq('id', req.id)
        const insertPromise = additionalAllocations.length > 0
          ? supabase.from('material_requests').insert(additionalAllocations.map((allocation, index) => ({
              order_id: req.order_id,
              task_id: req.task_id,
              nomenclature_id: req.nomenclature_id,
              quantity: allocation.quantity,
              status: 'issued',
              inventory_id: allocation.inventory.id,
              category: req.category || 'packaging',
              target_warehouse: req.target_warehouse || 'sgp',
              details: `${req.details || ''} [ЧАСТИНА ${index + 2}/${allocationResult.allocations.length}] ${issueMarker}`
            })))
          : Promise.resolve({ error: null })
        const writeResults = await Promise.all([updatePromise, insertPromise])
        const writeError = writeResults.find(result => result?.error)?.error
        if (writeError) throw writeError
      }

      if (typeof refreshTable === 'function') {
        refreshTable('material_requests')
        refreshTable('inventory')
      }
      if (typeof fetchData === 'function') {
        fetchData(['material_requests', 'inventory', 'orders'])
      }
      if (typeof fetchQueueFromDb === 'function') {
        await fetchQueueFromDb()
      }
  }

  const handleIssueRequest = async (req) => {
    if (!req || isIssuingReq) return
    setIsIssuingReq(true)
    try {
      await issueRequest(req)
    } catch (err) {
      alert(`Помилка видачі: ${err.message || err}`)
    } finally {
      setIsIssuingReq(false)
    }
  }

  const handleIssueAllForOrder = async (orderGroup) => {
    if (!orderGroup || !orderGroup.items?.length || isIssuingReq) return
    setIsIssuingReq(true)
    try {
      for (const req of orderGroup.items) {
        await issueRequest(req)
      }
      alert(`✅ Всі комплектуючі для наряду №${orderGroup.orderNum} успішно видано з СГП!`)
    } catch (err) {
      alert(`Помилка при видачі: ${err.message || err}`)
    } finally {
      setIsIssuingReq(false)
    }
  }

  return {
    groupedPackagingRequests,
    collapsedOrders,
    toggleOrderCollapse,
    collapseAll,
    expandAll,
    getItemDisplayName,
    getItemCategoryBadge,
    getSgpStock,
    handleIssueRequest,
    handleIssueAllForOrder,
    isIssuingReq,
    activePackagingRequests,
    completedPackagingRequests,
    allPackagingRequests,
    pendingPackagingRequests
  }
}
