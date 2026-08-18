import React, { useState, useMemo, useEffect } from 'react'
import {
  Warehouse as WarehouseIcon,
  ArrowLeft,
  Package,
  Plus,
  Truck,
  Layers,
  Archive,
  AlertTriangle,
  Search,
  History,
  Pencil,
  Check,
  X,
  FolderOpen,
  QrCode,
  CheckCircle2
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMES } from '../MESContext'
import { supabase } from '../supabase'

// Hooks
import { getMaterialType, useWarehouseComputed } from './Warehouse/hooks/useWarehouseComputed'
import { useWarehouseHandlers } from './Warehouse/hooks/useWarehouseHandlers'

// Components
import { ScannerPanel } from './Warehouse/components/ScannerPanel'
import { ShortageModal } from './Warehouse/components/ShortageModal'
import { MaterialDetailModal } from './Warehouse/components/MaterialDetailModal'
import { KittingModal } from './Warehouse/components/KittingModal'
import { ConsumablesQueue } from './Warehouse/components/ConsumablesQueue'
import { BoxesView } from './Warehouse/components/BoxesView'
import { RegistryView } from './Warehouse/components/RegistryView'
import { ReserveAnalysisModal } from './Warehouse/components/ReserveAnalysisModal'
import { useManualInventoryIssue } from './Warehouse/ManualIssue/useManualInventoryIssue'
import { ManualInventoryIssueUI, ManualIssueJournalButton } from './Warehouse/ManualIssue/ManualInventoryIssueUI'

