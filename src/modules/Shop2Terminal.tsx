import React from 'react'
import { Camera, RefreshCw, Search, QrCode, X } from 'lucide-react'
import { useShop2TerminalState } from './Shop2/hooks/useShop2TerminalState'
import { Shop2Header } from './Shop2/components/Shop2Header'
import { Shop2QueueList } from './Shop2/components/Shop2QueueList'
import { Shop2Dashboard } from './Shop2/components/Shop2Dashboard'
import { Shop2CardDetails } from './Shop2/components/Shop2CardDetails'
import { Shop2QCModal } from './Shop2/components/modals/Shop2QCModal'
import { Shop2MachineCallModal } from './Shop2/components/modals/Shop2MachineCallModal'
import { Shop2AdminCardModal } from './Shop2/components/modals/Shop2AdminCardModal'
import { Shop2ScrapModal } from './Shop2/components/modals/Shop2ScrapModal'
import { Shop2StorageExplorerModal } from './Shop2/components/modals/Shop2StorageExplorerModal'
import { Shop2DetailStageModal } from './Shop2/components/modals/Shop2DetailStageModal'

export const Shop2Terminal: React.FC = () => {
  const state: any = useShop2TerminalState()

  return (
    <div className="operator-terminal-shop2" style={{ background: 'var(--surface-inset)', height: '100vh', display: 'flex', flexDirection: 'column', color: 'var(--text-strong)', overflow: 'hidden' }}>
      <Shop2Header
        currentTime={state.currentTime}
        onOpenDrawer={() => state.setIsDrawerOpen(true)}
        queuedCardsCount={state.queuedCards.length}
        onOpenStorageExplorer={() => state.setShowStorageExplorer(true)}
        isAdmin={state.isAdmin}
        onOpenAdminCardModal={() => state.setShowAdminCardModal(true)}
      />

      <div className="main-layout-responsive" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Desktop Side Panel */}
        <Shop2QueueList
          queuedCards={state.queuedCards}
          selectedCardId={state.selectedCardId}
          setSelectedCardId={state.setSelectedCardId}
          setIsDrawerOpen={state.setIsDrawerOpen}
          setScanError={state.setScanError}
          setIsScanning={state.setIsScanning}
          getNomFromCard={state.getNomFromCard}
          getCardDisplayInfo={state.getCardDisplayInfo}
          isMobile={false}
        />

        {/* Mobile Drawer */}
        {state.isDrawerOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 99999 }} onClick={() => state.setIsDrawerOpen(false)} />
        )}
        {state.isDrawerOpen && (
          <Shop2QueueList
            queuedCards={state.queuedCards}
            selectedCardId={state.selectedCardId}
            setSelectedCardId={state.setSelectedCardId}
            setIsDrawerOpen={state.setIsDrawerOpen}
            setScanError={state.setScanError}
            setIsScanning={state.setIsScanning}
            getNomFromCard={state.getNomFromCard}
            getCardDisplayInfo={state.getCardDisplayInfo}
            isMobile={true}
          />
        )}

        {/* Main Content Area */}
        <div className="content-panel" style={{ flex: 1, minWidth: 0, padding: '20px 15px 100px', background: 'var(--surface-inset)', overflowY: 'auto', position: 'relative' }}>
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
              getCardDisplayInfo={state.getCardDisplayInfo}
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
              selectedMachine={state.selectedMachine}
              handleStartOperation={state.handleStartOperation}
              isProcessing={state.isProcessing}
              handoverToSGP={state.handoverToSGP}
              setScannedCardIds={state.setScannedCardIds}
              setIsProcessing={state.setIsProcessing}
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
                setDetailStage={state.setDetailStage}
                isSyncing={state.isSyncing}
                setSelectedCardId={state.setSelectedCardId}
                getNomFromCard={state.getNomFromCard}
                getCardDisplayInfo={state.getCardDisplayInfo}
              />
            </div>
          )}
        </div>
      </div>

      {/* Floating Controls */}
      <div className="floating-controls-container shop2-floating-controls">
        <form
          onSubmit={state.handleManualEntry}
          className="shop2-floating-search-form"
        >
          <Search size={16} className="shop2-floating-search-icon" />
          <input
            type="text"
            placeholder="Введіть системний номер..."
            value={state.manualId}
            onChange={e => state.setManualId(e.target.value)}
            disabled={state.isProcessing}
            className="shop2-floating-search-input"
          />
          <button
            type="submit"
            disabled={state.isProcessing}
            className="shop2-floating-search-btn"
          >
            {state.isProcessing ? <RefreshCw size={12} className="anim-spin" /> : 'ЗНАЙТИ'}
          </button>
        </form>

        <button
          onClick={() => state.setIsScanning(true)}
          className="shop2-floating-qr-btn hover-lift"
          title="Сканувати QR-код"
        >
          <QrCode size={30} className="shop2-floating-qr-icon" />
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
        .shop2-floating-controls {
          position: fixed;
          bottom: 30px;
          right: 30px;
          display: flex;
          align-items: center;
          gap: 12px;
          z-index: 1000;
          transition: all 0.3s ease;
        }

        .shop2-floating-search-form {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(14, 14, 18, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.12);
          padding: 8px 10px 8px 16px;
          border-radius: 26px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(12px);
          min-width: 290px;
          box-sizing: border-box;
          transition: all 0.2s ease;
        }
        .shop2-floating-search-form:focus-within {
          border-color: rgba(139, 92, 246, 0.6);
          box-shadow: 0 10px 35px rgba(0, 0, 0, 0.6), 0 0 0 2px rgba(139, 92, 246, 0.2);
        }

        .shop2-floating-search-icon {
          color: #94a3b8;
          flex-shrink: 0;
        }

        .shop2-floating-search-input {
          background: transparent !important;
          background-color: transparent !important;
          border: none !important;
          box-shadow: none !important;
          color: #f8fafc !important;
          font-size: 0.88rem;
          font-weight: 700;
          outline: none !important;
          width: 100%;
          padding: 4px 0 !important;
          margin: 0 !important;
          font-family: inherit;
        }
        .shop2-floating-search-input::placeholder {
          color: #64748b !important;
          opacity: 1;
        }

        .shop2-floating-search-btn {
          background: #8b5cf6;
          color: #ffffff !important;
          border: none;
          padding: 7px 15px;
          border-radius: 18px;
          font-size: 0.76rem;
          font-weight: 950;
          letter-spacing: 0.4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
          box-shadow: 0 4px 14px rgba(139, 92, 246, 0.35);
          transition: all 0.18s ease;
        }
        .shop2-floating-search-btn:hover:not(:disabled) {
          background: #7c3aed;
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(139, 92, 246, 0.45);
        }
        .shop2-floating-search-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .shop2-floating-qr-btn {
          background: linear-gradient(135deg, #8b5cf6, #7c3aed);
          border: none;
          color: #ffffff !important;
          width: 58px;
          height: 58px;
          border-radius: 50%;
          display: flex;
          justify-content: center;
          align-items: center;
          cursor: pointer;
          box-shadow: 0 10px 30px rgba(139, 92, 246, 0.45);
          transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          flex-shrink: 0;
        }
        .shop2-floating-qr-btn:hover {
          transform: scale(1.06) translateY(-2px);
          box-shadow: 0 14px 35px rgba(139, 92, 246, 0.55);
        }
        .shop2-floating-qr-btn:active {
          transform: scale(0.96);
        }
        .shop2-floating-qr-icon {
          color: #ffffff;
          stroke: #ffffff;
        }

        /* Light Theme Overrides */
        body.light-theme .shop2-floating-search-form,
        .light-theme .shop2-floating-search-form {
          background: rgba(255, 255, 255, 0.96) !important;
          background-color: rgba(255, 255, 255, 0.96) !important;
          border: 1px solid #cbd5e1 !important;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12), 0 2px 6px rgba(15, 23, 42, 0.04) !important;
        }
        body.light-theme .shop2-floating-search-form:focus-within,
        .light-theme .shop2-floating-search-form:focus-within {
          border-color: #8b5cf6 !important;
          box-shadow: 0 10px 35px rgba(139, 92, 246, 0.2), 0 0 0 2px rgba(139, 92, 246, 0.25) !important;
        }

        body.light-theme .shop2-floating-search-icon,
        .light-theme .shop2-floating-search-icon {
          color: #64748b !important;
        }

        body.light-theme .shop2-floating-search-input,
        .light-theme .shop2-floating-search-input {
          background: transparent !important;
          background-color: transparent !important;
          border: none !important;
          box-shadow: none !important;
          color: #0f172a !important;
          caret-color: #7c3aed !important;
        }
        body.light-theme .shop2-floating-search-input::placeholder,
        .light-theme .shop2-floating-search-input::placeholder {
          color: #94a3b8 !important;
          opacity: 1;
        }

        body.light-theme .shop2-floating-search-btn,
        .light-theme .shop2-floating-search-btn {
          background: #7c3aed !important;
          background-color: #7c3aed !important;
          color: #ffffff !important;
          box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35) !important;
        }
        body.light-theme .shop2-floating-search-btn:hover:not(:disabled),
        .light-theme .shop2-floating-search-btn:hover:not(:disabled) {
          background: #6d28d9 !important;
          box-shadow: 0 6px 18px rgba(124, 58, 237, 0.45) !important;
        }

        body.light-theme .shop2-floating-qr-btn,
        .light-theme .shop2-floating-qr-btn {
          background: #ffffff !important;
          background-color: #ffffff !important;
          border: 1.5px solid #cbd5e1 !important;
          color: #7c3aed !important;
          box-shadow: 0 10px 25px rgba(15, 23, 42, 0.1), 0 2px 6px rgba(15, 23, 42, 0.04) !important;
        }
        body.light-theme .shop2-floating-qr-btn:hover,
        .light-theme .shop2-floating-qr-btn:hover {
          border-color: #8b5cf6 !important;
          box-shadow: 0 12px 30px rgba(139, 92, 246, 0.25) !important;
        }
        body.light-theme .shop2-floating-qr-btn .shop2-floating-qr-icon,
        .light-theme .shop2-floating-qr-btn .shop2-floating-qr-icon {
          color: #7c3aed !important;
          stroke: #7c3aed !important;
        }

        @media (max-width: 600px) {
          .shop2-floating-controls {
            bottom: 0;
            left: 0;
            right: 0;
            width: 100%;
            background: rgba(10, 10, 14, 0.96) !important;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            padding: 12px 16px;
            justify-content: space-between;
            border-radius: 0;
            box-shadow: 0 -10px 35px rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(15px);
            box-sizing: border-box;
          }
          .shop2-floating-controls .shop2-floating-search-form {
            flex: 1;
            min-width: 0;
            box-shadow: none !important;
            background: #14141b !important;
            border: 1px solid rgba(255, 255, 255, 0.12) !important;
            padding: 6px 8px 6px 12px;
          }
          .shop2-floating-controls .shop2-floating-qr-btn {
            width: 48px;
            height: 48px;
          }

          body.light-theme .shop2-floating-controls,
          .light-theme .shop2-floating-controls {
            background: rgba(255, 255, 255, 0.97) !important;
            border-top: 1px solid #e2e8f0 !important;
            box-shadow: 0 -10px 30px rgba(15, 23, 42, 0.08) !important;
          }
          body.light-theme .shop2-floating-controls .shop2-floating-search-form,
          .light-theme .shop2-floating-controls .shop2-floating-search-form {
            background: #f1f5f9 !important;
            background-color: #f1f5f9 !important;
            border: 1px solid #cbd5e1 !important;
          }
        }

        @media (max-width: 768px) {
          .content-panel {
            padding-bottom: 120px !important;
          }
        }

        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border-subtle); borderRadius: 3px; }
      `}} />
    </div>
  )
}

export default Shop2Terminal
