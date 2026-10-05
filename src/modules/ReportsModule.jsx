import React from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import MonthlyReport from './reports/MonthlyReport'
import SheetsReport from './reports/SheetsReport'

import { useReportsModuleData, HISTORY_REPORT_TABS } from './reports/hooks/useReportsModuleData'
import { ReportsHeader } from './reports/components/ReportsHeader'
import { WarehouseReportView } from './reports/components/WarehouseReportView'
import { EmployeeReportView } from './reports/components/EmployeeReportView'
import { ScrapReportView } from './reports/components/ScrapReportView'
import { SuppliesReportView } from './reports/components/SuppliesReportView'
import { CuttersReportView } from './reports/components/CuttersReportView'
import { ArchiveReportView } from './reports/components/ArchiveReportView'
import { AnalyticsReportView } from './reports/components/AnalyticsReportView'
import './reports/ReportsStyles.css'

const ReportsModule = () => {
  const {
    inventory,
    tasks,
    orders,
    nomenclatures,
    receptionDocs,
    requests,
    activeTab,
    setActiveTab,
    scrapReportSubTab,
    setScrapReportSubTab,
    searchQuery,
    setSearchQuery,
    quickPeriod,
    setQuickPeriod,
    archiveLoading,
    allArchiveTasks,
    archiveSearch,
    setArchiveSearch,
    archiveStatusFilter,
    setArchiveStatusFilter,
    loadArchive,
    filteredArchiveTasks,
    archiveTotalCount,
    archiveTotalPages,
    archivePage,
    setArchivePage,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    workCardHistory,
    isSyncing,
    historyLoadError,
    selectedShiftFilter,
    setSelectedShiftFilter,
    selectedEmployeeFilter,
    setSelectedEmployeeFilter,
    uniqueOperators,
    handleQuickDateSelect,
    handleExport,
    filterByDate,
    whFilter,
    setWhFilter,
    typeFilter,
    setTypeFilter,
    itemFilter,
    setItemFilter,
    itemSearchText,
    setItemSearchText,
    isItemDropdownOpen,
    setIsItemDropdownOpen,
    generatedReport,
    warehouseOptions,
    typeOptions,
    filteredItems,
    handleGenerateReport,
    employeeStats,
    scrapStats,
    scrapReasonsStats,
    generalStats,
    supplyStats,
    cuttersStats,
    cutterEventsList,
    totalCuttersUsed,
    totalCuttersSupplied,
    setArchiveLoaded,
    setAllArchiveTasks
  } = useReportsModuleData()

  const renderTabContent = () => {
    if (isSyncing && HISTORY_REPORT_TABS.has(activeTab)) {
      return (
        <div className="glass-panel" style={{
          background: 'var(--surface-inset)',
          padding: '70px 30px',
          borderRadius: '24px',
          border: '1px solid #27272a',
          color: 'var(--text-muted)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          minHeight: '380px',
          margin: '10px 0',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
        }}>
          <RefreshCw size={38} className="spin" color="#ff9000" />
          <div style={{ fontSize: '1.25rem', fontWeight: 950, color: 'var(--text-strong)', letterSpacing: '0.3px' }}>
            Завантажуємо дані за обраний період...
          </div>
          <div style={{ fontSize: '0.85rem', color: '#71717a' }}>
            Оновлюємо інформацію та розраховуємо показники
          </div>
        </div>
      )
    }

    if (historyLoadError && HISTORY_REPORT_TABS.has(activeTab)) {
      return (
        <div className="glass-panel" style={{
          background: 'var(--surface-inset)',
          padding: '40px 30px',
          borderRadius: '24px',
          border: '1px solid #7f1d1d',
          color: '#fca5a5',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          minHeight: '300px',
          margin: '10px 0'
        }}>
          <AlertTriangle size={32} color="#ef4444" />
          <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-strong)' }}>Не вдалося завантажити дані за обраний період</div>
          <div style={{ fontSize: '0.85rem', color: '#f87171' }}>{historyLoadError}</div>
        </div>
      )
    }

    switch (activeTab) {
      case 'monthly':
        return <MonthlyReport />
      case 'warehouse':
        return (
          <WarehouseReportView
            whFilter={whFilter}
            setWhFilter={setWhFilter}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            itemFilter={itemFilter}
            setItemFilter={setItemFilter}
            itemSearchText={itemSearchText}
            setItemSearchText={setItemSearchText}
            isItemDropdownOpen={isItemDropdownOpen}
            setIsItemDropdownOpen={setIsItemDropdownOpen}
            warehouseOptions={warehouseOptions}
            typeOptions={typeOptions}
            filteredItems={filteredItems}
            handleGenerateReport={handleGenerateReport}
            generatedReport={generatedReport}
          />
        )
      
      case 'employees':
        return <EmployeeReportView employeeStats={employeeStats} />

      case 'scrap':
        return (
          <ScrapReportView
            isSyncing={isSyncing}
            historyLoadError={historyLoadError}
            inventory={inventory}
            scrapStats={scrapStats}
            scrapReportSubTab={scrapReportSubTab}
            setScrapReportSubTab={setScrapReportSubTab}
            scrapReasonsStats={scrapReasonsStats}
          />
        )

      case 'supplies':
        return <SuppliesReportView supplyStats={supplyStats} />

      case 'sheets':
        return (
          <SheetsReport
            nomenclatures={nomenclatures}
            tasks={tasks}
            orders={orders}
            receptionDocs={receptionDocs}
            workCardHistory={workCardHistory}
            requests={requests}
            inventory={inventory}
            startDate={startDate}
            endDate={endDate}
            searchQuery={searchQuery}
            filterByDate={filterByDate}
          />
        )

      case 'cutters':
        return (
          <CuttersReportView
            isSyncing={isSyncing}
            cuttersStats={cuttersStats}
            cutterEventsList={cutterEventsList}
            totalCuttersUsed={totalCuttersUsed}
            totalCuttersSupplied={totalCuttersSupplied}
          />
        )

      case 'analytics':
        return <AnalyticsReportView generalStats={generalStats} />

      case 'archive':
        return (
          <ArchiveReportView
            filteredArchiveTasks={filteredArchiveTasks}
            allArchiveTasks={allArchiveTasks}
            archiveSearch={archiveSearch}
            setArchiveSearch={setArchiveSearch}
            archiveStatusFilter={archiveStatusFilter}
            setArchiveStatusFilter={setArchiveStatusFilter}
            archiveLoading={archiveLoading}
            setArchiveLoaded={setArchiveLoaded}
            setAllArchiveTasks={setAllArchiveTasks}
            loadArchive={loadArchive}
            archivePage={archivePage}
            setArchivePage={setArchivePage}
            archiveTotalCount={archiveTotalCount}
            archiveTotalPages={archiveTotalPages}
          />
        )
        
      default: return null
    }
  }

  return (
    <div className="reports-module">
      <ReportsHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedShiftFilter={selectedShiftFilter}
        setSelectedShiftFilter={setSelectedShiftFilter}
        selectedEmployeeFilter={selectedEmployeeFilter}
        setSelectedEmployeeFilter={setSelectedEmployeeFilter}
        uniqueOperators={uniqueOperators}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        quickPeriod={quickPeriod}
        setQuickPeriod={setQuickPeriod}
        handleQuickDateSelect={handleQuickDateSelect}
        handleExport={handleExport}
      />

      <div style={{ padding: '0 25px 25px 25px', display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
        <div style={{ flex: 1 }}>
          {renderTabContent()}
        </div>
      </div>
    </div>
  )
}

export default ReportsModule
