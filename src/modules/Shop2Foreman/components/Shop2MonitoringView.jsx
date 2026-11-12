import React, { useMemo, useState } from 'react'
import { formatElapsedTime, formatPlanned, getPlannedTime, formatMachine } from '../../Shop2/utils/shop2Helpers'
import { Shop2PaintingBadge } from '../../../components/common/Shop2PaintingBadge.jsx'

export const Shop2MonitoringView = ({ shop2Cards = [] }) => {
  const [stageFilter, setStageFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const counts = useMemo(() => {
    const inProgress = shop2Cards.filter(({ card }) => card.status === 'in-progress').length
    const buffer = shop2Cards.filter(({ card }) => ['at-buffer', 'waiting-buffer'].includes(card.status)).length
    const queued = shop2Cards.filter(({ card }) => card.status === 'new').length
    return { total: shop2Cards.length, inProgress, buffer, queued }
  }, [shop2Cards])

  const filtered = useMemo(() => {
    return shop2Cards.filter(({ card }) => {
      const op = String(card.operation || '').toLowerCase()
      if (stageFilter === 'pressing' && !op.includes('прес')) return false
      if (stageFilter === 'painting' && !op.includes('фарб') && !op.includes('маляр')) return false
      if (stageFilter === 'rework' && !op.includes('доопрац')) return false

      if (statusFilter === 'in-progress' && card.status !== 'in-progress') return false
      if (statusFilter === 'buffer' && !['at-buffer', 'waiting-buffer'].includes(card.status)) return false
      if (statusFilter === 'new' && card.status !== 'new') return false
      return true
    })
  }, [shop2Cards, stageFilter, statusFilter])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '14px 18px' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 900, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Усього активних РК</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 950, color: 'var(--text-strong)', marginTop: '4px' }}>{counts.total}</div>
        </div>
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '14px 18px' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 900, color: 'var(--text-dim)', textTransform: 'uppercase' }}>В роботі зараз</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 950, color: '#8b5cf6', marginTop: '4px' }}>{counts.inProgress}</div>
        </div>
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '14px 18px' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 900, color: 'var(--text-dim)', textTransform: 'uppercase' }}>У буфері</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 950, color: '#10b981', marginTop: '4px' }}>{counts.buffer}</div>
        </div>
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '14px 18px' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 900, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Очікують старту</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 950, color: '#3b82f6', marginTop: '4px' }}>{counts.queued}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'Усі етапи' },
            { id: 'pressing', label: 'Пресування' },
            { id: 'painting', label: 'Фарбування' },
            { id: 'rework', label: 'Доопрацювання' }
          ].map(btn => (
            <button
              key={btn.id}
              onClick={() => setStageFilter(btn.id)}
              className={`tab-btn ${stageFilter === btn.id ? 'active' : ''}`}
              style={{ padding: '7px 14px', fontSize: '0.75rem' }}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'Всі статуси' },
            { id: 'in-progress', label: 'В роботі' },
            { id: 'buffer', label: 'Буфер' },
            { id: 'new', label: 'Нові' }
          ].map(btn => (
            <button
              key={btn.id}
              onClick={() => setStatusFilter(btn.id)}
              className={`tab-btn ${statusFilter === btn.id ? 'active' : ''}`}
              style={{ padding: '7px 14px', fontSize: '0.75rem' }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '20px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)', fontSize: '0.68rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 15px' }}>Деталь</th>
                <th style={{ padding: '12px 15px' }}>Етап</th>
                <th style={{ padding: '12px 15px' }}>Статус</th>
                <th style={{ padding: '12px 15px' }}>К-сть</th>
                <th style={{ padding: '12px 15px' }}>Зміна / Оператор</th>
                <th style={{ padding: '12px 15px' }}>Верстат</th>
                <th style={{ padding: '12px 15px' }}>План. час</th>
                <th style={{ padding: '12px 15px' }}>Факт. час</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                    Немає активних робочих карток за обраним фільтром
                  </td>
                </tr>
              ) : filtered.map(({ card, displayInfo }) => {
                const nom = displayInfo?.nom || null
                const plannedMin = getPlannedTime(card, () => nom)
                const elapsedMin = card.started_at ? Math.max(0, Math.floor((Date.now() - new Date(card.started_at).getTime()) / 60000)) : 0
                const isOvertime = plannedMin > 0 && card.status === 'in-progress' && elapsedMin > plannedMin

                return (
                  <tr key={card.id} style={{ borderBottom: '1px solid var(--border-subtle)', fontSize: '0.82rem' }}>
                    <td style={{ padding: '12px 15px', fontWeight: 800 }}>
                      <div>{nom?.name || card.card_info || `#${card.id.slice(-8).toUpperCase()}`}</div>
                      {displayInfo?.routing && (
                        <div style={{ marginTop: '4px' }}>
                          <Shop2PaintingBadge routing={displayInfo.routing} compact={true} />
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 15px', fontWeight: 900, color: '#8b5cf6', fontSize: '0.75rem' }}>
                      {String(card.operation || '—').toUpperCase()}
                    </td>
                    <td style={{ padding: '12px 15px', fontSize: '0.72rem', fontWeight: 800 }}>
                      {card.status === 'in-progress' ? 'В роботі' : ['at-buffer', 'waiting-buffer'].includes(card.status) ? 'Буфер' : 'Очікує'}
                    </td>
                    <td style={{ padding: '12px 15px', fontWeight: 900 }}>{card.quantity || 0} шт</td>
                    <td style={{ padding: '12px 15px' }}>
                      <div style={{ fontWeight: 700 }}>{card.operator_name || '—'}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>{card.shift_name || '—'}</div>
                    </td>
                    <td style={{ padding: '12px 15px', color: '#eab308', fontWeight: 800 }}>{formatMachine(card.machine)}</td>
                    <td style={{ padding: '12px 15px', color: '#3b82f6', fontWeight: 800 }}>{formatPlanned(plannedMin)}</td>
                    <td style={{ padding: '12px 15px', color: isOvertime ? '#ef4444' : '#10b981', fontWeight: 800 }}>
                      {card.started_at ? formatElapsedTime(card.started_at) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

