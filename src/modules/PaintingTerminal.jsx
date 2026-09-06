import React from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { usePaintingTerminalData, ACCENT_RGB } from './Painting/hooks/usePaintingTerminalData.js'

import PaintingTerminalHeader from './Painting/components/PaintingTerminalHeader.jsx'
import PaintingTerminalScannerBar from './Painting/components/PaintingTerminalScannerBar.jsx'
import PaintingTerminalFilters from './Painting/components/PaintingTerminalFilters.jsx'
import PaintingTerminalCardList from './Painting/components/PaintingTerminalCardList.jsx'
import PaintingTerminalFloatingControls from './Painting/components/PaintingTerminalFloatingControls.jsx'
import PaintingStartConfirmModal from './Painting/components/modals/PaintingStartConfirmModal.jsx'
import PaintingCompleteModal from './Painting/components/modals/PaintingCompleteModal.jsx'
import PaintingQRScannerModal from './Painting/components/modals/PaintingQRScannerModal.jsx'

export default function PaintingTerminal() {
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
    getNom,
    startPaintingCard,
    openCompleteModal,
    submitPaintingComplete,
    handleManualSubmit,
    formatDuration,
    waitingCards,
    inWorkCards,
    displayedCards
  } = usePaintingTerminalData()

  return (
    <div style={{ background: 'var(--bg, #070709)', minHeight: '100vh', color: 'var(--text, #fff)', fontFamily: "'Outfit', 'Inter', sans-serif", display: 'flex', flexDirection: 'column' }}>

      {/* HEADER */}
      <PaintingTerminalHeader
        currentTime={currentTime}
        selectedShift={selectedShift}
        setSelectedShift={setSelectedShift}
      />

      {/* SCANNER BAR */}
      <PaintingTerminalScannerBar
        setIsScanning={setIsScanning}
        manualId={manualId}
        setManualId={setManualId}
        handleManualSubmit={handleManualSubmit}
        isProcessing={isProcessing}
      />

      {scanError && (
        <div style={{ padding: '0 20px' }}>
          <div style={{ maxWidth: '600px', margin: '12px auto 0', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '10px 16px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={14} />
            <span style={{ flex: 1 }}>{scanError}</span>
            <button onClick={() => setScanError(null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}><X size={16} /></button>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <section style={{ flex: 1, background: 'var(--card-bg, #0c0c10)', borderRadius: '24px', border: '1px solid var(--glass-border, rgba(255,255,255,0.03))', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          {/* Filter tabs */}
          <PaintingTerminalFilters
            filterMode={filterMode}
            setFilterMode={setFilterMode}
            waitingCards={waitingCards}
            inWorkCards={inWorkCards}
          />

          {/* Cards List */}
          <PaintingTerminalCardList
            displayedCards={displayedCards}
            getNom={getNom}
            formatDuration={formatDuration}
            setPendingStartCard={setPendingStartCard}
            openCompleteModal={openCompleteModal}
            isProcessing={isProcessing}
          />
        </section>
      </main>

      {/* CONFIRM START MODAL */}
      <PaintingStartConfirmModal
        pendingStartCard={pendingStartCard}
        onClose={() => setPendingStartCard(null)}
        startPaintingCard={startPaintingCard}
        getNom={getNom}
        isProcessing={isProcessing}
      />

      {/* COMPLETE MODAL */}
      <PaintingCompleteModal
        showCompleteModal={showCompleteModal}
        activeCompletingCard={activeCompletingCard}
        onClose={() => setShowCompleteModal(false)}
        finishedCount={finishedCount}
        setFinishedCount={setFinishedCount}
        scrapCount={scrapCount}
        setScrapCount={setScrapCount}
        submitPaintingComplete={submitPaintingComplete}
        getNom={getNom}
        isProcessing={isProcessing}
      />

      {/* QR-SCANNER MODAL */}
      <PaintingQRScannerModal
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

      {/* Floating Controls (Search and QR) */}
      <PaintingTerminalFloatingControls
        manualId={manualId}
        setManualId={setManualId}
        handleManualSubmit={handleManualSubmit}
        setIsScanning={setIsScanning}
        isProcessing={isProcessing}
      />

      {/* Custom Styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .hover-lift:hover {
          transform: translateY(-2px);
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

        /* Default heights and layout rules */
        .terminal-header {
          height: 80px;
        }

        .floating-controls-container {
          position: fixed;
          bottom: 30px;
          right: 30px;
          display: flex;
          align-items: center;
          gap: 12px;
          z-index: 1000;
        }

        /* MOBILE RESPONSIVE STYLES */
        @media (max-width: 600px) {
          .terminal-header {
            height: auto !important;
            padding: 10px 16px !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
          }
          .terminal-header > div {
            width: 100% !important;
            justify-content: space-between !important;
          }
          .back-text {
            display: none !important;
          }
          .header-divider {
            display: none !important;
          }
          .live-clock-container {
            text-align: right !important;
          }
          .scanner-section-desktop {
            display: none !important;
          }
          .stage-label-title {
            display: none !important;
          }
          .cards-container {
            padding: 10px !important;
          }

          /* Card optimizations */
          .painting-card {
            padding: 12px !important;
          }
          .painting-card .card-code {
            font-size: 0.78rem !important;
          }
          .painting-card .card-seq {
            font-size: 0.72rem !important;
          }
          .painting-card .card-title {
            font-size: 0.95rem !important;
            margin: 6px 0 !important;
            font-weight: 900 !important;
          }
          .painting-card .card-details span {
            font-size: 0.78rem !important;
          }
          .painting-card .card-details span strong {
            font-weight: 900 !important;
          }
          .painting-card .card-timer {
            font-size: 0.85rem !important;
            font-weight: 1000 !important;
          }
          .painting-card .action-btn {
            font-size: 0.8rem !important;
            padding: 8px 16px !important;
            border-radius: 10px !important;
          }

          .floating-controls-container {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            width: 100%;
            background: rgba(10, 10, 12, 0.96) !important;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            padding: 12px 16px;
            justify-content: space-between;
            border-radius: 0;
            box-shadow: 0 -10px 35px rgba(0,0,0,0.9);
            backdrop-filter: blur(15px);
            gap: 12px;
          }
          .floating-controls-container form {
            flex: 1;
            box-shadow: none !important;
            background: #000 !important;
            border: 1px solid #222 !important;
          }
          .floating-controls-container form input {
            width: 100% !important;
          }
        }
      ` }} />

    </div>
  )
}
