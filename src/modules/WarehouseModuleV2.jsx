import React, { useState, useMemo, useEffect } from 'react'
import { Warehouse as WarehouseIcon, Package, FolderOpen, History, Plus, Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useMES } from '../MESContext'
import { supabase } from '../supabase'

// Hooks
import { getMaterialType, useWarehouseComputed } from './Warehouse/hooks/useWarehouseComputed'
import { useWarehouseHandlers } from './Warehouse/hooks/useWarehouseHandlers'
import { useManualInventoryIssue } from './Warehouse/ManualIssue/useManualInventoryIssue'

// Existing Modals & Views
import { ScannerPanel } from './Warehouse/components/ScannerPanel'
import { ShortageModal } from './Warehouse/components/ShortageModal'
import { MaterialDetailModal } from './Warehouse/components/MaterialDetailModal'
import { KittingModal } from './Warehouse/components/KittingModal'
import { ConsumablesQueue } from './Warehouse/components/ConsumablesQueue'
import { BoxesView } from './Warehouse/components/BoxesView'
import { RegistryView } from './Warehouse/components/RegistryView'
import { ReserveAnalysisModal } from './Warehouse/components/ReserveAnalysisModal'
import { ManualInventoryIssueUI } from './Warehouse/ManualIssue/ManualInventoryIssueUI'

// Extracted Sub-components
import { WarehouseHeaderNav } from './Warehouse/components/WarehouseHeaderNav.jsx'
import { WarehousePendingReceptionBanner } from './Warehouse/components/WarehousePendingReceptionBanner.jsx'
import { WarehouseReceptionPanel } from './Warehouse/components/WarehouseReceptionPanel.jsx'
import { WarehouseTabsBar } from './Warehouse/components/WarehouseTabsBar.jsx'
import { WarehouseCategoryFoldersBar } from './Warehouse/components/WarehouseCategoryFoldersBar.jsx'
import { WarehouseAddInventoryForm } from './Warehouse/components/WarehouseAddInventoryForm.jsx'
import { WarehouseInventoryTable } from './Warehouse/components/WarehouseInventoryTable.jsx'
import { WarehouseFloatingControls } from './Warehouse/components/WarehouseFloatingControls.jsx'
import { WarehouseDeleteConfirmModal } from './Warehouse/components/modals/WarehouseDeleteConfirmModal.jsx'

