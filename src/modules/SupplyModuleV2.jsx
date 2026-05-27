import React, { useState, useMemo } from 'react'
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
  CheckCircle
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'
import { supabase } from '../supabase'

const SupplyModule = ({ isProcurementOnly = false }) => {
  const {
    inventory, nomenclatures, receptionDocs, createReceptionDoc, sendDocToWarehouse,
    purchaseRequests, updatePurchaseRequestStatus, convertRequestToOrder, currentUser,
    confirmReception, fetchData, normalize, requests, issueMaterialsBatch, tasks
  } = useMES()

  const [activeTab, setActiveTab] = useState('requests') // 'requests', 'registry', 'stock'
  const [activeMobileSection, setActiveMobileSection] = useState('requests')
  const [showCreate, setShowCreate] = useState(false)
  const [draftItems, setDraftItems] = useState([])
  const [selectedQty, setSelectedQty] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedDoc, setExpandedDoc] = useState(null)
  const [showReception, setShowReception] = useState(false)
  const [shortageModal, setShortageModal] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingDocs, setProcessingDocs] = useState(new Set())
  const [targetWarehouse, setTargetWarehouse] = useState('operational') // 'operational'=СО, 'production'=СВ


  const parseMaterialName = (details) => {
    if (!details) return ''
    if (details.includes('ВИТРАТНІ МАТЕРІАЛИ')) {
      const match = details.match(/:\s*(.+)\s*—/)
      return match ? match[1].trim() : details
    }
    return details.split(': ')[1]?.split(' — ')[0]?.trim() || details
  }

  const pendingRequests = (purchaseRequests || []).filter(pr => {
    // Всі замовлення (і для СВ, і для виробництва) мають бути видимі у відділі Постачання
    const isRelevantStatus = (pr.status === 'pending' || pr.status === 'accepted' || pr.status === 'ordered')
    if (isProcurementOnly) return isRelevantStatus && pr.destination_warehouse === 'procurement'
    return isRelevantStatus && (pr.destination_warehouse === 'production' || !pr.destination_warehouse)
  })

  // Запити від Відділу Підготовки (Непідготовлений карбон)
  const prepRequests = (requests || []).filter(r => 
    r.status === 'pending' && 
    r.details && 
    r.details.includes('ЗАПИТ НА ПІДГОТОВКУ')
  )

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

      const targetWh = isProcurementOnly ? targetWarehouse : 'operational'
      const sourceWh = isProcurementOnly ? null : 'production'
      const whLabel = targetWh === 'operational' ? 'СО (Склад Операційний)' : 'СВ (Склад Виробництва)'
      await apiService.submitCreateReceptionDoc(items, null, (its) => createReceptionDoc(its, 'shipped', null, null, targetWh, sourceWh), targetWh, sourceWh)
      setDraftItems([])
      setShowCreate(false)
      setActiveMobileSection('registry')
      alert('Готово! Поставку успішно відправлено на СО.')
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
        alert('Запит на дефіцитні матеріали успішно надіслано в Постачання!')
        fetchData(true)
      } else {
        alert('Усі матеріали є в наявності!')
      }
    } catch (err) {
      alert('Помилка: ' + err.message)
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
      alert(`Створено наряд ${orderNum}! Дефіцит (якщо є) надіслано в Постачання. Те що було в наявності — зарезервовано.`)
    } catch (err) {
      alert('Помилка: ' + err.message)
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
      const inventoryUpdates = []
      
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
            inventoryUpdates.push(
              supabase.from('inventory').update({
                reserved_qty: (Number(firstInv.reserved_qty) || 0) + canReserve
              }).eq('id', firstInv.id)
            )
            
            // Оновлюємо кількість заброньованого в самому запиті
            updatedItems[i] = { 
              ...it, 
              reserved_from_stock: (Number(it.reserved_from_stock) || 0) + canReserve 
            }
          }
        }
      }

      // Run inventory updates in parallel
      if (inventoryUpdates.length > 0) {
        const results = await Promise.all(inventoryUpdates)
        for (const res of results) {
          if (res.error) throw res.error
        }
      }

      // Оновлюємо оригінальний запит, щоб він пам'ятав про бронювання
      await supabase.from('purchase_requests').update({ items: updatedItems }).eq('id', pr.id)

      alert('Запит на дефіцит надіслано до Постачання! Наявне заброньовано на СВ.')
      setShortageModal(null)
      if (fetchData) fetchData()
    } catch (err) {
      alert('Помилка відправки: ' + err.message)
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
                setTargetWarehouse('operational')
                setShowCreate(true)
              }}
              className="hide-mobile"
              style={{ background: '#ff9000', color: '#000', border: 'none', padding: '10px 22px', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}
            >
              <Plus size={20} /> {isProcurementOnly ? 'НОВА ПОСТАВКА' : 'ПОСТАВКА НА СО'}
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
                        onClick={async () => {
                          setProcessingDocs(prev => new Set(prev).add(doc.id))
                          try {
                            await confirmReception(doc.id)
                          } finally {
                            setProcessingDocs(prev => {
                              const next = new Set(prev)
                              next.delete(doc.id)
                              return next
                            })
                          }
                        }}
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
                  </div>
                ))}
              {(receptionDocs || []).filter(d => (d.status === 'shipped' || d.status === 'ordered') && (!d.target_warehouse || d.target_warehouse === 'production')).length === 0 && (
                <p style={{ color: '#444', fontSize: '0.8rem', padding: '20px' }}>Немає активних документів на прийомку для цього складу</p>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="supply-tabs" style={{ display: 'flex', background: '#111', padding: '5px', borderRadius: '14px', marginBottom: '25px', maxWidth: '600px' }}>
          <button onClick={() => { setActiveTab('requests'); setActiveMobileSection('requests'); setShowCreate(false) }} className={`tab-btn-m ${activeTab === 'requests' && !showCreate ? 'active' : ''}`}>ЗАПИТИ ({pendingRequests.length})</button>
          <button onClick={() => { setActiveTab('registry'); setActiveMobileSection('registry'); setShowCreate(false) }} className={`tab-btn-m ${activeTab === 'registry' && !showCreate ? 'active' : ''}`}>РЕЄСТР</button>
          {!isProcurementOnly && <button onClick={() => { setActiveTab('stock'); setActiveMobileSection('stock'); setShowCreate(false) }} className={`tab-btn-m ${activeTab === 'stock' && !showCreate ? 'active' : ''}`}>ЗАЛИШКИ</button>}
          <button onClick={() => { setShowCreate(true); setActiveMobileSection('create'); setActiveTab('create') }} className={`tab-btn-m ${showCreate ? 'active' : ''}`}>+ НОВИЙ</button>
        </div>

        <div className="supply-main-layout" style={{ display: 'grid', gridTemplateColumns: (showCreate || activeTab === 'stock') ? '1fr' : 'repeat(auto-fit, minmax(400px, 1fr))', gap: '30px' }}>

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
                    {isProcurementOnly ? 'НОВА ПОСТАВКА' : 'ПОСТАВКА З СВ НА СО'}
                  </h2>
                  <p style={{ color: '#666', fontSize: '0.8rem', margin: '6px 0 0' }}>
                    {isProcurementOnly 
                      ? 'Сформувати поставку на Склад Операційний (СО) або Склад Виробництва (СВ)' 
                      : 'Передати матеріали зі складу виробництва на операційний склад (СО)'}
                  </p>
                </div>
                <button onClick={() => { setShowCreate(false); setDraftItems([]); setActiveMobileSection('registry') }}
                  style={{ background: '#1c1c1c', border: '1px solid #2a2a2a', color: '#888', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.background='#ff9000'; e.currentTarget.style.color='#000' }}
                  onMouseLeave={e => { e.currentTarget.style.background='#1c1c1c'; e.currentTarget.style.color='#888' }}
                ><X size={18} /></button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Destination selector (procurement only) */}
                {isProcurementOnly && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 900, color: '#555', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Пункт призначення</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      {[
                        { id: 'operational', label: 'СО', desc: 'Склад Операційний', color: '#10b981', icon: '🏭' },
                        { id: 'production', label: 'СВ', desc: 'Склад Виробництва', color: '#3b82f6', icon: '⚙️' }
                      ].map(wh => {
                        const active = targetWarehouse === wh.id
                        return (
                          <button
                            key={wh.id}
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
                )}

                {/* Add Item inputs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 50px', gap: '10px' }} className="mobile-stack">
                  <div style={{ position: 'relative' }}>
                    <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 900, color: '#555', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Номенклатура</label>
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
                    <button onClick={addToDraft} style={{ height: '42px', width: '50px', background: '#ff9000', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={20} /></button>
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
                            <strong style={{ color: '#ff9000', fontSize: '0.9rem' }}>{it.qty}</strong>
                            <button onClick={() => setDraftItems(draftItems.filter((_, i) => i !== idx))} style={{ color: '#555', border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px' }}><X size={14} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Submit button */}
                {draftItems.length > 0 && (
                  <button 
                    disabled={isProcessing}
                    onClick={handleSendToWarehouse} 
                    style={{
                      width: '100%', 
                      padding: '14px', 
                      background: isProcessing ? '#222' : (isProcurementOnly && targetWarehouse === 'production' ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' : 'linear-gradient(135deg, #10b981, #047857)'), 
                      color: '#fff', 
                      border: 'none', 
                      borderRadius: '12px', 
                      fontWeight: 900, 
                      cursor: isProcessing ? 'not-allowed' : 'pointer', 
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
                      : (isProcurementOnly 
                          ? `ВІДПРАВИТИ НА ${targetWarehouse === 'operational' ? 'СО' : 'СВ'}` 
                          : 'ВІДПРАВИТИ НА СО')}
                  </button>
                )}
              </div>
            </section>
          )}

          {/* REQUESTS COLUMN */}
          {!showCreate && (activeTab === 'requests') && (
            <section className="requests-col">
              {!isProcurementOnly && groupedPrepRequests.length > 0 && (
                <div style={{ marginBottom: '30px' }}>
                  <h3 style={{ fontSize: '0.85rem', color: '#10b981', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Package size={18} /> ЗАПИТИ ВІДДІЛУ ПІДГОТОВКИ ({groupedPrepRequests.length})
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
                        <div key={group.taskId} style={{ background: '#111', border: '1px solid #10b981', padding: '20px', borderRadius: '18px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', paddingBottom: '10px' }}>
                            <strong style={{ fontSize: '1rem', color: '#10b981' }}>НАРЯД № {prepNum}</strong>
                            <span style={{ fontSize: '0.75rem', color: '#555' }}>
                              ПІДГОТОВКА СИРОВИНИ
                            </span>
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                                <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0a0a0a', padding: '12px 15px', borderRadius: '12px', border: '1px solid #222' }}>
                                  <span style={{ fontSize: '0.9rem', fontWeight: 800 }}>{reqName}</span>
                                  <div style={{ textTransform: 'uppercase', fontSize: '0.75rem', color: itemEnough ? '#10b981' : '#ef4444', fontWeight: 800, textAlign: 'right' }}>
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
                                padding: '12px 20px',
                                borderRadius: '12px',
                                fontWeight: 900,
                                cursor: processingDocs.has(group.taskId) ? 'not-allowed' : 'pointer',
                                fontSize: '0.85rem',
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
                                padding: '12px 20px',
                                borderRadius: '12px',
                                fontWeight: 950,
                                cursor: (hasActivePRForProcurement || processingDocs.has(group.taskId)) ? 'not-allowed' : 'pointer',
                                fontSize: '0.85rem',
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
                  </div>
                </div>
              )}

              <h3 style={{ fontSize: '0.85rem', color: '#555', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle size={18} className="text-secondary" /> ДЕФІЦИТ ТА ЗАПИТИ
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

                  return (
                    <div key={pr.id} className="request-card" style={{ background: '#111', padding: '25px', borderRadius: '24px', border: '1px solid #222', borderLeft: pr.status === 'accepted' ? '4px solid #3b82f6' : '4px solid #ef4444' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                        <strong style={pr.status === 'accepted' ? { color: '#3b82f6', fontSize: '1rem' } : { color: '#ef4444', fontSize: '1rem' }}>
                          НАРЯД #{pr.order_num}
                        </strong>
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
                                padding: '8px 15px', 
                                borderRadius: '10px', 
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
                                padding: '8px 15px', 
                                borderRadius: '10px', 
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
                                 padding: '8px 15px', 
                                 borderRadius: '10px', 
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
                      <div style={{ fontSize: '0.9rem', color: '#888' }}>
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
                                <span style={{ color: isDeficit ? '#ef4444' : '#888' }}>{it.name}</span>
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
                    </div>
                  )
                })}
                {pendingRequests.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '60px', color: '#333', fontSize: '0.85rem' }}>Активних дефіцитів не зафіксовано</div>
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
                            return (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #111' }}>
                                <span style={{ fontSize: '0.8rem', color: '#888' }}>{itemName}</span>
                                <strong style={{ fontSize: '0.8rem', color: '#fff' }}>{itemQty}</strong>
                              </div>
                            )
                          })}
                        </div>

                        {doc.status === 'shipped' && !isProcurementOnly && (
                          <button
                            disabled={processingDocs.has(doc.id)}
                            onClick={async (e) => {
                              e.stopPropagation()
                              setProcessingDocs(prev => new Set(prev).add(doc.id))
                              try {
                                await apiService.submitConfirmReception(doc.id, () => confirmReception(doc.id, 'production'))
                              } finally {
                                setProcessingDocs(prev => {
                                  const next = new Set(prev)
                                  next.delete(doc.id)
                                  return next
                                })
                              }
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
                      <th style={{ padding: '15px', fontSize: '0.7rem', color: '#555', textAlign: 'center' }}>РЕЗЕРВ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(inventory || [])
                      .filter(i => (i.name || '').toLowerCase().includes(searchQuery.toLowerCase()) && 
                                   i.type !== 'finished' && i.type !== 'product' && 
                                   i.warehouse === (isProcurementOnly ? 'procurement' : 'production'))
                      .map(item => (
                        <tr key={item.id} style={{ borderBottom: '1px solid #151515' }}>
                          <td style={{ padding: '15px', fontWeight: 700 }}>{item.name}</td>
                          <td style={{ padding: '15px', textAlign: 'center', color: '#ff9000', fontWeight: 900 }}>
                            {item.total_qty || 0} <small style={{ color: '#444' }}>{item.unit}</small>
                          </td>
                          <td style={{ padding: '15px', textAlign: 'center', color: Number(item.reserved_qty) > 0 ? '#3b82f6' : '#222', fontWeight: 800 }}>
                            {item.reserved_qty || 0}
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </section>
          )}

        </div>
      </div>

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
