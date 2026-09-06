import React from 'react'
import { useSortingTerminalData } from './Sorting/hooks/useSortingTerminalData'
import SortingTerminalHeader from './Sorting/components/SortingTerminalHeader'
import SortingTerminalScannerBar from './Sorting/components/SortingTerminalScannerBar'
import SortingTerminalFilters from './Sorting/components/SortingTerminalFilters'
import SortingTerminalCardList from './Sorting/components/SortingTerminalCardList'
import SortingStartConfirmModal from './Sorting/components/modals/SortingStartConfirmModal'
import SortingCompleteModal from './Sorting/components/modals/SortingCompleteModal'
import SortingQRScannerModal from './Sorting/components/modals/SortingQRScannerModal'

const ACCENT_RGB = '52,211,153'

export default function SortingTerminal() {
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
    reworkCount,
    setReworkCount,
    finishedCount,
    setFinishedCount,
    pendingStartCard,
    setPendingStartCard,
    filterMode,
    setFilterMode,
    getNom,
    startSortingCard,
    openCompleteModal,
    submitSortingComplete,
    handleManualSubmit,
    formatDuration,
    waitingCards,
    inWorkCards,
    displayedCards
  } = useSortingTerminalData()

  return (
    <div className="sorting-terminal terminal-module-root" style={{ background: '#070709', minHeight: '100vh', color: '#fff', fontFamily: "'Outfit', 'Inter', sans-serif", display: 'flex', flexDirection: 'column' }}>

      {/* HEADER */}
      <SortingTerminalHeader
        selectedShift={selectedShift}
        setSelectedShift={setSelectedShift}
        currentTime={currentTime}
      />

      {/* SCANNER BAR */}
      <SortingTerminalScannerBar
        manualId={manualId}
        setManualId={setManualId}
        isProcessing={isProcessing}
        scanError={scanError}
        setScanError={setScanError}
        setIsScanning={setIsScanning}
        handleManualSubmit={handleManualSubmit}
      />

      {/* MAIN */}
      <main style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <section style={{ flex: 1, background: '#0c0c10', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Filter tabs */}
          <SortingTerminalFilters
            filterMode={filterMode}
            setFilterMode={setFilterMode}
            waitingCount={waitingCards.length}
            inWorkCount={inWorkCards.length}
          />

          {/* Cards List */}
          <SortingTerminalCardList
            displayedCards={displayedCards}
            getNom={getNom}
            formatDuration={formatDuration}
            isProcessing={isProcessing}
            setPendingStartCard={setPendingStartCard}
            openCompleteModal={openCompleteModal}
          />
        </section>
      </main>

      {/* CONFIRM START MODAL */}
      <SortingStartConfirmModal
        pendingStartCard={pendingStartCard}
        setPendingStartCard={setPendingStartCard}
        isProcessing={isProcessing}
        startSortingCard={startSortingCard}
        getNom={getNom}
      />

      {/* COMPLETE MODAL */}
      <SortingCompleteModal
        showCompleteModal={showCompleteModal}
        setShowCompleteModal={setShowCompleteModal}
        activeCompletingCard={activeCompletingCard}
        isProcessing={isProcessing}
        getNom={getNom}
        finishedCount={finishedCount}
        setFinishedCount={setFinishedCount}
        scrapCount={scrapCount}
        setScrapCount={setScrapCount}
        reworkCount={reworkCount}
        setReworkCount={setReworkCount}
        submitSortingComplete={submitSortingComplete}
      />

      {/* QR Scanner Modal */}
      <SortingQRScannerModal
        isScanning={isScanning}
        setIsScanning={setIsScanning}
        showManualInput={showManualInput}
        setShowManualInput={setShowManualInput}
        manualId={manualId}
        setManualId={setManualId}
        isProcessing={isProcessing}
        handleManualSubmit={handleManualSubmit}
        setScanError={setScanError}
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
