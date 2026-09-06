import React from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  LayoutDashboard,
  Calendar,
  RefreshCw,
  Briefcase,
  Users
} from 'lucide-react'

export const Shop1ForemanHeader = ({ activeTab, setActiveTab }) => {
  return (
    <>
      <div className="shop1-header-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Link to="/" className="shop1-back-btn">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="shop1-header-title" style={{ margin: 0, fontSize: '1.4rem', fontWeight: 950, display: 'flex', alignItems: 'center', gap: '8px' }}>
              👑 КАБІНЕТ НАЧАЛЬНИКА ЦЕХУ №1
            </h1>
            <div className="shop1-header-subtitle" style={{ fontSize: '0.75rem', marginTop: '2px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Контроль верстатів, розклад операторів та управління правами цеху
            </div>
          </div>
        </div>

        <div className="shop1-tab-container" style={{ display: 'flex', gap: '6px', padding: '6px', borderRadius: '16px', flexWrap: 'wrap' }}>
          <button onClick={() => setActiveTab('dashboard')} className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}>
            <LayoutDashboard size={16} /> Моніторинг
          </button>
          <button onClick={() => setActiveTab('calendar')} className={`tab-btn ${activeTab === 'calendar' ? 'active' : ''}`}>
            <Calendar size={16} /> Календар змін
          </button>
          <button onClick={() => setActiveTab('shifts_report')} className={`tab-btn ${activeTab === 'shifts_report' ? 'active' : ''}`}>
            <RefreshCw size={16} /> Звіт по змінах
          </button>
          <button onClick={() => setActiveTab('nariad_reports')} className={`tab-btn ${activeTab === 'nariad_reports' ? 'active' : ''}`}>
            <Briefcase size={16} /> Звіти по нарядах
          </button>
          <button onClick={() => setActiveTab('monthly_report')} className={`tab-btn ${activeTab === 'monthly_report' ? 'active' : ''}`}>
            <Calendar size={16} /> Місячний звіт
          </button>
          <button onClick={() => setActiveTab('staff')} className={`tab-btn ${activeTab === 'staff' ? 'active' : ''}`}>
            <Users size={16} /> Персонал
          </button>
        </div>
      </div>

      <hr className="shop1-header-divider" style={{ border: 'none', height: '1px', background: 'rgba(255,255,255,0.03)', margin: '0' }} />
    </>
  )
}

