import React, { useState, useMemo, useEffect } from 'react'
import { Warehouse as WarehouseIcon, ArrowLeft, Search, Check, ListFilter, AlertCircle, Box, QrCode } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { useWarehouseComputed } from './Warehouse/hooks/useWarehouseComputed'
import { useWarehouseHandlers } from './Warehouse/hooks/useWarehouseHandlers'
import { ScannerPanel } from './Warehouse/components/ScannerPanel'
import { KittingModal } from './Warehouse/components/KittingModal'
import { MaterialDetailModal } from './Warehouse/components/MaterialDetailModal'

const WarehouseBoxesModule = () => {
  const {
    inventory, requests, issueMaterials, issueMaterialsBatch,
    nomenclatures, receptionDocs, confirmReception,
    orders, tasks, approveWarehouse, createPurchaseRequest,
    purchaseRequests, receiveInventory, currentUser, fetchData,
    fetchModuleData, machineOperations, workCards
  } = useMES()

  const [checkedCutters, setCheckedCutters] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [editingInvId, setEditingInvId] = useState(null)
  const [editingInvTotal, setEditingInvTotal] = useState('')
  const [editingInvReserved, setEditingInvReserved] = useState('')
  const [savingInv, setSavingInv] = useState(false)

  // Scanning & kitting modal states (Identical to WarehouseModuleV2)
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
    purchaseRequests, receptionDocs, workCards, currentUser,
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
                              box.orderNum.toLowerCase().includes(search) ||
                              (box.card.box_number && box.card.box_number.toLowerCase().includes(search))
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
          pending: 0
        }
      }
      ordersMap[box.orderNum].total += 1
      if (!box.isPrepared) {
        ordersMap[box.orderNum].pending += 1
      }
    })
    return Object.values(ordersMap).sort((a, b) => b.pending - a.pending)
  }, [allBoxes])

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
    const cardId = normalizeScannedCardId(rawValue)
    if (!cardId) {
      alert('Не вдалося зчитати код картки.')
      return
    }

    const boxItem = allBoxes.find(box => {
      const cardNum = box.card.card_info?.split(' ')[0]
      return String(box.card.id) === String(cardId) ||
        String(cardNum) === String(cardId) ||
        String(box.card.box_number || '') === String(cardId)
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

  return (
    <div style={{ background: '#080808', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Header */}
      <nav style={{
        flexShrink: 0,
        padding: isMobile ? '12px 15px' : '15px 25px',
        background: '#111',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #222',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '20px' }}>
          <Link to="/" style={{ color: '#aaa', transition: '0.2s', display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <ArrowLeft size={18} />
            <span style={{ marginLeft: '4px', fontSize: '0.8rem', fontWeight: 600 }}>Назад</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <WarehouseIcon size={18} style={{ color: '#ff9000' }} />
            <h1 style={{ margin: 0, fontSize: isMobile ? '0.95rem' : '1.2rem', fontWeight: 900 }}>
              БОКСИ ФРЕЗ
            </h1>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.68rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '3px 8px', borderRadius: '6px', fontWeight: 950 }}>
            {allBoxes.filter(b => b.isPrepared).length}/{allBoxes.length} ГОТОВО
          </span>
        </div>
      </nav>

      {/* Camera Scanner Overlay Panel */}
      <ScannerPanel
        isScanning={isScanning}
        setIsScanning={setIsScanning}
        cameraError={cameraError}
        manualCardInput={manualCardInput}
        setManualCardInput={setManualCardInput}
        handleCardScan={handleBoxCardScan}
      />

      {/* Kitting Modal (opens upon successful scan) */}
      <KittingModal
        kittingBoxItem={kittingBoxItem}
        setKittingBoxItem={setKittingBoxItem}
        checkedCutters={checkedCutters}
        handleToggleCutterCheck={handlers.handleToggleCutterCheck}
        handlePrepareBox={handlers.handlePrepareBox}
        isProcessing={isProcessing}
      />

      <MaterialDetailModal
        scannedCard={scannedCard}
        setScannedCard={setScannedCard}
        scannedRequests={scannedRequests}
        setScannedRequests={setScannedRequests}
        nomenclatures={nomenclatures}
        isIssuingCard={isProcessing}
        handleIssueCardMaterials={handlers.handleIssueCardMaterials}
      />

      {/* Workspace */}
      <div style={{ display: 'flex', flex: 1, flexDirection: 'row', overflow: 'hidden' }}>
        
        {/* SIDEBAR: (Only rendered on Desktop) */}
        {!isMobile && (
          <aside style={{
            width: '260px',
            background: '#0d0d0d',
            borderRight: '1px solid #1a1a1a',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0
          }}>
            <div style={{ padding: '15px', borderBottom: '1px solid #1a1a1a' }}>
              <span style={{ fontSize: '0.68rem', color: '#ff9000', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Черга нарядів</span>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
              <button
                onClick={() => setSelectedOrderNum('all')}
                style={{
                  width: '100%',
                  background: selectedOrderNum === 'all' ? 'rgba(255, 144, 0, 0.08)' : 'transparent',
                  border: selectedOrderNum === 'all' ? '1px solid rgba(255, 144, 0, 0.3)' : '1px solid transparent',
                  borderRadius: '12px',
                  padding: '12px 15px',
                  color: selectedOrderNum === 'all' ? '#ff9000' : '#888',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '5px',
                  transition: 'all 0.15s'
                }}
              >
                <span>Усі наряди</span>
                <span style={{ background: '#181818', color: '#aaa', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '6px' }}>{allBoxes.length}</span>
              </button>

              {orderList.map(ord => (
                <button
                  key={ord.orderNum}
                  onClick={() => setSelectedOrderNum(ord.orderNum)}
                  style={{
                    width: '100%',
                    background: selectedOrderNum === ord.orderNum ? 'rgba(255, 144, 0, 0.08)' : 'transparent',
                    border: selectedOrderNum === ord.orderNum ? '1px solid rgba(255, 144, 0, 0.3)' : '1px solid transparent',
                    borderRadius: '12px',
                    padding: '12px 15px',
                    color: selectedOrderNum === ord.orderNum ? '#ff9000' : '#fff',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '5px',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span>#{ord.orderNum}</span>
                    <span style={{ fontSize: '0.65rem', color: ord.pending > 0 ? '#ff9000' : '#10b981', fontWeight: 600 }}>
                      {ord.pending > 0 ? `Очікує: ${ord.pending} шт` : 'Усі зібрано'}
                    </span>
                  </div>
                  <span style={{ background: '#181818', color: '#666', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '6px' }}>{ord.total}</span>
                </button>
              ))}
            </div>
          </aside>
        )}

        {/* MAIN PANEL */}
        <main style={{ flex: 1, padding: isMobile ? '12px' : '20px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          
          {/* Controls Bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
            
            {/* Mobile Order Selector Dropdown */}
            {isMobile && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.6rem', color: '#ff9000', fontWeight: 900, textTransform: 'uppercase' }}>Активний Наряд</span>
                <select
                  value={selectedOrderNum}
                  onChange={e => setSelectedOrderNum(e.target.value)}
                  style={{
                    background: '#111',
                    border: '1px solid #222',
                    borderRadius: '10px',
                    padding: '10px',
                    color: '#fff',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    outline: 'none'
                  }}
                >
                  <option value="all">Усі наряди ({allBoxes.length} шт)</option>
                  {orderList.map(ord => (
                    <option key={ord.orderNum} value={ord.orderNum}>
                      #{ord.orderNum} ({ord.pending > 0 ? `Очікує: ${ord.pending}` : 'Зібрано'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'row', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
              {/* Status Tabs */}
              <div style={{ display: 'flex', background: '#111', padding: '3px', borderRadius: '10px', border: '1px solid #222', flex: 1, maxWidth: isMobile ? 'none' : 'fit-content' }}>
                <button
                  onClick={() => setFilterStatus('pending')}
                  style={{
                    flex: 1,
                    background: filterStatus === 'pending' ? '#ff9000' : 'transparent',
                    color: filterStatus === 'pending' ? '#000' : '#888',
                    border: 'none',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <AlertCircle size={12} />
                  Очікують
                </button>
                <button
                  onClick={() => setFilterStatus('prepared')}
                  style={{
                    flex: 1,
                    background: filterStatus === 'prepared' ? '#ff9000' : 'transparent',
                    color: filterStatus === 'prepared' ? '#000' : '#888',
                    border: 'none',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <Check size={12} />
                  Зібрані
                </button>
              </div>

              {/* Search Input */}
              <div style={{ position: 'relative', flex: isMobile ? 1 : 'none', width: isMobile ? 'auto' : '260px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#555' }} />
                <input
                  type="text"
                  placeholder="Пошук..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#111',
                    border: '1px solid #222',
                    borderRadius: '10px',
                    padding: '8px 12px 8px 32px',
                    color: '#fff',
                    fontSize: '0.8rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Cards Grid */}
          {filteredBoxes.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed #222', borderRadius: '16px', padding: '40px 20px' }}>
              <Box size={32} style={{ color: '#333', marginBottom: '10px' }} />
              <span style={{ color: '#555', fontSize: '0.78rem', fontWeight: 600 }}>Немає відповідних боксів</span>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
              gap: isMobile ? '12px' : '16px'
            }}>
              {filteredBoxes.map(boxItem => {
                const cardId = boxItem.card.id
                const isAllChecked = boxItem.cutters.every(c => checkedCutters[cardId]?.[c.nomenclature_id])
                const isSheetChecked = !!checkedSheets[cardId] || boxItem.isPrepared
                
                const currentBoxNumber = boxNumberState[cardId] !== undefined 
                  ? boxNumberState[cardId] 
                  : (boxItem.card.box_number || '')

                const canSubmit = currentBoxNumber.trim().length > 0 && isAllChecked && isSheetChecked

                return (
                  <div
                    key={cardId}
                    style={{
                      background: boxItem.isPrepared ? 'rgba(16, 185, 129, 0.01)' : '#111',
                      border: boxItem.isPrepared ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid #222',
                      borderRadius: '16px',
                      padding: isMobile ? '14px' : '18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      transition: 'all 0.2s',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                    }}
                  >
                    {/* Card Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #222', paddingBottom: '8px' }}>
                      <div>
                        <div style={{ fontSize: '0.62rem', color: '#ff9000', fontWeight: 900, textTransform: 'uppercase' }}>
                          НАРЯД #{boxItem.orderNum}
                        </div>
                        <strong style={{ fontSize: '0.95rem', color: '#fff' }}>Картка {boxItem.cardNum}</strong>
                      </div>
                      
                      {boxItem.isPrepared ? (
                        <span style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', padding: '3px 8px', borderRadius: '6px', fontSize: '0.62rem', fontWeight: 900 }}>
                          ГОТОВО
                        </span>
                      ) : (
                        <span style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '3px 8px', borderRadius: '6px', fontSize: '0.62rem', fontWeight: 900 }}>
                          ОЧІКУЄ
                        </span>
                      )}
                    </div>

                    {/* Part name */}
                    <div>
                      <div style={{ fontSize: '0.58rem', color: '#555', fontWeight: 900, textTransform: 'uppercase' }}>Деталь</div>
                      <div style={{ fontSize: '0.78rem', color: '#ccc', fontWeight: 700, marginTop: '2px', wordBreak: 'break-all', whiteSpace: 'normal' }}>
                        {boxItem.partName}
                      </div>
                    </div>

                    {/* Machine and sheets count */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: '#0a0a0a', padding: '8px 12px', borderRadius: '10px', border: '1px solid #1a1a1a' }}>
                      <div>
                        <div style={{ fontSize: '0.55rem', color: '#444', fontWeight: 800 }}>ВЕРСТАТ</div>
                        <div style={{ fontSize: '0.72rem', color: '#fff', fontWeight: 700 }}>{boxItem.card.machine || '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.55rem', color: '#444', fontWeight: 800 }}>ЛИСТИ</div>
                        <div style={{ fontSize: '0.72rem', color: '#ff9000', fontWeight: 900 }}>{boxItem.cardSheets} л.</div>
                      </div>
                    </div>

                    {/* Box code input */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.6rem', color: '#888', fontWeight: 800 }}>НОМЕР / ШТРИХ-КОД БОКСУ:</label>
                      <input 
                        type="text"
                        placeholder="Введіть код..."
                        value={currentBoxNumber}
                        disabled={boxItem.isPrepared}
                        onChange={e => setBoxNumberState(prev => ({ ...prev, [cardId]: e.target.value }))}
                        style={{ 
                          background: '#000', 
                          border: currentBoxNumber ? '1px solid #ff9000' : '1px solid #222', 
                          borderRadius: '8px', 
                          padding: '8px 12px', 
                          color: '#fff', 
                          fontSize: '0.78rem', 
                          outline: 'none',
                          fontWeight: 900,
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    {/* Filling Checklists */}
                    <div>
                      <div style={{ fontSize: '0.6rem', color: '#888', fontWeight: 800, marginBottom: '6px' }}>СПИСОК НАПОВНЕННЯ:</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {/* Sheets check */}
                        <div 
                          onClick={() => !boxItem.isPrepared && setCheckedSheets(prev => ({ ...prev, [cardId]: !prev[cardId] }))}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between', 
                            background: isSheetChecked ? 'rgba(16, 185, 129, 0.04)' : '#0a0a0a', 
                            padding: '8px 12px', 
                            borderRadius: '8px', 
                            border: isSheetChecked ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid #222',
                            cursor: boxItem.isPrepared ? 'default' : 'pointer'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input 
                              type="checkbox" 
                              checked={isSheetChecked}
                              disabled={boxItem.isPrepared}
                              onChange={() => {}} 
                              style={{ cursor: boxItem.isPrepared ? 'default' : 'pointer' }}
                            />
                            <span style={{ fontSize: '0.7rem', color: isSheetChecked ? '#aaa' : '#fff' }}>
                              {boxItem.activeMaterialName}
                            </span>
                          </div>
                          <strong style={{ fontSize: '0.72rem', color: isSheetChecked ? '#10b981' : '#fff' }}>
                            {boxItem.cardSheets} л.
                          </strong>
                        </div>

                        {/* Cutters checks */}
                        {boxItem.cutters.map(cutter => {
                          const isChecked = !!checkedCutters[cardId]?.[cutter.nomenclature_id] || boxItem.isPrepared
                          return (
                            <div 
                              key={cutter.nomenclature_id}
                              onClick={() => !boxItem.isPrepared && handlers.handleToggleCutterCheck(cardId, cutter.nomenclature_id)}
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between', 
                                background: isChecked ? 'rgba(16, 185, 129, 0.04)' : '#0a0a0a', 
                                padding: '8px 12px', 
                                borderRadius: '8px', 
                                border: isChecked ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid #222',
                                cursor: boxItem.isPrepared ? 'default' : 'pointer'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input 
                                  type="checkbox" 
                                  checked={isChecked}
                                  disabled={boxItem.isPrepared}
                                  onChange={() => {}} 
                                  style={{ cursor: boxItem.isPrepared ? 'default' : 'pointer' }}
                                />
                                <span style={{ fontSize: '0.7rem', color: isChecked ? '#aaa' : '#fff', wordBreak: 'break-word', whiteSpace: 'normal', display: 'inline-block' }}>
                                  {cutter.name}
                                </span>
                              </div>
                              <strong style={{ fontSize: '0.72rem', color: isChecked ? '#10b981' : '#fff', whiteSpace: 'nowrap' }}>
                                {cutter.qty} шт
                              </strong>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Save Button */}
                    {!boxItem.isPrepared && (
                      <button
                        disabled={isProcessing || !canSubmit}
                        onClick={() => handlers.handlePrepareBox(boxItem, currentBoxNumber)}
                        style={{
                          width: '100%',
                          padding: '10px',
                          background: canSubmit ? '#ff9000' : '#1a1a1a',
                          color: canSubmit ? '#000' : '#555',
                          border: 'none',
                          borderRadius: '8px',
                          fontWeight: 900,
                          fontSize: '0.75rem',
                          cursor: (isProcessing || !canSubmit) ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s',
                          marginTop: '2px'
                        }}
                      >
                        {!currentBoxNumber.trim() 
                          ? 'Вкажіть бокс' 
                          : !isAllChecked || !isSheetChecked 
                            ? 'Позначте вміст' 
                            : `Зібрати бокс №${currentBoxNumber}`
                        }
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>

      {/* Floating Action Button (FAB) Scanner Widget */}
      <button
        type="button"
        onClick={() => setIsScanning(true)}
        style={{
          position: 'fixed',
          bottom: '25px',
          right: '25px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #ff9000, #e68000)',
          color: '#000',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 8px 30px rgba(255, 144, 0, 0.35), 0 0 15px rgba(255, 144, 0, 0.2)',
          zIndex: 850,
          transition: 'all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.1) translateY(-2px)'
          e.currentTarget.style.boxShadow = '0 12px 35px rgba(255, 144, 0, 0.45)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1) translateY(0)'
          e.currentTarget.style.boxShadow = '0 8px 30px rgba(255, 144, 0, 0.35)'
        }}
      >
        <QrCode size={26} strokeWidth={2.5} />
      </button>
    </div>
  )
}

export default WarehouseBoxesModule
