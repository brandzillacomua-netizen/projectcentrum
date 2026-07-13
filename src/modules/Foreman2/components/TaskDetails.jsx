import React, { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Clipboard, Copy, Factory, Layers, PackageCheck, Printer, Wrench } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { formatQty } from '../utils/normalize.js'

const panelStyle = {
  background: '#111',
  border: '1px solid #222',
  borderRadius: '8px',
  padding: '12px 14px'
}

const getTaskBadge = (summary, task) => {
  if (task.status === 'completed') return { label: 'Виконано', color: '#10b981', text: '#fff', icon: <CheckCircle2 size={13} /> }
  if (summary.hasShortage) return { label: 'Потрібен довипуск', color: '#ef4444', text: '#fff', icon: <AlertTriangle size={13} /> }
  if (summary.isReady) return { label: 'Готово', color: '#10b981', text: '#fff', icon: <PackageCheck size={13} /> }
  if (summary.totalCards === 0) return { label: 'Новий', color: '#3b82f6', text: '#fff', icon: <Clipboard size={13} /> }
  return { label: 'В роботі', color: '#eab308', text: '#111', icon: <Layers size={13} /> }
}

const getCardStatus = (card) => {
  const status = String(card?.status || '')
  if (status === 'completed') return { label: 'Готово', color: '#10b981' }
  if (status === 'at-shop2-buffer' || status === 'waiting-buffer' || status === 'at-buffer') return { label: 'Буфер', color: '#10b981' }
  if (status === 'waiting-materials') return { label: 'Очікує склад', color: '#f59e0b' }
  if (status === 'in-progress') return { label: 'В роботі', color: '#3b82f6' }
  if (status === 'paused') return { label: 'Пауза', color: '#a855f7' }
  if (status === 'scrapped') return { label: 'Брак', color: '#ef4444' }
  return { label: status || 'Очікує', color: '#777' }
}

const capacityByMachine = (machineName) => {
  const text = String(machineName || '').toLowerCase()
  if (text.includes('1200') || text.includes('12x8') || text.includes('мал')) return 4
  if (text.includes('3050') || text.includes('16x16')) return 12
  if (text.includes('3060') || text.includes('30x16')) return 36
  if (text.includes('6000') || text.includes('60x20')) return 96
  if (text.includes('ke xin')) return 16
  return 1
}

const capacityRangeByMachine = (machineName) => {
  const maxCapacity = Math.max(1, capacityByMachine(machineName))
  const text = String(machineName || '').toLowerCase()
  const isVariableSmallMachine = text.includes('1200') || text.includes('12x8') || text.includes('РјР°Р»')
  return {
    defaultCapacity: isVariableSmallMachine ? 1 : maxCapacity,
    maxCapacity
  }
}

const signedQty = (value) => {
  const qty = Number(value) || 0
  if (qty > 0) return `+${formatQty(qty)}`
  if (qty < 0) return `-${formatQty(Math.abs(qty))}`
  return '0'
}

const getBaseProductionCards = (part) => {
  return (part.productionCards || []).filter(card => !(card?.is_rework || String(card?.card_info || '').includes('[REDO]')))
}

const getRedoProductionCards = (part) => {
  return (part.productionCards || []).filter(card => card?.is_rework || String(card?.card_info || '').includes('[REDO]'))
}

