import React from 'react'
import MonthlyReport from './reports/MonthlyReport'
import SheetsReport from './reports/SheetsReport'

import { useReportsModuleData } from './reports/hooks/useReportsModuleData'
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
    setArchiveLoaded,
    setAllArchiveTasks
  } = useReportsModuleData()

  const renderTabContent = () => {
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
        return <CuttersReportView cuttersStats={cuttersStats} />

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
