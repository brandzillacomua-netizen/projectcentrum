import { MachinesNavbar } from './Machines/components/MachinesNavbar.jsx'
import { MachinesHeaderBar } from './Machines/components/MachinesHeaderBar.jsx'
import { MachinesFormCard } from './Machines/components/MachinesFormCard.jsx'
import { MachinesTypesGrid } from './Machines/components/MachinesTypesGrid.jsx'
import { MachinesGrid } from './Machines/components/MachinesGrid.jsx'
import { MachineDossier } from './Machines/components/MachineDossier.jsx'
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
    startMachineMaintenance,
    completeMachineMaintenance,
    formatElapsed,
    formatPlanned
  } = useMachinesData()

  return (
    <div className="machines-module-v3" style={{ background: 'var(--surface-inset)', minHeight: '100vh', color: 'var(--text-strong)', display: 'flex', flexDirection: 'column' }}>
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

      <MachineDossier
        selectedMachineId={selectedMachineId}
        setSelectedMachineId={setSelectedMachineId}
        selectedMachine={selectedMachine}
        activeCallsForMachine={activeCallsForMachine}
        currentUser={currentUser}
        supabase={supabase}
        maintenanceLogs={maintenanceLogs}
        orders={orders || []}
        tasks={tasks || []}
        workCards={workCards || []}
        nomenclatures={nomenclatures || []}
        calculateTotalTime={calculateTotalTime}
        handlePrintQR={handlePrintQR}
        getHistoryForMachine={getHistoryForMachine}
        startMachineMaintenance={startMachineMaintenance}
        completeMachineMaintenance={completeMachineMaintenance}
      />

      <MachinesQrScanModal
        isScanning={isScanning}
        setIsScanning={setIsScanning}
        scanError={scanError}
        setScanError={setScanError}
      />

      <style dangerouslySetInnerHTML={{ __html: `
        .stat-pill { background: #111; padding: 6px 15px; border-radius: 10px; font-size: 0.75rem; border: 1px solid var(--border-subtle); color: #555; font-weight: 800; }
        .input-group label { display: flex; align-items: center; gap: 8px; font-size: 0.65rem; color: #444; text-transform: uppercase; font-weight: 900; margin-bottom: 8px; }
        .input-group input { width: 100%; background: #000; border: 1px solid var(--border-subtle); color: #fff; padding: 15px; border-radius: 12px; font-size: 0.9rem; outline: none; transition: 0.2s; }
        .input-group input:focus, .input-group select:focus { border-color: #ff9000; background: #050505; }

        .machine-card-v3 {
          background: #0d0d0d; border: 1px solid #1c1c1c; border-radius: 28px; padding: 30px; 
          cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex; flex-direction: column; gap: 20px;
        }
        .machine-card-v3:hover { transform: translateY(-8px); border-color: #333; box-shadow: 0 30px 60px rgba(0,0,0,0.6); }
        
        .card-top { display: flex; justify-content: space-between; align-items: center; }
        .machine-icon-box { background: #111; width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; color: #ff9000; border: 1px solid var(--border-subtle); }
        
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
        .modal-content { background: #0a0a0a; border: 1px solid var(--border-subtle); border-radius: 32px; box-shadow: 0 50px 100px rgba(0,0,0,0.8); overflow: hidden; animation: zoomIn 0.3s; }
        .machine-detail-modal { width: 1000px; max-width: 95vw; }
        
        .modal-header { padding: 40px; display: flex; justify-content: space-between; align-items: center; background: #000; border-bottom: 1px solid #1a1a1a; }
        .modal-icon { width: 70px; height: 70px; background: #111; border-radius: 20px; display: flex; align-items: center; justify-content: center; color: #ff9000; border: 1px solid var(--border-subtle); }
        .btn-close { background: #111; border: none; color: #fff; width: 48px; height: 48px; border-radius: 14px; cursor: pointer; }
        
        .modal-body-split { display: grid; grid-template-columns: 300px 1fr; }
        .detail-sidebar { padding: 40px; background: #080808; border-right: 1px solid #1a1a1a; display: flex; flex-direction: column; gap: 30px; }
        .side-metric label { display: block; font-size: 0.65rem; font-weight: 1000; color: #333; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
        .side-metric span { font-size: 1.2rem; font-weight: 1000; color: #fff; }
        
        .detail-main { padding: 40px; }
        .history-table-wrapper { background: #050505; border-radius: 20px; border: 1px solid var(--border-subtle); overflow: hidden; }
        .history-table-wrapper table { width: 100%; border-collapse: collapse; text-align: left; }
        .history-table-wrapper th { padding: 15px 20px; font-size: 0.7rem; color: #333; text-transform: uppercase; font-weight: 1000; background: #000; }
        .history-table-wrapper td { padding: 15px 20px; border-bottom: 1px solid #111; font-size: 0.85rem; }

        .machine-dossier-overlay { position: fixed; inset: 0; z-index: 10050; background: rgba(0,0,0,.82); backdrop-filter: blur(10px); padding: 12px; display: flex; align-items: center; justify-content: center; }
        .machine-dossier { width: min(1480px, 100%); height: min(920px, calc(100dvh - 24px)); background: #090909; border: 1px solid #252525; border-radius: 24px; box-shadow: 0 32px 100px rgba(0,0,0,.75); display: flex; flex-direction: column; overflow: hidden; }
        .machine-dossier-header { flex: 0 0 auto; padding: 18px 22px; border-bottom: 1px solid #202020; background: #050505; display: flex; align-items: center; justify-content: space-between; gap: 18px; }
        .machine-title-block, .machine-header-actions, .machine-kpis > div, .machine-panel-title, .machine-maintenance-heading, .machine-history-toolbar { display: flex; align-items: center; }
        .machine-title-block { gap: 14px; min-width: 0; }
        .machine-dossier-icon { width: 48px; height: 48px; border-radius: 14px; display: grid; place-items: center; flex: 0 0 auto; background: rgba(255,144,0,.1); border: 1px solid rgba(255,144,0,.25); color: #ff9000; }
        .machine-eyebrow, .machine-section-label { color: #ff9000; font-size: .58rem; font-weight: 1000; letter-spacing: .14em; }
        .machine-title-block h2 { margin: 3px 0; font-size: clamp(1.2rem, 2vw, 1.75rem); line-height: 1; }
        .machine-title-block p { margin: 0; color: #737373; font-size: .72rem; font-weight: 750; }
        .machine-header-actions { gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        .machine-status-pill { border: 1px solid; border-radius: 999px; padding: 8px 11px; display: flex; align-items: center; gap: 7px; font-size: .68rem; font-weight: 950; text-transform: uppercase; white-space: nowrap; }
        .machine-status-pill span { width: 7px; height: 7px; border-radius: 50%; box-shadow: 0 0 10px currentColor; }
        .machine-action { min-height: 36px; border: 1px solid #292929; border-radius: 10px; padding: 8px 12px; color: #ddd; background: #121212; display: inline-flex; align-items: center; justify-content: center; gap: 7px; font-size: .68rem; font-weight: 950; cursor: pointer; }
        .machine-action:hover { border-color: #555; }
        .machine-action.maintenance { color: #111; background: #ff9000; border-color: #ff9000; }
        .machine-action.success { color: #04130c; background: #10b981; border-color: #10b981; }
        .machine-action:disabled { opacity: .5; cursor: not-allowed; }
        .machine-dossier-close { width: 38px; height: 38px; border: 1px solid #292929; border-radius: 11px; background: #151515; color: #aaa; display: grid; place-items: center; cursor: pointer; }
        .machine-kpis { flex: 0 0 auto; padding: 12px 22px; display: grid; grid-template-columns: repeat(5, minmax(130px, 1fr)); gap: 9px; border-bottom: 1px solid #1b1b1b; }
        .machine-kpis > div { gap: 10px; background: #101010; border: 1px solid #202020; border-radius: 12px; padding: 10px 12px; color: #666; }
        .machine-kpis span { display: flex; flex-direction: column; gap: 3px; font-size: .56rem; text-transform: uppercase; font-weight: 900; }
        .machine-kpis strong { color: #f1f1f1; font-size: .84rem; text-transform: none; }
        .machine-dossier-error { margin: 10px 22px 0; padding: 10px 12px; color: #fca5a5; background: rgba(239,68,68,.08); border: 1px solid rgba(239,68,68,.25); border-radius: 10px; font-size: .75rem; font-weight: 800; }
        .machine-dossier-notice { margin: 10px 22px 0; padding: 10px 12px; color: #6ee7b7; background: rgba(16,185,129,.08); border: 1px solid rgba(16,185,129,.25); border-radius: 10px; font-size: .75rem; font-weight: 800; }
        .machine-maintenance-form { flex: 0 0 auto; margin: 12px 22px 0; padding: 14px; border: 1px solid rgba(255,144,0,.3); background: rgba(255,144,0,.05); border-radius: 14px; display: grid; grid-template-columns: 1.1fr repeat(2, minmax(180px, .8fr)) minmax(190px, 1fr) auto; gap: 10px; align-items: end; }
        .machine-maintenance-form h3 { margin: 4px 0 0; font-size: .95rem; }
        .machine-maintenance-form label { color: #777; font-size: .58rem; font-weight: 900; text-transform: uppercase; }
        .machine-maintenance-form select, .machine-maintenance-form input { width: 100%; height: 38px; margin-top: 5px; padding: 0 10px; border-radius: 9px; background: #080808; border: 1px solid #292929; color: #eee; outline: none; }
        .machine-dossier-tabs { flex: 0 0 auto; display: flex; gap: 6px; padding: 12px 22px 0; border-bottom: 1px solid #1b1b1b; }
        .machine-dossier-tabs button { border: 0; border-bottom: 2px solid transparent; background: transparent; color: #666; padding: 9px 12px 11px; font-size: .7rem; font-weight: 950; cursor: pointer; }
        .machine-dossier-tabs button.active { color: #ff9000; border-bottom-color: #ff9000; }
        .machine-dossier-tabs span { background: #202020; color: #aaa; padding: 2px 6px; border-radius: 999px; margin-left: 4px; }
        .machine-dossier-content { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 14px 22px 22px; }
        .machine-overview-grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(260px, .75fr); gap: 12px; }
        .machine-panel { background: #0d0d0d; border: 1px solid #202020; border-radius: 14px; padding: 14px; min-width: 0; }
        .machine-panel-title { gap: 8px; color: #eee; font-size: .76rem; font-weight: 1000; text-transform: uppercase; margin-bottom: 12px; }
        .machine-panel-title.danger { color: #ef4444; }
        .machine-info-panel { grid-row: span 2; }
        .machine-info-panel dl { margin: 0; }
        .machine-info-panel dl div { display: flex; justify-content: space-between; gap: 14px; padding: 10px 0; border-bottom: 1px solid #1d1d1d; }
        .machine-info-panel dt { color: #666; font-size: .65rem; font-weight: 850; }
        .machine-info-panel dd { margin: 0; text-align: right; color: #eee; font-size: .72rem; font-weight: 900; }
        .machine-info-panel p { color: #777; line-height: 1.5; font-size: .72rem; }
        .recent-cards, .machine-calls-panel { grid-column: 1; }
        .machine-call-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 0; border-top: 1px solid #1d1d1d; }
        .machine-call-row div { display: flex; flex-direction: column; gap: 3px; }
        .machine-call-row strong { color: #fca5a5; font-size: .72rem; }
        .machine-call-row small, .machine-history-toolbar small, .machine-maintenance-heading small { color: #666; font-size: .63rem; }
        .machine-call-row button { border: 0; border-radius: 8px; background: #10b981; color: #04130c; padding: 7px 10px; font-size: .62rem; font-weight: 950; cursor: pointer; }
        .machine-empty-state { min-height: 100px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #10b981; font-size: .76rem; font-weight: 900; }
        .machine-dossier-table-wrap { width: 100%; overflow: auto; border: 1px solid #1d1d1d; border-radius: 11px; }
        .machine-dossier-table { width: 100%; border-collapse: collapse; min-width: 780px; }
        .machine-dossier-table th { position: sticky; top: 0; z-index: 1; background: #080808; color: #555; text-align: left; padding: 9px 10px; font-size: .56rem; text-transform: uppercase; }
        .machine-dossier-table td { border-top: 1px solid #181818; padding: 9px 10px; color: #aaa; font-size: .68rem; vertical-align: middle; }
        .machine-dossier-table td small { display: block; color: #555; margin-top: 3px; }
        .machine-dossier-table .num { text-align: right; }
        .machine-dossier-table .strong { color: #eee; font-weight: 900; }
        .machine-dossier-table .accent { color: #ff9000; font-weight: 900; }
        .machine-dossier-table .danger { color: #ef4444; font-weight: 900; }
        .machine-detail-name { color: #eee !important; font-weight: 850; max-width: 260px; }
        .machine-row-state { display: block; font-weight: 950; text-transform: uppercase; font-size: .56rem; }
        .machine-operators-cell div { display: flex; align-items: center; gap: 6px; margin: 3px 0; color: #ddd; font-weight: 800; white-space: nowrap; }
        .machine-operators-cell div span { width: 17px; height: 17px; border-radius: 50%; display: inline-grid; place-items: center; background: #242424; color: #ff9000; font-size: .52rem; }
        .machine-operators-cell em { color: #555; font-style: normal; }
        .machine-empty { text-align: center; padding: 32px !important; color: #555 !important; }
        .machine-history-toolbar, .machine-maintenance-heading { justify-content: space-between; gap: 16px; margin-bottom: 12px; }
        .machine-history-toolbar .machine-panel-title, .machine-maintenance-heading .machine-panel-title { margin-bottom: 3px; }
        .machine-history-toolbar label { min-width: 300px; display: flex; align-items: center; gap: 8px; padding: 0 10px; height: 38px; border: 1px solid #252525; border-radius: 10px; color: #555; }
        .machine-history-toolbar input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: #eee; }
        .machine-pagination { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 12px; padding: 10px 2px 0; color: #666; font-size: .66rem; font-weight: 800; }
        .machine-pagination-summary, .machine-pagination-pages, .machine-page-slot { display: flex; align-items: center; gap: 7px; }
        .machine-pagination-summary select { height: 30px; border: 1px solid #292929; border-radius: 8px; background: #0a0a0a; color: #aaa; padding: 0 8px; font-size: .64rem; font-weight: 800; }
        .machine-pagination-pages button { min-width: 30px; height: 30px; border: 1px solid #292929; border-radius: 8px; background: #111; color: #888; display: grid; place-items: center; cursor: pointer; font-weight: 900; }
        .machine-pagination-pages button.active { color: #111; border-color: #ff9000; background: #ff9000; }
        .machine-pagination-pages button:disabled { opacity: .35; cursor: not-allowed; }
        .machine-page-slot i { color: #555; font-style: normal; }

        @media (max-width: 900px) {
          .machine-dossier-overlay { padding: 0; }
          .machine-dossier { height: 100dvh; width: 100%; border-radius: 0; border: 0; }
          .machine-dossier-header { align-items: flex-start; padding: 14px; }
          .machine-header-actions { max-width: 46%; }
          .machine-status-pill { width: 100%; justify-content: center; }
          .machine-action.secondary { display: none; }
          .machine-kpis { grid-template-columns: repeat(2, 1fr); padding: 10px 14px; }
          .machine-kpis > div:last-child { grid-column: span 2; }
          .machine-maintenance-form { margin: 10px 14px 0; grid-template-columns: 1fr; max-height: 45dvh; overflow: auto; }
          .machine-dossier-tabs { padding-left: 14px; }
          .machine-dossier-content { padding: 12px 14px 18px; }
          .machine-overview-grid { grid-template-columns: 1fr; }
          .machine-info-panel, .recent-cards, .machine-calls-panel { grid-column: 1; grid-row: auto; }
          .machine-history-toolbar, .machine-maintenance-heading { align-items: stretch; flex-direction: column; }
          .machine-history-toolbar label { min-width: 0; width: 100%; }
          .machine-pagination { align-items: stretch; flex-direction: column; }
          .machine-pagination-pages { justify-content: center; flex-wrap: wrap; }
        }

        @media (max-width: 560px) {
          .machine-title-block p, .machine-dossier-icon { display: none; }
          .machine-title-block h2 { font-size: 1rem; }
          .machine-header-actions { max-width: 58%; }
          .machine-action.maintenance { padding: 7px 9px; font-size: .58rem; }
          .machine-kpis { display: flex; overflow-x: auto; }
          .machine-kpis > div { min-width: 145px; }
          .machine-dossier-tabs { overflow-x: auto; }
          .machine-dossier-tabs button { white-space: nowrap; }
        }
        
        @keyframes pulseRed { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
        @keyframes zoomIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes slideDown { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .anim-slide-down { animation: slideDown 0.3s ease-out; }
      `}} />
    </div>
  )
}

export default MachinesModule
