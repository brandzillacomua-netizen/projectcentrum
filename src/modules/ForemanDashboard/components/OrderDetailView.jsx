import React, { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, RefreshCw, Search } from 'lucide-react'
import WipTable from './WipTable'
import { fetchWorkCardHistoryByCardIds, sumFlowField } from '../utils/foremanDashboardHelpers.jsx'

const OrderDetailView = ({
  task, order, tasks, workCards, allTasksCards, cardsByTaskId, allCardsHistory, flowTotalsRows = [], nomenclatures, bomItems, inventory,
  productionCache, scrapCache, taskStatusMap, taskProgressMap,
  orderAllCards, isLoadingCards, wipGroups, searchQuery, setSearchQuery, onCellClick
}) => {
  if (!task || !order) return <div style={{ padding: '20px', color: 'var(--text-muted, #52525b)' }}>Наряд не знайдено...</div>

  const status = taskStatusMap[task.id]
  const progress = taskProgressMap[task.id] || { actual: 0, demand: 0 }
  const pct = progress.demand > 0 ? Math.min(100, Math.round((progress.actual / progress.demand) * 100)) : 0

  const [taskHistory, setTaskHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [expandedCardsState, setExpandedCardsState] = useState({})

  useEffect(() => {
    if (!task?.id || !orderAllCards || orderAllCards.length === 0) {
      setTaskHistory([])
      return
    }
    setLoadingHistory(true)
    const cardIds = orderAllCards.map(c => c.id)
    let cancelled = false
    fetchWorkCardHistoryByCardIds(cardIds)
      .then(data => {
        if (!cancelled) {
          setTaskHistory(data.sort((a, b) => new Date(a.completed_at || a.created_at || 0) - new Date(b.completed_at || b.created_at || 0)))
        }
      })
      .catch(error => console.warn('Error loading task history:', error?.message || error))
      .finally(() => {
        if (!cancelled) setLoadingHistory(false)
      })
    return () => { cancelled = true }
  }, [task?.id, orderAllCards])

  const accentColor = status === 'ready' ? '#10b981'
    : status === 'shortage' ? '#ef4444'
      : status === 'new' ? '#3b82f6'
        : status === 'completed' ? '#10b981'
          : '#eab308'

  const displayNum = order.order_num || task.id.split('-')[0]
  const batchSuffix = task.batch_index ? `/${task.batch_index}` : ''

  const prodNames = (order?.order_items || [])
    .map(it => nomenclatures.find(n => n.id === it.nomenclature_id)?.name)
    .filter(Boolean).join(', ') || '—'

  const dateStr = task.created_at
    ? new Date(task.created_at).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—'

  // Build bottlenecks list from snapshot
  const bottlenecks = useMemo(() => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const snapshot = task.plan_snapshot || {}
    const taskProd = productionCache[task.id] || {}
    const taskScrap = scrapCache[task.id] || {}
    const list = []

    Object.keys(snapshot).filter(k => uuidRegex.test(k)).forEach(nomIdStr => {
      const snap = snapshot[nomIdStr]
      if (!snap || !snap.need) return
      const nom = nomenclatures.find(n => String(n.id) === nomIdStr)
      if (nom?.type !== 'part') return

      const need = snap.need || 0
      const produced = taskProd[nomIdStr] || 0
      const stock = Number(snap.stock) || 0
      const sheets = Number(snap.sheets) || 0
      const units = Number(snap.units_per_sheet) || 1
      const scrap = taskScrap[nomIdStr] || 0
      const plannedReserve = Math.max(0, (sheets * units) + stock - need)
      const shortage = Math.max(0, scrap - plannedReserve)
      const sgpGap = Math.max(0, need - produced)
      const qtyPer = progress.demand > 0 ? Math.round(need / progress.demand) : 1
      const potential = qtyPer > 0 ? Math.floor(produced / qtyPer) : 0

      if (shortage > 0) {
        list.push({ name: nom.name, code: nom.code, potential, qty: produced, needed: need, shortage, qtyPer, scrap, plannedReserve, sgpGap })
      }
    })
    list.sort((a, b) => a.potential - b.potential)
    return list
  }, [task, productionCache, scrapCache, nomenclatures, progress.demand])

  // Per-part detail table from workCards
  const partDetails = useMemo(() => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const snapshot = task.plan_snapshot || {}

    const orderTasks = tasks.filter(t => t.order_id === task.order_id)
    const orderTaskIdSet = new Set(orderTasks.map(t => t.id))
    const allTaskCards = orderTasks.flatMap(t => cardsByTaskId[t.id] || [])

    const parts = []
    Object.keys(snapshot).filter(k => uuidRegex.test(k)).forEach(nomIdStr => {
      const snap = snapshot[nomIdStr]
      if (!snap) return
      const nom = nomenclatures.find(n => String(n.id) === nomIdStr)
      if (!nom || nom.type !== 'part') return

      const nomCards = allTaskCards.filter(c => String(c.nomenclature_id) === nomIdStr)

      const getQFromCards = (ops, statuses) => {
        const opArr = Array.isArray(ops) ? ops : [ops]
        const stArr = Array.isArray(statuses) ? statuses : [statuses]
        return nomCards.filter(c => {
          const isMatchOp = opArr.some(op => {
            if (op === 'Галтовка') return c.operation === 'Галтовка' || c.operation?.startsWith('Галтовка')
            if (op === 'Сортування') return c.operation === 'Сортування' || c.operation?.startsWith('Сортування') || c.operation?.includes('Сортування')
            return c.operation === op
          })
          return isMatchOp && stArr.includes(c.status)
        }).reduce((s, c) => s + (Number(c.quantity) || 0), 0)
      }

      const qCutWait = getQFromCards(['Розкрій'], ['new', 'waiting-materials', 'waiting-machines'])
      const qCut = getQFromCards(['Розкрій'], ['in-progress', 'paused', 'hold'])
      const qCutBuf = getQFromCards(['Розкрій'], ['at-buffer'])
      const qGalt = getQFromCards(['Галтовка'], ['in-progress'])
      const qGaltBuf = getQFromCards(['Галтовка'], ['at-buffer'])
      const qPriy = getQFromCards(['Прийомка'], ['new', 'in-progress', 'at-buffer'])
      const qSortAct = getQFromCards(['Сортування'], ['new', 'in-progress', 'at-buffer'])
      const qSort = nomCards.filter(c => c.status === 'at-shop2-buffer')
        .reduce((s, c) => s + Math.max(0, (Number(c.quantity) || 0) - (Number(c.used_in_shop2_qty) || 0)), 0)
      const qMalWait = getQFromCards(['Фарбування', 'Малярка'], ['new'])
      const qMal = getQFromCards(['Фарбування', 'Малярка'], ['in-progress'])
      const qMalBuf = getQFromCards(['Фарбування', 'Малярка'], ['at-buffer'])
      const qPresWait = getQFromCards(['Пресування'], ['new'])
      const qPres = getQFromCards(['Пресування'], ['in-progress'])
      const qPresBuf = getQFromCards(['Пресування'], ['at-buffer'])
      const qDoopWait = getQFromCards(['Доопрацювання'], ['new'])
      const qDoop = getQFromCards(['Доопрацювання'], ['in-progress'])
      const qDoopBuf = getQFromCards(['Доопрацювання'], ['at-buffer'])

      const groupProduced = nomCards.filter(c => {
        const op = (c.operation || '').toLowerCase()
        const isShop1 = ['розкрій', 'галтовка', 'прийомка', 'сортування'].some(o => op.includes(o))
        return isShop1 && (c.status === 'completed' || c.status === 'at-shop2-buffer')
      }).reduce((s, c) => s + (Number(c.quantity) || 0), 0)

      const totalShop2Qty = nomCards.filter(c => {
        const op = (c.operation || '').toLowerCase()
        return ['пресування', 'фарбування', 'малярка', 'доопрацювання', 'пакування', 'сгп'].some(o => op.includes(o))
      }).reduce((s, c) => s + (Number(c.quantity) || 0), 0)

      const completedShop2Qty = nomCards.filter(c => {
        const op = (c.operation || '').toLowerCase()
        const isShop2 = ['пресування', 'фарбування', 'малярка', 'доопрацювання', 'пакування', 'сгп'].some(o => op.includes(o))
        return isShop2 && c.status === 'completed'
      }).reduce((s, c) => s + (Number(c.quantity) || 0), 0)

      const initialStock = Number(snap.stock) || 0
      const plannedReserve = Math.max(0, ((Number(snap.sheets) || 0) * (Number(snap.units_per_sheet) || 1)) + initialStock - (snap.need || 0))
      const totalPotentialSgp = completedShop2Qty + initialStock
      const flowRowsForThisPart = flowTotalsRows.filter(row =>
        String(row.nomenclature_id) === nomIdStr && row.task_id && orderTaskIdSet.has(row.task_id)
      )
      const flowSgpQty = sumFlowField(flowRowsForThisPart, 'total_good', ['sgp'])
      const flowScrapQty = sumFlowField(flowRowsForThisPart, 'total_scrap')
      const netSgpQty = Math.max(0, flowSgpQty - flowScrapQty)
      const sgpProduced = Math.max(0, groupProduced - qSort)
      const producedForSgp = groupProduced > 0 ? sgpProduced : netSgpQty
      const earlyWipQty = qCutWait + qCut + qCutBuf + qGalt + qGaltBuf + qPriy + qSortAct + qMalWait + qMal + qMalBuf + qPresWait + qPres + qPresBuf + qDoopWait + qDoop + qDoopBuf
      const nonReissueEarlyWip = Math.max(0, flowScrapQty - plannedReserve) > 0 ? 0 : earlyWipQty
      const qSgp = (snap.need || 0) > 0
        ? Math.min(snap.need || 0, producedForSgp, Math.max(0, (snap.need || 0) - nonReissueEarlyWip))
        : Math.max(0, producedForSgp)

      const bzExcess = Math.max(0, totalPotentialSgp - (snap.need || 0))
      const flowBzQty = sumFlowField(flowRowsForThisPart, 'total_bz')
      const qBz = groupProduced > 0
        ? initialStock + Math.max(0, sgpProduced - (snap.need || 0))
        : (flowRowsForThisPart.length > 0
          ? initialStock + Math.max(flowBzQty, Math.max(0, netSgpQty - (snap.need || 0)))
          : Math.max(0, groupProduced - qSort - totalShop2Qty) + bzExcess)

      const cardIdsForThisPart = new Set(nomCards.map(c => c.id))
      const scrapByScope = allCardsHistory.filter(h =>
        String(h.nomenclature_id) === nomIdStr && h.task_id && orderTaskIdSet.has(h.task_id)
      ).reduce((s, h) => s + (Number(h.scrap_qty) || 0), 0)
      const scrapByCard = allCardsHistory.filter(h => h.card_id && cardIdsForThisPart.has(h.card_id)).reduce((s, h) => s + (Number(h.scrap_qty) || 0), 0)
      const scrap = scrapByScope || scrapByCard || flowScrapQty

      const sum = qCutWait + qCut + qCutBuf + qGalt + qGaltBuf + qPriy + qSortAct + qSort + qMalWait + qMal + qMalBuf + qPresWait + qPres + qPresBuf + qDoopWait + qDoop + qDoopBuf + qBz + qSgp

      const matchSearch = !searchQuery ||
        nom.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (nom.code || '').toLowerCase().includes(searchQuery.toLowerCase())

      if (matchSearch) {
        parts.push({
          id: nomIdStr, name: nom.name, code: nom.code || '',
          demand: snap.need || 0,
          qCutWait, qCut, qCutBuf, qGalt, qGaltBuf, qPriy,
          qSortAct, qSort, qMalWait, qMal, qMalBuf, qPresWait, qPres,
          qPresBuf, qDoopWait, qDoop, qDoopBuf, qBz, qSgp, qScrap: scrap, sum
        })
      }
    })
    return parts
  }, [task, orderAllCards, nomenclatures, allCardsHistory, flowTotalsRows, searchQuery, tasks, cardsByTaskId])

  const detailGroup = partDetails.length > 0
    ? [{ id: 'detail', name: prodNames, code: '', rows: partDetails, trend: { potential: progress.actual, actual: progress.actual, demand: progress.demand } }]
    : []

  return (
    <div>
      {/* Header card */}
      <div style={{ background: 'var(--card-bg, #18181b)', border: `1px solid ${accentColor}35`, borderRadius: '20px', overflow: 'hidden', marginBottom: '24px', boxShadow: `0 8px 32px rgba(0,0,0,0.08), 0 0 0 1px ${accentColor}15` }}>
        <div style={{ height: '4px', background: `linear-gradient(90deg, ${accentColor}, ${accentColor}40)` }} />
        <div style={{ padding: '22px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              {/* Status badge */}
              <div style={{ marginBottom: '8px' }}>
                {status === 'ready' && <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '3px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 900, letterSpacing: '0.08em' }}>✅ ГОТОВО ДО ЗАКРИТТЯ</span>}
                {status === 'shortage' && <span style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', padding: '3px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 900, letterSpacing: '0.08em' }}>⚠️ ПОТРІБЕН ДОВИПУСК</span>}
                {status === 'new' && <span style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)', padding: '3px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 900, letterSpacing: '0.08em' }}>🆕 НОВИЙ (картки не створено)</span>}
                {status === 'in_progress' && <span style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308', border: '1px solid rgba(234,179,8,0.3)', padding: '3px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 900, letterSpacing: '0.08em' }}>⚙️ В РОБОТІ</span>}
                {status === 'completed' && <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '3px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 900, letterSpacing: '0.08em' }}>✓ НАРЯД ВИКОНАНО</span>}
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 950, color: 'var(--text, #f4f4f5)', lineHeight: 1.1 }}>
                Наряд №{displayNum}{batchSuffix}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted, #71717a)', marginTop: '4px', fontWeight: 600 }}>
                <span style={{ color: 'var(--text-muted, #a1a1aa)' }}>ВИРІБ:</span> <span style={{ color: accentColor }}>{prodNames}</span>
                <span style={{ margin: '0 10px', color: 'var(--glass-border, rgba(0,0,0,0.1))' }}>|</span>
                <span>{order.customer || '—'}</span>
                <span style={{ margin: '0 10px', color: 'var(--glass-border, rgba(0,0,0,0.1))' }}>|</span>
                <span style={{ color: 'var(--text-muted, #52525b)' }}>від {dateStr}</span>
                {task.batch_index && (
                  <span style={{ marginLeft: '10px', background: '#eab308', color: '#000', padding: '1px 8px', borderRadius: '5px', fontSize: '0.72rem', fontWeight: 900 }}>ПАРТІЯ #{task.batch_index}</span>
                )}
              </div>
            </div>
            {/* Progress stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, auto)', gap: '12px', textAlign: 'center' }}>
              {[
                { label: 'На СГП', value: progress.actual, color: '#10b981' },
                { label: 'Потреба', value: progress.demand, color: 'var(--text-muted, #a1a1aa)' },
                { label: 'Виконано', value: `${pct}%`, color: accentColor },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--bg, rgba(0,0,0,0.03))', border: '1px solid var(--glass-border, rgba(0,0,0,0.08))', borderRadius: '12px', padding: '12px 16px' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 950, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-muted, #52525b)', fontWeight: 800, textTransform: 'uppercase', marginTop: '4px', letterSpacing: '0.08em' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontWeight: 800, marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted, #52525b)' }}>ВИКОНАННЯ НАРЯДУ</span>
              <span style={{ color: accentColor }}>{pct}%</span>
            </div>
            <div style={{ height: '10px', background: 'var(--bg, rgba(0,0,0,0.05))', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--glass-border, rgba(0,0,0,0.08))', position: 'relative' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${accentColor}, ${accentColor}99)`, borderRadius: '10px', transition: 'width 0.6s ease', boxShadow: `0 0 10px ${accentColor}50` }} />
              {pct > 0 && pct < 100 && (
                <div style={{ position: 'absolute', left: `${pct}%`, top: '50%', transform: 'translateY(-50%)', width: '2px', height: '14px', background: 'var(--text, #fff)', opacity: 0.4 }} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottlenecks panel */}
      {bottlenecks.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '16px', padding: '18px 20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <AlertTriangle size={16} color="#ef4444" />
            <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Вузькі місця — потрібен довипуск ({bottlenecks.length})
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
            {bottlenecks.map(b => (
              <div key={b.name} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '12px 14px' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text, #fff)', marginBottom: '6px' }}>{b.name}{b.code ? ` (${b.code})` : ''}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                  <span style={{ color: 'var(--text-muted, #9ca3af)' }}>СГП: <strong style={{ color: '#ef4444' }}>{b.qty}</strong> / {b.needed} шт.</span>
                  <span style={{ color: '#ef4444', fontWeight: 700 }}>Довипуск: {b.shortage}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', marginTop: '5px', color: 'var(--text-muted, #71717a)' }}>
                  <span>Брак: {b.scrap}</span>
                  <span>Запас: {b.plannedReserve}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #52525b)' }} />
          <input
            type="text"
            placeholder="Пошук деталі..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '10px 12px 10px 36px', background: 'var(--card-bg, #18181b)', border: '1px solid var(--glass-border, rgba(0,0,0,0.1))', borderRadius: '10px', color: 'var(--text, #f4f4f5)', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => e.target.style.borderColor = '#ef4444'}
            onBlur={e => e.target.style.borderColor = 'var(--glass-border, rgba(0,0,0,0.1))'}
          />
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #3f3f46)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          РУХ ДЕТАЛЕЙ ПО ОПЕРАЦІЯХ
        </div>
        {isLoadingCards && (
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #52525b)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> Завантаження...
          </div>
        )}
      </div>

      {/* Detail WIP table */}
      <WipTable
        groupedData={detailGroup}
        maxHeight="calc(100vh - 420px)"
        emptyText={isLoadingCards ? 'Завантаження деталей наряду...' : 'Немає деталей для відображення. Перевірте план-знімок наряду.'}
        onCellClick={onCellClick}
      />

      {/* ─── CARD FLOW VISUALIZATION SECTION ─── */}
      <div style={{ marginTop: '35px', background: 'var(--card-bg, #18181b)', border: '1px solid var(--glass-border, rgba(0,0,0,0.1))', borderRadius: '24px', padding: '25px', boxShadow: '0 10px 40px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#ff9000', fontWeight: 950, display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <span>📊</span> ХРОНОЛОГІЯ ТА СТАТУС РУХУ КАРТ (ПО ВСІХ КАРТКАХ ДЕТАЛІ)
          </h3>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #71717a)', fontWeight: 600 }}>
            Аналітика вузьких місць за часовими інтервалами всього наряду
          </div>
        </div>

        {loadingHistory ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted, #71717a)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <RefreshCw size={14} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> Завантаження історії руху карт...
          </div>
        ) : partDetails.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted, #52525b)', fontSize: '0.8rem', fontStyle: 'italic' }}>
            Дані про рух деталей відсутні
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {partDetails.map(part => {
              const partCards = orderAllCards.filter(c => String(c.nomenclature_id) === String(part.id))
              if (partCards.length === 0) return null

              const cardIds = partCards.map(c => c.id)
              const cardHistory = taskHistory.filter(h => cardIds.includes(h.card_id))

              const stagesConfig = [
                { key: 'Cutting', label: 'Розкрій', ops: ['Розкрій', 'Різка'], color: '#f97316' },
                { key: 'Tumbling', label: 'Галтовка', ops: ['Галтовка', 'Галтовка (Вібростіл)', 'Галтовка (Мийка)', 'Галтовка (Галтовка)', 'Галтовка (Сушка)'], color: '#06b6d4' },
                { key: 'Acceptance', label: 'Прийомка', ops: ['Прийомка'], color: '#10b981' },
                { key: 'Sorting', label: 'Сортування', ops: ['Сортування'], color: '#8b5cf6' },
                { key: 'Pressing', label: 'Пресування', ops: ['Пресування'], color: '#eab308' },
                { key: 'Painting', label: 'Фарбування', ops: ['Фарбування', 'Малярка'], color: '#ec4899' },
                { key: 'Rework', label: 'Доопрацювання', ops: ['Доопрацювання'], color: '#ef4444' },
                { key: 'Sgp', label: 'СГП/Пак', ops: ['Пакування', 'Пакування/СГП', 'СГП'], color: '#6366f1' }
              ]

              const stageDurations = {}
              stagesConfig.forEach(s => { stageDurations[s.key] = 0 })

              cardHistory.forEach(h => {
                const matchedStage = stagesConfig.find(s => s.ops.some(op => h.stage_name === op || h.stage_name?.startsWith(op)))
                if (matchedStage && h.started_at && h.completed_at) {
                  const diff = new Date(h.completed_at) - new Date(h.started_at)
                  if (diff > 0) {
                    stageDurations[matchedStage.key] += diff
                  }
                }
              })

              partCards.forEach(c => {
                if (c.status === 'in-progress' && c.started_at) {
                  const matchedStage = stagesConfig.find(s => s.ops.some(op => c.operation === op || c.operation?.startsWith(op)))
                  if (matchedStage) {
                    const diff = new Date() - new Date(c.started_at)
                    if (diff > 0) {
                      stageDurations[matchedStage.key] += diff
                    }
                  }
                }
              })

              const totalDurationMs = Object.values(stageDurations).reduce((sum, v) => sum + v, 0)

              const formatMs = (ms) => {
                if (ms <= 0) return '0хв'
                const totalMins = Math.round(ms / 60000)
                const hrs = Math.floor(totalMins / 60)
                const mins = totalMins % 60
                return hrs > 0 ? `${hrs}г ${mins}хв` : `${mins}хв`
              }

              let bottleneckStage = null
              let maxMs = 0
              Object.entries(stageDurations).forEach(([key, ms]) => {
                if (ms > maxMs) {
                  maxMs = ms
                  bottleneckStage = stagesConfig.find(s => s.key === key)
                }
              })

              const bottleneckPct = totalDurationMs > 0 ? Math.round((maxMs / totalDurationMs) * 100) : 0

              const totalQty = partCards.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
              const activePartCards = partCards.filter(c => c.operation !== 'Склад БЗ' && c.operation !== 'Склад BZ')
              const avgCardDurationMs = activePartCards.length > 0 ? totalDurationMs / activePartCards.length : 0

              return (
                <div key={part.id} style={{ background: 'var(--bg, #09090b)', border: '1px solid var(--glass-border, rgba(0,0,0,0.1))', borderRadius: '20px', padding: '20px', transition: 'all 0.2s', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--text, #f4f4f5)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>🧩</span> {part.name}
                        {part.code && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #71717a)', fontWeight: 600 }}>({part.code})</span>}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #a1a1aa)', marginTop: '4px' }}>
                        Усього карток: <strong style={{ color: '#ff9000' }}>{partCards.length} шт</strong> | Загальна к-сть деталей: <strong style={{ color: 'var(--text, #f4f4f5)' }}>{totalQty} шт</strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', textAlign: 'right', fontSize: '0.72rem' }}>
                      <div style={{ background: 'var(--card-bg, #18181b)', border: '1px solid var(--glass-border, rgba(0,0,0,0.1))', padding: '6px 12px', borderRadius: '10px' }}>
                        <div style={{ color: 'var(--text-muted, #71717a)', fontSize: '0.62rem', fontWeight: 700 }}>СУМАРНИЙ ЧАС</div>
                        <div style={{ color: '#ff9000', fontWeight: 900, fontSize: '0.9rem' }}>{formatMs(totalDurationMs)}</div>
                      </div>
                      <div style={{ background: 'var(--card-bg, #18181b)', border: '1px solid var(--glass-border, rgba(0,0,0,0.1))', padding: '6px 12px', borderRadius: '10px' }}>
                        <div style={{ color: 'var(--text-muted, #71717a)', fontSize: '0.62rem', fontWeight: 700 }}>СЕРЕДНІЙ ЧАС КАРТИ</div>
                        <div style={{ color: '#10b981', fontWeight: 900, fontSize: '0.9rem' }}>{formatMs(avgCardDurationMs)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Progress timeline bar */}
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ height: '14px', background: 'var(--chip-bg, rgba(0,0,0,0.05))', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--glass-border, rgba(0,0,0,0.1))', display: 'flex' }}>
                      {totalDurationMs <= 0 ? (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted, #52525b)', fontSize: '0.62rem' }}>
                          Час виконання ще не зафіксовано
                        </div>
                      ) : (
                        stagesConfig.map(s => {
                          const ms = stageDurations[s.key] || 0
                          if (ms <= 0) return null
                          const pct = (ms / totalDurationMs) * 100
                          return (
                            <div
                              key={s.key}
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                background: s.color,
                                transition: 'width 0.4s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: pct > 8 ? '50px' : '6px',
                                position: 'relative'
                              }}
                              title={`${s.label}: ${formatMs(ms)} (${Math.round(pct)}%)`}
                            >
                              {pct > 12 && (
                                <span style={{ color: '#000', fontSize: '0.62rem', fontWeight: 950, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {s.label} ({Math.round(pct)}%)
                                </span>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>

                  {/* Timeline breakdown legend */}
                  {totalDurationMs > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 20px', fontSize: '0.72rem', color: 'var(--text-muted, #a1a1aa)', padding: '10px 12px', background: 'var(--card-bg, #18181b)', borderRadius: '12px', border: '1px solid var(--glass-border, rgba(0,0,0,0.1))', marginBottom: '16px' }}>
                      {stagesConfig.map(s => {
                        const ms = stageDurations[s.key] || 0
                        if (ms <= 0) return null
                        const pct = Math.round((ms / totalDurationMs) * 100)
                        return (
                          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: s.color }} />
                            <span>{s.label}: <strong style={{ color: 'var(--text, #f4f4f5)' }}>{formatMs(ms)}</strong> ({pct}%)</span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Bottleneck analysis note */}
                  {totalDurationMs > 0 && bottleneckStage && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px 14px', borderRadius: '12px', marginBottom: '16px' }}>
                      <span style={{ fontSize: '0.95rem' }}>⚠️</span>
                      <div style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 700 }}>
                        Вузьке місце наряду: деталь пролежала/провела найдовше на етапі <strong style={{ textTransform: 'uppercase', textDecoration: 'underline', color: 'var(--text, #f4f4f5)' }}>{bottleneckStage.label}</strong> — <strong style={{ color: 'var(--text, #f4f4f5)' }}>{formatMs(maxMs)}</strong> ({bottleneckPct}% від усього часу виробництва).
                      </div>
                    </div>
                  )}

                  {/* Detailed individual cards tracking (collapsible) */}
                  <div style={{ borderTop: '1px dashed var(--glass-border, rgba(0,0,0,0.15))', paddingTop: '14px', marginTop: '10px' }}>
                    {(() => {
                      const isExpanded = !!expandedCardsState[part.id]
                      return (
                        <>
                          <button
                            onClick={() => setExpandedCardsState(prev => ({ ...prev, [part.id]: !prev[part.id] }))}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-muted, #a1a1aa)',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 0',
                              transition: 'color 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = '#ff9000'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted, #a1a1aa)'}
                          >
                            <span>{isExpanded ? '📂' : '📁'}</span>
                            {isExpanded ? 'Сховати список карток' : 'Показати список карток'} ({partCards.length})
                            <span style={{ fontSize: '0.62rem', marginLeft: '2px', color: '#ff9000' }}>{isExpanded ? '▲' : '▼'}</span>
                          </button>

                          {isExpanded && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px', paddingLeft: '6px' }}>
                              {partCards.map(c => {
                                const historyRows = cardHistory.filter(h => h.card_id === c.id)
                                const cDuration = historyRows.reduce((sum, h) => {
                                  if (h.started_at && h.completed_at) {
                                    const diff = new Date(h.completed_at) - new Date(h.started_at)
                                    return sum + (diff > 0 ? diff : 0)
                                  }
                                  return sum
                                }, 0)

                                const cPct = c.status === 'completed' ? '🟢 ЗАВЕРШЕНО'
                                  : c.status === 'at-buffer' ? '🔵 В БУФЕРІ'
                                    : c.status === 'in-progress' ? '🟡 В РОБОТІ'
                                      : '⚪ ОЧІКУЄ'

                                const currentOp = c.operation || 'Створення'

                                return (
                                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg, #18181b)', border: '1px solid var(--glass-border, rgba(0,0,0,0.1))', padding: '10px 14px', borderRadius: '10px', fontSize: '0.74rem' }}>
                                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                      <strong style={{ color: '#ff9000', fontFamily: 'monospace' }}>#{c.id.slice(-8).toUpperCase()}</strong>
                                      <span style={{ color: 'var(--text-muted, #888)' }}>К-сть: <strong>{c.quantity || 0} шт</strong></span>
                                      <span style={{ color: 'var(--glass-border, rgba(0,0,0,0.15))' }}>|</span>
                                      <span style={{ color: 'var(--text, #f4f4f5)' }}>Етап: <strong>{currentOp}</strong></span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: c.status === 'completed' ? '#10b981' : (c.status === 'in-progress' ? '#f59e0b' : '#3b82f6') }}>{cPct}</span>
                                      <span style={{ color: 'var(--text-muted, #888)', fontSize: '0.68rem' }}>Час карти: <strong style={{ color: 'var(--text, #f4f4f5)' }}>{formatMs(cDuration)}</strong></span>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Link to Foreman */}
      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
        <Link
          to={`/foreman?task=${task.id}`}
          style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444',
            padding: '10px 20px', borderRadius: '12px', textDecoration: 'none', fontWeight: 900,
            fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
        >
          Відкрити в Foreman →
        </Link>
      </div>
    </div>
  )
}

export default OrderDetailView
