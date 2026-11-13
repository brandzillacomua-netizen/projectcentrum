import React from 'react';
import { Scissors, ListOrdered, Boxes, BarChart3 } from 'lucide-react';
import { ACCENT_RUBBER, ACCENT_RUBBER_RGB } from '../utils/rubberConstants';

export function RubberTabs({ activeTab, setActiveTab, queueCount = 0, partsCount = 20 }) {
  const tabs = [
    { id: 'cutting', label: 'Робоче місце порізки', icon: <Scissors size={16} /> },
    { id: 'queue', label: 'Черга завдань', icon: <ListOrdered size={16} />, badge: queueCount },
    { id: 'stock', label: 'Залишки сировини СВ', icon: <Boxes size={16} />, badge: `${partsCount} дет.` },
    { id: 'analytics', label: 'Журнал & Ефективність', icon: <BarChart3 size={16} /> }
  ];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '16px 24px 0 24px',
      borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
      background: 'rgba(10,10,14,0.6)',
      overflowX: 'auto'
    }}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderTopLeftRadius: '12px',
              borderTopRightRadius: '12px',
              borderBottomLeftRadius: '0px',
              borderBottomRightRadius: '0px',
              border: 'none',
              borderBottom: isActive ? `3px solid ${ACCENT_RUBBER}` : '3px solid transparent',
              background: isActive ? 'rgba(255,144,0,0.12)' : 'transparent',
              color: isActive ? '#fff' : 'var(--text-muted, #94a3b8)',
              fontWeight: isActive ? 900 : 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap'
            }}
          >
            <span style={{ color: isActive ? ACCENT_RUBBER : 'inherit' }}>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge !== null && tab.badge !== 0 && (
              <span style={{
                background: isActive ? `rgba(${ACCENT_RUBBER_RGB}, 0.25)` : 'rgba(255,255,255,0.08)',
                color: isActive ? ACCENT_RUBBER : 'var(--text-dim, #64748b)',
                padding: '1px 7px',
                borderRadius: '8px',
                fontSize: '0.68rem',
                fontWeight: 900
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

