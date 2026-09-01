import React from 'react'
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, Layers, X } from 'lucide-react'
import { formatQty } from '../utils/normalize.js'

const getQueueState = (model) => {
  const completed = model.task.status === 'completed'
  const needsReissue = !completed && (model.summary.hasShortage || model.summary.totalShortage > 0 || model.parts?.some(part => part.shortage > 0))
  const hasRedoInProgress = !completed && model.parts?.some(part => part.activeRedo || part.cards?.some(card => card?.is_rework || String(card?.card_info || '').includes('[REDO]')))
  const isNew = !completed && model.summary.totalCards === 0
  const isReady = !completed && model.summary.isReady
  const inProgress = !completed && model.summary.totalCards > 0 && !isReady && !needsReissue && !hasRedoInProgress

  if (completed) return { key: 'completed', color: '#64748b', bg: 'transparent', icon: <CheckCircle2 size={14} />, label: 'Виконано', hint: 'Наряд завершено' }
  if (isReady) return { key: 'ready', color: '#10b981', bg: 'rgba(16,185,129,.12)', icon: <ArrowRight size={14} />, label: 'Готово', hint: 'Всі картки готові' }
  if (needsReissue) return { key: 'shortage', color: '#ef4444', bg: 'rgba(239,68,68,.12)', icon: <AlertTriangle size={14} />, label: 'Довипуск', hint: 'Потрібен довипуск' }
  if (hasRedoInProgress) return { key: 'reissue', color: '#ef4444', bg: 'rgba(239,68,68,.12)', icon: <AlertTriangle size={14} />, label: 'Довипуск', hint: 'Довипуск у процесі' }
  if (isNew) return { key: 'new', color: '#3b82f6', bg: 'rgba(59,130,246,.12)', icon: <Clock size={14} />, label: 'Новий', hint: 'Картки ще не згенеровано' }
  if (inProgress) return { key: 'progress', color: '#eab308', bg: 'rgba(234,179,8,.12)', icon: <Layers size={14} />, label: 'В роботі', hint: 'У процесі виробництва' }
  return { key: 'idle', color: '#64748b', bg: 'transparent', icon: <Layers size={14} />, label: 'Наряд', hint: 'Очікує дії' }
}

const stateRank = {
  shortage: 0,
  reissue: 1,
  ready: 2,
  progress: 3,
  new: 4,
  idle: 5,
  completed: 6
}

export default function TaskQueue({ taskModels, nomenclatures = [], activeId, onSelect, isDrawerOpen, setIsDrawerOpen, onOpenCreateNaryad }) {
  const handleSelect = (id) => {
    onSelect(id)
    if (typeof setIsDrawerOpen === 'function') setIsDrawerOpen(false)
  }

  return (
    <aside
      className={`side-panel no-print ${isDrawerOpen ? 'drawer-open' : ''}`}
      style={{ display: 'flex', flexDirection: 'column', background: '#121212', borderRight: '1px solid #222', transition: '0.3s transform', width: '300px', flexShrink: 0 }}
    >
      <div style={{ padding: '16px 20px', color: '#888', fontWeight: 850, fontSize: '0.65rem', display: 'flex', flexDirection: 'column', gap: '10px', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          <span>ЧЕРГА НАРЯДІВ ({taskModels.length})</span>
          {isDrawerOpen && (
            <button onClick={() => setIsDrawerOpen(false)} title="Закрити" style={{ background: 'transparent', border: 'none', color: '#555', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenCreateNaryad}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#fff',
            border: 'none',
            padding: '10px 14px',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: 950,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            letterSpacing: '0.5px',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
            transition: '0.2s'
          }}
        >
          + СТВОРИТИ НАРАД
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {[...taskModels].sort((a, b) => {
          const aState = getQueueState(a)
          const bState = getQueueState(b)
          return (stateRank[aState.key] ?? 9) - (stateRank[bState.key] ?? 9)
        }).map(model => {
          const active = activeId === model.id
          const state = getQueueState(model)
          const borderColor = active ? '#fff' : state.color
          const borderSize = active ? '6px' : '4px'
          const bgColor = active ? 'rgba(255,255,255,.08)' : state.bg
          const title = model.title || model.task.id
          const prodId = model.order?.nomenclature_id || model.order?.order_items?.[0]?.nomenclature_id
          const prod = nomenclatures?.find(n => String(n.id) === String(prodId))
          const product = prod ? prod.name : (model.order?.product_name || model.order?.nomenclature?.name || model.task.step || 'Цех №1')
          const qty = model.task.planned_sets || model.order?.quantity || 0
          const customer = model.order?.customer || model.order?.client || ''

          return (
            <button
              key={model.id}
              type="button"
              onClick={() => handleSelect(model.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '18px 15px',
                border: 'none',
                borderLeft: `${borderSize} solid ${borderColor}`,
                background: bgColor,
                cursor: 'pointer',
                transition: 'all .2s',
                marginBottom: '1px',
                color: '#fff'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <div style={{ fontWeight: 900, fontSize: '0.9rem', color: state.key === 'completed' ? '#555' : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  № {title}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: state.color, flexShrink: 0 }}>
                  {state.icon}
                  {state.key !== 'idle' && (
                    <span style={{ fontSize: '0.58rem', fontWeight: 950, color: state.key === 'progress' ? '#000' : '#fff', background: state.color, borderRadius: '6px', padding: '3px 7px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      {state.label}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ fontSize: '0.83rem', color: state.key === 'completed' ? '#555' : '#eaeaea', fontWeight: 900, margin: '4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {product} • <span style={{ color: state.key === 'completed' ? '#777' : '#ff9000' }}>{qty} шт.</span>
              </div>
              {customer && (
                <div style={{ fontSize: '0.7rem', color: state.key === 'completed' ? '#333' : '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {customer}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '9px', color: state.key === 'completed' ? '#333' : '#555', fontSize: '0.63rem', fontWeight: 950, textTransform: 'uppercase', flexWrap: 'wrap' }}>
                <span>Карток: <b style={{ color: state.key === 'completed' ? '#555' : '#ddd' }}>{model.summary.totalCards}</b></span>
                <span>Брак: <b style={{ color: model.summary.totalScrap > 0 ? '#ef4444' : '#777' }}>{formatQty(model.summary.totalScrap)}</b></span>
                {model.summary.totalShortage > 0 && <span style={{ color: '#ef4444' }}>Нестача: {formatQty(model.summary.totalShortage)}</span>}
              </div>

              <div style={{ fontSize: '0.6rem', color: state.color, fontWeight: 900, marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase' }}>
                {state.icon}
                {state.hint}
              </div>
            </button>
          )
        })}

        {taskModels.length === 0 && (
          <div style={{ padding: '20px', color: '#333', fontSize: '0.8rem', fontWeight: 800 }}>
            Немає активних нарядів для Foreman2
          </div>
        )}
      </div>
    </aside>
  )
}
