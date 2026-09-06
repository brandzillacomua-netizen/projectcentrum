import React from 'react'
import { PackageCheck, CheckCircle2, Clock } from 'lucide-react'
import { useShippingData } from './Shipping/hooks/useShippingData.jsx'
import ShippingHeader from './Shipping/components/ShippingHeader.jsx'
import ReadyBatchCard from './Shipping/components/ReadyBatchCard.jsx'
import ShippedBatchCard from './Shipping/components/ShippedBatchCard.jsx'
import ShippingWorkModal from './Shipping/components/modals/ShippingWorkModal.jsx'
import NovaPoshtaTtnModal from './Shipping/components/modals/NovaPoshtaTtnModal.jsx'
import PackingSlipModal from './Shipping/components/modals/PackingSlipModal.jsx'

const ShippingModule = () => {
  const {
    currentUser,
    activeMobileSection,
    setActiveMobileSection,
    isProcessing,
    readyBatches,
    shippedBatches,
    workModal,
    openWorkModal,
    closeWorkModal,
    customerDeliveryAddresses,
    matchingCustomer,
    selectedClientAddressId,
    setSelectedClientAddressId,
    shippingType,
    setShippingType,
    shippingDate,
    setShippingDate,
    ttnNumber,
    setTtnNumber,
    selectedWorkerId,
    setSelectedWorkerId,
    batchColor,
    setBatchColor,
    boxes,
    checkedBoxes,
    setCheckedBoxes,
    loadingBoxes,
    shippingWorkers,
    handleOpenNpModal,
    handleFinishShipping,
    canFinish,
    isNpModalOpen,
    setIsNpModalOpen,
    npError,
    npKeyInput,
    setNpKeyInput,
    saveNpApiKey,
    npSuccessData,
    npSenderDetails,
    npRecipientName,
    setNpRecipientName,
    npRecipientPhone,
    setNpRecipientPhone,
    npCitySearch,
    handleCitySearch,
    npCityList,
    npSelectedCity,
    handleSelectCity,
    npWarehouseList,
    npSelectedWarehouse,
    setNpSelectedWarehouse,
    npCost,
    setNpCost,
    npSeatsList,
    totalSeatsWeight,
    handleAddSeat,
    handleRemoveSeat,
    handleUpdateSeat,
    npDescription,
    setNpDescription,
    npPayerType,
    setNpPayerType,
    npLoading,
    handleGenerateNpTTNSubmit,
    packingSlip,
    setPackingSlip,
    handleViewPackingSlip
  } = useShippingData()

  return (
    <div className="shipping-module-v2 shipping-module-container" style={{ background: 'var(--bg, #050505)', minHeight: '100vh', color: 'var(--text, #e2e8f0)', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* HEADER */}
      <ShippingHeader currentUser={currentUser} />

      {/* MOBILE TABS */}
      <div className="shipping-mobile-tabs">
        <button onClick={() => setActiveMobileSection('ready')} className={`tab-btn ${activeMobileSection === 'ready' ? 'active' : ''}`}>
          ГОТОВО ({readyBatches.length})
        </button>
        <button onClick={() => setActiveMobileSection('shipped')} className={`tab-btn ${activeMobileSection === 'shipped' ? 'active' : ''}`}>
          ВІДПРАВЛЕНО ({shippedBatches.length})
        </button>
      </div>

      <main style={{ padding: '40px', flex: 1, maxWidth: '1800px', margin: '0 auto', width: '100%' }}>
        <div className="shipping-grid">

          {/* КОЛОНКА: ГОТОВО ДО ВІДВАНТАЖЕННЯ */}
          <section className={`dashboard-col ${activeMobileSection !== 'ready' ? 'hide-mobile' : ''}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }} />
                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text, #fff)', margin: 0 }}>ГОТОВО ДО ВІДВАНТАЖЕННЯ</h3>
              </div>
              <span style={{ background: '#10b98115', color: '#10b981', fontSize: '0.65rem', fontWeight: 900, padding: '6px 12px', borderRadius: '10px', border: '1px solid #10b98130' }}>
                {readyBatches.length} ПАРТІЙ
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {readyBatches.map(batch => (
                <ReadyBatchCard
                  key={`${batch.orderId}_${batch.batchIndex}`}
                  batch={batch}
                  onTakeWork={openWorkModal}
                  isProcessing={isProcessing}
                />
              ))}

              {readyBatches.length === 0 && (
                <div style={{ textAlign: 'center', padding: '80px 40px', color: '#222' }}>
                  <PackageCheck size={48} color="#1a1a1a" />
                  <p style={{ fontWeight: 900, color: 'var(--text, #333)', margin: '15px 0 5px' }}>Черга відвантаження порожня</p>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #555)' }}>Очікуємо завершення пакування в цеху</span>
                </div>
              )}
            </div>
          </section>

          {/* КОЛОНКА: ВІДПРАВЛЕНО */}
          <section className={`dashboard-col ${activeMobileSection !== 'shipped' ? 'hide-mobile' : ''}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={18} color="#555" />
                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-secondary, #555)', margin: 0 }}>ВІДПРАВЛЕНО</h3>
              </div>
              <span style={{ background: 'var(--card-inner-bg, #111)', color: 'var(--text-secondary, #555)', fontSize: '0.65rem', fontWeight: 900, padding: '6px 12px', borderRadius: '10px', border: '1px solid var(--border, #222)' }}>
                {shippedBatches.length} ПАРТІЙ
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {shippedBatches.map(batch => (
                <ShippedBatchCard
                  key={`${batch.orderId}_${batch.batchIndex}`}
                  batch={batch}
                  onViewPackingSlip={handleViewPackingSlip}
                />
              ))}

              {shippedBatches.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 40px', color: '#222' }}>
                  <Clock size={40} color="#1a1a1a" />
                  <p style={{ fontWeight: 800, color: '#333', margin: '12px 0 0' }}>Ще нічого не відвантажено</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* МОДАЛЬНЕ ВІКНО "ВЗЯТИ В РОБОТУ" */}
      {workModal && (
        <ShippingWorkModal
          workModal={workModal}
          onClose={closeWorkModal}
          customerDeliveryAddresses={customerDeliveryAddresses}
          matchingCustomer={matchingCustomer}
          selectedClientAddressId={selectedClientAddressId}
          setSelectedClientAddressId={setSelectedClientAddressId}
          shippingType={shippingType}
          setShippingType={setShippingType}
          shippingDate={shippingDate}
          setShippingDate={setShippingDate}
          ttnNumber={ttnNumber}
          setTtnNumber={setTtnNumber}
          selectedWorkerId={selectedWorkerId}
          setSelectedWorkerId={setSelectedWorkerId}
          batchColor={batchColor}
          setBatchColor={setBatchColor}
          boxes={boxes}
          checkedBoxes={checkedBoxes}
          setCheckedBoxes={setCheckedBoxes}
          loadingBoxes={loadingBoxes}
          shippingWorkers={shippingWorkers}
          handleOpenNpModal={handleOpenNpModal}
          handleFinishShipping={handleFinishShipping}
          canFinish={canFinish}
          isProcessing={isProcessing}
        />
      )}

      {/* МОДАЛЬНЕ ВІКНО ГЕНЕРАТОРА ТТН НОВА ПОШТА */}
      {isNpModalOpen && (
        <NovaPoshtaTtnModal
          isOpen={isNpModalOpen}
          onClose={() => setIsNpModalOpen(false)}
          npError={npError}
          npKeyInput={npKeyInput}
          setNpKeyInput={setNpKeyInput}
          saveNpApiKey={saveNpApiKey}
          handleOpenNpModal={handleOpenNpModal}
          npSuccessData={npSuccessData}
          npSenderDetails={npSenderDetails}
          npRecipientName={npRecipientName}
          setNpRecipientName={setNpRecipientName}
          npRecipientPhone={npRecipientPhone}
          setNpRecipientPhone={setNpRecipientPhone}
          npCitySearch={npCitySearch}
          handleCitySearch={handleCitySearch}
          npCityList={npCityList}
          npSelectedCity={npSelectedCity}
          handleSelectCity={handleSelectCity}
          npWarehouseList={npWarehouseList}
          npSelectedWarehouse={npSelectedWarehouse}
          setNpSelectedWarehouse={setNpSelectedWarehouse}
          npCost={npCost}
          setNpCost={setNpCost}
          npSeatsList={npSeatsList}
          totalSeatsWeight={totalSeatsWeight}
          handleAddSeat={handleAddSeat}
          handleRemoveSeat={handleRemoveSeat}
          handleUpdateSeat={handleUpdateSeat}
          npDescription={npDescription}
          setNpDescription={setNpDescription}
          npPayerType={npPayerType}
          setNpPayerType={setNpPayerType}
          npLoading={npLoading}
          handleGenerateNpTTNSubmit={handleGenerateNpTTNSubmit}
        />
      )}

      {/* МОДАЛЬНЕ ВІКНО ПАКУВАЛЬНОГО ЛИСТА */}
      {packingSlip && (
        <PackingSlipModal
          packingSlip={packingSlip}
          onClose={() => setPackingSlip(null)}
        />
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap');

        .shipping-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
        }

        .shipping-mobile-tabs {
          display: none;
          gap: 8px;
          padding: 12px 20px;
          background: #080808;
          border-bottom: 1px solid #1a1a1a;
        }

        .tab-btn {
          flex: 1;
          padding: 12px;
          border-radius: 12px;
          border: none;
          background: transparent;
          color: #555;
          font-weight: 900;
          font-size: 0.75rem;
          cursor: pointer;
          transition: 0.2s;
        }

        .tab-btn.active {
          background: #ff9000;
          color: #000;
        }

        .batch-card {
          background: rgba(15,25,35,0.6);
          border: 1px solid #1a2535;
          border-radius: 24px;
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        .batch-card:hover {
          border-color: rgba(255,144,0,0.25);
          transform: translateY(-3px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.4), 0 0 30px rgba(255,144,0,0.04);
        }

        .take-work-btn {
          background: linear-gradient(135deg, #ff9000 0%, #ff5e00 100%);
          color: #000;
          border: none;
          padding: 11px 18px;
          border-radius: 12px;
          font-weight: 900;
          font-size: 0.75rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 7px;
          transition: 0.2s;
          box-shadow: 0 4px 14px rgba(255,144,0,0.3);
        }

        .take-work-btn:hover {
          transform: scale(1.04);
          box-shadow: 0 6px 20px rgba(255,144,0,0.5);
        }

        .take-work-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        @keyframes pulse {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }

        @media (max-width: 1024px) {
          .shipping-grid { grid-template-columns: 1fr; }
          .shipping-mobile-tabs { display: flex; }
          .hide-mobile { display: none !important; }
        }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #333; }
      `}} />
    </div>
  )
}

export default React.memo(ShippingModule)