const WarehouseModuleV2 = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    inventory, requests, receptionDocs, confirmReception,
    orders, tasks, approveWarehouse, createPurchaseRequest,
    purchaseRequests, currentUser, fetchData, managers, refreshTable, machineOperations, workCards
  } = useMES()

  // Load warehouse-specific data on mount
  useEffect(() => { 
    if (typeof fetchData === 'function') {
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
  const [isIssuingCard] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [manualCardInput, setManualCardInput] = useState('')
  const [manualSearchInput, setManualSearchInput] = useState('')
  const [reserveAnalysisItem, setReserveAnalysisItem] = useState(null)

  // Computed values
  const {
    cardsWithBoxes,
    filteredInventory,
    groupedPocketInventory,
    groupedRequests
  } = useWarehouseComputed({
    inventory,
    requests,
    nomenclatures: useMES().nomenclatures,
    receptionDocs,
    tasks,
    workCards,
    machineOperations,
    activeTab,
    searchQuery,
    selectedPocketOwner
  })

  const { nomenclatures } = useMES()

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
    issueMaterialsBatch: useMES().issueMaterialsBatch,
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

  const [itemToDelete, setItemToDelete] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const isAdmin = currentUser?.login === 'admin@workshop.local' || currentUser?.role === 'admin' || currentUser?.role === 'director' || (currentUser?.position || '').toLowerCase().includes('адмін') || (currentUser?.position || '').toLowerCase().includes('директор')

  const handleDeleteInventoryItem = (item) => {
    if (!item || !item.id) return
    setItemToDelete(item)
  }

  const confirmDeleteInventoryItem = async () => {
    if (!itemToDelete || isDeleting) return
    setIsDeleting(true)
    try {
      const { error } = await supabase.from('inventory').delete().eq('id', itemToDelete.id)
      if (error) throw error
      if (typeof refreshTable === 'function') refreshTable('inventory')
      if (typeof fetchData === 'function') fetchData(['inventory'])
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
      { id: 'registry', label: 'Реєстр', icon: <History size={18} /> }
    ]
  }, [requests, tasks, receptionDocs, nomenclatures, inventory, cardsWithBoxes])

  const getItemReservedQty = (item) => {
    if (!item) return 0
    const dbReserved = Number(item.reserved_qty) || 0
    const approvedQty = (requests || [])
      .filter(r => 
        (r.status === 'approved' || r.status === 'reserved' || r.status === 'issued') &&
        ((r.inventory_id && String(r.inventory_id) === String(item.id)) ||
         (!r.inventory_id && r.nomenclature_id && String(r.nomenclature_id) === String(item.nomenclature_id)))
      )
      .reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)
    return Math.max(dbReserved, approvedQty)
  }

  return (
    <div className="warehouse-module-v2" style={{ background: '#080808', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <WarehouseHeaderNav
        currentUser={currentUser}
        activeTab={activeTab}
        showReception={showReception}
        setShowReception={setShowReception}
        pendingDocsCount={pendingDocs.length}
        manualIssue={manualIssue}
      />

      <div className="module-content" style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
        <WarehousePendingReceptionBanner
          pendingDocsCount={pendingDocs.length}
          onOpenReception={() => setShowReception(true)}
        />

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

        <WarehouseReceptionPanel
          showReception={showReception}
          pendingDocs={pendingDocs}
          nomenclatures={nomenclatures}
          processingDocs={processingDocs}
          setProcessingDocs={setProcessingDocs}
          confirmReception={confirmReception}
          refreshTable={refreshTable}
        />

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
        <WarehouseTabsBar
          tabs={tabs}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          setNewItem={setNewItem}
          newItem={newItem}
          setSearchParams={setSearchParams}
          setSelectedPocketOwner={setSelectedPocketOwner}
        />

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

          <WarehouseCategoryFoldersBar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            setSearchParams={setSearchParams}
            inventory={inventory}
          />

          <WarehouseAddInventoryForm
            showAdd={showAdd}
            activeTab={activeTab}
            newItem={newItem}
            setNewItem={setNewItem}
            managers={managers}
            handleAddInventory={handlers.handleAddInventory}
          />

          {activeTab === 'registry' && (
            <RegistryView
              receptionDocs={receptionDocs}
              nomenclatures={nomenclatures}
              expandedDoc={expandedDoc}
              setExpandedDoc={setExpandedDoc}
            />
          )}

          <WarehouseInventoryTable
            activeTab={activeTab}
            filteredInventory={filteredInventory}
            groupedPocketInventory={groupedPocketInventory}
            isAdmin={isAdmin}
            editingInvId={editingInvId}
            setEditingInvId={setEditingInvId}
            editingInvTotal={editingInvTotal}
            setEditingInvTotal={setEditingInvTotal}
            editingInvReserved={editingInvReserved}
            setEditingInvReserved={setEditingInvReserved}
            savingInv={savingInv}
            getItemReservedQty={getItemReservedQty}
            handleSaveInventoryQty={handlers.handleSaveInventoryQty}
            handleDeleteInventoryItem={handleDeleteInventoryItem}
            setReserveAnalysisItem={setReserveAnalysisItem}
            currentUser={currentUser}
          />

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
      <WarehouseFloatingControls
        manualSearchInput={manualSearchInput}
        setManualSearchInput={setManualSearchInput}
        isProcessing={isProcessing}
        handleWarehouseScan={handleWarehouseScan}
        setIsScanning={setIsScanning}
        setShowReception={setShowReception}
      />

      {/* Delete Confirmation Modal */}
      <WarehouseDeleteConfirmModal
        itemToDelete={itemToDelete}
        setItemToDelete={setItemToDelete}
        isDeleting={isDeleting}
        confirmDeleteInventoryItem={confirmDeleteInventoryItem}
      />
    </div>
  )
}

export default WarehouseModuleV2
