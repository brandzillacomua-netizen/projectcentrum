import React from 'react'
import { ScannerPanel as ScannerPanelRaw } from './Warehouse/components/ScannerPanel.jsx'
import { ReceptionAcceptanceModal as ReceptionAcceptanceModalRaw } from './Warehouse/components/ReceptionAcceptanceModal.jsx'
import { ReserveAnalysisModal as ReserveAnalysisModalRaw } from './Warehouse/components/ReserveAnalysisModal.jsx'

import { getQR, setQR } from './Supply/utils/supplyHelpers.js'
import { SupplyNav as SupplyNavRaw } from './Supply/components/SupplyNav.jsx'
import { SupplyCreateShipmentModal as SupplyCreateShipmentModalRaw } from './Supply/components/SupplyCreateShipmentModal.jsx'
import { SupplyRequestsTab as SupplyRequestsTabRaw } from './Supply/components/SupplyRequestsTab.jsx'
import { SupplyRegistryTab as SupplyRegistryTabRaw } from './Supply/components/SupplyRegistryTab.jsx'
import { SupplyStockTab as SupplyStockTabRaw } from './Supply/components/SupplyStockTab.jsx'
import { SupplyQrTab as SupplyQrTabRaw } from './Supply/components/SupplyQrTab.jsx'
import { SupplyShortageModal as SupplyShortageModalRaw } from './Supply/components/SupplyShortageModal.jsx'
import { SupplyDeleteItemModal as SupplyDeleteItemModalRaw } from './Supply/components/SupplyDeleteItemModal.jsx'

const ScannerPanel = ScannerPanelRaw as React.FC<any>
const ReceptionAcceptanceModal = ReceptionAcceptanceModalRaw as React.FC<any>
const ReserveAnalysisModal = ReserveAnalysisModalRaw as React.FC<any>
const SupplyNav = SupplyNavRaw as React.FC<any>
const SupplyCreateShipmentModal = SupplyCreateShipmentModalRaw as React.FC<any>
const SupplyRequestsTab = SupplyRequestsTabRaw as React.FC<any>
const SupplyRegistryTab = SupplyRegistryTabRaw as React.FC<any>
const SupplyStockTab = SupplyStockTabRaw as React.FC<any>
const SupplyQrTab = SupplyQrTabRaw as React.FC<any>
const SupplyShortageModal = SupplyShortageModalRaw as React.FC<any>
const SupplyDeleteItemModal = SupplyDeleteItemModalRaw as React.FC<any>
import { useSupplyData } from './Supply/hooks/useSupplyData.jsx'

export { getQR, setQR }

