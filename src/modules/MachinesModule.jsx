import { MachinesNavbar } from './Machines/components/MachinesNavbar.jsx'
import { MachinesHeaderBar } from './Machines/components/MachinesHeaderBar.jsx'
import { MachinesFormCard } from './Machines/components/MachinesFormCard.jsx'
import { MachinesTypesGrid } from './Machines/components/MachinesTypesGrid.jsx'
import { MachinesGrid } from './Machines/components/MachinesGrid.jsx'
import { MachineDossier } from './Machines/components/MachineDossier.jsx'
import { MachinesQrScanModal } from './Machines/components/modals/MachinesQrScanModal.jsx'
import { MachinesGlobalMaintenanceModal } from './Machines/components/modals/MachinesGlobalMaintenanceModal.jsx'
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
    showGlobalMaintenance,
    setShowGlobalMaintenance,
    globalMaintenanceLogs,
    loadingGlobalLogs,
    fetchGlobalMaintenanceLogs,
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
            onOpenGlobalMaintenance={() => setShowGlobalMaintenance(true)}
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
        fetchData={fetchData}
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

      <MachinesGlobalMaintenanceModal
        isOpen={showGlobalMaintenance}
        onClose={() => setShowGlobalMaintenance(false)}
        logs={globalMaintenanceLogs}
        machines={machines}
        loading={loadingGlobalLogs}
        onRefresh={fetchGlobalMaintenanceLogs}
        onSelectMachine={setSelectedMachineId}
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

        .machine-dossier-overlay { position: fixed; inset: 0; z-index: 100050 !important; background: rgba(0,0,0,.82); backdrop-filter: blur(10px); padding: 12px; display: flex; align-items: center; justify-content: center; }
        .machine-dossier { width: min(1480px, 100%); height: min(920px, calc(100dvh - 24px)); background: #090909; border: 1px solid #252525; border-radius: 24px; box-shadow: 0 32px 100px rgba(0,0,0,.75); display: flex; flex-direction: column; overflow: hidden; }
        .machine-dossier-header { flex: 0 0 auto; padding: 16px 22px; border-bottom: 1px solid #202020; background: #050505; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .machine-header-main { display: flex; align-items: center; gap: 14px; min-width: 0; flex: 1; }
        .machine-title-info { min-width: 0; display: flex; flex-direction: column; }
        .machine-title-block, .machine-header-actions, .machine-kpis > div, .machine-panel-title, .machine-maintenance-heading, .machine-history-toolbar { display: flex; align-items: center; }
        .machine-title-block { gap: 14px; min-width: 0; width: 100%; }
        .machine-dossier-icon { width: 48px; height: 48px; border-radius: 14px; display: grid; place-items: center; flex: 0 0 auto; background: rgba(255,144,0,.1); border: 1px solid rgba(255,144,0,.25); color: #ff9000; }
        .machine-eyebrow, .machine-section-label { color: #ff9000; font-size: .62rem; font-weight: 1000; letter-spacing: .12em; }
        .machine-title-block h2 { margin: 2px 0 4px 0; font-size: clamp(1.25rem, 2.2vw, 1.8rem); line-height: 1.15; font-weight: 950; color: #fff; }
        .machine-meta-chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
        .machine-chip { display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 6px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); font-size: 0.68rem; font-weight: 850; color: #ccc; }
        .machine-chip.accent { background: rgba(255,144,0,0.15); border-color: rgba(255,144,0,0.4); color: #ff9000; font-weight: 950; }
        .machine-title-block p { margin: 0; color: #737373; font-size: .72rem; font-weight: 750; }
        .machine-header-actions { gap: 8px; flex-wrap: wrap; justify-content: flex-end; align-items: center; }
        .machine-status-pill { border: 1px solid; border-radius: 999px; padding: 7px 12px; display: flex; align-items: center; gap: 7px; font-size: .68rem; font-weight: 950; text-transform: uppercase; white-space: nowrap; }
        .machine-status-pill span { width: 7px; height: 7px; border-radius: 50%; box-shadow: 0 0 10px currentColor; }
        .machine-action { min-height: 36px; border: 1px solid #292929; border-radius: 10px; padding: 8px 12px; color: #ddd; background: #121212; display: inline-flex; align-items: center; justify-content: center; gap: 7px; font-size: .68rem; font-weight: 950; cursor: pointer; }
        .machine-action:hover { border-color: #555; }
        .machine-action.maintenance { color: #111; background: #ff9000; border-color: #ff9000; }
        .machine-action.success { color: #04130c; background: #10b981; border-color: #10b981; }
        .machine-action:disabled { opacity: .5; cursor: not-allowed; }
        .machine-dossier-close { width: 38px; height: 38px; border: 1px solid #292929; border-radius: 11px; background: #151515; color: #aaa; display: grid; place-items: center; cursor: pointer; transition: 0.2s; }
        .machine-dossier-close:hover { color: #fff; border-color: #666; background: #252525; }
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
          .machine-dossier-overlay { padding: 0 !important; z-index: 100050 !important; }
          .machine-dossier { height: 100dvh; width: 100%; border-radius: 0; border: 0; }
          .machine-dossier-header { flex-direction: column; align-items: stretch; padding: 14px 16px; gap: 12px; }
          .machine-header-main { width: 100%; justify-content: space-between; }
          .machine-header-actions { width: 100%; justify-content: space-between; flex-direction: row; }
          .machine-status-pill { flex: 1; justify-content: center; }
          .machine-action.secondary { display: inline-flex; }
          .machine-kpis { grid-template-columns: repeat(2, 1fr); padding: 10px 14px; }
          .machine-kpis > div:last-child { grid-column: span 2; }
          .machine-dossier-tabs { padding-left: 14px; }
          .machine-dossier-content { padding: 12px 14px 18px; }
          .machine-overview-grid { grid-template-columns: 1fr; }
          .machine-info-panel, .recent-cards, .machine-calls-panel { grid-column: 1; grid-row: auto; }
          .machine-history-toolbar, .machine-maintenance-heading { align-items: stretch; flex-direction: column; }
          .machine-history-toolbar label { min-width: 0; width: 100%; }
          .machine-pagination { align-items: stretch; flex-direction: column; }
          .machine-pagination-pages { justify-content: center; flex-wrap: wrap; }
          .machine-call-cards-grid { grid-template-columns: 1fr !important; }
        }

        @media (max-width: 560px) {
          .machine-title-block { gap: 10px; }
          .machine-dossier-icon { width: 40px; height: 40px; }
          .machine-title-block h2 { font-size: 1.15rem; }
          .machine-chip { font-size: 0.62rem; padding: 2px 6px; }
          .machine-kpis { display: flex; overflow-x: auto; }
          .machine-kpis > div { min-width: 140px; }
          .machine-dossier-tabs { overflow-x: auto; }
          .machine-dossier-tabs button { white-space: nowrap; }
          .hide-on-mobile { display: none; }
        }
        
        @keyframes pulseRed { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
        @keyframes zoomIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes slideDown { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .anim-slide-down { animation: slideDown 0.3s ease-out; }

        /* ── MAINTENANCE ACTION PANEL (ABOVE QUICK CALLS) ── */
        .machine-maintenance-action-panel {
          grid-column: 1 / -1;
          background: #0d0d0d;
          border: 1px solid #202020;
          border-radius: 14px;
          padding: 16px 18px;
          margin-bottom: 2px;
        }
        .machine-maintenance-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 12px;
          padding-bottom: 10px;
          border-bottom: 1px solid #1a1a1a;
        }
        .machine-maintenance-status-badge {
          display: inline-flex;
          align-items: center;
          padding: 5px 12px;
          border-radius: 999px;
          font-size: 0.7rem;
          font-weight: 950;
          letter-spacing: 0.04em;
        }
        .machine-maintenance-status-badge.is-idle {
          color: #10b981;
          background: rgba(16,185,129,0.1);
          border: 1px solid rgba(16,185,129,0.3);
        }
        .machine-maintenance-status-badge.is-busy {
          color: #ef4444;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.3);
          animation: pulseRed 2s infinite;
        }
        .machine-maintenance-active-banner {
          background: rgba(239,68,68,0.06);
          border: 1.5px solid rgba(239,68,68,0.25);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .machine-maintenance-active-desc strong {
          color: #ef4444;
          font-size: 0.95rem;
          display: block;
          margin-bottom: 4px;
        }
        .machine-maintenance-active-desc p {
          margin: 0;
          color: #aaa;
          font-size: 0.82rem;
          line-height: 1.45;
        }
        .machine-maintenance-idle-box {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .machine-maintenance-meta-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
          color: #888;
          font-size: 0.78rem;
          font-weight: 750;
        }
        .machine-maintenance-meta-item strong {
          color: #eee;
        }
        .machine-link-btn {
          background: none;
          border: none;
          color: #ff9000;
          cursor: pointer;
          font-size: 0.75rem;
          font-weight: 900;
          padding: 4px 6px;
        }
        .machine-link-btn:hover {
          text-decoration: underline;
        }
        .full-width-action-btn {
          width: 100%;
          min-height: 48px;
          font-size: 0.92rem !important;
          font-weight: 950 !important;
          border-radius: 12px !important;
          letter-spacing: 0.03em;
        }
        .machine-maintenance-inline-form {
          background: rgba(255,144,0,0.04);
          border: 1px solid rgba(255,144,0,0.25);
          border-radius: 12px;
          padding: 16px;
          margin-top: 6px;
        }
        .machine-form-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .machine-close-inline-btn {
          background: none;
          border: none;
          color: #888;
          cursor: pointer;
          padding: 4px;
        }
        .machine-close-inline-btn:hover {
          color: #eee;
        }
        .machine-form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
          align-items: end;
        }
        .machine-form-grid label {
          display: flex;
          flex-direction: column;
          gap: 5px;
          font-size: 0.68rem;
          font-weight: 900;
          text-transform: uppercase;
          color: #888;
        }
        .machine-form-grid select, .machine-form-grid input {
          width: 100%;
          height: 40px;
          padding: 0 12px;
          border-radius: 10px;
          background: #080808;
          border: 1px solid #282828;
          color: #eee;
          font-size: 0.85rem;
          outline: none;
          box-sizing: border-box;
        }
        .machine-form-grid select:focus, .machine-form-grid input:focus {
          border-color: #ff9000;
        }
        .machine-form-full-width {
          grid-column: 1 / -1;
        }
        .machine-form-footer {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 14px;
          flex-wrap: wrap;
        }

        /* ── 3 QUICK CALL BUTTONS PANEL & CARDS ── */
        .machine-quick-calls-panel {
          grid-column: 1 / -1;
          background: #0d0d0d;
          border: 1px solid #202020;
          border-radius: 14px;
          padding: 14px 18px;
        }
        .machine-quick-calls-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 12px;
          padding-bottom: 10px;
          border-bottom: 1px solid #1a1a1a;
        }
        .machine-quick-calls-header .machine-panel-title {
          margin-bottom: 0;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: .8rem;
          font-weight: 1000;
          letter-spacing: .03em;
        }
        .machine-quick-calls-operator {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: .72rem;
          color: #888;
          font-weight: 800;
        }
        .machine-quick-calls-operator input {
          background: #050505;
          border: 1px solid #282828;
          border-radius: 8px;
          padding: 5px 10px;
          font-size: .75rem;
          color: #eee;
          outline: none;
          min-width: 150px;
          transition: border-color 0.2s;
        }
        .machine-quick-calls-operator input:focus {
          border-color: #ff9000;
        }
        .machine-call-cards-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        .machine-call-card {
          background: #080808;
          border: 1px solid #222;
          border-radius: 12px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition: all 0.25s ease;
        }
        .machine-call-card.master { border-left: 3px solid #ff9000; }
        .machine-call-card.engineer { border-left: 3px solid #8b5cf6; }
        .machine-call-card.quality { border-left: 3px solid #ef4444; }

        .machine-call-card.master.is-active {
          border-color: #ff9000;
          background: rgba(255, 144, 0, 0.05);
          box-shadow: 0 0 16px rgba(255, 144, 0, 0.15);
        }
        .machine-call-card.engineer.is-active {
          border-color: #8b5cf6;
          background: rgba(139, 92, 246, 0.05);
          box-shadow: 0 0 16px rgba(139, 92, 246, 0.15);
        }
        .machine-call-card.quality.is-active {
          border-color: #ef4444;
          background: rgba(239, 68, 68, 0.05);
          box-shadow: 0 0 16px rgba(239, 68, 68, 0.15);
        }

        .call-card-header {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .call-card-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }
        .call-card-icon.master { background: rgba(255, 144, 0, 0.12); color: #ff9000; border: 1px solid rgba(255, 144, 0, 0.25); }
        .call-card-icon.engineer { background: rgba(139, 92, 246, 0.12); color: #8b5cf6; border: 1px solid rgba(139, 92, 246, 0.25); }
        .call-card-icon.quality { background: rgba(239, 68, 68, 0.12); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.25); }

        .call-card-meta {
          flex: 1;
          min-width: 0;
        }
        .call-card-title {
          font-size: .88rem;
          font-weight: 1000;
          letter-spacing: .04em;
          color: #eee;
        }
        .call-card-sub {
          font-size: .65rem;
          color: #777;
          font-weight: 700;
          margin-top: 1px;
        }

        .call-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: .62rem;
          font-weight: 1000;
          letter-spacing: .04em;
        }
        .call-badge.active-master { background: rgba(255, 144, 0, 0.15); color: #ff9000; border: 1px solid rgba(255, 144, 0, 0.4); }
        .call-badge.active-engineer { background: rgba(139, 92, 246, 0.15); color: #8b5cf6; border: 1px solid rgba(139, 92, 246, 0.4); }
        .call-badge.active-quality { background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.4); }

        .pulse-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
          animation: pulseRed 1.2s infinite ease-in-out;
        }

        .call-card-active-info {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 8px 10px;
          background: rgba(0, 0, 0, 0.35);
          border-radius: 8px;
          border: 1px solid #1e1e1e;
        }
        .call-active-time {
          font-size: .66rem;
          color: #888;
        }
        .call-active-by {
          font-size: .68rem;
          color: #ddd;
        }
        .call-active-by strong {
          color: #fff;
        }
        .call-resolve-btn {
          margin-top: 4px;
          border: 0;
          border-radius: 8px;
          background: #10b981;
          color: #04130c;
          padding: 8px 12px;
          font-size: .72rem;
          font-weight: 1000;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.2s;
        }
        .call-resolve-btn:hover {
          background: #34d399;
          transform: translateY(-1px);
        }

        .call-card-action-block {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .call-select {
          width: 100%;
          background: #050505;
          border: 1px solid #282828;
          border-radius: 8px;
          padding: 7px 10px;
          font-size: .72rem;
          color: #ddd;
          outline: none;
          transition: border-color 0.2s;
        }
        .call-select:focus {
          border-color: #ff9000;
        }
        .call-trigger-btn {
          width: 100%;
          border: 0;
          border-radius: 8px;
          padding: 9px 12px;
          font-size: .74rem;
          font-weight: 1000;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          transition: all 0.2s;
          text-transform: uppercase;
          letter-spacing: .02em;
        }
        .call-trigger-btn.master {
          background: #ff9000;
          color: #000;
          box-shadow: 0 2px 8px rgba(255, 144, 0, 0.2);
        }
        .call-trigger-btn.master:hover:not(:disabled) {
          background: #ffa726;
          box-shadow: 0 4px 14px rgba(255, 144, 0, 0.35);
          transform: translateY(-1px);
        }
        .call-trigger-btn.engineer {
          background: #8b5cf6;
          color: #fff;
          box-shadow: 0 2px 8px rgba(139, 92, 246, 0.2);
        }
        .call-trigger-btn.engineer:hover:not(:disabled) {
          background: #a78bfa;
          box-shadow: 0 4px 14px rgba(139, 92, 246, 0.35);
          transform: translateY(-1px);
        }
        .call-trigger-btn.quality {
          background: #ef4444;
          color: #fff;
          box-shadow: 0 2px 8px rgba(239, 68, 68, 0.2);
        }
        .call-trigger-btn.quality:hover:not(:disabled) {
          background: #f87171;
          box-shadow: 0 4px 14px rgba(239, 68, 68, 0.35);
          transform: translateY(-1px);
        }
        .call-trigger-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @media (max-width: 900px) {
          .machine-call-cards-grid {
            grid-template-columns: 1fr;
          }
          .machine-quick-calls-header {
            flex-direction: column;
            align-items: stretch;
          }
          .machine-quick-calls-operator {
            justify-content: space-between;
          }
        }

        /* ── LIGHT THEME ADAPTATION FOR MACHINE DOSSIER & CALLS ── */
        .light-theme .machine-dossier-overlay,
        body.light-theme .machine-dossier-overlay {
          background: rgba(15, 23, 42, 0.45) !important;
          backdrop-filter: blur(8px) !important;
        }

        .light-theme .machine-dossier,
        body.light-theme .machine-dossier {
          background: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          box-shadow: 0 25px 70px rgba(15, 23, 42, 0.18) !important;
          color: #0f172a !important;
        }

        .light-theme .machine-dossier-header,
        body.light-theme .machine-dossier-header {
          background: #f8fafc !important;
          border-bottom: 1px solid #e2e8f0 !important;
        }

        .light-theme .machine-title-block h2,
        body.light-theme .machine-title-block h2 {
          color: #0f172a !important;
        }

        .light-theme .machine-title-block p,
        body.light-theme .machine-title-block p {
          color: #64748b !important;
        }

        .light-theme .machine-action,
        body.light-theme .machine-action {
          background: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          color: #334155 !important;
        }

        .light-theme .machine-action:hover,
        body.light-theme .machine-action:hover {
          background: #f1f5f9 !important;
          border-color: #94a3b8 !important;
          color: #0f172a !important;
        }

        .light-theme .machine-action.maintenance,
        body.light-theme .machine-action.maintenance {
          background: #ff9000 !important;
          color: #000000 !important;
          border-color: #ff9000 !important;
        }

        .light-theme .machine-action.secondary,
        body.light-theme .machine-action.secondary {
          background: #f1f5f9 !important;
          border: 1px solid #cbd5e1 !important;
          color: #0f172a !important;
        }

        .light-theme .machine-dossier-close,
        body.light-theme .machine-dossier-close {
          background: #f1f5f9 !important;
          border: 1px solid #cbd5e1 !important;
          color: #475569 !important;
        }

        .light-theme .machine-dossier-close:hover,
        body.light-theme .machine-dossier-close:hover {
          background: #e2e8f0 !important;
          color: #0f172a !important;
        }

        .light-theme .machine-kpis,
        body.light-theme .machine-kpis {
          background: #f8fafc !important;
          border-bottom: 1px solid #e2e8f0 !important;
        }

        .light-theme .machine-kpis > div,
        body.light-theme .machine-kpis > div {
          background: #ffffff !important;
          border: 1px solid #e2e8f0 !important;
          color: #64748b !important;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05) !important;
        }

        .light-theme .machine-kpis strong,
        body.light-theme .machine-kpis strong {
          color: #0f172a !important;
        }

        .light-theme .machine-dossier-tabs,
        body.light-theme .machine-dossier-tabs {
          background: #f8fafc !important;
          border-bottom: 1px solid #e2e8f0 !important;
        }

        .light-theme .machine-dossier-tabs button,
        body.light-theme .machine-dossier-tabs button {
          color: #64748b !important;
        }

        .light-theme .machine-dossier-tabs button.active,
        body.light-theme .machine-dossier-tabs button.active {
          color: #ea580c !important;
          border-bottom-color: #ea580c !important;
        }

        .light-theme .machine-dossier-tabs span,
        body.light-theme .machine-dossier-tabs span {
          background: #e2e8f0 !important;
          color: #334155 !important;
        }

        .light-theme .machine-dossier-content,
        body.light-theme .machine-dossier-content {
          background: #f8fafc !important;
        }

        .light-theme .machine-panel,
        body.light-theme .machine-panel {
          background: #ffffff !important;
          border: 1px solid #e2e8f0 !important;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04) !important;
        }

        .light-theme .machine-panel-title,
        body.light-theme .machine-panel-title {
          color: #0f172a !important;
        }

        .light-theme .machine-chip,
        body.light-theme .machine-chip {
          background: #f1f5f9 !important;
          border: 1px solid #cbd5e1 !important;
          color: #334155 !important;
        }

        .light-theme .machine-chip.accent,
        body.light-theme .machine-chip.accent {
          background: rgba(255, 144, 0, 0.15) !important;
          border-color: #f59e0b !important;
          color: #b45309 !important;
        }

        .light-theme .machine-maintenance-action-panel,
        body.light-theme .machine-maintenance-action-panel {
          background: #ffffff !important;
          border: 1px solid #e2e8f0 !important;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04) !important;
        }

        .light-theme .machine-maintenance-panel-header,
        body.light-theme .machine-maintenance-panel-header {
          border-bottom: 1px solid #f1f5f9 !important;
        }

        .light-theme .machine-maintenance-active-desc strong,
        body.light-theme .machine-maintenance-active-desc strong {
          color: #dc2626 !important;
        }

        .light-theme .machine-maintenance-active-desc p,
        body.light-theme .machine-maintenance-active-desc p {
          color: #64748b !important;
        }

        .light-theme .machine-maintenance-meta-row,
        body.light-theme .machine-maintenance-meta-row {
          color: #64748b !important;
        }

        .light-theme .machine-maintenance-meta-item strong,
        body.light-theme .machine-maintenance-meta-item strong {
          color: #0f172a !important;
        }

        .light-theme .machine-maintenance-inline-form,
        body.light-theme .machine-maintenance-inline-form {
          background: #fffbeb !important;
          border: 1px solid #fef08a !important;
        }

        .light-theme .machine-close-inline-btn,
        body.light-theme .machine-close-inline-btn {
          color: #64748b !important;
        }

        .light-theme .machine-form-grid label,
        body.light-theme .machine-form-grid label {
          color: #475569 !important;
        }

        .light-theme .machine-form-grid select,
        body.light-theme .machine-form-grid select,
        .light-theme .machine-form-grid input,
        body.light-theme .machine-form-grid input {
          background: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          color: #0f172a !important;
        }

        .light-theme .machine-quick-calls-panel,
        body.light-theme .machine-quick-calls-panel {
          background: #ffffff !important;
          border: 1px solid #e2e8f0 !important;
        }

        .light-theme .machine-quick-calls-header,
        body.light-theme .machine-quick-calls-header {
          border-bottom: 1px solid #f1f5f9 !important;
        }

        .light-theme .machine-quick-calls-operator,
        body.light-theme .machine-quick-calls-operator {
          color: #475569 !important;
        }

        .light-theme .machine-quick-calls-operator input,
        body.light-theme .machine-quick-calls-operator input {
          background: #f8fafc !important;
          border: 1px solid #cbd5e1 !important;
          color: #0f172a !important;
        }

        .light-theme .machine-quick-calls-operator input:focus,
        body.light-theme .machine-quick-calls-operator input:focus {
          border-color: #ea580c !important;
          background: #ffffff !important;
        }

        .light-theme .machine-call-card,
        body.light-theme .machine-call-card {
          background: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
        }

        .light-theme .machine-call-card.master,
        body.light-theme .machine-call-card.master {
          border-left: 3px solid #ea580c !important;
        }

        .light-theme .machine-call-card.engineer,
        body.light-theme .machine-call-card.engineer {
          border-left: 3px solid #8b5cf6 !important;
        }

        .light-theme .machine-call-card.quality,
        body.light-theme .machine-call-card.quality {
          border-left: 3px solid #ef4444 !important;
        }

        .light-theme .machine-call-card.master.is-active,
        body.light-theme .machine-call-card.master.is-active {
          background: #fff7ed !important;
          border-color: #fdba74 !important;
          box-shadow: 0 4px 14px rgba(249, 115, 22, 0.12) !important;
        }

        .light-theme .machine-call-card.engineer.is-active,
        body.light-theme .machine-call-card.engineer.is-active {
          background: #f5f3ff !important;
          border-color: #c4b5fd !important;
          box-shadow: 0 4px 14px rgba(139, 92, 246, 0.12) !important;
        }

        .light-theme .machine-call-card.quality.is-active,
        body.light-theme .machine-call-card.quality.is-active {
          background: #fef2f2 !important;
          border-color: #fca5a5 !important;
          box-shadow: 0 4px 14px rgba(239, 68, 68, 0.12) !important;
        }

        .light-theme .call-card-title,
        body.light-theme .call-card-title {
          color: #0f172a !important;
        }

        .light-theme .call-card-sub,
        body.light-theme .call-card-sub {
          color: #64748b !important;
        }

        .light-theme .call-select,
        body.light-theme .call-select {
          background: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          color: #0f172a !important;
        }

        .light-theme .call-select:focus,
        body.light-theme .call-select:focus {
          border-color: #ea580c !important;
        }

        .light-theme .call-card-active-info,
        body.light-theme .call-card-active-info {
          background: #ffffff !important;
          border: 1px solid #e2e8f0 !important;
        }

        .light-theme .call-active-time,
        body.light-theme .call-active-time {
          color: #64748b !important;
        }

        .light-theme .call-active-by,
        body.light-theme .call-active-by {
          color: #334155 !important;
        }

        .light-theme .call-active-by strong,
        body.light-theme .call-active-by strong {
          color: #0f172a !important;
        }

        .light-theme .machine-info-panel dl div,
        body.light-theme .machine-info-panel dl div {
          border-bottom: 1px solid #f1f5f9 !important;
        }

        .light-theme .machine-info-panel dt,
        body.light-theme .machine-info-panel dt {
          color: #64748b !important;
        }

        .light-theme .machine-info-panel dd,
        body.light-theme .machine-info-panel dd {
          color: #0f172a !important;
        }

        .light-theme .machine-info-panel p,
        body.light-theme .machine-info-panel p {
          color: #64748b !important;
        }

        .light-theme .machine-maintenance-form,
        body.light-theme .machine-maintenance-form {
          background: #fff7ed !important;
          border: 1px solid #fed7aa !important;
        }

        .light-theme .machine-maintenance-form h3,
        body.light-theme .machine-maintenance-form h3 {
          color: #0f172a !important;
        }

        .light-theme .machine-maintenance-form label,
        body.light-theme .machine-maintenance-form label {
          color: #64748b !important;
        }

        .light-theme .machine-maintenance-form select,
        .light-theme .machine-maintenance-form input,
        body.light-theme .machine-maintenance-form select,
        body.light-theme .machine-maintenance-form input {
          background: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          color: #0f172a !important;
        }

        .light-theme .machine-dossier-table-wrap,
        body.light-theme .machine-dossier-table-wrap {
          background: #ffffff !important;
          border: 1px solid #e2e8f0 !important;
        }

        .light-theme .machine-dossier-table th,
        body.light-theme .machine-dossier-table th {
          background: #f8fafc !important;
          color: #475569 !important;
          border-bottom: 1px solid #e2e8f0 !important;
        }

        .light-theme .machine-dossier-table td,
        body.light-theme .machine-dossier-table td {
          background: #ffffff !important;
          color: #334155 !important;
          border-top: 1px solid #f1f5f9 !important;
        }

        .light-theme .machine-dossier-table td small,
        body.light-theme .machine-dossier-table td small {
          color: #94a3b8 !important;
        }

        .light-theme .machine-dossier-table .strong,
        body.light-theme .machine-dossier-table .strong {
          color: #0f172a !important;
        }

        .light-theme .machine-detail-name,
        body.light-theme .machine-detail-name {
          color: #0f172a !important;
        }

        .light-theme .machine-operators-cell div,
        body.light-theme .machine-operators-cell div {
          color: #1e293b !important;
        }

        .light-theme .machine-operators-cell div span,
        body.light-theme .machine-operators-cell div span {
          background: #f1f5f9 !important;
          color: #ea580c !important;
        }

        .light-theme .machine-operators-cell em,
        body.light-theme .machine-operators-cell em {
          color: #94a3b8 !important;
        }

        .light-theme .machine-empty,
        body.light-theme .machine-empty {
          color: #94a3b8 !important;
        }

        .light-theme .machine-history-toolbar label,
        body.light-theme .machine-history-toolbar label {
          background: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          color: #64748b !important;
        }

        .light-theme .machine-history-toolbar input,
        body.light-theme .machine-history-toolbar input {
          color: #0f172a !important;
        }

        .light-theme .machine-pagination,
        body.light-theme .machine-pagination {
          color: #64748b !important;
        }

        .light-theme .machine-pagination-summary select,
        body.light-theme .machine-pagination-summary select {
          background: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          color: #0f172a !important;
        }

        .light-theme .machine-pagination-pages button,
        body.light-theme .machine-pagination-pages button {
          background: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          color: #334155 !important;
        }

        .light-theme .machine-pagination-pages button.active,
        body.light-theme .machine-pagination-pages button.active {
          background: #ff9000 !important;
          color: #000000 !important;
          border-color: #ff9000 !important;
        }

        .light-theme .machine-calls-panel,
        body.light-theme .machine-calls-panel {
          background: #ffffff !important;
          border: 1px solid #fee2e2 !important;
        }

        .light-theme .machine-call-row,
        body.light-theme .machine-call-row {
          border-top: 1px solid #f1f5f9 !important;
        }

        .light-theme .machine-call-row strong,
        body.light-theme .machine-call-row strong {
          color: #dc2626 !important;
        }

        .light-theme .machine-call-row small,
        body.light-theme .machine-call-row small {
          color: #64748b !important;
        }
      `}} />
    </div>
  )
}

export default MachinesModule
