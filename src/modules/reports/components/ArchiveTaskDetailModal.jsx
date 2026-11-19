import React, { useEffect, useMemo, useState } from 'react'
import { X, ChevronDown, ChevronRight, RefreshCw, CheckCircle2, Clock, Layers } from 'lucide-react'
import { supabase } from '../../../supabase'

const CARD_STATUS_META = {
  'completed': { label: 'Готово', color: '#10b981', bg: 'rgba(16,185,129,0.14)' },
  'at-buffer': { label: 'В буфері', color: '#3b82f6', bg: 'rgba(59,130,246,0.14)' },
  'waiting-buffer': { label: 'Очікує буфер', color: '#3b82f6', bg: 'rgba(59,130,246,0.14)' },
  'at-shop2-buffer': { label: 'Буфер Цеху №2', color: '#3b82f6', bg: 'rgba(59,130,246,0.14)' },
  'in-progress': { label: 'В роботі', color: '#eab308', bg: 'rgba(234,179,8,0.14)' },
  'paused': { label: 'Пауза', color: '#f97316', bg: 'rgba(249,115,22,0.14)' },
  'new': { label: 'Очікує', color: '#94a3b8', bg: 'rgba(148,163,184,0.14)' },
  'waiting-materials': { label: 'Очікує матеріали', color: '#f59e0b', bg: 'rgba(245,158,11,0.14)' },
  'waiting-cutters': { label: 'Очікує фрези', color: '#f59e0b', bg: 'rgba(245,158,11,0.14)' }
}

const formatDateTime = value => value
  ? new Date(value).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—'

const formatQty = value => (Number(value) || 0).toLocaleString('uk-UA')

