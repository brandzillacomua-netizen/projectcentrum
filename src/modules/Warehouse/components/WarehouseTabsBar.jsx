import React from 'react'
import { Link } from 'react-router-dom'
import { IconSGP } from '../../../components/WarehouseIcons.jsx'

export const WarehouseTabsBar = ({
  tabs,
  activeTab,
  setActiveTab,
  setNewItem,
  newItem,
  setSearchParams,
  setSelectedPocketOwner
}) => {
  return (
    <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', overflowX: 'auto', paddingBottom: '5px' }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`warehouse-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => {
            setActiveTab(tab.id)
            setNewItem({ ...newItem, type: tab.id, pocket_owner: '' })
            setSearchParams({ tab: tab.id })
            setSelectedPocketOwner('')
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

      <Link
        to="/warehouse-fgp"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(16, 185, 129, 0.1)',
          color: '#10b981',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          padding: '12px 20px',
          borderRadius: '14px',
          fontSize: '0.85rem',
          fontWeight: 900,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          marginLeft: 'auto'
        }}
      >
        <IconSGP size={20} color="#10b981" />
        <span>Склад Готової Продукції (СГП) →</span>
      </Link>
    </div>
  )
}
