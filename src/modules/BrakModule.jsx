import ReturnToRouteModal from './VKYA/quality-hold/ReturnToRouteModal.jsx'
import { BrakHeader } from './Brak/components/BrakHeader.jsx'
import { BrakMachineCallsWidget } from './Brak/components/BrakMachineCallsWidget.jsx'
import { BrakActionBar } from './Brak/components/BrakActionBar.jsx'
import { BrakStatsDashboard } from './Brak/components/BrakStatsDashboard.jsx'
import { BrakClassificationQueue } from './Brak/components/BrakClassificationQueue.jsx'
import { BrakReportPage } from './Brak/components/BrakReportPage.jsx'
import { BrakScanModal } from './Brak/components/modals/BrakScanModal.jsx'
import { BrakCardScrapModal } from './Brak/components/modals/BrakCardScrapModal.jsx'
import { BrakRestorationModal } from './Brak/components/modals/BrakRestorationModal.jsx'
import { BrakReworkModal } from './Brak/components/modals/BrakReworkModal.jsx'
import { useBrakData } from './Brak/hooks/useBrakData.js'

export default function BrakModule() {
  const {
    navigate,
    currentUser,
    machines,
    orders,
    nomenclatures,
    isProcessing,
    selectedItem,
    setSelectedItem,
    distribution,
    reasonAllocations,
    setReasonAllocations,
    viewingCategory,
    setViewingCategory,
    restorationDraft,
    setRestorationDraft,
    restorationQuantity,
    setRestorationQuantity,
    restorationStageId,
    setRestorationStageId,
    restorationStages,
    routeReturnDraft,
    setRouteReturnDraft,
    reworkDraft,
    setReworkDraft,
    reworkQuantity,
    setReworkQuantity,
    isScanning,
    setIsScanning,
    scanError,
    setScanError,
    manualCardNumber,
    setManualCardNumber,
    scannedCard,
    setScannedCard,
    qcInspector,
    setQcInspector,
    qcScrapCount,
    setQcScrapCount,
    qcReason,
    setQcReason,
    scrapReasons,
    scrapReasonRows,
    qcCustomReason,
    setQcCustomReason,
    qcCardOperators,
    qcResponsibleOperator,
    setQcResponsibleOperator,
    showReportPage,
    setShowReportPage,
    scrapReportSubTab,
    setScrapReportSubTab,
    reportStartDate,
    setReportStartDate,
    reportEndDate,
    setReportEndDate,
    reportIsSyncing,
    reportLoadError,
    reportSelectedShiftFilter,
    setReportSelectedShiftFilter,
    reportSelectedEmployeeFilter,
    setReportSelectedEmployeeFilter,
    reportSearchQuery,
    setReportSearchQuery,
    reportQuickPeriod,
    handleReportQuickDateSelect,
    reportUniqueOperators,
    reportScrapStats,
    reportScrapReasonsStats,
    activeCalls,
    handleResolveCall,
    openQcCardByNumber,
    handleQCScrapOverride,
    updateCategoryQty,
    updateReasonQty,
    totalDistributed,
    totalReasonAllocated,
    isReasonDistributionValid,
    remainingInBatch,
    activeScrapReasons,
    readyItems,
    filteredReadyItems,
    paginatedReadyItems,
    queuePage,
    setQueuePage,
    totalPages,
    categoryPage,
    setCategoryPage,
    categoryTotalPages,
    qualityStatusTotals,
    itemsInCat,
    paginatedCategoryItems,
    categoryTotalQuantity,
    viewingCategoryLabel,
    handleBulkClassify,
    handleDispose,
    handleRework,
    openRestorationModal,
    handleSendToRestoration,
    openReworkModal,
    handleSendToRework,
    handleReturnToRoute
  } = useBrakData()

  if (showReportPage) {
    return (
      <BrakReportPage
        setShowReportPage={setShowReportPage}
        currentUser={currentUser}
        reportSearchQuery={reportSearchQuery}
        setReportSearchQuery={setReportSearchQuery}
        reportSelectedShiftFilter={reportSelectedShiftFilter}
        setReportSelectedShiftFilter={setReportSelectedShiftFilter}
        reportSelectedEmployeeFilter={reportSelectedEmployeeFilter}
        setReportSelectedEmployeeFilter={setReportSelectedEmployeeFilter}
        reportUniqueOperators={reportUniqueOperators}
        reportStartDate={reportStartDate}
        setReportStartDate={setReportStartDate}
        reportEndDate={reportEndDate}
        setReportEndDate={setReportEndDate}
        reportQuickPeriod={reportQuickPeriod}
        handleReportQuickDateSelect={handleReportQuickDateSelect}
        reportIsSyncing={reportIsSyncing}
        reportLoadError={reportLoadError}
        reportScrapStats={reportScrapStats}
        scrapReportSubTab={scrapReportSubTab}
        setScrapReportSubTab={setScrapReportSubTab}
        reportScrapReasonsStats={reportScrapReasonsStats}
      />
    )
  }

  return (
    <div className="brak-module-v2" style={{ background: 'var(--bg, #050505)', minHeight: '100vh', color: 'var(--text-color, #fff)', display: 'flex', flexDirection: 'column' }}>
      <BrakHeader
        showReportPage={showReportPage}
        setShowReportPage={setShowReportPage}
        currentUser={currentUser}
      />

      <div style={{ flex: 1, padding: '30px', maxWidth: '1400px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <BrakMachineCallsWidget
          activeCalls={activeCalls}
          machines={machines}
          currentUser={currentUser}
          handleResolveCall={handleResolveCall}
        />

        <BrakActionBar
          setIsScanning={setIsScanning}
          manualCardNumber={manualCardNumber}
          setManualCardNumber={setManualCardNumber}
          scanError={scanError}
          setScanError={setScanError}
          openQcCardByNumber={openQcCardByNumber}
          setShowReportPage={setShowReportPage}
        />

        <BrakStatsDashboard
          qualityStatusTotals={qualityStatusTotals}
          viewingCategory={viewingCategory}
          setViewingCategory={setViewingCategory}
          setSelectedItem={setSelectedItem}
          navigate={navigate}
        />

        <BrakClassificationQueue
          viewingCategory={viewingCategory}
          viewingCategoryLabel={viewingCategoryLabel}
          readyItems={readyItems}
          filteredReadyItems={filteredReadyItems}
          paginatedReadyItems={paginatedReadyItems}
          itemsInCat={itemsInCat}
          paginatedCategoryItems={paginatedCategoryItems}
          categoryTotalQuantity={categoryTotalQuantity}
          manualCardNumber={manualCardNumber}
          queuePage={queuePage}
          setQueuePage={setQueuePage}
          totalPages={totalPages}
          categoryPage={categoryPage}
          setCategoryPage={setCategoryPage}
          categoryTotalPages={categoryTotalPages}
          selectedItem={selectedItem}
          setSelectedItem={setSelectedItem}
          nomenclatures={nomenclatures}
          distribution={distribution}
          updateCategoryQty={updateCategoryQty}
          reasonAllocations={reasonAllocations}
          setReasonAllocations={setReasonAllocations}
          updateReasonQty={updateReasonQty}
          activeScrapReasons={activeScrapReasons}
          totalDistributed={totalDistributed}
          totalReasonAllocated={totalReasonAllocated}
          isReasonDistributionValid={isReasonDistributionValid}
          remainingInBatch={remainingInBatch}
          isProcessing={isProcessing}
          handleBulkClassify={handleBulkClassify}
          handleDispose={handleDispose}
          handleRework={handleRework}
          openRestorationModal={openRestorationModal}
          openReworkModal={openReworkModal}
          setRouteReturnDraft={setRouteReturnDraft}
        />

        {scanError && !isScanning && (
          <div style={{ margin: '15px 0', color: '#ef4444', fontSize: '0.76rem', fontWeight: 750 }}>
            {scanError}
          </div>
        )}
      </div>

      <BrakScanModal
        isScanning={isScanning}
        setIsScanning={setIsScanning}
      />

      <BrakCardScrapModal
        scannedCard={scannedCard}
        setScannedCard={setScannedCard}
        orders={orders}
        nomenclatures={nomenclatures}
        qcInspector={qcInspector}
        setQcInspector={setQcInspector}
        qcCardOperators={qcCardOperators}
        qcResponsibleOperator={qcResponsibleOperator}
        setQcResponsibleOperator={setQcResponsibleOperator}
        qcReason={qcReason}
        setQcReason={setQcReason}
        scrapReasons={scrapReasons}
        scrapReasonRows={scrapReasonRows}
        qcCustomReason={qcCustomReason}
        setQcCustomReason={setQcCustomReason}
        qcScrapCount={qcScrapCount}
        setQcScrapCount={setQcScrapCount}
        isProcessing={isProcessing}
        handleQCScrapOverride={handleQCScrapOverride}
      />

      <BrakRestorationModal
        restorationDraft={restorationDraft}
        setRestorationDraft={setRestorationDraft}
        restorationQuantity={restorationQuantity}
        setRestorationQuantity={setRestorationQuantity}
        restorationStageId={restorationStageId}
        setRestorationStageId={setRestorationStageId}
        restorationStages={restorationStages}
        isProcessing={isProcessing}
        handleSendToRestoration={handleSendToRestoration}
      />

      <ReturnToRouteModal
        key={routeReturnDraft?.id || 'closed'}
        item={routeReturnDraft}
        saving={isProcessing}
        onClose={() => setRouteReturnDraft(null)}
        onConfirm={handleReturnToRoute}
      />

      <BrakReworkModal
        reworkDraft={reworkDraft}
        setReworkDraft={setReworkDraft}
        reworkQuantity={reworkQuantity}
        setReworkQuantity={setReworkQuantity}
        isProcessing={isProcessing}
        handleSendToRework={handleSendToRework}
      />

      <style dangerouslySetInnerHTML={{ __html: `
        .glass-panel { backdrop-filter: blur(10px); }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        .mobile-text { display: none; }
        @keyframes pulse-red {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        @media (max-width: 900px) {
          .report-filters-bar {
            flex-direction: column !important;
            align-items: stretch !important;
            padding: 15px !important;
          }
          .report-filters-bar > * {
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box;
          }
          .report-main-columns {
            flex-direction: column !important;
          }
          .report-left-column, .report-right-column {
            flex: 1 1 100% !important;
            width: 100% !important;
          }
        }
        @media (max-width: 600px) {
          .qc-catalog-container {
            padding: 15px !important;
          }
          .qc-catalog-add-row {
            flex-direction: row !important;
            align-items: stretch !important;
          }
          .qc-catalog-add-row button {
            padding: 0 15px !important;
          }
          .qc-catalog-row {
            flex-wrap: nowrap !important;
            gap: 8px !important;
            padding: 10px 12px !important;
          }
          .qc-catalog-row .row-name {
            font-size: 0.8rem !important;
            word-break: break-word !important;
            line-height: 1.2 !important;
          }
          .qc-catalog-row button {
            padding: 6px 10px !important;
            font-size: 0.7rem !important;
            min-width: auto !important;
            flex-shrink: 0 !important;
          }
          .desktop-text {
            display: none !important;
          }
          .mobile-text {
            display: inline-block !important;
          }
        }
      `}} />
    </div>
  )
}
