import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Factory, ListTodo, Loader2, X, Printer, LayoutDashboard, Layers, User, Clock, Package, Scan, CheckCircle2, AlertTriangle, Camera, Tablet, Menu, Shuffle } from 'lucide-react'
import { useMES } from '../MESContext'
import { QRCodeSVG } from 'qrcode.react'
import { apiService } from '../services/apiDispatcher'
import { supabase } from '../supabase'

const ForemanWorkplace = () => {
  const { tasks, orders, workCards, createWorkCard, inventory, completeTaskByMaster, handoverTaskToShop2, cancelHandoverToShop2, nomenclatures, bomItems, machines, workCardHistory, confirmBuffer, fetchData, reserveBZForTask } = useMES()
  const [activeTaskId, setActiveTaskId] = useState(null)
  const [activeView, setActiveView] = useState('worksheet')
  const [selectedMachines, setSelectedMachines] = useState({})
  const [editingSplits, setEditingSplits] = useState({}) // { nomId: [{machine, qty}] }
  const saveTimeoutRef = useRef(null)
  const [genModal, setGenModal] = useState(null)
  const [printQueue, setPrintQueue] = useState(null)
  const [partialCounts, setPartialCounts] = useState({}) // For partial generation in modal
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  const [isBufferScanning, setIsBufferScanning] = useState(false)
  const [bufferScrapModal, setBufferScrapModal] = useState(null)
  const [bufferScrapCounts, setBufferScrapCounts] = useState({})

  const getBOMParts = (nomenclatureId) => {
    return bomItems
      .filter(b => b.parent_id === nomenclatureId)
      .map(b => ({
        ...b,
        nom: nomenclatures.find(n => n.id === b.child_id)
      }))
  }

  const findMachine = (name) => {
    if (!name || name === 'Не вказано') return null
    const baseName = name.split(' №')[0].trim()
    return machines.find(m => m.name === baseName) || machines.find(m => m.name === name)
  }


  const handleCloseNaryad = async (taskId) => {
    if (!window.confirm("Ви впевнені, що хочете закрити цей наряд?")) return
    try {
      await completeTaskByMaster(taskId)
      setActiveTaskId(null)
      fetchData()
    } catch (err) {
      alert("Помилка: " + err.message)
    }
  }

  const handleHandoverToShop2 = async (taskId) => {
    try {
      await handoverTaskToShop2(taskId)
      setActiveTaskId(null)
      fetchData()
    } catch (err) {
      alert("Помилка при передачі: " + err.message)
    }
  }

  // 0. Per-task readiness: all Shop-1 cards produced >= need
  const taskReadinessMap = useMemo(() => {
    const map = {}
    tasks.forEach(task => {
      if (task.status === 'completed') { map[task.id] = false; return }
      const order = orders.find(o => o.id === task.order_id)
      const taskCards = workCards.filter(c => c.task_id === task.id)
      const isReady = order?.order_items?.every(item => {
        const parts = bomItems
          .filter(b => b.parent_id === item.nomenclature_id)
          .map(b => ({ ...b, nom: nomenclatures.find(n => n.id === b.child_id) }))
        const rows = parts.length > 0
          ? parts
          : [{ nom: nomenclatures.find(n => n.id === item.nomenclature_id), quantity_per_parent: 1 }]
        const shop1Parts = rows.filter(r => r.nom?.type === 'part')
        if (shop1Parts.length === 0) return true
        return shop1Parts.every(part => {
          const snapshot = task.plan_snapshot?.[String(part.nom?.id)]
          const need = snapshot
            ? snapshot.need
            : (Number(item.quantity) * (Number(part.quantity_per_parent) || 1))
          if (need === 0) return true
          const produced = taskCards
            .filter(c => String(c.nomenclature_id) === String(part.nom?.id))
            .reduce((sum, c) => sum + (c.status === 'completed' ? Number(c.quantity) : 0), 0)
          return produced >= need
        })
      })
      map[task.id] = Boolean(isReady)
    })
    return map
  }, [tasks, orders, workCards, nomenclatures, bomItems])

  // 0b. Per-task shortage map — needs ДОВИПУСК (scrap exceeded BZ buffer, no REDO card yet)
  const taskShortageMap = useMemo(() => {
    const map = {}
    tasks.forEach(task => {
      if (task.status === 'completed') { map[task.id] = false; return }
      const snapshot = task.plan_snapshot || {}
      const taskCards = workCards.filter(c => c.task_id === task.id)
      const cardIds = taskCards.map(c => String(c.id))
      const taskHistory = workCardHistory.filter(h => cardIds.includes(String(h.card_id)))
      let hasShortage = false
      Object.keys(snapshot).forEach(nomIdStr => {
        if (hasShortage) return
        const nom = nomenclatures.find(n => String(n.id) === String(nomIdStr))
        if (nom?.type !== 'part') return
        const snap = snapshot[nomIdStr]
        if (!snap) return
        const need = snap.need || 0
        const unitsPerSheet = snap.units_per_sheet || 1
        const sheets = snap.sheets || 0
        const activeCards = taskCards.filter(c => String(c.nomenclature_id) === String(nomIdStr))
        const groupScrap = taskHistory
          .filter(h => activeCards.some(c => String(c.id) === String(h.card_id)))
          .reduce((sum, h) => sum + (Number(h.scrap_qty) || 0), 0)
        const initialBZ = (sheets * unitsPerSheet) - need
        const shortage = (initialBZ - groupScrap) < 0 ? Math.abs(initialBZ - groupScrap) : 0
        // Needs ДОВИПУСК: shortage > 0 AND no REDO card generated yet
        if (shortage > 0 && !activeCards.some(c => (c.card_info || '').includes('[REDO]'))) {
          hasShortage = true
        }
      })
      map[task.id] = hasShortage
    })
    return map
  }, [tasks, workCards, workCardHistory, nomenclatures])

  const relevantTasks = useMemo(() => {
    return tasks
      .filter(t => t.warehouse_conf && t.engineer_conf && t.director_conf && (t.step === 'Лазерний розкрій' || t.step === 'Лазерна різка'))
      .sort((a, b) => {
        // Already transferred → bottom
        if (a.status === 'completed' && b.status !== 'completed') return 1
        if (a.status !== 'completed' && b.status === 'completed') return -1
        // Ready for Shop 2 → top
        if (taskReadinessMap[a.id] && !taskReadinessMap[b.id]) return -1
        if (!taskReadinessMap[a.id] && taskReadinessMap[b.id]) return 1
        // Needs ДОВИПУСК → second
        if (taskShortageMap[a.id] && !taskShortageMap[b.id]) return -1
        if (!taskShortageMap[a.id] && taskShortageMap[b.id]) return 1
        return new Date(b.created_at) - new Date(a.created_at)
      })
  }, [tasks, taskReadinessMap, taskShortageMap])

  const handleGenerateFromWorksheet = async (task, part, sheets, selectedMachineName, count, localGeneratedCount = 0, totalToReach = 0, isRepair = false, globalTotalCards = null, globalSeqOffset = 0) => {
    const machineObj = findMachine(selectedMachineName)
    const capacity = Number(machineObj?.sheet_capacity) || 1
    const unitsPerSheet = Number(part.nom?.units_per_sheet) || 1

    const maxCardsForThisSplit = Math.ceil(sheets / capacity)
    const displayTotal = globalTotalCards || maxCardsForThisSplit

    // CLAMP: Don't allow generating more than planned for this specific machine split
    const finalCount = Math.min(count, maxCardsForThisSplit - localGeneratedCount)
    if (finalCount <= 0) return

    // DYNAMIC NUMBERING: Find absolute max sequence across ALL machines for this nomenclature
    const existingNomenclatureCards = (workCards || []).filter(wc => 
      String(wc.task_id) === String(task.id) &&
      String(wc.nomenclature_id) === String(part.nom?.id)
    )

    let maxExistingSeq = 0
    existingNomenclatureCards.forEach(wc => {
      const match = (wc.card_info || '').match(/(\d+)\/(\d+)/)
      if (match) {
        const seq = parseInt(match[1])
        if (seq > maxExistingSeq) maxExistingSeq = seq
      }
    })

    const startSeqForThisBatch = maxExistingSeq + 1

    setIsGenerating(true)
    try {
      const cardsBatch = []

      // PRECISE PROGRESS TRACKING: Check how many sheets of THIS NOMENCLATURE are already accounted for
      const globalSheetsMadeTotal = existingNomenclatureCards.reduce((sum, wc) => {
        if (wc.actualSheets) return sum + Number(wc.actualSheets)
        return sum + Math.ceil((Number(wc.quantity) || 0) / unitsPerSheet)
      }, 0)

      // Start calculating for THIS SPLIT
      // localIdx tracks where we are in CURRENT machine split
      let sheetsRemainingForThisSplit = sheets - (localGeneratedCount * capacity)
      
      // FIX: Use the Snapshot's NEED (e.g. 1000) not just the Plan (e.g. 775)
      // for the purpose of the REQ/BZ labels on the card.
      const snapshotEntry = task.plan_snapshot?.[String(part.nom?.id)]
      const originalNeed = snapshotEntry?.need || totalToReach || 0
      
      let reqRemainingForThisSplit = originalNeed - (localGeneratedCount * capacity * unitsPerSheet)
      if (reqRemainingForThisSplit < 0) reqRemainingForThisSplit = 0

      for (let i = 1; i <= finalCount; i++) {
        // Sequential numbering
        const currentSeq = startSeqForThisBatch + (i - 1)
        
        // Use EXACT MIN logic to ensure we don't exceed the split or nomenclature capacity
        const sheetsInThisLoading = Math.min(sheetsRemainingForThisSplit, capacity)
        const qtyInThisLoading = Math.ceil(sheetsInThisLoading * unitsPerSheet)
        const reqInThisLoading = Math.min(qtyInThisLoading, reqRemainingForThisSplit)
        const bzInThisLoading = Math.max(0, qtyInThisLoading - reqInThisLoading)

        const prefix = isRepair ? '[REDO] ' : ''
        cardsBatch.push({
          operation: 'Лазерний розкрій',
          machine: selectedMachineName || 'Не вказано',
          estimatedTime: (Number(part.nom?.time_per_unit) || 0) * reqInThisLoading,
          cardInfo: `${prefix}${currentSeq}/${displayTotal}${originalNeed > 0 ? ` [NEED:${originalNeed}]` : ''} [REQ:${reqInThisLoading}] [BZ:${bzInThisLoading}]`,
          quantity: qtyInThisLoading,
          bufferQty: bzInThisLoading,
          actualSheets: sheetsInThisLoading
        })

        sheetsRemainingForThisSplit -= sheetsInThisLoading
        reqRemainingForThisSplit -= reqInThisLoading
        if (reqRemainingForThisSplit < 0) reqRemainingForThisSplit = 0
      }

      const createdCards = await apiService.submitCreateWorkCardsBatch(task.id, task.order_id, part.nom.id, cardsBatch, createWorkCard)
      
      if (isRepair && sheets > 0) {
        const order = orders.find(o => o.id === task.order_id)
        const matName = part.nom?.material_type || part.nom?.name || 'Склад Оперативний'
        await supabase.from('material_requests').insert([{
          order_id: task.order_id,
          task_id: task.id,
          quantity: sheets,
          status: 'pending',
          details: `ДОЗАПИТ (БРАК/НЕСТАЧА) для ${order?.order_num || '???'}: ${matName} — ${sheets} л.`
        }])
      }

      if (createdCards && createdCards.length > 0) {
        setPrintQueue({
          task,
          part,
          total: displayTotal,
          created: startSeqForThisBatch,
          metadata: createdCards.map((c, idx) => {
            const batchItem = cardsBatch[idx]
            return {
              id: c.id,
              loading: c.card_info,
              qty: batchItem ? batchItem.quantity : 0,
              estimatedTime: (Number(part.nom?.time_per_unit) || 0) * (batchItem ? batchItem.quantity : 0),
              totalLoadings: displayTotal,
              sheetsPerLoading: batchItem ? batchItem.actualSheets : capacity, // Use ACTUAL sheets
              machine: selectedMachineName
            }
          })
        })
      }
    } catch (err) {
      alert('Помилка: ' + err.message)
    } finally {
      setTimeout(() => {
        setIsGenerating(false)
        setGenModal(null)
      }, 500)
    }
  }

  const handleBufferReception = async (cardId) => {
    const card = workCards.find(c => String(c.id) === String(cardId))
    if (!card) { alert("Картку не знайдено!"); return; }
    setBufferScrapModal({ cardId: card.id, nomenclature_id: card.nomenclature_id })
    setBufferScrapCounts({ [card.nomenclature_id]: 0 })
  }

  const submitBufferReception = async () => {
    if (!bufferScrapModal) return
    const scrap = bufferScrapCounts[bufferScrapModal.nomenclature_id] || 0
    try {
      await confirmBuffer(bufferScrapModal.cardId, scrap)
      setBufferScrapModal(null)
      fetchData()
    } catch (err) {
      alert("Помилка: " + err.message)
    }
  }

  const handleReserveBZ = async (taskId, orderId, nomId, qty) => {
    if (!window.confirm(`Забронювати ${qty} шт. зі складу БЗ?`)) return
    try {
      await reserveBZForTask(taskId, orderId, nomId, qty)
      alert("Деталі заброньовано!")
    } catch (err) {
      alert("Помилка: " + err.message)
    }
  }

  const handleUpdateMachineInSnapshot = async (task, nomId, machineName = null, splits = null) => {
    if (!task || !nomId) return
    const sId = String(nomId)
    const currentSnapshot = task.plan_snapshot || {}
    
    // Construct updated entry
    const entry = { ...(currentSnapshot[sId] || {}) }
    if (machineName !== null) entry.machine = machineName
    if (splits !== null) entry.splits = splits

    const updatedSnapshot = {
      ...currentSnapshot,
      [sId]: entry
    }
    try {
      const { error } = await supabase.from('tasks').update({ plan_snapshot: updatedSnapshot }).eq('id', task.id)
      if (error) throw error
      // Only fetchData if we are NOT in the middle of a local edit update to avoid flicker
      if (!saveTimeoutRef.current) fetchData()
    } catch (err) { console.error("Snapshot error:", err) }
  }

  const debouncedUpdateSplits = (task, nomId, newSplits) => {
    // 1. Update local state immediately for UI response
    setEditingSplits(prev => ({ ...prev, [nomId]: newSplits }))
    
    // 2. Clear old timeout
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    
    // 3. Set new timeout to sync with DB
    saveTimeoutRef.current = setTimeout(() => {
      handleUpdateMachineInSnapshot(task, nomId, null, newSplits)
      saveTimeoutRef.current = null
    }, 1000) // 1 second debounce
  }

  React.useEffect(() => {
    let html5QrCode = null
    if (isBufferScanning && window.Html5Qrcode) {
      html5QrCode = new window.Html5Qrcode("buffer-reader")
      const config = { fps: 15, qrbox: { width: 260, height: 260 } }
      html5QrCode.start(
        { facingMode: "environment" }, config, async (decodedText) => {
          if (decodedText.startsWith("CENTRUM_CARD_")) {
            const cardId = decodedText.replace("CENTRUM_CARD_", "").trim()
            if (html5QrCode && html5QrCode.isScanning) await html5QrCode.stop()
            handleBufferReception(cardId)
          }
        }
      ).catch(e => console.error(e))
    }
    return () => { if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop().catch(() => { }) }
  }, [isBufferScanning])

  return (
    <div className="foreman-module" style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <header className="module-nav no-print">
        <Link to="/" className="back-link">
          <ArrowLeft size={18} /> <span className="hide-mobile">На головну</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => setIsDrawerOpen(true)} className="mobile-only burger-btn" style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
            <Menu size={24} />
          </button>
          <Factory size={22} color="#ef4444" />
          <h1 style={{ margin: 0, textTransform: 'uppercase', fontSize: '1rem', fontWeight: 900 }}>ВИРОБНИЦТВО</h1>
        </div>
        <div style={{ fontWeight: 900, color: '#ef4444', fontSize: '0.75rem' }} className="hide-mobile">РЕЖИМ МАЙСТРА</div>
      </header>

      {isDrawerOpen && (
        <div
          className="drawer-backdrop no-print"
          onClick={() => setIsDrawerOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, backdropFilter: 'blur(4px)' }}
        />
      )}

      <div className="master-grid no-print">
        <div
          className={`side-panel no-print ${isDrawerOpen ? 'drawer-open' : ''}`}
          style={{ width: '300px', display: 'flex', flexDirection: 'column', background: '#121212', borderRight: '1px solid #222', transition: '0.3s transform' }}
        >
          <div style={{ padding: '20px', color: '#444', fontWeight: 800, fontSize: '0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            ЧЕРГА НАРЯДІВ ({relevantTasks.length})
            {isDrawerOpen && (
              <button onClick={() => setIsDrawerOpen(false)} style={{ background: 'transparent', border: 'none', color: '#555' }}>
                <X size={18} />
              </button>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {relevantTasks.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(task => {
              const order = orders.find(o => o.id === task.order_id)
              const isActive = activeTaskId === task.id
              const isReady = taskReadinessMap[task.id]
              const isShortage = taskShortageMap[task.id]
              const isCompleted = task.status === 'completed'

              const borderColor = isActive
                ? '#ef4444'
                : isReady && !isCompleted
                  ? '#10b981'
                  : isShortage && !isCompleted
                    ? '#f97316'
                    : 'transparent'

              const bgColor = isActive
                ? '#1a1a1a'
                : isReady && !isCompleted
                  ? 'rgba(16, 185, 129, 0.06)'
                  : isShortage && !isCompleted
                    ? 'rgba(249, 115, 22, 0.06)'
                    : 'transparent'

              return (
                <div
                  key={task.id}
                  onClick={() => { setActiveTaskId(task.id); setIsDrawerOpen(false); }}
                  style={{ padding: '15px', borderLeft: `4px solid ${borderColor}`, background: bgColor, cursor: 'pointer', transition: 'background 0.2s' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: isCompleted ? '#555' : '#fff' }}>
                      № {order?.order_num}{task.batch_index ? `/${task.batch_index}` : ''}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      {isCompleted && <CheckCircle2 size={14} color="#10b981" />}
                      {isReady && !isCompleted && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px', padding: '2px 7px' }}>
                          <ArrowRight size={9} color="#10b981" />
                          <span style={{ fontSize: '0.55rem', fontWeight: 900, color: '#10b981', letterSpacing: '0.5px' }}>ЦЕХ №2</span>
                        </div>
                      )}
                      {isShortage && !isCompleted && !isReady && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '6px', padding: '2px 7px' }}>
                          <AlertTriangle size={9} color="#ef4444" />
                          <span style={{ fontSize: '0.55rem', fontWeight: 900, color: '#ef4444', letterSpacing: '0.5px' }}>НЕСТАЧА</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: isCompleted ? '#333' : '#555' }}>{order?.customer}</div>
                  {isCompleted && <div style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 900, marginTop: '4px' }}>ВИКОНАНО</div>}
                  {isReady && !isCompleted && (
                    <div style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 900, marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={10} />
                      ВСІ КАРТКИ ГОТОВІ — ПЕРЕДАТИ
                    </div>
                  )}
                  {isShortage && !isCompleted && !isReady && (
                    <div style={{ fontSize: '0.6rem', color: '#ef4444', fontWeight: 900, marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertTriangle size={10} />
                      ПОТРІБЕН ДОВИПУСК
                    </div>
                  )}
                  {isCompleted && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        cancelHandoverToShop2(task.id).catch(err => alert('Помилка: ' + err.message))
                      }}
                      style={{ marginTop: '6px', background: 'transparent', border: '1px solid #333', color: '#444', fontSize: '0.55rem', fontWeight: 900, padding: '2px 8px', borderRadius: '6px', cursor: 'pointer', letterSpacing: '0.5px', display: 'block' }}
                    >
                      ↩ СКАСУВАТИ ПЕРЕДАЧУ
                    </button>
                  )}
                </div>
              )
            })}
            {relevantTasks.length === 0 && (
              <div style={{ padding: '20px', color: '#333', fontSize: '0.8rem' }}>Немає нарядів</div>
            )}
          </div>
          {relevantTasks.length > itemsPerPage && (
            <div style={{ padding: '15px', borderTop: '1px solid #222', display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                style={{ background: '#222', border: 'none', color: '#fff', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', opacity: currentPage === 1 ? 0.3 : 1 }}
              >Назад</button>
              <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 800, display: 'flex', alignItems: 'center' }}>
                {currentPage} / {Math.ceil(relevantTasks.length / itemsPerPage)}
              </div>
              <button
                disabled={currentPage === Math.ceil(relevantTasks.length / itemsPerPage)}
                onClick={() => setCurrentPage(p => p + 1)}
                style={{ background: '#222', border: 'none', color: '#fff', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', opacity: currentPage === Math.ceil(relevantTasks.length / itemsPerPage) ? 0.3 : 1 }}
              >Вперед</button>
            </div>
          )}
        </div>

        <div className="content-panel" style={{ flex: 1, background: '#0a0a0a' }}>
          <div style={{ marginBottom: '30px', display: 'flex', gap: '20px', borderBottom: '1px solid #1a1a1a', paddingBottom: '10px' }}>
            <button
              onClick={() => setActiveView('worksheet')}
              style={{ background: 'transparent', border: 'none', color: activeView === 'worksheet' ? '#ef4444' : '#555', fontSize: '0.85rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: activeView === 'worksheet' ? '2px solid #ef4444' : '2px solid transparent', paddingBottom: '10px', transition: '0.2s' }}
            >
              <ListTodo size={18} /> РОБОЧІ НАРЯДИ
            </button>
            <Link
              to="/operator-terminal"
              style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid #eab308', color: '#eab308', fontSize: '0.8rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 15px', borderRadius: '10px', textDecoration: 'none', marginLeft: 'auto' }}
            >
              <Tablet size={16} /> ВІДКРИТИ ТЕРМІНАЛ ЦЕХУ
            </Link>
          </div>

          {activeTaskId ? (
            (() => {
              const task = relevantTasks.find(t => t.id === activeTaskId)
              const order = orders.find(o => o.id === task.order_id)
              const taskCards = workCards.filter(c => c.task_id === task.id)
              const isReworkOrder = order?.order_num?.startsWith('ВБ')
              
              // Fallback for Product Names: if order has no items (internal rework), use snapshot names
              let productNames = order?.order_items?.map(it => nomenclatures.find(n => n.id === it.nomenclature_id)?.name).filter(Boolean).join(', ')
              if (!productNames && task.plan_snapshot) {
                productNames = Object.values(task.plan_snapshot)
                  .map(s => nomenclatures.find(n => String(n.id) === String(s.id))?.name || s.name)
                  .filter(Boolean)
                  .join(', ')
              }

              // ПЕРЕВІРКА НА ПОВНЕ ВИКОНАННЯ
              const isTaskComplete = order?.order_items?.every(item => {
                const parts = getBOMParts(item.nomenclature_id)
                const rows = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === item.nomenclature_id), quantity_per_parent: 1 }]
                const shop1Parts = rows.filter(r => r.nom?.type === 'part')
                return shop1Parts.every(part => {
                  const snapshot = task.plan_snapshot?.[String(part.nom?.id)]
                  const need = snapshot ? snapshot.need : (Number(item.quantity) * (Number(part.quantity_per_parent) || 1))
                  const produced = taskCards
                    .filter(c => String(c.nomenclature_id) === String(part.nom?.id))
                    .reduce((sum, c) => sum + (c.status === 'completed' ? Number(c.quantity) : 0), 0)
                  return produced >= need
                })
              })

              return (
                <div style={{ maxWidth: '1200px' }} className="anim-fade-in">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
                    <div>
                      <h2 style={{ fontSize: '2.4rem', fontWeight: 950, margin: 0 }}>
                        Наряд №{order?.order_num}{task.batch_index ? `/${task.batch_index}` : ''}
                      </h2>
                      <div style={{ color: '#555', marginTop: '5px', fontSize: '1.1rem', fontWeight: 800 }}>
                        ВИРІБ: <strong style={{ color: '#ef4444' }}>{productNames || '—'}</strong> | {order?.customer}
                        {task.batch_index && (
                          <span style={{ marginLeft: '15px', background: '#eab308', color: '#000', padding: '2px 8px', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 900 }}>
                            ПАРТІЯ №{task.batch_index}
                          </span>
                        )}
                      </div>
                    </div>
                    {(isTaskComplete || task.status === 'completed') && (
                      <button
                        onClick={() => handleHandoverToShop2(task.id)}
                        className="btn-primary"
                        disabled={task.status === 'completed'}
                        style={{ 
                          background: task.status === 'completed' ? '#222' : '#10b981', 
                          color: task.status === 'completed' ? '#555' : '#fff', 
                          border: 'none', 
                          padding: '12px 25px', 
                          borderRadius: '12px', 
                          fontWeight: 900, 
                          cursor: task.status === 'completed' ? 'default' : 'pointer',
                          boxShadow: task.status !== 'completed' ? '0 10px 20px -5px rgba(16, 185, 129, 0.4)' : 'none',
                          transition: '0.3s'
                        }}
                      >
                        {task.status === 'completed' ? 'ПЕРЕДАНО В ЦЕХ №2' : 'ПЕРЕВЕСТИ В ЦЕХ №2'}
                      </button>
                    )}
                  </div>

                  {/* ───── ТАБЛИЦЯ ДЕТАЛЕЙ ───── */}
                  <div style={{ marginBottom: '40px', background: '#111', borderRadius: '20px', overflow: 'hidden', border: '1px solid #222' }}>
                    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                      <table style={{ width: '100%', minWidth: '1150px', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ background: '#1a1a1a', textAlign: 'left', color: '#555', textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: 900 }}>
                            <th style={{ padding: '12px 15px', width: '18%' }}>ДЕТАЛЬ В РОЗКРІЙ</th>
                            <th style={{ padding: '12px 15px', textAlign: 'center' }}>ПОТРЕБА</th>
                            {!isReworkOrder && (
                              <>
                                <th style={{ padding: '12px 15px', textAlign: 'center' }}>СКЛАД БЗ</th>
                                <th style={{ padding: '12px 15px', textAlign: 'center', color: '#eab308' }}>ПЛАН</th>
                              </>
                            )}
                            <th style={{ padding: '12px 15px', textAlign: 'center' }}>МАТЕРІАЛ</th>
                            <th style={{ padding: '12px 15px', textAlign: 'center' }}>ШТ/Л</th>
                            <th style={{ padding: '12px 15px', textAlign: 'center', color: '#10b981' }}>ЛИСТІВ</th>
                            <th style={{ padding: '12px 15px', width: '14%' }}>ВЕРСТАТ</th>
                            <th style={{ padding: '12px 15px', textAlign: 'center', color: '#3b82f6' }}>ЗАВАНТ.</th>
                            {!isReworkOrder && <th style={{ padding: '12px 15px', textAlign: 'center', color: '#ef4444' }}>БЗ</th>}
                            <th style={{ padding: '12px 15px', textAlign: 'center' }}>ДІЇ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order?.order_items?.flatMap(item => {
                            const parts = getBOMParts(item.nomenclature_id)
                            const initialRows = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === item.nomenclature_id), quantity_per_parent: 1 }]
                            
                            // Filter: Only show parts in Shop 1 (exclude hardware/fasteners)
                            const rows = initialRows.filter(r => r.nom?.type === 'part')
                            
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
                                const bzInv = (inventory || []).find(i => String(i.nomenclature_id) === String(nomId) && i.type === 'bz')
                                stockBZ = bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0
                                plan = Math.max(0, need - stockBZ)
                                unitsPerSheet = Number(part.nom?.units_per_sheet) || 1
                                sheets = Math.ceil(plan / unitsPerSheet)
                              }

                              const existing = taskCards.filter(c => String(c.nomenclature_id) === String(nomId))
                              const productionCards = existing.filter(c => c.operation !== 'Склад БЗ')
                              const reworks = productionCards.filter(c => (c.card_info || '').includes('[REDO]'))
                              const redoCount = reworks.length

                              const rowMachineName = (productionCards.length > 0 && productionCards[0].machine && productionCards[0].machine !== 'Не вказано') 
                                ? productionCards[0].machine 
                                : ((task.plan_snapshot || {})[String(nomId)]?.machine || selectedMachines[rowId] || '')
                              
                              // Use local state if it exists (for fluid typing), fallback to context
                              const splits = editingSplits[nomId] || (task.plan_snapshot || {})[String(nomId)]?.splits || []
                              const isSplitMode = splits.length > 0
                              const totalSheetsNeeded = sheets // This is the total sheets for the whole naryad row

                              const machineCapacity = findMachine(rowMachineName)?.sheet_capacity || 1

                              const baseLoads = rowMachineName ? Math.ceil(sheets / machineCapacity) : (sheets || 0)
                              const loads = (plan === 0 && existing.some(c => c.operation === 'Склад БЗ')) ? 1 : baseLoads

                              // Split logic for totalTargetLoads
                              let totalTargetLoads = loads
                              if (isSplitMode) {
                                totalTargetLoads = splits.reduce((sum, s) => {
                                  const cap = findMachine(s.machine)?.sheet_capacity || 1
                                  const sSheets = Number(s.sheets) || (unitsPerSheet > 0 ? Math.ceil((Number(s.qty) || 0) / unitsPerSheet) : 0)
                                  return sum + Math.ceil(sSheets / cap)
                                }, 0)
                              }
                              
                              totalTargetLoads += redoCount
                              const surplus = sheets > 0 ? Math.max(0, (sheets * unitsPerSheet) - plan) : 0

                              return (
                                <tr key={rowId} style={{ borderBottom: '1px solid #1a1a1a' }}>
                                  <td style={{ padding: '15px' }}>
                                    <div style={{ fontWeight: 800, color: '#fff' }}>{part.nom?.name || '—'}</div>
                                    <div style={{ fontSize: '0.65rem', color: '#444' }}>{part.nom?.nomenclature_code || 'БЕЗ КОДУ'}</div>
                                  </td>
                                  <td style={{ padding: '15px', textAlign: 'center', color: '#666' }}>{need}</td>
                                  {!isReworkOrder && (
                                    <>
                                      <td style={{ padding: '15px', textAlign: 'center', color: '#666' }}>{stockBZ}</td>
                                      <td style={{ padding: '15px', textAlign: 'center', color: '#eab308', fontWeight: 900 }}>{plan}</td>
                                    </>
                                  )}
                                  <td style={{ padding: '15px', textAlign: 'center', color: '#aaa', fontSize: '0.75rem' }}>{part.nom?.material_type || '—'}</td>
                                  <td style={{ padding: '15px', textAlign: 'center' }}>{unitsPerSheet}</td>
                                  <td style={{ padding: '15px', textAlign: 'center', color: '#10b981', fontWeight: 1000, fontSize: '1.1rem' }}>{sheets}</td>
                                  <td style={{ padding: '15px' }}>
                                    {!isSplitMode ? (
                                      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                        <select
                                          value={rowMachineName || ''}
                                          disabled={productionCards.length > 0 || plan === 0}
                                          onChange={(e) => {
                                            const mName = e.target.value
                                            setSelectedMachines(p => ({ ...p, [rowId]: mName }))
                                            handleUpdateMachineInSnapshot(task, nomId, mName)
                                          }}
                                          style={{ flex: 1, background: '#000', border: rowMachineName || plan === 0 ? '1px solid #333' : '1px solid #ef4444', color: rowMachineName || plan === 0 ? '#fff' : '#ef4444', padding: '8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, opacity: plan === 0 ? 0.3 : 1 }}
                                        >
                                          <option value="">{plan === 0 ? 'Не потрібно' : 'Оберіть верстат'}</option>
                                          {machines.map(m => <option key={m.id} value={m.name}>{m.name} ({m.sheet_capacity} л.)</option>)}
                                        </select>
                                        {plan > 0 && productionCards.length === 0 && (
                                          <button 
                                            onClick={() => {
                                              const initialSplits = [{ machine: rowMachineName || '', qty: plan }]
                                              handleUpdateMachineInSnapshot(task, nomId, null, initialSplits)
                                            }}
                                            title="Розділити на кілька верстатів"
                                            style={{ background: '#222', border: 'none', color: '#555', cursor: 'pointer', padding: '8px', borderRadius: '8px' }}
                                          >
                                            <Shuffle size={16} />
                                          </button>
                                        )}
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {splits.map((s, sIdx) => {
                                          const cap = findMachine(s.machine)?.sheet_capacity || 1
                                          const sh = Math.ceil(Number(s.qty) / (unitsPerSheet || 1))
                                          const l = Math.ceil(sh / cap)
                                          return (
                                            <div key={sIdx} style={{ display: 'flex', gap: '5px', alignItems: 'center', background: '#080808', padding: '5px', borderRadius: '8px', border: '1px solid #151515' }}>
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
                                                  // Force sync on blur
                                                  if (saveTimeoutRef.current) {
                                                    clearTimeout(saveTimeoutRef.current)
                                                    handleUpdateMachineInSnapshot(task, nomId, null, splits)
                                                    saveTimeoutRef.current = null
                                                  }
                                                }}
                                                style={{ width: '80px', background: '#000', border: '1px solid #333', color: '#fff', padding: '10px 5px', borderRadius: '8px', fontSize: '1rem', fontWeight: 950, textAlign: 'center', outline: 'none' }}
                                              />
                                              <select
                                                value={s.machine || ''}
                                                onChange={(e) => {
                                                  const newSplits = [...splits]
                                                  newSplits[sIdx].machine = e.target.value
                                                  debouncedUpdateSplits(task, nomId, newSplits)
                                                }}
                                                style={{ flex: 1, background: '#000', border: '1px solid #222', color: '#fff', padding: '5px', borderRadius: '6px', fontSize: '0.7rem' }}
                                              >
                                                <option value="">Верстат</option>
                                                {machines.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                                              </select>
                                              <span style={{ fontSize: '0.65rem', color: '#444', fontWeight: 900, minWidth: '35px' }}>{l} завант.</span>
                                              <button 
                                                onClick={() => {
                                                  const newSplits = splits.filter((_, i) => i !== sIdx)
                                                  handleUpdateMachineInSnapshot(task, nomId, null, newSplits.length === 0 ? null : newSplits)
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
                                              handleUpdateMachineInSnapshot(task, nomId, null, newSplits)
                                            }}
                                            style={{ flex: 1, background: '#111', border: '1px solid #222', color: '#555', fontSize: '0.6rem', padding: '5px', borderRadius: '6px', cursor: 'pointer', fontWeight: 800 }}
                                          >
                                            + ДОДАТИ ВЕРСТАТ
                                          </button>
                                          <button 
                                            onClick={() => handleUpdateMachineInSnapshot(task, nomId, null, [])}
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
                                  <td style={{ padding: '15px', textAlign: 'center', color: '#3b82f6', fontWeight: 1000, fontSize: '1.2rem' }}>
                                    {rowMachineName || isSplitMode ? (
                                      <>
                                        <span style={{ color: productionCards.length < totalTargetLoads ? '#444' : '#3b82f6' }}>{productionCards.length}</span>
                                        <span style={{ color: '#222', margin: '0 5px' }}>/</span>
                                        <span>{totalTargetLoads}</span>
                                        {redoCount > 0 && <span style={{ fontSize: '0.7rem', color: '#ef4444', marginLeft: '5px' }}>+{redoCount}</span>}
                                      </>
                                    ) : (
                                      <span style={{ color: '#222', fontSize: '0.8rem' }}>—</span>
                                    )}
                                  </td>
                                  {!isReworkOrder && (
                                    <td style={{ padding: '15px', textAlign: 'center', color: '#ef4444', fontWeight: 900 }}>{surplus > 0 ? `+${surplus}` : '0'}</td>
                                  )}
                                  <td style={{ padding: '15px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                      {plan === 0 ? (
                                        (stockBZ > 0 && existing.find(c => c.operation === 'Склад БЗ')) ? (
                                          <div style={{ background: '#3b82f620', border: '1px solid #3b82f640', color: '#3b82f6', padding: '8px 12px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: 950, textTransform: 'uppercase' }}>
                                            ЗАБРОНЬОВАНО ({stockBZ})
                                          </div>
                                        ) : (
                                          <div style={{ color: '#222', fontSize: '0.6rem', fontWeight: 900 }}>НЕ ПОТРЕБУЄ ДІЇ</div>
                                        )
                                      ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                          {stockBZ > 0 && (
                                            <div style={{ background: '#3b82f622', border: '1px solid #3b82f644', color: '#3b82f6', padding: '6px 10px', borderRadius: '8px', fontSize: '0.6rem', fontWeight: 950, textAlign: 'center' }}>
                                              ЗАБРОНЬОВАНО: {stockBZ} шт
                                            </div>
                                          )}
                                          {(productionCards.length === 0 || productionCards.length < totalTargetLoads) && (
                                            <button
                                              onClick={() => {
                                                const currentSumSheets = splits.reduce((a, b) => a + (Number(b.sheets) || (unitsPerSheet > 0 ? Math.ceil((Number(b.qty) || 0) / unitsPerSheet) : 0)), 0);
                                                if (isSplitMode && currentSumSheets > totalSheetsNeeded) {
                                                  alert(`Помилка: Ви запланували ${currentSumSheets} листів, що більше за план (${totalSheetsNeeded} л.). Виправте кількість перед генерацією.`);
                                                  return;
                                                }

                                                if (isSplitMode) {
                                                  setGenModal({ 
                                                    task, part, 
                                                    total: totalTargetLoads, 
                                                    requirement: plan, 
                                                    created: productionCards.length, 
                                                    rowId, 
                                                    machineName: rowMachineName || splits[0]?.machine, 
                                                    sheets,
                                                    splits: splits 
                                                  })
                                                } else {
                                                  if (!rowMachineName) return;
                                                  setGenModal({ task, part, total: totalTargetLoads, requirement: plan, created: productionCards.length, rowId, machineName: rowMachineName, sheets })
                                                }
                                              }}
                                              style={{ 
                                                background: (rowMachineName || isSplitMode) ? '#ff9000' : '#222', 
                                                color: (rowMachineName || isSplitMode) ? '#000' : '#444', 
                                                border: 'none', 
                                                padding: '8px 15px', 
                                                borderRadius: '8px', 
                                                fontSize: '0.65rem', 
                                                fontWeight: 900, 
                                                cursor: (rowMachineName || isSplitMode) ? 'pointer' : 'not-allowed', 
                                                textTransform: 'uppercase',
                                                opacity: (isSplitMode && splits.reduce((a, b) => a + (Number(b.sheets) || (unitsPerSheet > 0 ? Math.ceil((Number(b.qty) || 0) / unitsPerSheet) : 0)), 0) > totalSheetsNeeded) ? 0.3 : 1
                                              }}
                                            >
                                              Генерувати
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
                                              estimatedTime: (Number(part.nom?.time_per_unit) || 0) * (Number(c.quantity) || 0)
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
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#444', textTransform: 'uppercase', marginBottom: '25px', marginTop: '50px', borderLeft: '4px solid #ef4444', paddingLeft: '15px' }}>
                    Архів робочих карток
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                    {Object.keys(task.plan_snapshot || {}).map((nomIdStr) => {
                      const nomId = isNaN(nomIdStr) ? nomIdStr : Number(nomIdStr)
                      const nom = nomenclatures.find(n => String(n.id) === String(nomId))
                      
                      if (nom?.type !== 'part') return null

                      const activeCards = taskCards.filter(c => String(c.nomenclature_id) === String(nomId))
                      const cardIdsStrings = activeCards.map(c => String(c.id))
                      const groupHistory = workCardHistory.filter(h => h.card_id && cardIdsStrings.includes(String(h.card_id)))

                      const groupProduced = activeCards.reduce((sum, c) => sum + (c.status === 'completed' ? (Number(c.quantity) || 0) : 0), 0)
                      const groupScrap = groupHistory.reduce((sum, h) => sum + (Number(h.scrap_qty) || 0), 0)

                      const snapshot = task.plan_snapshot?.[nomId] || task.plan_snapshot?.[nom?.id]
                      const orderRef = orders.find(o => o.id === task.order_id)

                      let need = 0
                      if (snapshot) {
                        need = snapshot.need
                      } else {
                        const itemRef = orderRef?.order_items?.find(it => it.nomenclature_id === nom?.id)
                        if (itemRef) {
                          need = Number(itemRef.quantity) || 0
                        } else {
                          ; (orderRef?.order_items || []).forEach(oi => {
                            const bom = bomItems.filter(b => b.parent_id === oi.nomenclature_id)
                            const bItem = bom.find(b => b.child_id === nom?.id)
                            if (bItem) {
                              need += (Number(oi.quantity) || 0) * (Number(bItem.quantity_per_parent) || 1)
                            }
                          })
                        }
                      }

                      const unitsPerSheet = snapshot ? snapshot.units_per_sheet : (Number(nom?.units_per_sheet) || 1)
                      const sheets = snapshot ? snapshot.sheets : Math.ceil(need / unitsPerSheet)
                      const initialBZ = (sheets * unitsPerSheet) - need
                      const bzResult = initialBZ - groupScrap
                      const shortage = bzResult < 0 ? Math.abs(bzResult) : 0

                      const stages = activeCards.reduce((acc, c) => {
                        if (c.status === 'new') acc.waiting++
                        else if (c.status === 'completed') acc.reception++
                        else if (c.operation?.includes('Розкрій')) acc.cutting++
                        else if (c.operation?.includes('Галтовка')) acc.tumbling++
                        else if (c.operation?.includes('Прийомка')) acc.reception++
                        return acc
                      }, { waiting: 0, cutting: 0, tumbling: 0, reception: 0 })

                      return (
                        <div key={nomId} className="nomenclature-archive-group" style={{ marginBottom: '30px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', background: '#111', padding: '12px 20px', borderRadius: '12px', border: '1px solid #222' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <div style={{ fontWeight: 900, fontSize: '0.95rem', color: '#fff' }}>{nom?.name || 'Невідома деталь'}</div>
                              <div style={{ fontSize: '0.65rem', color: '#444', marginTop: '2px', fontWeight: 700 }}>
                                Потреба: <span style={{ color: '#aaa' }}>{need}</span> |{' '}
                                Вироблено: <span style={{ color: '#3b82f6' }}>{groupProduced}</span> |{' '}
                                БЗ: <span style={{ color: groupProduced - need >= 0 ? '#10b981' : '#aaa' }}>
                                  {groupProduced - need > 0
                                    ? `+${groupProduced - need}`
                                    : '+0'
                                  }
                                </span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '25px', alignItems: 'center' }}>
                              <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 800 }}>
                                КАРТОК: <span style={{ color: '#fff' }}>{activeCards.length}</span>
                                <small style={{ marginLeft: '10px', color: '#333' }}>
                                  ({stages.waiting > 0 && <span style={{ color: '#eab308' }}>{stages.waiting} </span>}
                                  {stages.reception > 0 && <span style={{ color: '#10b981' }}>Готові: {stages.reception}</span>})
                                </small>
                              </div>
                              <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 800, borderLeft: '1px solid #222', paddingLeft: '20px' }}>
                                ПРИЙНЯТО: <span style={{ color: '#3b82f6' }}>{groupProduced}</span>
                              </div>
                              <div style={{ fontSize: '0.7rem', color: groupScrap > 0 ? '#ef4444' : '#333', fontWeight: 950 }}>
                                БРАК: {groupScrap}
                              </div>
                              {shortage > 0 && task.status !== 'completed' && (
                                <div style={{ padding: '4px 12px', borderRadius: '8px', background: '#ef444422', border: '1px solid #ef444444', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <div style={{ color: '#ef4444', fontSize: '0.7rem', fontWeight: 950 }}>НЕСТАЧА: {shortage}</div>
                                  <button
                                    onClick={() => {
                                      const machineName = activeCards[0]?.machine || '—'
                                      setGenModal({ task, part: { nom }, total: 1, requirement: shortage, created: 0, machineName, sheets: 1, isRepair: true })
                                    }}
                                    disabled={activeCards.some(c => (c.card_info || '').includes('[REDO]'))}
                                    style={{
                                      background: activeCards.some(c => (c.card_info || '').includes('[REDO]')) ? '#444' : '#ef4444',
                                      color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '0.6rem', fontWeight: 900,
                                      cursor: activeCards.some(c => (c.card_info || '').includes('[REDO]')) ? 'not-allowed' : 'pointer',
                                      textTransform: 'uppercase',
                                      opacity: activeCards.some(c => (c.card_info || '').includes('[REDO]')) ? 0.6 : 1
                                    }}
                                  >
                                    {activeCards.some(c => (c.card_info || '').includes('[REDO]')) ? 'ВЖЕ ДОВИПУЩЕНО' : 'ДОВИПУСК'}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* ───── КАРТКИ ───── */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '15px' }}>
                            {activeCards.map(card => {
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
                                      estimatedTime: (Number(nom?.time_per_unit) || 0) * (Number(card.quantity) || 0)
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
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', opacity: 0.1 }}>
              <ListTodo size={120} />
              <h3>Оберіть наряд зі списку зліва</h3>
            </div>
          )}
        </div>
      </div>

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
                    const splitLoadings = Math.ceil(splitSheets / cap)
                    const splitQty = split.qty || (splitSheets * unitsPerSheet)
                    const qtyPerCard = Math.ceil(splitQty / splitLoadings)

                    // INTELLIGENT FILTERING:
                    // Instead of exact sheet matching (which fails for partials), 
                    // we count sheets for THIS MACHINE in order of splits.
                    
                    // 1. Get ALL cards for this nomenclature that match the machine name
                    const machineCards = existingNomenclatureCards
                      .filter(wc => wc.machine === split.machine)
                      .sort((a,b) => a.id - b.id)

                    // 2. Determine which cards belong to THIS specific split index
                    const prevSplitsSameMachine = genModal.splits.slice(0, sIdx).filter(s => s.machine === split.machine)
                    const sheetsSkipped = prevSplitsSameMachine.reduce((sum, s) => {
                      const sSheets = Number(s.sheets) || Math.ceil(s.qty / unitsPerSheet)
                      return sum + sSheets
                    }, 0)

                    // 3. Select cards that fall within the range of THIS split's sheets
                    let sheetsUsedInThisSplit = 0
                    let cardsBelongingToThisSplitCount = 0
                    let currentGlobalSheets = 0
                    
                    machineCards.forEach(wc => {
                      const cardSheets = Math.ceil((Number(wc.quantity) || 0) / unitsPerSheet)
                      const cardStart = currentGlobalSheets
                      const cardEnd = currentGlobalSheets + cardSheets
                      
                      const splitStart = sheetsSkipped
                      const splitEnd = sheetsSkipped + splitSheets
                      
                      // If any part of this card falls within this split's range
                      if (cardEnd > splitStart && cardStart < splitEnd) {
                        cardsBelongingToThisSplitCount++
                        sheetsUsedInThisSplit += cardSheets // simplified
                      }
                      
                      currentGlobalSheets += cardSheets
                    })

                    const generatedCount = cardsBelongingToThisSplitCount
                    const isGenerated = sheetsUsedInThisSplit >= splitSheets
                    const remainingCount = Math.max(0, splitLoadings - generatedCount)
                    
                    const splitGlobalOffsetForThisMachine = currentGlobalOffset
                    currentGlobalOffset += splitLoadings
                    const toGen = partialCounts[`${genModal.part.nom?.id}_${sIdx}`] ?? remainingCount

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
                          {isGenerated && <div style={{ fontSize: '0.55rem', color: '#444', marginTop: '2px' }}>Всі карти згенеровано ✅</div>}
                        </div>

                        {!isGenerated && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                              disabled={isGenerating}
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
                                  splitGlobalOffsetForThisMachine
                                )
                              }}
                              style={{ background: isGenerating ? '#333' : '#10b981', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 950, cursor: isGenerating ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '5px', pointerEvents: isGenerating ? 'none' : 'auto' }}
                            >
                              {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Printer size={12} />}
                              {isGenerating ? 'ОБРОБКА...' : 'ГЕНЕРУВАТИ'}
                            </button>
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
                <div style={{ background: '#080808', padding: '20px', borderRadius: '20px', border: '1px solid #1a1a1a', marginBottom: '30px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                    <span style={{ color: '#555', fontSize: '0.75rem', fontWeight: 800 }}>СТАТУС:</span>
                    <span style={{ color: '#3b82f6', fontSize: '0.75rem', fontWeight: 900 }}>Згенеровано {genModal.created} з {genModal.total}</span>
                  </div>
                  <div style={{ height: '6px', background: '#1a1a1a', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${(genModal.created / genModal.total) * 100}%`, height: '100%', background: '#3b82f6', transition: '0.3s' }} />
                  </div>
                </div>

                <div style={{ marginBottom: '30px' }}>
                  <label style={{ display: 'block', color: '#888', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '10px', textAlign: 'center' }}>
                    Скільки ще карт згенерувати?
                  </label>
                  <input
                    type="number"
                    id="gen_count_input"
                    defaultValue={Math.max(1, genModal.total - genModal.created)}
                    min="1"
                    max={Math.max(1, genModal.total - genModal.created)}
                    style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', fontSize: '2.5rem', fontWeight: 950, textAlign: 'center', padding: '15px', borderRadius: '20px', outline: 'none', borderInline: '4px solid #10b981' }}
                  />
                </div>

                <button
                  onClick={() => {
                    const v = parseInt(document.getElementById('gen_count_input').value)
                    if (v > 0) {
                      handleGenerateFromWorksheet(genModal.task, genModal.part, genModal.sheets, genModal.machineName, v, genModal.created, genModal.requirement, genModal.isRepair)
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


      {/* ───── ЛОАДЕР ───── */}
      {isGenerating && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 20000, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '20px' }}>
          <Loader2 size={60} color="#ef4444" className="animate-spin" />
          <h2 style={{ fontWeight: 900, textTransform: 'uppercase' }}>Генерація карток...</h2>
        </div>
      )}

      {/* ───── ДРУК ───── */}
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
            const order = orders.find(o => o.id === printQueue.task.order_id)
            const nomenclature = nomenclatures.find(n => n.id === (printQueue.part.nomenclature_id || printQueue.part.nom?.id))
            const currentDate = new Date().toLocaleDateString('uk-UA')
            const finishedProduct = order?.order_items?.[0] ? nomenclatures.find(n => n.id === order.order_items[0].nomenclature_id) : null
            const formatTime = (seconds) => {
              const h = Math.floor(seconds / 3600)
              const min = Math.floor((seconds % 3600) / 60)
              const s = Math.floor(seconds % 60)
              return [h, min, s].map(v => v.toString().padStart(2, '0')).join(':')
            }
            return (
              <div key={i} className="a4-page" style={{ width: '210mm', height: '297mm', background: '#fff', padding: '10mm', margin: '0 auto 40px auto', pageBreakAfter: 'always', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', boxSizing: 'border-box' }}>
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
                          <div style={{ width: '18%', fontSize: '6pt', fontWeight: 900 }}></div>
                        </div>
                        <div style={{ display: 'flex', height: '26px', borderBottom: '1.5px solid #000', textAlign: 'center', alignItems: 'center' }}>
                          <div style={{ width: '30%', borderRight: '1px solid #000', fontSize: '9pt', fontWeight: 1000 }}>{finishedProduct?.name || '—'}</div>
                          <div style={{ width: '10%', borderRight: '1px solid #000', fontSize: '13pt', fontWeight: 1000 }}>
                             {Math.ceil(m.qty / (nomenclature?.units_per_sheet || 1))}
                          </div>
                          <div style={{ width: '12%', borderRight: '1px solid #000', fontSize: '8pt', fontWeight: 1000, lineHeight: 1.1 }}>{nomenclature?.material_type || '—'}</div>
                          <div style={{ width: '15%', borderRight: '1px solid #000', fontSize: '7.5pt', fontWeight: 1000, padding: '0 2px' }}>{m.machine}</div>
                          <div style={{ width: '15%', borderRight: '1px solid #000', fontSize: '11pt', fontWeight: 1000 }}>{m.loading?.split(' [')[0]}</div>
                          <div style={{ width: '18%', fontSize: '6pt', fontWeight: 900 }}></div>
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
                  <div style={{ marginTop: '2px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '6.5pt' }}>
                      <thead>
                        <tr style={{ background: '#fff', textAlign: 'center', fontWeight: 'bold', height: '28px' }}>
                          <td style={{ border: '1.5px solid #000', width: '25%' }}>Операція (1 сторона)</td>
                          <td style={{ border: '1.5px solid #000', width: '8%', fontSize: '5.5pt', lineHeight: 1 }}>Статус<br />виконання<br />☑</td>
                          <td style={{ border: '1.5px solid #000', width: '25%' }}>Операція (2 сторона)</td>
                          <td style={{ border: '1.5px solid #000', width: '8%', fontSize: '5.5pt', lineHeight: 1 }}>Статус<br />виконання<br />☑</td>
                          <td style={{ border: '1.5px solid #000', width: '25%' }}>Операція (2 сторона розкрій)</td>
                          <td style={{ border: '1.5px solid #000', width: '9%', fontSize: '5.5pt', lineHeight: 1 }}>Статус<br />виконання<br />☑</td>
                        </tr>
                      </thead>
                      <tbody>
                        {[...Array(10)].map((_, idx) => (
                          <tr key={idx} style={{ height: '22px' }}>
                            <td style={{ border: '1.5px solid #000' }}></td>
                            <td style={{ border: '1.5px solid #000', textAlign: 'center', fontSize: '10pt' }}>☐</td>
                            <td style={{ border: '1.5px solid #000' }}></td>
                            <td style={{ border: '1.5px solid #000', textAlign: 'center', fontSize: '10pt' }}>☐</td>
                            <td style={{ border: '1.5px solid #000' }}></td>
                            <td style={{ border: '1.5px solid #000', textAlign: 'center', fontSize: '10pt' }}>☐</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ border: '1.5px solid #000', borderTop: 'none', display: 'flex', height: '45px' }}>
                    <div style={{ width: '130px', borderRight: '1.5px solid #000', background: '#fff', fontWeight: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8pt' }}>Коментар</div>
                    <div style={{ flex: 1 }}></div>
                  </div>
                  <div style={{ marginTop: '2px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '6.5pt' }}>
                      <tbody>
                        {[1, 2, 3, 4].map(num => (
                          <tr key={num} style={{ height: '28px' }}>
                            <td style={{ border: '1.5px solid #000', width: '130px', textAlign: 'center', fontWeight: 'bold', background: '#fff' }}>{num} лист<br />Перша деталь</td>
                            <td style={{ border: '1.5px solid #000', width: '12%' }}></td>
                            <td style={{ border: '1.5px solid #000', width: '12%' }}></td>
                            <td style={{ border: '1.5px solid #000', width: '12%' }}></td>
                            <td style={{ border: '1.5px solid #000' }}></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
            )
          })}
        </div>
      )}

      {/* ───── СКАНЕР ───── */}
      {isBufferScanning && (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 25000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={() => setIsBufferScanning(false)} style={{ position: 'absolute', top: 30, right: 30, background: '#333', color: '#fff', padding: '15px', borderRadius: '50%', border: 'none' }}>
            <X size={32} />
          </button>
          <div id="buffer-reader" style={{ width: '100%', maxWidth: '500px', borderRadius: '20px', overflow: 'hidden' }}></div>
        </div>
      )}

      {/* ───── МОДАЛ БРАКУ БУФЕРА ───── */}
      {bufferScrapModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 30000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#111', width: '400px', padding: '30px', borderRadius: '20px', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 20px' }}>ПРИЙОМКА НА БУФЕР</h3>
            <div style={{ marginBottom: '20px' }}>
              <label>Кількість браку:</label>
              <input
                type="number"
                style={{ width: '100%', background: '#000', color: '#fff', border: '1px solid #333', padding: '10px' }}
                value={bufferScrapCounts[bufferScrapModal.nomenclature_id] || 0}
                onChange={e => setBufferScrapCounts({ ...bufferScrapCounts, [bufferScrapModal.nomenclature_id]: parseInt(e.target.value) || 0 })}
              />
            </div>
            <button onClick={submitBufferReception} style={{ width: '100%', background: '#10b981', color: '#fff', padding: '15px', borderRadius: '10px', border: 'none' }}>
              ПІДТВЕРДИТИ
            </button>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body { background: #fff; color: #000; margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .print-overlay { position: static !important; background: #fff !important; padding: 0 !important; overflow: visible !important; }
          .a4-page { boxShadow: none !important; margin: 0 !important; pageBreakAfter: always !important; }
        }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .hide-mobile { display: none !important; }
          .mobile-only { display: block !important; }
          .master-grid { display: block !important; }
          .side-panel { position: fixed; left: 0; top: 0; bottom: 0; z-index: 1001; transform: translateX(-100%); width: 280px !important; }
          .side-panel.drawer-open { transform: translateX(0); }
          .content-panel { padding: 15px !important; }
        }
        .mobile-only { display: none; }
        .archive-card-hover:hover { border-color: #ef4444 !important; background: #1a1a1a !important; }
      `}} />
    </div>
  )
}

export default ForemanWorkplace