export const ArchiveTaskDetailModal = ({ task, onClose }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cards, setCards] = useState([])
  const [historyRows, setHistoryRows] = useState([])
  const [nomMap, setNomMap] = useState(new Map())
  const [expandedPartId, setExpandedPartId] = useState(null)

  useEffect(() => {
    if (!task?.id) return undefined
    let cancelled = false
    setLoading(true)
    setError('')
    setCards([])
    setHistoryRows([])
    setExpandedPartId(null)

    Promise.resolve().then(async () => {
      try {
        const { data: taskCards, error: cardsErr } = await supabase
          .from('work_cards')
          .select('*')
          .eq('task_id', task.id)
          .order('created_at', { ascending: true })
        if (cardsErr) throw cardsErr

        const loadedCards = taskCards || []
        const cardIds = loadedCards.map(c => c.id).filter(Boolean)
        const nomIds = [...new Set([
          task.nomenclature_id,
          ...loadedCards.map(c => c.nomenclature_id)
        ].filter(Boolean).map(String))]

        let loadedHistory = []
        for (let i = 0; i < cardIds.length; i += 100) {
          const chunk = cardIds.slice(i, i + 100)
          const { data: histChunk, error: histErr } = await supabase
            .from('work_card_history')
            .select('*')
            .in('card_id', chunk)
            .order('created_at', { ascending: true })
          if (histErr) throw histErr
          if (histChunk) loadedHistory.push(...histChunk)
        }

        const nextNomMap = new Map()
        if (nomIds.length > 0) {
          const { data: v2Noms } = await supabase
            .from('nomenclatures_v2')
            .select('id, name, code, qr_code, unit')
            .in('id', nomIds)
          ;(v2Noms || []).forEach(n => nextNomMap.set(String(n.id), n))

          const missingIds = nomIds.filter(id => !nextNomMap.has(id))
          if (missingIds.length > 0) {
            const { data: legacyNoms } = await supabase
              .from('nomenclatures')
              .select('id, name, code, unit')
              .in('id', missingIds)
            ;(legacyNoms || []).forEach(n => nextNomMap.set(String(n.id), n))
          }
        }

        if (!cancelled) {
          setCards(loadedCards)
          setHistoryRows(loadedHistory)
          setNomMap(nextNomMap)
          if (loadedCards.length > 0) {
            const firstNomId = String(loadedCards[0].nomenclature_id || 'unknown')
            setExpandedPartId(firstNomId)
          }
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Не вдалося завантажити деталі наряду')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })

    return () => { cancelled = true }
  }, [task?.id, task?.nomenclature_id])

  const historyByCardId = useMemo(() => {
    const map = new Map()
    ;(historyRows || []).forEach(row => {
      const cid = String(row.card_id || '')
      if (!cid) return
      if (!map.has(cid)) map.set(cid, [])
      map.get(cid).push(row)
    })
    return map
  }, [historyRows])

  const parts = useMemo(() => {
    const grouped = new Map()
    ;(cards || []).forEach(card => {
      const key = String(card.nomenclature_id || 'unknown')
      if (!grouped.has(key)) {
        const nom = nomMap.get(key)
        grouped.set(key, {
          nomId: key,
          name: nom?.name || card.nomenclature_name || 'Невідома деталь',
          code: nom?.code || nom?.qr_code || '',
          cards: [],
          produced: 0,
          scrap: 0,
          completedCount: 0,
          inWorkCount: 0,
          waitingCount: 0
        })
      }
      const group = grouped.get(key)
      group.cards.push(card)

      const cardHist = historyByCardId.get(String(card.id)) || []
      const cardScrap = cardHist.reduce((sum, h) => sum + (Number(h.scrap_qty) || 0), 0)
      group.scrap += Math.max(Number(card.scrap_qty) || 0, cardScrap)

      if (['completed', 'at-buffer', 'waiting-buffer', 'at-shop2-buffer'].includes(card.status)) {
        group.completedCount += 1
        group.produced += Number(card.quantity) || 0
      } else if (card.status === 'in-progress' || card.status === 'paused') {
        group.inWorkCount += 1
      } else {
        group.waitingCount += 1
      }
    })
    return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, 'uk-UA', { numeric: true }))
  }, [cards, nomMap, historyByCardId])

  if (!task) return null

  const order = task._order
  const totalProduced = parts.reduce((sum, p) => sum + p.produced, 0)
  const totalScrap = parts.reduce((sum, p) => sum + p.scrap, 0)
  const totalCompletedCards = parts.reduce((sum, p) => sum + p.completedCount, 0)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '1120px', maxHeight: '90vh',
          background: 'var(--surface-1)', border: '1px solid var(--border-subtle)',
          borderRadius: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)'
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', background: 'var(--surface-1)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-strong)' }}>
                Наряд № {order?.order_num || '—'}
              </h3>
              <span style={{ background: 'rgba(255,144,0,0.14)', color: '#d97706', padding: '3px 10px', borderRadius: '8px', fontWeight: 800, fontSize: '0.78rem' }}>
                {task.step || 'Етап'}
              </span>
              <span style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', padding: '3px 10px', borderRadius: '8px', fontWeight: 700, fontSize: '0.78rem' }}>
                Партія #{task.batch_index || '1'}
              </span>
              <span style={{
                background: task.status === 'completed' ? 'rgba(16,185,129,0.14)' : 'rgba(234,179,8,0.14)',
                color: task.status === 'completed' ? '#10b981' : '#d97706',
                padding: '3px 10px', borderRadius: '8px', fontWeight: 800, fontSize: '0.78rem',
                display: 'inline-flex', alignItems: 'center', gap: '5px'
              }}>
                {task.status === 'completed' ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                {task.status === 'completed' ? 'Завершено' : task.status}
              </span>
            </div>
            <div style={{ marginTop: '6px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Клієнт: <strong style={{ color: 'var(--text-strong)' }}>{order?.customer || '—'}</strong>
              {' • '}Комплектів: <strong style={{ color: '#ff9000' }}>{task.planned_sets || '—'}</strong>
              {' • '}Створено: {formatDateTime(task.created_at)}
              {task.completed_at ? ` • Завершено: ${formatDateTime(task.completed_at)}` : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-strong)', borderRadius: '10px', padding: '8px', cursor: 'pointer', display: 'flex' }}
            title="Закрити"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, background: 'var(--surface-inset)' }}>
          {/* Summary KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '20px' }}>
            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '12px 14px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 800, textTransform: 'uppercase' }}>Позицій деталей</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-strong)', marginTop: '4px' }}>{parts.length}</div>
            </div>
            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '12px 14px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 800, textTransform: 'uppercase' }}>Всього карток</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-strong)', marginTop: '4px' }}>{cards.length} <small style={{ fontSize: '0.75rem', color: '#10b981' }}>({totalCompletedCards} готових)</small></div>
            </div>
            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '12px 14px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 800, textTransform: 'uppercase' }}>Вироблено</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#3b82f6', marginTop: '4px' }}>{formatQty(totalProduced)} шт</div>
            </div>
            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '12px 14px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 800, textTransform: 'uppercase' }}>Брак</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: totalScrap > 0 ? '#ef4444' : 'var(--text-dim)', marginTop: '4px' }}>{formatQty(totalScrap)} шт</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{ width: '4px', height: '20px', background: '#ff9000', borderRadius: '2px' }} />
            <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-strong)', letterSpacing: '0.04em' }}>
              Архів робочих карток
            </h4>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-dim)' }}>
              <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 12px', color: '#ff9000' }} />
              Завантаження робочих карток наряду...
            </div>
          ) : error ? (
            <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444', fontWeight: 700 }}>
              {error}
            </div>
          ) : parts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)', border: '1px dashed var(--border-subtle)', borderRadius: '12px', background: 'var(--surface-1)' }}>
              <Layers size={30} style={{ display: 'block', margin: '0 auto 10px', opacity: 0.4 }} />
              Для цього наряду робочі картки не знайдено
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {parts.map(part => {
                const expanded = expandedPartId === part.nomId
                return (
                  <div key={part.nomId} style={{ border: '1px solid var(--border-subtle)', borderRadius: '14px', overflow: 'hidden', background: 'var(--surface-1)' }}>
                    <div
                      onClick={() => setExpandedPartId(expanded ? null : part.nomId)}
                      style={{
                        display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center',
                        gap: '12px', padding: '12px 16px', cursor: 'pointer', userSelect: 'none'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 900, fontSize: '0.94rem', color: 'var(--text-strong)' }}>
                          {part.name} {part.code ? <small style={{ color: 'var(--text-dim)', fontWeight: 700 }}>({part.code})</small> : null}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '3px', fontWeight: 700 }}>
                          Вироблено: <span style={{ color: '#3b82f6' }}>{formatQty(part.produced)} шт</span>
                          {' • '}Брак: <span style={{ color: part.scrap > 0 ? '#ef4444' : 'var(--text-dim)' }}>{formatQty(part.scrap)} шт</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.76rem', fontWeight: 800 }}>
                        <span style={{ color: 'var(--text-strong)' }}>
                          Карток: {part.cards.length}
                          <small style={{ marginLeft: '6px', color: 'var(--text-muted)' }}>
                            ({part.waitingCount > 0 ? `Очікують: ${part.waitingCount} · ` : ''}
                            {part.inWorkCount > 0 ? `В роботі: ${part.inWorkCount} · ` : ''}
                            Готові: {part.completedCount})
                          </small>
                        </span>
                        {expanded ? <ChevronDown size={16} color="#ff9000" /> : <ChevronRight size={16} color="var(--text-dim)" />}
                      </div>
                    </div>

                    {expanded && (
                      <div style={{ borderTop: '1px solid var(--border-subtle)', overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                          <thead>
                            <tr style={{ background: 'var(--surface-2)', color: 'var(--text-dim)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                              <th style={{ padding: '10px 14px', fontSize: '0.68rem', textTransform: 'uppercase' }}>Картка</th>
                              <th style={{ padding: '10px 14px', fontSize: '0.68rem', textTransform: 'uppercase' }}>Етап</th>
                              <th style={{ padding: '10px 14px', fontSize: '0.68rem', textTransform: 'uppercase' }}>Верстат</th>
                              <th style={{ padding: '10px 14px', fontSize: '0.68rem', textTransform: 'uppercase' }}>Оператори (історія)</th>
                              <th style={{ padding: '10px 14px', fontSize: '0.68rem', textTransform: 'uppercase', textAlign: 'right' }}>К-сть</th>
                              <th style={{ padding: '10px 14px', fontSize: '0.68rem', textTransform: 'uppercase', textAlign: 'right' }}>Брак</th>
                              <th style={{ padding: '10px 14px', fontSize: '0.68rem', textTransform: 'uppercase' }}>Статус</th>
                              <th style={{ padding: '10px 14px', fontSize: '0.68rem', textTransform: 'uppercase' }}>Дата</th>
                            </tr>
                          </thead>
                          <tbody>
                            {part.cards.map(card => {
                              const cardHist = historyByCardId.get(String(card.id)) || []
                              const cuttingHist = cardHist.filter(h => String(h.stage_name || '').toLowerCase().includes('розкрій'))
                              const histOps = [...new Set(
                                (cuttingHist.length > 0 ? cuttingHist : cardHist)
                                  .map(h => String(h.operator_name || '').trim())
                                  .filter(n => n && !['—', '-', 'не вказано', 'команда', 'буфер'].includes(n.toLowerCase()))
                              )]
                              const machineLabel = card.machine || card.machine_name || cuttingHist.find(h => h.machine_name)?.machine_name || '—'
                              const statusMeta = CARD_STATUS_META[card.status] || { label: card.status || '—', color: '#94a3b8', bg: 'rgba(148,163,184,0.14)' }
                              const cardScrap = Math.max(
                                Number(card.scrap_qty) || 0,
                                cardHist.reduce((s, h) => s + (Number(h.scrap_qty) || 0), 0)
                              )

                              return (
                                <tr key={card.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                  <td style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-strong)' }}>
                                    #{String(card.id).slice(-8).toUpperCase()}
                                  </td>
                                  <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{card.operation || '—'}</td>
                                  <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{machineLabel}</td>
                                  <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                                    {histOps.length > 0 ? histOps.join(', ') : (card.operator_name || '—')}
                                  </td>
                                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#3b82f6' }}>
                                    {formatQty(card.quantity)}
                                  </td>
                                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: cardScrap > 0 ? '#ef4444' : 'var(--text-dim)' }}>
                                    {cardScrap}
                                  </td>
                                  <td style={{ padding: '10px 14px' }}>
                                    <span style={{ background: statusMeta.bg, color: statusMeta.color, padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
                                      {statusMeta.label}
                                    </span>
                                  </td>
                                  <td style={{ padding: '10px 14px', color: 'var(--text-dim)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                                    {formatDateTime(card.completed_at || card.created_at)}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

