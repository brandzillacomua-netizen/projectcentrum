import React, { useState, useMemo, useEffect } from 'react'
import { useMES } from '../../../MESContext'
import { useWarehouseComputed } from './useWarehouseComputed'
import { useWarehouseHandlers } from './useWarehouseHandlers'
import { useManualInventoryIssue } from '../ManualIssue/useManualInventoryIssue'

export function useWarehouseBoxesData() {
  const {
    inventory, requests, issueMaterials, issueMaterialsBatch,
    nomenclatures, receptionDocs, confirmReception,
    orders, tasks, approveWarehouse, createPurchaseRequest,
    purchaseRequests, receiveInventory, currentUser, fetchData,
    fetchModuleData, refreshTable, machineOperations, workCards
  } = useMES()

  const [checkedCutters, setCheckedCutters] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [editingInvId, setEditingInvId] = useState(null)
  const [editingInvTotal, setEditingInvTotal] = useState('')
  const [editingInvReserved, setEditingInvReserved] = useState('')
  const [savingInv, setSavingInv] = useState(false)

  // Scanning & kitting modal states
  const [isScanning, setIsScanning] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [manualCardInput, setManualCardInput] = useState('')
  const [kittingBoxItem, setKittingBoxItem] = useState(null)
  const [scannedCard, setScannedCard] = useState(null)
  const [scannedRequests, setScannedRequests] = useState([])

  // Local interactive states
  const [selectedOrderNum, setSelectedOrderNum] = useState('all')
  const [filterStatus, setFilterStatus] = useState('pending') // 'all', 'pending', 'prepared'
  const [boxNumberState, setBoxNumberState] = useState({}) 
  const [checkedSheets, setCheckedSheets] = useState({})
  const [expandedGroups, setExpandedGroups] = useState({})

  // Screen size check for responsive UI layout
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Dummy state values needed for compatibility
  const [editingQty] = useState({})
  const [savingQty] = useState(new Set())
  const [shortages, setShortages] = useState(null)
  const [newItem] = useState({ name: '', unit: 'шт', total_qty: '', type: 'raw', pocket_owner: '' })

  // Active tab context is boxes
  const activeTab = 'boxes'

  const { cardsWithBoxes } = useWarehouseComputed({
    requests, tasks, receptionDocs, nomenclatures, inventory,
    activeTab, machineOperations, workCards, searchQuery
  })

  const handlers = useWarehouseHandlers({
    inventory, nomenclatures, orders, tasks, requests,
    purchaseRequests, receptionDocs, workCards, machineOperations, activeTab, currentUser,
    issueMaterials, issueMaterialsBatch, approveWarehouse,
    confirmReception, createPurchaseRequest, receiveInventory,
    fetchData, fetchModuleData,
    setShortages, setIsProcessing,
    setSavingQty: () => {},
    setEditingQty: () => {},
    setEditingInvId, setEditingInvTotal, setEditingInvReserved, setSavingInv,
    checkedCutters, setCheckedCutters,
    editingQty, savingQty,
    editingInvTotal, editingInvReserved, savingInv,
    scannedCard, scannedRequests, shortages, isProcessing, newItem,
    setIsScanning, setScannedCard, setKittingBoxItem, setScannedRequests, setCameraError, setManualCardInput
  })

  const manualIssue = useManualInventoryIssue({
    nomenclatures,
    inventory,
    currentUser,
    sourceModule: 'warehouse_boxes',
    refreshTable
  })

  // Process & group all cards with boxes
  const allBoxes = useMemo(() => {
    return cardsWithBoxes.map(box => {
      const parentOrder = (orders || []).find(o => String(o.id) === String(box.card.order_id || box.task?.order_id))
      const orderNum = parentOrder ? parentOrder.order_num : 'Інші'
      const cardNum = box.card.card_info?.split(' ')[0] || `№${box.card.id.substring(0, 8)}`
      const partName = box.nom?.name || 'Без деталі'
      
      return {
        ...box,
        orderNum,
        cardNum,
        partName
      }
    })
  }, [cardsWithBoxes, orders])

  // Filter boxes by search query, selected order, and tab status
  const filteredBoxes = useMemo(() => {
    return allBoxes.filter(box => {
      const search = searchQuery.toLowerCase().trim()
      if (search) {
        const matchesSearch = box.cardNum.toLowerCase().includes(search) || 
                              box.partName.toLowerCase().includes(search) || 
                              box.orderNum.toLowerCase().includes(search)
        if (!matchesSearch) return false
      }

      if (selectedOrderNum !== 'all' && box.orderNum !== selectedOrderNum) {
        return false
      }

      if (filterStatus === 'pending' && box.isPrepared) return false
      if (filterStatus === 'prepared' && !box.isPrepared) return false

      return true
    }).sort((a, b) => {
      const getIndex = (box) => {
        const match = (box.cardNum || '').match(/^(\d+)\/(\d+)$/)
        return match ? parseInt(match[1], 10) : 999
      }
      return getIndex(a) - getIndex(b)
    })
  }, [allBoxes, searchQuery, selectedOrderNum, filterStatus])

  // List of unique orders for selector
  const orderList = useMemo(() => {
    const ordersMap = {}
    allBoxes.forEach(box => {
      if (!ordersMap[box.orderNum]) {
        ordersMap[box.orderNum] = {
          orderNum: box.orderNum,
          total: 0,
          pending: 0,
          prepared: 0,
          issued: 0
        }
      }
      ordersMap[box.orderNum].total += 1
      if (box.isPrepared) {
        ordersMap[box.orderNum].prepared += 1
      } else {
        ordersMap[box.orderNum].pending += 1
      }
      if (box.isIssued) {
        ordersMap[box.orderNum].issued += 1
      }
    })
    return Object.values(ordersMap).sort((a, b) => b.pending - a.pending)
  }, [allBoxes])

  // Group the work queue by nomenclature.
  const nomenclatureGroups = useMemo(() => {
    const groups = new Map()

    filteredBoxes.forEach(box => {
      const nomenclatureId = box.nom?.id || box.card?.nomenclature_id || box.partName
      const key = String(nomenclatureId || 'without-nomenclature')
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          name: box.partName,
          items: [],
          prepared: 0,
          pending: 0
        })
      }

      const group = groups.get(key)
      group.items.push(box)
      if (box.isPrepared) group.prepared += 1
      else group.pending += 1
    })

    return Array.from(groups.values()).sort((a, b) => {
      if (a.pending !== b.pending) return b.pending - a.pending
      return a.name.localeCompare(b.name, 'uk')
    })
  }, [filteredBoxes])

  useEffect(() => {
    if (nomenclatureGroups.length === 0) return
    setExpandedGroups(previous => {
      const hasVisibleOpenGroup = nomenclatureGroups.some(group => previous[group.key])
      if (hasVisibleOpenGroup) return previous
      const firstPending = nomenclatureGroups.find(group => group.pending > 0) || nomenclatureGroups[0]
      return { ...previous, [firstPending.key]: true }
    })
  }, [nomenclatureGroups])

  const toggleGroup = (groupKey) => {
    setExpandedGroups(previous => ({ ...previous, [groupKey]: !previous[groupKey] }))
  }

  const normalizeScannedCardId = (rawValue) => {
    let value = String(rawValue || '').trim()
    if (!value) return ''

    try {
      value = decodeURIComponent(value)
    } catch (e) {}

    if (value.includes('CENTRUM_CARD_')) {
      value = value.split('CENTRUM_CARD_').pop().trim()
    }

    try {
      const url = new URL(value)
      const queryId = url.searchParams.get('card_id') || url.searchParams.get('cardId') || url.searchParams.get('id')
      value = queryId || url.pathname.split('/').filter(Boolean).pop() || value
    } catch (e) {}

    value = value.replace(/^CENTRUM_CARD_/i, '').replace(/^#/, '').trim()
    const uuidMatch = value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    return uuidMatch ? uuidMatch[0] : value
  }

  const handleBoxCardScan = async (rawValue) => {
    if (manualIssue.handleScannedCode(rawValue)) {
      setIsScanning(false)
      return
    }

    const cardId = normalizeScannedCardId(rawValue)
    if (!cardId) {
      alert('Не вдалося зчитати код картки.')
      return
    }

    const boxItem = allBoxes.find(box => {
      const cardNum = box.card.card_info?.split(' ')[0]
      return String(box.card.id) === String(cardId) ||
        String(cardNum) === String(cardId)
    })

    if (!boxItem) {
      await handlers.handleCardScan(cardId)
      return
    }

    if (boxItem.isPrepared) {
      await handlers.handleCardScan(boxItem.card.id)
      return
    }

    setKittingBoxItem(boxItem)
  }

  return {
    nomenclatures,
    inventory,
    checkedCutters,
    setCheckedCutters,
    searchQuery,
    setSearchQuery,
    isProcessing,
    isScanning,
    setIsScanning,
    cameraError,
    manualCardInput,
    setManualCardInput,
    kittingBoxItem,
    setKittingBoxItem,
    scannedCard,
    setScannedCard,
    scannedRequests,
    setScannedRequests,
    selectedOrderNum,
    setSelectedOrderNum,
    filterStatus,
    setFilterStatus,
    checkedSheets,
    setCheckedSheets,
    expandedGroups,
    isMobile,
    handlers,
    manualIssue,
    allBoxes,
    filteredBoxes,
    orderList,
    nomenclatureGroups,
    toggleGroup,
    handleBoxCardScan
  }
}
