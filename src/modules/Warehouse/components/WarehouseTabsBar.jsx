import React from 'react'
import { Archive, ArrowLeft } from 'lucide-react'

export const WarehouseTabsBar = ({
  tabs,
  activeTab,
  setActiveTab,
  setNewItem,
  newItem,
  setSearchParams,
  isStockView,
  onToggleStock
}) => {
  return (
    <div className="so-workspace-navigation">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`warehouse-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => {
            setActiveTab(tab.id)
            setNewItem({ ...newItem, type: tab.id })
            setSearchParams({ tab: tab.id })
          }}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: activeTab === tab.id ? '#ff9000' : '#111',
            color: activeTab === tab.id ? '#000' : '#555',
            border: '1px solid #222',
            padding: '12px 20px',
            borderRadius: '14px',
            fontSize: '0.85rem',
            fontWeight: 800,
            cursor: 'pointer',
            transition: '0.2s',
            whiteSpace: 'nowrap'
          }}
        >
          {tab.icon}
          <span>{tab.label}</span>
          {tab.count > 0 && (
            <span className="tab-count-badge" style={{
              marginLeft: '5px',
              background: activeTab === tab.id ? '#000' : '#ff9000',
              color: activeTab === tab.id ? '#ff9000' : '#000',
              fontSize: '0.7rem',
              padding: '2px 8px',
              borderRadius: '8px',
              minWidth: '20px',
              textAlign: 'center',
              fontWeight: 1000,
              boxShadow: activeTab === tab.id ? 'none' : '0 2px 5px rgba(255,144,0,0.3)'
            }}>
              {tab.count}
            </span>
          )}
        </button>
      ))}

      <button type="button" className="so-stock-access" onClick={onToggleStock} aria-pressed={isStockView}>
        {isStockView ? <ArrowLeft size={20} /> : <Archive size={20} />}
        <span>{isStockView ? 'До видачі на наряди' : 'Переглянути залишки СО'}</span>
      </button>
    </div>
  )
}
