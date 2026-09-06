import React from 'react'
import { Package, ArrowLeft, Menu } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePackagingData } from './Packaging/hooks/usePackagingData.jsx'

import { PackagingSidebar } from './Packaging/components/PackagingSidebar.jsx'
import { PackagingDetailHeader } from './Packaging/components/PackagingDetailHeader.jsx'
import { PackagingBoxSummary } from './Packaging/components/PackagingBoxSummary.jsx'
import { PackagingBomList } from './Packaging/components/PackagingBomList.jsx'
import { PackagingAddItemModal } from './Packaging/components/PackagingAddItemModal.jsx'
import { PackagingPackerModal } from './Packaging/components/PackagingPackerModal.jsx'
import { PackagingActionRow } from './Packaging/components/PackagingActionRow.jsx'

const PackagingModule = () => {
  const {
    nomenclatures,
    inventory,
    batchList,
    selectedBatch,
    setSelectedBatch,
    isDrawerOpen,
    setIsDrawerOpen,
    activeQueueCount,
    activeBatchData,
    categorizedBOM,
    allBOMItems,
    orderRequests,
    isWarehouseConfirmed,
    showBoxSummary,
    setShowBoxSummary,
    excludedNomIds,
    setExcludedNomIds,
    boxNumbers,
    setBoxNumbers,
    customQty,
    setCustomQty,
    setCustomItems,
    isProcessing,
    hasAnyRequests,
    isSavingBoxes,
    allBoxesFilled,
    boxSummary,
    handleCreateRequest,
    handleSaveBoxes,
    handleCompleteClick,
    handleCompletePackaging,
    handleConfirmAddItem,
    handleOpenAddItemModal,
    showAddItemModal,
    setShowAddItemModal,
    addItemCategoryKey,
    showPackerModal,
    setShowPackerModal,
    packersList
  } = usePackagingData()

  return (
    <div className="packaging-module" style={{ background: 'var(--bg, #f0f2f7)', minHeight: '100vh', color: 'var(--text, #0f172a)', display: 'flex', flexDirection: 'column' }}>

      <nav className="module-nav module-nav-container" style={{ flexShrink: 0, background: 'var(--card-bg, #ffffff)', borderBottom: '1px solid var(--border-color, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Link to="/" style={{ color: 'var(--text-muted, #64748b)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 800 }}>
            <ArrowLeft size={18} /> <span className="hide-mobile">НА ГОЛОВНУ</span>
          </Link>
          <button onClick={() => setIsDrawerOpen(true)} className="burger-btn-labeled mobile-only">
            <Menu size={20} />
            <span>Черга</span>
            {activeQueueCount > 0 && (
              <span className="queue-badge" style={{
                background: '#ef4444',
                color: '#fff',
                borderRadius: '50%',
                fontSize: '10px',
                fontWeight: 900,
                width: '18px',
                height: '18px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1
              }}>
                {activeQueueCount}
              </span>
            )}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#f43f5e', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Package size={18} color="#fff" />
          </div>
          <div>
            <h1 className="nav-title" style={{ fontSize: '0.95rem', fontWeight: 950, margin: 0, letterSpacing: '0.5px', lineHeight: 1.1 }}>ВІДДІЛ ПАКУВАННЯ</h1>
            <div className="nav-subtitle pack-nav-subtitle" style={{ fontSize: '0.58rem', color: 'var(--text-muted, #64748b)', fontWeight: 900, textTransform: 'uppercase', marginTop: '3px', letterSpacing: '0.3px', lineHeight: 1 }}>Контроль комплектування партій</div>
          </div>
        </div>
      </nav>

      <div className="module-content module-content-container" style={{ flex: 1, overflowY: 'auto' }}>
        <div className="master-grid" style={{ maxWidth: '1600px', margin: '0 auto', height: 'calc(100vh - 140px)' }}>

          {/* SIDEBAR QUEUE */}
          <PackagingSidebar
            batchList={batchList}
            selectedBatch={selectedBatch}
            setSelectedBatch={setSelectedBatch}
            isDrawerOpen={isDrawerOpen}
            setIsDrawerOpen={setIsDrawerOpen}
          />

          {/* MAIN AREA */}
          <div className="order-details-area" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {activeBatchData ? (
              <div className="glass-panel details-panel" style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #e2e8f0)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

                {/* HEADER */}
                <PackagingDetailHeader
                  activeBatchData={activeBatchData}
                  isWarehouseConfirmed={isWarehouseConfirmed}
                  boxSummaryCount={boxSummary.length}
                  showBoxSummary={showBoxSummary}
                  setShowBoxSummary={setShowBoxSummary}
                />

                {/* BOM / BOX SUMMARY CONTAINER */}
                <div className="bom-container" style={{ background: 'var(--card-header-bg, #f8fafc)', borderRadius: '28px', padding: '25px', flex: 1, border: '1px solid var(--border-color, #e2e8f0)', marginBottom: '20px', overflowY: 'auto' }}>
                  {showBoxSummary ? (
                    <PackagingBoxSummary boxSummary={boxSummary} />
                  ) : (
                    <PackagingBomList
                      categorizedBOM={categorizedBOM}
                      hasAnyRequests={hasAnyRequests}
                      activeBatchData={activeBatchData}
                      orderRequests={orderRequests}
                      excludedNomIds={excludedNomIds}
                      setExcludedNomIds={setExcludedNomIds}
                      boxNumbers={boxNumbers}
                      setBoxNumbers={setBoxNumbers}
                      customQty={customQty}
                      setCustomQty={setCustomQty}
                      setCustomItems={setCustomItems}
                      onOpenAddItemModal={handleOpenAddItemModal}
                    />
                  )}
                </div>

                {/* ACTION BUTTONS */}
                <PackagingActionRow
                  allBOMItems={allBOMItems}
                  isProcessing={isProcessing}
                  hasAnyRequests={hasAnyRequests}
                  activeBatchData={activeBatchData}
                  isWarehouseConfirmed={isWarehouseConfirmed}
                  boxNumbers={boxNumbers}
                  isSavingBoxes={isSavingBoxes}
                  allBoxesFilled={allBoxesFilled}
                  handleCreateRequest={handleCreateRequest}
                  handleSaveBoxes={handleSaveBoxes}
                  handleCompleteClick={handleCompleteClick}
                />

              </div>
            ) : (
              <div className="glass-panel details-panel" style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <div style={{ textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
                  <Package size={64} style={{ opacity: 0.25, margin: '0 auto 20px' }} />
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: 'var(--text, #0f172a)' }}>Оберіть наряд із черги ліворуч</h3>
                  <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem' }}>для початку пакування та формування коробок</p>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* MODALS */}
      {showAddItemModal && (
        <PackagingAddItemModal
          nomenclatures={nomenclatures}
          inventory={inventory}
          initialCategoryKey={addItemCategoryKey}
          onClose={() => setShowAddItemModal(false)}
          onConfirmAddItem={handleConfirmAddItem}
        />
      )}

      {showPackerModal && (
        <PackagingPackerModal
          packersList={packersList}
          onClose={() => setShowPackerModal(false)}
          onConfirmComplete={handleCompletePackaging}
        />
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .module-nav-container {
          padding: 0 25px !important;
          height: 80px !important;
        }
        .module-content-container {
          padding: 30px !important;
        }
        .details-panel {
          padding: 40px !important;
          border-radius: 32px !important;
        }
        .detail-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 25px;
          flex-shrink: 0;
        }
        @media screen and (max-width: 768px) {
          .module-nav-container {
            padding: 0 12px !important;
            height: 54px !important;
          }
          .nav-title {
            font-size: 0.8rem !important;
          }
          .nav-subtitle {
            display: none !important;
          }
          .module-nav-container svg {
            width: 14px !important;
            height: 14px !important;
          }
          .burger-btn-labeled {
            padding: 4px 8px !important;
            font-size: 0.7rem !important;
          }
          .burger-btn-labeled span {
            font-size: 0.7rem !important;
          }
        }
        .order-detail-title {
          font-size: 2.2rem !important;
        }
        .volume-box {
          text-align: right;
          background: var(--card-header-bg, #111);
          padding: 12px 20px;
          border-radius: 16px;
        }
        .action-buttons-row {
          display: flex;
          gap: 15px;
          flex-shrink: 0;
        }
        
        @media screen and (max-width: 768px) {
          .module-content-container {
            padding: 8px !important;
          }
          .master-grid {
            height: auto !important;
          }
          .order-details-area {
            height: auto !important;
          }
          .details-panel {
            padding: 12px !important;
            border-radius: 16px !important;
            gap: 10px !important;
            height: auto !important;
            overflow: visible !important;
          }
          .bom-container {
            overflow-y: visible !important;
            padding: 15px !important;
            border-radius: 16px !important;
          }
          .detail-header-row {
            flex-direction: row !important;
            justify-content: space-between !important;
            align-items: center !important;
            margin-bottom: 8px !important;
          }
          .order-detail-title {
            font-size: 1.2rem !important;
          }
          .detail-customer-text, .detail-product-text {
            font-size: 0.8rem !important;
          }
          .volume-box {
            padding: 4px 8px !important;
            border-radius: 8px !important;
          }
          .volume-box div:first-child {
            font-size: 0.5rem !important;
          }
          .volume-box div:last-child {
            font-size: 1rem !important;
          }
          
          .action-buttons-row {
            gap: 8px !important;
            margin-top: 5px !important;
            flex-direction: column !important;
          }
          .action-buttons-row button, .action-buttons-row div button {
            padding: 14px 10px !important;
            border-radius: 10px !important;
            font-size: 0.8rem !important;
          }
          .action-buttons-row svg, .action-buttons-row div svg {
            width: 16px !important;
            height: 16px !important;
          }
          .bom-required-list {
            grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)) !important;
            gap: 8px !important;
          }
          .bom-required-list > div {
            padding: 10px !important;
            border-radius: 12px !important;
          }
        }
        .master-grid {
          display: grid;
          grid-template-columns: 350px 1fr;
          gap: 30px;
        }
        .side-panel {
          display: flex;
          flex-direction: column;
        }
        .mobile-only { display: none; }

        @media screen and (max-width: 480px) {
          .bom-required-list {
            grid-template-columns: 1fr !important;
          }
        }
        @media screen and (max-width: 1024px) {
          .hide-mobile { display: none !important; }
          .mobile-only { display: block !important; }
          .master-grid { display: block !important; }
          .side-panel { 
            position: fixed; 
            left: 0; 
            top: 0; 
            bottom: 0; 
            z-index: 100000; 
            transform: translateX(-100%); 
            width: 320px !important; 
            height: 100% !important;
            background: var(--card-bg, #0a0a0a) !important;
            border-right: 1px solid var(--border-color, #1a1a1a) !important;
            border-radius: 0 !important;
            box-shadow: 20px 0 50px rgba(0,0,0,0.5);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .side-panel.drawer-open { transform: translateX(0) !important; }
        }

        .pack-order-card:hover { transform: translateY(-2px); border-color: var(--border-color, #333) !important; }
        .pack-order-card:active { transform: scale(0.99); }
        .ready-pulse { animation: readyPulse 2s infinite; border-color: #10b981 !important; background: #10b98108 !important; }
        @keyframes readyPulse { 0%{box-shadow:0 0 0 0 rgba(16,185,129,0.2);} 70%{box-shadow:0 0 0 10px rgba(16,185,129,0);} 100%{box-shadow:0 0 0 0 rgba(16,185,129,0);} }
        .anim-pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0%{transform:scale(1);opacity:0.1;} 50%{transform:scale(1.1);opacity:0.2;} 100%{transform:scale(1);opacity:0.1;} }
        .anim-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from{transform:rotate(0deg);} to{transform:rotate(360deg);} }
        .box-number-input:focus { border-color: #10b98188 !important; box-shadow: 0 0 0 3px #10b98118; background: #10b98108 !important; }
        .box-number-input::placeholder { color: var(--text-muted, #555) !important; font-weight: 500; text-transform: none; }
        .packer-select:focus { border-color: rgba(168,85,247,0.6) !important; box-shadow: 0 0 0 3px rgba(168,85,247,0.15) !important; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border-color, #1a1a1a); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--border-color, #333); }
      `}} />
    </div>
  )
}

export default PackagingModule
