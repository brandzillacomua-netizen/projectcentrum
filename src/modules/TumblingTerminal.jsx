import React from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useTumblingTerminalData } from './Tumbling/hooks/useTumblingTerminalData.js'

import TumblingTerminalHeader from './Tumbling/components/TumblingTerminalHeader.jsx'
import TumblingTerminalFilters from './Tumbling/components/TumblingTerminalFilters.jsx'
import TumblingTerminalCardList from './Tumbling/components/TumblingTerminalCardList.jsx'
import TumblingTerminalFloatingControls from './Tumbling/components/TumblingTerminalFloatingControls.jsx'
import TumblingStartConfirmModal from './Tumbling/components/modals/TumblingStartConfirmModal.jsx'
import TumblingCompleteModal from './Tumbling/components/modals/TumblingCompleteModal.jsx'
import TumblingQRScannerModal from './Tumbling/components/modals/TumblingQRScannerModal.jsx'

export default function TumblingTerminal() {
  const {
    currentTime,
    selectedShift,
    setSelectedShift,
    manualId,
    setManualId,
    scanError,
    setScanError,
    isProcessing,
    isScanning,
    setIsScanning,
    showManualInput,
    setShowManualInput,
    showCompleteModal,
    setShowCompleteModal,
    activeCompletingCard,
    scrapCount,
    setScrapCount,
    finishedCount,
    setFinishedCount,
    pendingStartCard,
    setPendingStartCard,
    filterMode,
    setFilterMode,
    subStageFilter,
    setSubStageFilter,
    getNom,
    getNextTumblingOperation,
    startTumblingCard,
    openCompleteModal,
    submitTumblingComplete,
    handleManualSubmit,
    formatDuration,
    waitingCards,
    inWorkCards,
    displayedCards,
    priorityMap,
    bottleneckNomenclaturesMap,
    orderKits
  } = useTumblingTerminalData()

  return (
    <div style={{ background: 'var(--bg, #070709)', minHeight: '100vh', color: 'var(--text, #fff)', fontFamily: "'Outfit', 'Inter', sans-serif", display: 'flex', flexDirection: 'column' }}>

      {/* HEADER SECTION */}
      <TumblingTerminalHeader
        currentTime={currentTime}
        selectedShift={selectedShift}
        setSelectedShift={setSelectedShift}
      />

      {/* Inline scan error alert */}
      {scanError && (
        <div style={{ padding: '0 24px' }}>
          <div style={{ maxWidth: '600px', margin: '20px auto 0', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '10px 16px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(239,68,68,0.1)' }}>
            <AlertTriangle size={14} />
            <span style={{ flex: 1 }}>{scanError}</span>
            <button onClick={() => setScanError(null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}><X size={16} /></button>
          </div>
        </div>
      )}

      {/* DASHBOARD GRID */}
      <main style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <section style={{ flex: 1, background: 'var(--card-bg, #0c0c10)', borderRadius: '24px', border: '1px solid var(--glass-border, rgba(255,255,255,0.03))', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>

          {/* Filter tabs */}
          <TumblingTerminalFilters
            filterMode={filterMode}
            setFilterMode={setFilterMode}
            subStageFilter={subStageFilter}
            setSubStageFilter={setSubStageFilter}
            waitingCards={waitingCards}
            inWorkCards={inWorkCards}
            getNextTumblingOperation={getNextTumblingOperation}
          />

          {/* Cards List */}
          <TumblingTerminalCardList
            displayedCards={displayedCards}
            getNom={getNom}
            bottleneckNomenclaturesMap={bottleneckNomenclaturesMap}
            orderKits={orderKits}
            priorityMap={priorityMap}
            formatDuration={formatDuration}
            getNextTumblingOperation={getNextTumblingOperation}
            setPendingStartCard={setPendingStartCard}
            openCompleteModal={openCompleteModal}
            isProcessing={isProcessing}
          />
        </section>
      </main>

      {/* ── CUSTOM START CONFIRMATION MODAL ── */}
      <TumblingStartConfirmModal
        pendingStartCard={pendingStartCard}
        onClose={() => setPendingStartCard(null)}
        onConfirm={startTumblingCard}
        getNextTumblingOperation={getNextTumblingOperation}
        getNom={getNom}
        isProcessing={isProcessing}
      />

      {/* ── COMPLETE WORK MODAL ── */}
      <TumblingCompleteModal
        showCompleteModal={showCompleteModal}
        activeCompletingCard={activeCompletingCard}
        onClose={() => setShowCompleteModal(false)}
        finishedCount={finishedCount}
        setFinishedCount={setFinishedCount}
        scrapCount={scrapCount}
        setScrapCount={setScrapCount}
        submitTumblingComplete={submitTumblingComplete}
        getNom={getNom}
        isProcessing={isProcessing}
      />

      {/* ── QR-SCANNER MODAL ── */}
      <TumblingQRScannerModal
        isScanning={isScanning}
        setIsScanning={setIsScanning}
        showManualInput={showManualInput}
        setShowManualInput={setShowManualInput}
        manualId={manualId}
        setManualId={setManualId}
        handleManualSubmit={handleManualSubmit}
        scanError={scanError}
        setScanError={setScanError}
        isProcessing={isProcessing}
      />

      {/* Visual Animation & Lift styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .hover-lift:hover {
          transform: translateY(-2px);
          border-color: rgba(6, 182, 212, 0.2);
          box-shadow: 0 12px 30px rgba(0,0,0,0.3);
        }
        .anim-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .custom-scroll::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.06);
          border-radius: 10px;
        }
        .custom-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.12);
        }
        .btn-cyan:hover {
          background: rgba(6,182,212,0.2) !important;
        }
        .btn-green:hover {
          background: rgba(16,185,129,0.2) !important;
        }
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
          .tumbling-card .card-code {
            font-size: 0.85rem !important;
          }
          .tumbling-card .card-stage {
            font-size: 0.8rem !important;
            padding: 4px 10px !important;
          }
          .tumbling-card .card-title {
            font-size: 1.15rem !important;
            font-weight: 900 !important;
            margin: 10px 0 !important;
            line-height: 1.4 !important;
          }
          .tumbling-card .card-details span {
            font-size: 0.9rem !important;
            font-weight: 800 !important;
          }
          .tumbling-card .card-details span strong {
            font-weight: 1000 !important;
          }
          .tumbling-card .card-timer {
            font-size: 0.95rem !important;
            font-weight: 1000 !important;
          }
          .tumbling-card .card-action-btn {
            font-size: 0.85rem !important;
            padding: 10px 18px !important;
            border-radius: 12px !important;
          }
          .tumbling-card .card-seq-badge {
            top: 14px !important;
            right: 14px !important;
            background: #ff9000 !important;
            color: #000 !important;
            border: none !important;
            padding: 6px 14px !important;
            border-radius: 10px !important;
            font-size: 1.15rem !important;
            box-shadow: 0 4px 12px rgba(255, 144, 0, 0.3) !important;
          }
          .tumbling-card .card-action-container {
            margin-top: 36px !important;
          }
        }
      ` }} />

      {/* Floating Controls (Search and Scan QR) */}
      <TumblingTerminalFloatingControls
        manualId={manualId}
        setManualId={setManualId}
        handleManualSubmit={handleManualSubmit}
        setIsScanning={setIsScanning}
        isProcessing={isProcessing}
      />

    </div>
  )
}
