import React, { useState } from 'react'
import { Layers, Package, ClipboardList, ChevronDown, ChevronUp } from 'lucide-react'

export function Shop2BufferTab({
  t,
  isDark,
  shop2BufferCards,
  totalShop2BufferParts,
  shop2BufferTaskGroups,
  filteredShop2BufferTaskGroups,
  shop2BufferConsolidatedItems,
  searchQuery
}) {
  const [bufferViewMode, setBufferViewMode] = useState(() => {
    return localStorage.getItem('sgp_buffer_view_mode') || 'table'
  })
  const [collapsedBufferGroups, setCollapsedBufferGroups] = useState(() => new Set())

  const toggleBufferGroup = (key) => {
    setCollapsedBufferGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const collapseAllBufferGroups = () => {
    setCollapsedBufferGroups(new Set(shop2BufferTaskGroups.map(g => g.taskId)))
  }

  const expandAllBufferGroups = () => {
    setCollapsedBufferGroups(new Set())
  }

  return (
    <div>
      {/* 1. Header KPIs banner */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '16px',
        marginBottom: '25px'
      }}>
        {/* Card 1: Вільні деталі в буфері */}
        <div style={{
          background: isDark ? 'linear-gradient(135deg, rgba(139,92,246,0.18) 0%, rgba(139,92,246,0.06) 100%)' : '#f5f3ff',
          border: `1.5px solid ${isDark ? 'rgba(139,92,246,0.4)' : '#ddd6fe'}`,
          borderRadius: '18px',
          padding: '18px 22px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: isDark ? '0 4px 18px rgba(139,92,246,0.12)' : '0 2px 10px rgba(139,92,246,0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 950, color: isDark ? '#c4b5fd' : '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ВХІДНИЙ БУФЕР ЦЕХУ №2
            </span>
            <Package size={18} color={isDark ? '#c4b5fd' : '#7c3aed'} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '2.2rem', fontWeight: 1000, color: isDark ? '#ffffff' : '#4c1d95', lineHeight: 1 }}>
              {totalShop2BufferParts.toLocaleString('uk-UA')}
            </span>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: isDark ? '#c4b5fd' : '#6d28d9' }}>шт</span>
          </div>
          <div style={{ marginTop: '8px', fontSize: '0.75rem', fontWeight: 700, color: isDark ? '#a78bfa' : '#6d28d9', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#8b5cf6', display: 'inline-block' }} />
            Вільні для запуску в роботу Цеху 2
          </div>
        </div>

        {/* Card 2: Нарядів у буфері */}
        <div style={{
          background: isDark ? '#161924' : '#ffffff',
          border: `1.5px solid ${isDark ? '#232938' : '#e2e8f0'}`,
          borderRadius: '18px',
          padding: '18px 22px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 900, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              НАРЯДІВ У БУФЕРІ
            </span>
            <ClipboardList size={18} color={t.textSecondary} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '2.2rem', fontWeight: 1000, color: t.textPrimary, lineHeight: 1 }}>
              {filteredShop2BufferTaskGroups.length}
            </span>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: t.textMuted }}>нарядів</span>
          </div>
          <div style={{ marginTop: '8px', fontSize: '0.75rem', fontWeight: 700, color: t.textMuted }}>
            Очікують взяття в роботу
          </div>
        </div>

        {/* Card 3: Активних карток */}
        <div style={{
          background: isDark ? '#161924' : '#ffffff',
          border: `1.5px solid ${isDark ? '#232938' : '#e2e8f0'}`,
          borderRadius: '18px',
          padding: '18px 22px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 900, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              КАРТОК У БУФЕРІ
            </span>
            <Layers size={18} color={t.textSecondary} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '2.2rem', fontWeight: 1000, color: t.textPrimary, lineHeight: 1 }}>
              {shop2BufferCards.length}
            </span>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: t.textMuted }}>виробничих карток</span>
          </div>
          <div style={{ marginTop: '8px', fontSize: '0.75rem', fontWeight: 700, color: isDark ? '#34d399' : '#059669', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            Передано з розкрою Цеху №1
          </div>
        </div>
      </div>

      {/* 2. Controls bar: Switch between 'По нарядах' and 'Зведена таблиця' */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px', paddingBottom: '16px', borderBottom: `1px solid ${t.tableRowBorder}` }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => {
              setBufferViewMode('table')
              localStorage.setItem('sgp_buffer_view_mode', 'table')
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '10px',
              border: bufferViewMode === 'table' ? '1.5px solid #8b5cf6' : `1px solid ${t.buttonSecondaryBorder}`,
              background: bufferViewMode === 'table' ? (isDark ? 'rgba(139,92,246,0.2)' : '#ede9fe') : t.buttonSecondaryBg,
              color: bufferViewMode === 'table' ? (isDark ? '#c4b5fd' : '#6d28d9') : t.textSecondary,
              fontWeight: 900,
              fontSize: '0.82rem',
              cursor: 'pointer'
            }}
          >
            <Layers size={15} />
            Зведена таблиця деталей
          </button>
          <button
            onClick={() => {
              setBufferViewMode('orders')
              localStorage.setItem('sgp_buffer_view_mode', 'orders')
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '10px',
              border: bufferViewMode === 'orders' ? '1.5px solid #8b5cf6' : `1px solid ${t.buttonSecondaryBorder}`,
              background: bufferViewMode === 'orders' ? (isDark ? 'rgba(139,92,246,0.2)' : '#ede9fe') : t.buttonSecondaryBg,
              color: bufferViewMode === 'orders' ? (isDark ? '#c4b5fd' : '#6d28d9') : t.textSecondary,
              fontWeight: 900,
              fontSize: '0.82rem',
              cursor: 'pointer'
            }}
          >
            <ClipboardList size={15} />
            По нарядах
          </button>
        </div>

        {bufferViewMode === 'orders' && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={expandAllBufferGroups}
              style={{ background: 'none', border: `1px solid ${t.buttonSecondaryBorder}`, color: t.textSecondary, padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
            >
              Розгорнути всі
            </button>
            <button
              onClick={collapseAllBufferGroups}
              style={{ background: 'none', border: `1px solid ${t.buttonSecondaryBorder}`, color: t.textSecondary, padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
            >
              Згорнути всі
            </button>
          </div>
        )}
      </div>

      {/* 3. Main content based on view mode */}
      {bufferViewMode === 'orders' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredShop2BufferTaskGroups.map(group => {
            const isCollapsed = collapsedBufferGroups.has(group.taskId)
            const itemsList = Object.values(group.items)
            return (
              <div
                key={group.taskId}
                style={{
                  background: isDark ? '#141722' : '#ffffff',
                  border: `1.5px solid ${isDark ? '#232938' : '#e2e8f0'}`,
                  borderRadius: '16px',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease',
                  boxShadow: isDark ? '0 2px 10px rgba(0,0,0,0.2)' : '0 1px 4px rgba(0,0,0,0.03)'
                }}
              >
                {/* Group header */}
                <div
                  onClick={() => toggleBufferGroup(group.taskId)}
                  style={{
                    padding: '14px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: isDark ? '#161924' : '#fafafa',
                    borderBottom: isCollapsed ? 'none' : `1px solid ${t.tableRowBorder}`,
                    userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '8px',
                      background: isDark ? 'rgba(139,92,246,0.18)' : '#ede9fe',
                      border: `1px solid ${isDark ? 'rgba(139,92,246,0.35)' : '#c4b5fd'}`,
                      color: isDark ? '#c4b5fd' : '#6d28d9',
                      fontWeight: 950,
                      fontSize: '0.85rem'
                    }}>
                      {group.orderNum}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: t.textMuted, fontWeight: 700 }}>
                      {itemsList.length} {itemsList.length === 1 ? 'найменування' : itemsList.length < 5 ? 'найменування' : 'найменувань'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 14px',
                      borderRadius: '10px',
                      background: isDark ? 'rgba(139,92,246,0.15)' : '#f5f3ff',
                      border: `1px solid ${isDark ? 'rgba(139,92,246,0.3)' : '#ddd6fe'}`,
                      color: isDark ? '#c4b5fd' : '#6d28d9',
                      fontWeight: 950,
                      fontSize: '0.88rem'
                    }}>
                      <span>Всього в буфері:</span>
                      <strong>{group.totalQty.toLocaleString('uk-UA')} шт</strong>
                    </div>
                    {isCollapsed ? <ChevronDown size={18} color={t.textSecondary} /> : <ChevronUp size={18} color={t.textSecondary} />}
                  </div>
                </div>

                {/* Group body (part cards - matches screenshot 2!) */}
                {!isCollapsed && (
                  <div style={{
                    padding: '16px 20px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    {itemsList.map(item => (
                      <div
                        key={item.nomId}
                        style={{
                          flex: '1 1 260px',
                          maxWidth: '360px',
                          background: isDark ? '#12141c' : '#ffffff',
                          border: `1.5px solid ${isDark ? '#1f2430' : '#e2e8f0'}`,
                          borderRadius: '12px',
                          padding: '12px 16px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          transition: 'transform 0.15s ease, border-color 0.15s ease',
                          boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.02)'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.transform = 'translateY(-2px)'
                          e.currentTarget.style.borderColor = isDark ? '#8b5cf6' : '#c4b5fd'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = 'none'
                          e.currentTarget.style.borderColor = isDark ? '#1f2430' : '#e2e8f0'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.84rem', color: t.textPrimary, lineHeight: 1.3 }}>
                            {item.name}
                          </span>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 1000, color: isDark ? '#34d399' : '#059669', lineHeight: 1 }}>
                              {item.total_qty.toLocaleString('uk-UA')}
                            </div>
                            <div style={{ fontSize: '0.62rem', fontWeight: 800, color: t.textMuted, marginTop: '2px' }}>вільних дет.</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', paddingTop: '6px', borderTop: `1px solid ${t.tableRowBorder}` }}>
                          <span style={{ fontSize: '0.72rem', color: t.textMuted, fontWeight: 700 }}>
                            {item.material}{item.thickness ? ` (${item.thickness})` : ''}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: isDark ? '#a78bfa' : '#7c3aed', fontWeight: 800 }}>
                            {item.cardCount} {item.cardCount === 1 ? 'картка' : 'картки'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {filteredShop2BufferTaskGroups.length === 0 && (
            <div style={{ padding: '60px', textAlign: 'center', color: t.textMuted }}>
              <Package size={48} style={{ opacity: 0.2, marginBottom: '12px' }} />
              <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                {searchQuery ? 'За вашим запитом у буфері нічого не знайдено' : 'У буфері Цеху №2 наразі немає деталей'}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Table view */
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: t.tableHeadBg, borderBottom: `1.5px solid ${t.tableBorder}`, textAlign: 'left', color: t.textSecondary, fontSize: '0.74rem' }}>
              <th style={{ padding: '14px 16px' }}>НАЙМЕНУВАННЯ ДЕТАЛІ</th>
              <th style={{ padding: '14px 16px' }}>МАТЕРІАЛ / ТОВЩИНА</th>
              <th style={{ padding: '14px 16px' }}>НАРЯДИ У БУФЕРІ</th>
              <th style={{ padding: '14px 16px', textAlign: 'center', width: '160px' }}>ВІЛЬНО В БУФЕРІ</th>
              <th style={{ padding: '14px 16px', textAlign: 'center', width: '120px' }}>КАРТОК</th>
              <th style={{ padding: '14px 16px', textAlign: 'center', width: '160px' }}>СТАТУС</th>
            </tr>
          </thead>
          <tbody>
            {shop2BufferConsolidatedItems.map(item => (
              <tr key={item.key} style={{ borderBottom: `1px solid ${t.tableRowBorder}`, fontSize: '0.85rem' }}>
                <td style={{ padding: '14px 16px', fontWeight: 800, color: t.textPrimary }}>
                  {item.name}
                </td>
                <td style={{ padding: '14px 16px', color: t.textSecondary, fontSize: '0.82rem', fontWeight: 600 }}>
                  {item.material}{item.thickness ? ` (${item.thickness})` : ''}
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {item.naryadList.map(nr => (
                      <span key={nr} style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: isDark ? 'rgba(139,92,246,0.15)' : '#ede9fe',
                        color: isDark ? '#c4b5fd' : '#6d28d9',
                        fontSize: '0.72rem',
                        fontWeight: 800
                      }}>
                        {nr}
                      </span>
                    ))}
                  </div>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'baseline',
                    gap: '4px',
                    padding: '6px 14px',
                    borderRadius: '12px',
                    background: isDark ? 'rgba(139,92,246,0.15)' : '#f5f3ff',
                    border: `1px solid ${isDark ? 'rgba(139,92,246,0.35)' : '#ddd6fe'}`,
                    color: isDark ? '#c4b5fd' : '#6d28d9',
                    fontWeight: 950,
                    fontSize: '0.92rem'
                  }}>
                    <span>{item.total_qty.toLocaleString('uk-UA')}</span>
                    <small style={{ opacity: 0.8, fontSize: '0.72rem' }}>{item.unit}</small>
                  </div>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 800, color: t.textPrimary }}>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '8px',
                    background: isDark ? '#1a1e2b' : '#f1f5f9',
                    fontSize: '0.78rem',
                    fontWeight: 900
                  }}>
                    {item.cardCount}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: isDark ? 'rgba(16,185,129,0.12)' : '#ecfdf5',
                    border: `1px solid ${isDark ? 'rgba(16,185,129,0.25)' : '#a7f3d0'}`,
                    color: isDark ? '#34d399' : '#047857',
                    fontSize: '0.74rem',
                    fontWeight: 900
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                    Вільні для Цеху 2
                  </span>
                </td>
              </tr>
            ))}

            {shop2BufferConsolidatedItems.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '50px', textAlign: 'center', color: t.textMuted }}>
                  {searchQuery ? 'За вашим запитом деталей не знайдено' : 'У буфері Цеху №2 наразі немає деталей'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
