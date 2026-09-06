import React from 'react'
import MonthlyReport from './reports/MonthlyReport'
import { Shop1ForemanHeader } from './Shop1/components/Shop1ForemanHeader'
import { ShiftCalendarView } from './Shop1/components/ShiftCalendarView'
import { MachineMonitorView } from './Shop1/components/MachineMonitorView'
import { ShiftsReportView } from './Shop1/components/ShiftsReportView'
import { NariadReportsView } from './Shop1/components/NariadReportsView'
import { StaffManagementView } from './Shop1/components/StaffManagementView'
import { useShop1ForemanData } from './Shop1/hooks/useShop1ForemanData'
import './Shop1/Shop1ForemanStyles.css'

export default function Shop1ForemanModule() {
  const {
    activeTab,
    setActiveTab,
    userSearch,
    setUserSearch,
    isProcessing,
    resolvedShop1Positions,
    userForm,
    setUserForm,
    currentYear,
    currentMonth,
    openAccordions,
    toggleAccordion,
    reportStartDate,
    setReportStartDate,
    reportEndDate,
    setReportEndDate,
    quickPeriod,
    setQuickPeriod,
    selectedReportDetails,
    setSelectedReportDetails,
    shiftReportLoading,
    nariadSearch,
    setNariadSearch,
    selectedNariadTaskId,
    nariadReportLoading,
    nariadReportData,
    nariadStageFilter,
    setNariadStageFilter,
    nariadNomFilter,
    setNariadNomFilter,
    nariadSortBy,
    setNariadSortBy,
    nariadDetailModal,
    setNariadDetailModal,
    nariadCatalogLoading,
    nariadCatalogTotal,
    nariadCatalogPage,
    setNariadCatalogPage,
    handleQuickDateSelect,
    filteredUsers,
    machineMonitorList,
    handleSaveUser,
    editUser,
    handleResetPassword,
    daysInMonth,
    monthNames,
    weekDayNames,
    handleMonthChange,
    handleToggleDayShift,
    categorizedCalendarUsers,
    shiftStats,
    operatorCheckins,
    masterCheckins,
    allOrdersMap,
    filteredTasks,
    handleOpenNariadReport,
    nomenclatures,
    inventory,
    machineOperations,
    formatUserName
  } = useShop1ForemanData()

  return (
    <div className="shop1-foreman-module">
      <div className="shop1-container">
        <Shop1ForemanHeader activeTab={activeTab} setActiveTab={setActiveTab} />

        {activeTab === 'monthly_report' && <MonthlyReport />}

        {activeTab === 'dashboard' && (
          <MachineMonitorView machineMonitorList={machineMonitorList} />
        )}

        {activeTab === 'calendar' && (
          <ShiftCalendarView
            currentYear={currentYear}
            currentMonth={currentMonth}
            monthNames={monthNames}
            weekDayNames={weekDayNames}
            daysInMonth={daysInMonth}
            handleMonthChange={handleMonthChange}
            handleToggleDayShift={handleToggleDayShift}
            categorizedCalendarUsers={categorizedCalendarUsers}
            openAccordions={openAccordions}
            toggleAccordion={toggleAccordion}
            masterCheckins={masterCheckins}
            operatorCheckins={operatorCheckins}
            formatUserName={formatUserName}
          />
        )}

        {activeTab === 'shifts_report' && (
          <ShiftsReportView
            reportStartDate={reportStartDate}
            setReportStartDate={setReportStartDate}
            reportEndDate={reportEndDate}
            setReportEndDate={setReportEndDate}
            quickPeriod={quickPeriod}
            setQuickPeriod={setQuickPeriod}
            handleQuickDateSelect={handleQuickDateSelect}
            shiftReportLoading={shiftReportLoading}
            shiftStats={shiftStats}
            selectedReportDetails={selectedReportDetails}
            setSelectedReportDetails={setSelectedReportDetails}
            nomenclatures={nomenclatures}
          />
        )}

        {activeTab === 'nariad_reports' && (
          <NariadReportsView
            nariadSearch={nariadSearch}
            setNariadSearch={setNariadSearch}
            nariadCatalogLoading={nariadCatalogLoading}
            nariadCatalogTotal={nariadCatalogTotal}
            nariadCatalogPage={nariadCatalogPage}
            setNariadCatalogPage={setNariadCatalogPage}
            filteredTasks={filteredTasks}
            allOrdersMap={allOrdersMap}
            selectedNariadTaskId={selectedNariadTaskId}
            handleOpenNariadReport={handleOpenNariadReport}
            nariadReportLoading={nariadReportLoading}
            nariadReportData={nariadReportData}
            nariadStageFilter={nariadStageFilter}
            setNariadStageFilter={setNariadStageFilter}
            nariadNomFilter={nariadNomFilter}
            setNariadNomFilter={setNariadNomFilter}
            nariadSortBy={nariadSortBy}
            setNariadSortBy={setNariadSortBy}
            setNariadDetailModal={setNariadDetailModal}
            nomenclatures={nomenclatures}
            inventory={inventory}
            machineOperations={machineOperations}
          />
        )}

        {activeTab === 'staff' && (
          <StaffManagementView
            userForm={userForm}
            setUserForm={setUserForm}
            handleSaveUser={handleSaveUser}
            isProcessing={isProcessing}
            resolvedShop1Positions={resolvedShop1Positions}
            userSearch={userSearch}
            setUserSearch={setUserSearch}
            filteredUsers={filteredUsers}
            editUser={editUser}
            handleResetPassword={handleResetPassword}
            formatUserName={formatUserName}
          />
        )}
      </div>
    </div>
  )
}
