import React from 'react'
import { MachinesNavbar } from './Machines/components/MachinesNavbar.jsx'
import { MachinesHeaderBar } from './Machines/components/MachinesHeaderBar.jsx'
import { MachinesFormCard } from './Machines/components/MachinesFormCard.jsx'
import { MachinesTypesGrid } from './Machines/components/MachinesTypesGrid.jsx'
import { MachinesGrid } from './Machines/components/MachinesGrid.jsx'
import { MachinesDetailModal } from './Machines/components/modals/MachinesDetailModal.jsx'
import { MachinesQrScanModal } from './Machines/components/modals/MachinesQrScanModal.jsx'
import { useMachinesData } from './Machines/hooks/useMachinesData.js'

const MachinesModule = () => {
  const {
    machines,
    loading,
    tasks,
    orders,
    workCards,
    nomenclatures,
    currentUser,
    supabase,
    fetchData,
    showAdd,
    setShowAdd,
    selectedMachineId,
    setSelectedMachineId,
    selectedType,
    setSelectedType,
    form,
    setForm,
    currentTime,
    maintenanceLogs,
    isScanning,
    setIsScanning,
    scanError,
    setScanError,
    stats,
    selectedMachine,
    activeCallsForMachine,
    activeWorkForMachine,
    handlePrintQR,
    handleSubmit,
    handleEdit,
    handleDelete,
    getHistoryForMachine,
    calculateTotalTime,
    formatElapsed,
    formatPlanned
  } = useMachinesData()

  return (
    <div className="machines-module-v3" style={{ background: '#050505', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <MachinesNavbar stats={stats} />

      <div className="module-content" style={{ padding: '30px', overflowY: 'auto', flex: 1 }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <MachinesHeaderBar
            setIsScanning={setIsScanning}
            showAdd={showAdd}
            setShowAdd={setShowAdd}
            setForm={setForm}
          />

          <MachinesFormCard
            showAdd={showAdd}
            form={form}
            setForm={setForm}
            handleSubmit={handleSubmit}
          />

          {loading ? (
            <div style={{ textAlign: 'center', padding: '100px', color: '#444' }}>Завантаження обладнання...</div>
          ) : !selectedType ? (
            <MachinesTypesGrid
              machines={machines}
              setSelectedType={setSelectedType}
              activeWorkForMachine={activeWorkForMachine}
            />
          ) : (
            <MachinesGrid
              machines={machines}
              selectedType={selectedType}
              setSelectedType={setSelectedType}
              setSelectedMachineId={setSelectedMachineId}
              activeWorkForMachine={activeWorkForMachine}
              tasks={tasks}
              nomenclatures={nomenclatures}
              currentTime={currentTime}
              handleEdit={handleEdit}
              handleDelete={handleDelete}
              formatElapsed={formatElapsed}
              formatPlanned={formatPlanned}
            />
          )}
        </div>
      </div>

      <MachinesDetailModal
        selectedMachineId={selectedMachineId}
        setSelectedMachineId={setSelectedMachineId}
        selectedMachine={selectedMachine}
        activeCallsForMachine={activeCallsForMachine}
        currentUser={currentUser}
        supabase={supabase}
        fetchData={fetchData}
        maintenanceLogs={maintenanceLogs}
        orders={orders || []}
        workCards={workCards || []}
        nomenclatures={nomenclatures || []}
        calculateTotalTime={calculateTotalTime}
        handlePrintQR={handlePrintQR}
        getHistoryForMachine={getHistoryForMachine}
      />

      <MachinesQrScanModal
        isScanning={isScanning}
        setIsScanning={setIsScanning}
        scanError={scanError}
        setScanError={setScanError}
      />

      <style dangerouslySetInnerHTML={{ __html: `
        .stat-pill { background: #111; padding: 6px 15px; border-radius: 10px; font-size: 0.75rem; border: 1px solid #1a1a1a; color: #555; font-weight: 800; }
        .input-group label { display: flex; align-items: center; gap: 8px; font-size: 0.65rem; color: #444; text-transform: uppercase; font-weight: 900; margin-bottom: 8px; }
        .input-group input { width: 100%; background: #000; border: 1px solid #222; color: #fff; padding: 15px; border-radius: 12px; font-size: 0.9rem; outline: none; transition: 0.2s; }
        .input-group input:focus, .input-group select:focus { border-color: #ff9000; background: #050505; }

        .machine-card-v3 {
          background: #0d0d0d; border: 1px solid #1c1c1c; border-radius: 28px; padding: 30px; 
          cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex; flex-direction: column; gap: 20px;
        }
        .machine-card-v3:hover { transform: translateY(-8px); border-color: #333; box-shadow: 0 30px 60px rgba(0,0,0,0.6); }
        
        .card-top { display: flex; justify-content: space-between; align-items: center; }
        .machine-icon-box { background: #111; width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; color: #ff9000; border: 1px solid #1a1a1a; }
        
        .status-badge { display: flex; align-items: center; gap: 8px; font-size: 0.65rem; font-weight: 950; letter-spacing: 1px; color: #444; }
        .is-busy .status-badge { color: #ef4444; }
        .is-idle .status-badge { color: #10b981; }
        .is-repair .status-badge { color: #eab308; }
        .is-maintenance-req .status-badge { color: #ef4444; }
        .is-under-maintenance .status-badge { color: #3b82f6; }
        
        .status-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
        .is-busy .status-dot { box-shadow: 0 0 10px #ef4444; animation: pulseRed 2s infinite; }
        .is-idle .status-dot { box-shadow: 0 0 10px #10b981; }
        .is-repair .status-dot { box-shadow: 0 0 10px #eab308; }
        .is-maintenance-req .status-dot { box-shadow: 0 0 10px #ef4444; animation: pulseRed 2s infinite; }
        .is-under-maintenance .status-dot { box-shadow: 0 0 10px #3b82f6; }

        .machine-card-v3.is-repair { border-color: rgba(234, 179, 8, 0.2); }
        .machine-card-v3.is-repair:hover { border-color: rgba(234, 179, 8, 0.5); box-shadow: 0 30px 60px rgba(234, 179, 8, 0.1); }
        .machine-card-v3.is-maintenance-req { border-color: rgba(239, 68, 68, 0.25); }
        .machine-card-v3.is-maintenance-req:hover { border-color: rgba(239, 68, 68, 0.6); box-shadow: 0 30px 60px rgba(239, 68, 68, 0.15); }
        .machine-card-v3.is-under-maintenance { border-color: rgba(59, 130, 246, 0.25); }
        .machine-card-v3.is-under-maintenance:hover { border-color: rgba(59, 130, 246, 0.6); box-shadow: 0 30px 60px rgba(59, 130, 246, 0.15); }

        .card-actions { display: flex; gap: 10px; opacity: 0; transition: 0.2s; }
        .machine-card-v3:hover .card-actions { opacity: 1; }
        .card-actions button { background: transparent; border: none; color: #444; cursor: pointer; transition: 0.2s; }
        .card-actions button:hover { color: #fff; }
        .card-actions .btn-del:hover { color: #ef4444; }

        .inv-no { font-size: 0.6rem; font-weight: 1000; color: #333; letter-spacing: 1.5px; }
        .machine-name { margin: 0; font-size: 1.8rem; font-weight: 1000; letter-spacing: -0.5px; }
        .location-info { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: #555; font-weight: 700; }
        
        .card-footer { border-top: 1px solid #1a1a1a; padding-top: 20px; }
        .idle-info { display: flex; justify-content: space-between; align-items: center; color: #444; font-size: 0.75rem; font-weight: 800; }
        .history-link { color: #222; font-size: 0.65rem; text-transform: uppercase; font-weight: 950; }
        
        .active-work-info { display: flex; flex-direction: column; gap: 8px; }
        .work-header { display: flex; justify-content: space-between; align-items: center; }
        .task-type { font-size: 0.65rem; font-weight: 1000; color: #ef4444; letter-spacing: 1px; }
        .timer { font-size: 0.85rem; font-weight: 900; color: #fff; display: flex; align-items: center; gap: 6px; }
        .work-detail { font-size: 1rem; font-weight: 900; color: #fff; line-height: 1.2; }
        .work-operator { font-size: 0.75rem; color: #888; font-weight: 700; display: flex; align-items: center; gap: 6px; }
        .work-progress { height: 4px; background: #1a1a1a; border-radius: 2px; overflow: hidden; margin-top: 5px; }
        .progress-bar-inner { height: 100%; background: #ef4444; box-shadow: 0 0 10px #ef4444; }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 2000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px); }
        .modal-content { background: #0a0a0a; border: 1px solid #222; border-radius: 32px; box-shadow: 0 50px 100px rgba(0,0,0,0.8); overflow: hidden; animation: zoomIn 0.3s; }
        .machine-detail-modal { width: 1000px; max-width: 95vw; }
        
        .modal-header { padding: 40px; display: flex; justify-content: space-between; align-items: center; background: #000; border-bottom: 1px solid #1a1a1a; }
        .modal-icon { width: 70px; height: 70px; background: #111; border-radius: 20px; display: flex; align-items: center; justify-content: center; color: #ff9000; border: 1px solid #222; }
        .btn-close { background: #111; border: none; color: #fff; width: 48px; height: 48px; border-radius: 14px; cursor: pointer; }
        
        .modal-body-split { display: grid; grid-template-columns: 300px 1fr; }
        .detail-sidebar { padding: 40px; background: #080808; border-right: 1px solid #1a1a1a; display: flex; flex-direction: column; gap: 30px; }
        .side-metric label { display: block; font-size: 0.65rem; font-weight: 1000; color: #333; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
        .side-metric span { font-size: 1.2rem; font-weight: 1000; color: #fff; }
        
        .detail-main { padding: 40px; }
        .history-table-wrapper { background: #050505; border-radius: 20px; border: 1px solid #1a1a1a; overflow: hidden; }
        .history-table-wrapper table { width: 100%; border-collapse: collapse; text-align: left; }
        .history-table-wrapper th { padding: 15px 20px; font-size: 0.7rem; color: #333; text-transform: uppercase; font-weight: 1000; background: #000; }
        .history-table-wrapper td { padding: 15px 20px; border-bottom: 1px solid #111; font-size: 0.85rem; }
        
        @keyframes pulseRed { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
        @keyframes zoomIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes slideDown { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .anim-slide-down { animation: slideDown 0.3s ease-out; }
      `}} />
    </div>
  )
}

export default MachinesModule
