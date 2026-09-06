import React from 'react'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'

import { useOperatorTerminalData } from './Operator/hooks/useOperatorTerminalData'
import { OperatorHeader } from './Operator/components/OperatorHeader'
import { OperatorQueueDrawer } from './Operator/components/OperatorQueueDrawer'
import { OperatorCardDetailsView } from './Operator/components/OperatorCardDetailsView'
import { OperatorProductionOverview } from './Operator/components/OperatorProductionOverview'

import { OperatorQRScannerModal } from './Operator/components/modals/OperatorQRScannerModal'
import { OperatorPinModal } from './Operator/components/modals/OperatorPinModal'
import { OperatorScrapModal } from './Operator/components/modals/OperatorScrapModal'
import { OperatorDetailStageModal } from './Operator/components/modals/OperatorDetailStageModal'
import { OperatorMachineCallModal } from './Operator/components/modals/OperatorMachineCallModal'

const OperatorTerminal = () => {
  const mes = useMES()
  const {
    workCards,
    orders,
    nomenclatures,
    startWorkCard,
    completeWorkCard,
    confirmBuffer,
    fetchData,
    operators,
    productionStages,
    machines,
    workCardHistory,
    getFilteredOperators,
    getFilteredManagers,
    systemUsers,
    currentUser,
    machineOperations,
    tasks,
    inventory,
    requests,
    maintenanceCheckEnabled
  } = mes

  const data = useOperatorTerminalData({
    workCards,
    orders,
    nomenclatures,
    startWorkCard,
    completeWorkCard,
    confirmBuffer,
    fetchData,
    operators,
    productionStages,
    machines,
    workCardHistory,
    getFilteredOperators,
    getFilteredManagers,
    systemUsers,
    currentUser,
    machineOperations,
    tasks,
    inventory,
    requests
  })

  const {
    selectedCardId, setSelectedCardId,
    selectedStage, setSelectedStage,
    selectedOperator, setSelectedOperator,
    selectedMaster, setSelectedMaster,
    selectedShift, setSelectedShift,
    selectedMachine, setSelectedMachine,
    currentTime,
    isProcessing, setIsProcessing,
    isDrawerOpen, setIsDrawerOpen,
    isSyncing,
    scanError,
    scannedCardIds, setScannedCardIds,
    isScanning, setIsScanning,
    showScrapModal, setShowScrapModal,
    scrapCounts, setScrapCounts,
    cuttersUsed, setCuttersUsed,
    cuttersBreakdown, setCuttersBreakdown,
    showPinModal, setShowPinModal,
    pin, setPin,
    pinError, setPinError,
    detailStage, setDetailStage,
    detailTab, setDetailTab,
    filterStage, setFilterStage,
    machineCallModal, setMachineCallModal,
    machineCallSuccess, setMachineCallSuccess,
    selectedCallMasterId, setSelectedCallMasterId,
    selectedCallEngineerId, setSelectedCallEngineerId,
    selectedCallQCId, setSelectedCallQCId,
    callMasters, callEngineers, callQCs,
    currentCard,
    handleCreateCall,
    getCuttersForCard,
    getCardDept,
    getNomFromCard,
    getQtyFromCard,
    getSheetsFromCard,
    getOrderFromCard
  } = data

  const matchesStage = (cardOp, stageName) => {
    const op = (cardOp || '').toLowerCase()
    const sk = (stageName || '').toLowerCase()
    return op === sk || op.includes(sk) || sk.includes(op)
  }

  const queuedCards = workCards.filter(c =>
    (c.status === 'new' || scannedCardIds.includes(c.id)) &&
    c.status !== 'in-progress' && c.status !== 'waiting-buffer' && c.status !== 'completed' && c.status !== 'at-buffer'
  )

  const handleStartOperation = async () => {
    if (!currentCard || !selectedStage || !selectedOperator) return
    setIsProcessing(true)
    try {
      const selectedMachineObj = machines.find(m => m.id === selectedMachine || m.name === selectedMachine)
      await apiService.submitOperatorAction('start', currentCard.task_id, currentCard.id, selectedOperator, {
        stage_name: selectedStage || currentCard.operation,
        machine_name: selectedMachineObj?.name || selectedMachine,
        machine_id: selectedMachineObj?.id || null,
        manager_name: selectedMaster,
        shift_name: selectedShift
      }, startWorkCard)
      if (!scannedCardIds.includes(currentCard.id)) setScannedCardIds(prev => [...prev, currentCard.id])
    } catch (e) {
      alert('Помилка при старті: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const validatePin = async () => {
    if (pin === '555') {
      setIsProcessing(true)
      try {
        const selectedMachineObj = machines.find(m => m.id === selectedMachine || m.name === selectedMachine)
        await apiService.submitOperatorAction('start', currentCard.task_id, currentCard.id, 'Оператор Тест (555)', {
          machine_id: selectedMachineObj?.id || null,
          manager_name: selectedMaster,
          shift_name: selectedShift
        }, startWorkCard)
        setShowPinModal(false)
      } finally {
        setIsProcessing(false)
      }
    } else {
      setPinError(true)
      setPin('')
      setTimeout(() => setPinError(false), 1000)
    }
  }

  const submitCompletion = async () => {
    if (!currentCard) return
    const nom = getNomFromCard(currentCard)
    setScrapCounts({ [nom?.id]: 0 })
    setCuttersUsed(0)
    setCuttersBreakdown({})
    setShowScrapModal(true)
  }

  const handleFinalFinish = async () => {
    if (!currentCard) return
    setIsProcessing(true)
    try {
      const cuttersQty = matchesStage(currentCard.operation, 'Розкрій') ? Object.values(cuttersBreakdown).reduce((sum, v) => sum + (Number(v) || 0), 0) : 0
      await apiService.submitBufferConfirmation(currentCard.id, scrapCounts, confirmBuffer, cuttersQty, cuttersBreakdown)
      setSelectedCardId(null)
      setShowScrapModal(false)
      setScannedCardIds(prev => prev.filter(id => id !== currentCard.id))
    } catch (e) {
      alert('Помилка при оприбуткуванні: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="operator-terminal-v2" style={{ background: '#0a0a0a', height: '100vh', display: 'flex', flexDirection: 'column', color: '#fff', overflow: 'hidden' }}>
      <OperatorHeader currentTime={currentTime} setIsDrawerOpen={setIsDrawerOpen} />

      <div className="main-layout-responsive" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <OperatorQueueDrawer
          queuedCards={queuedCards}
          selectedCardId={selectedCardId}
          setSelectedCardId={setSelectedCardId}
          isDrawerOpen={isDrawerOpen}
          setIsDrawerOpen={setIsDrawerOpen}
          getNomFromCard={getNomFromCard}
          getQtyFromCard={getQtyFromCard}
          getSheetsFromCard={getSheetsFromCard}
          orders={orders}
        />

        <div className="content-panel" style={{ flex: 1, padding: '20px 15px', background: '#0a0a0a', overflowY: 'auto', position: 'relative' }}>
          {scanError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '12px 18px', borderRadius: '12px', marginBottom: '20px', fontSize: '0.85rem', fontWeight: 800 }}>
              ⚠️ {scanError}
            </div>
          )}

          {currentCard ? (
            <OperatorCardDetailsView
              currentCard={currentCard}
              setSelectedCardId={setSelectedCardId}
              orders={orders}
              getNomFromCard={getNomFromCard}
              getQtyFromCard={getQtyFromCard}
              selectedMachine={selectedMachine}
              setSelectedMachine={setSelectedMachine}
              selectedMaster={selectedMaster}
              setSelectedMaster={setSelectedMaster}
              selectedShift={selectedShift}
              setSelectedShift={setSelectedShift}
              selectedOperator={selectedOperator}
              setSelectedOperator={setSelectedOperator}
              selectedStage={selectedStage}
              machines={machines}
              getFilteredManagers={getFilteredManagers}
              getFilteredOperators={getFilteredOperators}
              getCardDept={getCardDept}
              maintenanceCheckEnabled={maintenanceCheckEnabled}
              isProcessing={isProcessing}
              handleStartOperation={handleStartOperation}
              setShowPinModal={setShowPinModal}
              submitCompletion={submitCompletion}
              currentTime={currentTime}
            />
          ) : (
            <OperatorProductionOverview
              setIsScanning={setIsScanning}
              productionStages={productionStages}
              workCards={workCards}
              workCardHistory={workCardHistory}
              setDetailStage={setDetailStage}
              isSyncing={isSyncing}
              setSelectedCardId={setSelectedCardId}
              getNomFromCard={getNomFromCard}
              machines={machines}
              currentTime={currentTime}
            />
          )}
        </div>
      </div>

      <OperatorQRScannerModal isScanning={isScanning} setIsScanning={setIsScanning} />

      <OperatorPinModal
        showPinModal={showPinModal}
        setShowPinModal={setShowPinModal}
        pin={pin}
        setPin={setPin}
        pinError={pinError}
        validatePin={validatePin}
      />

      <OperatorScrapModal
        showScrapModal={showScrapModal}
        setShowScrapModal={setShowScrapModal}
        currentCard={currentCard}
        getNomFromCard={getNomFromCard}
        scrapCounts={scrapCounts}
        setScrapCounts={setScrapCounts}
        matchesStage={matchesStage}
        getCuttersForCard={getCuttersForCard}
        cuttersBreakdown={cuttersBreakdown}
        setCuttersBreakdown={setCuttersBreakdown}
        handleFinalFinish={handleFinalFinish}
      />

      <OperatorDetailStageModal
        detailStage={detailStage}
        setDetailStage={setDetailStage}
        detailTab={detailTab}
        setDetailTab={setDetailTab}
        workCardHistory={workCardHistory}
        matchesStage={matchesStage}
        nomenclatures={nomenclatures}
        workCards={workCards}
        getNomFromCard={getNomFromCard}
      />

      <OperatorMachineCallModal
        machineCallModal={machineCallModal}
        setMachineCallModal={setMachineCallModal}
        machineCallSuccess={machineCallSuccess}
        handleCreateCall={handleCreateCall}
        selectedCallMasterId={selectedCallMasterId}
        setSelectedCallMasterId={setSelectedCallMasterId}
        selectedCallEngineerId={selectedCallEngineerId}
        setSelectedCallEngineerId={setSelectedCallEngineerId}
        selectedCallQCId={selectedCallQCId}
        setSelectedCallQCId={setSelectedCallQCId}
        callMasters={callMasters}
        callEngineers={callEngineers}
        callQCs={callQCs}
      />

      <style dangerouslySetInnerHTML={{
        __html: `
        .stage-card-hover:hover { background: #181818 !important; transform: translateY(-5px); }
        .stage-card-hover { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </div>
  )
}

export default OperatorTerminal
