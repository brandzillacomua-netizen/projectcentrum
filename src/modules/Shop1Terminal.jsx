import React from 'react'
import { ScannerPanel } from './Warehouse/components/ScannerPanel'
import { AlertTriangle, X } from 'lucide-react'

import { Shop1PauseModal } from './Shop1/components/modals/Shop1PauseModal'
import { Shop1ShiftChangeModal } from './Shop1/components/modals/Shop1ShiftChangeModal'
import { Shop1MachineCallModal } from './Shop1/components/modals/Shop1MachineCallModal'
import { Shop1QCModal } from './Shop1/components/modals/Shop1QCModal'
import { Shop1StorageExplorerModal } from './Shop1/components/modals/Shop1StorageExplorerModal'
import { Shop1CompleteModal } from './Shop1/components/modals/Shop1CompleteModal'
import { Shop1DetailStageModal } from './Shop1/components/modals/Shop1DetailStageModal'
import { Shop1Header } from './Shop1/components/Shop1Header'
import { Shop1QueueList } from './Shop1/components/Shop1QueueList'
import { Shop1CardDetails } from './Shop1/components/Shop1CardDetails'
import { Shop1Dashboard } from './Shop1/components/Shop1Dashboard'
import { useShop1TerminalState } from './Shop1/hooks/useShop1TerminalState'
import { supabase } from '../supabase'

// Стилі-константи
const labelStyle = { display: 'block', fontSize: '0.65rem', color: '#444', fontWeight: 900, textTransform: 'uppercase', marginBottom: '7px' }
const selectStyle = { width: '100%', background: '#0d0d0d', border: '1px solid #222', color: '#fff', padding: '13px', borderRadius: '12px', fontSize: '0.95rem', fontWeight: 700, boxSizing: 'border-box' }
const btnPrimary = { background: '#3b82f6', color: '#fff', border: 'none', padding: '18px', borderRadius: '14px', fontSize: '1.1rem', fontWeight: 900, cursor: 'pointer', width: '100%', transition: 'opacity 0.2s' }
const btnGreen = { background: '#10b981', color: '#fff', border: 'none', padding: '18px', borderRadius: '14px', fontSize: '1.1rem', fontWeight: 900, cursor: 'pointer', width: '100%', transition: 'opacity 0.2s' }

