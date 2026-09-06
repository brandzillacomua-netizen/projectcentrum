import React from 'react'
import { Search, RotateCcw, Clock } from 'lucide-react'

const getCutterDiameterForReport = (name = '') => {
  const lower = String(name || '').toLowerCase().replace(/,/g, '.')
  const direct = lower.match(/ф\s*([0-9]+(?:\.[0-9]+)?)/)
  if (direct) return parseFloat(direct[1])
  const bySize = lower.match(/(?:кукурудза|двопера|однопера|спіральна|торцева|шарова|радіусна)?\s*([0-9][0-9.]*)(?:\s*[×xх])/)
  return bySize ? parseFloat(bySize[1]) : null
}

const buildPlannedCuttersFromSnapshot = ({ task, snapshot, nomenclatures = [], machineOperations = [], inventory = [] }) => {
  const planSnapshot = snapshot || task?.plan_snapshot || {}
  const selectedCutters = planSnapshot.selectedCutters || {}
  const result = {}

  const resolveDisplayName = genericName => {
    const selectedInvId = selectedCutters[genericName] || selectedCutters[String(genericName || '').toLowerCase()]
    const selectedInv = (inventory || []).find(inv => String(inv.id) === String(selectedInvId))
    const selectedNom = selectedInv ? (nomenclatures || []).find(n => String(n.id) === String(selectedInv.nomenclature_id)) : null
    return selectedNom?.name || selectedInv?.name || genericName || 'Фреза'
  }

  Object.entries(planSnapshot).forEach(([partId, part]) => {
    if (partId.startsWith('_') || ['materialSummary', 'arrivals', 'arrival_doc_id', 'arrival_doc', 'nomenclatures', 'selectedCutters', 'consumables'].includes(partId)) return
    if (!part || typeof part !== 'object') return

    const partNomId = part.id || partId
    const override = part.cutter_override || '2'
    const splits = Array.isArray(part.splits) ? part.splits : []
    const sheetGroups = splits.length > 0
      ? splits.map(split => ({ machine: split.machine || part.selected_machine || task?.machine_name, sheets: Number(split.sheets) || 0 }))
      : [{
          machine: part.selected_machine || task?.machine_name,
          sheets: part.sheets_t300 !== undefined || part.sheets_t700 !== undefined
            ? (Number(part.sheets_t300) || 0) + (Number(part.sheets_t700) || 0)
            : Number(part.sheets) || 0
        }]

    sheetGroups.forEach(group => {
      if (!group.machine || group.sheets <= 0) return
      const opData = (machineOperations || []).find(op => String(op.nomenclature_id) === String(partNomId) && (op.machine_type === group.machine || op.machine_id === group.machine))
      if (!opData?.side2_cut_ops) return

      opData.side2_cut_ops
        .filter(op => op.startsWith('__CUTTER__Reference:') || op.startsWith('__CUTTER__:'))
        .forEach(op => {
          const [, cutterNomId, qtyPerSheetRaw] = op.split(':')
          const qtyPerSheet = parseFloat(qtyPerSheetRaw) || 0
          if (!cutterNomId || qtyPerSheet <= 0) return

          const cutterNom = (nomenclatures || []).find(n => String(n.id) === String(cutterNomId))
          let cutterName = cutterNom?.name?.trim() || ''
          if (!cutterName || cutterName.toLowerCase() === 'фреза') return

          const diameter = getCutterDiameterForReport(cutterName)
          if (override !== '1.5' && diameter && Math.abs(diameter - 1.5) < 0.01) return
          if (override === '1.5' && diameter && Math.abs(diameter - 2) < 0.01) cutterName = 'Фреза ф1.5'

          const displayName = resolveDisplayName(cutterName)
          result[displayName] = (result[displayName] || 0) + Math.ceil(group.sheets * qtyPerSheet)
        })
    })
  })

  return result
}

