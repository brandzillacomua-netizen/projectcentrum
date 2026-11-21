import React, { useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  BarChart2,
  Download,
  Calendar,
  Filter,
  X
} from 'lucide-react'
import { EmployeeMultiSelect } from './EmployeeMultiSelect'
import { REPORTS_REGISTRY } from '../reportsRegistry'

export const ReportsHeader = ({
  isCatalog = false,
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  selectedShiftFilter,
  setSelectedShiftFilter,
  selectedEmployeeFilter,
  setSelectedEmployeeFilter,
  uniqueOperators,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  quickPeriod,
  setQuickPeriod,
  handleQuickDateSelect,
  handleExport
}) => {
  const startInputRef = useRef(null)
  const endInputRef = useRef(null)

  const openStartPicker = () => {
    try {
      if (startInputRef.current && startInputRef.current.showPicker) {
        startInputRef.current.showPicker()
      } else if (startInputRef.current) {
        startInputRef.current.focus()
      }
    } catch (e) {}
  }

  const openEndPicker = () => {
    try {
      if (endInputRef.current && endInputRef.current.showPicker) {
        endInputRef.current.showPicker()
      } else if (endInputRef.current) {
        endInputRef.current.focus()
      }
    } catch (e) {}
  }

  const currentReport = REPORTS_REGISTRY.find(r => r.id === activeTab)
  const showGlobalFilters = !isCatalog && activeTab !== 'monthly' && activeTab !== 'sheets' && activeTab !== 'cutters'

  return (
    <>
      <nav className="module-nav reports-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link to={isCatalog ? '/' : '/reports'} className="reports-nav-back">
            <ArrowLeft size={18} /> {isCatalog ? 'Назад' : 'Категорії звітів'}
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BarChart2 className="text-secondary" size={24} color="#ff9000" />
            <h1 className="reports-nav-title">Центр Звітів</h1>
            {!isCatalog && currentReport && (
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', paddingLeft: '10px', borderLeft: '1px solid var(--border-subtle)' }}>
                {currentReport.title}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          {!isCatalog && (
            <button onClick={handleExport} className="reports-nav-export-btn">
              <Download size={14} /> ЕКСПОРТ
            </button>
          )}
        </div>
      </nav>

      {showGlobalFilters && (
        <div style={{ padding: '14px 25px 0 25px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '15px' }}>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <Filter size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                <input
                  className="reports-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Фільтр по назві..."
                />
              </div>

              {activeTab !== 'warehouse' && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  className="reports-filter-select"
                  value={selectedShiftFilter}
                  onChange={e => setSelectedShiftFilter(e.target.value)}
                >
                  <option value="all">-- Всі зміни --</option>
                  <option value="Зміна 1">Зміна 1</option>
                  <option value="Зміна 2">Зміна 2</option>
                  <option value="Зміна 3">Зміна 3</option>
                  <option value="Зміна 4">Зміна 4</option>
                  <option value="Без зміни">Без зміни</option>
                </select>

                <EmployeeMultiSelect
                  selected={selectedEmployeeFilter}
                  onChange={setSelectedEmployeeFilter}
                  options={uniqueOperators}
                />

                <div className="period-picker-container">
                  <div
                    className="period-picker-label"
                    onClick={openStartPicker}
                  >
                    <Calendar size={14} color="#888" style={{ marginRight: '8px' }} />
                    <span>Період:</span>
                  </div>

                  <div onClick={openStartPicker} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <input
                      ref={startInputRef}
                      type="date"
                      className="period-date-input"
                      value={startDate}
                      onClick={openStartPicker}
                      onFocus={openStartPicker}
                      onChange={(e) => { setStartDate(e.target.value); setQuickPeriod(''); }}
                    />
                  </div>

                  <span style={{ color: 'var(--text-dim)', cursor: 'pointer' }} onClick={openStartPicker}>—</span>

                  <div onClick={openEndPicker} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <input
                      ref={endInputRef}
                      type="date"
                      className="period-date-input"
                      value={endDate}
                      onClick={openEndPicker}
                      onFocus={openEndPicker}
                      onChange={(e) => { setEndDate(e.target.value); setQuickPeriod(''); }}
                    />
                  </div>

                  {(startDate || endDate) && (
                    <button
                      onClick={() => { setStartDate(''); setEndDate(''); setQuickPeriod(''); }}
                      className="period-clear-btn"
                      title="Очистити період"
                    >
                      <X size={14} />
                    </button>
                  )}

                  <select
                    onChange={handleQuickDateSelect}
                    value={quickPeriod}
                    className="period-quick-select"
                  >
                    <option value="" disabled hidden>ОБРАТИ ПЕРІОД</option>
                    <option value="today">Сьогодні</option>
                    <option value="yesterday">Вчора</option>
                    <option value="3days">Останні 3 дні</option>
                    <option value="week">Останній тиждень</option>
                    <option value="this_month">Цей місяць</option>
                    <option value="previous_month">Минулий місяць</option>
                    <option value="quarter">Останній квартал</option>
                    <option value="halfyear">Останні пів року</option>
                    <option value="year">Останній рік</option>
                  </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
