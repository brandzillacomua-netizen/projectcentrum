import React from 'react'
import { X, Loader2, Clock, Printer, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react'

const isCuttingHistoryRow = row => String(row.stage_name || '').trim().startsWith('Розкрій')

const parseCuttersBreakdown = (cardInfo = '') => {
  const info = String(cardInfo || '')
  const markerIdx = info.indexOf('[CUTTERS_BREAKDOWN:')
  if (markerIdx === -1) return null

  const jsonStart = info.indexOf('{', markerIdx)
  if (jsonStart === -1) return null

  let depth = 0
  let jsonEnd = -1
  for (let i = jsonStart; i < info.length; i++) {
    if (info[i] === '{') depth++
    else if (info[i] === '}') {
      depth--
      if (depth === 0) {
        jsonEnd = i
        break
      }
    }
  }

  if (jsonEnd === -1) return null

  try {
    return JSON.parse(info.slice(jsonStart, jsonEnd + 1))
  } catch (e) {
    console.warn('Failed to parse cutters breakdown from card_info:', e, info.slice(jsonStart, jsonEnd + 1))
    return null
  }
}

const getDeclaredRequestQty = (request, fallbackQty = 0) => {
  const match = String(request?.details || '').match(/[—-]\s*(\d+(?:[.,]\d+)?)/)
  if (match) return Number(match[1].replace(',', '.')) || fallbackQty
  return fallbackQty
}

const getMaterialRequestQty = (request) => {
  const directQty = Number(request?.quantity)
  if (Number.isFinite(directQty) && directQty > 0) return directQty
  const match = String(request?.details || '').match(/[—-]\s*(\d+(?:[.,]\d+)?)/)
  if (match) return Number(match[1].replace(',', '.')) || 0
  return getDeclaredRequestQty(request, 0)
}

const isIssuedMaterialRequest = (request) => ['issued', 'completed'].includes(String(request?.status || '').toLowerCase())

const isReissueSheetMaterialRequest = (request) => {
  const text = `${request?.details || ''} ${request?.nomenclature?.name || ''}`.toLowerCase()
  const isSheet = text.includes('лист') || text.includes('т300') || text.includes('т700') || text.includes('t300') || text.includes('t700')
  const isReissue = text.includes('довипуск') || text.includes('дозапит') || text.includes('брак') || text.includes('нестача')
  return isSheet && isReissue
}

const parseSheetMaterialFromRequest = (request) => {
  const text = `${request?.nomenclature?.name || ''} ${request?.details || ''}`
  const compact = text.toLowerCase().replace(/\s+/g, '')
  const typePrefix = compact.includes('т700') || compact.includes('t700') ? 'Т700' : 'Т300'
  const thicknessMatch = text.match(/(\d+(?:[.,]\d+)?)\s*мм/i)
  if (!thicknessMatch) return null
  return {
    typePrefix,
    thickness: `${thicknessMatch[1].replace(',', '.')}мм`
  }
}

const getCutterDiameter = (name = '') => {
  const lower = String(name || '').toLowerCase().replace(/,/g, '.')
  const direct = lower.match(/ф\s*([0-9]+(?:\.[0-9]+)?)/)
  if (direct) return parseFloat(direct[1])
  const bySize = lower.match(/(?:кукурудза|двопера|однопера|спіральна|торцева|шарова|радіусна)?\s*([0-9][0-9.]*)(?:\s*[×xх])/)
  return bySize ? parseFloat(bySize[1]) : null
}

const buildPlannedCuttersFromSnapshot = ({ task, nomenclatures = [], machineOperations = [], inventory = [] }) => {
  const snapshot = task?.plan_snapshot || {}
  const selectedCutters = snapshot.selectedCutters || {}
  const result = {}

  const resolveDisplayName = genericName => {
    const selectedInvId = selectedCutters[genericName] || selectedCutters[String(genericName || '').toLowerCase()]
    const selectedInv = (inventory || []).find(inv => String(inv.id) === String(selectedInvId))
    const selectedNom = selectedInv ? (nomenclatures || []).find(n => String(n.id) === String(selectedInv.nomenclature_id)) : null
    return selectedNom?.name || selectedInv?.name || genericName || 'Фреза'
  }

  Object.entries(snapshot).forEach(([partId, part]) => {
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

      const opData = (machineOperations || []).find(op => {
        if (String(op.nomenclature_id) !== String(partNomId)) return false
        return op.machine_type === group.machine || op.machine_id === group.machine
      })
      if (!opData?.side2_cut_ops) return

      opData.side2_cut_ops
        .filter(op => op.startsWith('__CUTTER__Reference:') || op.startsWith('__CUTTER__:'))
        .forEach(op => {
          const [, cutterNomId, qtyPerSheetRaw] = op.split(':')
          const qtyPerSheet = parseFloat(qtyPerSheetRaw) || 0
          if (!cutterNomId || qtyPerSheet <= 0) return

          let cutterNom = (nomenclatures || []).find(n => String(n.id) === String(cutterNomId))
          if (!cutterNom) return

          let cutterName = cutterNom.name?.trim() || ''
          if (!cutterName || cutterName.toLowerCase() === 'фреза') return

          const diameter = getCutterDiameter(cutterName)
          if (override !== '1.5' && diameter && Math.abs(diameter - 1.5) < 0.01) return
          if (override === '1.5' && diameter && Math.abs(diameter - 2) < 0.01) {
            cutterName = 'Фреза ф1.5'
          }

          const displayName = resolveDisplayName(cutterName)
          result[displayName] = (result[displayName] || 0) + Math.ceil(group.sheets * qtyPerSheet)
        })
    })
  })

  return result
}

