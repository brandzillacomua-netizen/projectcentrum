import React, { useState } from 'react'
import { useMasterState } from './Master/hooks/useMasterState'
import { MasterHeader } from './Master/components/MasterHeader'
import { MasterAnalytics } from './Master/components/MasterAnalytics'
import { MasterOrderQueueList } from './Master/components/MasterOrderQueueList'
import { MasterActiveTasksList } from './Master/components/MasterActiveTasksList'
import { MasterArchiveDrawer } from './Master/components/MasterArchiveDrawer'
import { MasterMachineCallsModal } from './Master/components/modals/MasterMachineCallsModal'
import { MasterQuickPlanModal } from './Master/components/modals/MasterQuickPlanModal'
import { MasterCustomCardModal } from './Master/components/modals/MasterCustomCardModal'
import { MasterPrepModal } from './Master/components/modals/MasterPrepModal'
import { MasterStockInfoModal } from './Master/components/modals/MasterStockInfoModal'
import { MasterNaryadModal } from './Master/components/modals/MasterNaryadModal'
import { useMES } from '../MESContext'
import { AlertTriangle, ListChecks, History, X, Clock } from 'lucide-react'

export function MasterModule() {
  const masterState = useMasterState()
  const {
    activeCalls,
    handleResolveCall,
    activeNaryadOrder,
    setActiveNaryadOrder,
    useStockBZ,
    setUseStockBZ,
    partBZOverrides,
    setPartBZOverrides,
    isSubmitting,
    selectedMachine,
    setSelectedMachine,
    rowMachines,
    setRowMachines,
    rowMachinesSplits,
    setRowMachinesSplits,
    isReprintMode,
    setIsReprintMode,
    searchQuery,
    setSearchQuery,
    isDrawerOpen,
    setIsDrawerOpen,
    drawerType,
    setDrawerType,
    reprintTask,
    setReprintTask,
    selectedCutters,
    setSelectedCutters,
    partCutterOverrides,
    setPartCutterOverrides,
    allOrdersMap,
    quickPlanOrder,
    setQuickPlanOrder,
    tempSets,
    setTempSets,
    tempDeadline,
    setTempDeadline,
    showPrepModal,
    setShowPrepModal,
    prepQuantities,
    setPrepQuantities,
    prepDeadline,
    setPrepDeadline,
    showCustomCardModal,
    setShowCustomCardModal,
    customCardNomId,
    setCustomCardNomId,
    customCardQty,
    setCustomCardQty,
    customCardMachine,
    setCustomCardMachine,
    customCardDeadline,
    setCustomCardDeadline,
    customCardSearch,
    setCustomCardSearch,
    isSavingDraftOrder,
    naryadQtys,
    setNaryadQtys,
    naryadDeadline,
    setNaryadDeadline,
    naryadParts,
    setNaryadParts,
    partSearchQueries,
    setPartSearchQueries,
    openDropdownRowKey,
    setOpenDropdownRowKey,
    materialSplits,
    setMaterialSplits,
    stockInfoModalData,
    setStockInfoModalData,
    showAuxiliary,
    setShowAuxiliary,
    handleCreateCustomCard,
    handleOpenCustomVirtualNaryad,
    handleSaveVirtualDraft,
    handleCreatePrepOrder,
    getPlannedQty,
    handleDeleteOrder,
    getBatchSuffix,
    pendingOrders,
    filteredPending,
    handleOpenNaryadModal,
    getBOMParts,
    getDisplayPartsForOrderItem,
    currentMachine,
    handlePrint,
    handleReprint,
    isPartBZActive,
    materialSummary,
    productNames,
    isSheetDistributionComplete,
    isPrintDisabled,
    handleSplitChange,
    requests,
    handleShowStockInfo
  } = masterState

  const {
    tasks,
    orders,
    nomenclatures,
    inventory,
    totalProduced,
    totalScrapCount,
    machines,
    machineOperations,
    currentUser,
    theme
  } = useMES()

  const isLight = theme === 'light'
  const [showCallsModal, setShowCallsModal] = useState(false)

  return (
    <div className="module-container" style={{ background: isLight ? '#f5f7fa' : '#000000', color: isLight ? '#0f172a' : '#ffffff', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* MACHINE EMERGENCY CALLS BANNER */}
      {activeCalls.length > 0 && (
        <div 
          onClick={() => setShowCallsModal(true)} 
          style={{ 
            background: 'linear-gradient(90deg, #ef4444, #dc2626)', 
            color: '#fff', 
            padding: '10px 20px', 
            display: 'flex', 
            justify: 'space-between', 
            alignItems: 'center', 
            cursor: 'pointer',
            fontWeight: 900,
            fontSize: '0.85rem',
            animation: 'pulse 2s infinite'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={20} />
            <span>УВАГА! Є ВИКЛИКИ НА ВЕРСТАТАХ ({activeCalls.length})</span>
          </div>
          <span style={{ background: '#fff', color: '#dc2626', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem' }}>ПЕРЕГЛЯНУТИ</span>
        </div>
      )}

      {/* TOP HEADER */}
      <MasterHeader 
        setDrawerType={setDrawerType}
        setIsDrawerOpen={setIsDrawerOpen}
        pendingOrdersCount={pendingOrders.length}
        theme={theme}
      />

      {/* MAIN BODY CONTENT */}
      <main className="module-content" style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
        <div className="master-grid" style={{ display: 'grid', gridTemplateColumns: '240px 1fr 250px', gap: '20px' }}>
          {/* COLUMN 1: ORDER QUEUE */}
          <MasterOrderQueueList 
            filteredPending={filteredPending}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            setShowPrepModal={setShowPrepModal}
            handleOpenCustomVirtualNaryad={handleOpenCustomVirtualNaryad}
            setQuickPlanOrder={setQuickPlanOrder}
            getPlannedQty={getPlannedQty}
            setTempSets={setTempSets}
            setTempDeadline={setTempDeadline}
            handleDeleteOrder={handleDeleteOrder}
            tasks={tasks}
            nomenclatures={nomenclatures}
            theme={theme}
          />

          {/* COLUMN 2: ACTIVE TASKS IN SHOP */}
          <MasterActiveTasksList 
            tasks={tasks}
            orders={orders}
            allOrdersMap={allOrdersMap}
            nomenclatures={nomenclatures}
            handleReprint={handleReprint}
            showAuxiliary={showAuxiliary}
            setShowAuxiliary={setShowAuxiliary}
            theme={theme}
          />

          {/* COLUMN 3: RECENT ARCHIVE */}
          <section className="grid-col" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '0.85rem', color: isLight ? '#0f172a' : '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 900, textTransform: 'uppercase' }}>
                <Clock size={14} color={isLight ? '#0f172a' : '#ffffff'} /> АРХІВ (ОСТАННІ 3 ДНІ)
              </h3>
            </div>
            <MasterArchiveDrawer 
              tasks={tasks}
              orders={orders}
              allOrdersMap={allOrdersMap}
              handleReprint={handleReprint}
              theme={theme}
            />
          </section>
        </div>
      </main>

      {/* MOBILE DRAWER */}
      {isDrawerOpen && (
        <div
          className="no-print"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            justify: 'flex-end',
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(4px)',
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={() => setIsDrawerOpen(false)}
        >
          <div
            style={{
              background: isLight ? '#ffffff' : '#0a0a0a',
              width: '85%',
              maxWidth: '380px',
              height: '100%',
              borderLeft: isLight ? '1px solid #e2e8f0' : '1px solid #222222',
              display: 'flex',
              flexDirection: 'column',
              padding: '20px',
              overflowY: 'auto',
              boxShadow: '-10px 0 30px rgba(0,0,0,0.3)',
              animation: 'slideIn 0.2s ease-out'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid #1a1a1a', paddingBottom: '15px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: isLight ? '#0f172a' : '#ffffff' }}>
                {drawerType === 'queue' ? (
                  <>
                    <ListChecks size={18} color={isLight ? '#ea580c' : '#ff9000'} />
                    <span>ЧЕРГА ЗАМОВЛЕНЬ</span>
                  </>
                ) : (
                  <>
                    <History size={18} color={isLight ? '#15803d' : '#10b981'} />
                    <span>АРХІВ ЗАМОВЛЕНЬ</span>
                  </>
                )}
              </h3>
              <button
                onClick={() => setIsDrawerOpen(false)}
                style={{
                  background: isLight ? '#f1f5f9' : '#1a1a1a',
                  border: isLight ? '1px solid #cbd5e1' : '1px solid #333333',
                  color: isLight ? '#64748b' : '#aaaaaa',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ flex: 1 }}>
              {drawerType === 'queue' ? (
                <MasterOrderQueueList 
                  filteredPending={filteredPending}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  setShowPrepModal={setShowPrepModal}
                  handleOpenCustomVirtualNaryad={handleOpenCustomVirtualNaryad}
                  setQuickPlanOrder={setQuickPlanOrder}
                  getPlannedQty={getPlannedQty}
                  setTempSets={setTempSets}
                  setTempDeadline={setTempDeadline}
                  handleDeleteOrder={handleDeleteOrder}
                  tasks={tasks}
                  nomenclatures={nomenclatures}
                  theme={theme}
                />
              ) : (
                <MasterArchiveDrawer 
                  tasks={tasks}
                  orders={orders}
                  allOrdersMap={allOrdersMap}
                  handleReprint={handleReprint}
                  setIsDrawerOpen={setIsDrawerOpen}
                  theme={theme}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ALL MODAL COMPONENTS */}
      <MasterMachineCallsModal 
        showCallsModal={showCallsModal}
        setShowCallsModal={setShowCallsModal}
        activeCalls={activeCalls}
        handleResolveCall={handleResolveCall}
      />

      <MasterQuickPlanModal 
        quickPlanOrder={quickPlanOrder}
        setQuickPlanOrder={setQuickPlanOrder}
        tempSets={tempSets}
        setTempSets={setTempSets}
        tempDeadline={tempDeadline}
        setTempDeadline={setTempDeadline}
        handleOpenNaryadModal={handleOpenNaryadModal}
      />

      <MasterCustomCardModal 
        showCustomCardModal={showCustomCardModal}
        setShowCustomCardModal={setShowCustomCardModal}
        nomenclatures={nomenclatures}
        customCardNomId={customCardNomId}
        setCustomCardNomId={setCustomCardNomId}
        customCardQty={customCardQty}
        setCustomCardQty={setCustomCardQty}
        customCardMachine={customCardMachine}
        setCustomCardMachine={setCustomCardMachine}
        customCardDeadline={customCardDeadline}
        setCustomCardDeadline={setCustomCardDeadline}
        customCardSearch={customCardSearch}
        setCustomCardSearch={setCustomCardSearch}
        handleCreateCustomCard={handleCreateCustomCard}
        isSubmitting={isSubmitting}
      />

      <MasterPrepModal 
        showPrepModal={showPrepModal}
        setShowPrepModal={setShowPrepModal}
        nomenclatures={nomenclatures}
        inventory={inventory}
        prepQuantities={prepQuantities}
        setPrepQuantities={setPrepQuantities}
        prepDeadline={prepDeadline}
        setPrepDeadline={setPrepDeadline}
        handleCreatePrepOrder={handleCreatePrepOrder}
        isSubmitting={isSubmitting}
      />

      <MasterStockInfoModal 
        stockInfoModalData={stockInfoModalData}
        setStockInfoModalData={setStockInfoModalData}
        theme={theme}
      />

      <MasterNaryadModal 
        activeNaryadOrder={activeNaryadOrder}
        setActiveNaryadOrder={setActiveNaryadOrder}
        isReprintMode={isReprintMode}
        reprintTask={reprintTask}
        setReprintTask={setReprintTask}
        selectedMachine={selectedMachine}
        setSelectedMachine={setSelectedMachine}
        rowMachines={rowMachines}
        setRowMachines={setRowMachines}
        rowMachinesSplits={rowMachinesSplits}
        setRowMachinesSplits={setRowMachinesSplits}
        materialSplits={materialSplits}
        setMaterialSplits={setMaterialSplits}
        selectedCutters={selectedCutters}
        setSelectedCutters={setSelectedCutters}
        partCutterOverrides={partCutterOverrides}
        setPartCutterOverrides={setPartCutterOverrides}
        useStockBZ={useStockBZ}
        setUseStockBZ={setUseStockBZ}
        partBZOverrides={partBZOverrides}
        setPartBZOverrides={setPartBZOverrides}
        naryadQtys={naryadQtys}
        setNaryadQtys={setNaryadQtys}
        naryadDeadline={naryadDeadline}
        setNaryadDeadline={setNaryadDeadline}
        naryadParts={naryadParts}
        setNaryadParts={setNaryadParts}
        partSearchQueries={partSearchQueries}
        setPartSearchQueries={setPartSearchQueries}
        openDropdownRowKey={openDropdownRowKey}
        setOpenDropdownRowKey={setOpenDropdownRowKey}
        isSubmitting={isSubmitting}
        isSavingDraftOrder={isSavingDraftOrder}
        handlePrint={handlePrint}
        handleSaveVirtualDraft={handleSaveVirtualDraft}
        getBOMParts={getBOMParts}
        getDisplayPartsForOrderItem={getDisplayPartsForOrderItem}
        currentMachine={currentMachine}
        getBatchSuffix={getBatchSuffix}
        isPartBZActive={isPartBZActive}
        handleShowStockInfo={handleShowStockInfo}
        setStockInfoModalData={setStockInfoModalData}
        getPlannedQty={getPlannedQty}
        nomenclatures={nomenclatures}
        inventory={inventory}
        machines={machines}
        machineOperations={machineOperations}
        currentUser={currentUser}
        materialSummary={materialSummary}
        productNames={productNames}
        isSheetDistributionComplete={isSheetDistributionComplete}
        isPrintDisabled={isPrintDisabled}
        handleSplitChange={handleSplitChange}
        requests={requests}
        theme={theme}
      />

      <style dangerouslySetInnerHTML={{
        __html: `
        .print-only-table {
          display: none !important;
        }
        .master-grid {
          grid-template-columns: 240px 1fr 250px !important;
        }
        .mobile-nav-buttons {
          display: flex !important;
          gap: 8px;
        }
        @media (min-width: 769px) {
          .mobile-nav-buttons {
            display: none !important;
          }
        }
        @media (max-width: 768px) {
          .master-grid {
            grid-template-columns: 1fr !important;
            gap: 15px !important;
          }
          .module-content {
            padding: 10px !important;
          }
        }
        .interactive-naryad-title {
          text-decoration: underline !important;
          text-decoration-style: dashed !important;
          text-decoration-color: rgba(234, 88, 12, 0.6) !important;
          text-underline-offset: 4px !important;
          transition: all 0.2s ease !important;
        }
        .interactive-naryad-title:hover {
          color: #ea580c !important;
          text-decoration-color: #ea580c !important;
          text-decoration-style: solid !important;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}} />
    </div>
  )
}

export default MasterModule
