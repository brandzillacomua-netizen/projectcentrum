import { useMemo, useState } from 'react'
import { supabase } from '../../../supabase'
import { normalizeKey, isHardware } from '../warehouseFgpInventory.js'

export function usePackagingQueue({
  liveRequests,
  requests,
  orders,
  tasks,
  nomenclatures,
  inventory,
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
    return allPackagingRequests.filter(r => r.status !== 'completed' && r.status !== 'issued' && r.status !== 'cancelled')
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

  const getSgpStock = (req, displayName) => {
    if (req.nomenclature_id) {
      const byNom = (inventory || [])
        .filter(i => String(i.nomenclature_id) === String(req.nomenclature_id))
        .reduce((sum, i) => sum + (Number(i.total_qty) || 0) - (Number(i.reserved_qty) || 0), 0)
      if (byNom > 0) return byNom
    }
    const cleanDisplayName = normalizeKey(displayName)
    return (inventory || [])
      .filter(i => normalizeKey(i.name) === cleanDisplayName)
      .reduce((sum, i) => sum + (Number(i.total_qty) || 0) - (Number(i.reserved_qty) || 0), 0)
  }

  const handleIssueRequest = async (req) => {
    if (!req || isIssuingReq) return
    setIsIssuingReq(true)
    try {
      const issuerName = `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim() || currentUser?.login || 'Комірник СГП'
      
      let rpcSuccess = false
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('issue_packaging_request_from_sgp', {
          p_request_id: req.id,
          p_issuer_name: issuerName
        })
        if (!rpcErr && rpcRes?.success) {
          rpcSuccess = true
        }
      } catch (e) {}

      if (!rpcSuccess) {
        const neededQty = Number(req.quantity) || 0
        const displayName = getItemDisplayName(req)
        const matchingSgpItem = (inventory || []).find(i => {
          if (req.nomenclature_id && String(i.nomenclature_id) === String(req.nomenclature_id)) {
            return i.warehouse === 'sgp' || i.type === 'finished' || i.type === 'bz' || i.type === 'part' || i.type === 'hardware' || isHardware(i)
          }
          return false
        }) || (inventory || []).find(i => normalizeKey(i.name) === normalizeKey(displayName))

        if (matchingSgpItem) {
          const currentQty = Number(matchingSgpItem.total_qty) || 0
          const newQty = Math.max(0, currentQty - neededQty)
          await supabase.from('inventory').update({
            total_qty: newQty,
            updated_at: new Date().toISOString()
          }).eq('id', matchingSgpItem.id)
        }

        const dateStr = new Date().toLocaleDateString('uk-UA') + ' ' + new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
        await supabase.from('material_requests').update({
          status: 'completed',
          inventory_id: matchingSgpItem?.id || req.inventory_id || null,
          details: `${req.details || ''} [ВИДАНО СГП: ${issuerName} ${dateStr}]`
        }).eq('id', req.id)
      }

      if (typeof refreshTable === 'function') {
        refreshTable('material_requests')
        refreshTable('inventory')
      }
      if (typeof fetchData === 'function') {
        fetchData(['material_requests', 'inventory', 'orders'])
      }
      if (typeof fetchQueueFromDb === 'function') {
        fetchQueueFromDb()
      }
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
        await handleIssueRequest(req)
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