export function ForemanReportModal({
  showReportModal,
  setShowReportModal,
  reportTaskId,
  reportLoading,
  reportData,
  reportStageFilter,
  setReportStageFilter,
  reportNomFilter,
  setReportNomFilter,
  reportSortBy,
  setReportSortBy,
  reportOperatorFilter,
  setReportOperatorFilter,
  reportDetailModal,
  setReportDetailModal,
  handleOpenReport,
  tasks,
  orders,
  allOrdersMap,
  bomItems,
  nomenclatures,
  machineOperations,
  inventory,
  workCards,
  getRequestQty
}) {
  if (!showReportModal) return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(10px)',
      zIndex: 35000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }} className="report-modal-backdrop">
      <div style={{
        background: '#0d0d0d',
        border: '1px solid #222',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '850px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '30px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
        position: 'relative',
        color: '#fff'
      }} className="printable-report-area">
        {/* Close Button */}
        <button
          onClick={() => setShowReportModal(false)}
          className="close-btn-print"
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: '#1a1a1a',
            border: '1px solid #333',
            color: '#fff',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: '0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#333'}
          onMouseLeave={e => e.currentTarget.style.background = '#1a1a1a'}
        >
          <X size={20} />
        </button>

        {reportLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: '15px' }}>
            <Loader2 size={40} className="animate-spin" color="#3b82f6" />
            <span style={{ fontSize: '0.9rem', color: '#888', fontWeight: 800 }}>Формування звіту...</span>
          </div>
        ) : reportData ? (() => {
          const currentTask = tasks.find(t => t.id === reportTaskId)
          if (!currentTask) return <div>Наряд не знайдено</div>
          const currentOrder = orders.find(o => o.id === currentTask.order_id) || allOrdersMap[currentTask.order_id]

          // BOM parts helper inside modal
          const getBOMPartsLocal = (nomenclatureId) => {
            return bomItems
              .filter(b => b.parent_id === nomenclatureId)
              .map(b => ({
                ...b,
                nom: nomenclatures.find(n => n.id === b.child_id)
              }))
          }

          // Calculate stats
          let totalPlannedSheets = 0
          let totalActualSheets = 0
          let totalPlannedParts = 0
          let totalActualParts = 0
          let totalScrap = 0
          const materialStats = {}

          const partsList = []
          const snapshot = currentTask.plan_snapshot
          const hasSnapshot = snapshot && Object.keys(snapshot).filter(k => !k.startsWith('_') && !['materialSummary', 'arrivals', 'arrival_doc_id', 'arrival_doc', 'nomenclatures'].includes(k)).length > 0

          if (hasSnapshot) {
            const keys = Object.keys(snapshot).filter(k => !k.startsWith('_') && !['materialSummary', 'arrivals', 'arrival_doc_id', 'arrival_doc', 'nomenclatures'].includes(k))
            keys.forEach(nomId => {
              const snapEntry = snapshot[nomId]
              if (!snapEntry) return
              const nom = nomenclatures.find(n => String(n.id) === String(nomId))
              if (nom && nom.type !== 'part') return
              partsList.push({
                nomId: String(nomId),
                nom: nom,
                need: Number(snapEntry.need) || 0,
                plan: Number(snapEntry.plan) || 0,
                sheets: Number(snapEntry.sheets) || 0,
                unitsPerSheet: Number(snapEntry.units_per_sheet) || (nom?.units_per_sheet || 1),
                material: snapEntry.material || nom?.material_type || '—'
              })
            })
          } else {
            currentOrder?.order_items?.forEach(item => {
              const parts = getBOMPartsLocal(item.nomenclature_id)
              const rows = parts.length > 0 ? parts.filter(r => r.nom?.type === 'part') : [{ nom: nomenclatures.find(n => n.id === item.nomenclature_id), quantity_per_parent: 1 }].filter(r => r.nom?.type === 'part')

              rows.forEach(part => {
                const nomId = part.nom?.id
                if (!nomId) return
                const need = Number(item.quantity) * (Number(part.quantity_per_parent) || 1)
                const bzInv = (inventory || []).find(i => String(i.nomenclature_id) === String(nomId) && i.type === 'bz' && (!i.pocket_owner || i.pocket_owner === 'Не вказано'))
                const stockBZ = bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0
                const plan = Math.max(0, need - stockBZ)
                const unitsPerSheet = Number(part.nom?.units_per_sheet) || 1
                const sheets = Math.ceil(plan / unitsPerSheet)
                const material = part.nom?.material_type || '—'

                partsList.push({
                  nomId: String(nomId),
                  nom: part.nom,
                  need,
                  plan,
                  sheets,
                  unitsPerSheet,
                  material
                })
              })
            })
          }

          const getMaterialName = (typePrefix, thickness) => {
            const rawNom = nomenclatures?.find(n =>
              (n.type === 'raw' || n.type === 'material') &&
              n.name.includes('[Підготовлений]') &&
              (n.name.toLowerCase().includes(typePrefix.toLowerCase()) || (typePrefix === 'Т300' && !n.name.toLowerCase().includes('т700') && !n.name.toLowerCase().includes('t700'))) &&
              n.name.toLowerCase().replace(/\s+/g, '').includes(`(${thickness.toLowerCase()})`)
            )
            return rawNom ? rawNom.name : `Лист ${typePrefix} (${thickness}) [Підготовлений]`
          }

          const issuedReissueSheetsByMaterial = {}
          ;(reportData.materialRequests || []).forEach(request => {
            if (!isIssuedMaterialRequest(request) || !isReissueSheetMaterialRequest(request)) return
            const material = parseSheetMaterialFromRequest(request)
            if (!material) return
            const materialName = getMaterialName(material.typePrefix, material.thickness)
            issuedReissueSheetsByMaterial[materialName] = (issuedReissueSheetsByMaterial[materialName] || 0) + getMaterialRequestQty(request)
          })

          partsList.forEach(p => {
            const partHistory = reportData.historyRows.filter(h => String(h.nomenclature_id) === String(p.nomId))
            const cuttingHistory = partHistory.filter(h => h.stage_name === 'Розкрій')
            const acceptedHistory = partHistory.filter(h => h.stage_name === 'Прийомка' || h.stage_name === 'completed')

            const sheetsDone = p.sheets || 0

            const acceptedQty = acceptedHistory.reduce((s, h) => s + (Number(h.qty_completed) || 0), 0)

            totalPlannedSheets += (p.sheets || 0)
            totalActualSheets += sheetsDone
            totalPlannedParts += (p.plan || 0)
            totalActualParts += acceptedQty

            const snapEntry = snapshot?.[p.nomId]
            const isDefaultT700 = (p.material || '').toLowerCase().includes('т700') || (p.material || '').toLowerCase().includes('t700')
            const defaultT300 = isDefaultT700 ? 0 : p.sheets
            const defaultT700 = isDefaultT700 ? p.sheets : 0
            let plannedT300 = snapEntry ? (snapEntry.sheets_t300 !== undefined ? Number(snapEntry.sheets_t300) : (isDefaultT700 ? 0 : Number(p.sheets))) : defaultT300
            let plannedT700 = snapEntry ? (snapEntry.sheets_t700 !== undefined ? Number(snapEntry.sheets_t700) : (isDefaultT700 ? Number(p.sheets) : 0)) : defaultT700
            if (isNaN(plannedT300)) plannedT300 = defaultT300
            if (isNaN(plannedT700)) plannedT700 = defaultT700

            const actualT300 = plannedT300
            const actualT700 = plannedT700

            const rawMat = p.material || '—'
            const thickMatch = rawMat.match(/(\d+(?:\.\d+)?)мм/i)
            const thickness = thickMatch ? `${thickMatch[1]}мм` : null

            const addToStats = (name, planned, actual) => {
              if (planned === 0 && actual === 0) return
              if (!materialStats[name]) {
                materialStats[name] = {
                  plannedSheets: 0,
                  actualSheets: 0
                }
              }
              materialStats[name].plannedSheets += planned
              materialStats[name].actualSheets += actual
            }

            if (thickness) {
              const t300Name = getMaterialName('Т300', thickness)
              const t700Name = getMaterialName('Т700', thickness)

              addToStats(t300Name, plannedT300, actualT300)
              addToStats(t700Name, plannedT700, actualT700)
            } else {
              addToStats(rawMat, p.sheets, sheetsDone)
            }
          })

          Object.entries(issuedReissueSheetsByMaterial).forEach(([materialName, sheets]) => {
            if (!sheets) return
            if (!materialStats[materialName]) {
              materialStats[materialName] = {
                plannedSheets: 0,
                actualSheets: 0
              }
            }
            materialStats[materialName].actualSheets += sheets
            totalActualSheets += sheets
          })

          totalScrap = reportData.historyRows.reduce((sum, row) => sum + (Number(row.scrap_qty) || 0), 0)

          const cutterRequests = (reportData.materialRequests || []).filter(r => {
            const nomName = r.nomenclature?.name?.toLowerCase() || ''
            const detailsStr = r.details?.toLowerCase() || ''
            return nomName.includes('фреза') || detailsStr.includes('фреза')
          })
          let plannedCuttersBreakdown = buildPlannedCuttersFromSnapshot({
            task: currentTask,
            nomenclatures,
            machineOperations,
            inventory
          })
          const snapshotCutters = Array.isArray(currentTask?.plan_snapshot?.consumables)
            ? currentTask.plan_snapshot.consumables.filter(item => String(item?.name || '').toLowerCase().includes('фреза'))
            : []
          const resolveSnapshotCutterName = item => {
            const selectedCutters = currentTask?.plan_snapshot?.selectedCutters || {}
            const selectedInvId = selectedCutters[item.name] || selectedCutters[String(item.name || '').toLowerCase()]
            const selectedInv = (inventory || []).find(inv => String(inv.id) === String(selectedInvId))
            const selectedNom = selectedInv ? (nomenclatures || []).find(n => String(n.id) === String(selectedInv.nomenclature_id)) : null
            return selectedNom?.name || selectedInv?.name || item.name || 'Фреза'
          }

          if (Object.keys(plannedCuttersBreakdown).length > 0) {
            // Freshly calculated from per-detail snapshot and machine operations.
          } else if (snapshotCutters.length > 0) {
            snapshotCutters.forEach(item => {
              const name = resolveSnapshotCutterName(item)
              plannedCuttersBreakdown[name] = (plannedCuttersBreakdown[name] || 0) + (Number(item.total) || 0)
            })
          } else {
            cutterRequests.forEach(r => {
              const name = r.nomenclature?.name || 'Фреза'
              const fallbackQty = getRequestQty(r)
              plannedCuttersBreakdown[name] = (plannedCuttersBreakdown[name] || 0) + getDeclaredRequestQty(r, fallbackQty)
            })
          }

          const totalPlannedCutters = Object.values(plannedCuttersBreakdown).reduce((sum, qty) => sum + (Number(qty) || 0), 0)

          const actualCuttersBreakdown = {}
          const cuttingHistoryRows = reportData.historyRows.filter(isCuttingHistoryRow)
          cuttingHistoryRows.forEach(row => {
            const parsed = parseCuttersBreakdown(row.card_info)
            if (parsed) {
              Object.entries(parsed).forEach(([cutterName, qty]) => {
                actualCuttersBreakdown[cutterName] = (actualCuttersBreakdown[cutterName] || 0) + (Number(qty) || 0)
              })
            } else if (Number(row.cutters_used) > 0) {
              const plannedNames = Object.keys(plannedCuttersBreakdown)
              if (plannedNames.length === 1) {
                const name = plannedNames[0]
                actualCuttersBreakdown[name] = (actualCuttersBreakdown[name] || 0) + Number(row.cutters_used)
              } else if (plannedNames.length > 1) {
                const name = 'Фреза (без деталей)'
                actualCuttersBreakdown[name] = (actualCuttersBreakdown[name] || 0) + Number(row.cutters_used)
              } else {
                const name = 'Фреза'
                actualCuttersBreakdown[name] = (actualCuttersBreakdown[name] || 0) + Number(row.cutters_used)
              }
            }
          })

          const totalActualCutters = Object.keys(actualCuttersBreakdown).length > 0
            ? Object.values(actualCuttersBreakdown).reduce((sum, val) => sum + val, 0)
            : cuttingHistoryRows.reduce((sum, row) => sum + (Number(row.cutters_used) || 0), 0)

          const totalActualMs = reportData.historyRows.reduce((sum, row) => {
            if (row.started_at && row.completed_at && (row.stage_name === 'Розкрій' || row.stage_name === 'Розкрій (перезмінка)')) {
              const diff = new Date(row.completed_at) - new Date(row.started_at)
              return sum + (diff > 0 ? diff : 0)
            }
            return sum
          }, 0)
          const totalActualSeconds = Math.round(totalActualMs / 1000)

          const formatDurationHMS = (totalSeconds) => {
            if (totalSeconds === null || totalSeconds === undefined || totalSeconds < 0) return '—'
            const hours = Math.floor(totalSeconds / 3600)
            const minutes = Math.floor((totalSeconds % 3600) / 60)
            const seconds = Math.floor(totalSeconds % 60)
            const pad = (num) => String(num).padStart(2, '0')
            return `${pad(hours)}год. ${pad(minutes)}хв. ${pad(seconds)}с`
          }

          let productNames = currentOrder?.order_items?.map(it => nomenclatures.find(n => n.id === it.nomenclature_id)?.name).filter(Boolean).join(', ')
          if (!productNames && currentTask.plan_snapshot) {
            productNames = Object.values(currentTask.plan_snapshot)
              .map(s => nomenclatures.find(n => String(n.id) === String(s.id))?.name || s.name)
              .filter(Boolean)
              .join(', ')
          }

          return (
            <div>
              <div style={{ borderBottom: '1px solid #1a1a1a', paddingBottom: '20px', marginBottom: '25px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#3b82f6', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '5px' }}>
                      <Clock size={14} /> Звіт по виробництву цеху №1
                    </div>
                    <h3 style={{ fontSize: '1.8rem', fontWeight: 950, margin: 0 }}>
                      Наряд №{currentOrder?.order_num}{currentTask.batch_index ? `/${currentTask.batch_index}` : ''}
                    </h3>
                  </div>
                  <button
                    onClick={() => handleOpenReport(currentTask, currentOrder, reportData.taskCards, true)}
                    disabled={reportLoading}
                    style={{
                      background: '#1a1a24', border: '1px solid #3b82f640', color: '#3b82f6',
                      padding: '8px 14px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 900,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                      boxShadow: '0 4px 12px rgba(59,130,246,0.1)'
                    }}
                  >
                    <RefreshCw size={12} className={reportLoading ? "animate-spin" : ""} /> ОНОВИТИ ДАНІ
                  </button>
                </div>
                <div style={{ color: '#aaa', fontSize: '0.9rem', marginTop: '6px', fontWeight: 700 }}>
                  Виріб: <strong style={{ color: '#ef4444' }} className="text-accent-red">{productNames || '—'}</strong>
                  {currentOrder?.customer && ` | Замовник: ${currentOrder.customer}`}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '15px', marginBottom: '30px' }}>
                <div style={{ background: '#111', border: '1px solid #222', borderRadius: '16px', padding: '15px' }}>
                  <div style={{ color: '#888', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>Фрези (Розкрій)</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', borderBottom: '1px solid #222', paddingBottom: '6px' }}>
                      <span>Потреба: <strong style={{ color: '#fff' }}>{totalPlannedCutters} шт</strong></span>
                      <span>Факт: <strong style={{ color: '#eab308' }} className="text-accent-orange">{totalActualCutters} шт</strong></span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {(() => {
                        const allCutterNames = Array.from(new Set([
                          ...Object.keys(plannedCuttersBreakdown),
                          ...Object.keys(actualCuttersBreakdown)
                        ]))
                        if (allCutterNames.length === 0) {
                          return <div style={{ fontSize: '0.65rem', color: '#444', textAlign: 'center' }}>Немає витрат фрез</div>
                        }
                        return allCutterNames.map(name => {
                          const planVal = plannedCuttersBreakdown[name] || 0
                          const factVal = actualCuttersBreakdown[name] || 0
                          const isExcess = factVal > planVal
                          return (
                            <div key={name} style={{ fontSize: '0.68rem', borderBottom: '1px solid #1a1a1a', paddingBottom: '4px' }}>
                              <div style={{ color: isExcess ? '#ef4444' : '#aaa', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={name} className={isExcess ? 'text-accent-red' : ''}>
                                {isExcess && '⚠️ '}{name}
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px', color: '#888' }}>
                                <span>Потреба: <strong style={{ color: '#bbb' }}>{planVal} шт</strong></span>
                                <span>Факт: <strong style={{ color: isExcess ? '#ef4444' : '#bbb' }} className={isExcess ? 'text-accent-red' : 'text-accent-orange'}>{factVal} шт</strong></span>
                              </div>
                            </div>
                          )
                        })
                      })()}
                    </div>
                  </div>
                </div>

                <div style={{ background: '#111', border: '1px solid #222', borderRadius: '16px', padding: '15px' }}>
                  <div style={{ color: '#888', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>Листи (Матеріал)</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', borderBottom: '1px solid #222', paddingBottom: '6px' }}>
                      <span>План: <strong style={{ color: '#fff' }}>{totalPlannedSheets} л.</strong></span>
                      <span>Факт: <strong style={{ color: totalActualSheets > totalPlannedSheets ? '#ef4444' : '#10b981' }} className={totalActualSheets > totalPlannedSheets ? 'text-accent-red' : 'text-accent-green'}>{totalActualSheets} л.</strong></span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {Object.entries(materialStats).length > 0 ? (
                        Object.entries(materialStats).map(([matName, stats]) => {
                          const isExcess = stats.actualSheets > stats.plannedSheets
                          return (
                            <div key={matName} style={{ fontSize: '0.68rem', borderBottom: '1px solid #1a1a1a', paddingBottom: '4px' }}>
                              <div style={{ color: isExcess ? '#ef4444' : '#aaa', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={matName} className={isExcess ? 'text-accent-red' : ''}>
                                {isExcess && '⚠️ '}{matName}
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px', color: '#888' }}>
                                <span>План: <strong style={{ color: '#bbb' }}>{stats.plannedSheets} л.</strong></span>
                                <span>Факт: <strong style={{ color: isExcess ? '#ef4444' : '#bbb' }} className={isExcess ? 'text-accent-red' : 'text-accent-green'}>{stats.actualSheets} л.</strong></span>
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <div style={{ color: '#444', fontSize: '0.65rem', fontStyle: 'italic' }}>Немає запланованих матеріалів</div>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ background: '#111', border: '1px solid #222', borderRadius: '16px', padding: '15px' }}>
                  <div style={{ color: '#888', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>Деталі та Брак</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#aaa', fontSize: '0.9rem', fontWeight: 500 }}>План:</span>
                      <strong style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700 }}>{totalPlannedParts} шт</strong>
                    </div>

                    <div
                      onClick={() => setReportDetailModal('accepted')}
                      style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'opacity 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.opacity = 0.8}
                      onMouseLeave={e => e.currentTarget.style.opacity = 1}
                      title="Клікніть для деталізації прийнятих деталей"
                    >
                      <span style={{ color: '#aaa', fontSize: '0.9rem', fontWeight: 500 }}>Прийнято:</span>
                      <strong
                        style={{
                          color: '#10b981',
                          fontSize: '0.9rem',
                          fontWeight: 700,
                          borderBottom: '1px dashed #10b981',
                          paddingBottom: '1px'
                        }}
                        className="text-accent-green"
                      >
                        {totalActualParts} шт
                      </strong>
                    </div>

                    <div
                      onClick={() => setReportDetailModal('scrap')}
                      style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'opacity 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.opacity = 0.8}
                      onMouseLeave={e => e.currentTarget.style.opacity = 1}
                      title="Клікніть для деталізації браку за етапами"
                    >
                      <span style={{ color: '#aaa', fontSize: '0.9rem', fontWeight: 500 }}>Брак:</span>
                      <strong
                        style={{
                          color: '#ef4444',
                          fontSize: '0.9rem',
                          fontWeight: 700,
                          borderBottom: '1px dashed #ef4444',
                          paddingBottom: '1px'
                        }}
                        className="text-accent-red"
                      >
                        {totalScrap} шт
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {(() => {
                const timeStats = {
                  totalShop1: 0,
                  stages: { 'Розкрій': { total: 0, count: 0 }, 'Галтовка': { total: 0, count: 0 }, 'Прийомка': { total: 0, count: 0 }, 'Сортування': { total: 0, count: 0 } },
                  buffers: { 'Буфер Розкрою': { total: 0, count: 0 }, 'Буфер Галтовки': { total: 0, count: 0 }, 'Буфер Прийомки': { total: 0, count: 0 }, 'Буфер Сортування': { total: 0, count: 0 } }
                }

                let firstStart = null
                let lastCompleted = null

                reportData.historyRows.forEach(row => {
                  if (row.started_at) {
                    const sTime = new Date(row.started_at)
                    if (!firstStart || sTime < firstStart) firstStart = sTime
                  }
                  if (row.completed_at) {
                    const cTime = new Date(row.completed_at)
                    if (!lastCompleted || cTime > lastCompleted) lastCompleted = cTime
                  }

                  if (row.started_at && row.completed_at) {
                    const diff = new Date(row.completed_at) - new Date(row.started_at)
                    const sec = diff > 0 ? Math.round(diff / 1000) : 0

                    if (timeStats.stages[row.stage_name]) {
                      timeStats.stages[row.stage_name].total += sec
                      timeStats.stages[row.stage_name].count += 1
                    } else if (row.stage_name?.startsWith('Галтовка')) {
                      timeStats.stages['Галтовка'].total += sec
                      timeStats.stages['Галтовка'].count += 1
                    } else if (timeStats.buffers[row.stage_name]) {
                      timeStats.buffers[row.stage_name].total += sec
                      timeStats.buffers[row.stage_name].count += 1
                    } else if (row.stage_name?.startsWith('Буфер Галтовки')) {
                      timeStats.buffers['Буфер Галтовки'].total += sec
                      timeStats.buffers['Буфер Галтовки'].count += 1
                    }
                  }
                })

                if (firstStart && lastCompleted) {
                  timeStats.totalShop1 = Math.max(0, Math.round((lastCompleted - firstStart) / 1000))
                }

                const totalActiveSec = Object.values(timeStats.stages).reduce((sum, s) => sum + s.total, 0)
                const totalBufferSec = Object.values(timeStats.buffers).reduce((sum, b) => sum + b.total, 0)
                const activeCardIds = new Set(reportData.historyRows.map(h => h.card_id))
                const numCards = activeCardIds.size || reportData.taskCards.length || 1

                return (
                  <div style={{ background: '#111', border: '1px solid #222', borderRadius: '20px', padding: '20px', marginBottom: '30px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '15px' }}>
                      <Clock size={14} /> Аналітика перебування деталей в Цеху №1
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                      <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '14px', padding: '15px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                        <div style={{ color: '#888', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>Загальний час у Цеху №1</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 1000, color: '#10b981' }} className="text-accent-green">
                          {timeStats.totalShop1 > 0 ? formatDurationHMS(timeStats.totalShop1) : '—'}
                        </div>
                        <div style={{ fontSize: '0.6rem', color: '#555', marginTop: '4px', borderBottom: '1px solid #222', paddingBottom: '8px', width: '100%' }}>Від першого розкрою до передачі в Цех №2</div>

                        <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: '8px', width: '100%', display: 'flex', flexDirection: 'column', gap: '5px', textAlign: 'left' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#888' }}>Сер. робота / картку:</span>
                            <strong style={{ color: '#3b82f6' }} className="text-accent-blue">{formatDurationHMS(Math.round(totalActiveSec / numCards))}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#888' }}>Сер. буфер / картку:</span>
                            <strong style={{ color: '#f59e0b' }} className="text-accent-orange">{formatDurationHMS(Math.round(totalBufferSec / numCards))}</strong>
                          </div>
                        </div>
                      </div>

                      <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '14px', padding: '15px' }}>
                        <div style={{ color: '#888', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid #111', paddingBottom: '4px' }}>Робочі етапи (Активна робота)</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem' }}>
                          {Object.entries(timeStats.stages).filter(([name]) => name !== 'Прийомка').map(([name, s]) => (
                            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: '#aaa', fontWeight: 600 }}>{name}:</span>
                              <strong style={{ color: '#3b82f6' }} className="text-accent-blue">{s.total > 0 ? formatDurationHMS(s.total) : '00год. 00хв. 00с'}</strong>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '14px', padding: '15px' }}>
                        <div style={{ color: '#888', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid #111', paddingBottom: '4px' }}>Буфери накопичення (Зараз)</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem' }}>
                          {['Розкрій', 'Галтовка', 'Прийомка', 'Сортування'].map(stageName => {
                            const bufCards = workCards.filter(c =>
                              String(c.task_id) === String(currentTask.id) &&
                              c.status === 'at-buffer' &&
                              (stageName === 'Галтовка' ? c.operation?.startsWith('Галтовка') : c.operation === stageName)
                            )
                            const totalQty = bufCards.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
                            const cardCount = bufCards.length
                            const bufferNameMap = { 'Розкрій': 'Буфер Розкрою', 'Галтовка': 'Буфер Галтовки', 'Прийомка': 'Буфер Прийомки', 'Сортування': 'Буфер Сортування' }
                            const bufKey = bufferNameMap[stageName]
                            const bufferTotal = timeStats.buffers[bufKey]?.total || 0
                            return (
                              <div key={stageName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #151515', paddingBottom: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ color: '#aaa', fontWeight: 600 }}>Буфер {stageName}:</span>
                                  {cardCount > 0 && (
                                    <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                                      Зараз: {totalQty} шт
                                    </span>
                                  )}
                                </div>
                                <strong style={{ color: '#f59e0b' }} className="text-accent-orange">
                                  {bufferTotal > 0 ? formatDurationHMS(bufferTotal) : '00год. 00хв. 00с'}
                                </strong>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 900, margin: 0, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Хронологічний лог етапів
                </h4>

                <div style={{ display: 'flex', gap: '4px', background: '#0a0a0a', padding: '4px', borderRadius: '10px', border: '1px solid #222' }} className="no-print">
                  {['All', 'Розкрій', 'Галтовка', 'Прийомка', 'Сортування'].map(stage => {
                    const isSelected = reportStageFilter === stage
                    let color = '#555'
                    let bg = 'transparent'
                    if (isSelected) {
                      color = '#fff'
                      bg = stage === 'All' ? '#222' : stage === 'Розкрій' ? '#3b82f6' : stage === 'Галтовка' ? '#eab308' : '#10b981'
                    }
                    const labelMap = { 'All': 'Всі етапи', 'Розкрій': 'Розкрій', 'Галтовка': 'Галтовка', 'Прийомка': 'Прийомка', 'Сортування': 'Сортування' }
                    return (
                      <button
                        key={stage}
                        onClick={() => {
                          setReportStageFilter(stage)
                          setReportOperatorFilter('All')
                        }}
                        style={{
                          border: 'none', background: bg, color: isSelected ? (stage === 'All' ? '#fff' : '#000') : color,
                          padding: '5px 12px', borderRadius: '7px', fontSize: '0.65rem', fontWeight: 900, cursor: 'pointer', transition: 'all 0.15s ease', textTransform: 'uppercase',
                          boxShadow: isSelected && stage !== 'All' ? `0 2px 8px ${bg}44` : 'none'
                        }}
                      >
                        {labelMap[stage]}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', flexWrap: 'wrap', alignItems: 'center' }} className="no-print">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.7rem', color: '#888', fontWeight: 800, textTransform: 'uppercase' }}>Деталь:</span>
                  <select
                    value={reportNomFilter}
                    onChange={e => setReportNomFilter(e.target.value)}
                    style={{
                      background: '#111',
                      border: '1px solid #333',
                      color: '#fff',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <option value="All">Всі деталі</option>
                    {(() => {
                      const uniqueNoms = []
                      ;(reportData.historyRows || []).forEach(row => {
                        if (row.nomenclature_id && !uniqueNoms.includes(row.nomenclature_id)) {
                          uniqueNoms.push(row.nomenclature_id)
                        }
                      })
                      return uniqueNoms.map(nomId => {
                        const nom = nomenclatures.find(n => String(n.id) === String(nomId))
                        return (
                          <option key={nomId} value={nomId}>
                            {nom?.name || `ID: ${nomId}`}
                          </option>
                        )
                      })
                    })()}
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.7rem', color: '#888', fontWeight: 800, textTransform: 'uppercase' }}>Сортування:</span>
                  <select
                    value={reportSortBy}
                    onChange={e => {
                      setReportSortBy(e.target.value)
                      if (e.target.value !== 'operator') {
                        setReportOperatorFilter('All')
                      }
                    }}
                    style={{
                      background: '#111',
                      border: '1px solid #333',
                      color: '#fff',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <option value="date">По даті (за замовчуванням)</option>
                    <option value="min-time">Найменший час</option>
                    <option value="max-time">Найбільший час</option>
                    <option value="operator">По оператору</option>
                    <option value="scrap">По кількості браку</option>
                  </select>
                </div>

                {reportSortBy === 'operator' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#888', fontWeight: 800, textTransform: 'uppercase' }}>Оператор:</span>
                    <select
                      value={reportOperatorFilter}
                      onChange={e => setReportOperatorFilter(e.target.value)}
                      style={{
                        background: '#111',
                        border: '1px solid #333',
                        color: '#fff',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      <option value="All">Всі оператори</option>
                      {(() => {
                        const uniqueOps = []
                        ;(reportData.historyRows || []).forEach(row => {
                          let stageMatch = false
                          if (reportStageFilter === 'All') stageMatch = true
                          else if (reportStageFilter === 'Прийомка') {
                            stageMatch = row.stage_name === 'Прийомка' || row.stage_name === 'completed'
                          } else {
                            stageMatch = row.stage_name === reportStageFilter
                          }
                          if (!stageMatch) return

                          if (row.operator_name && !uniqueOps.includes(row.operator_name)) {
                            uniqueOps.push(row.operator_name)
                          }
                        })
                        return uniqueOps.map(opName => (
                          <option key={opName} value={opName}>
                            {opName}
                          </option>
                        ))
                      })()}
                    </select>
                  </div>
                )}
              </div>

              {(() => {
                let processedRows = (reportData.historyRows || []).filter(row => {
                  let stageMatch = false
                  if (reportStageFilter === 'All') stageMatch = true
                  else if (reportStageFilter === 'Прийомка') {
                    stageMatch = row.stage_name === 'Прийомка' || row.stage_name === 'completed'
                  } else {
                    stageMatch = row.stage_name === reportStageFilter
                  }
                  if (!stageMatch) return false

                  if (reportNomFilter !== 'All' && String(row.nomenclature_id) !== String(reportNomFilter)) {
                    return false
                  }

                  if (reportSortBy === 'operator' && reportOperatorFilter !== 'All' && row.operator_name !== reportOperatorFilter) {
                    return false
                  }
                  return true
                })

                processedRows.sort((a, b) => {
                  if (reportSortBy === 'date') {
                    return new Date(a.started_at || a.created_at) - new Date(b.started_at || b.created_at)
                  }
                  if (reportSortBy === 'min-time') {
                    const durA = a.started_at && a.completed_at ? (new Date(a.completed_at) - new Date(a.started_at)) : 0
                    const durB = b.started_at && b.completed_at ? (new Date(b.completed_at) - new Date(b.started_at)) : 0
                    return durA - durB
                  }
                  if (reportSortBy === 'max-time') {
                    const durA = a.started_at && a.completed_at ? (new Date(a.completed_at) - new Date(a.started_at)) : 0
                    const durB = b.started_at && b.completed_at ? (new Date(b.completed_at) - new Date(b.started_at)) : 0
                    return durB - durA
                  }
                  if (reportSortBy === 'operator') {
                    return String(a.operator_name || '').localeCompare(String(b.operator_name || ''))
                  }
                  if (reportSortBy === 'scrap') {
                    return (Number(b.scrap_qty) || 0) - (Number(a.scrap_qty) || 0)
                  }
                  return 0
                })

                if (processedRows.length === 0) {
                  return (
                    <div style={{ padding: '30px', textAlign: 'center', background: '#111', borderRadius: '16px', color: '#555', fontSize: '0.85rem' }}>
                      Операцій для обраних фільтрів ще не проводилось.
                    </div>
                  )
                }

                return (
                  <div style={{ background: '#111', borderRadius: '18px', overflowX: 'auto', border: '1px solid #222' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left', minWidth: '850px' }}>
                      <thead>
                        <tr style={{ background: '#161616', color: '#888', textTransform: 'uppercase', fontSize: '0.6rem', fontWeight: 900, borderBottom: '1px solid #222' }}>
                          <th style={{ padding: '12px 15px' }}>Деталь / Картка</th>
                          <th style={{ padding: '12px 15px' }}>Час (початок / завершення)</th>
                          <th style={{ padding: '12px 15px', textAlign: 'center' }}>План. час</th>
                          <th style={{ padding: '12px 15px', textAlign: 'center' }}>Факт. час</th>
                          <th style={{ padding: '12px 15px' }}>Етап</th>
                          <th style={{ padding: '12px 15px' }}>Оператор / Зміна</th>
                          <th style={{ padding: '12px 15px' }}>Робоче місце</th>
                          <th style={{ padding: '12px 15px', textAlign: 'center' }}>Готово / Брак</th>
                          <th style={{ padding: '12px 15px', textAlign: 'center' }}>Фрези</th>
                        </tr>
                      </thead>
                      <tbody>
                        {processedRows.map((row, idx) => {
                          const startTime = row.started_at
                            ? new Date(row.started_at).toLocaleString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit' })
                            : '—'
                          const completedTime = row.completed_at
                            ? new Date(row.completed_at).toLocaleString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit' })
                            : '—'

                          const card = reportData.taskCards.find(c => c.id === row.card_id)
                          const planSec = card?.estimated_time || 0
                          const planStr = planSec > 0 ? formatDurationHMS(planSec) : '—'

                          let actualSeconds = 0
                          if (row.started_at && row.completed_at) {
                            const diff = new Date(row.completed_at) - new Date(row.started_at)
                            actualSeconds = Math.max(0, Math.round(diff / 1000))
                          }
                          const factStr = actualSeconds > 0 ? formatDurationHMS(actualSeconds) : '—'

                          const nom = nomenclatures.find(n => n.id === row.nomenclature_id)
                          const seqMatch = (row.card_info || card?.card_info || '').match(/(\d+\/\d+)/)
                          const seqStr = seqMatch ? seqMatch[1] : `ID: #${row.card_id?.slice(-8).toUpperCase()}`

                          return (
                            <tr key={row.id || idx} style={{ borderBottom: idx < processedRows.length - 1 ? '1px solid #222' : 'none' }}>
                              <td style={{ padding: '12px 15px' }}>
                                <div style={{ fontWeight: 800, color: '#fff' }}>{nom?.name || '—'}</div>
                                <div style={{ fontSize: '0.65rem', color: '#888', marginTop: '2px' }}>Картка {seqStr}</div>
                              </td>
                              <td style={{ padding: '12px 15px' }}>
                                <div style={{ color: '#888', fontWeight: 600 }}>{startTime}</div>
                                <div style={{ color: '#aaa', fontWeight: 700, marginTop: '2px' }}>{completedTime}</div>
                              </td>
                              <td style={{ padding: '12px 15px', textAlign: 'center', color: '#fff', fontWeight: 700 }}>{planStr}</td>
                              <td style={{ padding: '12px 15px', textAlign: 'center', color: '#3b82f6', fontWeight: 700 }}>{factStr}</td>
                              <td style={{ padding: '12px 15px' }}>
                                <span
                                  className={`stage-badge stage-${row.stage_name.startsWith('Буфер') ? 'buffer' :
                                    row.stage_name === 'Розкрій' ? 'cutting' :
                                      row.stage_name === 'Галтовка' ? 'tumbling' :
                                        (row.stage_name === 'Прийомка' || row.stage_name === 'completed') ? 'reception' : 'sorting'
                                      }`}
                                  style={{
                                    background: row.stage_name.startsWith('Буфер') ? '#a78bfa1e' : row.stage_name === 'Розкрій' ? '#3b82f61a' : row.stage_name === 'Галтовка' ? '#eab3081a' : row.stage_name === 'Прийомка' || row.stage_name === 'completed' ? '#10b9811a' : '#14b8a61a',
                                    color: row.stage_name.startsWith('Буфер') ? '#a78bfa' : row.stage_name === 'Розкрій' ? '#3b82f6' : row.stage_name === 'Галтовка' ? '#eab308' : row.stage_name === 'Прийомка' || row.stage_name === 'completed' ? '#10b981' : '#14b8a6',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    fontWeight: 900,
                                    fontSize: '0.7rem',
                                    border: row.stage_name.startsWith('Буфер') ? '1px solid #a78bfa33' : 'none'
                                  }}
                                >
                                  {row.stage_name === 'completed' ? 'Прийомка' : row.stage_name}
                                </span>
                              </td>
                              <td style={{ padding: '12px 15px' }}>
                                <div style={{ color: '#fff', fontWeight: 800 }}>{row.operator_name}</div>
                                <div style={{ color: '#555', fontSize: '0.65rem' }}>{row.shift_name}</div>
                                {(() => {
                                  const replacedMatch = row.card_info?.match(/\[REPLACED_BY:(.*?)\]/)
                                  if (replacedMatch) {
                                    return (
                                      <div style={{ color: '#f59e0b', fontSize: '0.65rem', marginTop: '4px', fontWeight: 700 }}>
                                        ↳ Замінено на: {replacedMatch[1]}
                                      </div>
                                    )
                                  }
                                  return null
                                })()}
                              </td>
                              <td style={{ padding: '12px 15px', color: '#888' }}>
                                {row.machine_name || row.machine || '—'}
                              </td>
                              <td style={{ padding: '12px 15px', textAlign: 'center' }}>
                                <strong style={{ color: '#10b981' }}>{row.qty_completed} шт</strong>
                                {Number(row.scrap_qty) > 0 && (
                                  <div style={{ color: '#ef4444', fontSize: '0.7rem', marginTop: '2px', fontWeight: 700 }}>брак: {row.scrap_qty} шт</div>
                                )}
                              </td>
                              <td style={{ padding: '12px 15px', textAlign: 'center', color: row.cutters_used > 0 ? '#eab308' : '#444', fontWeight: 900 }}>
                                {row.cutters_used > 0 ? `${row.cutters_used} шт` : '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              })()}

              <div style={{ marginTop: '25px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }} className="print-actions-row">
                <button
                  onClick={() => window.print()}
                  style={{
                    background: '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '10px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.85rem'
                  }}
                >
                  <Printer size={14} /> Друкувати звіт
                </button>
                <button
                  onClick={() => setShowReportModal(false)}
                  style={{
                    background: '#222',
                    color: '#fff',
                    border: '1px solid #333',
                    padding: '10px 20px',
                    borderRadius: '10px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  Закрити
                </button>
              </div>
            </div>
          )
        })() : null}
      </div>

      {/* Detail breakdown modals */}
      {reportDetailModal && (
        <div
          className="no-print"
          onClick={() => setReportDetailModal(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            zIndex: 45000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#0d0d0d',
              border: '1px solid #222',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '550px',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '25px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
              position: 'relative',
              color: '#fff'
            }}
          >
            <button
              onClick={() => setReportDetailModal(null)}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: '#222',
                border: 'none',
                color: '#fff',
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={16} />
            </button>

            {reportDetailModal === 'accepted' ? (() => {
              const acceptedMap = {}
              const acceptedRows = (reportData?.historyRows || []).filter(h => h.stage_name === 'Прийомка' || h.stage_name === 'completed')

              acceptedRows.forEach(row => {
                const nomId = String(row.nomenclature_id)
                if (!acceptedMap[nomId]) {
                  const nom = nomenclatures.find(n => String(n.id) === nomId)
                  acceptedMap[nomId] = {
                    name: nom?.name || 'Невідома деталь',
                    code: nom?.nomenclature_code || 'БЕЗ КОДУ',
                    qty: 0
                  }
                }
                acceptedMap[nomId].qty += (Number(row.qty_completed) || 0)
              })

              const items = Object.values(acceptedMap).sort((a, b) => b.qty - a.qty)

              return (
                <div>
                  <h3 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981' }}>
                    <CheckCircle2 size={20} /> Деталізація прийнятих деталей
                  </h3>
                  {items.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>Деталей ще не прийнято</div>
                  ) : (
                    <div style={{ background: '#111', borderRadius: '14px', border: '1px solid #222', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: '#161616', color: '#666', borderBottom: '1px solid #222', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase' }}>
                            <th style={{ padding: '10px 12px' }}>Деталь</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right' }}>Прийнято</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, idx) => (
                            <tr key={idx} style={{ borderBottom: idx < items.length - 1 ? '1px solid #1a1a1a' : 'none' }}>
                              <td style={{ padding: '10px 12px' }}>
                                <div style={{ fontWeight: 800, color: '#fff' }}>{item.name}</div>
                                <div style={{ fontSize: '0.65rem', color: '#555', marginTop: '2px' }}>{item.code}</div>
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, color: '#10b981', fontSize: '0.9rem' }}>
                                {item.qty} шт
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })() : (() => {
              const scrapRows = (reportData?.historyRows || []).filter(h => (Number(h.scrap_qty) || 0) > 0)

              const items = scrapRows.map(row => {
                const nom = nomenclatures.find(n => String(n.id) === String(row.nomenclature_id))
                const dateStr = row.completed_at
                  ? new Date(row.completed_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(row.completed_at).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })
                  : '—'
                return {
                  name: nom?.name || 'Невідома деталь',
                  code: nom?.nomenclature_code || 'БЕЗ КОДУ',
                  stage: row.stage_name === 'completed' ? 'Прийомка' : row.stage_name,
                  qty: Number(row.scrap_qty) || 0,
                  operator: row.operator_name || '—',
                  shift: row.shift_name || '—',
                  machine: row.machine_name || '—',
                  time: dateStr
                }
              }).sort((a, b) => b.qty - a.qty)

              return (
                <div>
                  <h3 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
                    <AlertTriangle size={20} /> Деталізація браку за етапами
                  </h3>
                  {items.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>Бракованих деталей немає</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {items.map((item, idx) => (
                        <div key={idx} style={{ background: '#111', border: '1px solid #222', borderRadius: '12px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginRight: '15px' }}>
                            <div style={{ fontWeight: 800, color: '#fff', fontSize: '0.8rem' }}>{item.name}</div>
                            <div style={{ fontSize: '0.65rem', color: '#555', marginTop: '2px' }}>{item.code}</div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '6px', fontSize: '0.65rem', color: '#888', flexWrap: 'wrap' }}>
                              <span>Етап: <strong style={{ color: '#aaa' }}>{item.stage}</strong></span>
                              {item.machine && item.machine !== '—' && (
                                <span>Верстат: <strong style={{ color: '#aaa' }}>{item.machine}</strong></span>
                              )}
                              <span>Оператор: <strong style={{ color: '#aaa' }}>{item.operator}</strong></span>
                            </div>
                          </div>
                          <div style={{ color: '#ef4444', fontWeight: 900, fontSize: '1rem', whiteSpace: 'nowrap' }}>
                            {item.qty} шт
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
