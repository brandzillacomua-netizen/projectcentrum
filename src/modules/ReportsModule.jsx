import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import MonthlyReport from './reports/MonthlyReport'
import EnterpriseSheetsReport from './reports/components/EnterpriseSheetsReport'
import EnterpriseCuttersReport from './reports/components/EnterpriseCuttersReport'

import { useReportsModuleData, HISTORY_REPORT_TABS } from './reports/hooks/useReportsModuleData'
import { ReportsHeader } from './reports/components/ReportsHeader'
import { ReportsSidebar } from './reports/components/ReportsSidebar'
import { ReportsCatalogView } from './reports/components/ReportsCatalogView'
import { REPORT_IDS } from './reports/reportsRegistry'
import { WarehouseReportView } from './reports/components/WarehouseReportView'
import { EmployeeReportView } from './reports/components/EmployeeReportView'
import { ScrapReportView } from './reports/components/ScrapReportView'
import { SuppliesReportView } from './reports/components/SuppliesReportView'
import { MachinesReportView } from './reports/components/MachinesReportView'
import { EfficiencyReportView } from './reports/components/EfficiencyReportView'
import { ArchiveReportView } from './reports/components/ArchiveReportView'
import { AnalyticsReportView } from './reports/components/AnalyticsReportView'
import './reports/ReportsStyles.css'

const ReportsModule = () => {
  const { reportId } = useParams()
  const navigate = useNavigate()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  const {
    inventory,
    tasks,
    orders,
    nomenclatures,
    receptionDocs,
    requests,
    workCards,
    machines,
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
    productionSummary,
    scrapStats,
    scrapReasonsStats,
    generalStats,
    supplyStats,
    cuttersStats,
    cutterEventsList,
    totalCuttersUsed,
    totalCuttersSupplied,
    machineReport,
    efficiencyReport,
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
        return (
          <EmployeeReportView
            employeeStats={employeeStats}
            productionSummary={productionSummary}
            selectedEmployeeFilter={selectedEmployeeFilter}
            setSelectedEmployeeFilter={setSelectedEmployeeFilter}
            startDate={startDate}
            endDate={endDate}
          />
        )

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
          <EnterpriseSheetsReport
            startDate={startDate}
            endDate={endDate}
            setStartDate={setStartDate}
            setEndDate={setEndDate}
          />
        )

      case 'cutters':
        return (
          <EnterpriseCuttersReport
            startDate={startDate}
            endDate={endDate}
            setStartDate={setStartDate}
            setEndDate={setEndDate}
          />
        )

      case 'machines':
        return (
          <MachinesReportView
            machineReport={machineReport}
            startDate={startDate}
            endDate={endDate}
            isSyncing={isSyncing}
          />
        )

      case 'efficiency':
        return (
          <EfficiencyReportView
            efficiencyReport={efficiencyReport}
            isSyncing={isSyncing}
            startDate={startDate}
            endDate={endDate}
            onExport={handleExport}
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

  const isCatalog = !reportId || !REPORT_IDS.has(reportId)

  useEffect(() => {
    if (reportId && REPORT_IDS.has(reportId) && reportId !== activeTab) {
      setActiveTab(reportId)
    }
  }, [reportId, activeTab, setActiveTab])

  const handleSelectReport = (id) => {
    setActiveTab(id)
    navigate(`/reports/${id}`)
  }

  return (
    <div className="reports-module" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <ReportsHeader
        isCatalog={isCatalog}
        activeTab={activeTab}
        setActiveTab={handleSelectReport}
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

      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {!isCatalog && (
          <ReportsSidebar
            activeTab={activeTab}
            onSelectReport={handleSelectReport}
            isCollapsed={isSidebarCollapsed}
            setIsCollapsed={setIsSidebarCollapsed}
          />
        )}

        <div style={{ flex: 1, padding: '20px 25px 25px 25px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1 }}>
            {isCatalog ? (
              <ReportsCatalogView onSelectReport={handleSelectReport} />
            ) : (
              renderTabContent()
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReportsModule
