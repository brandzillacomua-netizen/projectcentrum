import React from 'react'
import { ShiftCalendarView } from './Shop1/components/ShiftCalendarView'
import { Shop2ForemanHeader } from './Shop2Foreman/components/Shop2ForemanHeader'
import { Shop2TodayShiftBanner } from './Shop2Foreman/components/Shop2TodayShiftBanner'
import { Shop2MonitoringView } from './Shop2Foreman/components/Shop2MonitoringView'
import { Shop2StaffView } from './Shop2Foreman/components/Shop2StaffView'
import { useShop2ForemanData } from './Shop2Foreman/hooks/useShop2ForemanData'
import './Shop1/Shop1ForemanStyles.css'

export const Shop2ForemanModule: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    userSearch,
    setUserSearch,
    isProcessing,
    currentYear,
    currentMonth,
    daysInMonth,
    monthNames,
    weekDayNames,
    handleMonthChange,
    openAccordions,
    toggleAccordion,
    handleToggleDayShift,
    categorizedCalendarUsers,
    todayShiftSummary,
    shop2Cards,
    filteredUsers,
    resolvedShop2Positions,
    userForm,
    setUserForm,
    handleSaveUser,
    editUser,
    handleResetPassword,
    formatUserName
  } = useShop2ForemanData()

  return (
    <div className="shop1-foreman-module">
      <div className="shop1-container">
        <Shop2ForemanHeader activeTab={activeTab} setActiveTab={setActiveTab} />

        {activeTab === 'calendar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <Shop2TodayShiftBanner todayShiftSummary={todayShiftSummary} />
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
              masterCheckins={{}}
              operatorCheckins={{}}
              formatUserName={formatUserName}
            />
          </div>
        )}

        {activeTab === 'monitoring' && (
          <Shop2MonitoringView shop2Cards={shop2Cards} />
        )}

        {activeTab === 'staff' && (
          <Shop2StaffView
            userForm={userForm}
            setUserForm={setUserForm}
            handleSaveUser={handleSaveUser}
            isProcessing={isProcessing}
            resolvedShop2Positions={resolvedShop2Positions}
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

export default Shop2ForemanModule

