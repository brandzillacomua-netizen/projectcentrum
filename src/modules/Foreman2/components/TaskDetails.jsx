import React, { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Clipboard, Copy, Factory, Layers, PackageCheck, Printer, Wrench, Clock } from 'lucide-react'
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

const getLoadProgress = (part, rowCapacityOverride) => {
  const { defaultCapacity, maxCapacity } = capacityRangeByMachine(part.machine)
  const unitsPerSheet = Math.max(1, Number(part.unitsPerSheet) || 1)
  const baseCards = getBaseProductionCards(part)
  
  const rawCapacity = rowCapacityOverride !== undefined && rowCapacityOverride !== '' ? rowCapacityOverride : defaultCapacity
  const machineCapacity = Math.min(maxCapacity, Math.max(defaultCapacity, rawCapacity))

  let generatedSheetsCalc = 0
  baseCards.forEach(c => {
    const explicitSheets = Number(c?.actual_sheets || c?.actualSheets || c?.sheets)
    if (explicitSheets > 0) {
      generatedSheetsCalc += explicitSheets
    } else {
      const cardScrap = Number(c?.scrap_qty || 0) // if available directly
      generatedSheetsCalc += Math.ceil(((Number(c.quantity) || 0) + cardScrap) / unitsPerSheet)
    }
  })

  const plannedSheets = Number(part.plannedSheets) || 0
  
  // If there is no overall shortage for the part, then we don't expect any more base loads
  // We can just clamp remainingSheetsCalc to 0 in that case.
  const hasShortage = (part.shortage || 0) > 0
  const remainingSheetsCalc = hasShortage ? Math.max(0, plannedSheets - generatedSheetsCalc) : 0

  const baseLoads = part.machine ? (baseCards.length + Math.ceil(remainingSheetsCalc / machineCapacity)) : (plannedSheets || 0)
  const expectedLoads = (part.plan === 0 && (part.cards || []).some(c => c.operation === 'Склад БЗ')) ? 1 : baseLoads

  return {
    loaded: baseCards.length,
    expectedLoads,
    generatedSheets: generatedSheetsCalc,
    remainingSheets: remainingSheetsCalc,
    loadCapacity: machineCapacity
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

const WorkCardTile = ({ card, onClick }) => {
  const status = getCardStatus(card)
  const isRedo = card?.is_rework || String(card?.card_info || '').includes('[REDO]')
  const cardCode = String(card?.id || '').slice(-8).toUpperCase()

  return (
    <article className="foreman2-card-tile" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
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

const WorkCardsArchive = ({ parts, task, expandedId, onToggle, onOpenReissue, onMachineChange, onPrintCards }) => {
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
                      {part.cards.map(card => (
                        <WorkCardTile 
                          key={card.id} 
                          card={card} 
                          onClick={() => {
                            if (onPrintCards) {
                              onPrintCards(part, [{
                                id: card.id,
                                loading: card.card_info,
                                qty: card.quantity,
                                machine: card.machine || part.machine,
                                totalLoadings: '—',
                                sheetsPerLoading: part.defaultCapacity || 1,
                                estimatedTime: (Number(part.nom?.time_per_unit) || 0) * (Number(card.quantity) || 0) * 60
                              }])
                            }
                          }}
                        />
                      ))}
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

export default function TaskDetails({ model, nomenclatures = [], allCards, onOpenReissue, onCompleteTask, onOpenReport, onMachineChange, onMaterialCorrection, onGenerateCards, onPrintCards, adminCardsPanel }) {
  const [expandedPartId, setExpandedPartId] = useState(null)
  const [expandedArchivePartId, setExpandedArchivePartId] = useState(null)
  const [isCompletingTask, setIsCompletingTask] = useState(false)
  const [rowCapacities, setRowCapacities] = useState({})

  if (!model) {
    return (
      <main style={{ padding: '25px 15px', color: '#555', fontWeight: 850 }}>
        Оберіть наряд зліва
      </main>
    )
  }

  const { task, order, summary, scrapSummary, parts } = model
  
  const isReady = summary.isReady
  const isShortage = summary.hasShortage
  const isNew = summary.totalCards === 0 && task.status !== 'completed'
  const isInProgress = summary.totalCards > 0 && task.status !== 'completed' && !isReady && !isShortage
  const isReworkOrder = task.is_rework || task.order_type === 'переробка'
  
  const copyTaskLink = async () => {
    if (!navigator?.clipboard) return
    const url = new URL(window.location.href)
    url.searchParams.set('task', model.id)
    await navigator.clipboard.writeText(url.toString())
    alert('Посилання скопійовано!')
  }

  const prodId = order?.nomenclature_id || order?.order_items?.[0]?.nomenclature_id
  const prod = nomenclatures?.find(n => String(n.id) === String(prodId))
  const productNames = prod ? prod.name : (order?.product_name || order?.nomenclature?.name || task.step || '—')

  return (
    <main style={{ padding: '22px 15px', overflowY: 'auto', position: 'relative' }}>
      <section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '2.4rem', fontWeight: 950, margin: 0, display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
              Наряд №{order?.order_num || model.title}{task.batch_index ? `/${task.batch_index}` : ''}
              {task.status === 'completed' && (
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#10b981', padding: '5px 15px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 950, letterSpacing: '1px' }}>
                  ВИКОНАНО
                </div>
              )}
              {isReady && task.status !== 'completed' && (
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#10b981', padding: '5px 15px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 950, letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <CheckCircle2 size={14} /> ГОТОВО ДО ЗАКРИТТЯ
                </div>
              )}
              {isShortage && task.status !== 'completed' && !isReady && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '5px 15px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 950, letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <AlertTriangle size={14} /> ПОТРІБЕН ДОВИПУСК
                </div>
              )}
              {isNew && task.status !== 'completed' && (
                <div className="anim-pulse-blue" style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', color: '#3b82f6', padding: '5px 15px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 950, letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Clock size={14} /> НОВИЙ
                </div>
              )}
              {isInProgress && task.status !== 'completed' && !isReady && !isShortage && (
                <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid #eab308', color: '#eab308', padding: '5px 15px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 950, letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Layers size={14} /> В РОБОТІ
                </div>
              )}
              <button
                type="button"
                onClick={copyTaskLink}
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  padding: '6px 15px',
                  borderRadius: '12px',
                  fontSize: '0.8rem',
                  fontWeight: 950,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                Копіювати посилання
              </button>
            </h2>

            <button
              onClick={() => onOpenReport && onOpenReport(task, order)}
              style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid #3b82f6',
                color: '#3b82f6',
                fontSize: '0.8rem',
                fontWeight: 900,
                padding: '8px 18px',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: '0.2s',
                boxShadow: '0 4px 15px rgba(59, 130, 246, 0.1)',
                marginTop: '5px'
              }}
            >
              <Printer size={14} /> ЗВІТ ПО НАРЯДУ
            </button>
          </div>
          <div style={{ color: '#555', marginTop: '5px', fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
            <div>ВИРІБ: <strong style={{ color: '#ef4444' }}>{productNames || '—'}</strong> | {order?.customer || order?.product_name || 'Цех №1'}</div>
            {task.batch_index && (
              <span style={{ background: '#eab308', color: '#000', padding: '2px 8px', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 900 }}>
                ПАРТІЯ №{task.batch_index}
              </span>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#555' }}>ВЕРСТАТ:</span>
              <span style={{ background: '#222', borderRadius: '6px', padding: '4px 8px', color: '#fff', fontWeight: 950, fontSize: '0.8rem' }}>{task.machine_name || 'Не вказано'}</span>
            </div>
          </div>
        </div>

        {(isReady || task.status === 'completed') && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {task.status !== 'completed' && (
              <button
                onClick={async () => {
                  setIsCompletingTask(true)
                  try {
                    await onCompleteTask(task.id)
                  } finally {
                    setIsCompletingTask(false)
                  }
                }}
                disabled={isCompletingTask}
                style={{
                  background: isCompletingTask ? '#222' : '#10b981',
                  color: isCompletingTask ? '#555' : '#fff',
                  border: 'none',
                  padding: '12px 28px',
                  borderRadius: '12px',
                  fontWeight: 900,
                  cursor: isCompletingTask ? 'not-allowed' : 'pointer',
                  boxShadow: isCompletingTask ? 'none' : '0 10px 20px -5px rgba(16, 185, 129, 0.4)',
                  transition: '0.3s',
                  fontSize: '0.95rem',
                  letterSpacing: '0.5px',
                  opacity: isCompletingTask ? 0.6 : 1
                }}
              >
                {isCompletingTask ? 'ОБРОБКА...' : '✓ ВИКОНАНО'}
              </button>
            )}
            {task.status === 'completed' && (
              <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', color: '#10b981', padding: '10px 20px', borderRadius: '12px', fontWeight: 900, fontSize: '0.85rem', letterSpacing: '0.5px' }}>
                ✓ НАРЯД ВИКОНАНО
              </div>
            )}
          </div>
        )}
      </section>


      <section style={{ marginBottom: '40px', background: '#111', borderRadius: '20px', overflow: 'hidden', border: '1px solid #222' }}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="foreman2-work-table" style={{ width: '100%', minWidth: '1040px', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#1a1a1a', textAlign: 'left', color: '#555', textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: 900 }}>
                <th style={{ padding: '12px 10px', width: '23%', minWidth: '170px' }}>ДЕТАЛЬ В РОЗКРІЙ</th>
                <th style={{ padding: '12px 6px', textAlign: 'center' }}>ПОТРЕБА</th>
                {!isReworkOrder && (
                  <>
                    <th style={{ padding: '12px 6px', textAlign: 'center' }}>СКЛАД БЗ</th>
                    <th style={{ padding: '12px 6px', textAlign: 'center', color: '#eab308' }}>ПЛАН</th>
                  </>
                )}
                <th style={{ padding: '12px 6px', textAlign: 'center' }}>МАТЕРІАЛ</th>
                <th style={{ padding: '12px 6px', textAlign: 'center' }}>ШТ/Л</th>
                <th style={{ padding: '12px 6px', textAlign: 'center', color: '#10b981' }}>ЛИСТІВ</th>
                <th style={{ padding: '12px 10px', width: '12%' }}>ВЕРСТАТ</th>
                <th style={{ padding: '12px 6px', textAlign: 'center', color: '#3b82f6', width: '8%' }}>ЗАВАНТ.</th>
                {!isReworkOrder && <th style={{ padding: '12px 6px', textAlign: 'center', color: '#ef4444' }}>БЗ</th>}
                <th style={{ padding: '12px 6px', textAlign: 'center' }}>ДІЇ</th>
              </tr>
            </thead>
            <tbody>
              {parts.map(part => {
                const expanded = expandedPartId === part.nomId
                const load = getLoadProgress(part, rowCapacities[part.nomId])
                const redoCards = getRedoProductionCards(part)
                const surplus = part.plannedSheets > 0 ? Math.max(0, (part.plannedSheets * part.unitsPerSheet) - part.plan) : 0
                const isWaitingMaterials = part.cards.some(card => card.status === 'waiting-materials')
                const capacities = capacityRangeByMachine(part.machine)
                part.defaultCapacity = capacities.defaultCapacity
                part.maxCapacity = capacities.maxCapacity

                return (
                  <React.Fragment key={part.nomId}>
                    <tr onClick={() => setExpandedPartId(expanded ? null : part.nomId)} style={{ borderBottom: expanded ? 'none' : '1px solid #1a1a1a', cursor: 'pointer' }}>
                      <td style={{ padding: '10px 8px', minWidth: '170px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 900, color: '#fff', wordBreak: 'break-word', whiteSpace: 'normal' }}>
                          {expanded ? <ChevronDown size={15} color="#666" /> : <ChevronRight size={15} color="#666" />}
                          {part.name || 'Невідома деталь'}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#444', marginLeft: '22px' }}>{part.code || 'БЕЗ КОДУ'}</div>
                      </td>
                      <td style={{ padding: '10px 4px', textAlign: 'center', color: '#666', fontWeight: 850 }}>{formatQty(part.need)}</td>
                      {!isReworkOrder && (
                        <>
                          <td style={{ padding: '10px 4px', textAlign: 'center', color: '#666', fontWeight: 850 }}>{formatQty(part.stockBZ)}</td>
                          <td style={{ padding: '10px 4px', textAlign: 'center', color: '#eab308', fontWeight: 950 }}>{formatQty(part.plan)}</td>
                        </>
                      )}
                      <td style={{ padding: '10px 6px', textAlign: 'center', color: '#aaa', fontSize: '0.75rem', fontWeight: 800 }}>
                        <div>{part.material || '-'}</div>
                        {onMaterialCorrection && part.plan > 0 && (
                          <button
                            type="button"
                            onClick={event => {
                              event.stopPropagation()
                              onMaterialCorrection(part)
                            }}
                            style={{ marginTop: '5px', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.35)', color: '#f59e0b', padding: '4px 7px', borderRadius: '6px', fontSize: '.58rem', fontWeight: 950, cursor: 'pointer', textTransform: 'uppercase' }}
                            title="Виправити помилково вибраний матеріал без видалення наряду"
                          >
                            ✎ Виправити
                          </button>
                        )}
                      </td>
                      <td style={{ padding: '10px 4px', textAlign: 'center', color: '#ddd', fontWeight: 900 }}>{formatQty(part.unitsPerSheet)}</td>
                      <td style={{ padding: '10px 4px', textAlign: 'center', color: '#10b981', fontWeight: 1000, fontSize: '1.1rem' }}>{formatQty(part.plannedSheets)}</td>
                      <td style={{ padding: '10px 4px' }}>
                        {!part.isSplitMode ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', minWidth: '220px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
                              <div className={`machine-badge ${part.machine ? 'assigned' : 'unassigned'}`} style={{ background: part.machine ? '#050505' : '#1f1f1f', border: part.machine ? '1px solid #333' : '1px dashed #444', color: '#fff', borderRadius: '8px', padding: '7px 9px', textAlign: 'center', fontSize: '0.68rem', fontWeight: 950, lineHeight: 1.2 }}>
                                {part.machine || 'Оберіть верстат'}
                              </div>
                              {part.plan > 0 && (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    if (onMachineChange) onMachineChange(part)
                                  }}
                                  style={{ background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.3)', color: '#3b82f6', padding: '6px 10px', borderRadius: '8px', fontSize: '0.68rem', fontWeight: 950, cursor: 'pointer', textTransform: 'uppercase', transition: 'all 0.2s' }}
                                  title="Змінити верстат"
                                >
                                  ⚙️ Змінити верстат
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} onClick={e => e.stopPropagation()}>
                            {(part.splits || []).map((s, sIdx) => {
                              const cap = capacityRangeByMachine(s.machine).maxCapacity || 1
                              const sh = Number(s.sheets) || Math.ceil((Number(s.qty) || 0) / (part.unitsPerSheet || 1))
                              const l = Math.ceil(sh / cap)

                              return (
                                <div key={sIdx} className="split-machine-item" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#111', padding: '6px 8px', borderRadius: '8px', border: '1px solid #333' }}>
                                  <input
                                    type="number"
                                    defaultValue={s.sheets}
                                    placeholder="Л."
                                    style={{ width: '40px', background: '#000', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '4px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 800 }}
                                  />
                                  <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#aaa', flex: 1 }}>{s.machine}</div>
                                  <div style={{ fontSize: '0.65rem', color: '#444', fontWeight: 900 }}>{l} завант.</div>
                                </div>
                              )
                            })}
                            <button
                              type="button"
                              style={{ background: 'rgba(59,130,246,.1)', border: '1px dashed rgba(59,130,246,.4)', color: '#3b82f6', padding: '4px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 900, cursor: 'pointer', textTransform: 'uppercase' }}
                            >
                              + Розділити ще
                            </button>
                          </div>
                        )}
                      </td>
                      <td style={{ borderBottom: '1px solid #1a1a1a' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {part.plan > 0 && part.machine && capacityRangeByMachine(part.machine).defaultCapacity !== capacityRangeByMachine(part.machine).maxCapacity && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                              <label style={{ fontSize: '0.6rem', color: '#666', fontWeight: 900, textTransform: 'uppercase' }}>Листів</label>
                              <input
                                type="number"
                                placeholder="Завант."
                                value={rowCapacities[part.nomId] !== undefined ? rowCapacities[part.nomId] : ''}
                                min={capacityRangeByMachine(part.machine).defaultCapacity}
                                max={capacityRangeByMachine(part.machine).maxCapacity}
                                readOnly={getBaseProductionCards(part).length > 0 && getBaseProductionCards(part).length >= load.expectedLoads}
                                onChange={(e) => {
                                  const v = parseInt(e.target.value)
                                  setRowCapacities(p => ({ ...p, [part.nomId]: isNaN(v) ? '' : v }))
                                }}
                                onBlur={(e) => {
                                  let v = parseInt(e.target.value)
                                  if (isNaN(v)) {
                                    setRowCapacities(p => ({ ...p, [part.nomId]: '' }))
                                    return
                                  }
                                  const { defaultCapacity, maxCapacity } = capacityRangeByMachine(part.machine)
                                  v = Math.min(maxCapacity, Math.max(defaultCapacity, v))
                                  setRowCapacities(p => ({ ...p, [part.nomId]: v }))
                                }}
                                style={{ width: '38px', height: '24px', background: '#111', border: '1px solid #333', color: '#fff', fontSize: '0.75rem', fontWeight: 950, textAlign: 'center', borderRadius: '5px' }}
                              />
                            </div>
                          )}
                          <div style={{ padding: '10px 4px', textAlign: 'center', color: '#3b82f6', fontWeight: 1000, fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ color: load.loaded < load.expectedLoads ? '#444' : '#3b82f6' }}>{load.loaded}</span>
                            <span style={{ color: '#222', margin: '0 5px' }}>/</span>
                            <span>{load.expectedLoads}</span>
                            {redoCards.length > 0 && (
                              <span style={{ fontSize: '0.75rem', color: '#ef4444', marginLeft: '5px', fontWeight: 900 }}>+{redoCards.length}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      {!isReworkOrder && (
                        <td style={{ padding: '10px 6px', textAlign: 'center', color: '#ef4444', fontWeight: 950 }}>
                          {surplus > 0 ? `+${surplus}` : '0'}
                        </td>
                      )}
                      <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                          {part.plan === 0 ? (
                            (part.stock > 0 && part.cards.find(c => c.operation === 'Склад БЗ')) ? (
                              <div style={{ background: '#3b82f620', border: '1px solid #3b82f640', color: '#3b82f6', padding: '8px 12px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: 950, textTransform: 'uppercase' }}>
                                ЗАБРОНЬОВАНО ({Math.min(part.need || 0, part.stock)})
                              </div>
                            ) : (
                              <div style={{ color: '#222', fontSize: '0.6rem', fontWeight: 900 }}>НЕ ПОТРЕБУЄ ДІЇ</div>
                            )
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                              {part.stock > 0 && (
                                <div style={{ background: '#3b82f622', border: '1px solid #3b82f644', color: '#3b82f6', padding: '6px 10px', borderRadius: '8px', fontSize: '0.6rem', fontWeight: 950, textAlign: 'center' }}>
                                  ЗАБРОНЬОВАНО: {Math.min(part.need || 0, part.stock)} шт
                                </div>
                              )}
                              {(load.loaded === 0 || load.loaded < load.expectedLoads) && (
                                <button
                                  type="button"
                                  disabled={!(part.machine || part.isSplitMode) || (part.machine && capacityRangeByMachine(part.machine).defaultCapacity !== capacityRangeByMachine(part.machine).maxCapacity && !rowCapacities[part.nomId])}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    if (part.machine && capacityRangeByMachine(part.machine).defaultCapacity !== capacityRangeByMachine(part.machine).maxCapacity && !rowCapacities[part.nomId]) {
                                      alert(`Вкажіть кількість листів на одне завантаження (${capacityRangeByMachine(part.machine).defaultCapacity}-${capacityRangeByMachine(part.machine).maxCapacity} л.) перед генерацією карток.`)
                                      return
                                    }
                                    if (onGenerateCards) onGenerateCards(part, load.expectedLoads - load.loaded, rowCapacities[part.nomId], load.remainingSheets)
                                  }}
                                  style={{
                                    background: (part.machine && capacityRangeByMachine(part.machine).defaultCapacity !== capacityRangeByMachine(part.machine).maxCapacity && !rowCapacities[part.nomId]) ? '#222' : (part.machine || part.isSplitMode ? '#ff9000' : '#222'),
                                    color: (part.machine && capacityRangeByMachine(part.machine).defaultCapacity !== capacityRangeByMachine(part.machine).maxCapacity && !rowCapacities[part.nomId]) ? '#666' : (part.machine || part.isSplitMode ? '#000' : '#444'),
                                    border: (part.machine && capacityRangeByMachine(part.machine).defaultCapacity !== capacityRangeByMachine(part.machine).maxCapacity && !rowCapacities[part.nomId]) ? '1px solid #333' : 'none',
                                    padding: '8px 15px',
                                    borderRadius: '8px',
                                    fontSize: '0.65rem',
                                    fontWeight: 900,
                                    cursor: (part.machine && capacityRangeByMachine(part.machine).defaultCapacity !== capacityRangeByMachine(part.machine).maxCapacity && !rowCapacities[part.nomId]) ? 'not-allowed' : (part.machine || part.isSplitMode ? 'pointer' : 'not-allowed'),
                                    textTransform: 'uppercase',
                                    opacity: 1
                                  }}
                                >
                                  {(part.machine && capacityRangeByMachine(part.machine).defaultCapacity !== capacityRangeByMachine(part.machine).maxCapacity && !rowCapacities[part.nomId]) ? 'ВКАЖІТЬ ЛИСТИ' : 'Генерувати'}
                                </button>
                              )}
                            </div>
                          )}
                          {part.cards.length > 0 && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                if (onPrintCards) {
                                  onPrintCards(part, part.cards.map(c => ({
                                    id: c.id,
                                    loading: c.card_info,
                                    qty: c.quantity,
                                    machine: c.machine,
                                    totalLoadings: load.expectedLoads,
                                    sheetsPerLoading: part.defaultCapacity || 1,
                                    estimatedTime: (Number(part.nom?.time_per_unit) || 0) * (Number(c.quantity) || 0) * 60
                                  })))
                                }
                              }}
                              style={{ background: '#10b981', color: '#fff', border: 'none', padding: '8px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Printer size={16} />
                            </button>
                          )}
                        </div>
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
                              {part.cards.map(card => (
                                <WorkCardTile 
                                  key={card.id} 
                                  card={card} 
                                  onClick={() => {
                                    if (onPrintCards) {
                                      onPrintCards(part, [{
                                        id: card.id,
                                        loading: card.card_info,
                                        qty: card.quantity,
                                        machine: card.machine || part.machine,
                                        totalLoadings: '—',
                                         sheetsPerLoading: part.defaultCapacity || 1,
                                        estimatedTime: (Number(part.nom?.time_per_unit) || 0) * (Number(card.quantity) || 0) * 60
                                      }])
                                    }
                                  }}
                                />
                              ))}
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
        onPrintCards={onPrintCards}
      />
      {adminCardsPanel}
    </main>
  )
}
