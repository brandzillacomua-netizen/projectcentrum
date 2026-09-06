import React from 'react'
import { Camera, RefreshCw, Search, QrCode, X } from 'lucide-react'
import { useShop2TerminalState } from './Shop2/hooks/useShop2TerminalState'
import { Shop2Header } from './Shop2/components/Shop2Header'
import { Shop2QueueList } from './Shop2/components/Shop2QueueList'
import { Shop2ActiveCardsTable } from './Shop2/components/Shop2ActiveCardsTable'
import { Shop2Dashboard } from './Shop2/components/Shop2Dashboard'
import { Shop2CardDetails } from './Shop2/components/Shop2CardDetails'
import { Shop2QCModal } from './Shop2/components/modals/Shop2QCModal'
import { Shop2MachineCallModal } from './Shop2/components/modals/Shop2MachineCallModal'
import { Shop2AdminCardModal } from './Shop2/components/modals/Shop2AdminCardModal'
import { Shop2ScrapModal } from './Shop2/components/modals/Shop2ScrapModal'
import { Shop2StorageExplorerModal } from './Shop2/components/modals/Shop2StorageExplorerModal'
import { Shop2DetailStageModal } from './Shop2/components/modals/Shop2DetailStageModal'

const Shop2Terminal = () => {
  const state = useShop2TerminalState()

  return (
    <div className="operator-terminal-shop2" style={{ background: '#0a0a0a', height: '100vh', display: 'flex', flexDirection: 'column', color: '#fff', overflow: 'hidden' }}>
      <Shop2Header
        currentTime={state.currentTime}
        setIsDrawerOpen={state.setIsDrawerOpen}
        queuedCardsCount={state.queuedCards.length}
        setShowStorageExplorer={state.setShowStorageExplorer}
        isAdmin={state.isAdmin}
        setShowAdminCardModal={state.setShowAdminCardModal}
      />

      <div className="main-layout-responsive" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Desktop Side Panel */}
        <div className="side-panel hide-mobile" style={{ width: '300px', background: '#121212', borderRight: '1px solid #222', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '20px', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800, color: '#555', display: 'flex', alignItems: 'center', gap: '10px' }}>
            📋 ЧЕРГА ЦЕХ №2 ({state.queuedCards.length})
          </div>
          <Shop2QueueList
            queuedCards={state.queuedCards}
            selectedCardId={state.selectedCardId}
            setSelectedCardId={state.setSelectedCardId}
            getNomFromCard={state.getNomFromCard}
            onSelectCard={() => state.setScanError(null)}
          />
          <div style={{ padding: '15px', borderTop: '1px solid #1a1a1a' }}>
            <button
              onClick={() => state.setIsScanning(true)}
              style={{ width: '100%', background: '#8b5cf615', border: '1px solid #8b5cf630', color: '#8b5cf6', padding: '14px', borderRadius: '12px', fontWeight: 900, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Camera size={18} /> СКАНУВАТИ
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {state.isDrawerOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 99999 }} onClick={() => state.setIsDrawerOpen(false)} />
        )}
        <div style={{ position: 'fixed', left: state.isDrawerOpen ? 0 : '-300px', top: 0, bottom: 0, width: '300px', background: '#121212', zIndex: 100000, transition: '0.3s', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>ОБЕРІТЬ КАРТУ</span>
            <X size={20} onClick={() => state.setIsDrawerOpen(false)} style={{ cursor: 'pointer' }} />
          </div>
          <Shop2QueueList
            queuedCards={state.queuedCards}
            selectedCardId={state.selectedCardId}
            setSelectedCardId={state.setSelectedCardId}
            getNomFromCard={state.getNomFromCard}
            onSelectCard={() => { state.setIsDrawerOpen(false); state.setScanError(null) }}
          />
          <div style={{ padding: '15px', borderTop: '1px solid #1a1a1a' }}>
            <button
              onClick={() => state.setIsScanning(true)}
              style={{ width: '100%', background: '#8b5cf615', border: '1px solid #8b5cf630', color: '#8b5cf6', padding: '14px', borderRadius: '12px', fontWeight: 900, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Camera size={18} /> СКАНУВАТИ
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="content-panel" style={{ flex: 1, padding: '20px 15px', background: '#0a0a0a', overflowY: 'auto', position: 'relative' }}>
          {state.scanError && (
            <div style={{ background: '#ef444422', border: '1px solid #ef444455', color: '#ef4444', padding: '15px', borderRadius: '15px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '0.8rem' }}>{state.scanError}</span>
              <X size={18} style={{ cursor: 'pointer' }} onClick={() => state.setScanError(null)} />
            </div>
          )}

          {state.currentCard ? (
            <Shop2CardDetails
              currentCard={state.currentCard}
              getNomFromCard={state.getNomFromCard}
              orders={state.orders}
              setSelectedCardId={state.setSelectedCardId}
              setShowQCModal={state.setShowQCModal}
              selectedStage={state.selectedStage}
              setSelectedStage={state.setSelectedStage}
              shop2Stages={state.shop2Stages}
              selectedManager={state.selectedManager}
              setSelectedManager={state.setSelectedManager}
              getFilteredManagers={state.getFilteredManagers}
              selectedShift={state.selectedShift}
              setSelectedShift={state.setSelectedShift}
              selectedOperator={state.selectedOperator}
              setSelectedOperator={state.setSelectedOperator}
              getFilteredOperators={state.getFilteredOperators}
              handleStartOperation={state.handleStartOperation}
              isProcessing={state.isProcessing}
              handoverToSGP={state.handoverToSGP}
              setScannedCardIds={state.setScannedCardIds}
              setIsProcessing={state.setIsProcessing}
              formatElapsedTime={state.formatElapsedTime}
              submitCompletion={state.submitCompletion}
            />
          ) : (
            <div style={{ width: '100%', padding: '0 10px' }}>
              <Shop2Dashboard
                calculateTotalBufferParts={state.calculateTotalBufferParts}
                setShowStorageExplorer={state.setShowStorageExplorer}
                shop2Stages={state.shop2Stages}
                workCards={state.workCards}
                workCardHistory={state.workCardHistory}
                isShop2Card={state.isShop2Card}
                matchesStage={state.matchesStage}
                setDetailStage={state.setDetailStage}
                isSyncing={state.isSyncing}
                setSelectedCardId={state.setSelectedCardId}
                getNomFromCard={state.getNomFromCard}
              />
            </div>
          )}
        </div>
      </div>

      {/* Floating Controls */}
      <div className="floating-controls-container">
        <form
          onSubmit={state.handleManualEntry}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(10, 10, 10, 0.95)',
            border: '1px solid #222',
            padding: '10px 14px',
            borderRadius: '24px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(10px)'
          }}
        >
          <Search size={16} color="#6b7280" />
          <input
            type="text"
            placeholder="Введіть системний номер..."
            value={state.manualId}
            onChange={e => state.setManualId(e.target.value)}
            disabled={state.isProcessing}
            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 700, outline: 'none', width: '100%' }}
          />
          <button
            type="submit"
            disabled={state.isProcessing}
            style={{ background: '#8b5cf6', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '16px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}
          >
            {state.isProcessing ? <RefreshCw size={12} className="anim-spin" /> : 'ЗНАЙТИ'}
          </button>
        </form>

        <button
          onClick={() => state.setIsScanning(true)}
          className="hover-lift"
          style={{ 
            background: '#8b5cf6', 
            border: 'none', 
            color: '#000', 
            width: '64px',
            height: '64px',
            borderRadius: '50%', 
            display: 'flex', 
            justifyContent: 'center',
            alignItems: 'center', 
            cursor: 'pointer',
            boxShadow: '0 10px 30px rgba(139,92,246,0.4)',
            transition: 'all 0.2s',
            flexShrink: 0
          }}
        >
          <QrCode size={32} />
        </button>
      </div>

      {/* Modals */}
      <Shop2QCModal
        showQCModal={state.showQCModal}
        setShowQCModal={state.setShowQCModal}
        currentCard={state.currentCard}
        getNomFromCard={state.getNomFromCard}
        qcInspector={state.qcInspector}
        setQcInspector={state.setQcInspector}
        qcReason={state.qcReason}
        setQcReason={state.setQcReason}
        qcCustomReason={state.qcCustomReason}
        setQcCustomReason={state.setQcCustomReason}
        scrapReasons={state.scrapReasons}
        qcScrapCount={state.qcScrapCount}
        setQcScrapCount={state.setQcScrapCount}
        handleQCScrapOverride={state.handleQCScrapOverride}
        isProcessing={state.isProcessing}
      />

      <Shop2MachineCallModal
        machineCallModal={state.machineCallModal}
        setMachineCallModal={state.setMachineCallModal}
        machineCallSuccess={state.machineCallSuccess}
        selectedCallMasterId={state.selectedCallMasterId}
        setSelectedCallMasterId={state.setSelectedCallMasterId}
        selectedCallEngineerId={state.selectedCallEngineerId}
        setSelectedCallEngineerId={state.setSelectedCallEngineerId}
        selectedCallQCId={state.selectedCallQCId}
        setSelectedCallQCId={state.setSelectedCallQCId}
        callMasters={state.callMasters}
        callEngineers={state.callEngineers}
        callQCs={state.callQCs}
        handleCreateCall={state.handleCreateCall}
      />

      <Shop2AdminCardModal
        showAdminCardModal={state.showAdminCardModal}
        setShowAdminCardModal={state.setShowAdminCardModal}
        nomenclatures={state.nomenclatures}
        tasks={state.tasks}
        orders={state.orders}
        adminNomId={state.adminNomId}
        setAdminNomId={state.setAdminNomId}
        adminTaskId={state.adminTaskId}
        setAdminTaskId={state.setAdminTaskId}
        adminQty={state.adminQty}
        setAdminQty={state.setAdminQty}
        adminStage={state.adminStage}
        setAdminStage={state.setAdminStage}
        nomSearchText={state.nomSearchText}
        setNomSearchText={state.setNomSearchText}
        showNomDropdown={state.showNomDropdown}
        setShowNomDropdown={state.setShowNomDropdown}
        handleCreateAdminCard={state.handleCreateAdminCard}
        isProcessing={state.isProcessing}
      />

      <Shop2ScrapModal
        showScrapModal={state.showScrapModal}
        setShowScrapModal={state.setShowScrapModal}
        currentCard={state.currentCard}
        getNomFromCard={state.getNomFromCard}
        scrapCounts={state.scrapCounts}
        setScrapCounts={state.setScrapCounts}
        handleFinalFinish={state.handleFinalFinish}
        isProcessing={state.isProcessing}
      />

      <Shop2StorageExplorerModal
        showStorageExplorer={state.showStorageExplorer}
        setShowStorageExplorer={state.setShowStorageExplorer}
        workCards={state.workCards}
        isShop2Card={state.isShop2Card}
        tasks={state.tasks}
        orders={state.orders}
        nomenclatures={state.nomenclatures}
        inventory={state.inventory}
        bufferSearchQuery={state.bufferSearchQuery}
        setBufferSearchQuery={state.setBufferSearchQuery}
        calculateTotalBufferParts={state.calculateTotalBufferParts}
      />

      <Shop2DetailStageModal
        detailStage={state.detailStage}
        setDetailStage={state.setDetailStage}
        detailTab={state.detailTab}
        setDetailTab={state.setDetailTab}
        workCards={state.workCards}
        isShop2Card={state.isShop2Card}
        matchesStage={state.matchesStage}
        getNomFromCard={state.getNomFromCard}
        handoverToSGP={state.handoverToSGP}
        isProcessing={state.isProcessing}
        setIsProcessing={state.setIsProcessing}
      />

      <style dangerouslySetInnerHTML={{
        __html: `
        .floating-controls-container {
          position: fixed;
          bottom: 30px;
          right: 30px;
          display: flex;
          align-items: center;
          gap: 12px;
          z-index: 1000;
          transition: all 0.3s ease;
        }
        @media (max-width: 600px) {
          .floating-controls-container {
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
          }
          .floating-controls-container form {
            flex: 1;
            box-shadow: none !important;
            background: #000 !important;
            border: 1px solid #222 !important;
          }
        }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #222; borderRadius: 3px; }
      `}} />
    </div>
  )
}

export default Shop2Terminal
