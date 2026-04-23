import React, { useState, useMemo } from 'react'
import {
  Warehouse as WarehouseIcon,
  ArrowLeft,
  Package,
  CheckCircle2,
  Bell,
  Plus,
  Truck,
  Layers,
  Archive,
  AlertTriangle,
  Search,
  History
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'

const WarehouseModuleV2 = () => {
  const {
    inventory, requests, issueMaterials, issueMaterialsBatch,
    nomenclatures, receptionDocs, confirmReception,
    orders, tasks, approveWarehouse, createPurchaseRequest,
    purchaseRequests, receiveInventory, currentUser
  } = useMES()

  const normalize = (s) => (s || '').toLowerCase().trim()
    .replace(/[тt]/g, 't').replace(/[аa]/g, 'a').replace(/[еe]/g, 'e')
    .replace(/[оo]/g, 'o').replace(/[рp]/g, 'p').replace(/[сc]/g, 'c')
    .replace(/[хx]/g, 'x').replace(/\s/g, '')

  const parseMaterialName = (details) => {
    if (!details) return ''
    if (details.includes('ВИТРАТНІ МАТЕРІАЛИ')) {
      const match = details.match(/:\s*(.+)\s*—/)
      return match ? match[1].trim() : details
    }
    return details.split(': ')[1]?.split(' — ')[0]?.trim() || details
  }

  const [activeTab, setActiveTab] = useState('raw')
  const [showAdd, setShowAdd] = useState(false)
  const [showReception, setShowReception] = useState(false)
  const [shortages, setShortages] = useState(null)
  const [newItem, setNewItem] = useState({ name: '', unit: 'шт', total_qty: '', type: 'raw' })
  const [searchQuery, setSearchQuery] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingDocs, setProcessingDocs] = useState(new Set())
  const [processingTasks, setProcessingTasks] = useState(new Set())
  const [expandedDoc, setExpandedDoc] = useState(null)

  const tabs = useMemo(() => {
    const getCount = (tabId) => {
      const filtered = (requests || []).filter(r => {
        if (r.status !== 'pending' && r.status !== 'issued') return false
        if (r.status === 'issued') {
          const task = tasks.find(t => t.id === r.task_id)
          if (!task || task.warehouse_conf) return false
        }
        const parsedName = parseMaterialName(r.details)
        const nameLower = parsedName.toLowerCase()
        const invItem = (inventory || []).find(i => (i.id === r.inventory_id || (parsedName && normalize(i.name) === normalize(parsedName))))
        
        // Пріоритет вибору складу: СГП > Напівфабрикати > БЗ > Брак > Оперативний
        const isSgp = nameLower.startsWith('іп-') || nameLower.startsWith('ip-') || invItem?.type === 'finished' || invItem?.warehouse === 'sgp'
        const isSemi = !isSgp && (invItem?.type === 'semi' || invItem?.warehouse === 'production')
        const isBz = !isSgp && !isSemi && (invItem?.type === 'bz' || invItem?.warehouse === 'sz')
        const isScrap = !isSgp && !isSemi && !isBz && (invItem?.type?.startsWith('scrap') || invItem?.warehouse === 'scrap')

        if (tabId === 'finished') return isSgp
        if (tabId === 'semi') return isSemi
        if (tabId === 'bz') return isBz
        if (tabId === 'scrap') return isScrap
        if (tabId === 'raw') return !isSgp && !isSemi && !isBz && !isScrap
        return false
      })

      // Рахуємо унікальні "документи" (завдання або замовлення)
      const uniqueDocs = new Set(filtered.map(r => r.task_id || `order-${r.order_id}`))
      
      // Додаємо кількість документів на прийомку (тільки для оперативного складу поки що)
      let receptionCount = 0
      if (tabId === 'raw') {
        receptionCount = (receptionDocs || []).filter(d => (d.status === 'shipped' || d.status === 'ordered') && d.target_warehouse === 'operational').length
      }

      return uniqueDocs.size + receptionCount
    }

    return [
      { id: 'raw', label: 'Оперативний', icon: <Package size={18} />, count: getCount('raw') },
      { id: 'semi', label: 'Напівфабрикати', icon: <Layers size={18} />, count: getCount('semi') },
      { id: 'finished', label: 'Готова продукція', icon: <Archive size={18} />, count: getCount('finished') },
      { id: 'scrap', label: 'Брак', icon: <AlertTriangle size={18} />, count: getCount('scrap') },
      { id: 'bz', label: 'БЗ', icon: <CheckCircle2 size={18} />, count: getCount('bz') },
      { id: 'registry', label: 'Реєстр', icon: <History size={18} /> }
    ]
  }, [requests, inventory, tasks])

  const filteredInventory = (inventory || []).filter(i => {
    const matchesSearch = (i.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    const isOperational = i.warehouse === 'operational' || !i.warehouse
    if (!isOperational) return false

    if (activeTab === 'bz') return i.type === 'bz' && matchesSearch
    
    // Брак: показуємо всі типи, що починаються на 'scrap'
    if (activeTab === 'scrap') return i.type?.startsWith('scrap') && matchesSearch
    
    // Items without a type default to 'raw'
    const itemType = i.type || 'raw'
    return itemType === activeTab && matchesSearch
  })

  // Reception docs that are 'shipped' (sent by supply) OR 'pending' (old flow)
  const pendingDocs = receptionDocs
    ? receptionDocs.filter(d => (d.status === 'shipped' || d.status === 'ordered') && d.target_warehouse === 'operational')
    : []

  // Фільтруємо запити відповідно до активної вкладки складу
  const pendingRequests = (requests || []).filter(r => {
    if (r.status !== 'pending' && r.status !== 'issued') return false
    if (r.status === 'issued') {
      const task = tasks.find(t => t.id === r.task_id)
      if (!task || task.warehouse_conf) return false
    }

    const parsedName = parseMaterialName(r.details)
    const nameLower = parsedName.toLowerCase()
    const invItem = (inventory || []).find(i => (i.id === r.inventory_id || (parsedName && normalize(i.name) === normalize(parsedName))))
    
    const isSgp = nameLower.startsWith('іп-') || nameLower.startsWith('ip-') || invItem?.type === 'finished' || invItem?.warehouse === 'sgp'
    const isSemi = !isSgp && (invItem?.type === 'semi' || invItem?.warehouse === 'production')
    const isBz = !isSgp && !isSemi && (invItem?.type === 'bz' || invItem?.warehouse === 'sz')
    const isScrap = !isSgp && !isSemi && !isBz && (invItem?.type?.startsWith('scrap') || invItem?.warehouse === 'scrap')

    if (activeTab === 'finished') return isSgp
    if (activeTab === 'semi') return isSemi
    if (activeTab === 'bz') return isBz
    if (activeTab === 'scrap') return isScrap
    if (activeTab === 'raw') return !isSgp && !isSemi && !isBz && !isScrap

    return false
  })

  const groupedRequests = pendingRequests.reduce((acc, req) => {
    const key = req.task_id || `order-${req.order_id}`
    if (!acc[key]) acc[key] = []
    acc[key].push(req)
    return acc
  }, {})

  const handleReserveOrder = (taskId, orderId, orderNum, reqList) => {
    const hasActivePR = (purchaseRequests || []).some(
      pr => (pr.task_id ? String(pr.task_id) === String(taskId) : String(pr.order_id) === String(orderId)) && pr.status === 'pending'
    )
    if (hasActivePR) return

    const missingItems = []
    reqList.forEach(req => {
      const parsedName = parseMaterialName(req.details)
      
      // EXCLUSION: If it's a finished product (IP- prefix or type 'finished'), 
      // the Operational Warehouse doesn't handle its kitting.
      const nameLower = parsedName.toLowerCase()
      const invItem = (inventory || []).find(i =>
        (i.id === req.inventory_id || (parsedName && normalize(i.name) === normalize(parsedName)))
      )
      const isSgp = nameLower.startsWith('іп-') || invItem?.type === 'finished' || invItem?.type === 'semi'
      if (isSgp) return

      const operationalItem = invItem && (invItem.warehouse === 'operational' || !invItem.warehouse) ? invItem : null
      
      const available = operationalItem
        ? (Number(operationalItem.total_qty) || 0) - (Number(operationalItem.reserved_qty) || 0)
        : 0
      const needed = Number(req.quantity)
      if (available < needed) {
        const missingAmount = needed - available
        const reqDescription = parsedName || 'Невідома деталь'
        const nomenclature_id = operationalItem?.nomenclature_id ||
          (nomenclatures || []).find(n => normalize(n.name) === normalize(parsedName))?.id || null
        missingItems.push({
          reqDetails: reqDescription,
          missingAmount,
          inventory_id: operationalItem?.id || req.inventory_id,
          nomenclature_id,
          needed
        })
      }
    })

    if (missingItems.length > 0) {
      setShortages({ orderId, orderNum, taskId, items: missingItems, reqList })
    } else {
      setProcessingTasks(prev => new Set(prev).add(taskId))
      apiService.submitReserveBatch(orderId, reqList, taskId, issueMaterialsBatch).then(() => {
        setProcessingTasks(prev => {
          const next = new Set(prev)
          next.delete(taskId)
          return next
        })
      })
    }
  }

  const sendPurchaseRequest = async () => {
    if (!shortages || isProcessing) return
    setIsProcessing(true)
    try {
      // 1. Надсилаємо запит на дефіцит
      await apiService.submitPurchaseRequest(
        shortages.orderId,
        shortages.orderNum,
        shortages.items,
        shortages.taskId,
        createPurchaseRequest
      )
      
      alert('Запит на дефіцит відправлено до СВ! Ви зможете видати наряд, коли матеріали надійдуть на склад.')
      setShortages(null)
    } catch (err) {
      alert('Помилка: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle adding new inventory item (hybrid: log + save)
  const handleAddInventory = async (e) => {
    e.preventDefault()
    if (isProcessing) return
    setIsProcessing(true)
    try {
      await apiService.submitInventory(newItem, async (data) => {
        const { supabase } = await import('../supabase')
        await supabase.from('inventory').insert([{
          name: data.name,
          unit: data.unit,
          total_qty: Number(data.total_qty) || 0,
          type: data.type || 'raw'
        }])
      })
      setShowAdd(false)
      setNewItem({ name: '', unit: 'шт', total_qty: '', type: activeTab })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="warehouse-module-v2" style={{ background: '#080808', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <nav className="module-nav" style={{ flexShrink: 0 }}>
        <Link to="/" className="back-link"><ArrowLeft size={18} /> <span className="hide-mobile">Назад</span></Link>
        <div className="module-title-group">
          <WarehouseIcon className="text-secondary" size={24} />
          <h1 className="hide-mobile">СКЛАД ОПЕРАТИВНИЙ</h1>
          <h1 className="mobile-only" style={{ fontSize: '1rem' }}>СКЛАД ОПЕРАТИВНИЙ</h1>
        </div>
        <div style={{ fontSize: '0.75rem', color: '#555' }}>
          {currentUser?.first_name} {currentUser?.last_name}
        </div>
      </nav>

      <div className="module-content" style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>

        {/* ЗАЯВКИ НА КОМПЛЕКТАЦІЮ (Тільки для відповідного складу) */}
        {pendingRequests.length > 0 && (
          <div className="content-card glass-panel" style={{ borderLeft: '4px solid #ff9000', marginBottom: '30px', padding: '20px' }}>
            <h3 style={{ fontSize: '0.8rem', color: '#ff9000', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={16} /> ЗАЯВКИ НА КОМПЛЕКТАЦІЮ
            </h3>
            <div style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '10px' }}>
              {Object.entries(groupedRequests).map(([key, reqList]) => {
                const firstReq = reqList[0]
                const orderId = firstReq.order_id
                const taskId = firstReq.task_id
                
                const task = (tasks || []).find(t => t.id === taskId)
                const order = (orders || []).find(o => String(o.id) === String(orderId))
                const orderNum = order?.order_num || '???'
                const displayNum = task?.batch_index ? `${orderNum}/${task.batch_index}` : orderNum

                const activePR = (purchaseRequests || []).find(pr =>
                  (pr.task_id ? String(pr.task_id) === String(taskId) : String(pr.order_id) === String(orderId)) && pr.status === 'pending'
                )
                const acceptedPR = (purchaseRequests || []).find(pr =>
                  (pr.task_id ? String(pr.task_id) === String(taskId) : String(pr.order_id) === String(orderId)) && pr.status === 'accepted'
                )
                const orderedPR = (purchaseRequests || []).find(pr =>
                  (pr.task_id ? String(pr.task_id) === String(taskId) : String(pr.order_id) === String(orderId)) && pr.status === 'ordered'
                )
                const orderedReception = (receptionDocs || []).find(rd =>
                  (rd.task_id ? String(rd.task_id) === String(taskId) : String(rd.order_id) === String(orderId)) && rd.status === 'ordered'
                )
                const pendingReception = (receptionDocs || []).find(rd =>
                  (rd.task_id ? String(rd.task_id) === String(taskId) : String(rd.order_id) === String(orderId)) && (rd.status === 'pending' || rd.status === 'shipped')
                )

                const missingItems = []
                reqList.forEach(req => {
                  const parsedName = parseMaterialName(req.details)
                  const nameLower = parsedName.toLowerCase()
                  
                  const invItem = (inventory || []).find(i =>
                    i.id === req.inventory_id ||
                    (parsedName && normalize(i.name) === normalize(parsedName))
                  )

                  // Skip SGP/Finished items in Operational Warehouse deficit check
                  const isSgp = nameLower.startsWith('іп-') || invItem?.type === 'finished' || invItem?.type === 'semi'
                  if (isSgp) return

                  const available = invItem
                    ? (Number(invItem.total_qty) || 0) - (Number(invItem.reserved_qty) || 0)
                    : 0
                  if (available < Number(req.quantity)) missingItems.push(req)
                })

                const isAllIssued = reqList.every(r => r.status === 'issued')

                // Пріоритетність статусів
                let btnLabel = ''
                let isAwaiting = false

                if (missingItems.length === 0) {
                  // Якщо товару достатньо - завжди показуємо кнопку видачі
                  btnLabel = isAllIssued ? 'ПІДТВЕРДИТИ ВИДАЧУ' : 'ВИДАТИ'
                  isAwaiting = false 
                } else if (activePR) {
                  btnLabel = 'ЗАПИТ НАДІСЛАНО'
                  isAwaiting = true
                } else if (acceptedPR) {
                  btnLabel = 'ЗАПИТ ПРИЙНЯТО'
                  isAwaiting = true
                } else if (orderedPR || orderedReception) {
                  btnLabel = 'ОЧІКУЄ ПРИЙОМКИ'
                  isAwaiting = true
                } else if (pendingReception) {
                  btnLabel = 'ПРИЙОМКА'
                  isAwaiting = false // Дозволяємо натиснути, щоб відкрити панель
                } else {
                  btnLabel = 'ЗІБРАТИ ТА ЗАБРОНЮВАТИ'
                  isAwaiting = false
                }

                const btnColor = isAwaiting ? '#1a1a1a' : (btnLabel === 'ПРИЙОМКА' ? '#0ea5e9' : '#ff9000')
                const textColor = isAwaiting ? '#444' : '#000'

                return (
                  <div key={key} style={{ minWidth: '300px', background: '#111', padding: '15px', borderRadius: '15px', border: '1px solid #222' }}>
                    <strong style={{ display: 'block', fontSize: '0.75rem', marginBottom: '10px' }}>НАРЯД #{displayNum}</strong>
                    <ul style={{ fontSize: '0.8rem', color: '#888', paddingLeft: '15px', marginBottom: '15px' }}>
                      {reqList.map(r => {
                        const parsedName = parseMaterialName(r.details)
                        return <li key={r.id}>{parsedName || r.details} — {r.quantity} од.</li>
                      })}
                    </ul>
                    <button
                      disabled={isAwaiting || processingTasks.has(taskId)}
                      onClick={async () => {
                        if (isAwaiting || processingTasks.has(taskId)) return
                        
                        if (btnLabel === 'ПРИЙОМКА') {
                          setShowReception(true)
                          return
                        }

                        if (isAllIssued && missingItems.length === 0) {
                          setProcessingTasks(prev => new Set(prev).add(taskId))
                          try {
                            await approveWarehouse(taskId)
                          } finally {
                            setProcessingTasks(prev => {
                              const next = new Set(prev)
                              next.delete(taskId)
                              return next
                            })
                          }
                        } else {
                          handleReserveOrder(taskId, orderId, displayNum, reqList)
                        }
                      }}
                      style={{
                        width: '100%', padding: '12px',
                        background: btnColor, color: textColor,
                        border: isAwaiting ? '1px solid #222' : 'none',
                        borderRadius: '10px', fontWeight: 900,
                        cursor: (isAwaiting || processingTasks.has(taskId)) ? 'not-allowed' : 'pointer',
                        fontSize: '0.8rem', textTransform: 'uppercase',
                        opacity: processingTasks.has(taskId) ? 0.5 : 1
                      }}
                    >
                      {processingTasks.has(taskId) ? 'ОБРОБКА...' : btnLabel}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* TABS */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', overflowX: 'auto', paddingBottom: '5px' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setNewItem({ ...newItem, type: tab.id }) }}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: activeTab === tab.id ? '#ff9000' : '#111',
                color: activeTab === tab.id ? '#000' : '#555',
                border: '1px solid #222',
                padding: '12px 20px',
                borderRadius: '14px',
                fontSize: '0.85rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: '0.2s',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span style={{
                  marginLeft: '5px',
                  background: activeTab === tab.id ? '#000' : '#ff9000',
                  color: activeTab === tab.id ? '#ff9000' : '#000',
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  borderRadius: '8px',
                  minWidth: '20px',
                  textAlign: 'center',
                  fontWeight: 1000,
                  boxShadow: activeTab === tab.id ? 'none' : '0 2px 5px rgba(255,144,0,0.3)'
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* MAIN CARD */}
        <div className="content-card glass-panel" style={{ padding: '25px', borderRadius: '24px', background: 'rgba(20,20,20,0.6)', border: '1px solid #222' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '25px' }}>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>
              {tabs.find(t => t.id === activeTab).label.toUpperCase()}
            </h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#444' }} />
                <input
                  style={{ background: '#000', border: '1px solid #222', padding: '8px 12px 8px 35px', borderRadius: '10px', color: '#fff', width: '180px' }}
                  placeholder="Пошук..." value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <button
                onClick={() => setShowReception(!showReception)}
                style={{ 
                  background: 'rgba(255,255,255,0.03)', 
                  color: '#fff', 
                  border: '1px solid rgba(255,255,255,0.05)', 
                  padding: '8px 15px', 
                  borderRadius: '10px', 
                  fontWeight: 800, 
                  cursor: 'pointer', 
                  position: 'relative', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  transition: '0.2s'
                }}
              >
                <Truck size={18} />
                <span className="hide-mobile">ПРИЙОМКА</span>
                {pendingDocs.length > 0 && (
                  <span style={{ 
                    position: 'absolute', top: '-8px', right: '-8px',
                    background: '#ef4444', height: '20px', width: '20px', 
                    borderRadius: '50%', fontSize: '0.65rem', fontWeight: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid #080808', boxShadow: '0 4px 10px rgba(239, 68, 68, 0.4)',
                    animation: 'pulse-red 2s infinite'
                  }}>
                    {pendingDocs.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setShowAdd(!showAdd)}
                style={{ background: '#222', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '10px', cursor: 'pointer' }}
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          {/* RECEPTION PANEL */}
          {showReception && (
            <div style={{ background: '#111', padding: '20px', borderRadius: '15px', marginBottom: '20px', border: '1px solid #333' }}>
              <h4 style={{ color: '#0ea5e9', fontSize: '0.8rem', marginBottom: '15px' }}>ОЧІКУЮТЬ ПРИЙОМКИ</h4>
              {pendingDocs.map(doc => (
                <div key={doc.id} style={{ padding: '15px 20px', background: '#000', borderRadius: '18px', marginBottom: '12px', border: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.65rem', color: '#0ea5e9', fontWeight: 900, textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.05em' }}>
                      ДОКУМЕНТ #{String(doc.id).substring(0, 8)}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {(Array.isArray(doc.items) ? doc.items : []).map((it, idx) => {
                        const nom = (nomenclatures || []).find(n => n.id === it.nomenclature_id)
                        // Назва: номенклатура → reqDetails (склад) → details → name
                        const itemName = nom
                          ? (nom.name + (nom.material_type ? ` (${nom.material_type})` : ''))
                          : (it.reqDetails || it.details || it.name || `Позиція ${idx + 1}`)
                        // Кількість: підтримуємо всі формати
                        const itemQty = it.qty ?? it.missingAmount ?? it.needed ?? it.quantity ?? '?'
                        return (
                          <div key={idx} style={{ background: '#0a0a0a', padding: '5px 10px', borderRadius: '8px', border: '1px solid #222', display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 700 }}>
                              {itemName}
                            </span>
                            <strong style={{ fontSize: '0.85rem', color: '#fff' }}>{itemQty}</strong>
                          </div>
                        )
                      })}
                    </div>
                  </div>
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
                    style={{ marginLeft: '15px', background: '#10b981', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 1000, cursor: processingDocs.has(doc.id) ? 'not-allowed' : 'pointer', fontSize: '0.8rem', opacity: processingDocs.has(doc.id) ? 0.5 : 1 }}
                  >
                    {processingDocs.has(doc.id) ? 'ОБРОБКА...' : 'ПРИЙНЯТИ'}
                  </button>
                </div>
              ))}
              {pendingDocs.length === 0 && (
                <p style={{ color: '#333', fontSize: '0.8rem', textAlign: 'center' }}>Немає активних документів на прийомку</p>
              )}
            </div>
          )}

          {/* ADD ITEM FORM */}
          {showAdd && (
            <form
              onSubmit={handleAddInventory}
              className="stack-mobile"
              style={{ display: 'flex', gap: '10px', padding: '15px', background: '#111', borderRadius: '15px', marginBottom: '20px' }}
            >
              <input
                style={{ flex: 2, background: '#000', border: '1px solid #333', color: '#fff', padding: '10px', borderRadius: '8px' }}
                placeholder="Назва товару..." value={newItem.name}
                onChange={e => setNewItem({ ...newItem, name: e.target.value })} required
              />
              <input
                style={{ flex: 1, background: '#000', border: '1px solid #333', color: '#fff', padding: '10px', borderRadius: '8px' }}
                type="number" placeholder="Кількість" value={newItem.total_qty}
                onChange={e => setNewItem({ ...newItem, total_qty: e.target.value })} required
              />
              <button type="submit" style={{ background: '#ff9000', color: '#000', border: 'none', padding: '10px 30px', borderRadius: '8px', fontWeight: 900, cursor: 'pointer' }}>
                ДОДАТИ
              </button>
            </form>
          )}

          {/* REGISTRY VIEW */}
          {activeTab === 'registry' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {(receptionDocs || [])
                .filter(d => d.target_warehouse === 'operational' || d.source_warehouse === 'operational')
                .map(doc => (
                <div key={doc.id} style={{ background: '#111', borderRadius: '20px', border: '1px solid #222', overflow: 'hidden' }}>
                  <div 
                    onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
                    style={{ padding: '20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                      <div style={{ background: '#0a0a0a', padding: '12px', borderRadius: '12px', color: doc.status === 'completed' ? '#10b981' : '#ff9000' }}>
                        <Package size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>#{String(doc.id).substring(0, 8)}</div>
                        <div style={{ fontSize: '0.65rem', color: '#444' }}>{new Date(doc.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div style={{ 
                      fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', 
                      padding: '5px 12px', borderRadius: '20px', 
                      background: doc.status === 'completed' ? '#10b98122' : '#ff900022',
                      color: doc.status === 'completed' ? '#10b981' : '#ff9000'
                    }}>
                      {doc.status === 'completed' ? 'ВИКОНАНО' : 'В ДОРОЗІ'}
                    </div>
                  </div>
                  
                  {expandedDoc === doc.id && (
                    <div style={{ padding: '20px', background: '#0a0a0a', borderTop: '1px solid #222' }}>
                      <div style={{ marginBottom: '15px' }}>
                        {(Array.isArray(doc.items) ? doc.items : []).map((it, idx) => {
                          const nom = (nomenclatures || []).find(n => n.id === it.nomenclature_id)
                          const itemName = nom ? (nom.name + (nom.material_type ? ` (${nom.material_type})` : '')) : (it.reqDetails || it.details || it.name || `Позиція ${idx + 1}`)
                          const itemQty = it.qty ?? it.missingAmount ?? it.needed ?? it.quantity ?? '?'
                          return (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #111' }}>
                              <span style={{ fontSize: '0.8rem', color: '#888' }}>{itemName}</span>
                              <strong style={{ fontSize: '0.8rem', color: '#fff' }}>{itemQty}</strong>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {(receptionDocs || []).filter(d => d.target_warehouse === 'operational' || d.source_warehouse === 'operational').length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px', color: '#333', fontSize: '0.85rem' }}>Історія порожня</div>
              )}
            </div>
          )}

          {/* DESKTOP TABLE */}
          {activeTab !== 'registry' && (
            <>
              <div className="table-responsive-container hide-mobile">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #222', textAlign: 'left' }}>
                      <th className="sticky-col" style={{ padding: '15px', fontSize: '0.7rem', color: '#555' }}>НАЙМЕНУВАННЯ</th>
                      <th style={{ padding: '15px', fontSize: '0.7rem', color: '#555', textAlign: 'center' }}>НАЯВНІСТЬ</th>
                      <th style={{ padding: '15px', fontSize: '0.7rem', color: '#555', textAlign: 'center' }}>РЕЗЕРВ</th>
                      <th style={{ padding: '15px', fontSize: '0.7rem', color: '#555', textAlign: 'right' }}>ОСТАННЄ ОНОВЛЕННЯ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: '#333', fontSize: '0.85rem' }}>
                          Позицій не знайдено
                        </td>
                      </tr>
                    )}
                    {filteredInventory.map(item => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #151515' }}>
                        <td className="sticky-col" style={{ padding: '15px', fontWeight: 800 }}>
                          {item.name}
                          {item.type?.startsWith('scrap') && (() => {
                            const types = {
                              'scrap': { label: 'Прийомка', color: '#555' },
                              'scrap_ready': { label: 'До обробки', color: '#ef4444' },
                              'scrap_cat_1': { label: 'Кат. 1', color: '#10b981' },
                              'scrap_cat_2': { label: 'Кат. 2', color: '#eab308' },
                              'scrap_cat_3': { label: 'Кат. 3', color: '#f97316' },
                              'scrap_cat_4': { label: 'Кат. 4', color: '#ef4444' },
                            }
                            const t = types[item.type] || { label: item.type, color: '#333' }
                            return (
                              <span style={{ 
                                marginLeft: '10px', fontSize: '0.6rem', color: t.color, 
                                border: `1px solid ${t.color}40`, padding: '2px 6px', 
                                borderRadius: '4px', textTransform: 'uppercase', fontWeight: 900
                              }}>
                                {t.label}
                              </span>
                            )
                          })()}
                        </td>
                        <td style={{ padding: '15px', textAlign: 'center', color: activeTab === 'scrap' ? '#ef4444' : '#ff9000', fontWeight: 900 }}>
                          {item.total_qty || 0}{' '}
                          <small style={{ color: '#444', fontWeight: 400 }}>{item.unit}</small>
                        </td>
                        <td style={{ padding: '15px', textAlign: 'center', color: Number(item.reserved_qty) > 0 ? '#3b82f6' : '#222', fontWeight: 800 }}>
                          {item.reserved_qty || 0}
                        </td>
                        <td style={{ padding: '15px', textAlign: 'right', color: '#333', fontSize: '0.7rem' }}>
                          {item.updated_at
                            ? `${new Date(item.updated_at).toLocaleDateString()} ${new Date(item.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* MOBILE CARDS */}
              <div className="mobile-only">
                {filteredInventory.map(item => (
                  <div key={item.id} style={{ background: '#111', padding: '15px', borderRadius: '16px', border: '1px solid #222', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <strong>{item.name}</strong>
                      <span style={{ fontSize: '0.7rem', color: '#444' }}>{item.unit}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '20px' }}>
                      <div>
                        <div style={{ fontSize: '0.6rem', color: '#555' }}>НАЯВНІСТЬ</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#ff9000' }}>
                          {item.total_qty || 0}
                        </div>
                      </div>
                      {activeTab !== 'bz' && (
                        <div>
                          <div style={{ fontSize: '0.6rem', color: '#555' }}>РЕЗЕРВ</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#3b82f6' }}>{item.reserved_qty || 0}</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* SHORTAGE MODAL */}
      {shortages && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#111', border: '1px solid #333', borderRadius: '24px', padding: '30px', width: '100%', maxWidth: '400px' }}>
            <h3 style={{ color: '#ef4444', margin: '0 0 15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={24} /> ДЕФІЦИТ МАТЕРІАЛІВ
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '20px' }}>
              Для замовлення #{shortages.orderNum} не вистачає наступних позицій:
            </p>
            <div style={{ background: '#000', padding: '15px', borderRadius: '12px', marginBottom: '25px', maxHeight: '200px', overflowY: 'auto' }}>
              {shortages.items.map((i, idx) => (
                <div key={idx} style={{ fontSize: '0.85rem', marginBottom: '8px', borderBottom: '1px solid #111', paddingBottom: '5px' }}>
                  {i.reqDetails}: <strong style={{ color: '#ef4444' }}>{i.missingAmount}шт</strong>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShortages(null)}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', background: '#222', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 800 }}
              >
                НАЗАД
              </button>
              <button
                disabled={isProcessing}
                onClick={sendPurchaseRequest}
                style={{ flex: 2, padding: '12px', borderRadius: '10px', background: '#ef4444', color: '#fff', border: 'none', fontWeight: 900, cursor: isProcessing ? 'not-allowed' : 'pointer', opacity: isProcessing ? 0.5 : 1 }}
              >
                {isProcessing ? 'ОБРОБКА...' : 'НАДІСЛАТИ ЗАПИТ НА СВ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WarehouseModuleV2
