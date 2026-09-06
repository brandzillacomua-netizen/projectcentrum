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

      {/* Global CSS for blink animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
