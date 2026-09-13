import React, { useState, useMemo } from 'react'
import {
  Archive,
  Package,
  Layers,
  AlertTriangle,
  History,
  Wrench
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useMES } from '../MESContext'
import { useStore } from '../store/index.js'
import { supabase } from '../supabase'
import { IconSGP } from '../components/WarehouseIcons'
import { ReserveAnalysisModal } from './Warehouse/components/ReserveAnalysisModal.jsx'
import { useWarehouseTheme } from './WarehouseFGP/hooks/useWarehouseTheme.js'
import { useWarehouseRealtime } from './WarehouseFGP/hooks/useWarehouseRealtime.js'
import { useShop2Buffer } from './WarehouseFGP/hooks/useShop2Buffer.js'
import { usePackagingQueue } from './WarehouseFGP/hooks/usePackagingQueue.js'
import { useInventoryGrouping } from './WarehouseFGP/hooks/useInventoryGrouping.js'
import { PackagingQueueTab } from './WarehouseFGP/components/PackagingQueueTab.jsx'
import { InventoryView } from './WarehouseFGP/components/InventoryView.jsx'

export const WarehouseFGPModule: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    refreshTable,
    fetchData,
    theme
  }: any = useMES()

  const inventory = useStore((state: any) => state.inventory)
  const requests = useStore((state: any) => state.requests)
  const nomenclatures = useStore((state: any) => state.nomenclatures)
  const orders = useStore((state: any) => state.orders)
  const tasks = useStore((state: any) => state.tasks)
  const workCards = useStore((state: any) => state.workCards)
  const workCardHistory = useStore((state: any) => state.workCardHistory)
  const currentUser = useStore((state: any) => state.currentUser)

  const { isDark, t } = useWarehouseTheme(theme)

  const [requestQueueTab, setRequestQueueTab] = useState<'active' | 'all' | 'history'>('active')
  const { liveRequests, isRefreshingQueue, fetchQueueFromDb }: any = useWarehouseRealtime(fetchData)

  const [viewMode, setViewMode] = useState<string>(() => searchParams.get('mode') || 'requests')
  const [requestSearchQuery, setRequestSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<string>(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'bz') return 'finished'
    if (tabParam === 'semi') return 'shop2_buffer'
    return tabParam || 'finished'
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newItem, setNewItem] = useState({ name: '', total_qty: '', unit: 'шт', type: 'finished' })

  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'ready' | 'shortage'>('all')
  const [reserveAnalysisItem, setReserveAnalysisItem] = useState<any>(null)

  const isAdmin = currentUser?.login === 'admin@workshop.local' || currentUser?.role === 'admin' || currentUser?.role === 'director' || (currentUser?.position || '').toLowerCase().includes('адмін')

  const tabs = [
    { id: 'finished', label: 'Готова продукція', icon: <Archive size={18} /> },
    { id: 'hardware', label: 'Метизи & Комплектуючі', icon: <Wrench size={18} /> },
    { id: 'shop2_buffer', label: 'Склад буфер Цеху 2', icon: <Layers size={18} /> },
    { id: 'scrap', label: 'Брак & Карантин', icon: <AlertTriangle size={18} /> },
    { id: 'registry', label: 'Реєстр випуску', icon: <History size={18} /> }
  ]

  // ── РОЗРАХУНОК ДАНИХ БУФЕРА ЦЕХУ №2 НА ОСНОВІ РОБОЧИХ КАРТОК ──
  const {
    shop2BufferCards,
    totalShop2BufferParts,
    shop2BufferTaskGroups,
    filteredShop2BufferTaskGroups,
    shop2BufferConsolidatedItems
  }: any = useShop2Buffer({ tasks, workCards, orders, nomenclatures, searchQuery })

  const {
    groupedItems,
    filteredItems,
    tabCounts
  }: any = useInventoryGrouping({
    inventory,
    activeTab,
    nomenclatures,
    searchQuery,
    workCardHistory,
    totalShop2BufferParts
  })

  const {
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
  }: any = usePackagingQueue({
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
  })

  const handleAddInventoryItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItem.name.trim() || !newItem.total_qty) return
    try {
      const { error } = await supabase.from('inventory').insert([{
        name: newItem.name.trim(),
        total_qty: Number(newItem.total_qty) || 0,
        reserved_qty: 0,
        unit: newItem.unit || 'шт',
        type: activeTab === 'hardware' ? 'hardware' : activeTab === 'semi' ? 'semi' : activeTab === 'scrap' ? 'scrap' : activeTab === 'bz' ? 'bz' : 'finished',
        warehouse: 'sgp'
      }])
      if (error) throw error
      if (typeof refreshTable === 'function') refreshTable('inventory')
      setNewItem({ name: '', total_qty: '', unit: 'шт', type: 'finished' })
      setShowAdd(false)
    } catch (err: any) {
      alert(`Помилка створення: ${err.message}`)
    }
  }

  const orderStats = useMemo(() => {
    let ready = 0
    let shortage = 0
    groupedPackagingRequests.forEach((group: any) => {
      const isAllReady = group.items.every((req: any) => {
        const dName = getItemDisplayName(req)
        const stock = getSgpStock(req, dName)
        return stock >= (Number(req.quantity) || 0)
      })
      if (isAllReady) ready++
      else shortage++
    })
    return { total: groupedPackagingRequests.length, ready, shortage }
  }, [groupedPackagingRequests, inventory, nomenclatures])

  const filteredOrderGroups = useMemo(() => {
    return groupedPackagingRequests.filter((group: any) => {
      if (requestSearchQuery.trim()) {
        const q = requestSearchQuery.toLowerCase()
        const matches = String(group.orderNum).toLowerCase().includes(q) || (group.customer || '').toLowerCase().includes(q)
        if (!matches) return false
      }
      if (orderStatusFilter === 'ready') {
        return group.items.every((req: any) => {
          const dName = getItemDisplayName(req)
          return getSgpStock(req, dName) >= (Number(req.quantity) || 0)
        })
      }
      if (orderStatusFilter === 'shortage') {
        return group.items.some((req: any) => {
          const dName = getItemDisplayName(req)
          return getSgpStock(req, dName) < (Number(req.quantity) || 0)
        })
      }
      return true
    })
  }, [groupedPackagingRequests, requestSearchQuery, orderStatusFilter, inventory, nomenclatures])

  return (
    <div className="warehouse-fgp-module" style={{ background: t.bg, minHeight: '100vh', color: t.textPrimary, display: 'flex', flexDirection: 'column' }}>
      
      {/* ── ХЕДЕР МОДУЛЯ ── */}
      <nav className="module-nav" style={{ 
        flexShrink: 0, 
        padding: '12px 25px', 
        background: t.navBg, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        borderBottom: `1px solid ${t.navBorder}`,
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <IconSGP size={26} color={isDark ? '#34d399' : '#059669'} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 950, letterSpacing: '-0.02em', color: t.textPrimary }}>
                  СКЛАД ГОТОВОЇ ПРОДУКЦІЇ ТА КОМПЛЕКТУЮЧИХ (СГП)
                </h1>
                <span style={{
                  background: isDark ? 'rgba(5, 150, 105, 0.25)' : '#ecfdf5',
                  color: isDark ? '#34d399' : '#059669',
                  border: isDark ? '1px solid rgba(5, 150, 105, 0.5)' : '1px solid #a7f3d0',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '0.62rem',
                  fontWeight: 900
                }}>
                  WMS
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: t.textSecondary, fontWeight: 700, marginTop: '2px' }}>
                {viewMode === 'requests' ? 'Робоче місце комірника: видача замовлень на пакування' : 'Відомість та інвентаризація залишків'}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* TOGGLE TO INVENTORY / REQUESTS */}
          {viewMode === 'requests' ? (
            <button
              type="button"
              onClick={() => {
                setViewMode('inventory')
                setSearchParams(prev => {
                  const np = new URLSearchParams(prev)
                  np.set('mode', 'inventory')
                  return np
                })
              }}
              style={{
                height: '42px',
                padding: '0 20px',
                borderRadius: '12px',
                border: `1.5px solid ${t.viewInventoryBtnBorder}`,
                background: t.viewInventoryBtnBg,
                color: t.viewInventoryBtnText,
                fontSize: '0.84rem',
                fontWeight: 900,
                letterSpacing: '0.01em',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: isDark ? '0 2px 10px rgba(0,0,0,0.3)' : '0 2px 8px rgba(16, 185, 129, 0.15)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = isDark ? '#1e2433' : '#ecfdf5'
                e.currentTarget.style.borderColor = '#059669'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = t.viewInventoryBtnBg
                e.currentTarget.style.borderColor = t.viewInventoryBtnBorder
              }}
            >
              <Archive size={17} color={isDark ? '#34d399' : '#059669'} />
              <span style={{ color: t.viewInventoryBtnText, fontWeight: 900 }}>ПЕРЕГЛЯНУТИ ЗАЛИШКИ СГП</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setViewMode('requests')
                setSearchParams(prev => {
                  const np = new URLSearchParams(prev)
                  np.delete('mode')
                  return np
                })
              }}
              style={{
                height: '42px',
                padding: '0 20px',
                borderRadius: '12px',
                border: '1.5px solid #10b981',
                background: '#10b981',
                color: '#ffffff',
                fontSize: '0.84rem',
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 10px rgba(16, 185, 129, 0.25)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#059669' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#10b981' }}
            >
              <Package size={17} color="#ffffff" />
              <span style={{ color: '#ffffff', fontWeight: 900 }}>
                ← ДО ЧЕРГИ ЗАПИТІВ {activePackagingRequests.length > 0 ? `(${activePackagingRequests.length})` : ''}
              </span>
            </button>
          )}
        </div>
      </nav>

      {/* ── ОСНОВНИЙ КОНТЕНТ: РЕЖИМ ЗАПИТІВ (ГОЛОВНИЙ РЕЖИМ СГП) ── */}
      {viewMode === 'requests' && (
        <PackagingQueueTab
          t={t}
          isDark={isDark}
          groupedPackagingRequests={groupedPackagingRequests}
          pendingPackagingRequests={pendingPackagingRequests}
          activePackagingRequests={activePackagingRequests}
          allPackagingRequests={allPackagingRequests}
          completedPackagingRequests={completedPackagingRequests}
          requestQueueTab={requestQueueTab}
          setRequestQueueTab={setRequestQueueTab}
          isRefreshingQueue={isRefreshingQueue}
          fetchQueueFromDb={fetchQueueFromDb}
          requestSearchQuery={requestSearchQuery}
          setRequestSearchQuery={setRequestSearchQuery}
          orderStatusFilter={orderStatusFilter}
          setOrderStatusFilter={setOrderStatusFilter}
          orderStats={orderStats}
          filteredOrderGroups={filteredOrderGroups}
          collapsedOrders={collapsedOrders}
          toggleOrderCollapse={toggleOrderCollapse}
          expandAll={expandAll}
          collapseAll={collapseAll}
          getItemDisplayName={getItemDisplayName}
          getItemCategoryBadge={getItemCategoryBadge}
          getSgpStock={getSgpStock}
          handleIssueAllForOrder={handleIssueAllForOrder}
          isIssuingReq={isIssuingReq}
          handleIssueRequest={handleIssueRequest}
          inventory={inventory}
          setViewMode={setViewMode}
        />
      )}

      {/* ── ОСНОВНИЙ КОНТЕНТ: РЕЖИМ ЗАЛИШКІВ (ВІДОМІСТЬ) ── */}
      <InventoryView
        t={t}
        isDark={isDark}
        viewMode={viewMode}
        setViewMode={setViewMode}
        setSearchParams={setSearchParams}
        pendingPackagingRequests={activePackagingRequests}
        tabs={tabs}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        tabCounts={tabCounts}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        showAdd={showAdd}
        setShowAdd={setShowAdd}
        newItem={newItem}
        setNewItem={setNewItem}
        handleAddInventoryItem={handleAddInventoryItem}
        workCardHistory={workCardHistory}
        shop2BufferCards={shop2BufferCards}
        totalShop2BufferParts={totalShop2BufferParts}
        shop2BufferTaskGroups={shop2BufferTaskGroups}
        filteredShop2BufferTaskGroups={filteredShop2BufferTaskGroups}
        shop2BufferConsolidatedItems={shop2BufferConsolidatedItems}
        filteredItems={filteredItems}
        isAdmin={isAdmin}
        setReserveAnalysisItem={setReserveAnalysisItem}
        fetchData={fetchData}
        refreshTable={refreshTable}
      />

      {reserveAnalysisItem && (
        <ReserveAnalysisModal
          item={reserveAnalysisItem}
          onClose={() => setReserveAnalysisItem(null)}
          requests={requests}
          orders={orders}
          tasks={tasks}
          nomenclatures={nomenclatures}
        />
      )}
    </div>
  )
}

export default WarehouseFGPModule