const statusMeta = (s) => {
  const map = {
    completed: { label: 'Завершено', bg: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' },
    'in-progress': { label: 'В роботі', bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' },
    pending: { label: 'Очікує', bg: 'rgba(234, 179, 8, 0.1)', color: '#eab308' },
    paused: { label: 'На паузі', bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }
  }
  return map[s] || { label: s || '—', bg: 'rgba(255, 255, 255, 0.05)', color: '#888' }
}

const formatDurHMS = (seconds) => {
  if (!seconds || seconds <= 0) return '00:00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export const NariadReportsView = ({
  nariadSearch,
  setNariadSearch,
  nariadCatalogLoading,
  nariadCatalogTotal,
  nariadCatalogPage,
  setNariadCatalogPage,
  filteredTasks,
  allOrdersMap,
  selectedNariadTaskId,
  handleOpenNariadReport,
  nariadReportLoading,
  nariadReportData,
  nariadStageFilter,
  setNariadStageFilter,
  nariadNomFilter,
  setNariadNomFilter,
  nariadSortBy,
  setNariadSortBy,
  setNariadDetailModal,
  nomenclatures,
  inventory,
  machineOperations
}) => {
  const selectedTask = filteredTasks.find(t => t.id === selectedNariadTaskId)
  const selectedOrder = selectedTask ? (selectedTask._catalogOrder || allOrdersMap[selectedTask.order_id]) : null

  return (
    <div className="nariad-reports-view" style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', minHeight: '70vh' }}>
      {/* LEFT PANEL — Task Catalog */}
      <div className="nariad-catalog-panel" style={{
        width: '320px',
        flexShrink: 0,
        borderRadius: '20px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={14} color="#555" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Пошук по номеру наряду або замовнику..."
            value={nariadSearch}
            onChange={e => setNariadSearch(e.target.value)}
            className="nariad-search-input"
            style={{
              width: '100%',
              borderRadius: '12px', padding: '10px 12px 10px 34px',
              fontSize: '0.78rem', fontWeight: 700, boxSizing: 'border-box', outline: 'none'
            }}
          />
        </div>

        {/* Task count */}
        <div className="nariad-catalog-count" style={{ fontSize: '0.65rem', fontWeight: 800, paddingLeft: '4px' }}>
          {nariadCatalogLoading ? 'Завантаження…' : `${nariadCatalogTotal || filteredTasks.length} нарядів`}
        </div>

        {/* Task list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '78vh', paddingRight: '4px' }}>
          {filteredTasks.map(task => {
            const order = task._catalogOrder || allOrdersMap[task.order_id]
            const sm = statusMeta(task.status)
            const isSelected = task.id === selectedNariadTaskId
            const partCount = task.plan_snapshot
              ? Object.keys(task.plan_snapshot).filter(k => !k.startsWith('_') && !['materialSummary','arrivals','arrival_doc_id','arrival_doc','nomenclatures','selectedCutters','consumables'].includes(k)).length
              : Number(task.card_count) || 0
            const createdDate = task.created_at ? new Date(task.created_at).toLocaleDateString('uk-UA', { day:'2-digit', month:'2-digit', year:'2-digit' }) : '—'

            return (
              <div
                key={task.id}
                onClick={() => handleOpenNariadReport(task)}
                className={`nariad-catalog-card ${isSelected ? 'selected' : ''}`}
                style={{
                  borderRadius: '14px',
                  padding: '13px 15px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div className="nariad-card-num" style={{ fontWeight: 900, fontSize: '0.85rem' }}>
                    Наряд №{order?.order_num}
                    {task.batch_index ? `/${task.batch_index}` : ''}
                  </div>
                  <span style={{ background: sm.bg, color: sm.color, fontSize: '0.58rem', fontWeight: 900, padding: '2px 7px', borderRadius: '5px', flexShrink: 0 }}>
                    {sm.label}
                  </span>
                </div>
                <div className="nariad-card-cust" style={{ fontSize: '0.68rem', fontWeight: 700 }}>
                  {order?.customer || 'Замовник не вказано'}
                </div>
                <div className="nariad-card-meta" style={{ display: 'flex', gap: '10px', fontSize: '0.62rem', fontWeight: 700, marginTop: '2px' }}>
                  <span>📅 {createdDate}</span>
                  {partCount > 0 && <span>📦 {partCount} деталей</span>}
                  {Number(task.task_count) > 1 && <span style={{ color: '#8b5cf6' }}>⛓ Цех 1 + Цех 2</span>}
                </div>
              </div>
            )
          })}
          {filteredTasks.length === 0 && (
            <div className="nariad-empty-hint" style={{ fontSize: '0.78rem', textAlign: 'center', padding: '30px 0', fontWeight: 700 }}>
              Нарядів не знайдено
            </div>
          )}
          {nariadCatalogTotal > 50 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', paddingTop: '4px' }}>
              <button disabled={nariadCatalogPage === 0 || nariadCatalogLoading} onClick={() => setNariadCatalogPage(p => Math.max(0, p - 1))} className="nariad-page-btn">←</button>
              <span className="nariad-page-info" style={{ fontSize: '0.65rem', fontWeight: 800 }}>{nariadCatalogPage + 1} / {Math.ceil(nariadCatalogTotal / 50)}</span>
              <button disabled={(nariadCatalogPage + 1) * 50 >= nariadCatalogTotal || nariadCatalogLoading} onClick={() => setNariadCatalogPage(p => p + 1)} className="nariad-page-btn">→</button>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL — Inline Report */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {!selectedNariadTaskId && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '15px', color: '#333' }}>
            <div style={{ fontSize: '3rem' }}>📋</div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#444' }}>Оберіть наряд зі списку</div>
            <div style={{ fontSize: '0.75rem', color: '#333', fontWeight: 700 }}>Звіт з'явиться тут</div>
          </div>
        )}

        {nariadReportLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '15px' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid #1a1a1a', borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ color: '#555', fontSize: '0.85rem', fontWeight: 800 }}>Завантаження звіту...</div>
          </div>
        )}

        {selectedTask && nariadReportData && !nariadReportLoading && (() => {
          const rd = nariadReportData
          const snapshot = rd.planSnapshot || selectedTask.plan_snapshot

          const cutterRequests = (rd.materialRequests || []).filter(r => {
            const name = r.nomenclature?.name?.toLowerCase() || ''
            return name.includes('фреза') || (r.details || '').toLowerCase().includes('фреза')
          })
          const getReqQty = r => {
            const declaredQty = Number((r.details || '').match(/[—-]\s*(\d+(?:[.,]\d+)?)/)?.[1]?.replace(',', '.') || 0)
            return declaredQty || Number(r.quantity) || 0
          }
          const snapshotCutters = Array.isArray(snapshot?.consumables)
            ? snapshot.consumables.filter(item => String(item?.name || '').toLowerCase().includes('фреза'))
            : []
          const resolveSnapshotCutterName = item => {
            const selectedCutters = snapshot?.selectedCutters || {}
            const selectedInvId = selectedCutters[item.name] || selectedCutters[String(item.name || '').toLowerCase()]
            const selectedInv = (inventory || []).find(inv => String(inv.id) === String(selectedInvId))
            const selectedNom = selectedInv ? (nomenclatures || []).find(n => String(n.id) === String(selectedInv.nomenclature_id)) : null
            return selectedNom?.name || selectedInv?.name || item.name || 'Фреза'
          }
          let plannedCuttersBreakdown = buildPlannedCuttersFromSnapshot({
            task: selectedTask,
            snapshot,
            nomenclatures,
            machineOperations,
            inventory
          })
          if (Object.keys(plannedCuttersBreakdown).length === 0) {
            plannedCuttersBreakdown = snapshotCutters.length > 0
              ? snapshotCutters.reduce((result, item) => {
                const name = resolveSnapshotCutterName(item)
                result[name] = (result[name] || 0) + (Number(item.total) || 0)
                return result
              }, {})
              : cutterRequests.reduce((result, request) => {
                const name = request.nomenclature?.name || 'Фреза'
                result[name] = (result[name] || 0) + getReqQty(request)
                return result
              }, {})
          }
          const totalPlannedCutters = Object.values(plannedCuttersBreakdown).reduce((s, qty) => s + (Number(qty) || 0), 0)
          const actualCuttersBreakdown = {}
          const cuttingHistoryRows = rd.historyRows.filter(row => String(row.stage_name || '').trim().startsWith('Розкрій'))
          cuttingHistoryRows.forEach(row => {
            const info = row.card_info || ''
            const idx = info.indexOf('[CUTTERS_BREAKDOWN:')
            if (idx !== -1) {
              const start = info.indexOf('{', idx)
              if (start !== -1) {
                let depth = 0, end = -1
                for (let i = start; i < info.length; i++) {
                  if (info[i] === '{') depth++
                  else if (info[i] === '}') { depth--; if (depth === 0) { end = i; break } }
                }
                if (end !== -1) {
                  try {
                    Object.entries(JSON.parse(info.slice(start, end + 1))).forEach(([cutterName, qty]) => {
                      actualCuttersBreakdown[cutterName] = (actualCuttersBreakdown[cutterName] || 0) + (Number(qty) || 0)
                    })
                  } catch(e){}
                }
              }
            } else if (Number(row.cutters_used) > 0) {
              actualCuttersBreakdown['Фреза'] = (actualCuttersBreakdown['Фреза'] || 0) + Number(row.cutters_used)
            }
          })
          const totalActualCutters = Object.values(actualCuttersBreakdown).reduce((s, v) => s + v, 0)
          let totalScrap = rd.historyRows.reduce((s, r) => s + (Number(r.scrap_qty) || 0), 0)

          const shop1StageNames = ['Розкрій', 'Галтовка', 'Прийомка', 'Сортування']
          const shop2DefaultStages = ['Пресування', 'Фарбування', 'Доопрацювання', 'Контроль ВКЯ']
          const isShop1History = row => {
            const stage = String(row.stage_name || '')
            return shop1StageNames.some(name => stage === name || stage.startsWith(name)) || stage.startsWith('Буфер ')
          }
          const isTechnicalHistory = row => ['completed', 'Склад БЗ', 'Склад СГП', 'Склад (БРОНЬ)'].includes(String(row.stage_name || ''))
          const isShop2History = row => String(row.card_info || '').includes('[ЦЕХ №2]') || (!isShop1History(row) && !isTechnicalHistory(row))

          const buildTimeAnalytics = (rows, defaults = []) => {
            const stageTotals = Object.fromEntries(defaults.map(name => [name, { total: 0, count: 0 }]))
            const bufferTotals = {}
            let first = null
            let last = null
            rows.forEach(row => {
              const started = row.started_at ? new Date(row.started_at) : null
              const completed = row.completed_at ? new Date(row.completed_at) : null
              if (started && (!first || started < first)) first = started
              if (completed && (!last || completed > last)) last = completed
              if (!started || !completed) return
              const stage = String(row.stage_name || 'Без назви')
              if (stage === 'Розкрій (зупинка)') return
              const seconds = Math.max(0, Math.round((completed - started) / 1000))
              const target = stage.startsWith('Буфер ') ? bufferTotals : stageTotals
              if (!target[stage]) target[stage] = { total: 0, count: 0 }
              target[stage].total += seconds
              target[stage].count += 1
            })
            return {
              stageTotals,
              bufferTotals,
              total: first && last ? Math.max(0, Math.round((last - first) / 1000)) : 0,
              active: Object.values(stageTotals).reduce((sum, item) => sum + item.total, 0),
              buffer: Object.values(bufferTotals).reduce((sum, item) => sum + item.total, 0),
              cards: new Set(rows.map(row => row.card_id).filter(Boolean)).size || 1
            }
          }
          const renderTimeAnalytics = (title, stats, color, subtitle) => (
            <div className="nariad-analytics-box" style={{ borderRadius: '20px', padding: '20px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color, fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '15px' }}>
                <Clock size={14} /> {title}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(205px, 1fr))', gap: '16px' }}>
                <div className="analytics-stat-card" style={{ borderRadius: '14px', padding: '15px', textAlign: 'center' }}>
                  <div className="analytics-label" style={{ fontSize: '0.62rem', fontWeight: 900, textTransform: 'uppercase' }}>Загальний час проходження</div>
                  <div style={{ color, fontSize: '1.45rem', fontWeight: 1000, margin: '8px 0 5px' }}>{stats.total ? formatDurHMS(stats.total) : '—'}</div>
                  <div className="analytics-sub" style={{ fontSize: '0.58rem', paddingBottom: '8px' }}>{subtitle}</div>
                  <div className="analytics-row" style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '0.65rem', marginTop: '8px', textAlign: 'left' }}><span>Сер. робота / картку:</span><strong style={{ color: '#3b82f6' }}>{formatDurHMS(Math.round(stats.active / stats.cards))}</strong></div>
                  <div className="analytics-row" style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '0.65rem', marginTop: '5px', textAlign: 'left' }}><span>Сер. буфер / картку:</span><strong style={{ color: '#f59e0b' }}>{formatDurHMS(Math.round(stats.buffer / stats.cards))}</strong></div>
                </div>
                <div className="analytics-stat-card" style={{ borderRadius: '14px', padding: '15px' }}>
                  <div className="analytics-label" style={{ fontSize: '0.62rem', fontWeight: 900, textTransform: 'uppercase', paddingBottom: '7px', marginBottom: '8px' }}>Робочі етапи · активна робота</div>
                  {Object.entries(stats.stageTotals).map(([name, item]) => <div key={name} className="analytics-row" style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '0.68rem', padding: '4px 0' }}><span>{name}:</span><strong style={{ color: '#3b82f6' }}>{formatDurHMS(item.total)}</strong></div>)}
                </div>
                <div className="analytics-stat-card" style={{ borderRadius: '14px', padding: '15px' }}>
                  <div className="analytics-label" style={{ fontSize: '0.62rem', fontWeight: 900, textTransform: 'uppercase', paddingBottom: '7px', marginBottom: '8px' }}>Буфери накопичення</div>
                  {Object.keys(stats.bufferTotals).length > 0 ? Object.entries(stats.bufferTotals).map(([name, item]) => <div key={name} className="analytics-row" style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '0.68rem', padding: '4px 0' }}><span>{name}:</span><strong style={{ color: '#f59e0b' }}>{formatDurHMS(item.total)}</strong></div>) : <div className="analytics-sub" style={{ fontSize: '0.65rem', paddingTop: '4px' }}>Час у буферах не зафіксовано</div>}
                </div>
              </div>
            </div>
          )

          const acceptedQty = rd.historyRows.filter(r => r.stage_name === 'Прийомка' || r.stage_name === 'completed').reduce((s, r) => s + (Number(r.qty_completed) || 0), 0)
          const totalPlannedParts = snapshot && typeof snapshot === 'object'
            ? Object.entries(snapshot).filter(([key, value]) => !key.startsWith('_') && value && typeof value === 'object' && (value.id || value.name)).reduce((sum, [, value]) => sum + (Number(value.plan ?? value.need ?? value.quantity) || 0), 0)
            : 0

          const matStats = {}
          const snapshotParts = snapshot && typeof snapshot === 'object'
            ? Object.entries(snapshot).filter(([key, value]) => !key.startsWith('_') && value && typeof value === 'object' && (value.id || value.name))
            : []
          snapshotParts.forEach(([nomId, entry]) => {
            const actualNomId = entry.id || nomId
            const nom = nomenclatures?.find(item => String(item.id) === String(actualNomId))
            if (nom && nom.type !== 'part') return
            const unitsPerSheet = Number(entry.units_per_sheet) || Number(nom?.units_per_sheet) || 1
            const planned = Number(entry.sheets) || Math.ceil((Number(entry.plan) || 0) / unitsPerSheet)
            const cutQty = rd.historyRows
              .filter(row => String(row.nomenclature_id) === String(actualNomId) && row.stage_name === 'Розкрій' && !String(row.card_info || '').includes('[PAUSED_WORK_LOG]'))
              .reduce((sum, row) => sum + (Number(row.qty_completed) || 0), 0)
            const actual = Math.ceil(cutQty / unitsPerSheet)
            const material = entry.material || nom?.material_type || 'Матеріал'
            if (!matStats[material]) matStats[material] = { planned: 0, actual: 0 }
            matStats[material].planned += planned
            matStats[material].actual += actual
          })
          const totalPlannedSheets = Object.values(matStats).reduce((sum, item) => sum + item.planned, 0)
          const totalActualSheets = Object.values(matStats).reduce((sum, item) => sum + item.actual, 0)

          let logRows = rd.historyRows.filter(row => {
            if (nariadStageFilter === 'All') return true
            if (nariadStageFilter === 'Цех №1') return isShop1History(row)
            if (nariadStageFilter === 'Цех №2') return isShop2History(row)
            if (nariadStageFilter === 'Галтовка') return row.stage_name?.startsWith('Галтовка')
            if (nariadStageFilter === 'Прийомка') return row.stage_name === 'Прийомка' || row.stage_name === 'completed'
            return row.stage_name === nariadStageFilter
          }).filter(row => nariadNomFilter === 'All' || String(row.nomenclature_id) === nariadNomFilter)

          logRows.sort((a, b) => {
            if (nariadSortBy === 'shop') return Number(isShop2History(a)) - Number(isShop2History(b)) || new Date(a.started_at || a.created_at || 0) - new Date(b.started_at || b.created_at || 0)
            if (nariadSortBy === 'min-time') {
              const da = a.started_at && a.completed_at ? new Date(a.completed_at) - new Date(a.started_at) : 0
              const db2 = b.started_at && b.completed_at ? new Date(b.completed_at) - new Date(b.started_at) : 0
              return da - db2
            }
            if (nariadSortBy === 'max-time') {
              const da = a.started_at && a.completed_at ? new Date(a.completed_at) - new Date(a.started_at) : 0
              const db2 = b.started_at && b.completed_at ? new Date(b.completed_at) - new Date(b.started_at) : 0
              return db2 - da
            }
            if (nariadSortBy === 'scrap') return (Number(b.scrap_qty) || 0) - (Number(a.scrap_qty) || 0)
            return new Date(a.started_at || a.created_at || 0) - new Date(b.started_at || b.created_at || 0)
          })

          let productNames = (rd.orderItems || []).map(item => item.name || nomenclatures?.find(n => String(n.id) === String(item.nomenclature_id))?.name).filter(Boolean).join(', ')
          if (!productNames) productNames = selectedOrder?.order_items?.map(it => nomenclatures?.find(n => n.id === it.nomenclature_id)?.name).filter(Boolean).join(', ')
          productNames ||= '—'
          const sm2 = statusMeta(selectedTask.status)

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Report header */}
              <div style={{ borderBottom: '1px solid #1a1a1a', padding: '4px 0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '15px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#3b82f6', fontSize: '0.68rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '4px' }}>
                    <Clock size={13} /> Звіт по виробництву · Цех №1 + Цех №2
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.7rem', fontWeight: 950 }}>
                    Наряд №{selectedOrder?.order_num}{selectedTask.batch_index ? `/${selectedTask.batch_index}` : ''}
                  </h3>
                  <div className="report-product-names" style={{ fontSize: '0.85rem', marginTop: '4px', fontWeight: 700 }}>
                    Виріб: <strong style={{ color: '#ef4444' }}>{productNames}</strong>
                    {selectedOrder?.customer && ` | Замовник: ${selectedOrder.customer}`}
                  </div>
                  {(rd.taskCount > 1 || Number(selectedTask.task_count) > 1) && (
                    <div style={{ color: '#8b5cf6', fontSize: '0.68rem', marginTop: '8px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Єдина історія руху · Цех №1 → Цех №2
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ background: sm2.bg, color: sm2.color, fontSize: '0.7rem', fontWeight: 900, padding: '5px 12px', borderRadius: '8px', border: `1px solid ${sm2.color}30` }}>
                    {sm2.label}
                  </span>
                  <button
                    onClick={() => handleOpenNariadReport(selectedTask, true)}
                    style={{ background: '#0d1424', border: '1px solid #3b82f640', color: '#3b82f6', padding: '8px 14px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <RotateCcw size={12} /> Оновити дані
                  </button>
                </div>
              </div>

              {/* Stats cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px' }}>
                <div className="nariad-widget-card" style={{ borderRadius: '16px', padding: '16px' }}>
                  <div className="widget-card-title" style={{ fontSize: '0.62rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>✂️ Фрези (Розкрій)</div>
                  <div className="widget-card-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', paddingBottom: '6px', marginBottom: '6px' }}>
                    <span>Потреба: <strong>{totalPlannedCutters} шт</strong></span>
                    <span>Факт: <strong style={{ color: totalActualCutters > totalPlannedCutters ? '#ef4444' : '#eab308' }}>{totalActualCutters} шт</strong></span>
                  </div>
                  {[...new Set([...Object.keys(plannedCuttersBreakdown), ...Object.keys(actualCuttersBreakdown)])].map(name => (
                    <div key={name} className="widget-card-item" style={{ fontSize: '0.65rem', marginBottom: '5px', paddingBottom: '4px' }}>
                      <div className="widget-item-name" style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}><span>Потреба: <strong>{plannedCuttersBreakdown[name] || 0} шт</strong></span><span>Факт: <strong style={{ color: '#eab308' }}>{actualCuttersBreakdown[name] || 0} шт</strong></span></div>
                    </div>
                  ))}
                  {Object.keys(plannedCuttersBreakdown).length === 0 && Object.keys(actualCuttersBreakdown).length === 0 && <div style={{ fontSize: '0.62rem', fontStyle: 'italic' }}>Без витрат</div>}
                </div>

                <div className="nariad-widget-card" style={{ borderRadius: '16px', padding: '16px' }}>
                  <div className="widget-card-title" style={{ fontSize: '0.62rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>🗂️ Листи (Матеріал)</div>
                  <div className="widget-card-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', paddingBottom: '6px', marginBottom: '6px' }}><span>План: <strong>{totalPlannedSheets} л.</strong></span><span>Факт: <strong style={{ color: totalActualSheets > totalPlannedSheets ? '#ef4444' : '#10b981' }}>{totalActualSheets} л.</strong></span></div>
                  {Object.entries(matStats).length > 0 ? Object.entries(matStats).map(([mat, sheets]) => (
                    <div key={mat} className="widget-card-item" style={{ fontSize: '0.68rem', paddingBottom: '4px', marginBottom: '4px' }}>
                      <div className="widget-item-name" style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={mat}>{mat}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}><span>План: <strong>{sheets.planned} л.</strong></span><span>Факт: <strong style={{ color: '#10b981' }}>{sheets.actual} л.</strong></span></div>
                    </div>
                  )) : <div style={{ fontSize: '0.62rem', fontStyle: 'italic' }}>Немає даних</div>}
                </div>

                <div className="nariad-widget-card" style={{ borderRadius: '16px', padding: '16px' }}>
                  <div className="widget-card-title" style={{ fontSize: '0.62rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '10px' }}>📦 Деталі та Брак</div>
                  <div className="widget-card-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '6px' }}>
                    <span>План:</span>
                    <strong>{totalPlannedParts || '—'}{totalPlannedParts ? ' шт' : ''}</strong>
                  </div>
                  <div onClick={() => setNariadDetailModal('accepted')} title="Відкрити деталізацію прийнятих деталей" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '6px', cursor: 'pointer' }}>
                    <span>Прийнято:</span>
                    <strong style={{ color: '#10b981', borderBottom: '1px dashed #10b981' }}>{acceptedQty} шт</strong>
                  </div>
                  <div onClick={() => setNariadDetailModal('scrap')} title="Відкрити деталізацію браку" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', cursor: 'pointer' }}>
                    <span>Брак:</span>
                    <strong style={{ color: totalScrap > 0 ? '#ef4444' : '#555', borderBottom: `1px dashed ${totalScrap > 0 ? '#ef4444' : '#555'}` }}>{totalScrap} шт</strong>
                  </div>
                </div>
              </div>

              {renderTimeAnalytics('Аналітика перебування деталей у Цеху №1', shop1Time, '#10b981', 'Від першої операції до передачі у Цех №2')}
              {renderTimeAnalytics('Аналітика перебування деталей у Цеху №2', shop2Time, '#8b5cf6', 'Від приймання у Цех №2 до завершення останньої операції')}

              {/* Log table */}
              <div className="nariad-log-box" style={{ borderRadius: '20px', padding: '20px 22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
                  <h4 className="log-heading" style={{ margin: 0, fontSize: '0.9rem', fontWeight: 900, textTransform: 'uppercase' }}>Хронологічний лог етапів</h4>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div className="nariad-filter-bar" style={{ display: 'flex', gap: '3px', padding: '4px', borderRadius: '10px' }}>
                      {availableStageFilters.map(stage => {
                        const sel = nariadStageFilter === stage
                        const clr = { All: '#777', 'Цех №1': '#10b981', 'Цех №2': '#8b5cf6', Розкрій: '#3b82f6', Галтовка: '#eab308', Прийомка: '#10b981', Сортування: '#14b8a6' }
                        const stageColor = clr[stage] || '#8b5cf6'
                        return (
                          <button key={stage} onClick={() => setNariadStageFilter(stage)} style={{
                            border: 'none', background: sel ? (stage === 'All' ? '#222' : stageColor) : 'transparent',
                            color: sel ? (stage === 'All' ? '#fff' : '#000') : '#555',
                            padding: '4px 10px', borderRadius: '7px', fontSize: '0.6rem', fontWeight: 900, cursor: 'pointer', transition: 'all 0.15s',
                            textTransform: 'uppercase'
                          }}>
                            {stage === 'All' ? 'Всі етапи' : stage}
                          </button>
                        )
                      })}
                    </div>
                    <select value={nariadSortBy} onChange={e => setNariadSortBy(e.target.value)}
                      className="form-input"
                      style={{ padding: '5px 10px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', width: 'auto' }}>
                      <option value="date">По даті</option>
                      <option value="shop">Спочатку Цех №1, потім Цех №2</option>
                      <option value="min-time">Мін. час</option>
                      <option value="max-time">Макс. час</option>
                      <option value="scrap">По браку</option>
                    </select>
                    <select value={nariadNomFilter} onChange={e => setNariadNomFilter(e.target.value)}
                      className="form-input"
                      style={{ padding: '5px 10px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', maxWidth: '180px' }}>
                      <option value="All">Всі деталі</option>
                      {[...new Set(rd.historyRows.map(r => r.nomenclature_id).filter(Boolean))].map(nomId => {
                        const nom = nomenclatures?.find(n => String(n.id) === String(nomId))
                        return <option key={nomId} value={nomId}>{nom?.name || nomId}</option>
                      })}
                    </select>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #1a1a1a' }}>
                        {['Деталь / Картка','Час (початок / завершення)','План. час','Факт. час','Етап','Оператор / Зміна','Робоче місце','Готово / Брак'].map(col => (
                          <th key={col} style={{ padding: '8px 10px', textAlign: 'left', color: '#444', fontWeight: 900, textTransform: 'uppercase', fontSize: '0.58rem', whiteSpace: 'nowrap' }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {logRows.map((row, idx) => {
                        const nom = nomenclatures?.find(n => String(n.id) === String(row.nomenclature_id))
                        const rowCard = (rd.taskCards || []).find(card => String(card.id) === String(row.card_id))
                        const sequenceMatch = String(row.card_info || rowCard?.card_info || '').match(/(?:^|\D)(\d+)\s*\/\s*(\d+)(?:\D|$)/)
                        const sequenceLabel = sequenceMatch ? `${sequenceMatch[1]}/${sequenceMatch[2]}` : `ID ${String(row.card_id || '').slice(-8).toUpperCase()}`
                        const dur = row.started_at && row.completed_at
                          ? Math.max(0, Math.round((new Date(row.completed_at) - new Date(row.started_at)) / 1000))
                          : null
                        const plannedSec = nom?.time_per_unit ? Math.round(Number(nom.time_per_unit) * (Number(row.qty_completed) || 0)) : null
                        const isGalt = row.stage_name?.startsWith('Галтовка')
                        const stageClr = isShop2History(row) ? '#8b5cf6' : isGalt ? '#eab308' : row.stage_name === 'Прийомка' ? '#10b981' : row.stage_name === 'Сортування' ? '#14b8a6' : '#3b82f6'
                        const hasScrap = Number(row.scrap_qty) > 0
                        const fmt = (iso) => iso ? new Date(iso).toLocaleString('uk-UA', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—'
                        return (
                          <tr key={row.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.005)' }}>
                            <td style={{ padding: '8px 10px', color: '#bbb', fontWeight: 700, maxWidth: '220px' }}>
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nom?.name || '—'}</div>
                              <div style={{ color: '#666', fontSize: '0.58rem', marginTop: '2px' }}>Картка {sequenceLabel}</div>
                            </td>
                            <td style={{ padding: '8px 10px', color: '#555', whiteSpace: 'nowrap' }}><div>{fmt(row.started_at)}</div><div style={{ marginTop: '2px' }}>{fmt(row.completed_at)}</div></td>
                            <td style={{ padding: '8px 10px', color: '#777', fontWeight: 800, whiteSpace: 'nowrap' }}>{plannedSec ? formatDurHMS(plannedSec) : '—'}</td>
                            <td style={{ padding: '8px 10px', color: dur !== null ? '#3b82f6' : '#333', fontWeight: 800, whiteSpace: 'nowrap' }}>{dur !== null ? formatDurHMS(dur) : '—'}</td>
                            <td style={{ padding: '8px 10px' }}>
                              <span style={{ background: `${stageClr}15`, color: stageClr, padding: '2px 7px', borderRadius: '5px', fontSize: '0.6rem', fontWeight: 900 }}>
                                {row.stage_name || '—'}
                              </span>
                            </td>
                            <td style={{ padding: '8px 10px', color: '#666', fontWeight: 700 }}>
                              <div>{row.operator_name || '—'}</div>
                              <div style={{ color: '#444', fontSize: '0.6rem' }}>{row.shift_name || ''}</div>
                            </td>
                            <td style={{ padding: '8px 10px', color: '#666', fontWeight: 700 }}>{row.machine_name || '—'}</td>
                            <td style={{ padding: '8px 10px', fontWeight: 900, textAlign: 'right' }}><div style={{ color: '#10b981' }}>{Number(row.qty_completed) || 0} шт</div><div style={{ color: hasScrap ? '#ef4444' : '#333', marginTop: '3px' }}>{Number(row.scrap_qty) || 0} брак</div></td>
                          </tr>
                        )
                      })}
                      {logRows.length === 0 && (
                        <tr><td colSpan={8} style={{ padding: '30px', textAlign: 'center', color: '#444', fontWeight: 700 }}>Немає записів для відображення</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )
        })()}
      </div>
    </div>
  )
}
