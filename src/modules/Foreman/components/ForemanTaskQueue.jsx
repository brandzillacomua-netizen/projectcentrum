import React from 'react'
import { X, ArrowRight, CheckCircle2, AlertTriangle, Clock, Layers, Sun, Moon } from 'lucide-react'
import { useMES } from '../../../MESContext'

export default function ForemanTaskQueue({
  relevantTasks,
  activeTaskId,
  orders,
  allOrdersMap,
  nomenclatures,
  taskReadinessMap,
  taskShortageMap,
  cachedShortageMap,
  taskCardsCountMap,
  currentPage,
  setCurrentPage,
  itemsPerPage,
  isDrawerOpen,
  setIsDrawerOpen,
  onSelectTask,
  activeTab = 'active',
  setActiveTab = () => {},
  activeQueueCount = 0,
  archiveQueueCount = 0
}) {
  const { theme, toggleTheme } = useMES()
  return (
    <div
      className={`side-panel no-print ${isDrawerOpen ? 'drawer-open' : ''}`}
      style={{ display: 'flex', flexDirection: 'column', background: '#121212', borderRight: '1px solid #222', transition: '0.3s transform' }}
    >
      <div style={{ padding: '15px 20px', borderBottom: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#888', fontWeight: 800, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          <span>{activeTab === 'active' ? `АКТИВНІ НАРЯДИ (${activeQueueCount})` : `АРХІВ НАРАДІВ (${archiveQueueCount})`}</span>
          {isDrawerOpen && (
            <button onClick={() => setIsDrawerOpen(false)} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          )}
        </div>

        {/* Вкладки Активні / Архів */}
        <div style={{ display: 'flex', background: '#0a0a0a', padding: '3px', borderRadius: '10px', border: '1px solid #222' }}>
          <button
            onClick={() => { setActiveTab('active'); setCurrentPage(1); }}
            style={{
              flex: 1,
              padding: '7px 10px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'active' ? '#ef4444' : 'transparent',
              color: activeTab === 'active' ? '#fff' : '#777',
              fontWeight: 900,
              fontSize: '0.7rem',
              cursor: 'pointer',
              transition: '0.2s'
            }}
          >
            ⚡ АКТИВНІ ({activeQueueCount})
          </button>
          <button
            onClick={() => { setActiveTab('archive'); setCurrentPage(1); }}
            style={{
              flex: 1,
              padding: '7px 10px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'archive' ? '#10b981' : 'transparent',
              color: activeTab === 'archive' ? '#fff' : '#777',
              fontWeight: 900,
              fontSize: '0.7rem',
              cursor: 'pointer',
              transition: '0.2s'
            }}
          >
            📁 АРХІВ ({archiveQueueCount})
          </button>
        </div>

        {/* Пагінація перелистування сторінок у верхній шапці */}
        {relevantTasks.length > itemsPerPage && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0a0a0a', padding: '6px 12px', borderRadius: '8px', border: '1px solid #1f1f1f', marginTop: '2px' }}>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              style={{ background: '#1c1c1c', border: '1px solid #333', color: '#fff', padding: '4px 12px', borderRadius: '6px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.3 : 1, fontSize: '0.7rem', fontWeight: 800 }}
            >
              ← Назад
            </button>
            <div style={{ fontSize: '0.7rem', color: '#aaa', fontWeight: 900 }}>
              {currentPage} / {Math.ceil(relevantTasks.length / itemsPerPage)}
            </div>
            <button
              disabled={currentPage === Math.ceil(relevantTasks.length / itemsPerPage)}
              onClick={() => setCurrentPage(p => p + 1)}
              style={{ background: '#1c1c1c', border: '1px solid #333', color: '#fff', padding: '4px 12px', borderRadius: '6px', cursor: currentPage === Math.ceil(relevantTasks.length / itemsPerPage) ? 'not-allowed' : 'pointer', opacity: currentPage === Math.ceil(relevantTasks.length / itemsPerPage) ? 0.3 : 1, fontSize: '0.7rem', fontWeight: 800 }}
            >
              Вперед →
            </button>
          </div>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {relevantTasks.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(task => {
          const order = task.orders || orders.find(o => o.id === task.order_id) || allOrdersMap[task.order_id]
          const isActive = activeTaskId === task.id
          const isCompleted = task.status === 'completed'
          const taskCardsCount = taskCardsCountMap[task.id] || 0
          const isNew = !isCompleted && taskCardsCount === 0
          const isReady = !isCompleted && !isNew && Boolean(taskReadinessMap[task.id])
          const isShortage = !isCompleted && !isNew && !isReady && Boolean(taskShortageMap[task.id])
          const isInProgress = !isCompleted && !isNew && !isReady && !isShortage

          const borderColor = isReady && !isCompleted
            ? '#10b981'
            : isShortage && !isCompleted
              ? '#ef4444'
              : isNew
                ? '#3b82f6'
                : isInProgress
                  ? '#eab308'
                  : isActive
                    ? '#fff'
                    : 'transparent'

          const borderSize = isActive ? '6px' : '4px'

          const bgColor = isActive
            ? 'rgba(255,255,255,0.08)'
            : isReady && !isCompleted
              ? 'rgba(16, 185, 129, 0.08)'
              : isShortage && !isCompleted
                ? 'rgba(239, 68, 68, 0.08)'
                : isNew
                  ? 'rgba(59, 130, 246, 0.08)'
                  : isInProgress
                    ? 'rgba(234, 179, 8, 0.08)'
                    : 'transparent'

          return (
            <div
              key={task.id}
              onClick={() => onSelectTask(task.id)}
              style={{
                padding: '18px 15px',
                borderLeft: `${borderSize} solid ${borderColor}`,
                background: bgColor,
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginBottom: '1px',
                position: 'relative'
              }}
            >
              {(() => {
                const orderNum = order?.order_num || task.plan_snapshot?._prep_num || (task.step === 'Підготовка' ? 'ПІДГОТОВКА' : (task.id ? `ID-${task.id.slice(0, 6)}` : ''))
                const prodId = order?.nomenclature_id || order?.order_items?.[0]?.nomenclature_id
                let prodName = nomenclatures?.find(n => String(n.id) === String(prodId))?.name
                if (!prodName && task.plan_snapshot) {
                  const snapItem = Object.values(task.plan_snapshot).find(v => v && typeof v === 'object' && v.name)
                  if (snapItem) prodName = snapItem.name
                }
                const qty = task.planned_sets || order?.quantity || 0
                const customerName = order?.customer || (task.step === 'Підготовка' ? 'Склад підготовки матеріалів' : '')
                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.9rem', color: isCompleted ? '#555' : '#fff' }}>
                        № {orderNum}{task.batch_index ? `/${task.batch_index}` : ''}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {isCompleted && <CheckCircle2 size={14} color="#10b981" />}
                        {isReady && !isCompleted && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#10b981', borderRadius: '6px', padding: '3px 8px', boxShadow: '0 4px 10px rgba(16,185,129,0.3)' }}>
                            <ArrowRight size={10} color="#fff" />
                            <span style={{ fontSize: '0.6rem', fontWeight: 950, color: '#fff', letterSpacing: '0.5px' }}>ГОТОВО</span>
                          </div>
                        )}
                        {isShortage && !isCompleted && !isReady && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#ef4444', borderRadius: '6px', padding: '3px 8px', boxShadow: '0 4px 10px rgba(239,68,68,0.3)' }}>
                            <AlertTriangle size={10} color="#fff" />
                            <span style={{ fontSize: '0.6rem', fontWeight: 950, color: '#fff', letterSpacing: '0.5px' }}>НЕСТАЧА</span>
                          </div>
                        )}
                        {isNew && (
                          <div className="anim-pulse-blue" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#3b82f6', borderRadius: '6px', padding: '3px 8px', boxShadow: '0 4px 10px rgba(59,130,246,0.3)' }}>
                            <Clock size={10} color="#fff" />
                            <span style={{ fontSize: '0.6rem', fontWeight: 950, color: '#fff', letterSpacing: '0.5px' }}>НОВИЙ</span>
                          </div>
                        )}
                        {isInProgress && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#eab308', borderRadius: '6px', padding: '3px 8px', boxShadow: '0 4px 10px rgba(234,179,8,0.3)' }}>
                            <Layers size={10} color="#000" />
                            <span style={{ fontSize: '0.6rem', fontWeight: 950, color: '#000', letterSpacing: '0.5px' }}>В РОБОТІ</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: isCompleted ? '#555' : '#eaeaea', fontWeight: 900, margin: '4px 0' }}>
                      {prodName || '—'} • <span style={{ color: isCompleted ? '#777' : '#ff9000' }}>{qty} шт.</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: isCompleted ? '#333' : '#555' }}>{customerName}</div>
                  </>
                )
              })()}
              {isCompleted && <div style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 900, marginTop: '4px' }}>ВИКОНАНО</div>}
              {isReady && !isCompleted && (
                <div style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 900, marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={10} />
                  ВСІ КАРТКИ ГОТОВІ — ЗАВЕРШИТИ
                </div>
              )}
              {isShortage && !isCompleted && !isReady && (
                <div style={{ fontSize: '0.6rem', color: '#ef4444', fontWeight: 900, marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertTriangle size={10} />
                  ПОТРІБЕН ДОВИПУСК
                </div>
              )}
              {isNew && (
                <div style={{ fontSize: '0.6rem', color: '#3b82f6', fontWeight: 900, marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={10} />
                  КАРТКИ ЩЕ НЕ ЗГЕНЕРОВАНО
                </div>
              )}
              {isInProgress && (
                <div style={{ fontSize: '0.6rem', color: '#eab308', fontWeight: 900, marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Layers size={10} />
                  У ПРОЦЕСІ ВИРОБНИЦТВА
                </div>
              )}
            </div>
          )
        })}
        {relevantTasks.length === 0 && (
          <div style={{ padding: '20px', color: '#333', fontSize: '0.8rem' }}>Немає нарядів</div>
        )}
      </div>
    </div>
  )
}
