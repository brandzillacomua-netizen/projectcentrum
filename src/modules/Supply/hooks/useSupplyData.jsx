import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useMES } from '../../../MESContext'
import { apiService } from '../../../services/apiDispatcher'
import { supabase } from '../../../supabase'
import {
  getQR,
  setQR,
  getNomLabel,
  parseMaterialName,
  resolveItemName,
  resolveItemQty
} from '../utils/supplyHelpers'

export function useSupplyData({ isProcurementOnly = false } = {}) {
  const {
    inventory, nomenclatures, receptionDocs, createReceptionDoc, sendDocToWarehouse,
    purchaseRequests, updatePurchaseRequestStatus, convertRequestToOrder, currentUser,
    confirmReception, fetchData, refreshTable, normalize, requests, issueMaterialsBatch, tasks,
    orders, managers
  } = useMES()

  useEffect(() => {
    if (typeof fetchData === 'function') {
      const targets = ['inventory', 'nomenclatures', 'reception_docs', 'purchase_requests']
      if (!isProcurementOnly) targets.push('material_requests', 'tasks')
      fetchData(targets)
    }
  }, [isProcurementOnly, fetchData])

  const [activeTab, setActiveTab] = useState('requests') // 'requests', 'registry', 'stock', 'qrcodes'
  const [requestSubTab, setRequestSubTab] = useState('all') // 'all', 'prep', 'deficit'
  const [showCreate, setShowCreate] = useState(false)
  const [draftItems, setDraftItems] = useState([])
  const [selectedQty, setSelectedQty] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [stockFolder, setStockFolder] = useState('all')
  const [expandedDoc, setExpandedDoc] = useState(null)
  const [showReception, setShowReception] = useState(false)
  const [shortageModal, setShortageModal] = useState(null)
  const [receptionDocToAccept, setReceptionDocToAccept] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingDocs, setProcessingDocs] = useState(new Set())
  const [targetWarehouse, setTargetWarehouse] = useState('') // operational=СО, production=СВ, pocket=кишеня
  const [expandedPRs, setExpandedPRs] = useState(new Set())
  const [pocketOwner, setPocketOwner] = useState('')

  // QR Scanning state
  const [isScanning, setIsScanning] = useState(false)
  const [manualCardInput, setManualCardInput] = useState('')

  // QR Code tab states
  const [qrNomSearch, setQrNomSearch] = useState('')
  const [editingQrNomId, setEditingQrNomId] = useState(null)
  const [editingQrCodeValue, setEditingQrCodeValue] = useState('')
  const [savingQr, setSavingQr] = useState(false)
  const [selectedQrNomIds, setSelectedQrNomIds] = useState(new Set())

  // Reserve analysis modal state
  const [reserveAnalysisItem, setReserveAnalysisItem] = useState(null)

  // Super admin inventory editing & deletion state
  const [editingInvId, setEditingInvId] = useState(null)
  const [editingInvTotal, setEditingInvTotal] = useState('')
  const [editingInvReserved, setEditingInvReserved] = useState('')
  const [savingInv, setSavingInv] = useState(false)
  const [itemToDelete, setItemToDelete] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const isSuperAdmin = currentUser?.login === 'admin@workshop.local' || currentUser?.position === 'Адмін' || currentUser?.role === 'admin' || currentUser?.access_rights?.director
  const isAdmin = isSuperAdmin || (currentUser?.position || '').toLowerCase().includes('директор')

  const handleDeleteInventoryItem = (item) => {
    if (!item || !item.id || item.is_virtual_zero_stock) return
    setItemToDelete(item)
  }

  const confirmDeleteInventoryItem = async () => {
    if (!itemToDelete || isDeleting) return
    setIsDeleting(true)
    try {
      const { error } = await supabase.from('inventory').delete().eq('id', itemToDelete.id)
      if (error) throw error
      if (typeof fetchData === 'function') fetchData(['inventory', 'nomenclatures'])
      setItemToDelete(null)
    } catch (err) {
      alert(`Помилка видалення: ${err.message || err}`)
    } finally {
      setIsDeleting(false)
    }
  }

  useEffect(() => {
    if (!itemToDelete) return
    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        confirmDeleteInventoryItem()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setItemToDelete(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [itemToDelete, isDeleting])

  const handleSaveInventoryQty = async (itemId) => {
    const totalVal = parseFloat(editingInvTotal)
    const reservedVal = parseFloat(editingInvReserved)
    if (isNaN(totalVal) || totalVal < 0 || isNaN(reservedVal) || reservedVal < 0) {
      alert('Будь ласка, введіть коректні числа (>= 0)')
      return
    }
    setSavingInv(true)
    try {
      await supabase.from('inventory').update({
        total_qty: totalVal,
        reserved_qty: reservedVal,
        updated_at: new Date().toISOString()
      }).eq('id', itemId)
      if (typeof fetchData === 'function') fetchData(['inventory', 'nomenclatures'])
      setEditingInvId(null)
    } catch (err) {
      alert('Помилка збереження: ' + err.message)
    } finally {
      setSavingInv(false)
    }
  }

  const pendingRequests = useMemo(() => {
    return (purchaseRequests || []).filter(pr => {
      const isRelevantStatus = (pr.status === 'pending' || pr.status === 'accepted' || pr.status === 'ordered')
      if (isProcurementOnly) return isRelevantStatus && pr.destination_warehouse === 'procurement'
      return isRelevantStatus && (pr.destination_warehouse === 'production' || !pr.destination_warehouse)
    })
  }, [purchaseRequests, isProcurementOnly])

  // Запити від Відділу Підготовки
  const prepRequests = useMemo(() => {
    return (requests || []).filter(r => {
      if (r.status !== 'pending') return false
      if (r.details && (
        r.details.includes('ЗАПИТ НА ПІДГОТОВКУ') || 
        r.details.includes('ПІДГОТОВ') || 
        r.details.includes('браку') || 
        r.details.includes('Дозабезпечення')
      )) {
        return true
      }
      if (r.task_id) {
        const task = (tasks || []).find(t => t.id === r.task_id)
        if (task && task.step === 'Підготовка') return true
      }
      return false
    })
  }, [requests, tasks])

  const groupedPrepRequests = useMemo(() => {
    const groups = {}
    prepRequests.forEach(req => {
      const taskId = req.task_id || 'no-task'
      if (!groups[taskId]) {
        groups[taskId] = {
          taskId,
          task: (tasks || []).find(t => t.id === taskId),
          requests: [],
          created_at: req.created_at || new Date().toISOString()
        }
      }
      groups[taskId].requests.push(req)
    })
    return Object.values(groups).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [prepRequests, tasks])

  const incomingReceptionCount = useMemo(() => {
    return (receptionDocs || []).filter(d => 
      (d.status === 'shipped' || d.status === 'ordered') && 
      (isProcurementOnly ? false : (!d.target_warehouse || d.target_warehouse === 'production'))
    ).length
  }, [receptionDocs, isProcurementOnly])
  
  const availableNoms = useMemo(() => {
    return (nomenclatures || []).filter(n => n.type !== 'part' && n.type !== 'product' && n.type !== 'finished')
  }, [nomenclatures])

  const stockRows = useMemo(() => {
    const targetWh = isProcurementOnly ? 'procurement' : 'production'
    const isSheet = item => /^лист(?:\s|$)/i.test(String(item?.name || '').trim())
    const isUnpreparedSheet = item => String(item?.name || '').toLowerCase().includes('[непідготовлений]')
    const warehouseRows = (inventory || []).filter(item =>
      item.type !== 'finished'
      && item.type !== 'product'
      && item.warehouse === targetWh
      && (isProcurementOnly || !isSheet(item) || isUnpreparedSheet(item))
    )

    if (isProcurementOnly) return warehouseRows

    const representedNomenclatures = new Set(
      warehouseRows.map(item => item.nomenclature_id).filter(Boolean).map(String)
    )
    const representedNames = new Set(
      warehouseRows.map(item => String(item.name || '').trim().toLowerCase()).filter(Boolean)
    )
    const missingSheets = (nomenclatures || [])
      .filter(nom => isSheet(nom) && isUnpreparedSheet(nom))
      .filter(nom => !representedNomenclatures.has(String(nom.id)) && !representedNames.has(String(nom.name || '').trim().toLowerCase()))
      .map(nom => ({
        id: `zero-sheet-${nom.id}`,
        nomenclature_id: nom.id,
        name: nom.name,
        unit: nom.unit || 'шт',
        total_qty: 0,
        reserved_qty: 0,
        warehouse: 'production',
        type: nom.type || 'material',
        is_virtual_zero_stock: true
      }))

    return [...warehouseRows, ...missingSheets]
      .sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), 'uk'))
  }, [inventory, nomenclatures, isProcurementOnly])

  const filteredStock = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const isSheet = i => (i.name || '').toLowerCase().includes('лист') && !(i.name || '').toLowerCase().includes('гума') && !(i.name || '').toLowerCase().includes('накладка')
    const isCutter = i => (i.name || '').toLowerCase().includes('фреза')
    const isHardware = i => i.type === 'hardware' || (i.name || '').toLowerCase().includes('гайка') || (i.name || '').toLowerCase().includes('гвинт') || (i.name || '').toLowerCase().includes('болт') || (i.name || '').toLowerCase().includes('шайба') || (i.name || '').toLowerCase().includes('заклепка') || (i.name || '').toLowerCase().includes('шпилька')
    const isUnprepared = i => (i.name || '').toLowerCase().includes('[непідготовлений]')
    const isPrepared = i => (i.name || '').toLowerCase().includes('[підготовлений]')

    return stockRows.filter(i => {
      if (query && !(i.name || '').toLowerCase().includes(query)) return false

      if (stockFolder === 'raw') return i.type === 'raw'
      if (stockFolder === 'sheet_materials') return isSheet(i)
      if (stockFolder === 'hardware') return isHardware(i)
      if (stockFolder === 'consumable') return i.type === 'consumable' || isCutter(i)
      if (stockFolder === 'unprepared') return isUnprepared(i)
      if (stockFolder === 'prepared') return isPrepared(i)
      return true
    })
  }, [stockRows, searchQuery, stockFolder])

  const isDocAvailable = useCallback((doc) => {
    if (!doc.items || doc.items.length === 0) return true
    
    const otherDocs = (receptionDocs || []).filter(d => 
      d.id !== doc.id && 
      d.status === 'ordered' && 
      d.target_warehouse === 'production'
    )
    
    const virtualReservedMap = {}
    otherDocs.forEach(d => {
      (d.items || []).forEach(it => {
        const key = it.nomenclature_id ? String(it.nomenclature_id) : normalize(it.name || it.reqDetails || it.details)
        virtualReservedMap[key] = (virtualReservedMap[key] || 0) + (Number(it.qty || it.needed || it.quantity) || 0)
      })
    })

    return doc.items.every((it, idx) => {
      const name = resolveItemName(it, idx)
      const parsedName = parseMaterialName(name)
      const nomId = it.nomenclature_id
      
      const matching = (inventory || []).filter(inv =>
        inv.warehouse === 'production' &&
        (
          (nomId && String(inv.nomenclature_id) === String(nomId)) ||
          normalize(inv.name) === normalize(parsedName)
        )
      )
      
      const totalStock = matching.reduce((acc, i) => acc + (Number(i.total_qty) || 0), 0)
      const dbReserved = matching.reduce((acc, i) => acc + (Number(i.reserved_qty) || 0), 0)
      
      const vKey = nomId ? String(nomId) : normalize(parsedName)
      const vReserved = virtualReservedMap[vKey] || 0
      
      const free = Math.max(0, totalStock - dbReserved - vReserved)
      const alreadyReserved = Number(it.reserved_from_stock) || 0
      const available = free + alreadyReserved
      
      return available >= Number(resolveItemQty(it))
    })
  }, [receptionDocs, inventory, normalize])

  const handleQRScan = useCallback((scannedCode) => {
    if (!scannedCode) return
    const nom = (nomenclatures || []).find(n => getQR(n).toLowerCase() === scannedCode.toLowerCase().trim())
    if (!nom) {
      alert(`Номенклатуру з QR-кодом "${scannedCode}" не знайдено!`)
      return
    }
    const nomLabel = getNomLabel(nom)
    const existingIndex = draftItems.findIndex(it => it.nomenclature_id === nom.id)
    if (existingIndex !== -1) {
      const updated = [...draftItems]
      updated[existingIndex].qty = String(Number(updated[existingIndex].qty || 0) + 1)
      setDraftItems(updated)
    } else {
      setDraftItems([...draftItems, { nomenclature_id: nom.id, name: nomLabel, qty: '1' }])
    }
  }, [nomenclatures, draftItems])

  const handleSaveQrCode = useCallback(async (nomId, qrCodeVal) => {
    const nom = (nomenclatures || []).find(n => n.id === nomId)
    if (!nom) return false
    const updatedInfo = setQR(nom, qrCodeVal.trim())
    setSavingQr(true)
    try {
      const { error } = await supabase
        .from('nomenclatures')
        .update({ additional_info: updatedInfo })
        .eq('id', nomId)
      if (error) throw error
      if (typeof fetchData === 'function') fetchData(['nomenclatures'])
      setEditingQrNomId(null)
      return true
    } catch (err) {
      alert('Помилка збереження: ' + err.message)
      return false
    } finally {
      setSavingQr(false)
    }
  }, [nomenclatures, supabase, fetchData])

  const handleDeleteQrCode = useCallback(async (nom) => {
    const qrCode = getQR(nom)
    if (!qrCode) return
    const confirmed = window.confirm(
      `Видалити QR-код "${qrCode}" для номенклатури "${getNomLabel(nom)}"?\n\nНоменклатура та складські залишки залишаться без змін.`
    )
    if (!confirmed) return

    const deleted = await handleSaveQrCode(nom.id, '')
    if (!deleted) return
    setSelectedQrNomIds(previous => {
      const next = new Set(previous)
      next.delete(nom.id)
      return next
    })
  }, [handleSaveQrCode])

  const addToDraft = useCallback(() => {
    if (!searchQuery || !selectedQty) return
    const nom = availableNoms.find(n => getNomLabel(n) === searchQuery)
    if (!nom) { alert('Оберіть товар зі списку!'); return }
    setDraftItems(prev => [...prev, { nomenclature_id: nom.id, name: getNomLabel(nom), qty: selectedQty }])
    setSearchQuery('')
    setSelectedQty('')
  }, [searchQuery, selectedQty, availableNoms])

  const handleSendToWarehouse = useCallback(async () => {
    if (draftItems.length === 0 || isProcessing) return
    if (!targetWarehouse) {
      alert('Оберіть пункт призначення поставки: СО, СВ або Кишеня Майстра.')
      return
    }
    if (targetWarehouse === 'pocket' && !pocketOwner) {
      alert('Оберіть майстра для кишені.')
      return
    }
    
    const deficitItems = []
    if (!isProcurementOnly) {
      draftItems.forEach(d => {
        const matching = (inventory || []).filter(i => 
          i.warehouse === 'production' && 
          (i.nomenclature_id === d.nomenclature_id || normalize(i.name) === normalize(d.name))
        )
        const totalStock = matching.reduce((acc, i) => acc + (Number(i.total_qty) || 0), 0)
        const totalReserved = matching.reduce((acc, i) => acc + (Number(i.reserved_qty) || 0), 0)
        const available = Math.max(0, totalStock - totalReserved)
        const needed = Number(d.qty)
        
        if (available < needed) {
          deficitItems.push({ ...d, missing: needed - available, available })
        }
      })
    }

    if (deficitItems.length > 0) {
      setShortageModal({ deficitItems, draftItems })
      return
    }

    setIsProcessing(true)
    try {
      const items = draftItems.map(d => ({ nomenclature_id: d.nomenclature_id, name: d.name, qty: d.qty }))

      if (!isProcurementOnly) {
        const reserveUpdates = []
        draftItems.forEach(d => {
          const qty = Number(d.qty)
          const matching = (inventory || []).filter(i =>
            i.warehouse === 'production' &&
            (i.nomenclature_id === d.nomenclature_id || normalize(i.name) === normalize(d.name))
          )
          if (matching.length > 0) {
            const best = matching.sort((a, b) => (Number(b.total_qty) || 0) - (Number(a.total_qty) || 0))[0]
            reserveUpdates.push(
              supabase.from('inventory').update({
                reserved_qty: (Number(best.reserved_qty) || 0) + qty
              }).eq('id', best.id)
            )
          }
        })
        if (reserveUpdates.length > 0) {
          await Promise.all(reserveUpdates)
        }
      }

      const targetWh = targetWarehouse
      const sourceWh = isProcurementOnly ? null : 'production'
      const whLabel = targetWh === 'operational' ? 'СО (Склад Операційний)' : (targetWh === 'pocket' ? 'Кишеню Майстра' : 'СВ (Склад Виробництва)')
      await apiService.submitCreateReceptionDoc(items, null, (its) => createReceptionDoc(its, 'shipped', null, null, targetWh, sourceWh, targetWh === 'pocket' ? pocketOwner : null), targetWh, sourceWh)
      setDraftItems([])
      setShowCreate(false)
      setPocketOwner('')
      setActiveTab('registry')
      alert(`Готово! Поставку успішно відправлено на ${whLabel}.`)
    } finally {
      setIsProcessing(false)
    }
  }, [draftItems, isProcessing, targetWarehouse, pocketOwner, isProcurementOnly, inventory, normalize, supabase, createReceptionDoc])

  const handleForwardToProcurement = useCallback(async (pr) => {
    try {
      const items = pr.items || []
      const aggregated = []
      items.forEach((it, idx) => {
        const name = resolveItemName(it, idx)
        const parsedName = parseMaterialName(name)
        const qty = Number(resolveItemQty(it)) || 0
        
        const existing = aggregated.find(a => (it.nomenclature_id && a.nomenclature_id === it.nomenclature_id) || normalize(a.parsedName) === normalize(parsedName))
        if (existing) {
          existing.qty += qty
          existing.reserved_from_stock = (Number(existing.reserved_from_stock) || 0) + (Number(it.reserved_from_stock) || 0)
        } else {
          aggregated.push({ ...it, name, parsedName, qty, reserved_from_stock: Number(it.reserved_from_stock) || 0 })
        }
      })

      const deficitItems = []
      const usedInThisDoc = {}

      for (const it of aggregated) {
        const matchingItems = (inventory || []).filter(inv =>
          inv.warehouse === 'production' &&
          (
            (it.nomenclature_id && String(inv.nomenclature_id) === String(it.nomenclature_id)) ||
            normalize(inv.name) === normalize(it.parsedName) ||
            (inv.name && it.parsedName && normalize(inv.name).includes(normalize(it.parsedName))) ||
            (inv.name && it.parsedName && normalize(it.parsedName).includes(normalize(inv.name)))
          )
        )

        const totalQty = matchingItems.reduce((acc, inv) => acc + (Number(inv.total_qty) || 0), 0)
        const reservedQty = matchingItems.reduce((acc, inv) => acc + (Number(inv.reserved_qty) || 0), 0)
        const available = Math.max(0, totalQty - reservedQty)
        
        const firstMatchId = matchingItems[0]?.id || it.parsedName
        const freeAvailable = Math.max(0, available - (usedInThisDoc[firstMatchId] || 0))
        const needed = it.qty
        const alreadyReserved = Number(it.reserved_from_stock) || 0
        const netNeeded = Math.max(0, needed - alreadyReserved)
        
        const deficitQty = netNeeded > freeAvailable ? Math.round((netNeeded - freeAvailable) * 100) / 100 : 0
        const canReserve = Math.min(needed, freeAvailable)

        if (deficitQty > 0) {
          deficitItems.push({
            ...it,
            qty: deficitQty,
            needed: deficitQty,
            missingAmount: deficitQty,
            name: it.name
          })
        }

        if (canReserve > 0 && matchingItems.length > 0) {
          usedInThisDoc[firstMatchId] = (usedInThisDoc[firstMatchId] || 0) + canReserve
        }
      }

      if (deficitItems.length === 0) {
        setProcessingDocs(prev => new Set(prev).add(pr.id))
        try {
          await apiService.submitUpdatePurchaseRequestStatus(pr.id, 'accepted', updatePurchaseRequestStatus)
          alert('Весь обсяг матеріалів заброньовано на складі! Наряд можна видавати.')
        } finally {
          setProcessingDocs(prev => { const next = new Set(prev); next.delete(pr.id); return next; })
        }
        return
      }

      setShortageModal({ pr, deficitItems })
    } catch (err) {
      console.error('Procurement analyze error:', err)
      alert('Помилка аналізу дефіциту: ' + err.message)
    }
  }, [inventory, normalize, updatePurchaseRequestStatus])

  const handleRequestPrepMaterialsFromProcurement = useCallback(async (group) => {
    if (isProcessing) return
    setIsProcessing(true)
    try {
      const task = (tasks || []).find(t => t.id === group.taskId)
      const prepNum = task?.plan_snapshot?._prep_num || `НП-${String(group.taskId).slice(0, 8)}`
      
      const deficitItems = []
      group.requests.forEach(req => {
        const reqNom = nomenclatures?.find(n => n.id === req.nomenclature_id)
        const reqName = reqNom?.name || req.details
        const qty = Number(req.quantity) || 0
        
        const matchingItems = (inventory || []).filter(i =>
          i.warehouse === 'production' &&
          (String(i.nomenclature_id) === String(req.nomenclature_id) || normalize(i.name) === normalize(reqName))
        )
        const totalStock = matchingItems.reduce((acc, i) => acc + (Number(i.total_qty) || 0), 0)
        const dbReserved = matchingItems.reduce((acc, i) => acc + (Number(i.reserved_qty) || 0), 0)
        const available = Math.max(0, totalStock - dbReserved)
        
        if (available < qty) {
          const deficitQty = qty - available
          deficitItems.push({
            nomenclature_id: req.nomenclature_id,
            name: reqName,
            qty: deficitQty,
            needed: deficitQty,
            missingAmount: deficitQty,
            production_available: available,
            reserved_from_stock: available,
            needs_procurement: true
          })
        }
      })

      if (deficitItems.length > 0) {
        const { error } = await supabase.from('purchase_requests').insert([{
          order_id: null,
          task_id: group.taskId,
          order_num: prepNum,
          items: deficitItems,
          status: 'pending',
          destination_warehouse: 'procurement'
        }])
        
        if (error) throw error
        setIsProcessing(false)
        if (refreshTable) refreshTable('purchase_requests')
        setTimeout(() => {
          alert('Запит на дефіцитні матеріали успішно надіслано в Постачання!')
        }, 50)
      } else {
        setIsProcessing(false)
        setTimeout(() => {
          alert('Усі матеріали є в наявності!')
        }, 50)
      }
    } catch (err) {
      setIsProcessing(false)
      setTimeout(() => {
        alert('Помилка: ' + err.message)
      }, 50)
    } finally {
      setIsProcessing(false)
    }
  }, [isProcessing, tasks, nomenclatures, inventory, normalize, supabase, refreshTable])

  const handleManualShortagePR = useCallback(async () => {
    if (!shortageModal || isProcessing) return
    setIsProcessing(true)
    const { deficitItems, draftItems } = shortageModal
    
    try {
      const orderNum = `№РП-${new Date().getTime().toString().slice(-6)}`
      
      const prItems = deficitItems.map(it => ({
        nomenclature_id: it.nomenclature_id,
        name: it.name,
        needed: it.qty,
        missingAmount: it.missing,
        production_available: it.available,
        reserved_from_stock: it.available,
        needs_procurement: true
      }))
      
      const { error: prErr } = await supabase.from('purchase_requests').insert([{
        order_id: null,
        task_id: null,
        order_num: orderNum,
        items: prItems,
        status: 'pending',
        destination_warehouse: 'production'
      }])
      
      if (prErr) throw prErr

      const availableItemsToReserve = deficitItems
        .filter(i => i.available > 0)
        .map(i => ({ nomenclature_id: i.nomenclature_id, name: i.name, qty: i.available }))
      
      const fullyAvailableItems = draftItems
        .filter(d => !deficitItems.some(di => di.nomenclature_id === d.nomenclature_id || di.name === d.name))
        .map(d => ({ nomenclature_id: d.nomenclature_id, name: d.name, qty: d.qty }))
      
      const allToReserve = [...availableItemsToReserve, ...fullyAvailableItems]
      
      if (allToReserve.length > 0) {
        const itemsWithReservation = allToReserve.map(it => ({ ...it, reserved_from_stock: it.qty }))
        await apiService.submitCreateReceptionDoc(itemsWithReservation, null, (its) => createReceptionDoc(its, 'ordered', null, null, 'production', null), 'production', null)
      }
      
      setDraftItems([])
      setShowCreate(false)
      setShortageModal(null)
      setIsProcessing(false)
      if (refreshTable) {
        refreshTable('purchase_requests')
        refreshTable('reception_docs')
      }
      setTimeout(() => {
        alert(`Створено наряд ${orderNum}! Дефіцит (якщо є) надіслано в Постачання. Те що було в наявності — зарезервовано.`)
      }, 50)
    } catch (err) {
      setIsProcessing(false)
      setTimeout(() => {
        alert('Помилка: ' + err.message)
      }, 50)
    } finally {
      setIsProcessing(false)
    }
  }, [shortageModal, isProcessing, supabase, createReceptionDoc, refreshTable])

  const confirmForwardToProcurement = useCallback(async () => {
    if (!shortageModal || isProcessing) return
    setIsProcessing(true)
    const { pr, deficitItems } = shortageModal
    
    try {
      const cloneData = {
        order_id: pr.order_id,
        task_id: pr.task_id,
        order_num: pr.order_num,
        items: deficitItems,
        status: 'pending',
        destination_warehouse: 'procurement'
      }
      
      const { error } = await supabase.from('purchase_requests').insert([cloneData])
      if (error) throw error

      const updatedItems = [...(pr.items || [])]
      const inventoryUpserts = []
      
      for (let i = 0; i < updatedItems.length; i++) {
        const it = updatedItems[i]
        const name = resolveItemName(it, i)
        const parsedName = parseMaterialName(name)
        
        const matchingItems = (inventory || []).filter(inv =>
          inv.warehouse === 'production' &&
          (
            (it.nomenclature_id && String(inv.nomenclature_id) === String(it.nomenclature_id)) ||
            (it.inventory_id && String(inv.id) === String(it.inventory_id)) ||
            normalize(inv.name) === normalize(parsedName) ||
            (inv.name && parsedName && normalize(inv.name).includes(normalize(parsedName))) ||
            (inv.name && parsedName && normalize(parsedName).includes(normalize(inv.name)))
          )
        )
        
        if (matchingItems.length > 0) {
          const totalQty = matchingItems.reduce((acc, inv) => acc + (Number(inv.total_qty) || 0), 0)
          const totalReserved = matchingItems.reduce((acc, inv) => acc + (Number(inv.reserved_qty) || 0), 0)
          const available = totalQty - totalReserved
          const needed = Number(resolveItemQty(it))
          const canReserve = Math.min(needed, Math.max(0, available))
          
          if (canReserve > 0) {
            const firstInv = matchingItems[0]
            inventoryUpserts.push({
              ...firstInv,
              reserved_qty: (Number(firstInv.reserved_qty) || 0) + canReserve
            })
            
            updatedItems[i] = { 
              ...it, 
              reserved_from_stock: (Number(it.reserved_from_stock) || 0) + canReserve 
            }
          }
        }
      }

      if (inventoryUpserts.length > 0) {
        const { error: upsertErr } = await supabase.from('inventory').upsert(inventoryUpserts)
        if (upsertErr) throw upsertErr
      }

      await supabase.from('purchase_requests').update({ items: updatedItems }).eq('id', pr.id)

      setShortageModal(null)
      setIsProcessing(false)
      if (refreshTable) {
        refreshTable('purchase_requests')
        refreshTable('inventory')
      }
      setTimeout(() => {
        alert('Запит на дефіцит надіслано до Постачання! Наявне заброньовано на СВ.')
      }, 50)
    } catch (err) {
      setIsProcessing(false)
      setTimeout(() => {
        alert('Помилка відправки: ' + err.message)
      }, 50)
    } finally {
      setIsProcessing(false)
    }
  }, [shortageModal, isProcessing, supabase, inventory, normalize, refreshTable])

  const handleDeletePrepRequestGroup = useCallback(async (group) => {
    if (!window.confirm(`Ви впевнені, що хочете видалити запит на підготовку для наряду № ${group.taskId || '—'}?`)) {
      return
    }
    setIsProcessing(true)
    try {
      const reqsToDelete = group.requests || []
      const reqIds = reqsToDelete.map(r => r.id)
      
      const reservationReversals = []
      reqsToDelete.forEach(req => {
        if (req.status === 'issued' && req.inventory_id && Number(req.quantity) > 0) {
          const invItem = (inventory || []).find(i => i.id === req.inventory_id)
          if (invItem) {
            reservationReversals.push(
              supabase.from('inventory').update({
                reserved_qty: Math.max(0, (Number(invItem.reserved_qty) || 0) - Number(req.quantity))
              }).eq('id', invItem.id)
            )
          }
        }
      })
      
      if (reservationReversals.length > 0) {
        await Promise.all(reservationReversals)
      }
      
      const { error } = await supabase.from('material_requests').delete().in('id', reqIds)
      if (error) throw error
      
      alert('Запит на підготовку успішно видалено з очищенням резервів!')
      if (refreshTable) {
        refreshTable('material_requests')
        refreshTable('inventory')
      }
    } catch (err) {
      alert('Помилка видалення: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }, [inventory, supabase, refreshTable])

  const handleDeletePurchaseRequest = useCallback(async (pr) => {
    if (!window.confirm(`Ви впевнені, що хочете видалити запит на закупівлю/дефіцит для наряду № ${pr.order_num || '—'}?`)) {
      return
    }
    setIsProcessing(true)
    try {
      const items = pr.items || []
      const reservationReversals = []
      
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        const reservedQty = Number(it.reserved_from_stock) || 0
        if (reservedQty <= 0) continue
        
        const name = resolveItemName(it, i)
        const parsedName = parseMaterialName(name)
        
        const matchingItems = (inventory || []).filter(inv =>
          inv.warehouse === 'production' &&
          (
            (it.nomenclature_id && String(inv.nomenclature_id) === String(it.nomenclature_id)) ||
            (it.inventory_id && String(inv.id) === String(it.inventory_id)) ||
            normalize(inv.name) === normalize(parsedName) ||
            (inv.name && parsedName && normalize(inv.name).includes(normalize(parsedName)))
          )
        )
        
        if (matchingItems.length > 0) {
          const firstInv = matchingItems[0]
          reservationReversals.push(
            supabase.from('inventory').update({
              reserved_qty: Math.max(0, (Number(firstInv.reserved_qty) || 0) - reservedQty)
            }).eq('id', firstInv.id)
          )
        }
      }
      
      if (reservationReversals.length > 0) {
        await Promise.all(reservationReversals)
      }
      
      const queryKey = pr.task_id ? 'task_id' : 'order_id'
      const queryVal = pr.task_id || pr.order_id
      
      if (queryVal) {
        const { data: recDocs } = await supabase
          .from('reception_docs')
          .select('id, items, status, source_warehouse')
          .eq(queryKey, queryVal)
          .in('status', ['ordered', 'shipped'])
        
        if (recDocs && recDocs.length > 0) {
          const docIds = recDocs.map(d => d.id)
          const sourceReversals = []
          
          recDocs.forEach(d => {
            if (d.source_warehouse) {
              const docItems = d.items || []
              docItems.forEach(it => {
                const qty = Number(it.qty ?? it.quantity ?? it.reserved_from_stock ?? 0)
                if (qty <= 0) return
                
                const matching = (inventory || []).filter(inv =>
                  inv.warehouse === d.source_warehouse &&
                  (
                    (it.nomenclature_id && String(inv.nomenclature_id) === String(it.nomenclature_id)) ||
                    normalize(inv.name) === normalize(it.name)
                  )
                )
                if (matching.length > 0) {
                  const best = matching[0]
                  sourceReversals.push(
                    supabase.from('inventory').update({
                      reserved_qty: Math.max(0, (Number(best.reserved_qty) || 0) - qty)
                    }).eq('id', best.id)
                  )
                }
              })
            }
          })
          
          if (sourceReversals.length > 0) {
            await Promise.all(sourceReversals)
          }
          
          await supabase.from('reception_docs').delete().in('id', docIds)
        }
      }
      
      const { error } = await supabase.from('purchase_requests').delete().eq('id', pr.id)
      if (error) throw error
      
      alert('Запит на закупівлю успішно видалено з очищенням резервів та прийомок!')
      if (refreshTable) {
        refreshTable('purchase_requests')
        refreshTable('reception_docs')
        refreshTable('inventory')
      }
    } catch (err) {
      alert('Помилка видалення: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }, [inventory, supabase, normalize, refreshTable])

  const handleAcceptReceptionDoc = useCallback(async (doc, payload) => {
    if (!doc || processingDocs.has(doc.id)) return
    setProcessingDocs(prev => new Set(prev).add(doc.id))
    try {
      await confirmReception(doc.id, payload)
      setReceptionDocToAccept(null)
    } finally {
      setProcessingDocs(prev => {
        const next = new Set(prev)
        next.delete(doc.id)
        return next
      })
    }
  }, [processingDocs, confirmReception])

  return {
    inventory,
    nomenclatures,
    receptionDocs,
    purchaseRequests,
    currentUser,
    managers,
    requests,
    tasks,
    orders,
    sendDocToWarehouse,
    updatePurchaseRequestStatus,
    convertRequestToOrder,
    refreshTable,
    normalize,
    issueMaterialsBatch,
    supabase,
    activeTab,
    setActiveTab,
    requestSubTab,
    setRequestSubTab,
    showCreate,
    setShowCreate,
    draftItems,
    setDraftItems,
    selectedQty,
    setSelectedQty,
    searchQuery,
    setSearchQuery,
    stockFolder,
    setStockFolder,
    expandedDoc,
    setExpandedDoc,
    showReception,
    setShowReception,
    shortageModal,
    setShortageModal,
    receptionDocToAccept,
    setReceptionDocToAccept,
    isProcessing,
    processingDocs,
    setProcessingDocs,
    targetWarehouse,
    setTargetWarehouse,
    expandedPRs,
    setExpandedPRs,
    pocketOwner,
    setPocketOwner,
    isScanning,
    setIsScanning,
    manualCardInput,
    setManualCardInput,
    qrNomSearch,
    setQrNomSearch,
    editingQrNomId,
    setEditingQrNomId,
    editingQrCodeValue,
    setEditingQrCodeValue,
    savingQr,
    selectedQrNomIds,
    setSelectedQrNomIds,
    reserveAnalysisItem,
    setReserveAnalysisItem,
    editingInvId,
    setEditingInvId,
    editingInvTotal,
    setEditingInvTotal,
    editingInvReserved,
    setEditingInvReserved,
    savingInv,
    itemToDelete,
    setItemToDelete,
    isDeleting,
    isSuperAdmin,
    isAdmin,
    handleDeleteInventoryItem,
    confirmDeleteInventoryItem,
    handleSaveInventoryQty,
    pendingRequests,
    prepRequests,
    groupedPrepRequests,
    incomingReceptionCount,
    availableNoms,
    stockRows,
    filteredStock,
    isDocAvailable,
    handleQRScan,
    handleSaveQrCode,
    handleDeleteQrCode,
    addToDraft,
    handleSendToWarehouse,
    handleForwardToProcurement,
    handleRequestPrepMaterialsFromProcurement,
    handleManualShortagePR,
    confirmForwardToProcurement,
    handleDeletePrepRequestGroup,
    handleDeletePurchaseRequest,
    handleAcceptReceptionDoc
  }
}
