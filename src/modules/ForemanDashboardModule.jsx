import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, LayoutDashboard, RefreshCw, Search } from 'lucide-react'
import { useForemanDashboardData } from './ForemanDashboard/hooks/useForemanDashboardData.jsx'
import WipTable from './ForemanDashboard/components/WipTable'
import OrderDetailView from './ForemanDashboard/components/OrderDetailView'
import CellCardsModal from './ForemanDashboard/components/modals/CellCardsModal'
import InspectCardModal from './ForemanDashboard/components/modals/InspectCardModal'

const ForemanDashboardModule = () => {
  const {
    currentUser,
    workCards,
    inventory,
    nomenclatures,
    orders,
    bomItems,
    tasks,
    selectedTaskId,
    setSelectedTaskId,
    isRefreshing,
    searchQuery,
    setSearchQuery,
    expandedBottlenecks,
    setExpandedBottlenecks,
    selectedCellModal,
    setSelectedCellModal,
    inspectCardModal,
    setInspectCardModal,
    orderAllCards,
    loadingCards,
    relevantTasks,
    activeTasks,
    ordersMap,
    dashboardCards,
    flowTotalsRows,
    dashboardHistory,
    cardsByTaskId,
    productionCache,
    scrapCache,
    taskStatusMap,
    taskProgressMap,
    overviewGroups,
    handleCellClick,
    handleRefresh
  } = useForemanDashboardData()

  const selectedTask = selectedTaskId ? relevantTasks.find(t => t.id === selectedTaskId) : null
  const selectedOrder = selectedTask ? ordersMap[selectedTask.order_id] : null

  return (
    <div className="foreman-dashboard-module" style={{ background: 'var(--bg, #09090b)', minHeight: '100vh', color: 'var(--text, #f4f4f5)', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── NAV ── */}
      <nav style={{ flexShrink: 0, padding: '0 24px', height: '68px', background: 'var(--card-bg, #18181b)', borderBottom: '1px solid var(--glass-border, rgba(0,0,0,0.08))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link
            to="/"
            style={{
              color: 'var(--text, #f4f4f5)',
              background: 'var(--bg, #09090b)',
              border: '1px solid var(--glass-border, rgba(0,0,0,0.12))',
              padding: '7px 12px',
              borderRadius: '9px',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.82rem',
              fontWeight: 800,
              transition: 'all 0.2s',
              boxShadow: 'var(--shadow, none)'
            }}
          >
            <ArrowLeft size={16} /> На головну
          </Link>
          <div style={{ width: '1px', height: '24px', background: 'var(--glass-border, rgba(0,0,0,0.12))' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LayoutDashboard size={18} color="#ef4444" />
            </div>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1.1, color: 'var(--text, #f4f4f5)' }}>
                Дашборд Нарядів
              </div>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-muted, #71717a)', fontWeight: 600, letterSpacing: '0.05em' }}>
                FOREMAN · ВИРОБНИЦТВО ЦЕХ №1
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{ background: 'var(--bg, #09090b)', border: '1px solid var(--glass-border, rgba(0,0,0,0.12))', color: 'var(--text, #f4f4f5)', padding: '8px 14px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', transition: 'all 0.2s' }}
          >
            <RefreshCw size={14} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
            Оновити
          </button>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text, #f4f4f5)' }}>{currentUser?.first_name} {currentUser?.last_name}</div>
            <div style={{ fontSize: '0.6rem', color: '#ef4444', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{currentUser?.position}</div>
          </div>
        </div>
      </nav>

      {/* ── TABS ── */}
      <div style={{ display: 'flex', overflowX: 'auto', gap: '8px', padding: '14px 24px', background: 'var(--card-bg, #18181b)', borderBottom: '1px solid var(--glass-border, rgba(0,0,0,0.08))', scrollbarWidth: 'none' }}>
        {/* Overview tab */}
        <button
          onClick={() => setSelectedTaskId(null)}
          style={{
            background: selectedTaskId === null ? 'rgba(239,68,68,0.15)' : 'var(--bg, #09090b)',
            color: selectedTaskId === null ? '#ef4444' : 'var(--text-muted, #71717a)',
            border: `1px solid ${selectedTaskId === null ? 'rgba(239,68,68,0.4)' : 'var(--glass-border, rgba(0,0,0,0.12))'}`,
            padding: '8px 18px', borderRadius: '10px', fontWeight: 800, fontSize: '0.78rem',
            cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s', flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: '7px'
          }}
        >
          <LayoutDashboard size={14} />
          ЗАГАЛЬНА ТАБЛИЦЯ
          <span style={{
            background: selectedTaskId === null ? '#ef4444' : 'var(--glass-border, rgba(0,0,0,0.15))',
            color: selectedTaskId === null ? '#fff' : 'var(--text, #f4f4f5)', borderRadius: '6px', padding: '1px 7px', fontSize: '0.7rem', fontWeight: 900
          }}>
            {activeTasks.length}
          </span>
        </button>

        {/* Per-task tabs */}
        {(() => {
          const sortedTasks = [...relevantTasks].sort((a, b) => {
            if (a.status === 'completed' && b.status !== 'completed') return 1
            if (a.status !== 'completed' && b.status === 'completed') return -1

            const aShortage = taskStatusMap[a.id] === 'shortage'
            const bShortage = taskStatusMap[b.id] === 'shortage'
            if (aShortage && !bShortage) return -1
            if (!aShortage && bShortage) return 1

            return new Date(b.created_at) - new Date(a.created_at)
          })
          return sortedTasks.map(task => {
            const order = ordersMap[task.order_id]
            const displayNum = order?.order_num || task.id.split('-')[0]
            const batchSuffix = task.batch_index ? `/${task.batch_index}` : ''
            const status = taskStatusMap[task.id]
            const isActive = selectedTaskId === task.id

            const tabColor = status === 'ready' ? '#10b981'
              : status === 'shortage' ? '#ef4444'
                : status === 'new' ? '#3b82f6'
                  : status === 'completed' ? '#52525b'
                    : '#eab308'

            const statusDot = status === 'ready' ? '🟢'
              : status === 'shortage' ? '🔴'
                : status === 'new' ? '🔵'
                  : status === 'completed' ? '⚪'
                    : '🟡'

            return (
              <button
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                style={{
                  background: isActive ? `${tabColor}18` : 'var(--bg, #09090b)',
                  color: isActive ? tabColor : 'var(--text-muted, #71717a)',
                  border: `1px solid ${isActive ? tabColor + '60' : 'var(--glass-border, rgba(0,0,0,0.12))'}`,
                  padding: '8px 16px', borderRadius: '10px', fontWeight: 800, fontSize: '0.78rem',
                  cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s', flexShrink: 0,
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <span style={{ fontSize: '0.75rem' }}>{statusDot}</span>
                №{displayNum}{batchSuffix}
                {status === 'completed' && <span style={{ fontSize: '0.62rem', opacity: 0.6 }}>✓</span>}
              </button>
            )
          })
        })()}
      </div>

      {/* ── CONTENT ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {selectedTask === null ? (
          /* ═══════════════════ OVERVIEW MODE ═══════════════════ */
          <div>
            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
              {[
                { label: 'Всього нарядів', value: activeTasks.length, color: '#ff9000', icon: '📋' },
                { label: 'Готові до закриття', value: activeTasks.filter(t => taskStatusMap[t.id] === 'ready').length, color: '#10b981', icon: '✅' },
                { label: 'В роботі', value: activeTasks.filter(t => taskStatusMap[t.id] === 'in_progress').length, color: '#eab308', icon: '⚙️' },
                { label: 'Потреба в довипуску', value: activeTasks.filter(t => taskStatusMap[t.id] === 'shortage').length, color: '#ef4444', icon: '⚠️' },
                { label: 'Нові (без карток)', value: activeTasks.filter(t => taskStatusMap[t.id] === 'new').length, color: '#3b82f6', icon: '🆕' },
              ].map(stat => (
                <div key={stat.label} style={{ background: 'var(--card-bg, #18181b)', border: '1px solid var(--glass-border, rgba(0,0,0,0.08))', borderRadius: '14px', padding: '16px 18px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ fontSize: '1.6rem', lineHeight: 1 }}>{stat.icon}</div>
                  <div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 950, color: stat.color, lineHeight: 1.1 }}>{stat.value}</div>
                    <div style={{ fontSize: '0.66rem', color: 'var(--text-muted, #52525b)', fontWeight: 700, marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Search */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #52525b)' }} />
                <input
                  type="text"
                  placeholder="Пошук деталі..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px 10px 36px', background: 'var(--card-bg, #18181b)', border: '1px solid var(--glass-border, rgba(0,0,0,0.12))', borderRadius: '10px', color: 'var(--text, #f4f4f5)', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = '#ef4444'}
                  onBlur={e => e.target.style.borderColor = 'var(--glass-border, rgba(0,0,0,0.12))'}
                />
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                ЗАГАЛЬНА ТАБЛИЦЯ WIP — ВСІ НАРЯДИ
              </div>
            </div>

            {/* Overview WIP table */}
            <WipTable groupedData={overviewGroups} emptyText="Немає активних деталей. Запустіть наряди в Foreman." onCellClick={handleCellClick} />
          </div>
        ) : (
          /* ═══════════════════ ORDER DETAIL MODE ═══════════════════ */
          <OrderDetailView
            task={selectedTask}
            order={selectedOrder}
            ordersMap={ordersMap}
            tasks={tasks}
            workCards={workCards}
            allTasksCards={dashboardCards}
            cardsByTaskId={cardsByTaskId}
            allCardsHistory={dashboardHistory}
            flowTotalsRows={flowTotalsRows}
            nomenclatures={nomenclatures}
            bomItems={bomItems}
            inventory={inventory}
            productionCache={productionCache}
            scrapCache={scrapCache}
            taskStatusMap={taskStatusMap}
            taskProgressMap={taskProgressMap}
            orderAllCards={orderAllCards[selectedTaskId] || []}
            isLoadingCards={loadingCards[selectedTaskId] || false}
            wipGroups={overviewGroups}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            expandedBottlenecks={expandedBottlenecks}
            setExpandedBottlenecks={setExpandedBottlenecks}
            onCellClick={handleCellClick}
          />
        )}
      </div>

      {/* ── Cell Cards Detail Modal ────────────────────────────────────── */}
      <CellCardsModal
        selectedCellModal={selectedCellModal}
        onClose={() => setSelectedCellModal(null)}
        onInspectCard={(c) => setInspectCardModal(c)}
        tasks={tasks}
        ordersMap={ordersMap}
        orders={orders}
      />

      {/* ── Individual Work Card Inspector Modal ──────────────────────── */}
      <InspectCardModal
        inspectCardModal={inspectCardModal}
        onClose={() => setInspectCardModal(null)}
        tasks={tasks}
        ordersMap={ordersMap}
        orders={orders}
      />

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: var(--bg, #0a0a0d); }
        ::-webkit-scrollbar-thumb { background: var(--glass-border, #27272a); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--text-muted, #3f3f46); }

        @media (max-width: 768px) {
          .mobile-fullscreen-btn-container {
            display: flex !important;
          }
          nav {
            padding: 0 12px !important;
            height: auto !important;
            min-height: 60px;
            flex-direction: column;
            gap: 10px;
            align-items: stretch !important;
            justify-content: center;
            padding-top: 10px !important;
            padding-bottom: 10px !important;
          }
          nav > div {
            justify-content: space-between;
            width: 100%;
          }
          nav button {
            padding: 6px 10px !important;
            font-size: 0.75rem !important;
          }
          nav > div:last-child > div:last-child {
            display: none !important;
          }
          div[style*="gridTemplateColumns"] {
            grid-template-columns: 1fr !important;
          }
          div[style*="borderRadius: '18px'"] {
            border-radius: 12px !important;
          }
          div[style*="padding: '16px 18px'"] {
            padding: 10px 12px !important;
          }
          div[style*="fontSize: '1.1rem'"] {
            font-size: 0.95rem !important;
          }
          div[style*="fontSize: '0.8rem'"] {
            font-size: 0.72rem !important;
          }
          div[style*="padding: '14px 24px'"] {
            padding: 8px 12px !important;
            gap: 4px !important;
          }
          div[style*="padding: '14px 24px'"] button {
            padding: 6px 12px !important;
            font-size: 0.72rem !important;
          }
          div[style*="padding: '24px'"] {
            padding: 12px !important;
          }
          table {
            font-size: 0.62rem !important;
            min-width: 700px !important;
          }
          th, td {
            padding: 5px 6px !important;
          }
          .wip-col-nomenclature {
            position: sticky !important;
            left: 0 !important;
            min-width: 110px !important;
            max-width: 110px !important;
            width: 110px !important;
            font-size: 0.6rem !important;
            z-index: 2 !important;
          }
          th.wip-col-nomenclature {
            z-index: 40 !important;
          }
          .wip-col-sum {
            position: sticky !important;
            left: 110px !important;
            min-width: 70px !important;
            max-width: 70px !important;
            width: 70px !important;
            z-index: 2 !important;
          }
          th.wip-col-sum {
            z-index: 40 !important;
          }
          .wip-sum-badge {
            font-size: 0.5rem !important;
            padding: 1px 3px !important;
            letter-spacing: -0.2px !important;
          }
        }
      `}</style>
    </div>
  )
}

export default ForemanDashboardModule
