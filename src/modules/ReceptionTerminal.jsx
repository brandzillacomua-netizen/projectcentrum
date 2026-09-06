import React from 'react'
import { useReceptionTerminalData, ACCENT_RGB } from './Reception/hooks/useReceptionTerminalData.js'

import ReceptionTerminalHeader from './Reception/components/ReceptionTerminalHeader.jsx'
import ReceptionTerminalScannerBar from './Reception/components/ReceptionTerminalScannerBar.jsx'
import ReceptionTerminalFilters from './Reception/components/ReceptionTerminalFilters.jsx'
import ReceptionTerminalCardList from './Reception/components/ReceptionTerminalCardList.jsx'
import ReceptionStartConfirmModal from './Reception/components/modals/ReceptionStartConfirmModal.jsx'
import ReceptionCompleteModal from './Reception/components/modals/ReceptionCompleteModal.jsx'
import ReceptionQRScannerModal from './Reception/components/modals/ReceptionQRScannerModal.jsx'

export default function ReceptionTerminal() {
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
    startReceptionCard,
    openCompleteModal,
    submitReceptionComplete,
    handleManualSubmit,
    formatDuration,
    waitingCards,
    inWorkCards,
    displayedCards
  } = useReceptionTerminalData()

  return (
    <div style={{ background: 'var(--bg, #070709)', minHeight: '100vh', color: 'var(--text, #fff)', fontFamily: "'Outfit', 'Inter', sans-serif", display: 'flex', flexDirection: 'column' }}>

      {/* HEADER */}
      <ReceptionTerminalHeader
        currentTime={currentTime}
        selectedShift={selectedShift}
        setSelectedShift={setSelectedShift}
      />

      {/* SCANNER BAR */}
      <ReceptionTerminalScannerBar
        setIsScanning={setIsScanning}
        manualId={manualId}
        setManualId={setManualId}
        handleManualSubmit={handleManualSubmit}
        scanError={scanError}
        setScanError={setScanError}
        isProcessing={isProcessing}
      />

      {/* MAIN */}
      <main style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <section style={{ flex: 1, background: 'var(--card-bg, #0c0c10)', borderRadius: '24px', border: '1px solid var(--glass-border, rgba(255,255,255,0.03))', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          {/* Filter tabs */}
          <ReceptionTerminalFilters
            filterMode={filterMode}
            setFilterMode={setFilterMode}
            waitingCards={waitingCards}
            inWorkCards={inWorkCards}
          />

          {/* Cards List */}
          <ReceptionTerminalCardList
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
      <ReceptionStartConfirmModal
        pendingStartCard={pendingStartCard}
        onClose={() => setPendingStartCard(null)}
        startReceptionCard={startReceptionCard}
        getNom={getNom}
        isProcessing={isProcessing}
      />

      {/* COMPLETE MODAL */}
      <ReceptionCompleteModal
        showCompleteModal={showCompleteModal}
        activeCompletingCard={activeCompletingCard}
        onClose={() => setShowCompleteModal(false)}
        finishedCount={finishedCount}
        setFinishedCount={setFinishedCount}
        scrapCount={scrapCount}
        setScrapCount={setScrapCount}
        submitReceptionComplete={submitReceptionComplete}
        getNom={getNom}
        isProcessing={isProcessing}
      />

      {/* QR Scanner Modal */}
      <ReceptionQRScannerModal
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

      <style dangerouslySetInnerHTML={{ __html: `
        .hover-lift:hover { transform: translateY(-2px); border-color: rgba(${ACCENT_RGB}, 0.2); box-shadow: 0 12px 30px rgba(0,0,0,0.3); }
        .anim-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .custom-scroll::-webkit-scrollbar { width: 5px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 10px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.12); }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      ` }} />
    </div>
  )
}