export default function Shop1Terminal() {
  const s = useShop1TerminalState()

  const {
    scrapReasons, workCards, setWorkCards, nomenclatures, operators, getFilteredOperators,
    getFilteredManagers, managers, workCardHistory, inventory, fetchData, orders, tasks,
    currentUser, machines, systemUsers, currentTime, selectedCardId, setSelectedCardId,
    selectedCardHistory, isScanning, setIsScanning, manualId, setManualId, scanError, setScanError,
    isSyncing, isProcessing, setIsProcessing, movingScrapIds, setMovingScrapIds, isBulkMoving,
    setIsBulkMoving, isDrawerOpen, setIsDrawerOpen, selectedOperator, setSelectedOperator,
    selectedManager, setSelectedManager, selectedShift, setSelectedShift, selectedMachine,
    setSelectedMachine, machineNumber, setMachineNumber, showCompleteModal, setShowCompleteModal,
    showSortingModal, setShowSortingModal, queueSectionFilter, setQueueSectionFilter, finalOperator,
    setFinalOperator, scrapCount, setScrapCount, reworkCount, setReworkCount, cuttersUsed,
    setCuttersUsed, cuttersBreakdown, setCuttersBreakdown, cuttersTouched, setCuttersTouched,
    showShiftChangeModal, setShowShiftChangeModal, shiftChangeOperator, setShiftChangeOperator,
    shiftChangeShift, setShiftChangeShift, scrapOperator, setScrapOperator, showPauseModal,
    setShowPauseModal, pauseReason, setPauseReason, customPauseReason, setCustomPauseReason,
    activeTableFilter, setActiveTableFilter, queueFilter, setQueueFilter, selectedTaskFilter,
    setSelectedTaskFilter, selectedNomFilter, setSelectedNomFilter, machineCallModal,
    setMachineCallModal, machineCallSuccess, selectedCallMasterId, setSelectedCallMasterId,
    selectedCallEngineerId, setSelectedCallEngineerId, selectedCallQCId, setSelectedCallQCId,
    callMasters, callEngineers, callQCs, handleCreateCall, showQCModal, setShowQCModal,
    qcScrapCount, setQcScrapCount, qcInspector, setQcInspector, qcReason, setQcReason,
    qcCustomReason, setQcCustomReason, customAlert, setCustomAlert, detailStage, setDetailStage,
    detailTab, setDetailTab, showStorageExplorer, setShowStorageExplorer, activeExplorerTab,
    setActiveExplorerTab, collapsedGroups, setCollapsedGroups, currentCard, qcScrapEntries,
    qcScrapTotal, cardOperators, getNom, getCardTimeMetrics, getCardStartDate, getCuttersForCard,
    formatSec, formatTime, nextStageFor, queueTasksOptions, queueNomOptions, queueCards,
    handleStart, handleShiftChange, handlePauseCard, handleResumeCard, handleCompleteToBuffer,
    handleStartNext, handleRequestRework, handleFinishSortingActive, handleSortToShop2,
    handleAcceptToStock, handleQCScrapOverride, stageStats, handleArchiveStageScrap,
    processCardScan, handleManualEntry, CHAIN
  } = s

  const completeModalCutters = showCompleteModal && currentCard?.operation === 'Розкрій'
    ? getCuttersForCard(currentCard)
    : []
  const requiresCuttersFact = showCompleteModal && currentCard?.operation === 'Розкрій' && completeModalCutters.length > 0
  const hasCuttersFact = !requiresCuttersFact || completeModalCutters.some(name => Number(cuttersBreakdown[name]) > 0) || completeModalCutters.every(name => cuttersTouched[name])
  const completeToBufferDisabled = isProcessing || !hasCuttersFact

  return (
    <div style={{ background: '#0a0a0a', height: '100vh', display: 'flex', flexDirection: 'column', color: '#fff', overflow: 'hidden' }}>

      {/* Хедер */}
      <Shop1Header
        currentTime={currentTime}
        queueCardsCount={queueCards.length}
        onOpenDrawer={() => setIsDrawerOpen(true)}
      />

      {/* Layout */}
      <div className="main-layout-responsive" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Ліва панель черги (Десктоп) */}
        <div className="side-panel hide-mobile" style={{ width: '280px', background: '#111', borderRight: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <Shop1QueueList
            queueCards={queueCards}
            queueFilter={queueFilter}
            setQueueFilter={setQueueFilter}
            queueSectionFilter={queueSectionFilter}
            setQueueSectionFilter={setQueueSectionFilter}
            selectedTaskFilter={selectedTaskFilter}
            setSelectedTaskFilter={setSelectedTaskFilter}
            selectedNomFilter={selectedNomFilter}
            setSelectedNomFilter={setSelectedNomFilter}
            queueTasksOptions={queueTasksOptions}
            queueNomOptions={queueNomOptions}
            selectedCardId={selectedCardId}
            setSelectedCardId={setSelectedCardId}
            setSelectedOperator={setSelectedOperator}
            setIsDrawerOpen={setIsDrawerOpen}
            setManualId={setManualId}
            setIsScanning={setIsScanning}
            getNom={getNom}
            orders={orders}
            CHAIN={CHAIN}
            isMobile={false}
          />
        </div>

        {/* Мобільний дравер */}
        {isDrawerOpen && <div className="drawer-backdrop" onClick={() => setIsDrawerOpen(false)} />}
        <div className={`side-drawer ${isDrawerOpen ? 'open' : ''}`}>
          <Shop1QueueList
            queueCards={queueCards}
            queueFilter={queueFilter}
            setQueueFilter={setQueueFilter}
            queueSectionFilter={queueSectionFilter}
            setQueueSectionFilter={setQueueSectionFilter}
            selectedTaskFilter={selectedTaskFilter}
            setSelectedTaskFilter={setSelectedTaskFilter}
            selectedNomFilter={selectedNomFilter}
            setSelectedNomFilter={setSelectedNomFilter}
            queueTasksOptions={queueTasksOptions}
            queueNomOptions={queueNomOptions}
            selectedCardId={selectedCardId}
            setSelectedCardId={setSelectedCardId}
            setSelectedOperator={setSelectedOperator}
            setIsDrawerOpen={setIsDrawerOpen}
            setManualId={setManualId}
            setIsScanning={setIsScanning}
            getNom={getNom}
            orders={orders}
            CHAIN={CHAIN}
            isMobile={true}
          />
        </div>

        {/* Основний контент */}
        <div className="content-panel" style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '20px 24px 100px', background: '#0a0a0a' }}>
          {scanError && (
            <div style={{ background: '#ef444420', border: '1px solid #ef444440', borderRadius: '10px', padding: '12px 16px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444', maxWidth: '680px' }}>
              <AlertTriangle size={16} /> {scanError}
              <button onClick={() => setScanError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={14} /></button>
            </div>
          )}
          {currentCard ? (
            <Shop1CardDetails
              currentCard={currentCard}
              setSelectedCardId={setSelectedCardId}
              orders={orders}
              getNom={getNom}
              CHAIN={CHAIN}
              nextStageFor={nextStageFor}
              qcScrapTotal={qcScrapTotal}
              qcScrapEntries={qcScrapEntries}
              selectedManager={selectedManager}
              setSelectedManager={setSelectedManager}
              selectedShift={selectedShift}
              setSelectedShift={setSelectedShift}
              selectedOperator={selectedOperator}
              setSelectedOperator={setSelectedOperator}
              selectedMachine={selectedMachine}
              setSelectedMachine={setSelectedMachine}
              machineNumber={machineNumber}
              setMachineNumber={setMachineNumber}
              getFilteredManagers={getFilteredManagers}
              getFilteredOperators={getFilteredOperators}
              handleStart={handleStart}
              handleResumeCard={handleResumeCard}
              handleStartNext={handleStartNext}
              handleAcceptToStock={handleAcceptToStock}
              setShowQCModal={setShowQCModal}
              setShowPauseModal={setShowPauseModal}
              setShowShiftChangeModal={setShowShiftChangeModal}
              setShowCompleteModal={setShowCompleteModal}
              setShowSortingModal={setShowSortingModal}
              setScrapCount={setScrapCount}
              setReworkCount={setReworkCount}
              setFinalOperator={setFinalOperator}
              setCuttersUsed={setCuttersUsed}
              setPauseReason={setPauseReason}
              setCustomPauseReason={setCustomPauseReason}
              getCardTimeMetrics={getCardTimeMetrics}
              formatSec={formatSec}
              formatTime={formatTime}
              selectedCardHistory={selectedCardHistory}
              workCardHistory={workCardHistory}
              isProcessing={isProcessing}
              reworkCount={reworkCount}
              scrapCount={scrapCount}
              requests={s.requests || []}
              tasks={tasks || []}
              nomenclatures={nomenclatures || []}
            />
          ) : (
            <Shop1Dashboard
              manualId={manualId}
              setManualId={setManualId}
              isProcessing={isProcessing}
              setIsScanning={setIsScanning}
              handleManualEntry={handleManualEntry}
              setDetailStage={setDetailStage}
              setDetailTab={setDetailTab}
              stageStats={stageStats}
              workCards={workCards}
              getNom={getNom}
              setShowStorageExplorer={setShowStorageExplorer}
              tasks={tasks}
              orders={orders}
              nomenclatures={nomenclatures}
              activeTableFilter={activeTableFilter}
              setActiveTableFilter={setActiveTableFilter}
              isSyncing={isSyncing}
              setSelectedCardId={setSelectedCardId}
              setSelectedOperator={setSelectedOperator}
              collapsedGroups={collapsedGroups}
              setCollapsedGroups={setCollapsedGroups}
              getCardStartDate={getCardStartDate}
              getCardTimeMetrics={getCardTimeMetrics}
            />
          )}
        </div>
      </div>

      {/* QR-сканер */}
      <ScannerPanel
        isScanning={isScanning}
        setIsScanning={setIsScanning}
        manualCardInput={manualId}
        setManualCardInput={setManualId}
        handleCardScan={async (scannedId) => {
          const success = await processCardScan(scannedId)
          if (!success) {
            throw new Error(scanError || 'Картку не знайдено в базі даних')
          }
        }}
        color="#eab308"
      />

      {/* Модалки завершення етапу та сортування */}
      <Shop1CompleteModal
        showCompleteModal={showCompleteModal}
        showSortingModal={showSortingModal}
        onCloseComplete={() => setShowCompleteModal(false)}
        onCloseSorting={() => setShowSortingModal(false)}
        currentCard={currentCard}
        nomenclatureName={getNom(currentCard)?.name}
        qcScrapTotal={qcScrapTotal}
        selectedShift={selectedShift}
        setSelectedShift={setSelectedShift}
        selectedOperator={selectedOperator}
        setSelectedOperator={setSelectedOperator}
        finalOperator={finalOperator}
        setFinalOperator={setFinalOperator}
        getFilteredOperators={getFilteredOperators}
        completeModalCutters={completeModalCutters}
        cuttersBreakdown={cuttersBreakdown}
        setCuttersBreakdown={setCuttersBreakdown}
        setCuttersTouched={setCuttersTouched}
        hasCuttersFact={hasCuttersFact}
        scrapCount={scrapCount}
        setScrapCount={setScrapCount}
        reworkCount={reworkCount}
        setReworkCount={setReworkCount}
        cardOperators={cardOperators}
        scrapOperator={scrapOperator}
        setScrapOperator={setScrapOperator}
        handleRequestRework={handleRequestRework}
        handleCompleteToBuffer={handleCompleteToBuffer}
        handleSortToShop2={handleSortToShop2}
        completeToBufferDisabled={completeToBufferDisabled}
        isProcessing={isProcessing}
        setIsProcessing={setIsProcessing}
        CHAIN={CHAIN}
        supabase={supabase}
        fetchData={fetchData}
        btnPrimary={btnPrimary}
        btnGreen={btnGreen}
        selectStyle={selectStyle}
        labelStyle={labelStyle}
      />

      {/* Модалка ПЕРЕЗМІНКА */}
      <Shop1ShiftChangeModal
        showShiftChangeModal={showShiftChangeModal}
        onClose={() => setShowShiftChangeModal(false)}
        currentCard={currentCard}
        shiftChangeShift={shiftChangeShift}
        setShiftChangeShift={setShiftChangeShift}
        shiftChangeOperator={shiftChangeOperator}
        setShiftChangeOperator={setShiftChangeOperator}
        getFilteredOperators={getFilteredOperators}
        handleShiftChange={handleShiftChange}
        isProcessing={isProcessing}
        selectStyle={selectStyle}
        labelStyle={labelStyle}
      />

      {/* Модалка ПАУЗА / ЗУПИНИТИ ВЕРСТАТ */}
      <Shop1PauseModal
        showPauseModal={showPauseModal}
        onClose={() => setShowPauseModal(false)}
        currentCard={currentCard}
        nomenclatureName={getNom(currentCard)?.name}
        pauseReason={pauseReason}
        setPauseReason={setPauseReason}
        customPauseReason={customPauseReason}
        setCustomPauseReason={setCustomPauseReason}
        handlePauseCard={handlePauseCard}
        isProcessing={isProcessing}
        selectStyle={selectStyle}
        labelStyle={labelStyle}
      />

      {/* Модалка корекції браку від ВКЯ */}
      <Shop1QCModal
        showQCModal={showQCModal}
        onClose={() => setShowQCModal(false)}
        currentCard={currentCard}
        nomenclatureName={getNom(currentCard)?.name}
        qcInspector={qcInspector}
        setQcInspector={setQcInspector}
        qcReason={qcReason}
        setQcReason={setQcReason}
        qcCustomReason={qcCustomReason}
        setQcCustomReason={setQcCustomReason}
        scrapReasons={scrapReasons}
        qcScrapCount={qcScrapCount}
        setQcScrapCount={setQcScrapCount}
        handleQCScrapOverride={handleQCScrapOverride}
        isProcessing={isProcessing}
        selectStyle={selectStyle}
        labelStyle={labelStyle}
      />

      {/* Модалка деталей етапу */}
      <Shop1DetailStageModal
        detailStage={detailStage}
        onClose={() => setDetailStage(null)}
        detailTab={detailTab}
        setDetailTab={setDetailTab}
        workCardHistory={workCardHistory}
        workCards={workCards}
        nomenclatures={nomenclatures}
        getNom={getNom}
        isProcessing={isProcessing}
        handleArchiveStageScrap={handleArchiveStageScrap}
      />

      {/* ХАБ-СКЛАД ЦЕХУ 1 Модалка */}
      <Shop1StorageExplorerModal
        showStorageExplorer={showStorageExplorer}
        onClose={() => setShowStorageExplorer(false)}
        activeExplorerTab={activeExplorerTab}
        setActiveExplorerTab={setActiveExplorerTab}
        workCards={workCards}
        inventory={inventory}
        nomenclatures={nomenclatures}
        getNom={getNom}
        isBulkMoving={isBulkMoving}
        setIsBulkMoving={setIsBulkMoving}
        movingScrapIds={movingScrapIds}
        setMovingScrapIds={setMovingScrapIds}
        fetchData={fetchData}
        supabase={supabase}
      />

      {/* Виклик майстра/інженера/ВКЯ */}
      <Shop1MachineCallModal
        machineCallModal={machineCallModal}
        onClose={() => setMachineCallModal(null)}
        machineCallSuccess={machineCallSuccess}
        handleCreateCall={handleCreateCall}
        selectedCallMasterId={selectedCallMasterId}
        setSelectedCallMasterId={setSelectedCallMasterId}
        callMasters={callMasters}
        selectedCallEngineerId={selectedCallEngineerId}
        setSelectedCallEngineerId={setSelectedCallEngineerId}
        callEngineers={callEngineers}
        selectedCallQCId={selectedCallQCId}
        setSelectedCallQCId={setSelectedCallQCId}
        callQCs={callQCs}
      />

      {/* Alert modal */}
      {customAlert && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99999, padding: '20px', animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: '#18181b', border: '1px solid #27272a',
            borderRadius: '24px', padding: '30px 24px', width: '100%', maxWidth: '440px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)', textAlign: 'center'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>
              {customAlert.title.includes('Помилка') || customAlert.title.includes('❌') || customAlert.title.includes('⚠️') ? '⚠️' : 'ℹ️'}
            </div>
            <h3 style={{ margin: '0 0 14px', fontSize: '1.2rem', fontWeight: 900, color: '#fff' }}>
              {customAlert.title}
            </h3>
            <p style={{
              margin: '0 0 24px', fontSize: '0.9rem', color: '#a1a1aa',
              lineHeight: 1.5, whiteSpace: 'pre-line', textAlign: 'left'
            }}>
              {customAlert.message}
            </p>
            <button
              onClick={() => setCustomAlert(null)}
              style={{
                width: '100%', background: '#eab308', color: '#000',
                border: 'none', padding: '14px', borderRadius: '14px',
                fontSize: '1rem', fontWeight: 1000, cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(234,179,8,0.2)'
              }}
            >
              ЗРОЗУМІЛО
            </button>
          </div>
        </div>
      )}

      <style>{`
        .s1-stage-hover { transition: all 0.2s cubic-bezier(0.4,0,0.2,1); }
        .s1-stage-hover:hover { transform: translateY(-3px); }
        .spin-s1 { animation: spinS1 1s linear infinite; }
        @keyframes spinS1 { 100% { transform: rotate(360deg); } }
        .s1-burger-btn { display: none; }
        @media (max-width: 768px) { .s1-burger-btn { display: flex!important; } }

        .stages-grid-responsive {
          grid-template-columns: 1fr auto 1fr auto 1.5fr;
          grid-template-areas: "stage1 arrow1 stage2 arrow2 storage";
        }

        @media (max-width: 768px) {
          .stages-grid-responsive {
            grid-template-columns: 1fr 1fr;
            grid-template-areas: 
              "stage1 stage2"
              "storage storage";
          }
          .content-panel {
            padding-bottom: 120px !important;
          }
        }
      `}</style>
    </div>
  )
}
