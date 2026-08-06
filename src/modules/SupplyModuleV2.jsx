import React, { useState, useMemo, useEffect } from 'react'
import {
  Truck,
  ArrowLeft,
  Package,
  Plus,
  X,
  History,
  AlertTriangle,
  Send,
  Warehouse,
  CheckCircle,
  Pencil,
  Check,
  Trash2,
  QrCode,
  Printer
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'
import { supabase } from '../supabase'
import { ScannerPanel } from './Warehouse/components/ScannerPanel'
import { ReceptionAcceptanceModal } from './Warehouse/components/ReceptionAcceptanceModal'

const getQR = (nom) => {
  if (!nom || !nom.additional_info) return ''
  const match = nom.additional_info.match(/\[QR:\s*([^\]]+)\]/)
  return match ? match[1].trim() : ''
}

const setQR = (nom, code) => {
  if (!nom) return ''
  let info = nom.additional_info || ''
  const qrPattern = /\[QR:\s*([^\]]*)\]/
  if (qrPattern.test(info)) {
    info = info.replace(qrPattern, code ? `[QR: ${code}]` : '')
  } else if (code) {
    info = (info + ` [QR: ${code}]`).trim()
  }
  return info
}

const SupplyModule = ({ isProcurementOnly = false }) => {
  const {
    inventory, nomenclatures, receptionDocs, createReceptionDoc, sendDocToWarehouse,
    purchaseRequests, updatePurchaseRequestStatus, convertRequestToOrder, currentUser,
    confirmReception, fetchData, refreshTable, normalize, requests, issueMaterialsBatch, tasks,
    managers
  } = useMES()

  useEffect(() => {
    if (typeof fetchData === 'function') {
      const targets = ['inventory', 'nomenclatures', 'reception_docs', 'purchase_requests']
      if (!isProcurementOnly) targets.push('material_requests', 'tasks')
      fetchData(targets)
    }
  }, [isProcurementOnly])

  const [activeTab, setActiveTab] = useState('requests') // 'requests', 'registry', 'stock'
  const [requestSubTab, setRequestSubTab] = useState('all') // 'all', 'prep', 'deficit'
  const [activeMobileSection, setActiveMobileSection] = useState('requests')
  const [showCreate, setShowCreate] = useState(false)
  const [draftItems, setDraftItems] = useState([])
  const [selectedQty, setSelectedQty] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedDoc, setExpandedDoc] = useState(null)
  const [showReception, setShowReception] = useState(false)
  const [shortageModal, setShortageModal] = useState(null)
  const [receptionDocToAccept, setReceptionDocToAccept] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingDocs, setProcessingDocs] = useState(new Set())
  const [targetWarehouse, setTargetWarehouse] = useState('') // explicit choice required: operational=СО, production=СВ, pocket=кишеня
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

  // Super admin inventory editing state
  const [editingInvId, setEditingInvId] = useState(null)
  const [editingInvTotal, setEditingInvTotal] = useState('')
  const [editingInvReserved, setEditingInvReserved] = useState('')
  const [savingInv, setSavingInv] = useState(false)


  const parseMaterialName = (details) => {
    if (!details) return ''
    if (details.includes('ВИТРАТНІ МАТЕРІАЛИ')) {
      const match = details.match(/:\s*(.+)\s*—/)
      return match ? match[1].trim() : details
    }
    return details.split(': ')[1]?.split(' — ')[0]?.trim() || details
  }

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

  const pendingRequests = (purchaseRequests || []).filter(pr => {
    // Всі замовлення (і для СВ, і для виробництва) мають бути видимі у відділі Постачання
    const isRelevantStatus = (pr.status === 'pending' || pr.status === 'accepted' || pr.status === 'ordered')
    if (isProcurementOnly) return isRelevantStatus && pr.destination_warehouse === 'procurement'
    return isRelevantStatus && (pr.destination_warehouse === 'production' || !pr.destination_warehouse)
  })

  // Запити від Відділу Підготовки (Непідготовлений карбон та дозабезпечення браку)
  const prepRequests = (requests || []).filter(r => {
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

  const groupedPrepRequests = useMemo(() => {
    const groups = {}
    prepRequests.forEach(req => {
      const taskId = req.task_id || 'no-task'
      if (!groups[taskId]) {
        groups[taskId] = {
          taskId,
          requests: [],
          created_at: req.created_at || new Date().toISOString()
        }
      }
      groups[taskId].requests.push(req)
    })
    return Object.values(groups).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [prepRequests])

  // Badge for new reception docs
  const incomingReceptionCount = (receptionDocs || []).filter(d => 
    (d.status === 'shipped' || d.status === 'ordered') && 
    (isProcurementOnly ? false : (!d.target_warehouse || d.target_warehouse === 'production'))
  ).length
  
  const availableNoms = (nomenclatures || []).filter(n => n.type !== 'part' && n.type !== 'product' && n.type !== 'finished')

  const stockRows = useMemo(() => {
    const targetWarehouse = isProcurementOnly ? 'procurement' : 'production'
    const isSheet = item => /^лист(?:\s|$)/i.test(String(item?.name || '').trim())
    const isUnpreparedSheet = item => String(item?.name || '').toLowerCase().includes('[непідготовлений]')
    const warehouseRows = (inventory || []).filter(item =>
      item.type !== 'finished'
      && item.type !== 'product'
      && item.warehouse === targetWarehouse
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

  const isDocAvailable = (doc) => {
    if (!doc.items || doc.items.length === 0) return true
    
    // Розраховуємо "віртуальну броню" від інших документів, які очікують на СВ
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
  }

  const getDocDisplayId = (doc) => {
    if (doc.order_id === null && doc.task_id === null) {
      return `№РП-${String(doc.id).substring(0, 6).toUpperCase()}`
    }
    return `#${String(doc.id).substring(0, 6)}`
  }

  const getNomLabel = (n) => `${n.name}${n.material_type ? ` (${n.material_type})` : ''}`

  const getStatusLabel = (status) => {
    const map = {
      'pending': 'ОЧІКУЄ',
      'accepted': 'ПРИЙНЯТО',
      'ordered': 'ЗАМОВЛЕНО',
      'completed': 'ВИКОНАНО',
      'shipped': 'ВІДПРАВЛЕНО',
      'in-progress': 'В РОБОТІ'
    }
    return map[status] || (status || '').toUpperCase()
  }

  const handleQRScan = (scannedCode) => {
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
  }

  const handleSaveQrCode = async (nomId, qrCodeVal) => {
    const nom = (nomenclatures || []).find(n => n.id === nomId)
    if (!nom) return
    const updatedInfo = setQR(nom, qrCodeVal.trim())
    setSavingQr(true)
    try {
      const { error } = await supabase
        .from('nomenclatures')
        .update({
          additional_info: updatedInfo
        })
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
  }

  const handleDeleteQrCode = async (nom) => {
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
  }

  const addToDraft = () => {
    if (!searchQuery || !selectedQty) return
    const nom = availableNoms.find(n => getNomLabel(n) === searchQuery)
    if (!nom) { alert('Оберіть товар зі списку!'); return }
    setDraftItems([...draftItems, { nomenclature_id: nom.id, name: getNomLabel(nom), qty: selectedQty }])
    setSearchQuery('')
    setSelectedQty('')
  }

  const handleSendToWarehouse = async () => {
    if (draftItems.length === 0 || isProcessing) return
    if (!targetWarehouse) {
      alert('Оберіть пункт призначення поставки: СО, СВ або Кишеня Майстра.')
      return
    }
    if (targetWarehouse === 'pocket' && !pocketOwner) {
      alert('Оберіть майстра для кишені.')
      return
    }
    
    // Перевірка наявності на Складі Виробництва (СВ)
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

      // Резервуємо на СВ (production) тільки якщо відправляємо з СВ
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
      setActiveMobileSection('registry')
      alert(`Готово! Поставку успішно відправлено на ${whLabel}.`)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleForwardToProcurement = async (pr) => {
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
      const usedInThisDoc = {} // invId -> qty

      for (const it of aggregated) {
        // Шукаємо ТІЛЬКИ на Складі Виробництва (SV)
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
        
        // Для агрегації в рамках одного документа використаємо перший знайдений ID як ключ (або ім'я)
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
            name: it.name // Додаємо ім'я для відображення
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
  }

  const handleRequestPrepMaterialsFromProcurement = async (group) => {
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
  }
  
  const handleManualShortagePR = async () => {
    if (!shortageModal || isProcessing) return
    setIsProcessing(true)
    const { deficitItems, draftItems } = shortageModal
    
    try {
      const orderNum = `№РП-${new Date().getTime().toString().slice(-6)}`
      
      // 1. Запит на закупівлю лише для дефіциту
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

      // 2. Резервуємо та створюємо прийомку для того, що ВЖЕ Є в наявності
      const availableItemsToReserve = deficitItems
        .filter(i => i.available > 0)
        .map(i => ({ nomenclature_id: i.nomenclature_id, name: i.name, qty: i.available }))
      
      // Також додаємо товари з чернетки, яких взагалі немає в списку дефіциту (вони повністю в наявності)
      const fullyAvailableItems = draftItems
        .filter(d => !deficitItems.some(di => di.nomenclature_id === d.nomenclature_id || di.name === d.name))
        .map(d => ({ nomenclature_id: d.nomenclature_id, name: d.name, qty: d.qty }))
      
      const allToReserve = [...availableItemsToReserve, ...fullyAvailableItems]
      
      if (allToReserve.length > 0) {
        // Резервуємо в БД
        // Removed 
        // Створюємо прийомку (статус ordered — очікує передачі на СО)
        // Додаємо reserved_from_stock: it.qty щоб система бачила, що ці товари вже зарезервовані саме під цей документ
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
  }

  const confirmForwardToProcurement = async () => {
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

      // 2. Бронюємо наявні частини на Складі Виробництва
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
            
            // Оновлюємо кількість заброньованого в самому запиті
            updatedItems[i] = { 
              ...it, 
              reserved_from_stock: (Number(it.reserved_from_stock) || 0) + canReserve 
            }
          }
        }
      }

      // Run inventory updates via a single upsert
      if (inventoryUpserts.length > 0) {
        const { error: upsertErr } = await supabase.from('inventory').upsert(inventoryUpserts)
        if (upsertErr) throw upsertErr
      }

      // Оновлюємо оригінальний запит, щоб він пам'ятав про бронювання
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
  }

  const isSuperAdmin = currentUser?.login === 'admin@workshop.local' || currentUser?.position === 'Адмін' || currentUser?.access_rights?.director

  const handleDeletePrepRequestGroup = async (group) => {
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
  }

  const handleDeletePurchaseRequest = async (pr) => {
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
  }

  // Resolve item name from any possible field structure
  const resolveItemName = (it, idx) => {
    // Case 1: directly has name
    if (it.name) return it.name
    // Case 2: has nomenclature_id - look it up
    if (it.nomenclature_id) {
      const nom = (nomenclatures || []).find(n => n.id === it.nomenclature_id)
      if (nom) return getNomLabel(nom)
    }
    // Case 3: text field from warehouse shortage flow
    return it.reqDetails || it.details || `Позиція ${idx + 1}`
  }

  // Resolve quantity from any possible field
  const resolveItemQty = (it) => {
    const val = it.qty ?? it.needed ?? it.missingAmount ?? it.quantity
    return val !== undefined && val !== null ? val : '—'
  }

  const handleAcceptReceptionDoc = async (doc, payload) => {
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
  }

  return (
    <div className="supply-module-v2" style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <nav className="module-nav" style={{ flexShrink: 0, padding: '15px 25px', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #222' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link to="/" className="back-link" style={{ color: '#555', transition: '0.3s' }}><ArrowLeft size={18} /></Link>
          <div className="module-title-group" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <Truck className="text-secondary" size={24} style={{ color: '#ff9000' }} />
            <h1 className="hide-mobile" style={{ margin: 0, fontSize: '1.2rem', fontWeight: 950, letterSpacing: '-0.02em' }}>{isProcurementOnly ? 'Постачання' : 'Склад Виробництва'}</h1>
            <h1 className="mobile-only" style={{ margin: 0, fontSize: '1rem', fontWeight: 950 }}>{isProcurementOnly ? 'ПОСТАЧАННЯ' : 'СКЛАД ВИРОБНИЦТВА'}</h1>
          </div>
          {!isProcurementOnly && (
            <button
              onClick={() => setShowReception(!showReception)}
              style={{
                background: showReception 
                  ? 'linear-gradient(135deg, #0ea5e9, #0284c7)' 
                  : (incomingReceptionCount > 0 ? 'rgba(14, 165, 233, 0.2)' : 'rgba(14, 165, 233, 0.08)'),
                color: showReception ? '#000' : '#0ea5e9',
                border: showReception ? 'none' : '1px solid rgba(14, 165, 233, 0.4)',
                padding: '10px 20px',
                borderRadius: '12px',
                fontSize: '0.8rem',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                position: 'relative',
                boxShadow: incomingReceptionCount > 0 ? '0 0 15px rgba(14, 165, 233, 0.4)' : 'none',
                animation: incomingReceptionCount > 0 ? 'pulse-blue 2s infinite' : 'none',
                transition: 'all 0.2s'
              }}
            >
              <Truck size={16} /> <span>ПРИЙОМКА</span>
              {incomingReceptionCount > 0 && (
                <span className="badge-count anim-pulse">
                  {incomingReceptionCount}
                </span>
              )}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div className="hide-mobile" style={{ color: '#555', fontSize: '0.75rem', fontWeight: 600 }}>
             {currentUser?.first_name} {currentUser?.last_name}
          </div>
          {!showCreate && (
            <button
              onClick={() => {
                setTargetWarehouse('')
                setPocketOwner('')
                setShowCreate(true)
              }}
              className="hide-mobile"
              style={{ background: '#ff9000', color: '#000', border: 'none', padding: '10px 22px', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}
            >
              <Plus size={20} /> НОВА ПОСТАВКА
            </button>
          )}
        </div>
      </nav>

      <div className="module-content" style={{ padding: '25px', overflowY: 'auto', flex: 1 }}>
        
        {/* RECEPTION ALERT BANNER */}
        {!isProcurementOnly && incomingReceptionCount > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.15), rgba(2, 132, 199, 0.05))',
            border: '1px solid rgba(14, 165, 233, 0.3)',
            borderRadius: '20px',
            padding: '15px 25px',
            marginBottom: '25px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 4px 20px rgba(14, 165, 233, 0.15)',
            animation: 'pulse-blue 2s infinite',
            flexWrap: 'wrap',
            gap: '15px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ background: '#0ea5e9', padding: '12px', borderRadius: '14px', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Truck size={22} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#fff' }}>
                  У ВАС Є НОВІ ПОСТАВКИ ДЛЯ ПРИЙОМКИ НА СВ!
                </h4>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#888' }}>
                  Очікує підтвердження: <strong style={{ color: '#0ea5e9' }}>{incomingReceptionCount}</strong> документ(ів)
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowReception(true)}
              style={{
                background: '#0ea5e9',
                color: '#000',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '12px',
                fontWeight: 900,
                fontSize: '0.8rem',
                cursor: 'pointer',
                textTransform: 'uppercase',
                boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)',
                transition: '0.2s',
                letterSpacing: '0.05em'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
            >
              Відкрити прийомку
            </button>
          </div>
        )}
        
        {/* RECEPTION DRAWER */}
        {!isProcurementOnly && showReception && (
          <div className="content-card glass-panel" style={{ background: '#111', border: '1px solid #333', borderRadius: '24px', padding: '25px', marginBottom: '30px' }}>
            <h3 style={{ fontSize: '0.85rem', color: '#3b82f6', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Truck size={18} /> ОЧІКУЮТЬ ПРИЙОМКИ НА СВ
            </h3>
            <div style={{ display: 'flex', gap: '20px', overflowX: 'auto', paddingBottom: '10px' }}>
              {(receptionDocs || [])
                .filter(d => (d.status === 'shipped' || d.status === 'ordered') && (!d.target_warehouse || d.target_warehouse === 'production'))
                .map(doc => (
                  <div key={doc.id} style={{ minWidth: '350px', background: '#0a0a0a', border: '1px solid #222', padding: '20px', borderRadius: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                      <span style={{ fontSize: '0.8rem', color: '#555' }}>Документ #{doc.id.slice(0, 8)}</span>
                      <button 
                        disabled={processingDocs.has(doc.id)}
                        onClick={() => setReceptionDocToAccept(doc)}
                        style={{ background: '#10b981', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 900, opacity: processingDocs.has(doc.id) ? 0.5 : 1, cursor: processingDocs.has(doc.id) ? 'not-allowed' : 'pointer' }}
                      >
                        {processingDocs.has(doc.id) ? 'ОБРОБКА...' : 'ПРИЙНЯТИ НА СКЛАД'}
                      </button>
                    </div>
                    <div style={{ fontSize: '0.85rem' }}>
                      {(doc.items || []).map((it, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                          <span style={{ color: '#aaa' }}>{resolveItemName(it, i)}</span>
                          <strong style={{ color: '#10b981' }}>{resolveItemQty(it)}</strong>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', borderTop: '1px solid #111', paddingTop: '10px' }}>
                      <button
                        type="button"
                        onClick={async () => {
                          if (window.confirm('Перенаправити прийомку на Склад Операційний (СО)?')) {
                            const { error } = await supabase.from('reception_docs').update({ target_warehouse: 'operational' }).eq('id', doc.id)
                            if (!error) refreshTable('reception_docs')
                          }
                        }}
                        style={{ background: 'rgba(255, 144, 0, 0.05)', border: '1px solid rgba(255, 144, 0, 0.3)', color: '#ff9000', padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s' }}
                      >
                        Перенаправити на СО
                      </button>
                    </div>
                  </div>
                ))}
              {(receptionDocs || []).filter(d => (d.status === 'shipped' || d.status === 'ordered') && (!d.target_warehouse || d.target_warehouse === 'production')).length === 0 && (
                <p style={{ color: '#444', fontSize: '0.8rem', padding: '20px' }}>Немає активних документів на прийомку для цього складу</p>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="supply-tabs" style={{ display: 'flex', background: '#111', padding: '5px', borderRadius: '14px', marginBottom: '25px', maxWidth: '700px', flexWrap: 'wrap', gap: '2px' }}>
          <button onClick={() => { setActiveTab('requests'); setActiveMobileSection('requests'); setShowCreate(false) }} className={`tab-btn-m ${activeTab === 'requests' && !showCreate ? 'active' : ''}`}>ЗАПИТИ ({pendingRequests.length})</button>
          <button onClick={() => { setActiveTab('registry'); setActiveMobileSection('registry'); setShowCreate(false) }} className={`tab-btn-m ${activeTab === 'registry' && !showCreate ? 'active' : ''}`}>РЕЄСТР</button>
          {!isProcurementOnly && <button onClick={() => { setActiveTab('stock'); setActiveMobileSection('stock'); setShowCreate(false) }} className={`tab-btn-m ${activeTab === 'stock' && !showCreate ? 'active' : ''}`}>ЗАЛИШКИ</button>}
          {isProcurementOnly && <button onClick={() => { setActiveTab('qrcodes'); setActiveMobileSection('qrcodes'); setShowCreate(false) }} className={`tab-btn-m ${activeTab === 'qrcodes' && !showCreate ? 'active' : ''}`}>QR-КОДИ</button>}
          <button onClick={() => { setShowCreate(true); setActiveMobileSection('create'); setActiveTab('create'); setTargetWarehouse(''); setPocketOwner('') }} className={`tab-btn-m ${showCreate ? 'active' : ''}`}>+ НОВИЙ</button>
        </div>

        <div className="supply-main-layout" style={{ display: 'grid', gridTemplateColumns: (showCreate || activeTab === 'stock' || activeTab === 'qrcodes') ? '1fr' : 'repeat(auto-fit, minmax(400px, 1fr))', gap: '30px' }}>

          {/* CREATE PANEL */}
          {(showCreate || activeMobileSection === 'create') && (
            <section style={{
              background: 'linear-gradient(145deg, #0d0d0d, #141414)',
              borderRadius: '24px',
              border: '1px solid #222',
              padding: '30px',
              maxWidth: '650px',
              margin: '0 auto',
              width: '100%',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              position: 'relative'
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px', alignItems: 'center', borderBottom: '1px solid #222', paddingBottom: '20px' }}>
                <div>
                  <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Truck size={22} style={{ color: '#ff9000' }} />
                    НОВА ПОСТАВКА
                  </h2>
                  <p style={{ color: '#666', fontSize: '0.8rem', margin: '6px 0 0' }}>
                    {isProcurementOnly 
                      ? 'Сформувати поставку на Склад Операційний (СО) або Склад Виробництва (СВ)' 
                      : 'Передати матеріали зі складу виробництва до свідомо обраного пункту призначення'}
                  </p>
                </div>
                <button onClick={() => { setShowCreate(false); setDraftItems([]); setTargetWarehouse(''); setPocketOwner(''); setActiveMobileSection('registry') }}
                  style={{ background: '#1c1c1c', border: '1px solid #2a2a2a', color: '#888', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.background='#ff9000'; e.currentTarget.style.color='#000' }}
                  onMouseLeave={e => { e.currentTarget.style.background='#1c1c1c'; e.currentTarget.style.color='#888' }}
                ><X size={18} /></button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Destination selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 900, color: '#555', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Пункт призначення</label>
                  {!targetWarehouse && (
                    <div style={{ color: '#f59e0b', fontSize: '0.72rem', fontWeight: 800, marginBottom: '8px' }}>
                      Оберіть пункт призначення вручну
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                    {[
                      { id: 'operational', label: 'СО', desc: 'Склад Операційний', color: '#10b981', icon: '🏭' },
                      isProcurementOnly && { id: 'production', label: 'СВ', desc: 'Склад Виробництва', color: '#3b82f6', icon: '⚙️' },
                      { id: 'pocket', label: 'Кишеня Майстра', desc: 'Кишеня Майстра', color: '#f59e0b', icon: '💼' }
                    ].filter(Boolean).map(wh => {
                      const active = targetWarehouse === wh.id
                      return (
                        <button
                          key={wh.id}
                          type="button"
                          onClick={() => setTargetWarehouse(wh.id)}
                          style={{
                            background: active ? `${wh.color}15` : '#0d0d0d',
                            border: `1px solid ${active ? wh.color : '#222'}`,
                            borderRadius: '12px',
                            padding: '12px 15px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: '0.2s'
                          }}
                        >
                          <span style={{ fontSize: '1.2rem' }}>{wh.icon}</span>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.85rem', color: active ? wh.color : '#fff' }}>{wh.label}</div>
                            <div style={{ fontSize: '0.65rem', color: '#555' }}>{wh.desc}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Pocket Master Owner Selector */}
                {targetWarehouse === 'pocket' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 900, color: '#555', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Оберіть майстра</label>
                    <select
                      value={pocketOwner}
                      onChange={e => setPocketOwner(e.target.value)}
                      style={{ width: '100%', background: '#0a0a0a', border: '1px solid #222', color: '#fff', padding: '12px 15px', borderRadius: '10px', fontSize: '0.9rem', outline: 'none' }}
                      required
                    >
                      <option value="">-- Оберіть майстра --</option>
                      {(managers || []).filter(m => m.toLowerCase().includes('майстер')).map((m, idx) => (
                        <option key={idx} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Add Item inputs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 50px', gap: '10px' }} className="mobile-stack">
                  <div style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 900, color: '#555', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Номенклатура</label>
                      <button
                        type="button"
                        onClick={() => setIsScanning(true)}
                        style={{ background: 'transparent', border: 'none', color: '#ff9000', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', fontWeight: 900, padding: 0 }}
                      >
                        <QrCode size={12} /> СКАНУВАТИ QR
                      </button>
                    </div>
                    <input
                      list="noms-list"
                      style={{ width: '100%', background: '#0a0a0a', border: '1px solid #222', color: '#fff', padding: '12px 15px', borderRadius: '10px', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                      placeholder="Оберіть товар..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                    <datalist id="noms-list">
                      {availableNoms.map(n => <option key={n.id} value={getNomLabel(n)} />)}
                    </datalist>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 900, color: '#555', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Кількість</label>
                    <input
                      type="number"
                      style={{ width: '100%', background: '#0a0a0a', border: '1px solid #222', color: '#fff', padding: '12px 15px', borderRadius: '10px', fontSize: '0.9rem', outline: 'none', textAlign: 'center', boxSizing: 'border-box' }}
                      placeholder="0"
                      value={selectedQty}
                      onChange={e => setSelectedQty(e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button type="button" onClick={addToDraft} style={{ height: '42px', width: '50px', background: '#ff9000', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={20} /></button>
                  </div>
                </div>

                {/* Draft list */}
                <div style={{ background: '#070707', borderRadius: '14px', border: '1px solid #1a1a1a', padding: '15px' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#444', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>СПИСОК ПОСТАВКИ ({draftItems.length})</div>
                  {draftItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '25px 0', color: '#333' }}>
                      <Package size={28} style={{ marginBottom: '8px', opacity: 0.1, display: 'inline-block' }} />
                      <p style={{ fontSize: '0.75rem', margin: 0 }}>Немає доданих товарів</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                      {draftItems.map((it, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#0d0d0d', borderRadius: '8px', border: '1px solid #222' }}>
                          <span style={{ fontSize: '0.8rem', color: '#ddd' }}>{it.name}</span>
                          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                            <input
                              type="number"
                              value={it.qty}
                              onChange={e => {
                                const val = e.target.value
                                const updated = [...draftItems]
                                updated[idx].qty = val
                                setDraftItems(updated)
                              }}
                              style={{ width: '85px', background: '#000', border: '1px solid #333', color: '#ff9000', textAlign: 'center', borderRadius: '8px', padding: '6px 10px', fontSize: '0.85rem', fontWeight: 900, outline: 'none' }}
                            />
                            <button onClick={() => setDraftItems(draftItems.filter((_, i) => i !== idx))} style={{ color: '#555', border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px' }}><X size={14} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Submit button */}
                {draftItems.length > 0 && (() => {
                  const sendDisabled = isProcessing || !targetWarehouse || (targetWarehouse === 'pocket' && !pocketOwner)
                  const targetLabel = targetWarehouse === 'operational'
                    ? 'СО'
                    : (targetWarehouse === 'production' ? 'СВ' : 'КИШЕНЮ')

                  return (
                    <button
                      disabled={sendDisabled}
                      onClick={handleSendToWarehouse}
                      style={{
                        width: '100%',
                        padding: '14px',
                        background: sendDisabled
                          ? '#222'
                          : (targetWarehouse === 'production'
                              ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
                              : (targetWarehouse === 'pocket'
                                  ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                                  : 'linear-gradient(135deg, #10b981, #047857)')),
                        color: sendDisabled ? '#666' : '#fff',
                        border: 'none',
                        borderRadius: '12px',
                        fontWeight: 900,
                        cursor: sendDisabled ? 'not-allowed' : 'pointer',
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        marginTop: '5px',
                        opacity: isProcessing ? 0.7 : 1,
                        transition: '0.2s'
                      }}>
                      <Send size={16} />
                      {isProcessing
                        ? 'ОБРОБКА...'
                        : (!targetWarehouse
                            ? 'ОБЕРІТЬ ПУНКТ ПРИЗНАЧЕННЯ'
                            : (targetWarehouse === 'pocket' && !pocketOwner
                                ? 'ОБЕРІТЬ МАЙСТРА'
                                : `ВІДПРАВИТИ НА ${targetLabel}`))}
                    </button>
                  )
                })()}
              </div>
            </section>
          )}

          {/* REQUESTS COLUMN */}
          {!showCreate && (activeTab === 'requests') && (
            <section className="requests-col" style={{ gridColumn: '1 / -1', width: '100%' }}>
              {/* SUB TABS FOR MOBILE / TABLET OR QUICK FILTERING */}
              {!isProcurementOnly && (
                <div style={{
                  display: 'flex',
                  background: '#161616',
                  padding: '4px',
                  borderRadius: '12px',
                  marginBottom: '25px',
                  maxWidth: '500px',
                  gap: '4px',
                  border: '1px solid #222'
                }}>
                  {[
                    { id: 'all', label: 'Всі запити', count: groupedPrepRequests.length + pendingRequests.length },
                    { id: 'prep', label: 'Підготовка', count: groupedPrepRequests.length, color: '#10b981' },
                    { id: 'deficit', label: 'Наряди', count: pendingRequests.length, color: '#ef4444' }
                  ].map(t => {
                    const active = requestSubTab === t.id
                    return (
                      <button
                        key={t.id}
                        onClick={() => setRequestSubTab(t.id)}
                        style={{
                          flex: 1,
                          background: active ? '#222' : 'transparent',
                          border: 'none',
                          color: active ? (t.color || '#fff') : '#888',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          fontSize: '0.8rem',
                          fontWeight: active ? 900 : 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'all 0.2s'
                        }}
                      >
                        <span>{t.label}</span>
                        <span style={{
                          background: active ? (t.color ? `${t.color}20` : '#333') : '#1e1e1e',
                          color: active ? (t.color || '#fff') : '#555',
                          padding: '2px 6px',
                          borderRadius: '6px',
                          fontSize: '0.7rem',
                          fontWeight: 900
                        }}>
                          {t.count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              <div style={{
                display: 'grid',
                gridTemplateColumns: (isProcurementOnly || requestSubTab !== 'all') ? '1fr' : 'repeat(auto-fit, minmax(420px, 1fr))',
                gap: '30px',
                width: '100%',
                alignItems: 'start'
              }}>
                {/* COLUMN 1: PREPARATION REQUESTS */}
                {!isProcurementOnly && (requestSubTab === 'all' || requestSubTab === 'prep') && (
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.02)',
                    border: '1px solid rgba(16, 185, 129, 0.15)',
                    borderRadius: '24px',
                    padding: '20px',
                    minHeight: '400px'
                  }}>
                    <h3 style={{ fontSize: '0.95rem', color: '#10b981', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      <Package size={18} /> ЗАПИТИ НА ПІДГОТОВКУ ({groupedPrepRequests.length})
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      {groupedPrepRequests.map(group => {
                        const task = (tasks || []).find(t => t.id === group.taskId)
                        const prepNum = task?.plan_snapshot?._prep_num || `НП-${String(group.taskId).slice(0, 8)}`

                        const isEnough = group.requests.every(req => {
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
                          return available >= qty
                        })

                        const hasActivePRForProcurement = (purchaseRequests || []).some(
                          r => String(r.task_id) === String(group.taskId) && 
                          r.destination_warehouse === 'procurement' && 
                          (r.status === 'pending' || r.status === 'accepted' || r.status === 'ordered')
                        )

                        return (
                          <div key={group.taskId} style={{ background: '#0a0a0a', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '20px', borderRadius: '18px', display: 'flex', flexDirection: 'column', gap: '15px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1c1c1c', paddingBottom: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <strong style={{ fontSize: '1rem', color: '#10b981' }}>НАРЯД № {prepNum}</strong>
                                {isSuperAdmin && (
                                  <button
                                    onClick={() => handleDeletePrepRequestGroup(group)}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      color: '#ef4444',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      padding: '2px',
                                      borderRadius: '4px',
                                      transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    title="Видалити запит"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                              <span style={{ fontSize: '0.7rem', color: '#888', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 8px', borderRadius: '6px', fontWeight: 800 }}>
                                ПІДГОТОВКА СИРОВИНИ
                              </span>
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {group.requests.map(req => {
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
                                
                                const itemEnough = available >= qty

                                return (
                                  <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111', padding: '10px 12px', borderRadius: '10px', border: '1px solid #222' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#eee' }}>{reqName}</span>
                                    <div style={{ textTransform: 'uppercase', fontSize: '0.7rem', color: itemEnough ? '#10b981' : '#ef4444', fontWeight: 800, textAlign: 'right' }}>
                                      Потрібно: {qty} шт | Наявні: {available} шт
                                    </div>
                                  </div>
                                )
                              })}
                            </div>

                            {isEnough ? (
                              <button 
                                disabled={processingDocs.has(group.taskId)}
                                onClick={async () => {
                                  setProcessingDocs(prev => new Set(prev).add(group.taskId))
                                  try {
                                    const reqIds = group.requests.map(r => r.id)
                                    await issueMaterialsBatch(reqIds, group.taskId)
                                    alert('Матеріали успішно видано на Підготовку!')
                                  } catch(e) {
                                    alert('Помилка: ' + e.message)
                                  } finally {
                                    setProcessingDocs(prev => { const next = new Set(prev); next.delete(group.taskId); return next; })
                                  }
                                }}
                                style={{
                                  background: '#10b981',
                                  color: '#000',
                                  border: 'none',
                                  padding: '10px 18px',
                                  borderRadius: '10px',
                                  fontWeight: 900,
                                  cursor: processingDocs.has(group.taskId) ? 'not-allowed' : 'pointer',
                                  fontSize: '0.8rem',
                                  textTransform: 'uppercase',
                                  alignSelf: 'flex-end',
                                  marginTop: '5px'
                                }}
                              >
                                {processingDocs.has(group.taskId) ? 'ОБРОБКА...' : 'ВИДАТИ НА ПІДГОТОВКУ'}
                              </button>
                            ) : (
                              <button 
                                disabled={hasActivePRForProcurement || processingDocs.has(group.taskId)}
                                onClick={() => handleRequestPrepMaterialsFromProcurement(group)}
                                style={{
                                  background: hasActivePRForProcurement ? '#1a1a1a' : '#ef4444',
                                  color: hasActivePRForProcurement ? '#444' : '#fff',
                                  border: hasActivePRForProcurement ? '1px solid #222' : 'none',
                                  padding: '10px 18px',
                                  borderRadius: '10px',
                                  fontWeight: 950,
                                  cursor: (hasActivePRForProcurement || processingDocs.has(group.taskId)) ? 'not-allowed' : 'pointer',
                                  fontSize: '0.8rem',
                                  textTransform: 'uppercase',
                                  alignSelf: 'flex-end',
                                  marginTop: '5px',
                                  opacity: (hasActivePRForProcurement || processingDocs.has(group.taskId)) ? 0.5 : 1
                                }}
                              >
                                {processingDocs.has(group.taskId) ? 'ОБРОБКА...' : (hasActivePRForProcurement ? 'ОЧІКУЄ ЗАКУПІВЛІ' : 'ЗАПРОСИТИ У ПОСТАЧАННЯ')}
                              </button>
                            )}
                          </div>
                        )
                      })}
                      {groupedPrepRequests.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#444', fontSize: '0.85rem', background: '#0a0a0a', border: '1px dashed #222', borderRadius: '18px' }}>
                          Немає активних запитів від відділу підготовки
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* COLUMN 2: DEFICIT AND WORK ORDER REQUESTS */}
                {(requestSubTab === 'all' || requestSubTab === 'deficit') && (
                  <div style={{
                  background: 'rgba(239, 68, 68, 0.01)',
                  border: '1px solid rgba(239, 68, 68, 0.1)',
                  borderRadius: '24px',
                  padding: '20px',
                  minHeight: '400px'
                }}>
                  <h3 style={{ fontSize: '0.95rem', color: '#888', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <AlertTriangle size={18} className="text-secondary" /> ДЕФІЦИТ ТА ЗАПИТИ НА НАРИДИ ({pendingRequests.length})
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {pendingRequests.map(pr => {
                      const hasDeficit = (pr.items || []).some(it => {
                        const name = resolveItemName(it, 0)
                        const parsedName = parseMaterialName(name)
                        const matchingItems = (inventory || []).filter(i =>
                          i.warehouse === 'production' &&
                          (
                            (it.nomenclature_id && String(i.nomenclature_id) === String(it.nomenclature_id)) ||
                            (it.inventory_id && String(i.id) === String(it.inventory_id)) ||
                            (normalize(i.name) === normalize(parsedName))
                          )
                        )
                        const globalAvailable = matchingItems.reduce((acc, i) => acc + (Number(i.total_qty) || 0) - (Number(i.reserved_qty) || 0), 0)
                        const alreadyReserved = Number(it.reserved_from_stock) || 0
                        const effectiveAvailable = globalAvailable + alreadyReserved
                        return effectiveAvailable < Number(resolveItemQty(it))
                      })

                      const currentTaskId = pr.task_id || `order-${pr.order_id}`
                      const hasActivePRForProcurement = (purchaseRequests || []).some(
                        r => (r.task_id ? String(r.task_id) === String(currentTaskId) : String(r.order_id) === String(pr.order_id)) && 
                        r.destination_warehouse === 'procurement' && 
                        (r.status === 'pending' || r.status === 'accepted' || r.status === 'ordered')
                      )

                      const relatedReception = (receptionDocs || []).find(rd => 
                        (rd.task_id ? String(rd.task_id) === String(currentTaskId) : String(rd.order_id) === String(pr.order_id)) && 
                        (rd.status === 'ordered' || rd.status === 'shipped')
                      )

                      const isExpanded = expandedPRs.has(pr.id) || (!expandedPRs.has(`collapsed-${pr.id}`) && pr.status !== 'ordered' && !relatedReception)

                      return (
                        <div key={pr.id} className="request-card" style={{ background: '#0a0a0a', padding: '20px', borderRadius: '18px', border: '1px solid #222', borderLeft: pr.status === 'accepted' ? '4px solid #3b82f6' : '4px solid #ef4444', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                              <strong style={pr.status === 'accepted' ? { color: '#3b82f6', fontSize: '0.95rem' } : { color: '#ef4444', fontSize: '0.95rem' }}>
                                НАРЯД #{pr.order_num}
                              </strong>
                              {isSuperAdmin && (
                                <button
                                  onClick={() => handleDeletePurchaseRequest(pr)}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#ef4444',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '2px',
                                    borderRadius: '4px',
                                    transition: 'background 0.2s'
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                  title="Видалити запит"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                              {relatedReception && (
                                <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase' }}>
                                  Відправлено на {relatedReception.target_warehouse === 'operational' ? 'СО' : 'СВ'}
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              {pr.status === 'pending' && isProcurementOnly && (
                                <button 
                                  disabled={processingDocs.has(pr.id)}
                                  onClick={async () => {
                                    setProcessingDocs(prev => new Set(prev).add(pr.id))
                                    try {
                                      await updatePurchaseRequestStatus(pr.id, 'accepted', 'procurement')
                                    } finally {
                                      setProcessingDocs(prev => { const next = new Set(prev); next.delete(pr.id); return next; })
                                    }
                                  }} 
                                  style={{ 
                                    background: processingDocs.has(pr.id) ? '#1a1a1a' : '#3b82f6', 
                                    color: processingDocs.has(pr.id) ? '#444' : '#fff', 
                                    border: 'none', 
                                    padding: '6px 12px', 
                                    borderRadius: '8px', 
                                    fontSize: '0.7rem', 
                                    fontWeight: 900,
                                    cursor: processingDocs.has(pr.id) ? 'not-allowed' : 'pointer'
                                  }}
                                >
                                  {processingDocs.has(pr.id) ? 'ОБРОБКА...' : 'ПРИЙНЯТИ'}
                                </button>
                              )}
                              {(pr.status === 'accepted' || (pr.status === 'pending' && !isProcurementOnly)) && (
                                <button
                                  onClick={async () => {
                                    setProcessingDocs(prev => new Set(prev).add(pr.id))
                                    try {
                                      await apiService.submitConvertRequestToOrder(pr.id, convertRequestToOrder)
                                    } catch (err) {
                                      console.error('Transfer creation error:', err)
                                      alert('Не вдалося сформувати поставку на склад: ' + (err?.message || 'невідома помилка'))
                                    } finally {
                                      setProcessingDocs(prev => {
                                        const next = new Set(prev)
                                        next.delete(pr.id)
                                        return next
                                      })
                                    }
                                  }}
                                  disabled={(!isProcurementOnly && hasDeficit) || pr.status === 'ordered' || processingDocs.has(pr.id)}
                                  style={{ 
                                    background: ((!isProcurementOnly && hasDeficit) || pr.status === 'ordered' || processingDocs.has(pr.id)) ? '#1a1a1a' : '#3b82f622', 
                                    color: ((!isProcurementOnly && hasDeficit) || pr.status === 'ordered' || processingDocs.has(pr.id)) ? '#444' : '#3b82f6', 
                                    border: '1px solid #3b82f644', 
                                    padding: '6px 12px', 
                                    borderRadius: '8px', 
                                    fontSize: '0.7rem', 
                                    fontWeight: 900,
                                    cursor: ((!isProcurementOnly && hasDeficit) || pr.status === 'ordered' || processingDocs.has(pr.id)) ? 'not-allowed' : 'pointer',
                                    opacity: ((!isProcurementOnly && hasDeficit) || pr.status === 'ordered' || processingDocs.has(pr.id)) ? 0.5 : 1
                                  }}
                                >
                                  {processingDocs.has(pr.id) ? 'ОБРОБКА...' : (pr.status === 'ordered' ? 'ЗАМОВЛЕНО' : (isProcurementOnly ? 'СФОРМУВАТИ ПОСТАВКУ НА СВ' : 'СФОРМУВАТИ ПОСТАВКУ'))}
                                </button>
                              )}
                              {!isProcurementOnly && (pr.status === 'pending' || pr.status === 'accepted') && (
                                 <button 
                                   disabled={hasActivePRForProcurement || processingDocs.has(pr.id)}
                                   onClick={async (e) => {
                                     e.stopPropagation()
                                     if (hasDeficit && !hasActivePRForProcurement) {
                                       handleForwardToProcurement(pr)
                                     } else {
                                       setProcessingDocs(prev => new Set(prev).add(pr.id))
                                       try {
                                         await apiService.submitUpdatePurchaseRequestStatus(pr.id, 'accepted', updatePurchaseRequestStatus)
                                       } finally {
                                         setProcessingDocs(prev => { const next = new Set(prev); next.delete(pr.id); return next; })
                                       }
                                     }
                                   }}
                                   style={{ 
                                     background: (hasDeficit && !hasActivePRForProcurement) ? '#ef4444' : '#1a1a1a', 
                                     color: (hasDeficit && !hasActivePRForProcurement) ? '#fff' : '#444', 
                                     border: '1px solid #ef444444', 
                                     padding: '6px 12px', 
                                     borderRadius: '8px', 
                                     fontSize: '0.7rem',
                                     fontWeight: 950,
                                     cursor: (hasActivePRForProcurement || processingDocs.has(pr.id)) ? 'not-allowed' : 'pointer',
                                     opacity: (hasActivePRForProcurement || processingDocs.has(pr.id)) ? 0.5 : 1
                                   }}
                                 >
                                    {processingDocs.has(pr.id) ? 'ОБРОБКА...' : (hasActivePRForProcurement ? 'ОЧІКУЄ ЗАКУПІВЛІ' : 'ЗАКУПИТИ')}
                                 </button>
                              )}
                            </div>
                          </div>
                          <div 
                            onClick={() => {
                              const next = new Set(expandedPRs)
                              if (isExpanded) {
                                next.delete(pr.id)
                                next.add(`collapsed-${pr.id}`)
                              } else {
                                next.add(pr.id)
                                next.delete(`collapsed-${pr.id}`)
                              }
                              setExpandedPRs(next)
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: '15px 0 10px', fontSize: '0.75rem', color: '#555', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}
                          >
                            <span>Специфікація ({(pr.items || []).length} позицій)</span>
                            <span style={{ fontSize: '0.65rem', color: '#ff9000' }}>{isExpanded ? '▲ Приховати' : '▼ Показати список'}</span>
                          </div>

                          {isExpanded && (
                            <div style={{ fontSize: '0.85rem', color: '#888' }}>
                              {(() => {
                                const items = pr.items || []
                                const aggregated = []
                                
                                // Розраховуємо "віртуальну броню" для відображення
                                const otherManualDocs = (receptionDocs || []).filter(d => d.status === 'ordered' && d.source_warehouse === 'production')
                                const virtualReservedMap = {}
                                otherManualDocs.forEach(d => {
                                  (d.items || []).forEach(item => {
                                    const k = item.nomenclature_id ? String(item.nomenclature_id) : normalize(item.name || item.reqDetails || item.details)
                                    virtualReservedMap[k] = (virtualReservedMap[k] || 0) + (Number(item.qty || item.needed || item.quantity) || 0)
                                  })
                                })

                                items.forEach((it, idx) => {
                                  const name = resolveItemName(it, idx)
                                  const parsedName = parseMaterialName(name)
                                  const nomId = it.nomenclature_id
                                  
                                  const existing = aggregated.find(a => (a.nomenclature_id && a.nomenclature_id === nomId) || normalize(a.parsedName) === normalize(parsedName))
                                  if (existing) {
                                    existing.needed += Number(resolveItemQty(it)) || 0
                                  } else {
                                    const matchingItems = (inventory || []).filter(i =>
                                      (i.warehouse === 'production' || !i.warehouse) &&
                                      (
                                        (nomId && String(i.nomenclature_id) === String(nomId)) ||
                                        (normalize(i.name) === normalize(parsedName)) ||
                                        (i.name && parsedName && normalize(i.name).includes(normalize(parsedName))) ||
                                        (i.name && parsedName && normalize(parsedName).includes(normalize(i.name))) ||
                                        (it.inventory_id && String(i.id) === String(it.inventory_id))
                                      )
                                    )
                                    const totalStock = matchingItems.reduce((acc, i) => acc + (Number(i.total_qty) || 0), 0)
                                    const dbReserved = matchingItems.reduce((acc, i) => acc + (Number(i.reserved_qty) || 0), 0)
                                    const vKey = it.nomenclature_id ? String(it.nomenclature_id) : normalize(parsedName)
                                    const vReserved = virtualReservedMap[vKey] || 0
                                    
                                    const freeStock = Math.max(0, totalStock - dbReserved - vReserved)
                                    const alreadyReserved = Number(it.reserved_from_stock) || 0
                                    const available = freeStock + alreadyReserved
                                    aggregated.push({
                                      ...it,
                                      name,
                                      parsedName,
                                      available,
                                      needed: isProcurementOnly ? (Number(it.missingAmount || it.qty || it.needed) || 0) : (Number(resolveItemQty(it)) || 0)
                                    })
                                  }
                                })

                                return aggregated.map((it, idx) => {
                                  const isDeficit = !isProcurementOnly && (it.available < it.needed)
                                  return (
                                    <div key={idx} style={{ padding: '8px 0', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span style={{ color: isDeficit ? '#ef4444' : '#aaa' }}>{it.name}</span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {!isProcurementOnly && (
                                          <span style={{ fontSize: '0.65rem', color: isDeficit ? '#ef4444' : '#10b981', fontWeight: 800 }}>
                                            ({it.available} в наявності)
                                          </span>
                                        )}
                                        <strong style={{ color: isDeficit ? '#ef4444' : '#fff' }}>{it.needed}</strong>
                                      </div>
                                    </div>
                                  )
                                })
                              })()}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {pendingRequests.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#444', fontSize: '0.85rem', background: '#0a0a0a', border: '1px dashed #222', borderRadius: '18px' }}>
                        Активних дефіцитів не зафіксовано
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

          {/* REGISTRY COLUMN */}
          {!showCreate && (activeTab === 'registry') && (
            <section className="registry-col">
              <h3 style={{ fontSize: '0.85rem', color: '#555', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <History size={18} className="text-secondary" /> РЕЄСТР ПОСТАВОК
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(receptionDocs || [])
                  .filter(doc => {
                    if (isProcurementOnly) {
                      // Procurement sees everything related to supply/procurement chain
                      return doc.target_warehouse === 'production' || !doc.target_warehouse || doc.type === 'purchase'
                    } else {
                      // Production Warehouse sees what it received OR what it sent out
                      return doc.target_warehouse === 'production' || doc.source_warehouse === 'production' || doc.type === 'internal_transfer'
                    }
                  })
                  .map(doc => (
                  <div key={doc.id} className="doc-card" style={{ background: '#111', borderRadius: '20px', border: '1px solid #222', overflow: 'hidden' }}>
                    <div
                      onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
                      style={{ padding: '20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <div style={{ background: '#0a0a0a', padding: '12px', borderRadius: '12px', color: doc.status === 'completed' ? '#10b981' : '#ff9000' }}>
                          <Package size={20} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{getDocDisplayId(doc)}</div>
                          <div style={{ fontSize: '0.65rem', color: '#444' }}>{new Date(doc.created_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div className={`status-pill ${doc.status}`} style={{ fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', padding: '5px 10px', borderRadius: '20px' }}>
                        {getStatusLabel(doc.status)}
                      </div>
                    </div>

                    {expandedDoc === doc.id && (
                      <div style={{ padding: '20px', background: '#0a0a0a', borderTop: '1px solid #222' }}>
                        <div style={{ marginBottom: '15px' }}>
                          {(doc.items || []).map((it, idx) => {
                            const itemName = resolveItemName(it, idx)
                            const itemQty = resolveItemQty(it)
                            const expectedQty = it.expected_qty ?? it.qty ?? it.needed ?? it.missingAmount ?? it.quantity
                            const actualQty = it.actual_qty ?? it.accepted_qty
                            const discrepancyQty = Number(it.discrepancy_qty) || 0
                            const hasReceptionAudit = actualQty !== undefined || discrepancyQty !== 0
                            return (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '8px 0', borderBottom: '1px solid #111' }}>
                                <span style={{ fontSize: '0.8rem', color: '#888' }}>{itemName}</span>
                                {hasReceptionAudit ? (
                                  <div style={{ textAlign: 'right', fontSize: '0.72rem', color: '#777' }}>
                                    <div>Док: <strong style={{ color: '#fff' }}>{expectedQty}</strong> · Факт: <strong style={{ color: '#10b981' }}>{actualQty}</strong></div>
                                    {discrepancyQty !== 0 && (
                                      <div style={{ color: discrepancyQty < 0 ? '#ef4444' : '#f59e0b', fontWeight: 900 }}>
                                        Акт розбіжності: {discrepancyQty > 0 ? `+${discrepancyQty}` : discrepancyQty}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <strong style={{ fontSize: '0.8rem', color: '#fff' }}>{itemQty}</strong>
                                )}
                              </div>
                            )
                          })}
                        </div>

                        {doc.status !== 'completed' && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '15px', borderTop: '1px dashed #222', paddingTop: '15px', marginBottom: '15px' }}>
                            <span style={{ fontSize: '0.75rem', color: '#555', fontWeight: 800 }}>СКЛАД ПРИЗНАЧЕННЯ:</span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {[
                                { id: 'operational', label: 'СО (Операційний)' },
                                { id: 'production', label: 'СВ (Виробництва)' }
                              ].map(w => {
                                const active = (doc.target_warehouse || 'production') === w.id
                                return (
                                  <button
                                    key={w.id}
                                    type="button"
                                    disabled={processingDocs.has(doc.id)}
                                    onClick={async (e) => {
                                      e.stopPropagation()
                                      setProcessingDocs(prev => new Set(prev).add(doc.id))
                                      try {
                                        const { error } = await supabase
                                          .from('reception_docs')
                                          .update({ target_warehouse: w.id })
                                          .eq('id', doc.id)
                                        if (error) throw error
                                        refreshTable('reception_docs')
                                      } catch (err) {
                                        alert('Помилка оновлення складу: ' + err.message)
                                      } finally {
                                        setProcessingDocs(prev => { const next = new Set(prev); next.delete(doc.id); return next; })
                                      }
                                    }}
                                    style={{
                                      background: active ? 'rgba(255, 144, 0, 0.12)' : 'transparent',
                                      border: active ? '1px solid #ff9000' : '1px solid rgba(255,255,255,0.07)',
                                      color: active ? '#ff9000' : '#888',
                                      padding: '4px 10px',
                                      borderRadius: '6px',
                                      fontSize: '0.7rem',
                                      fontWeight: 800,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {w.label}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {doc.status === 'shipped' && !isProcurementOnly && (
                          <button
                            disabled={processingDocs.has(doc.id)}
                            onClick={(e) => {
                              e.stopPropagation()
                              setReceptionDocToAccept(doc)
                            }}
                            style={{ width: '100%', padding: '12px', background: '#10b981', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 900, fontSize: '0.75rem', cursor: processingDocs.has(doc.id) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', opacity: processingDocs.has(doc.id) ? 0.5 : 1 }}
                          >
                            <CheckCircle size={16} /> {processingDocs.has(doc.id) ? 'ПРИЙНЯТТЯ...' : 'ПРИЙНЯТИ НА СКЛАД'}
                          </button>
                        )}

                        {doc.status === 'ordered' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button
                              disabled={processingDocs.has(doc.id) || !isDocAvailable(doc)}
                              onClick={async (e) => {
                                e.stopPropagation()
                                setProcessingDocs(prev => new Set(prev).add(doc.id))
                                try {
                                  const newTarget = isProcurementOnly ? 'production' : 'operational'
                                  const newSource = isProcurementOnly ? null : 'production'
                                  await apiService.submitSendDocToWarehouse(doc.id, sendDocToWarehouse, newTarget, newSource)
                                } finally {
                                  setProcessingDocs(prev => { const next = new Set(prev); next.delete(doc.id); return next; })
                                }
                              }}
                              style={{ 
                                width: '100%', 
                                padding: '12px', 
                                background: isDocAvailable(doc) ? '#0ea5e9' : '#333', 
                                color: isDocAvailable(doc) ? '#fff' : '#666', 
                                border: 'none', 
                                borderRadius: '10px', 
                                fontWeight: 900, 
                                fontSize: '0.75rem', 
                                cursor: (processingDocs.has(doc.id) || !isDocAvailable(doc)) ? 'not-allowed' : 'pointer', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                gap: '10px', 
                                opacity: processingDocs.has(doc.id) ? 0.5 : 1 
                              }}
                            >
                              <Warehouse size={16} /> 
                              {processingDocs.has(doc.id) ? 'ОБРОБКА...' : 
                               (isProcurementOnly ? 'ВІДПРАВИТИ У ВИРОБНИЦТВО' : 'ПЕРЕДАТИ НА СО')
                              }
                            </button>
                            {!isDocAvailable(doc) && (
                              <div style={{ fontSize: '0.65rem', color: '#ef4444', textAlign: 'center', fontWeight: 800 }}>
                                НЕМАЄ НА СКЛАДІ (ОЧІКУЙТЕ ПОСТАЧАННЯ)
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {(receptionDocs || []).length === 0 && (
                  <div style={{ textAlign: 'center', padding: '60px', color: '#333', fontSize: '0.85rem' }}>Історія поставок порожня</div>
                )}
              </div>
            </section>
          )}

          {/* STOCK COLUMN */}
          {!showCreate && activeTab === 'stock' && (
            <section className="stock-col glass-panel" style={{ background: '#111', padding: '25px', borderRadius: '24px', border: '1px solid #222' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 900, margin: 0 }}>СКЛАДСЬКІ ЗАЛИШКИ</h3>
                <div style={{ position: 'relative' }}>
                  <input
                    style={{ background: '#000', border: '1px solid #222', padding: '8px 15px', borderRadius: '10px', color: '#fff', width: '200px' }}
                    placeholder="Пошук..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className="table-responsive-container">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #222', textAlign: 'left' }}>
                      <th style={{ padding: '15px', fontSize: '0.7rem', color: '#555' }}>НАЙМЕНУВАННЯ</th>
                      <th style={{ padding: '15px', fontSize: '0.7rem', color: '#555', textAlign: 'center' }}>НАЯВНІСТЬ</th>
                      <th style={{ padding: '15px', fontSize: '0.7rem', color: '#555', textAlign: 'center' }}>ВІЛЬНО</th>
                      <th style={{ padding: '15px', fontSize: '0.7rem', color: '#555', textAlign: 'center' }}>РЕЗЕРВ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockRows
                      .filter(i => (i.name || '').toLowerCase().includes(searchQuery.toLowerCase()))
                      .map(item => (
                        <tr key={item.id} style={{ borderBottom: '1px solid #151515' }}>
                          <td style={{ padding: '15px', fontWeight: 700 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>{item.name}</span>
                              {currentUser?.login === 'admin@workshop.local' && !item.is_virtual_zero_stock && editingInvId !== item.id && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingInvId(item.id)
                                    setEditingInvTotal(String(item.total_qty || 0))
                                    setEditingInvReserved(String(item.reserved_qty || 0))
                                  }}
                                  style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', display: 'inline-flex', padding: '4px' }}
                                  title="Редагувати запаси"
                                >
                                  <Pencil size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '15px', textAlign: 'center', color: '#ff9000', fontWeight: 900 }}>
                            {editingInvId === item.id ? (
                              <input
                                type="number"
                                value={editingInvTotal}
                                onChange={e => setEditingInvTotal(e.target.value)}
                                style={{ width: '80px', background: '#000', border: '1px solid #ff9000', color: '#fff', textAlign: 'center', borderRadius: '6px', padding: '4px' }}
                              />
                            ) : (
                              <>
                                {item.total_qty || 0} <small style={{ color: '#444' }}>{item.unit}</small>
                              </>
                            )}
                          </td>
                          <td style={{ padding: '15px', textAlign: 'center', color: '#10b981', fontWeight: 900 }}>
                            {editingInvId === item.id ? (Number(editingInvTotal) || 0) - (Number(editingInvReserved) || 0) : (item.total_qty || 0) - (item.reserved_qty || 0)}
                          </td>
                          <td style={{ padding: '15px', textAlign: 'center', color: Number(item.reserved_qty) > 0 ? '#3b82f6' : '#222', fontWeight: 800 }}>
                            {editingInvId === item.id ? (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <input
                                  type="number"
                                  value={editingInvReserved}
                                  onChange={e => setEditingInvReserved(e.target.value)}
                                  style={{ width: '80px', background: '#000', border: '1px solid #3b82f6', color: '#fff', textAlign: 'center', borderRadius: '6px', padding: '4px' }}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveInventoryQty(item.id)}
                                  disabled={savingInv}
                                  style={{ background: '#10b981', border: 'none', borderRadius: '6px', padding: '5px 10px', color: '#000', fontWeight: 900, cursor: 'pointer' }}
                                >
                                  {savingInv ? '...' : <Check size={14} />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingInvId(null)}
                                  style={{ background: '#222', border: 'none', borderRadius: '6px', padding: '5px 10px', color: '#fff', cursor: 'pointer' }}
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              item.reserved_qty || 0
                            )}
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* QR CODES TAB */}
          {!showCreate && activeTab === 'qrcodes' && (() => {
            const filteredNoms = nomenclatures.filter(n => 
              n.type !== 'finished' && n.type !== 'product' && 
              (n.name || '').toLowerCase().includes(qrNomSearch.toLowerCase())
            )
            const filteredNomsWithQr = filteredNoms.filter(n => getQR(n))
            const allSelected = filteredNomsWithQr.length > 0 && filteredNomsWithQr.every(n => selectedQrNomIds.has(n.id))

            const toggleAll = () => {
              const next = new Set(selectedQrNomIds)
              if (allSelected) {
                filteredNomsWithQr.forEach(n => next.delete(n.id))
              } else {
                filteredNomsWithQr.forEach(n => next.add(n.id))
              }
              setSelectedQrNomIds(next)
            }

            const toggleOne = (id) => {
              const next = new Set(selectedQrNomIds)
              if (next.has(id)) {
                next.delete(id)
              } else {
                next.add(id)
              }
              setSelectedQrNomIds(next)
            }

            return (
              <section className="qrcodes-col glass-panel" style={{ background: '#111', padding: '25px', borderRadius: '24px', border: '1px solid #222' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000' }}>
                      <QrCode size={20} /> ГЕНЕРАТОР ТА ДРУК QR-КОДІВ
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#555' }}>
                      Призначення унікальних кодів і друк стікерів для швидкої прийомки сканером
                    </p>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      style={{ background: '#000', border: '1px solid #222', padding: '10px 15px', borderRadius: '10px', color: '#fff', width: '250px', outline: 'none' }}
                      placeholder="Пошук номенклатури..." 
                      value={qrNomSearch} 
                      onChange={e => setQrNomSearch(e.target.value)}
                    />
                  </div>
                </div>

                {/* Bulk Actions Bar */}
                {selectedQrNomIds.size > 0 && (
                  <div style={{ display: 'flex', gap: '15px', alignItems: 'center', background: 'rgba(255, 144, 0, 0.08)', border: '1px solid rgba(255, 144, 0, 0.3)', padding: '15px 25px', borderRadius: '16px', marginBottom: '25px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>
                      Обрано для друку: <strong style={{ color: '#ff9000' }}>{selectedQrNomIds.size}</strong> позицій
                    </span>
                    <button
                      onClick={() => {
                        const selectedNoms = nomenclatures.filter(n => selectedQrNomIds.has(n.id) && getQR(n))
                        if (selectedNoms.length === 0) return
                        
                        const qrWindow = window.open('', '_blank', 'width=800,height=600')
                        const gridHtml = selectedNoms.map(nom => {
                          const qrVal = getQR(nom)
                          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrVal)}`
                          return `
                            <div class="label-box">
                              <div class="title">${nom.name}</div>
                              <img class="qr-image" src="${qrUrl}" alt="QR" />
                              <div class="code">${qrVal}</div>
                            </div>
                          `
                        }).join('')

                        qrWindow.document.write(`
                          <html>
                            <head>
                              <title>Друк QR-кодів</title>
                              <style>
                                body {
                                  font-family: sans-serif;
                                  margin: 0;
                                  padding: 20px;
                                  background: white;
                                  color: black;
                                }
                                .grid-container {
                                  display: grid;
                                  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                                  gap: 20px;
                                }
                                .label-box {
                                  border: 1px dashed #ccc;
                                  padding: 15px;
                                  border-radius: 8px;
                                  text-align: center;
                                  display: flex;
                                  flex-direction: column;
                                  align-items: center;
                                  justify-content: center;
                                  page-break-inside: avoid;
                                }
                                .title {
                                  font-size: 11px;
                                  font-weight: bold;
                                  margin-bottom: 5px;
                                  max-height: 40px;
                                  overflow: hidden;
                                }
                                .qr-image {
                                  width: 120px;
                                  height: 120px;
                                  margin: 5px 0;
                                }
                                .code {
                                  font-size: 9px;
                                  font-family: monospace;
                                  color: #555;
                                  letter-spacing: 1px;
                                }
                                @media print {
                                  body { padding: 0; }
                                  .label-box { border: 1px solid #ddd; }
                                }
                              </style>
                            </head>
                            <body>
                              <div class="grid-container">
                                ${gridHtml}
                              </div>
                              <script>
                                window.onload = function() {
                                  window.print();
                                  setTimeout(function() { window.close(); }, 500);
                                }
                              </script>
                            </body>
                          </html>
                        `)
                        qrWindow.document.close()
                      }}
                      style={{ background: '#ff9000', color: '#000', border: 'none', padding: '8px 18px', borderRadius: '10px', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}
                    >
                      <Printer size={16} /> ДРУКУВАТИ ОБРАНІ ({selectedQrNomIds.size})
                    </button>
                    <button
                      onClick={() => setSelectedQrNomIds(new Set())}
                      style={{ background: 'transparent', border: '1px solid #333', color: '#888', padding: '8px 18px', borderRadius: '10px', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      СКАСУВАТИ ВИДІЛЕННЯ
                    </button>
                  </div>
                )}

                <div className="table-responsive-container">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #222', textAlign: 'left' }}>
                        <th style={{ padding: '15px 10px', width: '40px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={toggleAll}
                            disabled={filteredNomsWithQr.length === 0}
                            style={{ width: '16px', height: '16px', accentColor: '#ff9000', cursor: 'pointer' }}
                          />
                        </th>
                        <th style={{ padding: '15px', fontSize: '0.7rem', color: '#555' }}>НАЙМЕНУВАННЯ</th>
                        <th style={{ padding: '15px', fontSize: '0.7rem', color: '#555' }}>ТИП</th>
                        <th style={{ padding: '15px', fontSize: '0.7rem', color: '#555', textAlign: 'center' }}>QR-КОД</th>
                        <th style={{ padding: '15px', fontSize: '0.7rem', color: '#555', textAlign: 'center' }}>ДІЇ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredNoms.map(nom => {
                        const qrVal = getQR(nom)
                        const isEditingThis = editingQrNomId === nom.id
                        const isSelected = selectedQrNomIds.has(nom.id)
                        return (
                          <tr key={nom.id} style={{ borderBottom: '1px solid #151515', opacity: !qrVal && !isEditingThis ? 0.7 : 1 }}>
                            <td style={{ padding: '15px 10px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleOne(nom.id)}
                                disabled={!qrVal}
                                style={{ width: '16px', height: '16px', accentColor: '#ff9000', cursor: qrVal ? 'pointer' : 'not-allowed' }}
                              />
                            </td>
                            <td style={{ padding: '15px', fontWeight: 700 }}>
                              {nom.name} {nom.material_type && <span style={{ color: '#555', fontSize: '0.75rem' }}>({nom.material_type})</span>}
                            </td>
                            <td style={{ padding: '15px', fontSize: '0.75rem', color: '#888' }}>
                              {nom.type === 'raw' ? 'Сировина' : nom.type === 'hardware' ? 'Метизи' : nom.type === 'consumable' ? 'Розхідник' : nom.type}
                            </td>
                            <td style={{ padding: '15px', textAlign: 'center' }}>
                              {isEditingThis ? (
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                                  <input
                                    type="text"
                                    value={editingQrCodeValue}
                                    onChange={e => setEditingQrCodeValue(e.target.value)}
                                    placeholder="Введіть код..."
                                    style={{ background: '#000', border: '1px solid #ff9000', color: '#fff', padding: '6px 10px', borderRadius: '8px', fontSize: '0.8rem', width: '150px', outline: 'none' }}
                                  />
                                  <button
                                    onClick={() => {
                                      const rand = 'NOM-' + Math.random().toString(36).substring(2, 8).toUpperCase()
                                      setEditingQrCodeValue(rand)
                                    }}
                                    style={{ background: '#222', border: '1px solid #444', color: '#ff9000', padding: '6px 10px', borderRadius: '8px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700 }}
                                  >
                                    АВТО
                                  </button>
                                </div>
                              ) : (
                                qrVal ? (
                                  <span style={{ fontFamily: 'monospace', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 900 }}>
                                    {qrVal}
                                  </span>
                                ) : (
                                  <span style={{ color: '#444', fontSize: '0.75rem' }}>не призначено</span>
                                )
                              )}
                            </td>
                            <td style={{ padding: '15px', textAlign: 'center' }}>
                              {isEditingThis ? (
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                  <button
                                    onClick={() => handleSaveQrCode(nom.id, editingQrCodeValue)}
                                    disabled={savingQr}
                                    style={{ background: '#10b981', color: '#000', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 900 }}
                                  >
                                    {savingQr ? '...' : 'ЗБЕРЕГТИ'}
                                  </button>
                                  <button
                                    onClick={() => setEditingQrNomId(null)}
                                    style={{ background: '#222', color: '#fff', border: '1px solid #333', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', cursor: 'pointer' }}
                                  >
                                    СКАСУВАТИ
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                  <button
                                    onClick={() => {
                                      setEditingQrNomId(nom.id)
                                      setEditingQrCodeValue(qrVal || 'NOM-' + Math.random().toString(36).substring(2, 8).toUpperCase())
                                    }}
                                    style={{ background: 'transparent', border: '1px solid #333', color: '#ff9000', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700 }}
                                  >
                                    {qrVal ? 'РЕДАГУВАТИ' : '+ ДОДАТИ'}
                                  </button>
                                  {qrVal && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteQrCode(nom)}
                                      disabled={savingQr}
                                      title="Видалити QR-код"
                                      style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#ef4444', padding: '6px 10px', borderRadius: '8px', fontSize: '0.75rem', cursor: savingQr ? 'wait' : 'pointer', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '5px', opacity: savingQr ? 0.6 : 1 }}
                                    >
                                      <Trash2 size={13} /> ВИДАЛИТИ
                                    </button>
                                  )}
                                  {qrVal && (
                                    <button
                                      onClick={() => {
                                        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrVal)}`;
                                        const printWindow = window.open('', '_blank', 'width=400,height=400');
                                        printWindow.document.write(`
                                          <html>
                                            <head>
                                              <title>Друк QR-коду</title>
                                              <style>
                                                body {
                                                  font-family: sans-serif;
                                                  margin: 0;
                                                  padding: 20px;
                                                  display: flex;
                                                  flex-direction: column;
                                                  align-items: center;
                                                  justify-content: center;
                                                  text-align: center;
                                                  background: white;
                                                  color: black;
                                                }
                                                .label {
                                                  border: 2px dashed #000;
                                                  padding: 15px;
                                                  border-radius: 10px;
                                                  display: inline-block;
                                                }
                                                .title {
                                                  font-size: 14px;
                                                  font-weight: bold;
                                                  margin-bottom: 5px;
                                                  max-width: 250px;
                                                  word-wrap: break-word;
                                                }
                                                .qr-image {
                                                  width: 150px;
                                                  height: 150px;
                                                  margin: 10px 0;
                                                }
                                                .code {
                                                  font-size: 11px;
                                                  font-family: monospace;
                                                  color: #555;
                                                  letter-spacing: 1px;
                                                }
                                                @media print {
                                                  body { margin: 0; padding: 0; }
                                                  .label { border: none; }
                                                }
                                              </style>
                                            </head>
                                            <body>
                                              <div class="label">
                                                <div class="title">${nom.name}</div>
                                                <img class="qr-image" src="${qrUrl}" alt="QR" />
                                                <div class="code">${qrVal}</div>
                                              </div>
                                              <script>
                                                window.onload = function() {
                                                  window.print();
                                                  setTimeout(function() { window.close(); }, 500);
                                                }
                                              </script>
                                            </body>
                                          </html>
                                        `);
                                        printWindow.document.close();
                                      }}
                                      style={{ background: 'transparent', border: '1px solid #10b981', color: '#10b981', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                      <Printer size={12} /> ДРУК
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )
          })()}

        </div>
      </div>

      {receptionDocToAccept && (
        <ReceptionAcceptanceModal
          doc={receptionDocToAccept}
          nomenclatures={nomenclatures}
          isProcessing={processingDocs.has(receptionDocToAccept.id)}
          onClose={() => setReceptionDocToAccept(null)}
          onConfirm={(payload) => handleAcceptReceptionDoc(receptionDocToAccept, payload)}
        />
      )}

      {shortageModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#111', border: '1px solid #333', borderRadius: '24px', padding: '30px', width: '100%', maxWidth: '450px' }}>
            <h3 style={{ color: '#ef4444', margin: '0 0 15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={24} /> ПІДТВЕРДЖЕННЯ ЗАКУПІВЛІ
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '20px' }}>
              На СВ не вистачає наступних позицій. Буде надіслано запит у відділ Постачання лише на дефіцитну кількість:
            </p>
            <div style={{ background: '#000', padding: '15px', borderRadius: '12px', marginBottom: '25px', maxHeight: '300px', overflowY: 'auto' }}>
              {shortageModal.deficitItems.map((i, idx) => (
                <div key={idx} style={{ fontSize: '0.85rem', marginBottom: '10px', borderBottom: '1px solid #111', paddingBottom: '8px' }}>
                  <div style={{ fontWeight: 700, color: '#aaa', marginBottom: '5px' }}>{i.name}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#555' }}>Потрібно: <strong style={{ color: '#888' }}>{Number(i.qty || i.needed || 0)}</strong></div>
                    <div style={{ fontSize: '0.7rem', color: '#555' }}>В наявності: <strong style={{ color: '#10b981' }}>{Number(i.available ?? i.stock ?? 0)}</strong></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '5px', borderTop: '1px dashed #222' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#666' }}>ДЕФІЦИТ (ДО ЗАКУПІВЛІ):</span>
                    <strong style={{ color: '#ef4444', fontSize: '0.9rem' }}>{Number(i.missing || i.missingAmount || 0)} од.</strong>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShortageModal(null)}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', background: '#222', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 800 }}
              >
                НАЗАД
              </button>
              <button
                onClick={shortageModal.draftItems ? handleManualShortagePR : confirmForwardToProcurement}
                style={{ flex: 2, padding: '12px', borderRadius: '10px', background: '#ef4444', color: '#fff', border: 'none', fontWeight: 950, cursor: 'pointer' }}
              >
                {isProcessing ? 'ОБРОБКА...' : 'НАДІСЛАТИ ЗАПИТ'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ScannerPanel
        isScanning={isScanning}
        setIsScanning={setIsScanning}
        manualCardInput={manualCardInput}
        setManualCardInput={setManualCardInput}
        handleCardScan={handleQRScan}
        color="#ff9000"
      />
 
      <style dangerouslySetInnerHTML={{ __html: `
        .tab-btn-m { flex: 1; padding: 12px; border: none; background: transparent; color: #444; font-weight: 900; font-size: 0.7rem; border-radius: 10px; cursor: pointer; transition: 0.3s; }
        .tab-btn-m.active { background: #222; color: #ff9000; }
        .status-pill.pending { background: rgba(255,144,0,0.1); color: #ff9000; }
        .status-pill.completed { background: rgba(16,185,129,0.1); color: #10b981; }
        .status-pill.ordered { background: rgba(59,130,246,0.1); color: #3b82f6; }
        .status-pill.shipped { background: rgba(139,92,246,0.1); color: #8b5cf6; }
        @media (max-width: 768px) { .hide-mobile { display: none !important; } .mobile-stack { grid-template-columns: 1fr !important; } }
        @media (min-width: 769px) { .mobile-only { display: none !important; } }
      `}} />
    </div>
  )
}

export default SupplyModule
