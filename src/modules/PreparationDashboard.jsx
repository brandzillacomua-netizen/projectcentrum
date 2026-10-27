import React from 'react'
import { usePreparationDashboardData } from './Preparation/hooks/usePreparationDashboardData'
import PreparationDashboardHeader from './Preparation/components/PreparationDashboardHeader'
import PreparationDashboardKPIs from './Preparation/components/PreparationDashboardKPIs'
import PreparationSheetOrdersPanel from './Preparation/components/PreparationSheetOrdersPanel'
import PreparationBoxOrderPanel from './Preparation/components/PreparationBoxOrderPanel'
import PreparationQueuePanel from './Preparation/components/PreparationQueuePanel'
import PreparationDashboardAlerts from './Preparation/components/PreparationDashboardAlerts'

const PreparationDashboard = () => {
  const {
    now,
    viewMode,
    setViewMode,
    isPaused,
    setIsPaused,
    sheetPage,
    boxesPage,
    prepPage,
    sheetPages,
    boxesPages,
    prepPages,
    setSheetPage,
    setBoxesPage,
    setPrepPage,
    totals,
    alerts,
    sheetOrders,
    activeSheetOrders,
    visibleSheetOrders,
    boxOrders,
    activeBoxOrders,
    visibleBoxOrders,
    prepQueue,
    visiblePrep,
    staleSeconds,
    toggleFullscreen
  } = usePreparationDashboardData()

  return (
    <div className="prep-tv">
      <PreparationDashboardHeader
        staleSeconds={staleSeconds}
        toggleFullscreen={toggleFullscreen}
        now={now}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      <PreparationDashboardKPIs totals={totals} />

      <main className="prep-tv__main">
        {viewMode === 'overview' ? (
          <div className="prep-tv__grid prep-tv__grid--split">
            {/* 1. Left: Sheet Issuance from Warehouse (СО -> Розкрій) */}
            <PreparationSheetOrdersPanel
              visibleSheetOrders={visibleSheetOrders}
              activeSheetOrders={activeSheetOrders}
              sheetPage={sheetPage}
              sheetPages={sheetPages}
              setSheetPage={setSheetPage}
              isPaused={isPaused}
              setIsPaused={setIsPaused}
            />

            {/* 2. Right: Cutter Boxes Preparation */}
            <PreparationBoxOrderPanel
              visibleBoxOrders={visibleBoxOrders}
              activeBoxOrders={activeBoxOrders}
              boxesPage={boxesPage}
              boxesPages={boxesPages}
              setBoxesPage={setBoxesPage}
              isPaused={isPaused}
              setIsPaused={setIsPaused}
            />
          </div>
        ) : (
          <div className="prep-tv__grid prep-tv__grid--full">
            {/* 3. Tumbling Tasks Queue View */}
            <PreparationQueuePanel
              visiblePrep={visiblePrep}
              prepPage={prepPage}
              prepPages={prepPages}
              now={now}
            />
          </div>
        )}
      </main>

      <PreparationDashboardAlerts alerts={alerts} />

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        /* Base Shell */
        .prep-tv {
          min-height: 100vh;
          height: 100vh;
          overflow: hidden;
          background: #060907;
          background: radial-gradient(circle at top right, #0d1a12 0%, #060907 60%);
          color: #f1f5f9;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, Helvetica, Arial, sans-serif;
          display: grid;
          grid-template-rows: 62px 90px 1fr 44px;
        }

        /* Header */
        .prep-tv__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          border-bottom: 1px solid #1a221c;
          background: #090e0b;
        }
        .prep-tv__brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .prep-tv__back {
          color: #64748b;
          display: grid;
          place-items: center;
          padding: 6px;
          border-radius: 8px;
          transition: 0.15s;
        }
        .prep-tv__back:hover {
          color: #f8fafc;
          background: #141c16;
        }
        .prep-tv__logo {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: linear-gradient(135deg, #064e3b, #047857);
          color: #34d399;
          box-shadow: 0 0 16px rgba(16, 185, 129, 0.25);
        }
        .prep-tv__brand strong {
          display: block;
          font-size: 16px;
          font-weight: 800;
          letter-spacing: 0.04em;
          color: #f8fafc;
        }
        .prep-tv__brand span {
          display: block;
          color: #64748b;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          font-weight: 700;
        }

        /* Tabs in Header */
        .prep-tv__tabs {
          display: flex;
          background: #111713;
          padding: 3px;
          border-radius: 10px;
          border: 1px solid #1f2a22;
          gap: 4px;
        }
        .prep-tv__tab-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          background: transparent;
          border: none;
          color: #8b9990;
          font-size: 12px;
          font-weight: 700;
          padding: 6px 14px;
          border-radius: 7px;
          cursor: pointer;
          transition: 0.18s;
        }
        .prep-tv__tab-btn.is-active {
          background: #192b1f;
          color: #34d399;
          border: 1px solid #059669;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }

        /* Status & Clock */
        .prep-tv__header-status {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .prep-tv__pulse {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 4px 10px;
          border-radius: 99px;
        }
        .prep-tv__pulse.is-live {
          color: #10b981;
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.25);
        }
        .prep-tv__pulse.is-stale {
          color: #f59e0b;
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.25);
        }
        .prep-tv__icon-btn {
          width: 36px;
          height: 36px;
          border-radius: 9px;
          border: 1px solid #232c25;
          background: #101612;
          color: #94a3b8;
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: 0.15s;
        }
        .prep-tv__icon-btn:hover {
          color: #f8fafc;
          border-color: #334155;
          background: #18221c;
        }
        .prep-tv__clock {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          line-height: 1.1;
        }
        .prep-tv__clock strong {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 22px;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: 0.02em;
        }
        .prep-tv__clock span {
          color: #64748b;
          font-size: 10px;
          font-weight: 700;
          text-transform: capitalize;
          margin-top: 2px;
        }

        /* KPIs Row */
        .prep-tv__kpis {
          padding: 10px 24px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }
        .prep-kpi {
          border: 1px solid #1a231d;
          background: linear-gradient(135deg, #0e1410 0%, #0a0e0c 100%);
          border-radius: 12px;
          padding: 10px 16px;
          display: grid;
          grid-template-columns: 36px 1fr;
          align-items: center;
          gap: 12px;
          transition: 0.2s;
        }
        .prep-kpi__icon {
          width: 38px;
          height: 38px;
          border-radius: 9px;
          display: grid;
          place-items: center;
        }
        .prep-kpi__icon--sky {
          background: rgba(56, 189, 248, 0.14);
          color: #38bdf8;
        }
        .prep-kpi__icon--emerald {
          background: rgba(16, 185, 129, 0.14);
          color: #10b981;
        }
        .prep-kpi__icon--amber {
          background: rgba(245, 158, 11, 0.14);
          color: #f59e0b;
        }
        .prep-kpi__icon--rose {
          background: rgba(244, 63, 94, 0.14);
          color: #f43f5e;
        }
        .prep-kpi.is-warning {
          border-color: #543717;
          background: linear-gradient(135deg, #1f150c 0%, #0d0a06 100%);
        }
        .prep-kpi.is-ready {
          border-color: #163624;
        }
        .prep-kpi__label {
          display: block;
          color: #718076;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .prep-kpi__value {
          display: flex;
          align-items: baseline;
          gap: 4px;
          line-height: 1.1;
          margin-top: 2px;
        }
        .prep-kpi__value strong {
          font-size: 24px;
          font-weight: 900;
          color: #ffffff;
        }
        .prep-kpi__total {
          font-size: 15px;
          font-weight: 700;
          color: #64748b;
        }
        .prep-kpi__unit {
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
        }
        .prep-kpi__sub {
          display: block;
          color: #4b5563;
          font-size: 10px;
          font-weight: 600;
          margin-top: 1px;
        }
        .prep-kpi.is-warning .prep-kpi__sub {
          color: #f59e0b;
        }

        /* Main Workspace Grid */
        .prep-tv__main {
          min-height: 0;
          padding: 0 24px 10px;
        }
        .prep-tv__grid {
          height: 100%;
          display: grid;
          gap: 14px;
        }
        .prep-tv__grid--split {
          grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
        }
        .prep-tv__grid--full {
          grid-template-columns: 1fr;
        }

        /* Panel Wrapper */
        .prep-tv__panel {
          min-height: 0;
          border: 1px solid #1a221c;
          background: #090e0b;
          border-radius: 16px;
          display: grid;
          grid-template-rows: 48px 1fr 34px;
          overflow: hidden;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
        }
        .prep-tv__panel--sheets {
          border-top: 3px solid #38bdf8;
        }
        .prep-tv__panel--boxes {
          border-top: 3px solid #f59e0b;
        }
        .prep-tv__panel--prep {
          border-top: 3px solid #10b981;
        }

        /* Panel Header */
        .prep-tv__panel-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 16px;
          border-bottom: 1px solid #151c17;
          background: #0d130f;
        }
        .prep-tv__head-title {
          display: flex;
          align-items: center;
          gap: 9px;
        }
        .prep-tv__panel--sheets .prep-tv__head-icon { color: #38bdf8; }
        .prep-tv__panel--boxes .prep-tv__head-icon { color: #f59e0b; }
        .prep-tv__panel--prep .prep-tv__head-icon { color: #10b981; }

        .prep-tv__head-title strong {
          display: block;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.05em;
          color: #f1f5f9;
        }
        .prep-tv__head-sub {
          display: block;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          color: #64748b;
          letter-spacing: 0.08em;
        }
        .prep-tv__head-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .prep-tv__ctrl-btn {
          width: 26px;
          height: 26px;
          border-radius: 6px;
          border: 1px solid #1f2a22;
          background: #111713;
          color: #94a39a;
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: 0.15s;
        }
        .prep-tv__ctrl-btn:hover {
          color: #fff;
          background: #1b261f;
        }
        .prep-tv__ctrl-btn.is-paused {
          color: #f59e0b;
          border-color: #543717;
          background: #23160a;
        }
        .prep-tv__nav-btns {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .prep-tv__page-badge {
          font-size: 10px;
          font-weight: 800;
          color: #79867d;
          padding: 0 4px;
        }

        /* Lists */
        .prep-tv__sheet-list,
        .prep-tv__box-list {
          min-height: 0;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          overflow-y: auto;
        }

        /* Order Cards (Sheets & Boxes) */
        .sheet-order-card,
        .box-order-card {
          flex: 1;
          min-height: 0;
          border: 1px solid #1f2922;
          border-radius: 13px;
          background: linear-gradient(145deg, #101712 0%, #0b100d 100%);
          padding: 12px 16px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 9px;
          transition: 0.25s;
        }
        .sheet-order-card.is-complete,
        .box-order-card.is-complete {
          border-color: #173b26;
          background: linear-gradient(145deg, #0e1c13 0%, #09120c 100%);
        }
        .sheet-order-card.is-partial {
          border-color: #3b2c16;
          background: linear-gradient(145deg, #17140c 0%, #0d0c07 100%);
        }
        .sheet-order-card.is-waiting {
          border-color: #421c1f;
          background: linear-gradient(145deg, #190f11 0%, #0e090a 100%);
        }

        /* Order Card Header */
        .sheet-order-card__header,
        .box-order-card__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 7px;
          border-bottom: 1px solid #19221b;
        }
        .sheet-order-card__order,
        .box-order-card__order {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }
        .sheet-order-card__label,
        .box-order-card__label {
          font-size: 10px;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .sheet-order-card__number,
        .box-order-card__number {
          font-size: clamp(20px, 1.8vw, 26px);
          font-weight: 900;
          color: #ffffff;
          line-height: 1;
        }

        /* Status Pills */
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 9px;
          border-radius: 99px;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .pill--emerald {
          background: rgba(16, 185, 129, 0.15);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.35);
        }
        .pill--amber {
          background: rgba(245, 158, 11, 0.15);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.35);
        }
        .pill--rose {
          background: rgba(244, 63, 94, 0.15);
          color: #fb7185;
          border: 1px solid rgba(244, 63, 94, 0.35);
        }

        /* Stats Row */
        .sheet-order-card__stats,
        .box-order-card__stats {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) minmax(0, 1.2fr) 75px;
          gap: 10px;
          align-items: center;
        }
        .stat-block {
          display: flex;
          flex-direction: column;
        }
        .stat-label {
          font-size: 9px;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .stat-value {
          display: flex;
          align-items: baseline;
          gap: 3px;
          margin-top: 1px;
        }
        .stat-value strong {
          font-size: clamp(24px, 2.2vw, 32px);
          font-weight: 900;
          line-height: 1;
          color: #38bdf8;
        }
        .box-order-card .stat-value strong {
          color: #f59e0b;
        }
        .is-complete .stat-value strong {
          color: #10b981;
        }
        .stat-total {
          font-size: 16px;
          font-weight: 700;
          color: #64748b;
        }
        .stat-unit {
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          margin-left: 2px;
        }
        .stat-pending-val {
          margin-top: 2px;
        }
        .pending-badge {
          display: inline-block;
          font-size: 13px;
          font-weight: 900;
          padding: 3px 8px;
          border-radius: 6px;
          background: rgba(244, 63, 94, 0.18);
          color: #fb7185;
          border: 1px solid rgba(244, 63, 94, 0.3);
        }
        .pending-badge--amber {
          background: rgba(245, 158, 11, 0.18);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }
        .ready-badge {
          display: inline-block;
          font-size: 12px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 6px;
          background: rgba(16, 185, 129, 0.15);
          color: #34d399;
        }
        .stat-percent-val {
          font-size: clamp(20px, 1.8vw, 26px);
          font-weight: 900;
          color: #f1f5f9;
          text-align: right;
        }
        .is-complete .stat-percent-val {
          color: #34d399;
        }

        /* Progress Bar */
        .sheet-order-card__progress,
        .box-order-card__progress {
          height: 10px;
          background: #141c16;
          border-radius: 99px;
          overflow: hidden;
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.4);
        }
        .sheet-order-card__progress-fill,
        .box-order-card__progress-fill {
          height: 100%;
          border-radius: inherit;
          transition: width 0.5s ease;
        }
        .sheet-order-card__progress-fill.is-complete {
          background: linear-gradient(90deg, #059669, #10b981);
        }
        .sheet-order-card__progress-fill.is-partial {
          background: linear-gradient(90deg, #d97706, #38bdf8);
        }
        .sheet-order-card__progress-fill.is-waiting {
          background: #f43f5e;
        }
        .box-order-card__progress-fill.is-complete {
          background: linear-gradient(90deg, #059669, #10b981);
        }
        .box-order-card__progress-fill.is-pending {
          background: linear-gradient(90deg, #d97706, #f59e0b);
        }

        /* Material Breakdown (Листи за типами) */
        .sheet-order-card__materials {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .materials-title,
        .cutters-header {
          font-size: 9px;
          font-weight: 800;
          color: #64748b;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .materials-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .material-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #141c16;
          border: 1px solid #233026;
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 11px;
        }
        .material-pill.is-complete {
          background: #0d1e14;
          border-color: #1a422b;
        }
        .material-pill__name {
          color: #d1d5db;
          font-weight: 700;
        }
        .material-pill__qty {
          color: #94a39a;
          font-weight: 800;
        }
        .material-pill__qty strong {
          color: #38bdf8;
        }
        .material-pill.is-complete .material-pill__qty strong {
          color: #34d399;
        }
        .material-pill__deficit {
          color: #fb7185;
          margin-left: 4px;
        }

        /* Cutters & Tooling (Бокси фрез) */
        .box-order-card__cutters {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .cutters-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .cutter-pill {
          display: flex;
          align-items: center;
          gap: 7px;
          background: #191c13;
          border: 1px solid #363620;
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 11px;
        }
        .cutter-pill__name {
          color: #f1f5f9;
          font-weight: 700;
        }
        .cutter-pill__qty {
          color: #fbbf24;
          font-weight: 900;
          background: rgba(245, 158, 11, 0.15);
          padding: 1px 6px;
          border-radius: 4px;
        }
        .cutters-empty {
          font-size: 10px;
          color: #64748b;
          font-style: italic;
        }

        /* Individual Boxes Strip */
        .box-order-card__boxes-strip {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-top: 5px;
          border-top: 1px dashed #1e261f;
        }
        .boxes-strip-title {
          font-size: 9px;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
        }
        .boxes-chips {
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
        }
        .box-chip {
          font-size: 10px;
          font-weight: 800;
          padding: 2px 7px;
          border-radius: 5px;
        }
        .box-chip.is-ready {
          background: #0f2b1d;
          color: #34d399;
          border: 1px solid #165636;
        }
        .box-chip.is-waiting {
          background: #231b0e;
          color: #fbbf24;
          border: 1px solid #4a3416;
        }
        .box-chip-more {
          font-size: 10px;
          color: #64748b;
          font-weight: 700;
        }

        /* Panel Footer */
        .prep-tv__panel-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          border-top: 1px solid #141c16;
          background: #0b100d;
        }
        .prep-tv__dots {
          display: flex;
          gap: 6px;
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 99px;
          border: none;
          background: #253329;
          cursor: pointer;
          transition: 0.2s;
        }
        .dot.is-active {
          width: 24px;
          background: #10b981;
        }
        .prep-tv__panel--boxes .dot.is-active {
          background: #f59e0b;
        }
        .prep-tv__timer-note {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          color: #64748b;
          letter-spacing: 0.05em;
        }

        /* Tumbling Queue List (Alternative view) */
        .prep-tv__list { min-height: 0; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
        .prep-task { flex: 1; min-height: 64px; display: grid; grid-template-columns: 40px minmax(0, 1fr) 60px 72px; align-items: center; gap: 12px; border: 1px solid #1f2922; border-radius: 12px; padding: 10px 14px; background: #0e1511; }
        .prep-task.is-active { border-left: 4px solid #38bdf8; background: #0c1813; }
        .prep-task.has-alert { border-color: #7f1d1d; background: #190f0f; }
        .prep-task__status { width: 36px; height: 36px; border-radius: 9px; background: #18201b; color: #fbbf24; display: grid; place-items: center; }
        .is-active .prep-task__status { color: #38bdf8; background: #0f2231; }
        .has-alert .prep-task__status { color: #f87171; background: #321414; }
        .prep-task__main { min-width: 0; }
        .prep-task__main > div { display: flex; gap: 10px; align-items: center; }
        .prep-task__main > div strong { font-size: 13px; color: #34d399; }
        .prep-task__main > div span { color: #64748b; font-size: 11px; }
        .prep-task h3 { margin: 2px 0; font-size: 14px; color: #f8fafc; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .prep-task small { color: #94a3b8; font-size: 11px; }
        .prep-task__metric, .prep-task__time { display: flex; flex-direction: column; align-items: flex-end; }
        .prep-task__metric strong, .prep-task__time strong { font-size: 17px; font-weight: 800; }
        .prep-task__metric span, .prep-task__time span { color: #64748b; font-size: 9px; text-transform: uppercase; font-weight: 700; }

        /* Empty State */
        .prep-tv__empty {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #10b981;
          gap: 8px;
          text-align: center;
          padding: 24px;
        }
        .prep-tv__empty strong {
          color: #e2e8f0;
          font-size: 16px;
        }
        .prep-tv__empty span {
          color: #64748b;
          font-size: 12px;
        }

        /* Alerts Footer */
        .prep-tv__alerts {
          min-width: 0;
          display: grid;
          grid-template-columns: 190px 1fr;
          align-items: center;
          padding: 0 24px;
          background: #1c1507;
          border-top: 1px solid #573e0e;
          color: #fbbf24;
        }
        .prep-tv__alerts.has-danger {
          background: #200d0e;
          border-color: #6e1c24;
          color: #fb7185;
        }
        .prep-tv__alerts > div:first-child {
          display: flex;
          gap: 8px;
          align-items: center;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.06em;
        }
        .prep-tv__alerts-list {
          min-width: 0;
          display: flex;
          gap: 20px;
          overflow: hidden;
        }
        .prep-tv__alerts-list span {
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 11px;
          font-weight: 600;
          color: #fde68a;
        }
        .prep-tv__alerts-list span + span:before {
          content: '•';
          margin-right: 20px;
          color: #92400e;
        }
        .prep-tv__alerts-list .is-clear {
          color: #6ee7b7;
        }

        /* Light Theme Overrides */
        .light-theme .prep-tv, [data-theme="light"] .prep-tv {
          background: #f1f5f9;
          color: #0f172a;
        }
        .light-theme .prep-tv__header, [data-theme="light"] .prep-tv__header {
          background: #ffffff;
          border-bottom-color: #e2e8f0;
        }
        .light-theme .prep-tv__brand strong, [data-theme="light"] .prep-tv__brand strong { color: #0f172a; }
        .light-theme .prep-tv__clock strong, [data-theme="light"] .prep-tv__clock strong { color: #0f172a; }
        .light-theme .prep-tv__tabs, [data-theme="light"] .prep-tv__tabs {
          background: #f8fafc;
          border-color: #e2e8f0;
        }
        .light-theme .prep-tv__tab-btn.is-active, [data-theme="light"] .prep-tv__tab-btn.is-active {
          background: #ffffff;
          color: #059669;
          border-color: #10b981;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        }
        .light-theme .prep-kpi, [data-theme="light"] .prep-kpi {
          background: #ffffff;
          border-color: #e2e8f0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.03);
        }
        .light-theme .prep-kpi__value strong, [data-theme="light"] .prep-kpi__value strong { color: #0f172a; }
        .light-theme .prep-tv__panel, [data-theme="light"] .prep-tv__panel {
          background: #ffffff;
          border-color: #e2e8f0;
          box-shadow: 0 4px 16px rgba(0,0,0,0.04);
        }
        .light-theme .prep-tv__panel-head, [data-theme="light"] .prep-tv__panel-head {
          background: #f8fafc;
          border-bottom-color: #e2e8f0;
        }
        .light-theme .sheet-order-card, [data-theme="light"] .sheet-order-card,
        .light-theme .box-order-card, [data-theme="light"] .box-order-card {
          background: #ffffff;
          border-color: #e2e8f0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.02);
        }
        .light-theme .sheet-order-card__number, [data-theme="light"] .sheet-order-card__number,
        .light-theme .box-order-card__number, [data-theme="light"] .box-order-card__number {
          color: #0f172a;
        }
        .light-theme .stat-percent-val, [data-theme="light"] .stat-percent-val {
          color: #0f172a;
        }
        .light-theme .sheet-order-card__progress, [data-theme="light"] .sheet-order-card__progress,
        .light-theme .box-order-card__progress, [data-theme="light"] .box-order-card__progress {
          background: #e2e8f0;
        }
        .light-theme .material-pill, [data-theme="light"] .material-pill,
        .light-theme .cutter-pill, [data-theme="light"] .cutter-pill {
          background: #f8fafc;
          border-color: #e2e8f0;
        }
        .light-theme .material-pill__name, [data-theme="light"] .material-pill__name,
        .light-theme .cutter-pill__name, [data-theme="light"] .cutter-pill__name {
          color: #1e293b;
        }
        .light-theme .prep-tv__panel-footer, [data-theme="light"] .prep-tv__panel-footer {
          background: #f8fafc;
          border-top-color: #e2e8f0;
        }
        .light-theme .prep-tv__alerts, [data-theme="light"] .prep-tv__alerts {
          background: #fffbeb;
          border-top-color: #fde68a;
          color: #b45309;
        }
        .light-theme .prep-tv__alerts-list span, [data-theme="light"] .prep-tv__alerts-list span {
          color: #92400e;
        }
        .light-theme .prep-tv__alerts.has-danger, [data-theme="light"] .prep-tv__alerts.has-danger {
          background: #fef2f2;
          border-top-color: #fecaca;
          color: #b91c1c;
        }

        /* Responsive Layout for smaller screens / tablets */
        @media (max-width: 900px) {
          .prep-tv {
            height: auto;
            min-height: 100vh;
            overflow-y: auto;
            grid-template-rows: auto auto 1fr auto;
          }
          .prep-tv__grid--split {
            grid-template-columns: 1fr;
          }
          .prep-tv__kpis {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  )
}

export default PreparationDashboard