const getLoadProgress = (part) => {
  const { defaultCapacity, maxCapacity } = capacityRangeByMachine(part.machine)
  const unitsPerSheet = Math.max(1, Number(part.unitsPerSheet) || 1)
  const baseCards = getBaseProductionCards(part)
  const generatedSheets = baseCards.reduce((sum, card) => {
    const explicitSheets = Number(card?.actual_sheets || card?.actualSheets || card?.sheets)
    if (explicitSheets > 0) return sum + explicitSheets
    return sum + Math.ceil((Number(card?.quantity) || 0) / unitsPerSheet)
  }, 0)
  const plannedSheets = Number(part.plannedSheets) || 0
  const remainingSheets = Math.max(0, plannedSheets - generatedSheets)
  const minimumLoadsAtMaxCapacity = maxCapacity > 0 ? Math.ceil(plannedSheets / maxCapacity) : 0
  const inferredLoadCapacity = baseCards.length >= minimumLoadsAtMaxCapacity && baseCards.length > 0
    ? Math.min(maxCapacity, Math.max(defaultCapacity, Math.ceil(plannedSheets / baseCards.length)))
    : null
  const loadCapacity = inferredLoadCapacity || maxCapacity || defaultCapacity || 1
  const theoreticalMax = loadCapacity > 0 ? Math.ceil(plannedSheets / loadCapacity) : 0
  let expectedLoads = baseCards.length + (remainingSheets > 0 ? Math.ceil(remainingSheets / loadCapacity) : 0)
  if (baseCards.length === theoreticalMax) {
    expectedLoads = theoreticalMax
  }

  return {
    loaded: baseCards.length,
    expectedLoads,
    generatedSheets,
    remainingSheets: expectedLoads > baseCards.length ? remainingSheets : 0,
    loadCapacity
  }
}

const SummaryCell = ({ label, value, color = '#fff' }) => (
  <div style={panelStyle}>
    <div style={{ color: '#555', fontSize: '0.64rem', fontWeight: 950, textTransform: 'uppercase', marginBottom: '5px' }}>{label}</div>
    <div style={{ fontSize: '1.28rem', lineHeight: 1, fontWeight: 950, color }}>{value}</div>
  </div>
)

