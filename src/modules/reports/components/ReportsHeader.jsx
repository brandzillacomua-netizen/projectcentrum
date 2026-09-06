import React, { useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  BarChart2,
  Download,
  Calendar,
  Warehouse,
  Users,
  AlertTriangle,
  Truck,
  PackageCheck,
  Scissors,
  TrendingUp,
  Archive,
  Filter,
  X
} from 'lucide-react'

export const ReportsHeader = ({
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
  handleQuickDateSelect
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

  return (
    <>
      <nav className="module-nav reports-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link to="/" className="reports-nav-back">
            <ArrowLeft size={18} /> Назад
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BarChart2 className="text-secondary" size={24} color="#ff9000" />
            <h1 className="reports-nav-title">Центр Звітів</h1>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <button className="reports-nav-export-btn">
            <Download size={14} /> ЕКСПОРТ
          </button>
        </div>
      </nav>

      <div style={{ padding: '25px 25px 0 25px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
          <div className="tabs-container reports-tabs-bar">
            <button onClick={() => setActiveTab('monthly')} className={`report-tab ${activeTab === 'monthly' ? 'active' : ''}`}>
              <Calendar size={16} /> МІСЯЧНИЙ ЗВІТ
            </button>
            <button onClick={() => setActiveTab('warehouse')} className={`report-tab ${activeTab === 'warehouse' ? 'active' : ''}`}>
              <Warehouse size={16} /> СКЛАД
            </button>
            <button onClick={() => setActiveTab('employees')} className={`report-tab ${activeTab === 'employees' ? 'active' : ''}`}>
              <Users size={16} /> ПРАЦІВНИКИ
            </button>
            <button onClick={() => setActiveTab('scrap')} className={`report-tab ${activeTab === 'scrap' ? 'active' : ''}`}>
              <AlertTriangle size={16} /> БРАК
            </button>
            <button onClick={() => setActiveTab('supplies')} className={`report-tab ${activeTab === 'supplies' ? 'active' : ''}`}>
              <Truck size={16} /> ПОСТАВКИ
            </button>
            <button onClick={() => setActiveTab('sheets')} className={`report-tab ${activeTab === 'sheets' ? 'active' : ''}`}>
              <PackageCheck size={16} /> ЛИСТИ
            </button>
            <button onClick={() => setActiveTab('cutters')} className={`report-tab ${activeTab === 'cutters' ? 'active' : ''}`}>
              <Scissors size={16} /> ФРЕЗИ
            </button>
            <button onClick={() => setActiveTab('analytics')} className={`report-tab ${activeTab === 'analytics' ? 'active' : ''}`}>
              <TrendingUp size={16} /> АНАЛІТИКА
            </button>
            <button onClick={() => setActiveTab('archive')} className={`report-tab ${activeTab === 'archive' ? 'active' : ''}`}>
              <Archive size={16} /> АРХІВ
            </button>
          </div>

          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
            {activeTab !== 'monthly' && (
              <div style={{ position: 'relative' }}>
                <Filter size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#555' }} />
                <input
                  className="reports-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Фільтр по назві..."
                />
              </div>
            )}

            {activeTab !== 'warehouse' && activeTab !== 'monthly' && (
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

                <select
                  className="reports-filter-select"
                  value={selectedEmployeeFilter}
                  onChange={e => setSelectedEmployeeFilter(e.target.value)}
                  style={{ maxWidth: '200px' }}
                >
                  <option value="all">-- Всі працівники --</option>
                  {uniqueOperators.map(op => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>

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

                  <span style={{ color: '#555', cursor: 'pointer' }} onClick={openStartPicker}>—</span>

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
                    <option value="month">Останній місяць</option>
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
    </>
  )
}
