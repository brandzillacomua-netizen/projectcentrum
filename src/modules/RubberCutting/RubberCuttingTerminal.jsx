import React, { useState } from 'react';
import { useRubberCuttingTerminal } from './hooks/useRubberCuttingTerminal';
import { RubberHeader } from './components/RubberHeader';
import { RubberTabs } from './components/RubberTabs';
import { RubberIncomingOrders } from './components/CuttingDesk/RubberIncomingOrders';
import { StartCuttingTaskModal } from './components/CuttingDesk/StartCuttingTaskModal';
import { MaterialSelector } from './components/CuttingDesk/MaterialSelector';
import { PartSelector } from './components/CuttingDesk/PartSelector';
import { CuttingActiveCard } from './components/CuttingDesk/CuttingActiveCard';
import { CompleteCuttingModal } from './components/CuttingDesk/CompleteCuttingModal';
import { RubberCuttingQueue } from './components/Queue/RubberCuttingQueue';
import { RubberStockOverview } from './components/Stock/RubberStockOverview';
import { CuttingAnalyticsView } from './components/Analytics/CuttingAnalyticsView';
import { CheckCircle2, ChevronDown, ChevronUp, Wrench } from 'lucide-react';
import { ACCENT_RUBBER_RGB } from './utils/rubberConstants';

