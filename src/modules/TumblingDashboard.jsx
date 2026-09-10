import React from 'react'
import { useTumblingDashboardData } from './Tumbling/hooks/useTumblingDashboardData.js'
import { TumblingDashboardHeader } from './Tumbling/components/TumblingDashboardHeader.jsx'
import { TumblingKitsColumn } from './Tumbling/components/TumblingKitsColumn.jsx'
import { TumblingWaitingColumn } from './Tumbling/components/TumblingWaitingColumn.jsx'
import { TumblingInWorkColumn } from './Tumbling/components/TumblingInWorkColumn.jsx'

export default function TumblingDashboard() {
  const {
    currentTime,
    isFullScreen,
    setIsFullScreen,
    autoScrollActive,
    setAutoScrollActive,
    col1Ref,
    col2Ref,
    col3Ref,
    getNom,
    getNextTumblingOperation,
    orderKits,
    shiftDeficits,
    orderPage,
    totalPages,
    displayedKits,
    waitingQueue,
    inProgressQueue,
    formatLiveDuration,
    formatWaitingTime,
    orders
  } = useTumblingDashboardData()

  return (
    <div className="tumbling-dashboard-container" style={{
      background: 'var(--bg, #07070a)',
      height: '100vh',
      maxHeight: '100vh',
      color: 'var(--text, #fff)',
      fontFamily: "'Outfit', 'Inter', sans-serif",
      display: 'flex',
      flexDirection: 'column',
      padding: isFullScreen ? '10px' : '20px',
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>
      
      {/* TOP NAVBAR */}
      <TumblingDashboardHeader
        currentTime={currentTime}
        isFullScreen={isFullScreen}
        setIsFullScreen={setIsFullScreen}
        autoScrollActive={autoScrollActive}
        setAutoScrollActive={setAutoScrollActive}
        shiftDeficits={shiftDeficits}
      />

      {/* MAIN GRID SECTION */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr 1fr',
        gap: '16px',
        overflow: 'hidden'
      }}>
        {/* COLUMN 1: KITS & BOTTLENECKS */}
        <TumblingKitsColumn
          col1Ref={col1Ref}
          orderKits={orderKits}
          displayedKits={displayedKits}
          orderPage={orderPage}
          totalPages={totalPages}
        />

        {/* COLUMN 2: WAITING QUEUE */}
        <TumblingWaitingColumn
          col2Ref={col2Ref}
          waitingQueue={waitingQueue}
          orders={orders}
          getNom={getNom}
          getNextTumblingOperation={getNextTumblingOperation}
          formatWaitingTime={formatWaitingTime}
        />

        {/* COLUMN 3: IN WORK QUEUE */}
        <TumblingInWorkColumn
          col3Ref={col3Ref}
          inProgressQueue={inProgressQueue}
          orders={orders}
          getNom={getNom}
          formatLiveDuration={formatLiveDuration}
        />
      </div>

      {/* Global CSS for animations and Light & Dark Theme CSS variables */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(0.98); }
        }

        .tumbling-dashboard-container {
          --col-bg: #0f172a;
          --col-head-bg: #1e293b;
          --col-border: #334155;
          --kit-card-bg: #1e293b;
          --kit-card-border: #334155;
          --comp-item-bg: #0f172a;
          --comp-item-border: #334155;
          --bottleneck-item-bg: #2a1215;
          --card-item-bg: #1e293b;
          --card-item-border: #334155;
          --card-bottleneck-bg: #2a1215;
          --card-title-color: #ffffff;
          --text-primary: #ffffff;
          --text-muted: #94a3b8;
          --time-pill-bg: #0f172a;
          --time-pill-text: #38bdf8;
          --time-pill-border: #334155;
          --step-bg: #0c4a6e;
          --step-border: #0284c7;
          --step-text: #7dd3fc;
          --step-text-bold: #ffffff;
        }

        .light-theme .tumbling-dashboard-container,
        [data-theme="light"] .tumbling-dashboard-container,
        body.light-theme .tumbling-dashboard-container {
          background: #e2e8f0 !important;
          color: #0f172a !important;
          --col-bg: #ffffff;
          --col-head-bg: #f8fafc;
          --col-border: #cbd5e1;
          --kit-card-bg: #ffffff;
          --kit-card-border: #cbd5e1;
          --comp-item-bg: #f8fafc;
          --comp-item-border: #cbd5e1;
          --bottleneck-item-bg: #fef2f2;
          --card-item-bg: #ffffff;
          --card-item-border: #cbd5e1;
          --card-bottleneck-bg: #fff1f1;
          --card-title-color: #0f172a;
          --text-primary: #0f172a;
          --text-muted: #475569;
          --time-pill-bg: #f1f5f9;
          --time-pill-text: #0284c7;
          --time-pill-border: #cbd5e1;
          --step-bg: #e0f2fe;
          --step-border: #93c5fd;
          --step-text: #0369a1;
          --step-text-bold: #0284c7;
        }

        /* High-contrast TV Badges with !important color protection against theme pollution */
        .tumbling-badge-blue {
          background: #0284c7 !important;
          color: #ffffff !important;
          padding: 4px 10px !important;
          border-radius: 8px !important;
          font-size: 0.92rem !important;
          font-weight: 950 !important;
          letter-spacing: 0.5px !important;
          box-shadow: 0 2px 6px rgba(2,132,199,0.3) !important;
          display: inline-block !important;
        }

        .tumbling-badge-gold {
          background: #0f172a !important;
          color: #fbbf24 !important;
          border: 1.5px solid #475569 !important;
          padding: 3px 8px !important;
          border-radius: 6px !important;
          font-size: 0.85rem !important;
          font-weight: 950 !important;
          font-family: monospace !important;
          letter-spacing: 0.5px !important;
          display: inline-block !important;
        }

        .tumbling-badge-green {
          background: #059669 !important;
          color: #ffffff !important;
          padding: 3px 8px !important;
          border-radius: 6px !important;
          font-size: 0.82rem !important;
          font-weight: 950 !important;
          display: inline-block !important;
        }

        .tumbling-badge-amber {
          background: #d97706 !important;
          color: #ffffff !important;
          padding: 4px 8px !important;
          border-radius: 6px !important;
          font-size: 0.7rem !important;
          font-weight: 950 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.3px !important;
          box-shadow: 0 2px 6px rgba(217,119,6,0.3) !important;
          display: inline-block !important;
        }

        .tumbling-badge-red {
          background: #dc2626 !important;
          color: #ffffff !important;
          padding: 4px 9px !important;
          border-radius: 6px !important;
          font-size: 0.7rem !important;
          font-weight: 950 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
          box-shadow: 0 3px 10px rgba(220,38,38,0.4) !important;
          animation: pulse 1.5s infinite !important;
          display: inline-block !important;
        }

        .tumbling-badge-qty {
          background: #059669 !important;
          color: #ffffff !important;
          padding: 4px 12px !important;
          border-radius: 8px !important;
          font-size: 0.95rem !important;
          font-weight: 950 !important;
          box-shadow: 0 2px 6px rgba(5,150,105,0.3) !important;
          display: inline-block !important;
        }
        .tumbling-badge-qty, .tumbling-badge-qty * {
          color: #ffffff !important;
        }

        .tumbling-timer-box {
          background: #0f172a !important;
          color: #10b981 !important;
          border: 1.5px solid #334155 !important;
          padding: 4px 10px !important;
          border-radius: 8px !important;
          font-size: 0.92rem !important;
          font-family: monospace !important;
          font-weight: 950 !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 6px !important;
        }
        .tumbling-timer-box, .tumbling-timer-box * {
          color: #10b981 !important;
        }

        .tumbling-waiting-timer-box {
          background: var(--time-pill-bg, #f1f5f9) !important;
          color: var(--time-pill-text, #0284c7) !important;
          border: 1.5px solid var(--time-pill-border, #cbd5e1) !important;
          padding: 4px 10px !important;
          border-radius: 8px !important;
          font-size: 0.8rem !important;
          font-weight: 950 !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 5px !important;
        }
        .tumbling-waiting-timer-box, .tumbling-waiting-timer-box * {
          color: #0284c7 !important;
        }
      `}</style>
    </div>
  )
}
