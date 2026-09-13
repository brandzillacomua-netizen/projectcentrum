import React from 'react'
import { Archive, Search, Plus } from 'lucide-react'
import { Shop2BufferTab } from './Shop2BufferTab'
import { InventoryTab } from './InventoryTab'

export function InventoryView({
  t,
  isDark,
  viewMode,
  setViewMode,
  setSearchParams,
  pendingPackagingRequests,
  tabs,
  activeTab,
  setActiveTab,
  tabCounts,
  searchQuery,
  setSearchQuery,
  showAdd,
  setShowAdd,
  newItem,
  setNewItem,
  handleAddInventoryItem,
  workCardHistory,
  shop2BufferCards,
  totalShop2BufferParts,
  shop2BufferTaskGroups,
  filteredShop2BufferTaskGroups,
  shop2BufferConsolidatedItems,
  filteredItems,
  isAdmin,
  setReserveAnalysisItem,
  fetchData,
  refreshTable
}) {
  if (viewMode !== 'inventory') return null

  return (
    <div style={{ padding: '25px', flex: 1, overflowY: 'auto' }}>
      
      {/* Top Bar back to requests */}
      <div style={{
        background: t.cardBg,
        border: `1.5px solid ${t.cardBorder}`,
        borderRadius: '16px',
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '10px',
        boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem', color: t.textPrimary }}>
          <Archive size={18} color={isDark ? '#34d399' : '#059669'} />
          <span>Режим: <strong>Відомість залишків на складі (Інвентаризація)</strong></span>
          {pendingPackagingRequests.length > 0 && (
            <span style={{
              background: isDark ? '#082f49' : '#e0f2fe',
              color: isDark ? '#7dd3fc' : '#0369a1',
              border: `1px solid ${isDark ? '#0284c7' : '#bae6fd'}`,
              fontSize: '0.72rem',
              fontWeight: 900,
              padding: '3px 10px',
              borderRadius: '12px'
            }}>
              {pendingPackagingRequests.length} поз. очікують видачі
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setViewMode('requests')
            setSearchParams(prev => {
              const np = new URLSearchParams(prev)
              np.delete('mode')
              return np
            })
          }}
          style={{
            background: '#10b981',
            color: '#ffffff',
            border: 'none',
            borderRadius: '10px',
            padding: '8px 16px',
            fontSize: '0.82rem',
            fontWeight: 900,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)'
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#059669' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#10b981' }}
        >
          ← Повернутись до черги запитів
        </button>
      </div>

      {/* Вкладки */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', overflowX: 'auto' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`warehouse-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(tab.id)
              setSearchParams(prev => {
                const np = new URLSearchParams(prev)
                np.set('tab', tab.id)
                return np
              })
            }}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: activeTab === tab.id ? '#10b981' : t.buttonSecondaryBg,
              color: activeTab === tab.id ? '#ffffff' : t.textSecondary,
              border: activeTab === tab.id ? '1.5px solid #059669' : `1.5px solid ${t.cardBorder}`,
              padding: '12px 20px',
              borderRadius: '14px',
              fontSize: '0.85rem',
              fontWeight: 900,
              cursor: 'pointer',
              transition: '0.15s',
              whiteSpace: 'nowrap',
              boxShadow: activeTab === tab.id ? '0 4px 14px rgba(16,185,129,0.25)' : (isDark ? '0 1px 3px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.02)')
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tabCounts[tab.id] > 0 && (
              <span className="tab-count-badge" style={{
                marginLeft: '6px',
                background: activeTab === tab.id ? 'rgba(255,255,255,0.25)' : (isDark ? '#232938' : '#f1f5f9'),
                color: activeTab === tab.id ? '#ffffff' : t.textPrimary,
                fontSize: '0.7rem',
                padding: '2px 8px',
                borderRadius: '8px',
                fontWeight: 1000
              }}>
                {tabCounts[tab.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Панель таблиці */}
      <div className="content-card" style={{ padding: '25px 25px 120px', borderRadius: '24px', background: t.cardBg, border: `1.5px solid ${t.cardBorder}`, boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '25px' }}>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 950, color: t.textPrimary }}>
            {tabs.find(t => t.id === activeTab)?.label.toUpperCase()}
          </h2>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: t.textSecondary }} />
              <input
                style={{ background: t.inputBg, border: `1.5px solid ${t.inputBorder}`, padding: '10px 14px 10px 36px', borderRadius: '12px', color: t.inputText, fontSize: '0.85rem', outline: 'none', width: '240px' }}
                placeholder={activeTab === 'shop2_buffer' ? "Пошук деталей або № наряду..." : "Пошук випущених позицій..."}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            {activeTab !== 'shop2_buffer' && activeTab !== 'registry' && (
              <button
                onClick={() => setShowAdd(!showAdd)}
                style={{ background: '#10b981', color: '#ffffff', border: 'none', padding: '10px 18px', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(16,185,129,0.25)' }}
              >
                <Plus size={18} /> Додати позицію
              </button>
            )}
          </div>
        </div>

        {showAdd && activeTab !== 'shop2_buffer' && activeTab !== 'registry' && (
          <form onSubmit={handleAddInventoryItem} style={{ display: 'flex', gap: '12px', padding: '16px', background: t.cardHeaderBg, border: `1.5px solid ${t.cardBorder}`, borderRadius: '16px', marginBottom: '25px', flexWrap: 'wrap' }}>
            <input
              style={{ flex: 2, minWidth: '220px', background: t.inputBg, border: `1.5px solid ${t.inputBorder}`, color: t.inputText, padding: '12px', borderRadius: '10px' }}
              placeholder="Назва готової деталі / метизу..."
              value={newItem.name}
              onChange={e => setNewItem({ ...newItem, name: e.target.value })}
              required
            />
            <input
              type="number"
              style={{ flex: 1, minWidth: '120px', background: t.inputBg, border: `1.5px solid ${t.inputBorder}`, color: t.inputText, padding: '12px', borderRadius: '10px' }}
              placeholder="Кількість"
              value={newItem.total_qty}
              onChange={e => setNewItem({ ...newItem, total_qty: e.target.value })}
              required
            />
            <button type="submit" style={{ background: '#10b981', color: '#ffffff', border: 'none', padding: '12px 25px', borderRadius: '10px', fontWeight: 900, cursor: 'pointer' }}>
              ЗБЕРЕГТИ
            </button>
          </form>
        )}

        {activeTab === 'shop2_buffer' ? (
          <Shop2BufferTab
            t={t}
            isDark={isDark}
            shop2BufferCards={shop2BufferCards}
            totalShop2BufferParts={totalShop2BufferParts}
            shop2BufferTaskGroups={shop2BufferTaskGroups}
            filteredShop2BufferTaskGroups={filteredShop2BufferTaskGroups}
            shop2BufferConsolidatedItems={shop2BufferConsolidatedItems}
            searchQuery={searchQuery}
          />
        ) : (
          <InventoryTab
            t={t}
            isDark={isDark}
            activeTab={activeTab}
            filteredItems={filteredItems}
            workCardHistory={workCardHistory}
            searchQuery={searchQuery}
            isAdmin={isAdmin}
            setReserveAnalysisItem={setReserveAnalysisItem}
            fetchData={fetchData}
            refreshTable={refreshTable}
          />
        )}
      </div>
    </div>
  )
}