export const SupplyModuleV2: React.FC<{ isProcurementOnly?: boolean }> = ({ isProcurementOnly = false }) => {
  const {
    inventory,
    nomenclatures,
    receptionDocs,
    purchaseRequests,
    currentUser,
    managers,
    requests,
    tasks,
    orders,
    sendDocToWarehouse,
    updatePurchaseRequestStatus,
    convertRequestToOrder,
    refreshTable,
    normalize,
    issueMaterialsBatch,
    supabase,
    activeTab,
    setActiveTab,
    requestSubTab,
    setRequestSubTab,
    showCreate,
    setShowCreate,
    draftItems,
    setDraftItems,
    selectedQty,
    setSelectedQty,
    searchQuery,
    setSearchQuery,
    stockFolder,
    setStockFolder,
    expandedDoc,
    setExpandedDoc,
    showReception,
    setShowReception,
    shortageModal,
    setShortageModal,
    receptionDocToAccept,
    setReceptionDocToAccept,
    isProcessing,
    processingDocs,
    setProcessingDocs,
    targetWarehouse,
    setTargetWarehouse,
    expandedPRs,
    setExpandedPRs,
    isScanning,
    setIsScanning,
    manualCardInput,
    setManualCardInput,
    qrNomSearch,
    setQrNomSearch,
    editingQrNomId,
    setEditingQrNomId,
    editingQrCodeValue,
    setEditingQrCodeValue,
    savingQr,
    selectedQrNomIds,
    setSelectedQrNomIds,
    reserveAnalysisItem,
    setReserveAnalysisItem,
    editingInvId,
    setEditingInvId,
    editingInvTotal,
    setEditingInvTotal,
    editingInvReserved,
    setEditingInvReserved,
    savingInv,
    itemToDelete,
    setItemToDelete,
    isDeleting,
    isSuperAdmin,
    isAdmin,
    handleDeleteInventoryItem,
    confirmDeleteInventoryItem,
    handleSaveInventoryQty,
    pendingRequests,
    groupedPrepRequests,
    incomingReceptionCount,
    availableNoms,
    filteredStock,
    isDocAvailable,
    handleQRScan,
    handleSaveQrCode,
    handleDeleteQrCode,
    addToDraft,
    handleSendToWarehouse,
    handleForwardToProcurement,
    handleRequestPrepMaterialsFromProcurement,
    handleManualShortagePR,
    confirmForwardToProcurement,
    handleDeletePrepRequestGroup,
    handleDeletePurchaseRequest,
    handleAcceptReceptionDoc
  }: any = useSupplyData({ isProcurementOnly })

  return (
    <div className="supply-module-v2" style={{ background: 'var(--card-inner-bg, #0a0a0a)', minHeight: '100vh', color: 'var(--text-color, #fff)', display: 'flex', flexDirection: 'column' }}>
      <SupplyNav
        isProcurementOnly={isProcurementOnly}
        currentUser={currentUser}
        incomingReceptionCount={incomingReceptionCount}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        showCreate={showCreate}
        setShowCreate={setShowCreate}
        setTargetWarehouse={setTargetWarehouse}
        showReception={showReception}
        setShowReception={setShowReception}
        receptionDocs={receptionDocs}
        processingDocs={processingDocs}
        setReceptionDocToAccept={setReceptionDocToAccept}
        supabase={supabase}
        refreshTable={refreshTable}
        pendingRequestsCount={pendingRequests.length}
      />

      <div className="module-content" style={{ padding: '0 25px 25px 25px', overflowY: 'auto', flex: 1 }}>
        <SupplyCreateShipmentModal
          showCreate={showCreate}
          setShowCreate={setShowCreate}
          isProcurementOnly={isProcurementOnly}
          targetWarehouse={targetWarehouse}
          setTargetWarehouse={setTargetWarehouse}
          managers={managers}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          availableNoms={availableNoms}
          setIsScanning={setIsScanning}
          selectedQty={selectedQty}
          setSelectedQty={setSelectedQty}
          addToDraft={addToDraft}
          draftItems={draftItems}
          setDraftItems={setDraftItems}
          isProcessing={isProcessing}
          handleSendToWarehouse={handleSendToWarehouse}
        />

        {!showCreate && activeTab === 'requests' && (
          <SupplyRequestsTab
            isProcurementOnly={isProcurementOnly}
            requestSubTab={requestSubTab}
            setRequestSubTab={setRequestSubTab}
            groupedPrepRequests={groupedPrepRequests}
            pendingRequests={pendingRequests}
            isSuperAdmin={isSuperAdmin}
            handleDeletePrepRequestGroup={handleDeletePrepRequestGroup}
            handleDeletePurchaseRequest={handleDeletePurchaseRequest}
            nomenclatures={nomenclatures}
            inventory={inventory}
            purchaseRequests={purchaseRequests}
            receptionDocs={receptionDocs}
            processingDocs={processingDocs}
            setProcessingDocs={setProcessingDocs}
            issueMaterialsBatch={issueMaterialsBatch}
            handleRequestPrepMaterialsFromProcurement={handleRequestPrepMaterialsFromProcurement}
            updatePurchaseRequestStatus={updatePurchaseRequestStatus}
            convertRequestToOrder={convertRequestToOrder}
            handleForwardToProcurement={handleForwardToProcurement}
            expandedPRs={expandedPRs}
            setExpandedPRs={setExpandedPRs}
            normalize={normalize}
          />
        )}

        {!showCreate && activeTab === 'registry' && (
          <SupplyRegistryTab
            isProcurementOnly={isProcurementOnly}
            receptionDocs={receptionDocs}
            expandedDoc={expandedDoc}
            setExpandedDoc={setExpandedDoc}
            processingDocs={processingDocs}
            setProcessingDocs={setProcessingDocs}
            setReceptionDocToAccept={setReceptionDocToAccept}
            isDocAvailable={isDocAvailable}
            sendDocToWarehouse={sendDocToWarehouse}
            supabase={supabase}
            refreshTable={refreshTable}
          />
        )}

        {!showCreate && activeTab === 'stock' && !isProcurementOnly && (
          <SupplyStockTab
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            stockFolder={stockFolder}
            setStockFolder={setStockFolder}
            filteredStock={filteredStock}
            nomenclatures={nomenclatures}
            tasks={tasks}
            isAdmin={isAdmin}
            editingInvId={editingInvId}
            setEditingInvId={setEditingInvId}
            editingInvTotal={editingInvTotal}
            setEditingInvTotal={setEditingInvTotal}
            editingInvReserved={editingInvReserved}
            setEditingInvReserved={setEditingInvReserved}
            savingInv={savingInv}
            handleSaveInventoryQty={handleSaveInventoryQty}
            handleDeleteInventoryItem={handleDeleteInventoryItem}
            setReserveAnalysisItem={setReserveAnalysisItem}
          />
        )}

        {!showCreate && activeTab === 'qrcodes' && isProcurementOnly && (
          <SupplyQrTab
            nomenclatures={nomenclatures}
            qrNomSearch={qrNomSearch}
            setQrNomSearch={setQrNomSearch}
            selectedQrNomIds={selectedQrNomIds}
            setSelectedQrNomIds={setSelectedQrNomIds}
            editingQrNomId={editingQrNomId}
            setEditingQrNomId={setEditingQrNomId}
            editingQrCodeValue={editingQrCodeValue}
            setEditingQrCodeValue={setEditingQrCodeValue}
            savingQr={savingQr}
            handleSaveQrCode={handleSaveQrCode}
            handleDeleteQrCode={handleDeleteQrCode}
          />
        )}
      </div>

      {receptionDocToAccept && (
        <ReceptionAcceptanceModal
          doc={receptionDocToAccept}
          nomenclatures={nomenclatures}
          isProcessing={processingDocs.has(receptionDocToAccept.id)}
          onClose={() => setReceptionDocToAccept(null)}
          onConfirm={(payload: any) => handleAcceptReceptionDoc(receptionDocToAccept, payload)}
        />
      )}

      <SupplyShortageModal
        shortageModal={shortageModal}
        setShortageModal={setShortageModal}
        isProcessing={isProcessing}
        handleManualShortagePR={handleManualShortagePR}
        confirmForwardToProcurement={confirmForwardToProcurement}
      />

      <SupplyDeleteItemModal
        itemToDelete={itemToDelete}
        setItemToDelete={setItemToDelete}
        isDeleting={isDeleting}
        confirmDeleteInventoryItem={confirmDeleteInventoryItem}
      />

      {reserveAnalysisItem && (
        <ReserveAnalysisModal
          item={reserveAnalysisItem}
          onClose={() => setReserveAnalysisItem(null)}
          requests={requests}
          orders={orders}
          tasks={tasks}
          nomenclatures={nomenclatures}
        />
      )}

      <ScannerPanel
        isScanning={isScanning}
        setIsScanning={setIsScanning}
        manualCardInput={manualCardInput}
        setManualCardInput={setManualCardInput}
        handleCardScan={handleQRScan}
        color="#ff9000"
      />

      <style dangerouslySetInnerHTML={{ __html: `
        .tab-btn-m { flex: 1; padding: 12px; border: none; background: transparent; color: #444; font-weight: 900; font-size: 0.7rem; border-radius: 10px; cursor: pointer; transition: 0.3s; }
        .tab-btn-m.active { background: #222; color: #ff9000; }
        .status-pill.pending { background: rgba(255,144,0,0.1); color: #ff9000; }
        .status-pill.completed { background: rgba(16,185,129,0.1); color: #10b981; }
        .status-pill.ordered { background: rgba(59,130,246,0.1); color: #3b82f6; }
        .status-pill.shipped { background: rgba(139,92,246,0.1); color: #8b5cf6; }
        @media (max-width: 768px) { .hide-mobile { display: none !important; } .mobile-stack { grid-template-columns: 1fr !important; } }
        @media (min-width: 769px) { .mobile-only { display: none !important; } }
      `}} />
    </div>
  )
}

export default SupplyModuleV2