const ScrapMap = ({ title, map, accent }) => {
  const entries = useMemo(() => Object.entries(map || {}).sort((a, b) => b[1] - a[1]).slice(0, 6), [map])

  return (
    <div style={panelStyle}>
      <div style={{ color: '#555', fontSize: '0.64rem', fontWeight: 950, textTransform: 'uppercase', marginBottom: '8px' }}>{title}</div>
      {entries.length === 0 ? (
        <div style={{ color: '#444', fontSize: '0.78rem', fontWeight: 850 }}>Немає даних</div>
      ) : entries.map(([name, qty]) => (
        <div key={name} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', borderTop: '1px solid #1b1b1b', padding: '7px 0 0', marginTop: '7px', fontSize: '0.76rem' }}>
          <span style={{ color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
          <strong style={{ color: accent, flexShrink: 0 }}>{formatQty(qty)}</strong>
        </div>
      ))}
    </div>
  )
}

const WorkCardTile = ({ card }) => {
  const status = getCardStatus(card)
  const isRedo = card?.is_rework || String(card?.card_info || '').includes('[REDO]')
  const cardCode = String(card?.id || '').slice(-8).toUpperCase()

  return (
    <article className="foreman2-card-tile">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: '#fff', fontSize: '0.82rem', fontWeight: 950, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Картка {cardCode || 'без номера'}
          </div>
          <div style={{ color: '#555', fontSize: '0.66rem', fontWeight: 850, marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {card?.operation || 'Розкрій'} · {card?.machine || 'Верстат не вказано'}
          </div>
        </div>
        <div style={{ background: '#fff', padding: '5px', borderRadius: '8px', flexShrink: 0 }}>
          <QRCodeSVG value={`CENTRUM_CARD_${card?.id}`} size={45} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '11px' }}>
        <span style={{ color: '#fff', background: status.color, borderRadius: '6px', padding: '4px 8px', fontSize: '0.6rem', fontWeight: 950, textTransform: 'uppercase' }}>
          {status.label}
        </span>
        {isRedo && (
          <span style={{ color: '#fff', background: '#ef4444', borderRadius: '6px', padding: '4px 8px', fontSize: '0.6rem', fontWeight: 950, textTransform: 'uppercase' }}>
            Довипуск
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px' }}>
        <div>
          <div style={{ color: '#555', fontSize: '0.6rem', fontWeight: 950, textTransform: 'uppercase' }}>Кількість</div>
          <div style={{ color: '#fff', fontSize: '1rem', fontWeight: 950 }}>{formatQty(card?.quantity)}</div>
        </div>
        <div>
          <div style={{ color: '#555', fontSize: '0.6rem', fontWeight: 950, textTransform: 'uppercase' }}>Листів</div>
          <div style={{ color: '#fff', fontSize: '1rem', fontWeight: 950 }}>{formatQty(card?.actual_sheets || card?.sheets || 0)}</div>
        </div>
      </div>

      {card?.card_info && (
        <div style={{ marginTop: '10px', color: '#666', fontSize: '0.66rem', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {card.card_info}
        </div>
      )}
    </article>
  )
}

const WorkCardsArchive = ({ parts, task, expandedId, onToggle, onOpenReissue }) => {
  return (
    <section style={{ marginTop: '26px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <div style={{ width: '4px', height: '24px', background: '#ff4d4d' }} />
        <h3 style={{ margin: 0, color: '#555', fontSize: '1rem', fontWeight: 950, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Архів робочих карток
        </h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {parts.map(part => {
          const expanded = expandedId === part.nomId
          const load = getLoadProgress(part)
          const completedCards = (part.productionCards || []).filter(card => ['completed', 'at-shop2-buffer', 'at-buffer', 'waiting-buffer'].includes(card.status)).length
          const redoCards = getRedoProductionCards(part)
          const waitingMaterials = (part.cards || []).some(card => card.status === 'waiting-materials')
          const bzAfterScrap = part.spareFromSheets - part.scrap
          const hasShortage = part.shortage > 0 && task.status !== 'completed'

          return (
            <div key={part.nomId}>
              <div
                onClick={() => onToggle(expanded ? null : part.nomId)}
                style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', justifyContent: 'space-between', alignItems: 'center', background: '#111', border: '1px solid #222', borderRadius: '12px', padding: '12px 14px', cursor: 'pointer', userSelect: 'none' }}
              >
                <div style={{ minWidth: '280px', flex: '1 1 360px' }}>
                  <div style={{ fontWeight: 950, fontSize: '0.92rem', color: '#fff' }}>{part.name || 'Невідома деталь'}</div>
                  <div style={{ fontSize: '0.66rem', color: '#444', marginTop: '3px', fontWeight: 800 }}>
                    Потреба: <span style={{ color: '#aaa' }}>{formatQty(part.need)}</span> |{' '}
                    Вироблено: <span style={{ color: '#3b82f6' }}>{formatQty(part.produced)}</span> |{' '}
                    БЗ: <span style={{ color: bzAfterScrap > 0 ? '#10b981' : '#aaa' }}>{bzAfterScrap > 0 ? signedQty(bzAfterScrap) : '+0'}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <div style={{ fontSize: '0.68rem', color: '#555', fontWeight: 900, textTransform: 'uppercase' }}>
                    Карток: <span style={{ color: '#fff' }}>{load.loaded}</span>
                    <small style={{ marginLeft: '8px', color: '#333' }}>
                      ({completedCards > 0 && <span style={{ color: '#10b981' }}>Готові: {completedCards}</span>})
                    </small>
                  </div>
                  {load.expectedLoads > load.loaded && (
                    <div style={{ fontSize: '0.68rem', color: '#3b82f6', fontWeight: 950 }}>
                      Завант.: {load.loaded}/{load.expectedLoads}
                    </div>
                  )}
                  {redoCards.length > 0 && (
                    <div style={{ fontSize: '0.68rem', color: '#ff9000', fontWeight: 950 }}>
                      Довипуск: {redoCards.length}
                    </div>
                  )}
                  <div style={{ fontSize: '0.68rem', color: '#555', fontWeight: 900, textTransform: 'uppercase' }}>
                    Прийнято: <span style={{ color: '#3b82f6' }}>{formatQty(part.produced)}</span>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: part.scrap > 0 ? '#ef4444' : '#333', fontWeight: 950, textTransform: 'uppercase' }}>
                    Брак: {formatQty(part.scrap)}
                  </div>
                  {waitingMaterials && (
                    <div style={{ padding: '5px 9px', borderRadius: '7px', background: 'rgba(255,144,0,.1)', border: '1px solid rgba(255,144,0,.35)', color: '#ff9000', fontSize: '0.62rem', fontWeight: 950, textTransform: 'uppercase' }}>
                      Очікує склад
                    </div>
                  )}
                  {hasShortage && (
                    <div onClick={(event) => event.stopPropagation()} style={{ padding: '5px 11px', borderRadius: '8px', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.35)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ color: '#ef4444', fontSize: '0.68rem', fontWeight: 950, textTransform: 'uppercase' }}>Нестача: {formatQty(part.shortage)}</div>
                      <button
                        type="button"
                        onClick={() => onOpenReissue(part)}
                        style={{ background: part.activeRedo ? '#991b1b' : '#ef4444', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '7px', fontSize: '0.6rem', fontWeight: 950, cursor: 'pointer', textTransform: 'uppercase' }}
                      >
                        {part.activeRedo ? 'Довипустити ще' : 'Довипуск'}
                      </button>
                    </div>
                  )}
                  <div style={{ color: '#555', display: 'inline-flex', alignItems: 'center' }}>
                    {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                </div>
              </div>

              {expanded && (
                <div style={{ margin: '8px 0 2px 12px', borderLeft: '2px solid #222', paddingLeft: '12px' }}>
                  {part.cards.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '10px' }}>
                      {part.cards.map(card => <WorkCardTile key={card.id} card={card} />)}
                    </div>
                  ) : (
                    <div style={{ background: '#0d0d0d', border: '1px dashed #2a2a2a', borderRadius: '10px', padding: '14px', color: '#555', fontSize: '0.78rem', fontWeight: 850 }}>
                      По цій деталі ще немає робочих карток
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {parts.length === 0 && (
          <div style={{ background: '#111', border: '1px solid #222', borderRadius: '10px', padding: '18px', color: '#555', fontWeight: 850 }}>
            Немає робочих карток для архіву
          </div>
        )}
      </div>
    </section>
  )
}

export default function TaskDetails({ model, onOpenReissue }) {
  const [expandedPartId, setExpandedPartId] = useState(null)
  const [expandedArchivePartId, setExpandedArchivePartId] = useState(null)

  if (!model) {
    return (
      <main style={{ padding: '25px 15px', color: '#555', fontWeight: 850 }}>
        Оберіть наряд зліва
      </main>
    )
  }

  const { task, order, summary, scrapSummary, parts } = model
  const badge = getTaskBadge(summary, task)

  const copyTaskLink = async () => {
    if (!navigator?.clipboard) return
    const url = new URL(window.location.href)
    url.searchParams.set('task', model.id)
    await navigator.clipboard.writeText(url.toString())
  }

  return (
    <main style={{ padding: '22px 15px', overflowY: 'auto', position: 'relative' }}>
      <section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, color: '#fff', fontSize: '1.72rem', lineHeight: 1, fontWeight: 950 }}>
              Наряд №{model.title}
            </h2>
            <span style={{ color: badge.text, background: badge.color, borderRadius: '7px', padding: '7px 10px', fontSize: '0.68rem', fontWeight: 950, display: 'inline-flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase' }}>
              {badge.icon} {badge.label}
            </span>
          </div>
          <div style={{ color: '#777', fontSize: '0.82rem', fontWeight: 850, marginTop: '8px' }}>
            Виріб: <span style={{ color: '#ef4444', fontWeight: 950 }}>{order?.customer || order?.product_name || task.step || 'Цех №1'}</span>
            {task.machine_name && <> <span style={{ color: '#444', margin: '0 10px' }}>|</span> Верстат: <span style={{ color: '#fff', background: '#222', borderRadius: '6px', padding: '4px 8px', fontWeight: 950 }}>{task.machine_name}</span></>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => window.print()}
            style={{ background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.5)', color: '#10b981', borderRadius: '8px', height: '36px', padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 950, textTransform: 'uppercase' }}
          >
            <Printer size={15} /> Друк наряду
          </button>
          <button
            onClick={copyTaskLink}
            style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.45)', color: '#ff6b6b', borderRadius: '8px', height: '36px', padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 950, textTransform: 'uppercase' }}
          >
            <Copy size={15} /> Копіювати посилання
          </button>
        </div>
      </section>

      <section className="foreman2-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '10px', marginBottom: '12px' }}>
        <SummaryCell label="Карток" value={summary.totalCards} />
        <SummaryCell label="Прийнято" value={formatQty(summary.totalProduced)} color="#3b82f6" />
        <SummaryCell label="Брак" value={formatQty(summary.totalScrap)} color={summary.totalScrap > 0 ? '#ef4444' : '#555'} />
        <SummaryCell label="Нестача" value={formatQty(summary.totalShortage)} color={summary.totalShortage > 0 ? '#ef4444' : '#555'} />
      </section>

      <section className="foreman2-scrap-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '18px' }}>
        <ScrapMap title="Брак по деталях" map={scrapSummary.byNom} accent="#ef4444" />
        <ScrapMap title="Брак по етапах" map={scrapSummary.byStage} accent="#ff9000" />
        <ScrapMap title="Брак по операторах" map={scrapSummary.byOperator} accent="#a78bfa" />
      </section>

      <section style={{ marginBottom: '40px', background: '#111', borderRadius: '20px', overflow: 'hidden', border: '1px solid #222' }}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="foreman2-work-table" style={{ width: '100%', minWidth: '1040px', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#1a1a1a', textAlign: 'left', color: '#555', textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: 900 }}>
                <th style={{ padding: '12px 10px', width: '24%', minWidth: '190px' }}>Деталь в розкрій</th>
                <th style={{ padding: '12px 6px', textAlign: 'center' }}>Потреба</th>
                <th style={{ padding: '12px 6px', textAlign: 'center' }}>Склад БЗ</th>
                <th style={{ padding: '12px 6px', textAlign: 'center', color: '#eab308' }}>План</th>
                <th style={{ padding: '12px 6px', textAlign: 'center' }}>Матеріал</th>
                <th style={{ padding: '12px 6px', textAlign: 'center' }}>Шт/л</th>
                <th style={{ padding: '12px 6px', textAlign: 'center', color: '#10b981' }}>Листів</th>
                <th style={{ padding: '12px 10px', width: '16%' }}>Верстат</th>
                <th style={{ padding: '12px 6px', textAlign: 'center', color: '#3b82f6' }}>Завант.</th>
                <th style={{ padding: '12px 6px', textAlign: 'center', color: '#ef4444' }}>БЗ</th>
                <th style={{ padding: '12px 6px', textAlign: 'center' }}>Дії</th>
              </tr>
            </thead>
            <tbody>
              {parts.map(part => {
                const expanded = expandedPartId === part.nomId
                const load = getLoadProgress(part)
                const redoCards = getRedoProductionCards(part)
                const bzAfterScrap = part.spareFromSheets - part.scrap
                const isWaitingMaterials = part.cards.some(card => card.status === 'waiting-materials')

                return (
                  <React.Fragment key={part.nomId}>
                    <tr onClick={() => setExpandedPartId(expanded ? null : part.nomId)} style={{ borderBottom: expanded ? 'none' : '1px solid #1a1a1a', cursor: 'pointer' }}>
                      <td style={{ padding: '10px 8px', minWidth: '190px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 900, color: '#fff', wordBreak: 'break-word', whiteSpace: 'normal' }}>
                          {expanded ? <ChevronDown size={15} color="#666" /> : <ChevronRight size={15} color="#666" />}
                          {part.name || 'Невідома деталь'}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#444', marginLeft: '22px' }}>{part.code || 'БЕЗ КОДУ'}</div>
                      </td>
                      <td style={{ padding: '10px 4px', textAlign: 'center', color: '#666', fontWeight: 850 }}>{formatQty(part.need)}</td>
                      <td style={{ padding: '10px 4px', textAlign: 'center', color: '#666', fontWeight: 850 }}>{formatQty(part.stockBZ)}</td>
                      <td style={{ padding: '10px 4px', textAlign: 'center', color: '#eab308', fontWeight: 950 }}>{formatQty(part.plan)}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'center', color: '#aaa', fontSize: '0.75rem', fontWeight: 800 }}>{part.material || '-'}</td>
                      <td style={{ padding: '10px 4px', textAlign: 'center', color: '#ddd', fontWeight: 900 }}>{formatQty(part.unitsPerSheet)}</td>
                      <td style={{ padding: '10px 4px', textAlign: 'center', color: '#10b981', fontWeight: 1000, fontSize: '1.1rem' }}>{formatQty(part.plannedSheets)}</td>
                      <td style={{ padding: '10px 4px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '180px' }}>
                          <div style={{ background: part.machine ? '#050505' : '#1f1f1f', border: part.machine ? '1px solid #333' : '1px dashed #444', color: '#fff', borderRadius: '8px', padding: '7px 9px', textAlign: 'center', fontSize: '0.68rem', fontWeight: 950, lineHeight: 1.2 }}>
                            {part.machine || 'Оберіть верстат'}
                          </div>
                          <button
                            type="button"
                            onClick={(event) => event.stopPropagation()}
                            style={{ background: 'rgba(59,130,246,.12)', border: '1px solid rgba(59,130,246,.45)', color: '#3b82f6', padding: '6px 10px', borderRadius: '8px', fontSize: '0.68rem', fontWeight: 950, cursor: 'not-allowed', textTransform: 'uppercase', opacity: 0.75 }}
                            title="Механіка зміни верстату винесена окремим підмодулем Foreman2"
                          >
                            Змінити верстат
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                        <span style={{ color: '#3b82f6', fontSize: '1rem', fontWeight: 1000 }}>{load.loaded}</span>
                        <span style={{ color: '#64748b', margin: '0 4px', fontWeight: 900 }}>/</span>
                        <span style={{ color: load.expectedLoads > load.loaded ? '#60a5fa' : '#3b82f6', fontSize: '1rem', fontWeight: 1000 }}>{load.expectedLoads}</span>
                        {load.remainingSheets > 0 && <div style={{ color: '#ef4444', fontSize: '0.62rem', fontWeight: 950, marginTop: '4px' }}>ще {formatQty(load.remainingSheets)} л.</div>}
                        {redoCards.length > 0 && <div style={{ color: '#ef4444', fontSize: '0.65rem', fontWeight: 950, marginTop: '4px' }}>+{redoCards.length} дов.</div>}
                        {isWaitingMaterials && <div style={{ color: '#ff9000', fontSize: '0.62rem', fontWeight: 950, marginTop: '4px' }}>Очікує склад</div>}
                      </td>
                      <td style={{ padding: '10px 6px', textAlign: 'center', color: bzAfterScrap < 0 ? '#ef4444' : '#ef4444', fontWeight: 950 }}>
                        {signedQty(bzAfterScrap)}
                      </td>
                      <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                        {part.shortage > 0 ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              onOpenReissue(part)
                            }}
                            style={{ background: part.activeRedo ? '#991b1b' : '#ef4444', color: '#fff', border: 'none', padding: '7px 10px', borderRadius: '8px', fontSize: '0.62rem', fontWeight: 950, cursor: 'pointer', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <Wrench size={13} /> {part.activeRedo ? 'Довипустити ще' : 'Довипуск'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(event) => event.stopPropagation()}
                            style={{ background: '#10b981', color: '#fff', border: 'none', width: '30px', height: '30px', borderRadius: '9px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'default' }}
                            title="Без нестачі"
                          >
                            <Printer size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={11} style={{ padding: '0 10px 14px', borderBottom: '1px solid #1a1a1a' }}>
                          {part.shortage > 0 && (
                            <div style={{ margin: '0 0 10px 24px', display: 'inline-flex', alignItems: 'center', gap: '10px', color: '#ef4444', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.35)', borderRadius: '8px', padding: '7px 11px', fontSize: '0.72rem', fontWeight: 950, textTransform: 'uppercase' }}>
                              <AlertTriangle size={14} /> Нестача: {formatQty(part.shortage)}
                            </div>
                          )}
                          {part.cards.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '10px', paddingLeft: '24px' }}>
                              {part.cards.map(card => <WorkCardTile key={card.id} card={card} />)}
                            </div>
                          ) : (
                            <div style={{ marginLeft: '24px', background: '#0d0d0d', border: '1px dashed #2a2a2a', borderRadius: '10px', padding: '14px', color: '#555', fontSize: '0.78rem', fontWeight: 850 }}>
                              По цій деталі ще немає робочих карток
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
              {parts.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ padding: '18px', color: '#555', fontWeight: 850, textAlign: 'center' }}>
                    У snapshot наряду немає деталей для розкрою
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <WorkCardsArchive
        parts={parts}
        task={task}
        expandedId={expandedArchivePartId}
        onToggle={setExpandedArchivePartId}
        onOpenReissue={onOpenReissue}
      />
    </main>
  )
}