const WarehouseModuleV2 = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    inventory, requests, issueMaterials, issueMaterialsBatch,
    nomenclatures, receptionDocs, confirmReception,
    orders, tasks, approveWarehouse, createPurchaseRequest,
    purchaseRequests, receiveInventory, currentUser, fetchModuleData,
    fetchData, managers, refreshTable, machineOperations, workCards
  } = useMES()

  // Load warehouse-specific data on mount
  useEffect(() => { 
    if (typeof fetchData === 'function') {
      // Critical/global data is already restored by useData + IndexedDB and
      // kept current via realtime. Re-fetching every large table here caused a
      // multi-second main-thread stall on each warehouse entry. Only reception
      // documents are latency-sensitive for this screen.
      fetchData(['reception_docs'])
    }
  }, [])

  const [activeTab, setActiveTab] = useState(() => {
    return searchParams.get('tab') || 'raw'
  })

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam)
    }
  }, [searchParams])

  const [showAdd, setShowAdd] = useState(false)
  const [showReception, setShowReception] = useState(false)
  const [shortages, setShortages] = useState(null)
  const [newItem, setNewItem] = useState({ name: '', unit: 'шт', total_qty: '', type: 'raw', pocket_owner: '' })
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPocketOwner, setSelectedPocketOwner] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingDocs, setProcessingDocs] = useState(new Set())
  const [processingTasks, setProcessingTasks] = useState(new Set())
  const [expandedDoc, setExpandedDoc] = useState(null)
  
  // editingQty: { [requestId]: inputValue }
  const [editingQty, setEditingQty] = useState({})
  const [savingQty, setSavingQty] = useState(new Set())

  // Cutter box state
  const [checkedCutters, setCheckedCutters] = useState({})
  const [expandedNaryads, setExpandedNaryads] = useState({})
  const [expandedNomenclatures, setExpandedNomenclatures] = useState({})

  // Super admin inventory editing state
  const [editingInvId, setEditingInvId] = useState(null)
  const [editingInvTotal, setEditingInvTotal] = useState('')
  const [editingInvReserved, setEditingInvReserved] = useState('')
  const [savingInv, setSavingInv] = useState(false)

  const [isScanning, setIsScanning] = useState(false)
  const [scannedCard, setScannedCard] = useState(null)
  const [scannedRequests, setScannedRequests] = useState([])
  const [kittingBoxItem, setKittingBoxItem] = useState(null)
  const [isIssuingCard, setIsIssuingCard] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [manualCardInput, setManualCardInput] = useState('')
  const [manualSearchInput, setManualSearchInput] = useState('')
  const [reserveAnalysisItem, setReserveAnalysisItem] = useState(null)

  const itemsPerPage = 8
  const [currentPage, setCurrentPage] = useState(1)

  // Computed values
  const {
    cardsWithBoxes,
    filteredInventory,
    groupedPocketInventory,
    pendingRequests,
    groupedRequests
  } = useWarehouseComputed({
    inventory,
    requests,
    nomenclatures,
    receptionDocs,
    tasks,
    workCards,
    machineOperations,
    activeTab,
    searchQuery,
    selectedPocketOwner
  })

  // Handlers Hook
  const handlers = useWarehouseHandlers({
    nomenclatures,
    inventory,
    tasks,
    purchaseRequests,
    receptionDocs,
    machineOperations,
    activeTab,
    fetchData,
    refreshTable,
    issueMaterialsBatch,
    createPurchaseRequest,
    approveWarehouse,
    setIsScanning,
    scannedCard,
    setScannedCard,
    setScannedRequests,
    setKittingBoxItem,
    setCameraError,
    setManualCardInput,
    setIsProcessing,
    setProcessingTasks,
    setProcessingDocs,
    setShortages,
    setNewItem,
    setShowAdd,
    setEditingQty,
    setSavingQty,
    setEditingInvId,
    setEditingInvTotal,
    setEditingInvReserved,
    setSavingInv,
    checkedCutters,
    setCheckedCutters,
    editingQty,
    savingQty,
    editingInvTotal,
    editingInvReserved,
    savingInv,
    scannedRequests,
    shortages,
    isProcessing,
    newItem
  })

  const manualIssue = useManualInventoryIssue({
    nomenclatures,
    inventory,
    currentUser,
    sourceModule: 'warehouse',
    refreshTable
  })

  const handleWarehouseScan = async rawValue => {
    if (manualIssue.handleScannedCode(rawValue)) {
      setIsScanning(false)
      return
    }
    return handlers.handleCardScan(rawValue)
  }

  const pendingDocs = useMemo(() => {
    return receptionDocs
      ? receptionDocs.filter(d => (d.status === 'shipped' || d.status === 'ordered') && d.target_warehouse === (activeTab === 'pocket' ? 'pocket' : 'operational'))
      : []
  }, [receptionDocs, activeTab])

  const tabs = useMemo(() => {
    const taskMap = new Map((tasks || []).map(task => [String(task.id), task]))
    const groupedByType = new Map()

    ;(requests || []).forEach(r => {
      if (r.status !== 'pending' && r.status !== 'issued') return
      const task = r.task_id ? taskMap.get(String(r.task_id)) : null
      if (r.status === 'issued' && (!task || task.warehouse_conf === 'true' || task.warehouse_conf === 'partial')) return
      if (r.details && (r.details.includes('ПІДГОТОВ') || r.details.includes('ЗАПИТ НА ПІДГОТОВКУ'))) return
      if (task?.step === 'Підготовка') return

      const itemType = getMaterialType(r, nomenclatures, inventory)
      if (!groupedByType.has(itemType)) groupedByType.set(itemType, new Set())
      groupedByType.get(itemType).add(r.task_id || `order-${r.order_id}`)
    })

    const receptionCounts = (receptionDocs || []).reduce((counts, doc) => {
      if (doc.status !== 'shipped' && doc.status !== 'ordered') return counts
      if (doc.target_warehouse === 'operational') counts.raw += 1
      if (doc.target_warehouse === 'pocket') counts.pocket += 1
      return counts
    }, { raw: 0, pocket: 0 })

    const getCount = tabId => (groupedByType.get(tabId)?.size || 0) + (receptionCounts[tabId] || 0)
    return [
      { id: 'raw', label: 'Оперативний', icon: <Package size={18} />, count: getCount('raw') },
      { id: 'boxes', label: 'Бокси фрез', icon: <WarehouseIcon size={18} />, count: cardsWithBoxes.filter(c => !c.isPrepared).length },
      { id: 'pocket', label: 'Кишеня майстра', icon: <FolderOpen size={18} />, count: getCount('pocket') },
      { id: 'semi', label: 'Напівфабрикати', icon: <Layers size={18} />, count: getCount('semi') },
      { id: 'finished', label: 'Готова продукція', icon: <Archive size={18} />, count: getCount('finished') },
      { id: 'scrap', label: 'Брак', icon: <AlertTriangle size={18} />, count: getCount('scrap') },
      { id: 'bz', label: 'БЗ', icon: <CheckCircle2 size={18} />, count: getCount('bz') },
      { id: 'registry', label: 'Реєстр', icon: <History size={18} /> }
    ]
  }, [requests, tasks, receptionDocs, nomenclatures, inventory, cardsWithBoxes])

  return (
    <div className="warehouse-module-v2" style={{ background: '#080808', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <nav className="module-nav" style={{ 
        flexShrink: 0, 
        padding: window.innerWidth < 768 ? '10px 15px' : '15px 25px', 
        background: '#111', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        borderBottom: '1px solid #222',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: window.innerWidth < 768 ? '8px' : '20px', width: '100%', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: window.innerWidth < 768 ? '8px' : '20px' }}>
            <Link to="/" className="back-link" style={{ color: '#555', transition: '0.3s', display: 'flex', alignItems: 'center' }}><ArrowLeft size={18} /> <span className="hide-mobile" style={{ marginLeft: '5px' }}>Назад</span></Link>
            <div className="module-title-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <WarehouseIcon className="text-secondary" size={18} style={{ color: '#ff9000' }} />
              <h1 className="hide-mobile" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 950, letterSpacing: '-0.02em' }}>СКЛАД ОПЕРАТИВНИЙ</h1>
              <h1 className="mobile-only" style={{ margin: 0, fontSize: '0.85rem', fontWeight: 950 }}>СКЛАД</h1>
              <button
                type="button"
                onClick={() => {
                  const url = new URL(window.location.href)
                  url.searchParams.delete('tab')
                  url.searchParams.set('tab', activeTab)
                  navigator.clipboard.writeText(url.toString())
                  alert('Посилання скопійовано!')
                }}
                style={{
                  background: 'rgba(255, 144, 0, 0.1)',
                  border: '1px solid rgba(255, 144, 0, 0.3)',
                  color: '#ff9000',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  fontSize: '0.65rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  marginLeft: '5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>🔗</span>
                <span className="hide-mobile">Копіювати посилання</span>
                <span className="mobile-only">ЛІНК</span>
              </button>
            </div>
          </div>
          
          <button
            onClick={() => setShowReception(!showReception)}
            style={{
              background: showReception 
                ? 'linear-gradient(135deg, #0ea5e9, #0284c7)' 
                : (pendingDocs.length > 0 ? 'rgba(14, 165, 233, 0.2)' : 'rgba(14, 165, 233, 0.08)'),
              color: showReception ? '#000' : '#0ea5e9',
              border: showReception ? 'none' : '1px solid rgba(14, 165, 233, 0.4)',
              padding: window.innerWidth < 768 ? '8px 12px' : '10px 20px',
              borderRadius: '10px',
              fontSize: '0.75rem',
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              position: 'relative',
              boxShadow: pendingDocs.length > 0 ? '0 0 15px rgba(14, 165, 233, 0.4)' : 'none',
              animation: pendingDocs.length > 0 ? 'pulse-blue 2s infinite' : 'none',
              transition: 'all 0.2s'
            }}
          >
            <Truck size={14} /> 
            <span className="hide-mobile">ПРИЙОМКА</span>
            <span className="mobile-only">ПРИЙОМКА</span>
            {pendingDocs.length > 0 && (
              <span className="badge-count anim-pulse" style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#ef4444', color: '#fff', borderRadius: '50%', fontSize: '10px', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                {pendingDocs.length}
              </span>
            )}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <ManualIssueJournalButton onClick={manualIssue.openJournal} compact={window.innerWidth < 900} />
          <div className="hide-mobile" style={{ color: '#555', fontSize: '0.75rem', fontWeight: 600 }}>
            {currentUser?.first_name} {currentUser?.last_name}
          </div>
        </div>
      </nav>

      <div className="module-content" style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>

        {pendingDocs.length > 0 && (
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
            // Lightweight compositor-only attention pulse: no scaling or
            // animated box-shadow, so initial data rendering stays smooth.
            animation: 'warehouse-reception-attention 1.4s ease-in-out infinite',
            willChange: 'opacity',
            flexWrap: 'wrap',
            gap: '15px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ background: '#0ea5e9', padding: '12px', borderRadius: '14px', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Truck size={22} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#fff' }}>
                  У ВАС Є НОВІ ПОСТАВКИ ДЛЯ ПРИЙОМКИ!
                </h4>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#888' }}>
                  Очікує підтвердження: <strong style={{ color: '#0ea5e9' }}>{pendingDocs.length}</strong> документ(ів)
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowReception(true)}
              style={{
                background: '#0ea5e9', color: '#000', border: 'none',
                padding: '12px 24px', borderRadius: '12px', fontWeight: 900,
                fontSize: '0.8rem', cursor: 'pointer', textTransform: 'uppercase',
                boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)', transition: '0.2s',
                letterSpacing: '0.05em'
              }}
            >
              Відкрити прийомку
            </button>
          </div>
        )}

        {/* Scanner Overlay Panel */}
        <ScannerPanel
          isScanning={isScanning}
          setIsScanning={setIsScanning}
          cameraError={cameraError}
          manualCardInput={manualCardInput}
          setManualCardInput={setManualCardInput}
          handleCardScan={handleWarehouseScan}
        />

        <ManualInventoryIssueUI controller={manualIssue} />

        {showReception && (
          <div className="content-card glass-panel" style={{ background: '#111', border: '1px solid #333', borderRadius: '24px', padding: '25px', marginBottom: '30px' }}>
            <h3 style={{ fontSize: '0.85rem', color: '#0ea5e9', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Truck size={18} /> ОЧІКУЮТЬ ПРИЙОМКИ НА СО
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {pendingDocs.map(doc => (
                <div key={doc.id} style={{ padding: '15px 20px', background: '#000', borderRadius: '18px', border: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.65rem', color: '#0ea5e9', fontWeight: 900, textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.05em' }}>
                      ДОКУМЕНТ #{String(doc.id).substring(0, 8)}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {(Array.isArray(doc.items) ? doc.items : []).map((it, idx) => {
                        const nom = (nomenclatures || []).find(n => n.id === it.nomenclature_id)
                        const itemName = nom
                          ? (nom.name + (nom.material_type ? ` (${nom.material_type})` : ''))
                          : (it.reqDetails || it.details || it.name || `Позиція ${idx + 1}`)
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
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <button
                        type="button"
                        onClick={async () => {
                          if (window.confirm('Перенаправити прийомку на Склад Виробництва (СВ)?')) {
                            const { error } = await supabase.from('reception_docs').update({ target_warehouse: 'production' }).eq('id', doc.id)
                            if (!error) refreshTable('reception_docs')
                          }
                        }}
                        style={{ background: 'rgba(255, 144, 0, 0.05)', border: '1px solid rgba(255, 144, 0, 0.3)', color: '#ff9000', padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s' }}
                      >
                        Перенаправити на СВ
                      </button>
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
          </div>
        )}

        {/* Consumables requests queue list */}
        <ConsumablesQueue
          groupedRequests={groupedRequests}
          tasks={tasks}
          orders={orders}
          purchaseRequests={purchaseRequests}
          receptionDocs={receptionDocs}
          inventory={inventory}
          nomenclatures={nomenclatures}
          currentUser={currentUser}
          editingQty={editingQty}
          setEditingQty={setEditingQty}
          savingQty={savingQty}
          handleSaveConsumableQty={handlers.handleSaveConsumableQty}
          handleDeleteRequest={handlers.handleDeleteRequest}
          handleDeleteEntireRequest={handlers.handleDeleteEntireRequest}
          processingTasks={processingTasks}
          setShowReception={setShowReception}
          approveWarehouse={approveWarehouse}
          handleReserveOrder={handlers.handleReserveOrder}
          workCards={workCards}
        />

        {/* Tabs Bar */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', overflowX: 'auto', paddingBottom: '5px' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                setNewItem({ ...newItem, type: tab.id, pocket_owner: '' })
                setSearchParams({ tab: tab.id })
                setSelectedPocketOwner('')
              }}
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

        {/* Main Content card */}
        <div className="content-card glass-panel" style={{ padding: '25px 25px 120px', borderRadius: '24px', background: 'rgba(20,20,20,0.6)', border: '1px solid #222' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '25px' }}>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>
              {tabs.find(t => t.id === activeTab)?.label.toUpperCase()}
            </h2>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {activeTab === 'pocket' && (
                <select
                  value={selectedPocketOwner}
                  onChange={e => setSelectedPocketOwner(e.target.value)}
                  style={{ background: '#000', border: '1px solid #222', padding: '8px 12px', borderRadius: '10px', color: '#fff', fontSize: '0.85rem', outline: 'none' }}
                >
                  <option value="">Усі майстри</option>
                  {(managers || []).filter(m => m.toLowerCase().includes('майстер')).map((m, idx) => (
                    <option key={idx} value={m}>{m}</option>
                  ))}
                </select>
              )}
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#444' }} />
                <input
                  style={{ background: '#000', border: '1px solid #222', padding: '8px 12px 8px 35px', borderRadius: '10px', color: '#fff', width: '180px' }}
                  placeholder="Пошук..." value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <button
                onClick={() => setShowAdd(!showAdd)}
                style={{ background: '#222', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '10px', cursor: 'pointer' }}
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          {showAdd && (
            <form
              onSubmit={handlers.handleAddInventory}
              className="stack-mobile"
              style={{ display: 'flex', gap: '10px', padding: '15px', background: '#111', borderRadius: '15px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}
            >
              <input
                style={{ flex: 2, minWidth: '200px', background: '#000', border: '1px solid #333', color: '#fff', padding: '10px', borderRadius: '8px' }}
                placeholder="Назва товару..." value={newItem.name}
                onChange={e => setNewItem({ ...newItem, name: e.target.value })} required
              />
              <input
                style={{ flex: 1, minWidth: '100px', background: '#000', border: '1px solid #333', color: '#fff', padding: '10px', borderRadius: '8px' }}
                type="number" placeholder="Кількість" value={newItem.total_qty}
                onChange={e => setNewItem({ ...newItem, total_qty: e.target.value })} required
              />
              {activeTab === 'pocket' && (
                <select
                  value={newItem.pocket_owner || ''}
                  onChange={e => setNewItem({ ...newItem, pocket_owner: e.target.value })}
                  style={{ flex: 1, minWidth: '150px', background: '#000', border: '1px solid #333', color: '#fff', padding: '10px', borderRadius: '8px' }}
                  required
                >
                  <option value="">-- Оберіть майстра --</option>
                  {(managers || []).filter(m => m.toLowerCase().includes('майстер')).map((m, idx) => (
                    <option key={idx} value={m}>{m}</option>
                  ))}
                </select>
              )}
              <button type="submit" style={{ background: '#ff9000', color: '#000', border: 'none', padding: '10px 30px', borderRadius: '8px', fontWeight: 900, cursor: 'pointer' }}>
                ДОДАТИ
              </button>
            </form>
          )}

          {activeTab === 'registry' && (
            <RegistryView
              receptionDocs={receptionDocs}
              nomenclatures={nomenclatures}
              expandedDoc={expandedDoc}
              setExpandedDoc={setExpandedDoc}
            />
          )}

          {activeTab !== 'registry' && activeTab !== 'boxes' && (
            <>
              <div className="table-responsive-container hide-mobile">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #222', textAlign: 'left' }}>
                      <th className="sticky-col" style={{ padding: '15px', fontSize: '0.7rem', color: '#555' }}>НАЙМЕНУВАННЯ</th>
                      <th style={{ padding: '15px', fontSize: '0.7rem', color: '#555', textAlign: 'center' }}>НАЯВНІСТЬ</th>
                      <th style={{ padding: '15px', fontSize: '0.7rem', color: '#555', textAlign: 'center' }}>ВІЛЬНО</th>
                      <th style={{ padding: '15px', fontSize: '0.7rem', color: '#555', textAlign: 'center' }}>РЕЗЕРВ</th>
                      <th style={{ padding: '15px', fontSize: '0.7rem', color: '#555', textAlign: 'right' }}>ОСТАННЄ ОНОВЛЕННЯ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#333', fontSize: '0.85rem' }}>
                          Позицій не знайдено
                        </td>
                      </tr>
                    ) : activeTab === 'pocket' ? (
                      Object.entries(groupedPocketInventory).map(([owner, items]) => (
                        <React.Fragment key={owner}>
                          <tr style={{ background: 'rgba(255, 144, 0, 0.04)', borderBottom: '1px solid #222' }}>
                            <td colSpan={5} style={{ padding: '12px 15px', fontWeight: 900, color: '#ff9000', fontSize: '0.85rem', letterSpacing: '0.03em' }}>
                              👤 МАЙСТЕР: {owner.toUpperCase()}
                            </td>
                          </tr>
                          {items.map(item => (
                            <tr key={item.id} style={{ borderBottom: '1px solid #151515' }}>
                              <td className="sticky-col" style={{ padding: '15px 15px 15px 30px', fontWeight: 800 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span>{item.name}</span>
                                  {currentUser?.login === 'admin@workshop.local' && editingInvId !== item.id && (
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
                                    onKeyDown={e => { if (e.key === 'Enter') handlers.handleSaveInventoryQty(item.id) }}
                                    style={{ width: '80px', background: '#000', border: '1px solid #ff9000', color: '#fff', textAlign: 'center', borderRadius: '6px', padding: '4px' }}
                                  />
                                ) : (
                                  <>{item.total_qty || 0} <small style={{ color: '#444', fontWeight: 400 }}>{item.unit}</small></>
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
                                      onKeyDown={e => { if (e.key === 'Enter') handlers.handleSaveInventoryQty(item.id) }}
                                      style={{ width: '80px', background: '#000', border: '1px solid #3b82f6', color: '#fff', textAlign: 'center', borderRadius: '6px', padding: '4px' }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handlers.handleSaveInventoryQty(item.id)}
                                      disabled={savingInv}
                                      style={{ background: '#10b981', border: 'none', borderRadius: '6px', padding: '5px 10px', color: '#000', fontWeight: 900, cursor: 'pointer' }}
                                    >
                                      {savingInv ? '...' : <Check size={14} />}
                                    </button>
                                    <button type="button" onClick={() => setEditingInvId(null)} style={{ background: '#222', border: 'none', borderRadius: '6px', padding: '5px 10px', color: '#fff', cursor: 'pointer' }}><X size={14} /></button>
                                  </div>
                                ) : (
                                    Number(item.reserved_qty) > 0 ? (
                                      <span 
                                        onClick={() => setReserveAnalysisItem(item)}
                                        style={{ textDecoration: 'underline', cursor: 'pointer', color: '#3b82f6' }}
                                        title="Аналіз резерву"
                                      >
                                        {item.reserved_qty}
                                      </span>
                                    ) : (
                                      0
                                    )
                                  )}
                              </td>
                              <td style={{ padding: '15px', textAlign: 'right', color: '#333', fontSize: '0.7rem' }}>
                                {item.updated_at ? `${new Date(item.updated_at).toLocaleDateString()} ${new Date(item.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '—'}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))
                    ) : (
                      filteredInventory.map(item => (
                        <tr key={item.id} style={{ borderBottom: '1px solid #151515' }}>
                          <td className="sticky-col" style={{ padding: '15px', fontWeight: 800 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span>{item.name}</span>
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
                                  <span style={{ fontSize: '0.6rem', color: t.color, border: `1px solid ${t.color}40`, padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 900 }}>
                                    {t.label}
                                  </span>
                                )
                              })()}
                              {currentUser?.login === 'admin@workshop.local' && editingInvId !== item.id && (
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
                          <td style={{ padding: '15px', textAlign: 'center', color: activeTab === 'scrap' ? '#ef4444' : '#ff9000', fontWeight: 900 }}>
                            {editingInvId === item.id ? (
                              <input
                                type="number"
                                value={editingInvTotal}
                                onChange={e => setEditingInvTotal(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handlers.handleSaveInventoryQty(item.id) }}
                                style={{ width: '80px', background: '#000', border: '1px solid #ff9000', color: '#fff', textAlign: 'center', borderRadius: '6px', padding: '4px' }}
                              />
                            ) : (
                              <>{item.total_qty || 0} <small style={{ color: '#444', fontWeight: 400 }}>{item.unit}</small></>
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
                                  onKeyDown={e => { if (e.key === 'Enter') handlers.handleSaveInventoryQty(item.id) }}
                                  style={{ width: '80px', background: '#000', border: '1px solid #3b82f6', color: '#fff', textAlign: 'center', borderRadius: '6px', padding: '4px' }}
                                />
                                <button
                                  type="button"
                                  onClick={() => handlers.handleSaveInventoryQty(item.id)}
                                  disabled={savingInv}
                                  style={{ background: '#10b981', border: 'none', borderRadius: '6px', padding: '5px 10px', color: '#000', fontWeight: 900, cursor: 'pointer' }}
                                >
                                  {savingInv ? '...' : <Check size={14} />}
                                </button>
                                <button type="button" onClick={() => setEditingInvId(null)} style={{ background: '#222', border: 'none', borderRadius: '6px', padding: '5px 10px', color: '#fff', cursor: 'pointer' }}><X size={14} /></button>
                              </div>
                            ) : (
                                Number(item.reserved_qty) > 0 ? (
                                  <span 
                                    onClick={() => setReserveAnalysisItem(item)}
                                    style={{ textDecoration: 'underline', cursor: 'pointer', color: '#3b82f6' }}
                                    title="Аналіз резерву"
                                  >
                                    {item.reserved_qty}
                                  </span>
                                ) : (
                                  0
                                )
                              )}
                          </td>
                          <td style={{ padding: '15px', textAlign: 'right', color: '#333', fontSize: '0.7rem' }}>
                            {item.updated_at ? `${new Date(item.updated_at).toLocaleDateString()} ${new Date(item.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mobile-only">
                {activeTab === 'pocket' ? (
                  Object.entries(groupedPocketInventory).map(([owner, items]) => (
                    <div key={owner} style={{ marginBottom: '20px' }}>
                      <div style={{ fontWeight: 900, color: '#ff9000', fontSize: '0.85rem', marginBottom: '10px', padding: '8px 12px', background: 'rgba(255, 144, 0, 0.04)', borderRadius: '10px', letterSpacing: '0.03em' }}>
                        👤 МАЙСТЕР: {owner.toUpperCase()}
                      </div>
                      {items.map(item => (
                        <div key={item.id} style={{ background: '#111', padding: '15px', borderRadius: '16px', border: '1px solid #222', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                            <strong>{item.name}</strong>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '0.7rem', color: '#444' }}>{item.unit}</span>
                              {currentUser?.login === 'admin@workshop.local' && editingInvId !== item.id && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingInvId(item.id)
                                    setEditingInvTotal(String(item.total_qty || 0))
                                    setEditingInvReserved(String(item.reserved_qty || 0))
                                  }}
                                  style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', padding: '4px' }}
                                >
                                  <Pencil size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '20px', flexDirection: editingInvId === item.id ? 'column' : 'row' }}>
                            {editingInvId === item.id ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                                <div>
                                  <label style={{ fontSize: '0.65rem', color: '#555', display: 'block', marginBottom: '4px' }}>НАЯВНІСТЬ</label>
                                  <input
                                    type="number"
                                    value={editingInvTotal}
                                    onChange={e => setEditingInvTotal(e.target.value)}
                                    style={{ width: '100%', background: '#000', border: '1px solid #ff9000', color: '#fff', borderRadius: '6px', padding: '8px', boxSizing: 'border-box' }}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: '0.65rem', color: '#555', display: 'block', marginBottom: '4px' }}>РЕЗЕРВ</label>
                                  <input
                                    type="number"
                                    value={editingInvReserved}
                                    onChange={e => setEditingInvReserved(e.target.value)}
                                    style={{ width: '100%', background: '#000', border: '1px solid #3b82f6', color: '#fff', borderRadius: '6px', padding: '8px', boxSizing: 'border-box' }}
                                  />
                                </div>
                                <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                                  <button
                                    type="button"
                                    onClick={() => handlers.handleSaveInventoryQty(item.id)}
                                    disabled={savingInv}
                                    style={{ flex: 1, background: '#10b981', color: '#000', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 900, cursor: 'pointer' }}
                                  >
                                    {savingInv ? '...' : 'ЗБЕРЕГТИ'}
                                  </button>
                                  <button type="button" onClick={() => setEditingInvId(null)} style={{ flex: 1, background: '#222', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer' }}>СКАСУВАТИ</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div>
                                  <div style={{ fontSize: '0.6rem', color: '#555' }}>НАЯВНІСТЬ</div>
                                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#ff9000' }}>{item.total_qty || 0}</div>
                                </div>
                                {activeTab !== 'bz' && (
                                  <div>
                                    <div style={{ fontSize: '0.6rem', color: '#555' }}>ВІЛЬНО</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#10b981' }}>{(item.total_qty || 0) - (item.reserved_qty || 0)}</div>
                                  </div>
                                )}
                                {activeTab !== 'bz' && (
                                  <div>
                                    <div style={{ fontSize: '0.6rem', color: '#555' }}>РЕЗЕРВ</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#3b82f6' }}>
                                  {Number(item.reserved_qty) > 0 ? (
                                    <span 
                                      onClick={() => setReserveAnalysisItem(item)}
                                      style={{ textDecoration: 'underline', cursor: 'pointer' }}
                                    >
                                      {item.reserved_qty}
                                    </span>
                                  ) : (
                                    0
                                  )}
                                </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                ) : (
                  filteredInventory.map(item => (
                    <div key={item.id} style={{ background: '#111', padding: '15px', borderRadius: '16px', border: '1px solid #222', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <strong>{item.name}</strong>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.7rem', color: '#444' }}>{item.unit}</span>
                          {currentUser?.login === 'admin@workshop.local' && editingInvId !== item.id && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingInvId(item.id)
                                setEditingInvTotal(String(item.total_qty || 0))
                                setEditingInvReserved(String(item.reserved_qty || 0))
                              }}
                              style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', padding: '4px' }}
                            >
                              <Pencil size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '20px', flexDirection: editingInvId === item.id ? 'column' : 'row' }}>
                        {editingInvId === item.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                            <div>
                              <label style={{ fontSize: '0.65rem', color: '#555', display: 'block', marginBottom: '4px' }}>НАЯВНІСТЬ</label>
                              <input
                                type="number"
                                value={editingInvTotal}
                                onChange={e => setEditingInvTotal(e.target.value)}
                                style={{ width: '100%', background: '#000', border: '1px solid #ff9000', color: '#fff', borderRadius: '6px', padding: '8px', boxSizing: 'border-box' }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.65rem', color: '#555', display: 'block', marginBottom: '4px' }}>РЕЗЕРВ</label>
                              <input
                                type="number"
                                value={editingInvReserved}
                                onChange={e => setEditingInvReserved(e.target.value)}
                                style={{ width: '100%', background: '#000', border: '1px solid #3b82f6', color: '#fff', borderRadius: '6px', padding: '8px', boxSizing: 'border-box' }}
                              />
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                              <button
                                type="button"
                                onClick={() => handlers.handleSaveInventoryQty(item.id)}
                                disabled={savingInv}
                                style={{ flex: 1, background: '#10b981', color: '#000', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 900, cursor: 'pointer' }}
                              >
                                {savingInv ? '...' : 'ЗБЕРЕГТИ'}
                              </button>
                              <button type="button" onClick={() => setEditingInvId(null)} style={{ flex: 1, background: '#222', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer' }}>СКАСУВАТИ</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div>
                              <div style={{ fontSize: '0.6rem', color: '#555' }}>НАЯВНІСТЬ</div>
                              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#ff9000' }}>{item.total_qty || 0}</div>
                            </div>
                            {activeTab !== 'bz' && (
                              <div>
                                <div style={{ fontSize: '0.6rem', color: '#555' }}>ВІЛЬНО</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#10b981' }}>{(item.total_qty || 0) - (item.reserved_qty || 0)}</div>
                              </div>
                            )}
                            {activeTab !== 'bz' && (
                              <div>
                                <div style={{ fontSize: '0.6rem', color: '#555' }}>РЕЗЕРВ</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#3b82f6' }}>
                                  {Number(item.reserved_qty) > 0 ? (
                                    <span 
                                      onClick={() => setReserveAnalysisItem(item)}
                                      style={{ textDecoration: 'underline', cursor: 'pointer' }}
                                    >
                                      {item.reserved_qty}
                                    </span>
                                  ) : (
                                    0
                                  )}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {activeTab === 'boxes' && (
            <BoxesView
              cardsWithBoxes={cardsWithBoxes}
              searchQuery={searchQuery}
              orders={orders}
              expandedNaryads={expandedNaryads}
              setExpandedNaryads={setExpandedNaryads}
              expandedNomenclatures={expandedNomenclatures}
              setExpandedNomenclatures={setExpandedNomenclatures}
              checkedCutters={checkedCutters}
              handleToggleCutterCheck={handlers.handleToggleCutterCheck}
              handlePrepareBox={handlers.handlePrepareBox}
              isProcessing={isProcessing}
            />
          )}
        </div>
      </div>

      <ShortageModal
        shortages={shortages}
        setShortages={setShortages}
        isProcessing={isProcessing}
        sendPurchaseRequest={handlers.sendPurchaseRequest}
      />

      <MaterialDetailModal
        scannedCard={scannedCard}
        setScannedCard={setScannedCard}
        scannedRequests={scannedRequests}
        setScannedRequests={setScannedRequests}
        nomenclatures={nomenclatures}
        isIssuingCard={isIssuingCard || isProcessing}
        handleIssueCardMaterials={handlers.handleIssueCardMaterials}
      />

      <KittingModal
        kittingBoxItem={kittingBoxItem}
        setKittingBoxItem={setKittingBoxItem}
        checkedCutters={checkedCutters}
        handleToggleCutterCheck={handlers.handleToggleCutterCheck}
        handlePrepareBox={handlers.handlePrepareBox}
        isProcessing={isProcessing}
      />

      <ReserveAnalysisModal
        item={reserveAnalysisItem}
        onClose={() => setReserveAnalysisItem(null)}
        requests={requests}
        orders={orders}
        tasks={tasks}
        nomenclatures={nomenclatures}
      />

      <style>{`
        .warehouse-floating-controls {
          position: fixed;
          bottom: 30px;
          right: 30px;
          display: flex;
          align-items: center;
          gap: 15px;
          z-index: 1000;
          transition: all 0.3s ease;
        }
        @media (max-width: 768px) {
          .warehouse-floating-controls {
            bottom: 0;
            left: 0;
            right: 0;
            width: 100%;
            background: rgba(10, 10, 12, 0.96) !important;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            padding: 14px 20px;
            justify-content: space-between;
            border-radius: 0;
            box-shadow: 0 -10px 35px rgba(0,0,0,0.9);
            backdrop-filter: blur(15px);
            box-sizing: border-box;
          }
          .warehouse-floating-controls form {
            flex: 1;
            box-shadow: none !important;
            background: #000 !important;
            border: 1px solid #222 !important;
            border-radius: 28px !important;
          }
        }
      `}</style>

      {/* Floating Controls (Search and Scan QR) */}
      <div className="warehouse-floating-controls">
        {/* Floating Search Form */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            if (manualSearchInput.trim()) {
              handleWarehouseScan(manualSearchInput.trim())
              setManualSearchInput('')
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(10, 10, 10, 0.95)',
            border: '1px solid #222',
            padding: '5px 6px 5px 18px',
            borderRadius: '28px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(10px)',
            height: '56px',
            boxSizing: 'border-box',
            width: window.innerWidth < 768 ? '100%' : '380px'
          }}
        >
          <Search size={18} color="#6b7280" style={{ marginRight: '10px' }} />
          <input
            type="text"
            placeholder="Введіть системний номер..."
            value={manualSearchInput}
            onChange={e => setManualSearchInput(e.target.value)}
            disabled={isProcessing}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: '#fff', 
              fontSize: '0.88rem', 
              fontWeight: 900, 
              outline: 'none', 
              width: '100%',
              fontFamily: 'inherit'
            }}
          />
          <button 
            type="submit" 
            disabled={isProcessing} 
            style={{ 
              background: '#ff9000', 
              color: '#000', 
              border: 'none', 
              padding: '0 20px', 
              borderRadius: '22px', 
              fontSize: '0.82rem', 
              fontWeight: 950, 
              cursor: 'pointer', 
              height: '42px',
              display: 'flex', 
              alignItems: 'center', 
              flexShrink: 0 
            }}
          >
            ЗНАЙТИ
          </button>
        </form>

        {/* Floating Round QR Scan Button */}
        <button 
          onClick={() => {
            setIsScanning(true)
            setShowReception(false)
          }}
          className="hover-lift"
          style={{ 
            background: '#ff9000', 
            border: 'none', 
            color: '#000', 
            width: '56px',
            height: '56px',
            borderRadius: '50%', 
            display: 'flex', 
            justifyContent: 'center',
            alignItems: 'center', 
            cursor: 'pointer',
            boxShadow: '0 10px 25px rgba(255, 144, 0, 0.4)',
            transition: 'all 0.2s',
            flexShrink: 0
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.05)'
            e.currentTarget.style.boxShadow = '0 10px 30px rgba(255, 144, 0, 0.55)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = '0 10px 25px rgba(255, 144, 0, 0.4)'
          }}
        >
          <QrCode size={26} />
        </button>
      </div>
    </div>
  )
}

export default WarehouseModuleV2
