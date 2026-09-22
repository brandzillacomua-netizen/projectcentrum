import React from 'react'
import { Package, Clock, CheckCircle2, Search, ChevronsUpDown, ChevronDown, ChevronUp, User, AlertTriangle, Check, History, RefreshCw, Archive } from 'lucide-react'

export function PackagingQueueTab({
  t,
  isDark,
  groupedPackagingRequests,
  pendingPackagingRequests,
  activePackagingRequests,
  allPackagingRequests,
  completedPackagingRequests,
  requestQueueTab,
  setRequestQueueTab,
  isRefreshingQueue,
  fetchQueueFromDb,
  requestSearchQuery,
  setRequestSearchQuery,
  orderStatusFilter,
  setOrderStatusFilter,
  orderStats,
  filteredOrderGroups,
  collapsedOrders,
  toggleOrderCollapse,
  expandAll,
  collapseAll,
  getItemDisplayName,
  getItemCategoryBadge,
  getSgpStock,
  handleIssueAllForOrder,
  isIssuingReq,
  handleIssueRequest,
  inventory,
  setViewMode
}) {
  const getUniqueGroupsCount = (reqs) => new Set(reqs.map(r => r.task_id ? `task-${r.task_id}` : `order-${r.order_id}`)).size;

  return (
    <div style={{ padding: '25px', flex: 1, overflowY: 'auto' }}>
      {/* KPI Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '15px',
        marginBottom: '20px'
      }}>
        <div style={{ background: t.cardBg, border: `1.5px solid ${t.cardBorder}`, borderRadius: '16px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.02)' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: t.kpiBlueIconBg, border: `1px solid ${t.kpiBlueIconBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={22} color={isDark ? '#38bdf8' : '#0284c7'} />
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: t.textSecondary, fontWeight: 800, textTransform: 'uppercase' }}>Нарядів у черзі</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 1000, color: t.textPrimary }}>{groupedPackagingRequests.length}</div>
          </div>
        </div>

        <div style={{ background: t.cardBg, border: `1.5px solid ${t.cardBorder}`, borderRadius: '16px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.02)' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: t.kpiAmberIconBg, border: `1px solid ${t.kpiAmberIconBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={22} color={isDark ? '#fbbf24' : '#d97706'} />
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: t.textSecondary, fontWeight: 800, textTransform: 'uppercase' }}>Позицій очікують</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 1000, color: isDark ? '#fbbf24' : '#d97706' }}>{pendingPackagingRequests.length} <span style={{ fontSize: '0.8rem', color: t.textSecondary }}>поз.</span></div>
          </div>
        </div>

        <div style={{ background: t.cardBg, border: `1.5px solid ${t.cardBorder}`, borderRadius: '16px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.02)' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: t.kpiGreenIconBg, border: `1px solid ${t.kpiGreenIconBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={22} color={isDark ? '#34d399' : '#059669'} />
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: t.textSecondary, fontWeight: 800, textTransform: 'uppercase' }}>Загальний обсяг</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 1000, color: isDark ? '#34d399' : '#059669' }}>
              {pendingPackagingRequests.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)} <span style={{ fontSize: '0.8rem', color: t.textSecondary }}>шт</span>
            </div>
          </div>
        </div>

        <div style={{ background: t.cardBg, border: `1.5px solid ${t.cardBorder}`, borderRadius: '16px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.02)' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: t.textSecondary, fontWeight: 800, textTransform: 'uppercase' }}>Залишки на СГП</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: t.textPrimary }}>{inventory.length} найменувань</div>
          </div>
          <button
            type="button"
            onClick={() => setViewMode('inventory')}
            style={{
              background: t.buttonSecondaryBg,
              border: `1.5px solid ${t.buttonSecondaryBorder}`,
              color: t.textPrimary,
              borderRadius: '10px',
              padding: '8px 14px',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              transition: '0.15s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = isDark ? '#1e2433' : '#ecfdf5'; e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.color = isDark ? '#34d399' : '#065f46' }}
            onMouseLeave={e => { e.currentTarget.style.background = t.buttonSecondaryBg; e.currentTarget.style.borderColor = t.buttonSecondaryBorder; e.currentTarget.style.color = t.textPrimary }}
          >
            Відомість →
          </button>
        </div>
      </div>

      {/* Subheader: Queue Tabs & Realtime Sync Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '20px',
        background: t.cardBg,
        border: `1.5px solid ${t.cardBorder}`,
        padding: '10px 18px',
        borderRadius: '14px',
        boxShadow: isDark ? '0 1px 4px rgba(0,0,0,0.2)' : '0 1px 4px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 900, color: t.textSecondary, marginRight: '6px', textTransform: 'uppercase' }}>
            Фільтр черги:
          </span>
          <button
            type="button"
            onClick={() => setRequestQueueTab('active')}
            style={{
              background: requestQueueTab === 'active' ? (isDark ? '#064e3b' : '#ecfdf5') : t.buttonSecondaryBg,
              border: requestQueueTab === 'active' ? '1.5px solid #10b981' : `1.5px solid ${t.cardBorder}`,
              color: requestQueueTab === 'active' ? (isDark ? '#34d399' : '#047857') : t.textSecondary,
              padding: '6px 14px',
              borderRadius: '10px',
              fontSize: '0.8rem',
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s'
            }}
          >
            <span>Очікують видачі</span>
            <span style={{
              background: requestQueueTab === 'active' ? '#10b981' : (isDark ? '#232938' : '#f1f5f9'),
              color: requestQueueTab === 'active' ? '#ffffff' : t.textSecondary,
              padding: '1px 7px',
              borderRadius: '10px',
              fontSize: '0.72rem',
              fontWeight: 950
            }}>
              {getUniqueGroupsCount(activePackagingRequests)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setRequestQueueTab('all')}
            style={{
              background: requestQueueTab === 'all' ? (isDark ? '#1e293b' : '#f1f5f9') : t.buttonSecondaryBg,
              border: requestQueueTab === 'all' ? (isDark ? '1.5px solid #475569' : '1.5px solid #94a3b8') : `1.5px solid ${t.cardBorder}`,
              color: requestQueueTab === 'all' ? t.textPrimary : t.textSecondary,
              padding: '6px 14px',
              borderRadius: '10px',
              fontSize: '0.8rem',
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s'
            }}
          >
            <span>Всі запити</span>
            <span style={{
              background: requestQueueTab === 'all' ? (isDark ? '#475569' : '#334155') : (isDark ? '#232938' : '#f1f5f9'),
              color: requestQueueTab === 'all' ? '#ffffff' : t.textSecondary,
              padding: '1px 7px',
              borderRadius: '10px',
              fontSize: '0.72rem',
              fontWeight: 950
            }}>
              {getUniqueGroupsCount(allPackagingRequests)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setRequestQueueTab('history')}
            style={{
              background: requestQueueTab === 'history' ? (isDark ? '#022c22' : '#f0fdf4') : t.buttonSecondaryBg,
              border: requestQueueTab === 'history' ? (isDark ? '1.5px solid #059669' : '1.5px solid #86efac') : `1.5px solid ${t.cardBorder}`,
              color: requestQueueTab === 'history' ? (isDark ? '#34d399' : '#166534') : t.textSecondary,
              padding: '6px 14px',
              borderRadius: '10px',
              fontSize: '0.8rem',
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s'
            }}
          >
            <span>Видані / Архів</span>
            <span style={{
              background: requestQueueTab === 'history' ? '#16a34a' : (isDark ? '#232938' : '#f1f5f9'),
              color: requestQueueTab === 'history' ? '#ffffff' : t.textSecondary,
              padding: '1px 7px',
              borderRadius: '10px',
              fontSize: '0.72rem',
              fontWeight: 950
            }}>
              {getUniqueGroupsCount(completedPackagingRequests)}
            </span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={fetchQueueFromDb}
            disabled={isRefreshingQueue}
            style={{
              background: t.buttonSecondaryBg,
              border: `1.5px solid ${t.buttonSecondaryBorder}`,
              color: t.textSecondary,
              borderRadius: '10px',
              padding: '6px 14px',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: isRefreshingQueue ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s'
            }}
            title="Оновити чергу запитів з бази даних"
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.color = isDark ? '#34d399' : '#059669' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = t.buttonSecondaryBorder; e.currentTarget.style.color = t.textSecondary }}
          >
            <RefreshCw size={14} style={{ animation: isRefreshingQueue ? 'spin 1s linear infinite' : 'none' }} />
            <span>{isRefreshingQueue ? 'Оновлення...' : 'Оновити'}</span>
          </button>
        </div>
      </div>

      {/* Controls toolbar: Search, Status Filters & Collapse Controls */}
      {groupedPackagingRequests.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '22px'
        }}>
          {/* Left: Search input */}
          <div style={{ position: 'relative', flex: 1, minWidth: '260px', maxWidth: '380px' }}>
            <Search size={16} color={t.textSecondary} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Пошук наряду або замовника..."
              value={requestSearchQuery}
              onChange={e => setRequestSearchQuery(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: t.inputBg,
                border: `1.5px solid ${t.inputBorder}`,
                borderRadius: '12px',
                padding: '10px 14px 10px 42px',
                color: t.inputText,
                fontSize: '0.84rem',
                outline: 'none',
                boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.02)'
              }}
            />
          </div>

          {/* Center: Quick Status Filters */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: t.inputBg,
            border: `1.5px solid ${t.inputBorder}`,
            padding: '4px',
            borderRadius: '12px',
            boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <button
              type="button"
              onClick={() => setOrderStatusFilter('all')}
              style={{
                border: 'none',
                background: orderStatusFilter === 'all' ? '#0284c7' : 'transparent',
                color: orderStatusFilter === 'all' ? '#ffffff' : t.textSecondary,
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 900,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              Всі наряди ({orderStats.total})
            </button>
            <button
              type="button"
              onClick={() => setOrderStatusFilter('ready')}
              style={{
                border: 'none',
                background: orderStatusFilter === 'ready' ? '#10b981' : 'transparent',
                color: orderStatusFilter === 'ready' ? '#ffffff' : (isDark ? '#34d399' : '#047857'),
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 900,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              ✓ Готові ({orderStats.ready})
            </button>
            <button
              type="button"
              onClick={() => setOrderStatusFilter('shortage')}
              style={{
                border: 'none',
                background: orderStatusFilter === 'shortage' ? '#f59e0b' : 'transparent',
                color: orderStatusFilter === 'shortage' ? '#ffffff' : (isDark ? '#fbbf24' : '#b45309'),
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 900,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              ⚠️ З нестачею ({orderStats.shortage})
            </button>
          </div>

          {/* Right: Expand / Collapse All */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={expandAll}
              style={{
                background: t.buttonSecondaryBg,
                border: `1.5px solid ${t.buttonSecondaryBorder}`,
                color: t.textSecondary,
                borderRadius: '10px',
                padding: '7px 12px',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <ChevronsUpDown size={13} /> Розгорнути всі
            </button>
            <button
              type="button"
              onClick={collapseAll}
              style={{
                background: t.buttonSecondaryBg,
                border: `1.5px solid ${t.buttonSecondaryBorder}`,
                color: t.textSecondary,
                borderRadius: '10px',
                padding: '7px 12px',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              Згорнути всі
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {groupedPackagingRequests.length === 0 && (
        <div style={{
          background: t.cardBg,
          border: `1.5px solid ${t.cardBorder}`,
          borderRadius: '24px',
          padding: '60px 20px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.03)'
        }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: isDark ? '#022c22' : '#ecfdf5', border: `1.5px solid ${isDark ? '#059669' : '#a7f3d0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px' }}>
            <CheckCircle2 size={32} color={isDark ? '#34d399' : '#059669'} />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 950, color: t.textPrimary, margin: '0 0 8px 0' }}>
            {requestQueueTab === 'history' ? 'Немає виданих запитів' : 'Черга запитів чиста!'}
          </h3>
          <p style={{ fontSize: '0.88rem', color: t.textSecondary, maxWidth: '480px', margin: '0 0 24px 0', lineHeight: 1.5 }}>
            {requestQueueTab === 'history'
              ? 'У журналі видачі СГП поки немає завершених запитів на пакування.'
              : completedPackagingRequests.length > 0
                ? `Всі активні запити видано! У журналі є ${getUniqueGroupsCount(completedPackagingRequests)} раніше виданих позицій.`
                : 'Всі запити комплектуючих та готової продукції з відділу пакування наразі видано.'}
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {completedPackagingRequests.length > 0 && requestQueueTab === 'active' && (
              <button
                type="button"
                onClick={() => setRequestQueueTab('history')}
                style={{
                  background: t.buttonSecondaryBg,
                  color: t.textPrimary,
                  border: `1.5px solid ${t.buttonSecondaryBorder}`,
                  borderRadius: '12px',
                  padding: '12px 22px',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.color = isDark ? '#34d399' : '#047857' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = t.buttonSecondaryBorder; e.currentTarget.style.color = t.textPrimary }}
              >
                <History size={16} /> Переглянути видані ({getUniqueGroupsCount(completedPackagingRequests)})
              </button>
            )}
            <button
              type="button"
              onClick={() => setViewMode('inventory')}
              style={{
                background: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '12px 26px',
                fontSize: '0.86rem',
                fontWeight: 950,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#059669' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#10b981' }}
            >
              <Archive size={18} color="#ffffff" />
              <span style={{ color: '#ffffff', fontWeight: 950 }}>ПЕРЕГЛЯНУТИ ЗАЛИШКИ СГП</span>
            </button>
          </div>
        </div>
      )}

      {/* Filtered Empty State */}
      {groupedPackagingRequests.length > 0 && filteredOrderGroups.length === 0 && (
        <div style={{
          background: t.cardBg,
          border: `1.5px solid ${t.cardBorder}`,
          borderRadius: '18px',
          padding: '45px 20px',
          textAlign: 'center',
          color: t.textSecondary,
          fontSize: '0.9rem'
        }}>
          Не знайдено нарядів за обраними критеріями пошуку або фільтру.
        </div>
      )}

      {/* Orders list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        {filteredOrderGroups.map(group => {
          const itemsWithStock = group.items.map(req => {
            const displayName = getItemDisplayName(req)
            const badge = getItemCategoryBadge(req, displayName)
            const sgpStock = getSgpStock(req, displayName)
            const neededQty = Number(req.quantity) || 0
            const hasEnough = sgpStock >= neededQty
            return { req, displayName, badge, sgpStock, neededQty, hasEnough }
          })
          const totalOrderItems = itemsWithStock.length
          const totalOrderUnits = itemsWithStock.reduce((sum, i) => sum + i.neededQty, 0)
          const readyItemsCount = itemsWithStock.filter(i => i.hasEnough).length
          const isFullyReady = readyItemsCount === totalOrderItems
          const hasShortage = !isFullyReady
          const isCollapsed = collapsedOrders.has(group.key)
          const percentReady = totalOrderItems > 0 ? Math.round((readyItemsCount / totalOrderItems) * 100) : 0

          return (
            <div
              key={group.key}
              style={{
                background: t.cardBg,
                border: `1.5px solid ${t.cardBorder}`,
                borderLeft: isFullyReady ? '6px solid #10b981' : '6px solid #f59e0b',
                borderRadius: '18px',
                overflow: 'hidden',
                boxShadow: isDark ? '0 4px 18px rgba(0, 0, 0, 0.4)' : '0 4px 18px rgba(15, 23, 42, 0.05)',
                transition: 'all 0.2s ease'
              }}
            >
              {/* Order Card Header */}
              <div style={{
                background: t.cardHeaderBg,
                borderBottom: isCollapsed ? 'none' : `1.5px solid ${t.cardBorder}`,
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  {/* Accordion toggle button */}
                  <button
                    type="button"
                    onClick={() => toggleOrderCollapse(group.key)}
                    style={{
                      background: t.buttonSecondaryBg,
                      border: `1px solid ${t.buttonSecondaryBorder}`,
                      borderRadius: '8px',
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: t.textPrimary,
                      transition: 'all 0.15s'
                    }}
                    title={isCollapsed ? 'Розгорнути наряд' : 'Згорнути наряд'}
                  >
                    {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                  </button>

                  {/* Order number badge */}
                  <div style={{
                    background: t.orderBadgeBg,
                    color: t.orderBadgeText,
                    border: `1.5px solid ${t.orderBadgeBorder}`,
                    padding: '6px 14px',
                    borderRadius: '10px',
                    fontWeight: 1000,
                    fontSize: '0.95rem',
                    letterSpacing: '-0.01em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span>НАРЯД № {group.orderNum}{group.batchIndex ? `/${group.batchIndex}` : ''}</span>
                  </div>

                  {/* Customer badge */}
                  {group.customer && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: t.customerBadgeBg,
                      border: `1.5px solid ${t.customerBadgeBorder}`,
                      padding: '5px 12px',
                      borderRadius: '10px',
                      fontSize: '0.8rem',
                      color: t.customerBadgeText,
                      fontWeight: 800
                    }}>
                      <User size={13} color={t.textSecondary} /> {group.customer}
                    </div>
                  )}

                  {/* Order Volume Summary */}
                  <div style={{ fontSize: '0.78rem', color: t.textSecondary, fontWeight: 800 }}>
                    • {totalOrderItems} {totalOrderItems === 1 ? 'позиція' : 'позицій'} ({totalOrderUnits} шт)
                  </div>

                  {/* Readiness status badge */}
                  {isFullyReady ? (
                    <span style={{
                      background: t.readyBadgeBg,
                      color: t.readyBadgeText,
                      border: `1.5px solid ${t.readyBadgeBorder}`,
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '0.74rem',
                      fontWeight: 900,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}>
                      <CheckCircle2 size={13} /> Готовий до видачі ({readyItemsCount}/{totalOrderItems})
                    </span>
                  ) : (
                    <span style={{
                      background: t.shortageBadgeBg,
                      color: t.shortageBadgeText,
                      border: `1.5px solid ${t.shortageBadgeBorder}`,
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '0.74rem',
                      fontWeight: 900,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}>
                      <AlertTriangle size={13} /> Нестача ({totalOrderItems - readyItemsCount} з {totalOrderItems} поз.)
                    </span>
                  )}
                </div>

                {/* Bulk action on right */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {itemsWithStock.some(i => i.req.status !== 'completed' && i.req.status !== 'issued') ? (
                    <button
                      type="button"
                      onClick={() => handleIssueAllForOrder(group)}
                      disabled={isIssuingReq}
                      style={{
                        background: '#10b981',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '9px 18px',
                        fontSize: '0.82rem',
                        fontWeight: 1000,
                        cursor: isIssuingReq ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={e => { if (!isIssuingReq) e.currentTarget.style.background = '#059669' }}
                      onMouseLeave={e => { if (!isIssuingReq) e.currentTarget.style.background = '#10b981' }}
                    >
                      <Check size={16} /> ВИДАТИ Всі запити НА НАРЯД
                    </button>
                  ) : (
                    <div style={{
                      background: t.readyBadgeBg,
                      color: t.readyBadgeText,
                      border: `1.5px solid ${t.readyBadgeBorder}`,
                      padding: '7px 14px',
                      borderRadius: '10px',
                      fontSize: '0.8rem',
                      fontWeight: 900,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <CheckCircle2 size={15} /> Всі запити ВИДАНО
                    </div>
                  )}
                </div>
              </div>

              {/* Readiness Progress Bar */}
              <div style={{ height: '3.5px', width: '100%', background: isDark ? '#232938' : '#e2e8f0', position: 'relative' }}>
                <div style={{
                  height: '100%',
                  width: `${percentReady}%`,
                  background: isFullyReady ? '#10b981' : '#f59e0b',
                  transition: 'width 0.3s ease'
                }} />
              </div>

              {/* Collapsed Preview */}
              {isCollapsed ? (
                <div
                  onClick={() => toggleOrderCollapse(group.key)}
                  style={{
                    padding: '12px 20px',
                    background: t.cardBg,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.82rem',
                    color: t.textSecondary,
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = t.cardHeaderBg }}
                  onMouseLeave={e => { e.currentTarget.style.background = t.cardBg }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 800, color: t.textPrimary }}>Склад замовлення:</span>
                    <span style={{ color: t.textSecondary }}>
                      {itemsWithStock.slice(0, 4).map(i => i.displayName).join(' • ')}
                      {totalOrderItems > 4 ? ` ... (+ще ${totalOrderItems - 4})` : ''}
                    </span>
                  </div>
                  <span style={{ color: isDark ? '#38bdf8' : '#0284c7', fontWeight: 900, fontSize: '0.78rem', whiteSpace: 'nowrap', marginLeft: '15px' }}>
                    Розгорнути деталі наряду ({totalOrderItems} поз.) ↓
                  </span>
                </div>
              ) : (
                <>
                  {/* Order Items Table */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                      <thead>
                        <tr style={{ background: t.tableHeadBg, borderBottom: `1.5px solid ${t.tableBorder}`, color: t.textSecondary }}>
                          <th style={{ padding: '12px 16px', width: '45px', textAlign: 'center', fontWeight: 900, whiteSpace: 'nowrap' }}>№</th>
                          <th style={{ padding: '12px 16px', fontWeight: 900 }}>Номенклатура матеріалу / виробу</th>
                          <th style={{ padding: '12px 16px', width: '130px', textAlign: 'center', fontWeight: 900, whiteSpace: 'nowrap' }}>Тип</th>
                          <th style={{ padding: '12px 16px', width: '120px', textAlign: 'right', fontWeight: 900, whiteSpace: 'nowrap' }}>Запитано</th>
                          <th style={{ padding: '12px 16px', width: '120px', textAlign: 'right', fontWeight: 900, whiteSpace: 'nowrap' }}>На СГП</th>
                          <th style={{ padding: '12px 16px', width: '160px', textAlign: 'center', fontWeight: 900, whiteSpace: 'nowrap' }}>Статус наявності</th>
                          <th style={{ padding: '12px 20px', width: '120px', textAlign: 'center', fontWeight: 900, whiteSpace: 'nowrap' }}>Дія</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemsWithStock.map((item, itemIndex) => {
                          const { req, displayName, badge, sgpStock, neededQty, hasEnough } = item

                          return (
                            <tr
                              key={req.id}
                              style={{
                                borderBottom: `1px solid ${t.tableRowBorder}`,
                                background: t.cardBg,
                                transition: 'background 0.1s'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = t.tableRowHover }}
                              onMouseLeave={e => { e.currentTarget.style.background = t.cardBg }}
                            >
                              <td style={{ padding: '12px 16px', textAlign: 'center', color: t.textMuted, fontWeight: 800, whiteSpace: 'nowrap' }}>
                                {itemIndex + 1}
                              </td>

                              <td style={{ padding: '12px 16px' }}>
                                <div style={{ fontWeight: 900, color: t.textPrimary, fontSize: '0.88rem' }}>
                                  {displayName}
                                </div>
                              </td>

                              <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                <span style={{
                                  background: badge.bg,
                                  color: badge.color,
                                  border: `1px solid ${badge.border || badge.color}`,
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  fontSize: '0.72rem',
                                  fontWeight: 900,
                                  letterSpacing: '0.02em',
                                  whiteSpace: 'nowrap',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  lineHeight: 1.2
                                }}>
                                  {badge.label}
                                </span>
                              </td>

                              <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 1000, fontSize: '0.95rem', color: isDark ? '#fbbf24' : '#d97706', whiteSpace: 'nowrap' }}>
                                {neededQty} <span style={{ fontSize: '0.74rem', color: t.textSecondary }}>шт</span>
                              </td>

                              <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 1000, fontSize: '0.95rem', color: hasEnough ? (isDark ? '#34d399' : '#059669') : '#ef4444', whiteSpace: 'nowrap' }}>
                                {sgpStock} <span style={{ fontSize: '0.74rem', color: t.textSecondary }}>шт</span>
                              </td>

                              <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                {hasEnough ? (
                                  <span style={{ color: isDark ? '#34d399' : '#059669', background: isDark ? '#022c22' : '#ecfdf5', border: `1px solid ${isDark ? '#059669' : '#a7f3d0'}`, padding: '4px 10px', borderRadius: '8px', fontWeight: 800, fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                    <CheckCircle2 size={13} /> В наявності
                                  </span>
                                ) : (
                                  <span style={{ color: isDark ? '#f87171' : '#dc2626', background: isDark ? '#450a0a' : '#fef2f2', border: `1px solid ${isDark ? '#991b1b' : '#fecaca'}`, padding: '4px 10px', borderRadius: '8px', fontWeight: 800, fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                    <AlertTriangle size={13} /> Нестача {neededQty - sgpStock} шт
                                  </span>
                                )}
                              </td>

                              <td style={{ padding: '12px 20px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                {req.status === 'completed' || req.status === 'issued' ? (
                                  <span style={{
                                    color: isDark ? '#34d399' : '#059669',
                                    background: isDark ? '#022c22' : '#ecfdf5',
                                    border: `1px solid ${isDark ? '#059669' : '#a7f3d0'}`,
                                    padding: '5px 12px',
                                    borderRadius: '8px',
                                    fontWeight: 900,
                                    fontSize: '0.76rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    <CheckCircle2 size={13} /> Видано
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleIssueRequest(req)}
                                    disabled={isIssuingReq}
                                    style={{
                                      background: t.issueBtnBg,
                                      color: t.issueBtnText,
                                      border: `1.5px solid ${t.issueBtnBorder}`,
                                      borderRadius: '8px',
                                      padding: '6px 14px',
                                      fontSize: '0.78rem',
                                      fontWeight: 900,
                                      cursor: isIssuingReq ? 'not-allowed' : 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      whiteSpace: 'nowrap',
                                      transition: 'all 0.15s ease'
                                    }}
                                    onMouseEnter={e => { if (!isIssuingReq) { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.color = '#ffffff' } }}
                                    onMouseLeave={e => { if (!isIssuingReq) { e.currentTarget.style.background = t.issueBtnBg; e.currentTarget.style.color = t.issueBtnText } }}
                                  >
                                    <Check size={14} /> Видати
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Order Card Footer Closure */}
                  <div style={{
                    background: t.cardHeaderBg,
                    borderTop: `1.5px solid ${t.cardBorder}`,
                    padding: '10px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.78rem',
                    color: t.textSecondary,
                    fontWeight: 700
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ color: t.textSecondary }}>Разом по наряду: <strong style={{ color: t.textPrimary }}>{totalOrderItems} поз.</strong> ({totalOrderUnits} шт)</span>
                      <span>•</span>
                      <span style={{ color: isFullyReady ? (isDark ? '#34d399' : '#059669') : (isDark ? '#fbbf24' : '#d97706'), fontWeight: 800 }}>
                        {isFullyReady ? '✓ Повна комплектація на СГП' : `⚠️ Доступно ${readyItemsCount} з ${totalOrderItems} позицій`}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleOrderCollapse(group.key)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: t.textSecondary,
                        fontSize: '0.76rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = t.textPrimary }}
                      onMouseLeave={e => { e.currentTarget.style.color = t.textSecondary }}
                    >
                      <ChevronUp size={14} /> Згорнути наряд
                    </button>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}




