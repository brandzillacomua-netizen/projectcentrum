import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import {
  ListTodo, Tablet, Loader2, X, Printer, Clock, AlertTriangle, CheckCircle2, Layers, Menu, ArrowRight
} from 'lucide-react'
import { countAsProduced } from '../hooks/useForemanData'

export function ForemanTaskDetails({
  activeTaskId,
  setActiveTaskId,
  activeView,
  setActiveView,
  selectedMachines,
  setSelectedMachines,
  rowCapacities,
  setRowCapacities,
  editingSplits,
  setEditingSplits,
  genModal,
  setGenModal,
  printQueue,
  setPrintQueue,
  partialCounts,
  setPartialCounts,
  isGenerating,
  setIsGenerating,
  isCompletingTask,
  setIsCompletingTask,
  currentPage,
  setCurrentPage,
  expandedGroups,
  setExpandedGroups,
  changeMachineTaskId,
  setChangeMachineTaskId,
  selectedNewMachine,
  setSelectedNewMachine,
  changeNomMachineTaskId,
  setChangeNomMachineTaskId,
  changeNomMachineNomId,
  setChangeNomMachineNomId,
  changeNomMachineName,
  setChangeNomMachineName,
  selectedNomNewMachine,
  setSelectedNomNewMachine,
  printNaryadQueue,
  setPrintNaryadQueue,
  naryadPrintLoading,
  setNaryadPrintLoading,
  customAlert,
  setCustomAlert,
  // Hooks data
  archiveCards,
  taskHistory,
  staticCompletedCards,
  staticHistory,
  taskCardsCountMap,
  taskReadinessMap,
  taskShortageMap,
  cachedShortageMap,
  productionCache,
  scrapCache,
  redoCache,
  allCardsCache,
  getDisplayPartsForOrderItem,
  getBOMParts,
  // MES context data & actions
  tasks,
  orders,
  allOrdersMap,
  nomenclatures,
  inventory,
  workCards,
  machines,
  machineOperations,
  materialRequests,
  currentUser,
  // Shared actions
  handleResolveCall,
  handleOpenReport,
  handleOpenNaryadPrint,
  handleChangeTaskMachine,
  handleUpdateNomenclatureMachineAndRecalculate,
  handleCompleteShop1Task,
  handleGenerateFromWorksheet,
  activeCalls,
  getRequestQty,
  getDisplayMaterial
}) {
  const [customLoadingCapacities, setCustomLoadingCapacities] = useState({})
  const [expandedArchiveMachines, setExpandedArchiveMachines] = useState({})
  const MACHINE_TYPES = [
    'CNC 1200x800 - 4 листи (Малий)',
    'CNC 3050(16)х16 - 3-12 листів (швидкісний)',
    'CNC 3060х1600 - 3-36 листів (Три Головий)',
    'CNC 6000x2000 - 4 - 96 листів (Дракон)',
    'CNC KE XIN - 4 - 16 листів (ФЕЯ)'
  ]

  const getStandardMachineType = (name) => {
    if (!name || name === 'Не вказано') return ''
    const normName = name.toLowerCase()
    const directMatch = MACHINE_TYPES.find(t => t.toLowerCase() === normName)
    if (directMatch) return directMatch
    if (normName.includes('12x8') || normName.includes('1200x800') || normName.includes('малий')) {
      return 'CNC 1200x800 - 4 листи (Малий)'
    }
    if (normName.includes('16x16') || normName.includes('3050(16)') || normName.includes('швидкісний') || normName.includes('3050x1600') || normName.includes('3050х1600') || normName.includes('3050')) {
      return 'CNC 3050(16)х16 - 3-12 листів (швидкісний)'
    }
    if (normName.includes('30x16') || normName.includes('3060x1600') || normName.includes('3060х1600') || normName.includes('три головий') || normName.includes('триголовий')) {
      return 'CNC 3060х1600 - 3-36 листів (Три Головий)'
    }
    if (normName.includes('60x20') || normName.includes('6000x2000') || normName.includes('дракон')) {
      return 'CNC 6000x2000 - 4 - 96 листів (Дракон)'
    }
    if (normName.includes('ke xin') || normName.includes('фея')) {
      return 'CNC KE XIN - 4 - 16 листів (ФЕЯ)'
    }
    const partial = MACHINE_TYPES.find(t => t.toLowerCase().includes(normName) || normName.includes(t.toLowerCase()))
    if (partial) return partial
    return ''
  }

  const findMachine = (name) => {
    if (!name || name === 'Не вказано') return null
    const baseName = name.split(' №')[0].trim()
    let found = machines.find(m => m.name === baseName)
      || machines.find(m => m.name === name)
      || machines.find(m => m.type === baseName)
      || machines.find(m => m.type === name)
    if (!found) {
      const baseNameLower = baseName.toLowerCase()
      if (baseNameLower.includes('12x8') || baseNameLower.includes('1200x800') || baseNameLower.includes('малий')) {
        found = { sheet_capacity: 4, name: 'CNC 1200x800 - 4 листи (Малий)' }
      } else if (baseNameLower.includes('16x16') || baseNameLower.includes('3050(16)') || baseNameLower.includes('швидкісний') || baseNameLower.includes('3050x1600') || baseNameLower.includes('3050х1600') || baseNameLower.includes('3050')) {
        found = { sheet_capacity: 12, name: 'CNC 3050(16)х16 - 3-12 листів (швидкісний)' }
      } else if (baseNameLower.includes('30x16') || baseNameLower.includes('3060x1600') || baseNameLower.includes('3060х1600') || baseNameLower.includes('три головий') || baseNameLower.includes('триголовий')) {
        found = { sheet_capacity: 36, name: 'CNC 3060х1600 - 3-36 листів (Три Головий)' }
      } else if (baseNameLower.includes('60x20') || baseNameLower.includes('6000x2000') || baseNameLower.includes('дракон')) {
        found = { sheet_capacity: 96, name: 'CNC 6000x2000 - 4 - 96 листів (Дракон)' }
      } else if (baseNameLower.includes('ke xin') || baseNameLower.includes('фея')) {
        found = { sheet_capacity: 16, name: 'CNC KE XIN - 4 - 16 листів (ФЕЯ)' }
      }
    }

    if (found) {
      const result = { ...found }
      const searchName = ((result.name || '') + ' ' + (name || '')).replace(/\d+\s*[xх\*×]\s*\d+/gi, '')
      const match = searchName.match(/(\d+)\s*-\s*(\d+)\s*лист/i)
      if (match) {
        result.min_capacity = parseInt(match[1])
        result.max_capacity = parseInt(match[2])
      } else {
        const matchSingle = searchName.match(/(\d+)\s*лист/i)
        if (matchSingle) {
          result.min_capacity = parseInt(matchSingle[1])
          result.max_capacity = parseInt(matchSingle[1])
        } else {
          const bnl = searchName.toLowerCase()
          if (bnl.includes('12x8') || bnl.includes('1200x800') || bnl.includes('малий')) {
            result.min_capacity = 1; result.max_capacity = 4;
          } else if (bnl.includes('16x16') || bnl.includes('3050(16)') || bnl.includes('швидкісний') || bnl.includes('3050x1600') || bnl.includes('3050х1600') || bnl.includes('3050')) {
            result.min_capacity = 3; result.max_capacity = 12;
          } else if (bnl.includes('30x16') || bnl.includes('3060x1600') || bnl.includes('3060х1600') || bnl.includes('три головий') || bnl.includes('триголовий')) {
            result.min_capacity = 3; result.max_capacity = 36;
          } else if (bnl.includes('60x20') || bnl.includes('6000x2000') || bnl.includes('дракон')) {
            result.min_capacity = 4; result.max_capacity = 96;
          } else if (bnl.includes('ke xin') || bnl.includes('фея')) {
            result.min_capacity = 4; result.max_capacity = 16;
          } else {
            result.min_capacity = result.sheet_capacity || 1
            result.max_capacity = result.sheet_capacity || 1
          }
        }
      }
      if (result.min_capacity > result.max_capacity || result.min_capacity >= 100) {
        const bnl = searchName.toLowerCase()
        if (bnl.includes('1200x800') || bnl.includes('малий') || bnl.includes('12x8')) {
          result.min_capacity = 1;
          result.max_capacity = 4;
        }
      }
      return result
    }
    return null
  }

  const debouncedUpdateSplits = (task, nomId, newSplits) => {
    // Immediate save timeout logic
    handleUpdateNomenclatureMachineAndRecalculate(task, nomId, null, newSplits)
  }

  if (!activeTaskId) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', opacity: 0.1 }}>
        <ListTodo size={120} />
        <h3>Оберіть наряд зі списку зліва</h3>
      </div>
    )
  }

  const task = tasks.find(t => t.id === activeTaskId)
  if (!task) return <div style={{ padding: '20px', color: '#888', fontSize: '0.9rem' }}>Завдання не знайдено або завантажується...</div>
  const order = task.orders || orders.find(o => o.id === task.order_id) || allOrdersMap[task.order_id]
  const activeTaskCards = workCards.filter(c => c.task_id === task.id)
  const taskCards = [...activeTaskCards, ...(archiveCards || []).filter(c => c.task_id === task.id && !activeTaskCards.some(ac => ac.id === c.id))]
  const isReworkOrder = order?.order_num?.startsWith('ВБ')

  let productNames = order?.order_items?.map(it => nomenclatures.find(n => n.id === it.nomenclature_id)?.name).filter(Boolean).join(', ')
  if (!productNames && task.plan_snapshot) {
    productNames = Object.values(task.plan_snapshot)
      .map(s => nomenclatures.find(n => String(n.id) === String(s.id))?.name || s.name)
      .filter(Boolean)
      .join(', ')
  }

  const isTaskComplete = order?.order_items?.every(item => {
    const rows = getDisplayPartsForOrderItem(task, item)
    const shop1Parts = rows.filter(r => r.nom?.type === 'part')
    return shop1Parts.every(part => {
      const snapshot = task.plan_snapshot?.[String(part.nom?.id)]
      const need = snapshot ? snapshot.need : (Number(item.quantity) * (Number(part.quantity_per_parent) || 1))
      const produced = taskCards
        .filter(c => String(c.nomenclature_id) === String(part.nom?.id))
        .reduce((sum, c) => sum + (countAsProduced(c) ? Number(c.quantity) : 0), 0)
      return produced >= need
    })
  })

  const isReady = taskReadinessMap[task.id]
  const isShortage = taskShortageMap[task.id] || cachedShortageMap[task.id] || false
  const taskCardsCount = taskCardsCountMap[task.id] || 0
  const isNew = task.status !== 'completed' && taskCardsCount === 0
  const isInProgress = task.status !== 'completed' && taskCardsCount > 0 && !isReady && !isShortage

  return (
    <div style={{ padding: '20px' }}>
      {/* Active Machine Calls Widget */}
      {activeCalls.length > 0 && (
        <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '16px', padding: '15px 20px', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '0.85rem', fontWeight: 900, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="pulse-indicator" style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444' }} />
            АКТИВНІ ВИКЛИКИ ДО ВЕРСТАТІВ ({activeCalls.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {activeCalls.map(c => {
              const mach = machines?.find(m => m.id === c.machine_id)
              return (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111', border: '1px solid #222', borderRadius: '12px', padding: '12px 15px', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff' }}>
                      {mach ? mach.name : 'Верстат'} (пор. №{mach?.sequence_number || '—'})
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>
                      Локація: {mach?.floor || '—'} поверх | Викликав: {c.operator_name || 'Оператор'}
                      {c.called_employee_name && <span style={{ color: '#8b5cf6', fontWeight: 800 }}> | Цільовий для: {c.called_employee_name}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#666', fontWeight: 700 }}>
                      {new Date(c.created_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button
                      onClick={() => handleResolveCall(c.id)}
                      style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}
                    >
                      Я йду
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ marginBottom: '30px', display: 'flex', gap: '20px', borderBottom: '1px solid #1a1a1a', paddingBottom: '10px' }}>
        <button
          onClick={() => setActiveView('worksheet')}
          style={{ background: 'transparent', border: 'none', color: activeView === 'worksheet' ? '#ef4444' : '#555', fontSize: '0.85rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: activeView === 'worksheet' ? '2px solid #ef4444' : '2px solid transparent', paddingBottom: '10px', transition: '0.2s' }}
        >
          <ListTodo size={18} /> РОБОЧІ НАРЯДИ
        </button>
        <Link
          to="/shop1"
          style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid #eab308', color: '#eab308', fontSize: '0.8rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 15px', borderRadius: '10px', textDecoration: 'none', marginLeft: 'auto' }}
        >
          <Tablet size={16} /> ВІДКРИТИ ТЕРМІНАЛ ЦЕХУ
        </Link>
      </div>

      <div style={{ maxWidth: '1200px' }} className="anim-fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '2.4rem', fontWeight: 950, margin: 0, display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                Наряд №{order?.order_num}{task.batch_index ? `/${task.batch_index}` : ''}
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
                  onClick={() => {
                    const url = new URL(window.location.href)
                    url.searchParams.delete('task')
                    url.searchParams.set('task', task.id)
                    navigator.clipboard.writeText(url.toString())
                    alert('Посилання скопійовано!')
                  }}
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
                onClick={() => handleOpenReport(task, order, taskCards)}
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
              <div>ВИРІБ: <strong style={{ color: '#ef4444' }}>{productNames || '—'}</strong> | {order?.customer}</div>
              {task.batch_index && (
                <span style={{ background: '#eab308', color: '#000', padding: '2px 8px', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 900 }}>
                  ПАРТІЯ №{task.batch_index}
                </span>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#555' }}>ВЕРСТАТ:</span>
                <span className="machine-name-display">{task.machine_name || 'Не вказано'}</span>
              </div>
            </div>
          </div>
          {(isTaskComplete || task.status === 'completed') && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {task.status !== 'completed' && (
                <button
                  onClick={() => handleCompleteShop1Task(task.id)}
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
        </div>

        {/* Worksheet Table */}
        <div style={{ marginBottom: '40px', background: '#111', borderRadius: '20px', overflow: 'hidden', border: '1px solid #222' }}>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
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
                {order?.order_items?.flatMap(item => {
                  const rows = getDisplayPartsForOrderItem(task, item).filter(r => r.nom?.type === 'part')

                  return rows.map((part, idx) => {
                    const rowId = `${item.id}-${part.nom?.id || idx}`
                    const nomId = part.nom?.id

                    let need, stockBZ, plan, unitsPerSheet, sheets
                    const snapshot = task.plan_snapshot?.[String(nomId)]

                    if (snapshot) {
                      need = snapshot.need
                      stockBZ = snapshot.stock
                      plan = snapshot.plan
                      unitsPerSheet = snapshot.units_per_sheet
                      sheets = snapshot.sheets
                    } else {
                      need = (Number(item.quantity) || 0) * (Number(part.quantity_per_parent) || 1)
                      const bzInv = (inventory || []).find(i => String(i.nomenclature_id) === String(nomId) && i.type === 'bz' && (!i.pocket_owner || i.pocket_owner === 'Не вказано'))
                      stockBZ = bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0
                      plan = Math.max(0, need - stockBZ)
                      unitsPerSheet = Number(part.nom?.units_per_sheet) || 1
                      sheets = Math.ceil(plan / unitsPerSheet)
                    }

                    const existing = taskCards.filter(c => String(c.nomenclature_id) === String(nomId))
                    const productionCards = existing.filter(c => c.operation !== 'Склад БЗ')
                    const allRedos = existing.filter(c => c.operation !== 'Склад БЗ' && (c.card_info || '').includes('[REDO]'))
                    const redoCount = allRedos.length
                    const activeProductionCards = productionCards.filter(c => !(c.card_info || '').includes('[REDO]'))

                    const rawRowMachineName = ((task.plan_snapshot || {})[String(nomId)]?.machine || (task.plan_snapshot || {})[String(nomId)]?.selected_machine || selectedMachines[rowId] || '')
                      || (productionCards.length > 0 && productionCards[0].machine && productionCards[0].machine !== 'Не вказано' ? productionCards[0].machine : '')
                    const rowMachineName = getStandardMachineType(rawRowMachineName)

                    const splits = editingSplits[nomId] || (task.plan_snapshot || {})[String(nomId)]?.splits || []
                    const isSplitMode = splits.length > 0
                    const totalSheetsNeeded = sheets

                    const machineObjForCapacity = findMachine(rowMachineName)
                    const defaultCapacity = machineObjForCapacity?.min_capacity || machineObjForCapacity?.sheet_capacity || 1
                    const maxCapacity = machineObjForCapacity?.max_capacity || machineObjForCapacity?.sheet_capacity || 1
                    const requiresCapacityInput = !isSplitMode && plan > 0 && !!rowMachineName && defaultCapacity !== maxCapacity
                    const hasCapacityInput = rowCapacities[rowId] !== undefined && rowCapacities[rowId] !== ''
                    const isCapacityMissing = requiresCapacityInput && !hasCapacityInput
                    const rawCapacity = (rowCapacities[rowId] !== undefined && rowCapacities[rowId] !== '') ? rowCapacities[rowId] : defaultCapacity
                    const machineCapacity = Math.min(maxCapacity, Math.max(defaultCapacity, rawCapacity))

                    let generatedSheetsCalc = 0
                    activeProductionCards.forEach(c => generatedSheetsCalc += Math.ceil(Number(c.quantity) / (unitsPerSheet || 1)))
                    const remainingSheetsCalc = Math.max(0, sheets - generatedSheetsCalc)
                    
                    const baseLoads = rowMachineName ? (activeProductionCards.length + Math.ceil(remainingSheetsCalc / machineCapacity)) : (sheets || 0)
                    const loads = (plan === 0 && existing.some(c => c.operation === 'Склад БЗ')) ? 1 : baseLoads

                    let totalTargetLoads = loads
                    if (isSplitMode) {
                      totalTargetLoads = splits.reduce((sum, s) => {
                        const cap = findMachine(s.machine)?.sheet_capacity || 1
                        const sSheets = Number(s.sheets) || (unitsPerSheet > 0 ? Math.ceil((Number(s.qty) || 0) / unitsPerSheet) : 0)
                        return sum + Math.ceil(sSheets / cap)
                      }, 0)
                    }

                    const surplus = sheets > 0 ? Math.max(0, (sheets * unitsPerSheet) - plan) : 0

                    return (
                      <tr key={rowId} style={{ borderBottom: '1px solid #1a1a1a' }}>
                        <td style={{ padding: '10px 8px', minWidth: '170px' }}>
                          <div style={{ fontWeight: 800, color: '#fff', wordBreak: 'break-word', whiteSpace: 'normal' }}>{part.nom?.name || '—'}</div>
                          <div style={{ fontSize: '0.65rem', color: '#444' }}>{part.nom?.nomenclature_code || 'БЕЗ КОДУ'}</div>
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'center', color: '#666' }}>{need}</td>
                        {!isReworkOrder && (
                          <>
                            <td style={{ padding: '10px 4px', textAlign: 'center', color: '#666' }}>{stockBZ}</td>
                            <td style={{ padding: '10px 4px', textAlign: 'center', color: '#eab308', fontWeight: 900 }}>{plan}</td>
                          </>
                        )}
                        <td style={{ padding: '10px 6px', textAlign: 'center', color: '#aaa', fontSize: '0.75rem' }}>{getDisplayMaterial(part.nom, snapshot)}</td>
                        <td style={{ padding: '10px 4px', textAlign: 'center' }}>{unitsPerSheet}</td>
                        <td style={{ padding: '10px 4px', textAlign: 'center', color: '#10b981', fontWeight: 1000, fontSize: '1.1rem' }}>{sheets}</td>
                        <td style={{ padding: '10px 4px' }}>
                          {!isSplitMode ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', minWidth: '220px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
                                <div className={`machine-badge ${rowMachineName ? 'assigned' : 'unassigned'}`}>
                                  {rowMachineName || 'Оберіть тип верстата'}
                                </div>
                                {plan > 0 && (
                                  <button
                                    onClick={() => {
                                      setChangeNomMachineTaskId(task.id)
                                      setChangeNomMachineNomId(nomId)
                                      setChangeNomMachineName(part.nom?.name || 'Деталь')
                                      setSelectedNomNewMachine(rowMachineName || MACHINE_TYPES[0])
                                    }}
                                    style={{
                                      background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)',
                                      color: '#3b82f6', padding: '6px 10px', borderRadius: '8px', fontSize: '0.7rem',
                                      fontWeight: 900, cursor: 'pointer', transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '0.5px'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'}
                                  >
                                    ⚙️ Змінити верстат
                                  </button>
                                )}
                              </div>

                              {plan > 0 && rowMachineName && defaultCapacity !== maxCapacity && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                  <label style={{ fontSize: '0.6rem', color: '#666', fontWeight: 900, textTransform: 'uppercase' }}>Листів</label>
                                  <input
                                    type="number"
                                    title={`Листів за завантаження (від ${defaultCapacity} до ${maxCapacity})`}
                                    placeholder="Завант."
                                    value={rowCapacities[rowId] !== undefined ? rowCapacities[rowId] : ''}
                                    min={defaultCapacity}
                                    max={maxCapacity}
                                    readOnly={productionCards.length > 0 && productionCards.length >= totalTargetLoads}
                                    onChange={(e) => {
                                      if (productionCards.length > 0 && productionCards.length >= totalTargetLoads) return
                                      const v = parseInt(e.target.value)
                                      setRowCapacities(p => ({ ...p, [rowId]: isNaN(v) ? '' : v }))
                                    }}
                                    onBlur={(e) => {
                                      if (productionCards.length > 0 && productionCards.length >= totalTargetLoads) return
                                      let v = parseInt(e.target.value)
                                      if (isNaN(v)) {
                                        setRowCapacities(p => ({ ...p, [rowId]: '' }));
                                        return
                                      }
                                      v = Math.min(maxCapacity, Math.max(defaultCapacity, v));
                                      setRowCapacities(p => ({ ...p, [rowId]: v }));
                                    }}
                                    className={`capacity-input ${productionCards.length > 0 && productionCards.length >= totalTargetLoads ? 'disabled' : ''}`}
                                  />
                                </div>
                              )}
                            </div>) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {splits.map((s, sIdx) => {
                                const cap = findMachine(s.machine)?.sheet_capacity || 1
                                const sh = Math.ceil(Number(s.qty) / (unitsPerSheet || 1))
                                const l = Math.ceil(sh / cap)
                                return (
                                  <div key={sIdx} className="split-machine-item">
                                    <input
                                      type="number"
                                      value={(s.sheets || (unitsPerSheet > 0 ? Math.ceil((s.qty || 0) / unitsPerSheet) : 0)) || ''}
                                      placeholder="Л."
                                      onFocus={(e) => e.target.select()}
                                      onChange={(e) => {
                                        const newSplits = [...splits]
                                        const val = e.target.value === '' ? 0 : parseInt(e.target.value) || 0
                                        newSplits[sIdx].sheets = val
                                        newSplits[sIdx].qty = val * unitsPerSheet
                                        debouncedUpdateSplits(task, nomId, newSplits)
                                      }}
                                      onBlur={() => {
                                        handleUpdateNomenclatureMachineAndRecalculate(task, nomId, null, splits)
                                      }}
                                      className="split-sheets-input"
                                    />
                                    <select
                                      value={s.machine || ''}
                                      onChange={(e) => {
                                        const newSplits = [...splits]
                                        newSplits[sIdx].machine = e.target.value
                                        debouncedUpdateSplits(task, nomId, newSplits)
                                      }}
                                      className="split-machine-select"
                                    >
                                      <option value="">Тип верстата</option>
                                      {MACHINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                    <span style={{ fontSize: '0.65rem', color: '#444', fontWeight: 900, minWidth: '35px' }}>{l} завант.</span>
                                    <button
                                      onClick={() => {
                                        const newSplits = splits.filter((_, i) => i !== sIdx)
                                        handleUpdateNomenclatureMachineAndRecalculate(task, nomId, null, newSplits.length === 0 ? null : newSplits)
                                      }}
                                      style={{ background: 'transparent', border: 'none', color: '#444', cursor: 'pointer' }}
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                )
                              })}
                              <div style={{ display: 'flex', gap: '5px' }}>
                                <button
                                  onClick={() => {
                                    const currentSum = splits.reduce((a, b) => a + (Number(b.sheets) || (unitsPerSheet > 0 ? Math.ceil((Number(b.qty) || 0) / unitsPerSheet) : 0)), 0)
                                    const remaining = Math.max(0, totalSheetsNeeded - currentSum)
                                    const newSplits = [...splits, { machine: '', sheets: remaining, qty: remaining * unitsPerSheet }]
                                    handleUpdateNomenclatureMachineAndRecalculate(task, nomId, null, newSplits)
                                  }}
                                  style={{ flex: 1, background: '#111', border: '1px solid #222', color: '#555', fontSize: '0.6rem', padding: '5px', borderRadius: '6px', cursor: 'pointer', fontWeight: 800 }}
                                >
                                  + ДОДАТИ ВЕРСТАТ
                                </button>
                                <button
                                  onClick={() => handleUpdateNomenclatureMachineAndRecalculate(task, nomId, null, [])}
                                  style={{ background: '#111', border: '1px solid #222', color: '#ef4444', padding: '5px', borderRadius: '6px', cursor: 'pointer' }}
                                >
                                  <X size={12} />
                                </button>
                              </div>
                              {(() => {
                                const currentSumSheets = splits.reduce((a, b) => a + (Number(b.sheets) || (unitsPerSheet > 0 ? Math.ceil((Number(b.qty) || 0) / unitsPerSheet) : 0)), 0);
                                const isOver = currentSumSheets > totalSheetsNeeded;
                                const isExact = currentSumSheets === totalSheetsNeeded;
                                const statusColor = isOver ? '#ef4444' : isExact ? '#10b981' : '#ff9000';
                                return (
                                  <div style={{
                                    fontSize: '0.65rem',
                                    textAlign: 'center',
                                    color: statusColor,
                                    fontWeight: 950,
                                    background: `${statusColor}11`,
                                    padding: '6px',
                                    borderRadius: '10px',
                                    border: `1px solid ${statusColor}33`,
                                    marginTop: '5px'
                                  }}>
                                    {isOver ? (
                                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                        <AlertTriangle size={10} /> ПЕРЕВИЩЕННЯ: {currentSumSheets} / {totalSheetsNeeded} л.
                                      </span>
                                    ) : (
                                      <span>ПЛАН: {currentSumSheets} / {totalSheetsNeeded} листів</span>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'center', color: '#3b82f6', fontWeight: 1000, fontSize: '1.2rem' }}>
                          {rowMachineName || isSplitMode ? (
                            <>
                              <span style={{ color: activeProductionCards.length < totalTargetLoads ? '#444' : '#3b82f6' }}>{activeProductionCards.length}</span>
                              <span style={{ color: '#222', margin: '0 5px' }}>/</span>
                              <span>{totalTargetLoads}</span>
                              {redoCount > 0 && <span style={{ fontSize: '0.9rem', color: '#ef4444', marginLeft: '5px', fontWeight: 900 }}>+{redoCount}</span>}
                            </>
                          ) : (
                            <span style={{ color: '#222', fontSize: '0.8rem' }}>—</span>
                          )}
                        </td>
                        {!isReworkOrder && (
                          <td style={{ padding: '10px 4px', textAlign: 'center', color: '#ef4444', fontWeight: 900 }}>{surplus > 0 ? `+${surplus}` : '0'}</td>
                        )}
                        <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '5px' }}>
                            {plan === 0 ? (
                              (stockBZ > 0 && existing.find(c => c.operation === 'Склад БЗ')) ? (
                                <div style={{ background: '#3b82f620', border: '1px solid #3b82f640', color: '#3b82f6', padding: '8px 12px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: 950, textTransform: 'uppercase' }}>
                                  ЗАБРОНЬОВАНО ({Math.min(need, stockBZ)})
                                </div>
                              ) : (
                                <div style={{ color: '#222', fontSize: '0.6rem', fontWeight: 900 }}>НЕ ПОТРЕБУЄ ДІЇ</div>
                              )
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                {stockBZ > 0 && (
                                  <div style={{ background: '#3b82f622', border: '1px solid #3b82f644', color: '#3b82f6', padding: '6px 10px', borderRadius: '8px', fontSize: '0.6rem', fontWeight: 950, textAlign: 'center' }}>
                                    ЗАБРОНЬОВАНО: {Math.min(need, stockBZ)} шт
                                  </div>
                                )}
                                {(productionCards.length === 0 || productionCards.length < totalTargetLoads) && (
                                  <button
                                    disabled={!(rowMachineName || isSplitMode) || (() => {
                                      if (isCapacityMissing) return true
                                      const snapMat = (task.plan_snapshot || {})[String(part.nom?.id)]?.material; const baseMat = (snapMat || part.nom?.material_type || '').toLowerCase()
                                      const taskReqs = (materialRequests || []).filter(r => String(r.task_id) === String(task.id))
                                      const extractThickness = (str) => {
                                        const match = str.match(/(\d+(?:\.\d+)?)\s*мм/)
                                        return match ? match[1] + 'мм' : null
                                      }
                                      const baseThickness = extractThickness(baseMat)
                                      const sheetReqs = taskReqs.filter(r => {
                                        const rNom = nomenclatures.find(n => n.id === r.nomenclature_id)
                                        const rName = (rNom?.name || r.details || '').toLowerCase()
                                        const isSheet = rName.includes('лист') || rName.includes('sheet')
                                        if (!isSheet) return false
                                        const reqThickness = extractThickness(rName)
                                        if (baseThickness && reqThickness) {
                                          return baseThickness === reqThickness
                                        }
                                        const activeMaterials = baseMat.split('+').map(m => m.trim())
                                        return activeMaterials.some(act => rName.includes(act) || act.includes(rName))
                                      })
                                      const issued = sheetReqs.filter(r => r.status === 'issued' || r.status === 'completed')
                                        .reduce((sum, r) => sum + getRequestQty(r), 0)
                                      const hasKittingReqs = sheetReqs.length > 0
                                      return hasKittingReqs && issued <= 0
                                    })()}
                                    onClick={() => {
                                      if (isCapacityMissing) {
                                        alert(`Вкажіть кількість листів на одне завантаження (${defaultCapacity}-${maxCapacity} л.) перед генерацією карток.`)
                                        return
                                      }
                                      const snapMat = (task.plan_snapshot || {})[String(part.nom?.id)]?.material; const baseMat = (snapMat || part.nom?.material_type || '').toLowerCase()
                                      const taskReqs = (materialRequests || []).filter(r => String(r.task_id) === String(task.id))
                                      const extractThickness = (str) => {
                                        const match = str.match(/(\d+(?:\.\d+)?)\s*мм/)
                                        return match ? match[1] + 'мм' : null
                                      }
                                      const baseThickness = extractThickness(baseMat)
                                      const sheetReqs = taskReqs.filter(r => {
                                        const rNom = nomenclatures.find(n => n.id === r.nomenclature_id)
                                        const rName = (rNom?.name || r.details || '').toLowerCase()
                                        const isSheet = rName.includes('лист') || rName.includes('sheet')
                                        if (!isSheet) return false
                                        const reqThickness = extractThickness(rName)
                                        if (baseThickness && reqThickness) {
                                          return baseThickness === reqThickness
                                        }
                                        const activeMaterials = baseMat.split('+').map(m => m.trim())
                                        return activeMaterials.some(act => rName.includes(act) || act.includes(rName))
                                      })
                                      const issued = sheetReqs.filter(r => r.status === 'issued' || r.status === 'completed')
                                        .reduce((sum, r) => sum + getRequestQty(r), 0)
                                      const hasKittingReqs = sheetReqs.length > 0
                                      if (hasKittingReqs && issued <= 0) return;

                                      const currentSumSheets = splits.reduce((a, b) => a + (Number(b.sheets) || (unitsPerSheet > 0 ? Math.ceil((Number(b.qty) || 0) / unitsPerSheet) : 0)), 0);
                                      if (isSplitMode && currentSumSheets > totalSheetsNeeded) {
                                        alert(`Помилка: Ви запланували ${currentSumSheets} листів, що більше за план (${totalSheetsNeeded} л.). Виправте кількість перед генерацією.`);
                                        return;
                                      }

                                      if (isSplitMode) {
                                        setGenModal({
                                          task, part,
                                          total: Math.max(1, totalTargetLoads - productionCards.length), targetTotal: totalTargetLoads, requirement: plan, created: productionCards.length, rowId, machineName: rowMachineName || splits[0]?.machine, sheets, splits: splits, maxSheetsToGenerate: remainingSheetsCalc
                                        })
                                      } else {
                                        if (!rowMachineName) return;
                                        const mObj = findMachine(rowMachineName);
                                        const snapMat = (task.plan_snapshot || {})[String(part.nom?.id)]?.material;
                                        const baseMat = (snapMat || part.nom?.material_type || '').toLowerCase();
                                        const taskReqs = (materialRequests || []).filter(r => String(r.task_id) === String(task.id));
                                        const extractThickness = (str) => {
                                          const match = str.match(/(\d+(?:\.\d+)?)\s*мм/)
                                          return match ? match[1] + 'мм' : null
                                        }
                                        const baseThickness = extractThickness(baseMat)
                                        const sheetReqs = taskReqs.filter(r => {
                                          const rNom = nomenclatures.find(n => n.id === r.nomenclature_id)
                                          const rName = (rNom?.name || r.details || '').toLowerCase()
                                          const isSheet = rName.includes('лист') || rName.includes('sheet')
                                          if (!isSheet) return false
                                          const reqThickness = extractThickness(rName)
                                          if (baseThickness && reqThickness) {
                                            return baseThickness === reqThickness
                                          }
                                          const activeMaterials = baseMat.split('+').map(m => m.trim())
                                          return activeMaterials.some(act => rName.includes(act) || act.includes(rName))
                                        })
                                        const issued = sheetReqs.filter(r => r.status === 'issued' || r.status === 'completed')
                                          .reduce((sum, r) => sum + getRequestQty(r), 0)
                                        const hasKittingReqs = sheetReqs.length > 0
                                        
                                        const maxAllowed = hasKittingReqs ? Math.floor(issued / machineCapacity) : totalTargetLoads
                                        const initialTotal = Math.min(Math.max(1, totalTargetLoads - productionCards.length), maxAllowed)

                                        setGenModal({ task, part, total: initialTotal, targetTotal: totalTargetLoads, requirement: plan, created: productionCards.length, rowId, machineName: rowMachineName, sheets, capacity: machineCapacity, maxSheetsToGenerate: remainingSheetsCalc })
                                      }
                                    }}
                                    style={{
                                      background: (() => {
                                        const snapMat = (task.plan_snapshot || {})[String(part.nom?.id)]?.material; const baseMat = (snapMat || part.nom?.material_type || '').toLowerCase()
                                        const taskReqs = (materialRequests || []).filter(r => String(r.task_id) === String(task.id))
                                        const extractThickness = (str) => {
                                          const match = str.match(/(\d+(?:\.\d+)?)\s*мм/)
                                          return match ? match[1] + 'мм' : null
                                        }
                                        const baseThickness = extractThickness(baseMat)
                                        const sheetReqs = taskReqs.filter(r => {
                                          const rNom = nomenclatures.find(n => n.id === r.nomenclature_id)
                                          const rName = (rNom?.name || r.details || '').toLowerCase()
                                          const isSheet = rName.includes('лист') || rName.includes('sheet')
                                          if (!isSheet) return false
                                          const reqThickness = extractThickness(rName)
                                          if (baseThickness && reqThickness) {
                                            return baseThickness === reqThickness
                                          }
                                          const activeMaterials = baseMat.split('+').map(m => m.trim())
                                          return activeMaterials.some(act => rName.includes(act) || act.includes(rName))
                                        })
                                        const issued = sheetReqs.filter(r => r.status === 'issued' || r.status === 'completed')
                                          .reduce((sum, r) => sum + getRequestQty(r), 0)
                                        const hasKittingReqs = sheetReqs.length > 0
                                        if (isCapacityMissing) return '#222';
                                        if (hasKittingReqs && issued <= 0) return '#1e1b18';
                                        return (rowMachineName || isSplitMode) ? '#ff9000' : '#222';
                                      })(),
                                      color: (() => {
                                        const snapMat = (task.plan_snapshot || {})[String(part.nom?.id)]?.material; const baseMat = (snapMat || part.nom?.material_type || '').toLowerCase()
                                        const taskReqs = (materialRequests || []).filter(r => String(r.task_id) === String(task.id))
                                        const extractThickness = (str) => {
                                          const match = str.match(/(\d+(?:\.\d+)?)\s*мм/)
                                          return match ? match[1] + 'мм' : null
                                        }
                                        const baseThickness = extractThickness(baseMat)
                                        const sheetReqs = taskReqs.filter(r => {
                                          const rNom = nomenclatures.find(n => n.id === r.nomenclature_id)
                                          const rName = (rNom?.name || r.details || '').toLowerCase()
                                          const isSheet = rName.includes('лист') || rName.includes('sheet')
                                          if (!isSheet) return false
                                          const reqThickness = extractThickness(rName)
                                          if (baseThickness && reqThickness) {
                                            return baseThickness === reqThickness
                                          }
                                          const activeMaterials = baseMat.split('+').map(m => m.trim())
                                          return activeMaterials.some(act => rName.includes(act) || act.includes(rName))
                                        })
                                        const issued = sheetReqs.filter(r => r.status === 'issued' || r.status === 'completed')
                                          .reduce((sum, r) => sum + getRequestQty(r), 0)
                                        const hasKittingReqs = sheetReqs.length > 0
                                        if (isCapacityMissing) return '#666';
                                        if (hasKittingReqs && issued <= 0) return '#7f1d1d';
                                        return (rowMachineName || isSplitMode) ? '#000' : '#444';
                                      })(),
                                      border: (() => {
                                        const snapMat = (task.plan_snapshot || {})[String(part.nom?.id)]?.material; const baseMat = (snapMat || part.nom?.material_type || '').toLowerCase()
                                        const taskReqs = (materialRequests || []).filter(r => String(r.task_id) === String(task.id))
                                        const extractThickness = (str) => {
                                          const match = str.match(/(\d+(?:\.\d+)?)\s*мм/)
                                          return match ? match[1] + 'мм' : null
                                        }
                                        const baseThickness = extractThickness(baseMat)
                                        const sheetReqs = taskReqs.filter(r => {
                                          const rNom = nomenclatures.find(n => n.id === r.nomenclature_id)
                                          const rName = (rNom?.name || r.details || '').toLowerCase()
                                          const isSheet = rName.includes('лист') || rName.includes('sheet')
                                          if (!isSheet) return false
                                          const reqThickness = extractThickness(rName)
                                          if (baseThickness && reqThickness) {
                                            return baseThickness === reqThickness
                                          }
                                          const activeMaterials = baseMat.split('+').map(m => m.trim())
                                          return activeMaterials.some(act => rName.includes(act) || act.includes(rName))
                                        })
                                        const issued = sheetReqs.filter(r => r.status === 'issued' || r.status === 'completed')
                                          .reduce((sum, r) => sum + getRequestQty(r), 0)
                                        const hasKittingReqs = sheetReqs.length > 0
                                        if (isCapacityMissing) return '1px solid #333';
                                        if (hasKittingReqs && issued <= 0) return '1px solid rgba(239,68,68,0.2)';
                                        return 'none';
                                      })(),
                                      padding: '8px 15px',
                                      borderRadius: '8px',
                                      fontSize: '0.65rem',
                                      fontWeight: 900,
                                      cursor: (() => {
                                        const snapMat = (task.plan_snapshot || {})[String(part.nom?.id)]?.material; const baseMat = (snapMat || part.nom?.material_type || '').toLowerCase()
                                        const taskReqs = (materialRequests || []).filter(r => String(r.task_id) === String(task.id))
                                        const extractThickness = (str) => {
                                          const match = str.match(/(\d+(?:\.\d+)?)\s*мм/)
                                          return match ? match[1] + 'мм' : null
                                        }
                                        const baseThickness = extractThickness(baseMat)
                                        const sheetReqs = taskReqs.filter(r => {
                                          const rNom = nomenclatures.find(n => n.id === r.nomenclature_id)
                                          const rName = (rNom?.name || r.details || '').toLowerCase()
                                          const isSheet = rName.includes('лист') || rName.includes('sheet')
                                          if (!isSheet) return false
                                          const reqThickness = extractThickness(rName)
                                          if (baseThickness && reqThickness) {
                                            return baseThickness === reqThickness
                                          }
                                          const activeMaterials = baseMat.split('+').map(m => m.trim())
                                          return activeMaterials.some(act => rName.includes(act) || act.includes(rName))
                                        })
                                        const issued = sheetReqs.filter(r => r.status === 'issued' || r.status === 'completed')
                                          .reduce((sum, r) => sum + getRequestQty(r), 0)
                                        const hasKittingReqs = sheetReqs.length > 0
                                        if (isCapacityMissing) return 'not-allowed';
                                        if (hasKittingReqs && issued <= 0) return 'not-allowed';
                                        return (rowMachineName || isSplitMode) ? 'pointer' : 'not-allowed';
                                      })(),
                                      textTransform: 'uppercase',
                                      opacity: (isSplitMode && splits.reduce((a, b) => a + (Number(b.sheets) || (unitsPerSheet > 0 ? Math.ceil((Number(b.qty) || 0) / unitsPerSheet) : 0)), 0) > totalSheetsNeeded) ? 0.3 : 1
                                    }}
                                  >
                                    {(() => {
                                      const snapMat = (task.plan_snapshot || {})[String(part.nom?.id)]?.material; const baseMat = (snapMat || part.nom?.material_type || '').toLowerCase()
                                      const taskReqs = (materialRequests || []).filter(r => String(r.task_id) === String(task.id))
                                      const extractThickness = (str) => {
                                        const match = str.match(/(\d+(?:\.\d+)?)\s*мм/)
                                        return match ? match[1] + 'мм' : null
                                      }
                                      const baseThickness = extractThickness(baseMat)
                                      const sheetReqs = taskReqs.filter(r => {
                                        const rNom = nomenclatures.find(n => n.id === r.nomenclature_id)
                                        const rName = (rNom?.name || r.details || '').toLowerCase()
                                        const isSheet = rName.includes('лист') || rName.includes('sheet')
                                        if (!isSheet) return false
                                        const reqThickness = extractThickness(rName)
                                        if (baseThickness && reqThickness) {
                                          return baseThickness === reqThickness
                                        }
                                        const activeMaterials = baseMat.split('+').map(m => m.trim())
                                        return activeMaterials.some(act => rName.includes(act) || act.includes(rName))
                                      })
                                      const issued = sheetReqs.filter(r => r.status === 'issued' || r.status === 'completed')
                                        .reduce((sum, r) => sum + getRequestQty(r), 0)
                                      const hasKittingReqs = sheetReqs.length > 0
                                      if (isCapacityMissing) return 'ВКАЖІТЬ ЛИСТИ';
                                      return (hasKittingReqs && issued <= 0) ? 'НЕМАЄ ЛИСТІВ' : 'Генерувати';
                                    })()}
                                  </button>
                                )}
                              </div>
                            )}
                            {existing.length > 0 && (
                              <button
                                onClick={() => setPrintQueue({
                                  task,
                                  part,
                                  metadata: existing.map(c => ({
                                    id: c.id,
                                    loading: c.card_info,
                                    qty: c.quantity,
                                    machine: c.machine,
                                    totalLoadings: loads,
                                    sheetsPerLoading: findMachine(c.machine)?.sheet_capacity || 1,
                                    estimatedTime: (Number(part.nom?.time_per_unit) || 0) * (Number(c.quantity) || 0) * 60
                                  }))
                                })}
                                style={{ background: '#10b981', color: '#fff', border: 'none', padding: '8px', borderRadius: '10px', cursor: 'pointer' }}
                              >
                                <Printer size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ───── АРХІВ КАРТОК ───── */}
        <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#444', textTransform: 'uppercase', marginBottom: '12px', marginTop: '20px', borderLeft: '4px solid #ef4444', paddingLeft: '15px' }}>
          Архів робочих карток
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {Object.keys(task.plan_snapshot || {}).map((nomIdStr) => {
            const nomId = isNaN(nomIdStr) ? nomIdStr : Number(nomIdStr)
            const nom = nomenclatures.find(n => String(n.id) === String(nomId))

            if (nom?.type !== 'part') return null

            const activeCards = taskCards.filter(c => String(c.nomenclature_id) === String(nomId))
            const cardIdsStrings = activeCards.map(c => String(c.id))
            const groupHistory = taskHistory.length > 0
              ? taskHistory.filter(h => h.card_id && cardIdsStrings.includes(String(h.card_id)))
              : workCardHistory.filter(h => h.card_id && cardIdsStrings.includes(String(h.card_id)))

            const groupProduced = activeCards.reduce((sum, c) => sum + (countAsProduced(c) ? (Number(c.quantity) || 0) : 0), 0)
            const groupScrap = groupHistory.reduce((sum, h) => sum + (Number(h.scrap_qty) || 0), 0)

            const snapshot = task.plan_snapshot?.[nomId] || task.plan_snapshot?.[nom?.id]
            const orderRef = task.orders || orders.find(o => o.id === task.order_id) || allOrdersMap[task.order_id]

            let need = 0
            if (snapshot) {
              need = snapshot.need
            } else {
              const itemRef = orderRef?.order_items?.find(it => it.nomenclature_id === nom?.id)
              if (itemRef) {
                need = Number(itemRef.quantity) || 0
              } else {
                ;(orderRef?.order_items || []).forEach(oi => {
                  const bom = bomItems.filter(b => b.parent_id === oi.nomenclature_id)
                  const bItem = bom.find(b => b.child_id === nom?.id)
                  if (bItem) {
                    need += (Number(oi.quantity) || 0) * (Number(bItem.quantity_per_parent) || 1)
                  }
                })
              }
            }

            const orderCards = [
              ...(workCards || []).filter(c => c.order_id === task.order_id && String(c.nomenclature_id) === String(nom?.id)),
              ...(archiveCards || []).filter(c => String(c.nomenclature_id) === String(nom?.id))
            ]

            const unitsPerSheet = Number(nom?.units_per_sheet) || 1
            const plannedSheets = snapshot?.sheets || 0
            const stockBZ = snapshot?.stock || 0

            const totalSheets = activeCards.reduce((sum, c) => {
              if (c.operation === 'Склад БЗ') return sum
              const cardScrap = groupHistory
                .filter(h => String(h.card_id) === String(c.id))
                .reduce((s, h) => s + (Number(h.scrap_qty) || 0), 0)
              const originalQty = (Number(c.quantity) || 0) + cardScrap
              return sum + (c.actualSheets ? Number(c.actualSheets) : Math.ceil(originalQty / unitsPerSheet))
            }, 0)
            
            const totalSheetsMax = Math.max(plannedSheets, totalSheets)
            const totalBZ = (totalSheetsMax * unitsPerSheet) + stockBZ - need
            const shortage = (totalBZ - groupScrap) < 0 ? Math.abs(totalBZ - groupScrap) : 0

            const stages = activeCards.reduce((acc, c) => {
              if (c.status === 'new' || c.status === 'waiting-materials') acc.waiting++
              else if (c.status === 'completed' || c.status === 'at-buffer' || c.status === 'waiting-buffer' || c.status === 'at-shop2-buffer') acc.reception++
              else if (c.status === 'in-progress') acc.cutting++
              else if (c.operation?.includes('Розкрій')) acc.cutting++
              else if (c.operation?.includes('Галтовка')) acc.tumbling++
              else if (c.operation?.includes('Прийомка')) acc.reception++
              return acc
            }, { waiting: 0, cutting: 0, tumbling: 0, reception: 0 })

            return (
              <div key={nomId} className="nomenclature-archive-group" style={{ marginBottom: '0' }}>
                <div
                  onClick={() => setExpandedGroups(prev => ({ ...prev, [nomId]: !prev[nomId] }))}
                  style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', background: '#111', padding: '12px 20px', borderRadius: '12px', border: '1px solid #222', cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontWeight: 900, fontSize: '0.95rem', color: '#fff' }}>{nom?.name || 'Невідома деталь'}</div>
                    <div style={{ fontSize: '0.65rem', color: '#444', marginTop: '2px', fontWeight: 700 }}>
                      Потреба: <span style={{ color: '#aaa' }}>{need}</span> |{' '}
                      Вироблено: <span style={{ color: '#3b82f6' }}>{groupProduced}</span> |{' '}
                      БЗ: <span style={{ color: groupProduced - need >= 0 ? '#10b981' : '#aaa' }}>
                        {groupProduced - need > 0 ? `+${groupProduced - need}` : '+0'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 800 }}>
                      КАРТОК: <span style={{ color: '#fff' }}>{activeCards.length}</span>
                      <small style={{ marginLeft: '10px', color: '#333' }}>
                        ({stages.waiting > 0 && <span style={{ color: '#eab308', marginRight: '6px' }}>Очікують: {stages.waiting}</span>}
                        {stages.cutting > 0 && <span style={{ color: '#ff9000', marginRight: '6px' }}>В роботі: {stages.cutting}</span>}
                        {stages.reception > 0 && <span style={{ color: '#10b981' }}>Готові: {stages.reception}</span>})
                      </small>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 800, paddingLeft: '10px' }}>
                      ПРИЙНЯТО: <span style={{ color: '#3b82f6' }}>{groupProduced}</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: groupScrap > 0 ? '#ef4444' : '#333', fontWeight: 950 }}>
                      БРАК: {groupScrap}
                    </div>
                    {activeCards.some(c => c.status === 'waiting-materials') && (
                      <div style={{ padding: '3px 8px', borderRadius: '6px', background: 'rgba(255, 144, 0, 0.1)', border: '1px solid rgba(255, 144, 0, 0.3)', color: '#ff9000', fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.5px' }}>
                        ОЧІКУЄ СКЛАД
                      </div>
                    )}
                    {shortage > 0 && task.status !== 'completed' && (
                      <div onClick={(e) => e.stopPropagation()} style={{ padding: '4px 12px', borderRadius: '8px', background: '#ef444422', border: '1px solid #ef444444', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ color: '#ef4444', fontSize: '0.7rem', fontWeight: 950 }}>НЕСТАЧА: {shortage}</div>
                        <button
                          onClick={() => {
                            const unitsPerSheet = Number(nom?.units_per_sheet) || 1;
                            const sheetsNeeded = Math.ceil(shortage / unitsPerSheet);
                            const activeCardMachine = activeCards[0]?.machine || (task.plan_snapshot?.[String(nom?.id)]?.machine);
                            const resolvedMachine = findMachine(activeCardMachine) || findMachine(MACHINE_TYPES[0]);
                            const machineName = MACHINE_TYPES.find(t => t === resolvedMachine?.type || t === resolvedMachine?.name) || resolvedMachine?.name || MACHINE_TYPES[0];
                            const capacity = Number(resolvedMachine?.sheet_capacity) || 1;
                            const cardsNeeded = Math.ceil(sheetsNeeded / capacity);
                            setGenModal({ task, part: { nom }, total: cardsNeeded, targetTotal: cardsNeeded, requirement: shortage, created: 0, machineName, sheets: sheetsNeeded, isRepair: true, capacity })
                          }}
                          disabled={shortage <= 0}
                          style={{
                            background: (shortage <= 0) ? '#444' : '#ef4444',
                            color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '0.6rem', fontWeight: 900,
                            cursor: (shortage <= 0) ? 'not-allowed' : 'pointer',
                            textTransform: 'uppercase',
                            opacity: (shortage <= 0) ? 0.6 : 1
                          }}
                        >
                          {activeCards.some(c => ['new', 'waiting-materials'].includes(c.status) && (c.card_info || '').includes('[REDO]')) ? 'ДОВИПУСТИТИ ЩЕ' : 'ДОВИПУСК'}
                        </button>
                      </div>
                    )}
                    <div style={{ color: '#555', fontWeight: 900, fontSize: '0.8rem', marginLeft: '5px' }}>
                      {expandedGroups[nomId] ? '▼' : '▶'}
                    </div>
                  </div>
                </div>

                {expandedGroups[nomId] && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(() => {
                      const getCardSeq = (card) => {
                        const match = (card.card_info || '').match(/(\d+)\/(\d+)/)
                        return match ? parseInt(match[1]) : 999999
                      }
                      const sortedCards = [...activeCards].sort((a, b) => getCardSeq(a) - getCardSeq(b))
                      const machineGroups = sortedCards.reduce((acc, card) => {
                        const machineName = card.machine || snapshot?.machine || 'Верстат не вказано'
                        if (!acc.has(machineName)) acc.set(machineName, [])
                        acc.get(machineName).push(card)
                        return acc
                      }, new Map())

                      return Array.from(machineGroups.entries()).map(([machineName, machineCards]) => {
                        const machineKey = `${nomId}:${machineName}`
                        const isMachineExpanded = !!expandedArchiveMachines[machineKey]
                        const machineProduced = machineCards.reduce((sum, c) => sum + (countAsProduced(c) ? (Number(c.quantity) || 0) : 0), 0)
                        const machineScrap = machineCards.reduce((sum, c) => {
                          return sum + groupHistory
                            .filter(h => String(h.card_id) === String(c.id))
                            .reduce((s, h) => s + (Number(h.scrap_qty) || 0), 0)
                        }, 0)
                        const machineWaiting = machineCards.filter(c => c.status === 'new' || c.status === 'waiting-materials').length
                        const machineInWork = machineCards.filter(c => c.status === 'in-progress').length
                        const machineDone = machineCards.filter(c => ['completed', 'at-buffer', 'waiting-buffer', 'at-shop2-buffer'].includes(c.status)).length

                        return (
                          <div key={machineKey} style={{ background: '#0b0b0b', border: '1px solid #1f1f1f', borderRadius: '14px', overflow: 'hidden' }}>
                            <div
                              onClick={() => setExpandedArchiveMachines(prev => ({ ...prev, [machineKey]: !prev[machineKey] }))}
                              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#101010', cursor: 'pointer', userSelect: 'none', flexWrap: 'wrap' }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div style={{ color: '#fff', fontSize: '0.78rem', fontWeight: 950, lineHeight: 1.25 }}>{machineName}</div>
                                <div style={{ color: '#555', fontSize: '0.6rem', fontWeight: 800, marginTop: '3px' }}>
                                  КАРТОК: <span style={{ color: '#fff' }}>{machineCards.length}</span>
                                  {machineWaiting > 0 && <span style={{ color: '#eab308' }}> | ОЧІКУЄ: {machineWaiting}</span>}
                                  {machineInWork > 0 && <span style={{ color: '#ff9000' }}> | В РОБОТІ: {machineInWork}</span>}
                                  {machineDone > 0 && <span style={{ color: '#10b981' }}> | ГОТОВІ: {machineDone}</span>}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                <div style={{ color: '#555', fontSize: '0.65rem', fontWeight: 900 }}>ПРИЙНЯТО: <span style={{ color: '#3b82f6' }}>{machineProduced}</span></div>
                                <div style={{ color: machineScrap > 0 ? '#ef4444' : '#555', fontSize: '0.65rem', fontWeight: 950 }}>БРАК: {machineScrap}</div>
                                <div style={{ color: '#555', fontWeight: 950, fontSize: '0.75rem' }}>{isMachineExpanded ? '▼' : '▶'}</div>
                              </div>
                            </div>

                            {isMachineExpanded && (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '15px', padding: '12px' }}>
                                {machineCards.map(card => {
                        const loadingText = card.card_info?.split(' [')[0]
                        const isRedo = (card.card_info || '').includes('[REDO]')
                        const cardScrap = groupHistory
                          .filter(h => String(h.card_id) === String(card.id))
                          .reduce((sum, h) => sum + (Number(h.scrap_qty) || 0), 0)

                        const getStatusBadge = () => {
                          if (card.status === 'new') return { label: 'ОЧІКУЄ', color: '#eab308' }
                          if (card.status === 'in-progress') return { label: `У РОБОТІ: ${card.operation?.toUpperCase()}`, color: '#3b82f6' }
                          if (card.status === 'at-buffer' || card.status === 'waiting-buffer') return { label: `БУФЕР: ${card.operation?.toUpperCase()}`, color: '#10b981' }
                          if (card.status === 'completed') return { label: 'ЗАВЕРШЕНО', color: '#10b981' }
                          return { label: card.status?.toUpperCase(), color: '#555' }
                        }
                        const badge = getStatusBadge()

                        return (
                          <div
                            key={card.id}
                            className="archive-card-hover"
                            style={{ background: '#0f0f0f', padding: '15px', borderRadius: '20px', display: 'flex', gap: '15px', alignItems: 'center', border: `1px solid ${isRedo ? '#ef444444' : '#1a1a1a'}`, borderLeft: cardScrap > 0 ? '4px solid #ef4444' : `1px solid ${isRedo ? '#ef444444' : '#1a1a1a'}`, cursor: 'pointer', transition: '0.2s', position: 'relative' }}
                            onClick={() => setPrintQueue({
                              task,
                              part: { nom, nomenclature_id: card.nomenclature_id },
                              metadata: [{
                                id: card.id,
                                loading: card.card_info,
                                qty: card.quantity,
                                machine: card.machine || snapshot?.machine,
                                totalLoadings: '—',
                                sheetsPerLoading: findMachine(card.machine || snapshot?.machine)?.sheet_capacity || 1,
                                estimatedTime: (Number(nom?.time_per_unit) || 0) * (Number(card.quantity) || 0) * 60
                              }]
                            })}
                          >
                            <div style={{ background: '#fff', padding: '5px', borderRadius: '8px', boxShadow: '0 5px 15px rgba(0,0,0,0.3)' }}><QRCodeSVG value={`CENTRUM_CARD_${card.id}`} size={45} /></div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 1000, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Картка #{card.id.slice(-8).toUpperCase()}</div>
                                <span style={{ fontSize: '0.5rem', fontWeight: 1000, padding: '3px 8px', borderRadius: '6px', background: `${badge.color}22`, color: badge.color, border: `1px solid ${badge.color}44` }}>{badge.label}</span>
                              </div>
                              <div style={{ fontSize: '0.65rem', color: '#666', marginTop: '6px', fontWeight: 700 }}>
                                <span style={{ color: '#aaa' }}>{loadingText}</span> | <span style={{ color: '#555' }}>Верстат:</span> <span style={{ color: '#fff' }}>{card.machine || snapshot?.machine || '—'}</span> | <span style={{ color: '#555' }}>Шт:</span> <span style={{ color: '#fff' }}>{card.quantity}</span> | <span style={{ color: '#ef4444' }}>Брак:</span> <span style={{ color: cardScrap > 0 ? '#ef4444' : '#888' }}>{cardScrap}</span>
                              </div>
                              {cardScrap > 0 && (
                                <div style={{ position: 'absolute', top: '-10px', right: '15px', display: 'flex', alignItems: 'center', gap: '4px', background: '#ef4444', color: '#fff', padding: '3px 10px', borderRadius: '8px', fontWeight: 950, fontSize: '0.6rem', boxShadow: '0 8px 20px rgba(239, 68, 68, 0.4)' }}>
                                  <AlertTriangle size={10} /> БРАК: {cardScrap} ШТ
                                </div>
                              )}
                              {(() => {
                                const cardShiftChanges = groupHistory
                                  .filter(h => String(h.card_id) === String(card.id) && h.stage_name === 'Розкрій (перезмінка)')
                                  .sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at))
                                if (cardShiftChanges.length === 0) return null
                                return (
                                  <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    <span style={{ fontSize: '0.5rem', color: '#444', fontWeight: 900, textTransform: 'uppercase', alignSelf: 'center' }}>Перезмінка:</span>
                                    {cardShiftChanges.map((h, i) => {
                                      const replacedMatch = h.card_info?.match(/\[REPLACED_BY:(.*?)\]/)
                                      const replacement = replacedMatch ? replacedMatch[1].split(' (')[0] : ''
                                      return (
                                        <span key={i} style={{ fontSize: '0.5rem', background: '#f59e0b11', border: '1px solid #f59e0b22', color: '#f59e0b', padding: '1px 6px', borderRadius: '5px', fontWeight: 800 }}>
                                          {h.operator_name}{replacement ? ` ➔ ${replacement}` : ''}
                                        </span>
                                      )
                                    })}
                                  </div>
                                )
                              })()}
                            </div>
                          </div>
                        )
                      })}
                              </div>
                            )}
                          </div>
                        )
                      })
                    })()}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Generation Modal */}
      {genModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(15px)', zIndex: 15000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ background: '#111', width: '100%', maxWidth: '480px', borderRadius: '32px', border: '1px solid #222', padding: '40px', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <button
              onClick={() => setGenModal(null)}
              style={{ position: 'absolute', top: '25px', right: '25px', background: '#222', border: 'none', color: '#fff', cursor: 'pointer', width: '35px', height: '35px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={20} />
            </button>

            <h2 style={{ fontSize: '1.5rem', fontWeight: 950, margin: '0 0 10px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '1px' }}>Генерація карток</h2>
            <p style={{ color: '#555', textAlign: 'center', fontSize: '0.9rem', marginBottom: '30px' }}>{genModal.part.nom?.name}</p>

            {genModal.splits && genModal.splits.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ fontSize: '0.7rem', color: '#444', fontWeight: 900, marginBottom: '5px' }}>ОБЕРІТЬ ПАРТІЮ ДЛЯ ДРУКУ:</div>
                {(() => {
                  const globalTotalLoadings = genModal.splits.reduce((acc, s) => {
                    const cap = findMachine(s.machine)?.sheet_capacity || 1
                    const unitsPerSheet = genModal.part.nom?.units_per_sheet || 1
                    const sSheets = Number(s.sheets) || Math.ceil(s.qty / unitsPerSheet)
                    return acc + Math.ceil(sSheets / cap)
                  }, 0)

                  let currentGlobalOffset = 0
                  const existingNomenclatureCards = (workCards || []).filter(wc =>
                    String(wc.task_id) === String(genModal.task.id) &&
                    String(wc.nomenclature_id) === String(genModal.part.nom?.id)
                  )

                  return genModal.splits.map((split, sIdx) => {
                    const cap = findMachine(split.machine)?.sheet_capacity || 1
                    const unitsPerSheet = genModal.part.nom?.units_per_sheet || 1
                    const splitSheets = Number(split.sheets) || Math.ceil(split.qty / unitsPerSheet)
                    const capacityKey = `${genModal.part.nom?.id}_${sIdx}_cap`
                    const currentCapacity = customLoadingCapacities[capacityKey] ?? cap
                    const splitLoadings = Math.ceil(splitSheets / currentCapacity)
                    const splitQty = split.qty || (splitSheets * unitsPerSheet)
                    const qtyPerCard = Math.ceil(splitQty / splitLoadings)

                    const machineCards = existingNomenclatureCards
                      .filter(wc => wc.machine === split.machine)
                      .sort((a, b) => a.id - b.id)

                    const prevSplitsSameMachine = genModal.splits.slice(0, sIdx).filter(s => s.machine === split.machine)
                    const sheetsSkipped = prevSplitsSameMachine.reduce((sum, s) => {
                      const sSheets = Number(s.sheets) || Math.ceil(s.qty / unitsPerSheet)
                      return sum + sSheets
                    }, 0)

                    let sheetsUsedInThisSplit = 0
                    let cardsBelongingToThisSplitCount = 0
                    let currentGlobalSheets = 0

                    machineCards.forEach(wc => {
                      const cardSheets = Math.ceil((Number(wc.quantity) || 0) / unitsPerSheet)
                      const cardStart = currentGlobalSheets
                      const cardEnd = currentGlobalSheets + cardSheets

                      const splitStart = sheetsSkipped
                      const splitEnd = sheetsSkipped + splitSheets

                      if (cardEnd > splitStart && cardStart < splitEnd) {
                        cardsBelongingToThisSplitCount++
                        sheetsUsedInThisSplit += cardSheets
                      }

                      currentGlobalSheets += cardSheets
                    })

                    const getKittingSheets = (taskObj, partNom) => {
                      const snapMat = (taskObj.plan_snapshot || {})[String(partNom?.id)]?.material;
                      const baseMat = snapMat || partNom?.material_type || ''
                      const taskReqs = (materialRequests || []).filter(r => String(r.task_id) === String(taskObj.id))
                      const extractThickness = (str) => {
                        const match = str.match(/(\d+(?:\.\d+)?)\s*мм/)
                        return match ? match[1] + 'мм' : null
                      }
                      const baseThickness = extractThickness(baseMat)
                      const sheetReqs = taskReqs.filter(r => {
                        const rNom = nomenclatures.find(n => n.id === r.nomenclature_id)
                        const rName = rNom?.name || r.details || ''
                        const lowerName = rName.toLowerCase()
                        const isSheet = lowerName.includes('лист') || lowerName.includes('sheet')
                        if (!isSheet) return false
                        const reqThickness = extractThickness(lowerName)
                        if (baseThickness && reqThickness) {
                          return baseThickness === reqThickness
                        }
                        const activeMaterials = baseMat.split('+').map(m => m.trim().toLowerCase())
                        return activeMaterials.some(act => lowerName.includes(act) || act.includes(lowerName))
                      })
                      const issued = sheetReqs.filter(r => r.status === 'issued' || r.status === 'completed')
                        .reduce((sum, r) => sum + getRequestQty(r), 0)
                      const pending = sheetReqs.filter(r => r.status === 'pending')
                        .reduce((sum, r) => sum + getRequestQty(r), 0)
                      const materialRequiresSheets = /(?:т|t)\s*(?:300|700)|лист|sheet/i.test(baseMat)
                      return { issuedSheets: issued, pendingSheets: pending, hasKittingReqs: materialRequiresSheets || sheetReqs.length > 0 }
                    }

                    const { issuedSheets, pendingSheets, hasKittingReqs } = getKittingSheets(genModal.task, genModal.part.nom)
                    const generatedCount = cardsBelongingToThisSplitCount
                    const isGenerated = sheetsUsedInThisSplit >= splitSheets
                    const remainingCount = Math.max(0, splitLoadings - generatedCount)

                    const maxAllowedToGen = hasKittingReqs 
                      ? Math.min(remainingCount, Math.floor(Math.max(0, issuedSheets - sheetsUsedInThisSplit) / currentCapacity))
                      : remainingCount
                    const isKittingBlocked = hasKittingReqs && maxAllowedToGen <= 0

                    const splitGlobalOffsetForThisMachine = currentGlobalOffset
                    currentGlobalOffset += splitLoadings
                    const toGen = Math.min(maxAllowedToGen, partialCounts[`${genModal.part.nom?.id}_${sIdx}`] ?? remainingCount)

                    return (
                      <div key={sIdx} style={{ background: '#080808', padding: '15px', borderRadius: '16px', border: isGenerated ? '1px solid #10b98133' : '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: isGenerated ? 0.8 : 1 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ fontWeight: 900, color: isGenerated ? '#10b981' : '#fff', fontSize: '0.9rem' }}>{split.machine || '—'}</div>
                            <span style={{ fontSize: '0.65rem', background: isGenerated ? '#10b98133' : '#222', color: isGenerated ? '#10b981' : '#888', padding: '2px 8px', borderRadius: '6px', fontWeight: 900 }}>
                              {generatedCount} / {splitLoadings} КАРТ.
                            </span>
                          </div>
                          <div style={{ fontSize: '0.65rem', color: '#555', marginTop: '4px' }}>
                            Листів: {splitSheets} | Деталей: {splitQty}
                          </div>
                          {(() => {
                            if (isGenerated) {
                              return <div style={{ fontSize: '0.55rem', color: '#10b981', marginTop: '2px', fontWeight: 900 }}>Всі карти згенеровано ✅</div>
                            }
                            if (!hasKittingReqs) return null;
                            if (issuedSheets === 0) {
                              return (
                                <div style={{ fontSize: '0.6rem', color: '#ef4444', fontWeight: 900, marginTop: '4px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                                  ⚠️ Очікуємо погодження складу (немає листів)
                                </div>
                              )
                            }
                            if (pendingSheets > 0) {
                              return (
                                <div style={{ fontSize: '0.6rem', color: '#eab308', fontWeight: 900, marginTop: '4px', background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.15)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                                  ⏳ Видано: {issuedSheets} л. | Очікуємо видачу {pendingSheets} листів з СО
                                </div>
                              )
                            }
                            return (
                              <div style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 900, marginTop: '4px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                                ✅ ГОТОВО ДО ЗАПУСКУ ({issuedSheets} л. видано)
                              </div>
                            )
                          })()}
                        </div>

                        {!isGenerated && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                              <span style={{ fontSize: '0.55rem', color: '#ff9000', fontWeight: 900 }}>ЗАГРУЗКА</span>
                              <input
                                type="number"
                                min="1"
                                max={splitSheets}
                                value={currentCapacity}
                                onChange={(e) => {
                                  const val = Math.max(1, parseInt(e.target.value) || 1)
                                  setCustomLoadingCapacities(prev => ({ ...prev, [capacityKey]: val }))
                                }}
                                style={{ width: '45px', background: '#000', border: '1px solid rgba(255,144,0,0.4)', color: '#ff9000', textAlign: 'center', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 900, padding: '4px 0' }}
                                title="Кількість листів на одну загрузку (картку)"
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                              <span style={{ fontSize: '0.55rem', color: '#444', fontWeight: 900 }}>ДРУК</span>
                              <input
                                type="number"
                                min="1"
                                max={remainingCount}
                                value={toGen}
                                onChange={(e) => {
                                  const val = Math.min(remainingCount, Math.max(1, parseInt(e.target.value) || 1))
                                  setPartialCounts(prev => ({ ...prev, [`${genModal.part.nom?.id}_${sIdx}`]: val }))
                                }}
                                style={{ width: '45px', background: '#000', border: '1px solid #333', color: '#fff', textAlign: 'center', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 900, padding: '4px 0' }}
                              />
                            </div>
                            <button
                              disabled={isGenerating || isKittingBlocked}
                              onClick={() => {
                                const finalToGen = Math.min(toGen, remainingCount)
                                if (finalToGen <= 0) return

                                handleGenerateFromWorksheet(
                                  genModal.task,
                                  genModal.part,
                                  splitSheets,
                                  split.machine,
                                  finalToGen,
                                  generatedCount,
                                  splitQty,
                                  genModal.isRepair,
                                  globalTotalLoadings,
                                  splitGlobalOffsetForThisMachine,
                                  currentCapacity,
                                  genModal.maxSheetsToGenerate
                                )
                              }}
                              style={{ 
                                background: isGenerating ? '#333' : (isKittingBlocked ? '#1e1b18' : '#10b981'), 
                                color: isKittingBlocked ? '#7f1d1d' : '#fff', 
                                border: isKittingBlocked ? '1px solid rgba(239,68,68,0.2)' : 'none',
                                padding: '10px 15px', 
                                borderRadius: '10px', 
                                fontSize: '0.7rem', 
                                fontWeight: 950, 
                                cursor: (isGenerating || isKittingBlocked) ? 'not-allowed' : 'pointer', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '5px', 
                                pointerEvents: (isGenerating || isKittingBlocked) ? 'none' : 'auto' 
                              }}
                            >
                              {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Printer size={12} />}
                              {isGenerating ? 'ОБРОБКА...' : (isKittingBlocked ? 'НЕМАЄ ЛИСТІВ' : 'ГЕНЕРУВАТИ')}</button>
                          </div>
                        )}
                        {isGenerated && (
                          <div style={{ color: '#444', fontSize: '0.7rem', fontWeight: 800 }}>ГОТОВО</div>
                        )}
                      </div>
                    )
                  })
                })()}
              </div>
            ) : (
              <>
                {genModal.isRepair ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px' }}>
                    <div>
                      <label style={{ display: 'block', color: '#888', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>
                        Оберіть верстат для довипуску:
                      </label>
                      <select
                        value={genModal.machineName}
                        onChange={(e) => {
                          const newMachineName = e.target.value
                          const resolvedMachine = findMachine(newMachineName)
                          const newCapacity = Number(resolvedMachine?.sheet_capacity) || 1
                          const newCardsNeeded = Math.ceil(genModal.sheets / newCapacity)
                          setGenModal(prev => ({ ...prev, machineName: newMachineName, total: Math.max(1, newCardsNeeded - (prev.created || 0)), targetTotal: newCardsNeeded }))
                        }}
                        style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '15px', borderRadius: '15px', fontSize: '0.95rem', outline: 'none', fontWeight: 800 }}
                      >
                        {MACHINE_TYPES.map(t => {
                          const cap = findMachine(t)?.sheet_capacity || 1
                          return (
                            <option key={t} value={t}>{t} (місткість: {cap} л.)</option>
                          )
                        })}
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                      <div style={{ background: '#080808', padding: '15px', borderRadius: '15px', border: '1px solid #1a1a1a', textAlign: 'center' }}>
                        <div style={{ color: '#555', fontSize: '0.65rem', fontWeight: 800 }}>НЕОБХІДНО ЛИСТІВ:</div>
                        <div style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 950, marginTop: '4px' }}>{genModal.sheets} л.</div>
                      </div>
                      <div style={{ background: '#080808', padding: '15px', borderRadius: '15px', border: '1px solid #1a1a1a', textAlign: 'center' }}>
                        <div style={{ color: '#555', fontSize: '0.65rem', fontWeight: 800 }}>КІЛЬКІСТЬ КАРТ:</div>
                        <div style={{ color: '#ff9000', fontSize: '1.2rem', fontWeight: 950, marginTop: '4px' }}>{genModal.total} шт.</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: '#080808', padding: '20px', borderRadius: '20px', border: '1px solid #1a1a1a', marginBottom: '30px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                      <span style={{ color: '#555', fontSize: '0.75rem', fontWeight: 800 }}>СТАТУС:</span>
                      <span style={{ color: '#3b82f6', fontSize: '0.75rem', fontWeight: 900 }}>Згенеровано {genModal.created} з {genModal.targetTotal || genModal.total}</span>
                    </div>
                    <div style={{ height: '6px', background: '#1a1a1a', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${(genModal.created / (genModal.targetTotal || genModal.total)) * 100}%`, height: '100%', background: '#3b82f6', transition: '0.3s' }} />
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', color: '#ff9000', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '10px', textAlign: 'center' }}>
                    Завантаження (від {findMachine(genModal.machineName)?.min_capacity || 1} до {findMachine(genModal.machineName)?.max_capacity || findMachine(genModal.machineName)?.sheet_capacity || 1} л.)
                  </label>
                  <input
                    type="number"
                    value={genModal.capacity !== undefined ? genModal.capacity : (findMachine(genModal.machineName)?.min_capacity || 1)}
                    onChange={(e) => {
                      const newCap = parseInt(e.target.value);
                      const m = findMachine(genModal.machineName);
                      const minC = m?.min_capacity || 1;
                      const maxC = m?.max_capacity || m?.sheet_capacity || 1;
                      const safeCap = isNaN(newCap) ? 1 : Math.min(maxC, Math.max(minC, newCap));
                      const newTargetTotal = Math.ceil(genModal.sheets / safeCap);
                      setGenModal(prev => ({
                        ...prev,
                        capacity: isNaN(newCap) ? '' : newCap,
                        total: Math.max(1, newTargetTotal - (prev.created || 0)),
                        targetTotal: newTargetTotal
                      }));
                    }}
                    onBlur={(e) => {
                      const m = findMachine(genModal.machineName);
                      const minC = m?.min_capacity || 1;
                      const maxC = m?.max_capacity || m?.sheet_capacity || 1;
                      let v = parseInt(e.target.value);
                      if (isNaN(v)) v = minC;
                      else v = Math.min(maxC, Math.max(minC, v));
                      const newTargetTotal = Math.ceil(genModal.sheets / v);
                      setGenModal(prev => ({
                        ...prev,
                        capacity: v,
                        total: Math.max(1, newTargetTotal - (prev.created || 0)),
                        targetTotal: newTargetTotal
                      }));
                    }}
                    min={findMachine(genModal.machineName)?.min_capacity || 1}
                    max={findMachine(genModal.machineName)?.max_capacity || findMachine(genModal.machineName)?.sheet_capacity || 1}
                    style={{ width: '100%', background: '#000', border: '1px solid rgba(255,144,0,0.5)', color: '#ff9000', fontSize: '1.5rem', fontWeight: 950, textAlign: 'center', padding: '10px', borderRadius: '15px', outline: 'none' }}
                  />
                </div>

                <div style={{ marginBottom: '30px' }}>
                  <label style={{ display: 'block', color: '#888', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '10px', textAlign: 'center' }}>
                    {genModal.isRepair ? 'Кількість карт до друку' : 'Скільки ще карт згенерувати?'}
                  </label>
                  <input
                    type="number"
                    id="gen_count_input"
                    value={genModal.total}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value) || 1)
                      setGenModal(prev => ({ ...prev, total: val }))
                    }}
                    min="1"
                    style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', fontSize: '2.5rem', fontWeight: 950, textAlign: 'center', padding: '15px', borderRadius: '20px', outline: 'none', borderInline: '4px solid #10b981' }}
                  />
                </div>

                <button
                  onClick={() => {
                    const v = parseInt(document.getElementById('gen_count_input').value)
                    if (v > 0) {
                      handleGenerateFromWorksheet(genModal.task, genModal.part, genModal.sheets, genModal.machineName, v, genModal.created, genModal.requirement, genModal.isRepair, null, 0, genModal.capacity, genModal.maxSheetsToGenerate)
                      setGenModal(null)
                    }
                  }}
                  style={{ width: '100%', background: '#10b981', color: '#fff', padding: '22px', borderRadius: '22px', fontSize: '1rem', fontWeight: 950, cursor: 'pointer', border: 'none', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 10px 20px -5px rgba(16, 185, 129, 0.4)' }}
                >
                  ПІДТВЕРДИТИ ТА ДРУКУВАТИ
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Print labels layout */}
      {printQueue && (
        <div className="print-overlay" style={{ position: 'fixed', inset: 0, background: '#111', color: '#000', zIndex: 10000, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0' }}>
          <div className="no-print" style={{ position: 'sticky', top: 0, width: '100%', padding: '15px 30px', background: '#111', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', zIndex: 100 }}>
            <h3>Друк: {printQueue.part.nom?.name}</h3>
            <div style={{ display: 'flex', gap: '15px' }}>
              <button onClick={() => window.print()} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 900, cursor: 'pointer' }}>ДРУКУВАТИ</button>
              <button onClick={() => setPrintQueue(null)} style={{ color: '#fff', background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
            </div>
          </div>

          {printQueue.metadata.map((m, i) => {
            const order = orders.find(o => o.id === printQueue.task.order_id) || allOrdersMap[printQueue.task.order_id]
            const nomenclature = nomenclatures.find(n => n.id === (printQueue.part.nomenclature_id || printQueue.part.nom?.id))
            const currentDate = new Date().toLocaleDateString('uk-UA')
            const finishedProduct = order?.order_items?.[0] ? nomenclatures.find(n => n.id === order.order_items[0].nomenclature_id) : null
            const formatTime = (seconds) => {
              const h = Math.floor(seconds / 3600)
              const min = Math.floor((seconds % 3600) / 60)
              if (h > 0) return `${h}год ${min}хв`
              return `${min}хв`
            }

            const mac = machines.find(mac => mac.name === m.machine)
            const opData = machineOperations?.find(o =>
              o.nomenclature_id === nomenclature?.id &&
              (o.machine_type === m.machine || (mac && o.machine_id === mac.id))
            )
            let s1Ops = (opData?.side1_ops || []).filter(op => !op.startsWith('__CUTTER__:') && !op.startsWith('__CUTTER__Reference:'))
            let s2Ops = (opData?.side2_ops || []).filter(op => !op.startsWith('__CUTTER__:') && !op.startsWith('__CUTTER__Reference:'))
            let s2CutOps = (opData?.side2_cut_ops || []).filter(op => !op.startsWith('__CUTTER__:') && !op.startsWith('__CUTTER__Reference:'))

            const snapshotPart = printQueue.task.plan_snapshot?.[String(nomenclature?.id)]
            const isCutter1_5 = snapshotPart?.cutter_override === '1.5'

            if (isCutter1_5) {
              const replacer = (op) => {
                if (op.includes('|')) return op.split('|')[1].trim()
                return op.replace(/[фФ]2(?![0-9.])/g, match => match[0] === 'ф' ? 'ф1.5' : 'Ф1.5')
              }
              s1Ops = s1Ops.map(replacer)
              s2Ops = s2Ops.map(replacer)
            } else {
              const replacer = (op) => {
                if (op.includes('|')) return op.split('|')[0].trim()
                return op
              }
              s1Ops = s1Ops.map(replacer)
              s2Ops = s2Ops.map(replacer)
            }

            const s2CutOpsF2 = s2CutOps.map(op => {
              if (op.includes('|')) return op.split('|')[0].trim()
              return op.replace(/[фФ]1\.5(?![0-9.])/g, match => match[0] === 'ф' ? 'ф2' : 'Ф2')
            })
            const s2CutOpsF15 = s2CutOps.map(op => {
              if (op.includes('|')) return op.split('|')[1].trim()
              return op.replace(/[фФ]2(?![0-9.])/g, match => match[0] === 'ф' ? 'ф1.5' : 'Ф1.5')
            })

            const maxOps = Math.max(10, s1Ops.length, s2Ops.length, s2CutOpsF2.length, s2CutOpsF15.length)
            const opRows = Array.from({ length: maxOps }).map((_, i) => ({
              s1: s1Ops[i] || '',
              s2: s2Ops[i] || '',
              s2cF2: s2CutOpsF2[i] || '',
              s2cF15: s2CutOpsF15[i] || ''
            }))

            return (
              <div key={i} className="a4-page" style={{ width: '210mm', height: '297mm', background: '#fff', padding: '10mm', margin: '0 auto 40px auto', pageBreakAfter: i === printQueue.metadata.length - 1 ? 'avoid' : 'always', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', boxSizing: 'border-box' }}>
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', border: '1.5px solid #000' }}>
                  {[1, 2].map(blockIdx => (
                    <div key={blockIdx} style={{ borderBottom: '1.5px solid #000', marginBottom: blockIdx === 1 ? '20px' : '0' }}>
                      <div style={{ borderTop: blockIdx === 2 ? '1.5px solid #000' : 'none' }}>
                        <div style={{ display: 'flex', height: '18px', borderBottom: '1px solid #000', textAlign: 'center', background: '#fff' }}>
                          <div style={{ width: '25%', borderRight: '1px solid #000', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Замовник</div>
                          <div style={{ width: '25%', borderRight: '1px solid #000', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Номер замовлення</div>
                          <div style={{ width: '35%', borderRight: '1px solid #000', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Планова дата відвантаження</div>
                          <div style={{ width: '15%', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Дата</div>
                        </div>
                        <div style={{ display: 'flex', height: '24px', borderBottom: '1.5px solid #000', textAlign: 'center', alignItems: 'center' }}>
                          <div style={{ width: '25%', borderRight: '1px solid #000', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10pt', fontWeight: 950 }}>{order?.customer || '—'}</div>
                          <div style={{ width: '25%', borderRight: '1px solid #000', fontSize: '11pt', fontWeight: 950 }}>{order?.order_num || '—'}</div>
                          <div style={{ width: '35%', borderRight: '1px solid #000', fontSize: '10pt', fontWeight: 950 }}>{order?.deadline ? new Date(order.deadline).toLocaleDateString('uk-UA') : '—'}</div>
                          <div style={{ width: '15%', fontSize: '11pt', fontWeight: 950 }}>{currentDate}</div>
                        </div>
                        <div style={{ display: 'flex', height: '18px', borderBottom: '1px solid #000', textAlign: 'center', background: '#fff' }}>
                          <div style={{ width: '30%', borderRight: '1px solid #000', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Назва проєкту</div>
                          <div style={{ width: '10%', borderRight: '1px solid #000', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>К-сть листів</div>
                          <div style={{ width: '12%', borderRight: '1px solid #000', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Товщина, мм</div>
                          <div style={{ width: '15%', borderRight: '1px solid #000', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Тип станку</div>
                          <div style={{ width: '15%', borderRight: '1px solid #000', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>№ картки</div>
                          <div style={{ width: '18%', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Системний номер</div>
                        </div>
                        <div style={{ display: 'flex', height: '26px', borderBottom: '1.5px solid #000', textAlign: 'center', alignItems: 'center' }}>
                          <div style={{ width: '30%', borderRight: '1px solid #000', fontSize: '9pt', fontWeight: 1000 }}>{finishedProduct?.name || '—'}</div>
                          <div style={{ width: '10%', borderRight: '1px solid #000', fontSize: '13pt', fontWeight: 1000 }}>
                            {Math.ceil(m.qty / (nomenclature?.units_per_sheet || 1))}
                          </div>
                          <div style={{ width: '12%', borderRight: '1px solid #000', fontSize: '8pt', fontWeight: 1000, lineHeight: 1.1 }}>{getDisplayMaterial(nomenclature, snapshotPart)}</div>
                          <div style={{ width: '15%', borderRight: '1px solid #000', fontSize: '7.5pt', fontWeight: 1000, padding: '0 2px' }}>{m.machine}</div>
                          <div style={{ width: '15%', borderRight: '1px solid #000', fontSize: '11pt', fontWeight: 1000 }}>{m.loading?.split(' [')[0]}</div>
                          <div style={{ width: '18%', fontSize: '11pt', fontWeight: 1000 }}>#{m.id.slice(-8).toUpperCase()}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', height: '125px' }}>
                        <div style={{ width: '75%', borderRight: '1.5px solid #000', display: 'flex' }}>
                          <div style={{ width: '68%', borderRight: '1.5px solid #000', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', height: '18px', borderBottom: '1px solid #000', textAlign: 'center' }}>
                              <div style={{ width: '50%', borderRight: '1px solid #000', fontSize: '6.5pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Основна номенклатура</div>
                              <div style={{ width: '30%', borderRight: '1px solid #000', fontSize: '6.5pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Планова к-сть, шт</div>
                              <div style={{ width: '20%', fontSize: '6.5pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>ЧПУ №</div>
                            </div>
                            <div style={{ display: 'flex', height: '28px', borderBottom: '1px solid #000', textAlign: 'center', alignItems: 'center' }}>
                              <div style={{ width: '50%', borderRight: '1px solid #000', fontSize: '8pt', fontWeight: 1000, padding: '0 4px', lineHeight: 1.1 }}>{nomenclature?.name}</div>
                              <div style={{ width: '30%', borderRight: '1px solid #000', fontSize: '20pt', fontWeight: 1000 }}>{m.qty}</div>
                              <div style={{ width: '20%', fontSize: '11pt', fontWeight: 1000 }}></div>
                            </div>
                            <div style={{ display: 'flex', height: '30px', borderBottom: '1px solid #000' }}>
                              <div style={{ width: '50%', borderRight: '1px solid #000', display: 'flex', flexDirection: 'column', padding: '1px 2px' }}><span style={{ fontSize: '6pt', fontWeight: 900 }}>ПІБ працівника</span><div style={{ flex: 1 }}></div></div>
                              <div style={{ width: '50%', display: 'flex', flexDirection: 'column', padding: '1px 2px' }}><span style={{ fontSize: '6pt', fontWeight: 900 }}>ПІБ працівника</span><div style={{ flex: 1 }}></div></div>
                            </div>
                            <div style={{ display: 'flex', height: '49px' }}>
                              <div style={{ width: '50%', borderRight: '1px solid #000', display: 'flex', flexDirection: 'column', padding: '1px 2px' }}><span style={{ fontSize: '6pt', fontWeight: 950 }}>Дата початку / Час початку</span><div style={{ flex: 1 }}></div></div>
                              <div style={{ width: '50%', display: 'flex', flexDirection: 'column', padding: '1px 2px' }}><span style={{ fontSize: '6pt', fontWeight: 950 }}>Дата завершення / Час завершення</span><div style={{ flex: 1 }}></div></div>
                            </div>
                          </div>
                          <div style={{ width: '32%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2px' }}>
                            <QRCodeSVG value={`CENTRUM_CARD_${m.id}`} size={105} />
                          </div>
                        </div>
                        <div style={{ width: '25%', display: 'flex', flexDirection: 'column' }}>
                          <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', fontSize: '6pt' }}>
                            <tbody>
                              {[1, 2, 3].map(idx => (
                                <tr key={idx} style={{ height: '28px', borderBottom: '1px solid #000' }}>
                                  <td style={{ borderRight: '1px solid #000', width: '70%', background: '#fff' }}></td>
                                  <td style={{ textAlign: 'center', width: '30%' }}>
                                    <div style={{ fontSize: '5pt', fontWeight: 900, borderBottom: '1px solid #eee', textTransform: 'uppercase' }}>К-сть, шт</div>
                                    <div style={{ fontSize: '9pt', fontWeight: 1000 }}>0</div>
                                  </td>
                                </tr>
                              ))}
                              <tr style={{ flex: 1, background: '#fff' }}>
                                <td colSpan="2" style={{ padding: '2px', textAlign: 'center' }}>
                                  <span style={{ fontSize: '6pt', fontWeight: 900, display: 'block', textTransform: 'uppercase', marginBottom: '1px' }}>План. час виконання</span>
                                  <span style={{ fontSize: '11pt', fontWeight: 1000 }}>{formatTime(m.estimatedTime || 0)}</span>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '28px', margin: '4px 0' }}>
                    <div style={{ display: 'flex', border: '1.5px solid #000', height: '100%' }}>
                      <div style={{ padding: '0 15px', borderRight: '1.5px solid #000', display: 'flex', alignItems: 'center', fontSize: '10pt', fontWeight: 900 }}>Листи відповідають</div>
                      <div style={{ padding: '0 15px', borderRight: '1.5px solid #000', display: 'flex', alignItems: 'center', fontSize: '10pt', fontWeight: 900 }}>{nomenclature?.material_type || '—'}</div>
                      <div style={{ padding: '0 15px', display: 'flex', alignItems: 'center', fontSize: '14pt', fontWeight: 900 }}>☐</div>
                    </div>
                  </div>
                  <div style={{ marginTop: '2px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '6.5pt' }}>
                      <thead>
                        <tr style={{ background: '#fff', textAlign: 'center', fontWeight: 'bold' }}>
                          <td style={{ border: '1.5px solid #000', width: '22%', height: '36px' }}>Операція (1 сторона)</td>
                          <td style={{ border: '1.5px solid #000', width: '11%', fontSize: '5.5pt', lineHeight: 1.2 }}>
                            Статус<br />виконання ☑<br />
                            <div style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000', margin: '2px 0', padding: '2px 0' }}>Лист | Лист</div>
                            1, 2 | 3, 4
                          </td>
                          <td style={{ border: '1.5px solid #000', width: '22%' }}>Операція (2 сторона)</td>
                          <td style={{ border: '1.5px solid #000', width: '11%', fontSize: '5.5pt', lineHeight: 1.2 }}>
                            Статус<br />виконання ☑<br />
                            <div style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000', margin: '2px 0', padding: '2px 0' }}>Лист | Лист</div>
                            1, 2 | 3, 4
                          </td>
                          {!isCutter1_5 ? (
                            <td style={{ border: '1.5px solid #000', width: '26%', fontSize: '6.5pt', fontWeight: 'bold' }}>Операція (2 сторона вирізка)<br />Ф2мм</td>
                          ) : (
                            <td style={{ border: '1.5px solid #000', width: '26%', fontSize: '6.5pt', fontWeight: 'bold' }}>Операція (2 сторона вирізка)<br />Ф1.5мм</td>
                          )}
                          <td style={{ border: '1.5px solid #000', width: '8%', fontSize: '5.5pt', lineHeight: 1 }}>Статус<br />виконання<br />☑</td>
                        </tr>
                      </thead>
                      <tbody>
                        {opRows.map((row, idx) => (
                          <tr key={idx} style={{ height: '22px' }}>
                            <td style={{ border: '1.5px solid #000', paddingLeft: '4px' }}>{row.s1}</td>
                            <td style={{ border: '1.5px solid #000', textAlign: 'center', fontSize: '10pt', letterSpacing: '2px' }}>☐ | ☐</td>
                            <td style={{ border: '1.5px solid #000', paddingLeft: '4px' }}>{row.s2}</td>
                            <td style={{ border: '1.5px solid #000', textAlign: 'center', fontSize: '10pt', letterSpacing: '2px' }}>☐ | ☐</td>
                            {!isCutter1_5 ? (
                              <td style={{ border: '1.5px solid #000', paddingLeft: '4px' }}>{row.s2cF2}</td>
                            ) : (
                              <td style={{ border: '1.5px solid #000', paddingLeft: '4px' }}>{row.s2cF15}</td>
                            )}
                            <td style={{ border: '1.5px solid #000', textAlign: 'center', fontSize: '10pt' }}>☐</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ border: '1.5px solid #000', borderTop: 'none', display: 'flex', height: '35px' }}>
                    <div style={{ width: '130px', borderRight: '1.5px solid #000', background: '#fff', fontWeight: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8pt' }}>Коментар</div>
                    <div style={{ flex: 1 }}></div>
                  </div>
                  <div style={{ border: '1.5px solid #000', marginTop: '4px', display: 'flex', flexDirection: 'column', fontSize: '7.5pt' }}>
                    <div style={{ display: 'flex', borderBottom: '1.5px solid #000', background: '#f5f5f5', fontWeight: 900, textAlign: 'center' }}>
                      <div style={{ width: '70%', padding: '4px', borderRight: '1.5px solid #000' }}>Кількість використаних фрез</div>
                      <div style={{ width: '30%', padding: '4px' }}>Загалом використано фрез</div>
                    </div>
                    <div style={{ display: 'flex' }}>
                      <div style={{ width: '70%', borderRight: '1.5px solid #000', display: 'flex' }}>
                        <div style={{ width: '50%', borderRight: '1px solid #000', display: 'flex', flexDirection: 'column' }}>
                          <div style={{ display: 'flex', borderBottom: '1.5px solid #000', height: '24px' }}>
                            <div style={{ width: '40%', borderRight: '1px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>1,5мм</div>
                            <div style={{ width: '60%' }}></div>
                          </div>
                          <div style={{ display: 'flex', borderBottom: '1.5px solid #000', height: '24px' }}>
                            <div style={{ width: '40%', borderRight: '1px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>2мм</div>
                            <div style={{ width: '60%' }}></div>
                          </div>
                          <div style={{ display: 'flex', height: '24px' }}>
                            <div style={{ width: '40%', borderRight: '1px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>3мм</div>
                            <div style={{ width: '60%' }}></div>
                          </div>
                        </div>
                        <div style={{ width: '50%', display: 'flex', flexDirection: 'column' }}>
                          <div style={{ display: 'flex', borderBottom: '1.5px solid #000', height: '36px' }}>
                            <div style={{ width: '40%', borderRight: '1px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>4мм</div>
                            <div style={{ width: '60%' }}></div>
                          </div>
                          <div style={{ display: 'flex', height: '36px' }}>
                            <div style={{ width: '40%', borderRight: '1px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>6мм</div>
                            <div style={{ width: '60%' }}></div>
                          </div>
                        </div>
                      </div>
                      <div style={{ width: '30%', display: 'flex', flexDirection: 'column', fontWeight: 900, padding: '4px 8px', justifyContent: 'space-between' }}>
                        <div>1,5мм - </div>
                        <div>2мм - </div>
                        <div>3мм - </div>
                        <div>4мм - </div>
                        <div>6мм - </div>
                      </div>
                    </div>
                    <div style={{ marginTop: '2px', border: '1.5px solid #000', display: 'flex', fontSize: '7.5pt', height: '60px' }}>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                        <div style={{ width: '110px', padding: '2px', fontWeight: 1000, textAlign: 'center' }}>Причина браку:</div>
                        <div style={{ flex: 1, padding: '2px', fontSize: '5.5pt', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px' }}>
                          <div>☐ Биття цанги</div>
                          <div>☐ Помилка програми</div>
                          <div>☐ Збій станка</div>
                          <div>☐ Кривизна листа</div>
                          <div>☐ Поломка флешки</div>
                          <div>☐ Прив'язка</div>
                          <div>☐ Помилка оператора</div>
                          <div>☐ Інше (коментар)</div>
                        </div>
                      </div>
                      <div style={{ width: '120px', borderLeft: '1.5px solid #000', textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ borderBottom: '1px solid #000', padding: '2px', fontWeight: 1000 }}>Кількість браку</div>
                        <div style={{ flex: 1 }}></div>
                      </div>
                      <div style={{ width: '140px', borderLeft: '1.5px solid #000', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ borderBottom: '1px solid #000', padding: '2px', textAlign: 'center', fontWeight: 1000, fontSize: '6pt' }}>Корекція перегортання</div>
                        <div style={{ flex: 1, display: 'flex' }}>
                          <div style={{ flex: 1, borderRight: '1px solid #000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '7pt', fontWeight: 900 }}>X</span>
                            <div style={{ flex: 1 }}></div>
                          </div>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '7pt', fontWeight: 900 }}>Y</span>
                            <div style={{ flex: 1 }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