export const RubberCuttingTerminal = () => {
  const terminal = useRubberCuttingTerminal();
  const [showManualCut, setShowManualCut] = useState(false);

  return (
    <div
      className="rubber-cutting-terminal terminal-module-root"
      style={{
        background: '#070709',
        minHeight: '100vh',
        color: '#fff',
        fontFamily: "'Outfit', 'Inter', -apple-system, sans-serif",
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* 1. HEADER */}
      <RubberHeader
        selectedShift={terminal.selectedShift}
        setSelectedShift={terminal.setSelectedShift}
        onShiftOperators={terminal.onShiftOperators}
        currentTime={terminal.currentTime}
      />

      {/* 2. SUBMODULE TABS */}
      <RubberTabs
        activeTab={terminal.activeTab}
        setActiveTab={terminal.setActiveTab}
        queueCount={terminal.batches.filter(b => b.status === 'pending' || b.status === 'in_progress').length}
        partsCount={terminal.parts.length}
      />

      {/* 3. MAIN WORK AREA */}
      <main style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* TAB 1: РОБОЧЕ МІСЦЕ ПОРІЗКИ */}
          {terminal.activeTab === 'cutting' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {terminal.selectedPart ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => {
                        terminal.setSelectedPart(null);
                        terminal.resetTimer();
                      }}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#94a3b8',
                        borderRadius: '10px',
                        padding: '8px 14px',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      ← Повернутися до списку завдань
                    </button>
                  </div>

                  {/* Active cutting station & timer */}
                  <CuttingActiveCard
                    selectedPart={terminal.selectedPart}
                    activeBatch={terminal.activeBatch}
                    sheetsCount={terminal.sheetsCount}
                    setSheetsCount={terminal.setSheetsCount}
                    selectedOperators={terminal.selectedOperators}
                    setSelectedOperators={terminal.setSelectedOperators}
                    onShiftOperators={terminal.onShiftOperators}
                    allStageOperators={terminal.allStageOperators}
                    isTimerRunning={terminal.isTimerRunning}
                    elapsedSeconds={terminal.elapsedSeconds}
                    startTimer={terminal.startTimer}
                    pauseTimer={terminal.pauseTimer}
                    resetTimer={terminal.resetTimer}
                    plannedDurationSec={terminal.plannedDurationSec}
                    plannedTotalParts={terminal.plannedTotalParts}
                    handleOpenCompleteModal={terminal.handleOpenCompleteModal}
                  />
                </>
              ) : (
                <>
                  {/* Primary: Incoming orders from Shop 2 Foreman */}
                  <RubberIncomingOrders
                    pendingOrders={terminal.pendingBatches}
                    onTakeToWork={terminal.handleTakeOrderToWork}
                    onRefresh={terminal.loadData}
                    loading={terminal.loading}
                  />

                  {/* Secondary: Collapsible manual/unplanned cut */}
                  <div style={{
                    background: '#0d0d12',
                    borderRadius: '18px',
                    border: '1px solid rgba(255,255,255,0.06)',
                    overflow: 'hidden'
                  }}>
                    <button
                      onClick={() => setShowManualCut(prev => !prev)}
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        padding: '16px 24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        fontWeight: 800,
                        fontSize: '0.85rem'
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Wrench size={16} color="#64748b" />
                        Позаплановий розкрій (ручний вибір деталі без заявки)
                      </span>
                      {showManualCut ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>

                    {showManualCut && (
                      <div style={{ padding: '0 24px 24px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <MaterialSelector
                          selectedThickness={terminal.selectedThickness}
                          setSelectedThickness={terminal.setSelectedThickness}
                          rawStock={terminal.rawStock}
                        />
                        <PartSelector
                          parts={terminal.filteredParts}
                          selectedPart={terminal.selectedPart}
                          setSelectedPart={terminal.setSelectedPart}
                          partSearch={terminal.partSearch}
                          setPartSearch={terminal.setPartSearch}
                          selectedThickness={terminal.selectedThickness}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: ЧЕРГА ЗАВДАНЬ ТА ПАРТІЙ */}
          {terminal.activeTab === 'queue' && (
            <RubberCuttingQueue
              batches={terminal.batches}
              parts={terminal.parts}
              onSelectBatchForWork={(part) => {
                terminal.setSelectedPart(part);
                terminal.setActiveTab('cutting');
              }}
            />
          )}

          {/* TAB 3: ЗАЛИШКИ ТА ДОВІДНИК */}
          {terminal.activeTab === 'stock' && (
            <RubberStockOverview
              rawStock={terminal.rawStock}
              parts={terminal.parts}
            />
          )}

          {/* TAB 4: АНАЛІТИКА ТА ЕФЕКТИВНІСТЬ ОПЕРАТОРІВ */}
          {terminal.activeTab === 'analytics' && (
            <CuttingAnalyticsView
              batches={terminal.batches}
            />
          )}
        </div>
      </main>

      {/* START TASK MODAL (Take Foreman Order into Work) */}
      <StartCuttingTaskModal
        isOpen={Boolean(terminal.orderToStart)}
        onClose={() => terminal.setOrderToStart(null)}
        order={terminal.orderToStart}
        onConfirmStart={terminal.handleConfirmStartTask}
        onShiftOperators={terminal.onShiftOperators}
        allStageOperators={terminal.allStageOperators}
        isSubmitting={terminal.isSubmitting}
      />

      {/* COMPLETION MODAL */}
      <CompleteCuttingModal
        isOpen={terminal.showCompleteModal}
        onClose={() => terminal.setShowCompleteModal(false)}
        selectedPart={terminal.selectedPart}
        sheetsCount={terminal.sheetsCount}
        actualProduced={terminal.actualProduced}
        setActualProduced={terminal.setActualProduced}
        scrapCount={terminal.scrapCount}
        setScrapCount={terminal.setScrapCount}
        scrapReason={terminal.scrapReason}
        setScrapReason={terminal.setScrapReason}
        completionNotes={terminal.completionNotes}
        setCompletionNotes={terminal.setCompletionNotes}
        elapsedSeconds={terminal.elapsedSeconds}
        plannedDurationSec={terminal.plannedDurationSec}
        selectedOperators={terminal.selectedOperators}
        isSubmitting={terminal.isSubmitting}
        onSubmit={terminal.handleSubmitComplete}
      />

      {/* TOAST NOTIFICATION */}
      {terminal.toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: '#13131c',
          border: `1px solid rgba(${ACCENT_RUBBER_RGB}, 0.5)`,
          color: '#fff',
          padding: '14px 20px',
          borderRadius: '14px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 800,
          fontSize: '0.85rem',
          zIndex: 9999
        }}>
          <CheckCircle2 size={18} color="#ff9000" />
          <span>{terminal.toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default RubberCuttingTerminal;

