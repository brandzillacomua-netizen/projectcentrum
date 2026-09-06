import React from 'react'
import { useDashboardData } from './Dashboard/hooks/useDashboardData.js'
import { DashboardHeaderNav } from './Dashboard/components/DashboardHeaderNav.jsx'
import { DashboardOrderTabs } from './Dashboard/components/DashboardOrderTabs.jsx'
import { DashboardFilterControls } from './Dashboard/components/DashboardFilterControls.jsx'
import { DashboardTrendsPanel } from './Dashboard/components/DashboardTrendsPanel.jsx'
import { DashboardWipMatrixTable } from './Dashboard/components/DashboardWipMatrixTable.jsx'

const DashboardModule = () => {
  const {
    currentUser,
    wipOnly,
    setWipOnly,
    searchQuery,
    setSearchQuery,
    isRefreshing,
    handleRefresh,
    selectedOrderId,
    setSelectedOrderId,
    selectedOrderNum,
    activeOrders,
    groupedDashboardData,
    totals,
    productTrends,
    getGroupTotals,
    orders
  } = useDashboardData()

  return (
    <div className="dashboard-module-v2" style={{ background: 'var(--bg, #09090b)', minHeight: '100vh', color: 'var(--text, #f4f4f5)', display: 'flex', flexDirection: 'column' }}>
      {/* Navigation Bar */}
      <DashboardHeaderNav
        currentUser={currentUser}
        selectedOrderId={selectedOrderId}
        selectedOrderNum={selectedOrderNum}
      />

      {/* Production Order Tabs */}
      <DashboardOrderTabs
        selectedOrderId={selectedOrderId}
        setSelectedOrderId={setSelectedOrderId}
        activeOrders={activeOrders}
      />

      {/* Module Content Area */}
      <div className="module-content" style={{ padding: '30px', overflowY: 'auto', flex: 1, maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
        <section className="glass-panel" style={{ padding: '30px', borderRadius: '32px', border: '1px solid var(--glass-border, #27272a)', background: 'var(--card-bg, rgba(15,15,18,0.7))', backdropFilter: 'blur(20px)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
          {/* Controls & Search */}
          <DashboardFilterControls
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            wipOnly={wipOnly}
            setWipOnly={setWipOnly}
            isRefreshing={isRefreshing}
            handleRefresh={handleRefresh}
          />

          {/* Bottlenecks & Product Trends Panel */}
          <DashboardTrendsPanel
            productTrends={productTrends}
            selectedOrderId={selectedOrderId}
            orders={orders}
            groupedDashboardData={groupedDashboardData}
          />

          {/* Spreadsheet Replica Matrix Table */}
          <DashboardWipMatrixTable
            groupedDashboardData={groupedDashboardData}
            getGroupTotals={getGroupTotals}
            totals={totals}
          />
        </section>
      </div>
    </div>
  )
}

export default DashboardModule