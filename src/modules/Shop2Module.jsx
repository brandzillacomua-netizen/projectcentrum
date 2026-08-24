import React, { useState, useMemo, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, Monitor, ListTodo, X, Clock, CheckCircle2, ChevronRight, Menu, Printer, Tablet } from 'lucide-react'
import { useMES } from '../MESContext'
import { supabase } from '../supabase'
import { QRCodeCanvas } from 'qrcode.react'

const Shop2Module = () => {
  const location = useLocation()
  const {
    orders,
    tasks,
    workCards,
    inventory,
    nomenclatures,
    bomItems,
    fetchData,
    completeTaskShop2,
    directHandoverToSGP,
    fetchTaskArchiveCards,
    fetchTaskPlanSnapshot,
    workCardHistory
  } = useMES()

  const [activeTaskId, setActiveTaskId] = useState(location.state?.taskId || null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [printModalData, setPrintModalData] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedStages, setSelectedStages] = useState({})
  const [completedCards, setCompletedCards] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [showVictory, setShowVictory] = useState(false)
  const itemsPerPage = 8

  const hasBufferParts = (task) => {
    return (workCards || []).some(c => {
      if (String(c.order_id) !== String(task.order_id)) return false
      if (c.status !== 'at-shop2-buffer') return false
      const available = (Number(c.quantity) || 0) - (Number(c.used_in_shop2_qty) || 0)
      if (available <= 0) return false
      
      // Match batch_index if present
      if (task.batch_index !== null && task.batch_index !== undefined) {
        const cardTask = tasks.find(t => t.id === c.task_id)
        if (cardTask && cardTask.batch_index !== task.batch_index) return false
      }
      return true
    })
  }

  useEffect(() => {
    if (location.state?.taskId) {
      setActiveTaskId(location.state.taskId)
    } else if (location.state?.highlightTaskId) {
      setActiveTaskId(location.state.highlightTaskId)
    }
  }, [location.state])

  useEffect(() => {
    if (activeTaskId && typeof fetchTaskPlanSnapshot === 'function') {
      fetchTaskPlanSnapshot(activeTaskId).catch(() => {})
    }
  }, [activeTaskId, fetchTaskPlanSnapshot])

  // Фільтруємо наряди для Цеху №2 (Пресування/ЦЕХ №2)
  const relevantTasks = useMemo(() => {
    return tasks
      .filter(t => 
        t.step?.includes('Пресування') || 
        t.step?.includes('ЦЕХ №2') ||
        t.step?.includes('Доопрацювання')  // ВБ-накази з відділу браку
      )
      .sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1
        if (a.status !== 'completed' && b.status === 'completed') return -1
        const aWaiting = a.status === 'waiting' && !hasBufferParts(a)
        const bWaiting = b.status === 'waiting' && !hasBufferParts(b)
        if (aWaiting && !bWaiting) return 1
        if (!aWaiting && bWaiting) return -1
        return new Date(b.created_at) - new Date(a.created_at)
      })
  }, [tasks, workCards])

  const activeQueueCount = useMemo(() => {
    return relevantTasks.filter(t => t.status !== 'completed').length
  }, [relevantTasks])

  // Завантажуємо завершені карти для всіх нарядів Цеху №2
  useEffect(() => {
    const taskIds = relevantTasks.map(t => t.id)
    if (taskIds.length === 0) {
      setCompletedCards([])
      return
    }

    supabase.from('work_cards')
      .select('id, task_id, nomenclature_id, quantity, operation, status, card_info')
      .in('task_id', taskIds)
      .eq('status', 'completed')
      .then(({ data, error }) => {
        if (!error && data) {
          setCompletedCards(data)
        }
      })
  }, [relevantTasks, workCards])


  const getBOMParts = (nomenclatureId) => {
    return bomItems
      .filter(b => b.parent_id === nomenclatureId)
      .map(b => ({
        ...b,
        nom: nomenclatures.find(n => n.id === b.child_id)
      }))
  }

  const getDisplayPartsForOrderItem = (task, it) => {
    if (task?.plan_snapshot) {
      const partsFromSnapshot = Object.values(task.plan_snapshot)
        .filter(p => p && String(p.order_item_id) === String(it.id))
        .map(p => {
          const nom = (nomenclatures || []).find(n => String(n.id) === String(p.id))
          return {
            nom: nom || { id: p.id, name: p.name, nomenclature_code: p.code, material_type: p.material, type: 'part' },
            quantity_per_parent: p.need / (Number(it.quantity) || 1)
          }
        });
      if (partsFromSnapshot.length > 0) return partsFromSnapshot;
    }
    const parts = getBOMParts(it.nomenclature_id)
    return parts.length > 0 ? parts : [{ nom: (nomenclatures || []).find(n => n.id === it.nomenclature_id), quantity_per_parent: 1 }]
  }

  const getTaskDisplayItems = (task, orderObj) => {
    if (!task) return []
    const s1Task = tasks.find(t =>
      String(t.order_id) === String(task.order_id) &&
      t.batch_index === task.batch_index &&
      !(t.step?.includes('Пресування') || t.step?.includes('ЦЕХ №2') || t.step?.includes('Доопрацювання'))
    )
    const snapshot = s1Task?.plan_snapshot || task.plan_snapshot || {}
    const arrivals = task.plan_snapshot?.arrivals || snapshot.arrivals || []

    // ВБ-наряд (доопрацювання браку): plan_snapshot = { nomId: { id, name, need, is_rework: true } }
    // Немає arrivals і немає order_items — беремо прямо зі snapshot
    const snapshotValues = Object.values(snapshot).filter(v => v && typeof v === 'object' && v.id && v.is_rework)
    if (snapshotValues.length > 0) {
      return snapshotValues.map(s => ({
        nom: (nomenclatures || []).find(n => String(n.id) === String(s.id)) || { id: s.id, name: s.name, type: 'part' },
        need: Number(s.need) || 0,
        bz: 0,
        code: (nomenclatures || []).find(n => String(n.id) === String(s.id))?.nomenclature_code || '—'
      }))
    }

    let items = arrivals.length > 0 ? arrivals.map(a => {
      const snapEntry = snapshot[String(a?.id)]
      let needQty = a?.semi || 0
      if (snapEntry !== undefined) {
        needQty = snapEntry.plan !== undefined ? Number(snapEntry.plan) : Number(snapEntry.need || 0)
      }
      return {
        nom: (nomenclatures || []).find(n => String(n?.id) === String(a?.id)),
        need: needQty,
        bz: a?.bz || 0,
        code: (nomenclatures || []).find(n => String(n?.id) === String(a?.id))?.nomenclature_code
      }
    }) : (orderObj?.order_items || []).flatMap(item => {
      const parts = getDisplayPartsForOrderItem(task, item)
      return parts.map(p => {
        const snapEntry = snapshot[String(p.nom?.id)]
        let needQty = (Number(item?.quantity) || 0) * (Number(p.quantity_per_parent) || 1)
        if (snapEntry !== undefined) {
          needQty = snapEntry.plan !== undefined ? Number(snapEntry.plan) : Number(snapEntry.need || 0)
        }
        return {
          nom: p.nom,
          need: needQty,
          bz: 0,
          code: p.nom?.nomenclature_code
        }
      })
    })

    return (items || []).filter(item => item.nom?.type === 'part')
  }

  const checkIfTaskIsAllDone = (taskObj, orderObj) => {
    if (!taskObj) return false
    if (taskObj.status === 'completed') return true

    // Find the corresponding Shop 1 task
    const s1Task = tasks.find(t =>
      String(t.order_id) === String(taskObj.order_id) &&
      t.batch_index === taskObj.batch_index &&
      !(t.step?.includes('Пресування') || t.step?.includes('ЦЕХ №2') || t.step?.includes('Доопрацювання'))
    )

    const isReworkOrDirectTask = !s1Task || 
      taskObj.step?.includes('Доопрацювання') || 
      orderObj?.order_num?.startsWith('ВБ') || 
      Boolean(taskObj.plan_snapshot && Object.values(taskObj.plan_snapshot).some(v => v && typeof v === 'object' && v.is_rework))

    // If Shop 1 task is not completed (and this is NOT a direct/rework task), we cannot close Shop 2 yet
    if (!isReworkOrDirectTask && s1Task && s1Task.status !== 'completed') {
      return false
    }

    const itemsToCheck = getTaskDisplayItems(taskObj, orderObj)
    if (itemsToCheck.length === 0) return false

    // If there are any uncompleted work cards in Shop 2 for this task, it's not done
    const taskCards = (workCards || []).filter(wc => String(wc.task_id) === String(taskObj.id))
    const hasUncompleted = taskCards.some(wc => wc.status !== 'completed')
    if (hasUncompleted) return false

    // Ensure for every item that there is no remaining un-carded buffer
    for (const item of itemsToCheck) {
      const nomId = item.nom?.id
      if (!nomId) continue

      // Calculate remaining buffer in Shop 2
      const bufSrcCards = (workCards || []).filter(c =>
        (s1Task ? String(c.task_id) === String(s1Task.id) : String(c.order_id) === String(taskObj.order_id)) &&
        String(c.nomenclature_id) === String(nomId) &&
        c.status === 'at-shop2-buffer'
      )
      const bufTotal = bufSrcCards.reduce((s, c) => s + (Number(c.quantity) || 0), 0)
      const bufUsed = bufSrcCards.reduce((s, c) => s + (Number(c.used_in_shop2_qty) || 0), 0)
      const total2 = bufTotal - bufUsed

      // Якщо в буфері є недогенеровані деталі (total2 > 0), наряд закривати НЕ МОЖНА!
      if (total2 > 0) {
        return false
      }
    }

    return true
  }




  const handleUpdateStage = async (task, nomId, stageName) => {
    if (!task || !nomId) return
    const sId = String(nomId)

    // Оптимістичне оновлення локального стейту для миттєвої реакції UI
    setSelectedStages(prev => ({ ...prev, [sId]: stageName }))

    const currentSnapshot = task.plan_snapshot || {}
    const updatedSnapshot = {
      ...currentSnapshot,
      [sId]: {
        ...(currentSnapshot[sId] || {}),
        shop2_stage: stageName
      }
    }
    try {
      const { error } = await supabase.from('tasks').update({ plan_snapshot: updatedSnapshot }).eq('id', task.id)
      if (error) throw error
      // Викликаємо fetchData у фоні без очікування, щоб не блокувати UI
      fetchData('tasks')
    } catch (err) {
      console.error("Error updating stage:", err)
      alert("Помилка збереження етапу")
      // У разі помилки можна повернути старе значення (опціонально)
    }
  }

  const handleGenerateCard = async (task, item, totalQty) => {
    const nomId = item.nom?.id
    const stage = selectedStages[String(nomId)] || task.plan_snapshot?.[String(nomId)]?.shop2_stage

    if (!nomId) {
      alert("Не знайдено ID номенклатури!")
      return
    }

    if (!stage) {
      alert("Спершу оберіть етап!")
      return
    }

    setIsGenerating(true)
    try {
      const userQty = prompt(`Вкажіть кількість для картки (макс: ${totalQty}):`, totalQty)
      if (userQty === null) return
      const finalQty = Number(userQty) || 0
      if (finalQty <= 0) {
        alert("Кількість має бути більшою за 0")
        return
      }
      if (finalQty > totalQty) {
        alert(`Кількість (${finalQty}) перевищує залишок у буфері (${totalQty})`)
        return
      }

      const order = orders.find(o => o.id === task.order_id)

      const s1Task = tasks.find(t =>
        String(t.order_id) === String(task.order_id) &&
        t.batch_index === task.batch_index &&
        !(t.step?.includes('Пресування') || t.step?.includes('ЦЕХ №2') || t.step?.includes('Доопрацювання'))
      )
      const s1TaskId = s1Task?.id

      // Знаходимо at-shop2-buffer картки для цієї номенклатури (source картки)
      const sourceCards = (workCards || [])
        .filter(c =>
          String(c.task_id) === String(s1TaskId) &&
          String(c.nomenclature_id) === String(nomId) &&
          c.status === 'at-shop2-buffer'
        )
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

      const payload = {
        task_id: task.id,
        order_id: task.order_id,
        nomenclature_id: nomId,
        quantity: finalQty,
        operation: stage,
        status: 'new',
        machine: '—',
        is_rework: false,
        estimated_time: 0,
        card_info: `[ЦЕХ №2] [NEED:${item.need || 0}] [BZ:${item.bz || 0}] Наряд №${order?.order_num || ''}${task.batch_index ? `/${task.batch_index}` : ''}`
      }

      const { data, error } = await supabase.from('work_cards').insert([payload]).select().single()

      if (error) {
        console.error("Supabase insert error:", error)
        throw error
      }

      // Оновлюємо used_in_shop2_qty на source-картках (розподіляємо по черзі)
      let remaining = finalQty
      for (const srcCard of sourceCards) {
        if (remaining <= 0) break
        const available = (Number(srcCard.quantity) || 0) - (Number(srcCard.used_in_shop2_qty) || 0)
        if (available <= 0) continue
        const toUse = Math.min(available, remaining)
        await supabase.from('work_cards')
          .update({ used_in_shop2_qty: (Number(srcCard.used_in_shop2_qty) || 0) + toUse })
          .eq('id', srcCard.id)
        remaining -= toUse
      }

      setPrintModalData({
        cardId: data.id,
        nomName: item.nom?.name,
        qty: finalQty,
        stage: stage,
        orderNum: order?.order_num || '—',
        customer: order?.customer || '—'
      })
    } catch (err) {
      console.error("Error generating card details:", err)
      alert(`Помилка генерації картки: ${err.message || 'невідома помилка'}`)
    } finally {
      setIsGenerating(false)
      fetchData(['work_cards', 'tasks'])
    }
  }


  return (
    <div className="shop2-module" style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      {/* ───── ШАПКА ───── */}
      <header className="module-nav" style={{
        padding: '15px 25px',
        background: '#111',
        borderBottom: '1px solid #1a1a1a',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Link to="/" className="back-link" style={{
            color: '#fff',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: 700,
            fontSize: '0.85rem'
          }}>
            <ArrowLeft size={18} /> <span className="hide-mobile">На головну</span>
          </Link>
          <button onClick={() => setIsDrawerOpen(true)} className="burger-btn-labeled">
            <Menu size={20} />
            <span>Черга</span>
            {activeQueueCount > 0 && (
              <span className="queue-badge" style={{
                background: '#ef4444',
                color: '#fff',
                borderRadius: '50%',
                fontSize: '10px',
                fontWeight: 900,
                width: '18px',
                height: '18px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1
              }}>
                {activeQueueCount}
              </span>
            )}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Monitor size={22} color="#8b5cf6" />
          <h1 style={{ margin: 0, textTransform: 'uppercase', fontSize: '1rem', fontWeight: 900 }}>ЦЕХ №2</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }} className="hide-mobile">
          <div style={{ fontWeight: 900, color: '#8b5cf6', fontSize: '0.75rem' }}>УПРАВЛІННЯ ДІЛЬНИЦЕЮ</div>
          <Link to="/shop2-terminal" style={{
            background: '#8b5cf622',
            color: '#8b5cf6',
            textDecoration: 'none',
            padding: '8px 16px',
            borderRadius: '12px',
            fontSize: '0.7rem',
            fontWeight: 900,
            border: '1px solid #8b5cf644',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Tablet size={14} /> ТЕРМІНАЛ ОПЕРАТОРА
          </Link>
        </div>
      </header>

      {isDrawerOpen && (
        <div
          className="drawer-backdrop"
          onClick={() => setIsDrawerOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 99999, backdropFilter: 'blur(4px)' }}
        />
      )}

      {/* ───── ОСНОВНА СІТКА ───── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ───── ЛІВА ПАНЕЛЬ (СПИСОК) ───── */}
        <div
          className={`side-panel ${isDrawerOpen ? 'drawer-open' : ''}`}
          style={{
            width: '300px',
            background: '#121212',
            borderRight: '1px solid #222',
            display: 'flex',
            flexDirection: 'column',
            transition: '0.3s transform'
          }}
        >
          <div style={{ padding: '20px', color: '#444', fontWeight: 800, fontSize: '0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            ЧЕРГА НАРЯДІВ ({relevantTasks.length})
            {isDrawerOpen && <X size={18} onClick={() => setIsDrawerOpen(false)} style={{ cursor: 'pointer' }} />}
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {relevantTasks.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(task => {
              const order = orders.find(o => o.id === task.order_id)
              const isActive = activeTaskId === task.id
              const isCompleted = task.status === 'completed'
              const isReworkTask = order?.order_num?.startsWith('ВБ') || 
                task.step?.includes('Доопрацювання') || 
                Boolean(task.plan_snapshot && Object.values(task.plan_snapshot).some(v => v && typeof v === 'object' && v.is_rework))
              const isWaitingForShop1 = task.status === 'waiting' && !hasBufferParts(task) && !isReworkTask

              return (
                <div
                  key={task.id}
                  onClick={() => { setActiveTaskId(task.id); setIsDrawerOpen(false); }}
                  style={{
                    padding: '20px',
                    borderLeft: isActive ? '4px solid #8b5cf6' : '4px solid transparent',
                    background: isActive ? '#1a1a1a' : 'transparent',
                    cursor: 'pointer',
                    transition: '0.2s',
                    borderBottom: '1px solid #1a1a1a',
                    opacity: isWaitingForShop1 ? 0.5 : 1
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: isCompleted ? '#444' : isWaitingForShop1 ? '#555' : '#fff' }}>№ {order?.order_num}{task.batch_index ? `/${task.batch_index}` : ''}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {(() => {
                        if (isCompleted) {
                          return <div style={{ background: '#10b981', color: '#fff', padding: '3px 8px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 950, boxShadow: '0 0 10px rgba(16, 185, 129, 0.4)' }}>ВИКОНАНО</div>
                        }

                        const isAllDone = checkIfTaskIsAllDone(task, order)
                        if (isAllDone) {
                          return <div style={{ background: '#10b981', color: '#fff', padding: '3px 8px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 950, boxShadow: '0 0 10px rgba(16, 185, 129, 0.4)' }}>ГОТОВО</div>
                        }

                        // Check if in progress
                        const s2ActiveCards = (workCards || []).filter(c => String(c.task_id) === String(task.id) && c.status !== 'completed')
                        const hasActiveCards = s2ActiveCards.length > 0

                        // Check if has new parts in buffer
                        const s1Task = tasks.find(t =>
                          String(t.order_id) === String(task.order_id) &&
                          t.batch_index === task.batch_index &&
                          !(t.step?.includes('Пресування') || t.step?.includes('ЦЕХ №2') || t.step?.includes('Доопрацювання'))
                        )
                        const s1TaskId = s1Task?.id
                        const shop2BufferCards = (workCards || []).filter(c =>
                          String(c.task_id) === String(s1TaskId) &&
                          c.status === 'at-shop2-buffer'
                        )
                        const hasNewBufferParts = shop2BufferCards.some(c => (Number(c.quantity) || 0) - (Number(c.used_in_shop2_qty) || 0) > 0)

                        if (hasNewBufferParts || hasActiveCards) {
                          return (
                            <div style={{ display: 'flex', gap: '4px' }}>
                              {hasNewBufferParts && (
                                <div style={{ background: '#8b5cf6', color: '#fff', padding: '3px 8px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 950, boxShadow: '0 0 10px rgba(139, 92, 246, 0.4)' }}>НОВІ ДЕТАЛІ</div>
                              )}
                              {hasActiveCards && (
                                <div style={{ background: '#3b82f6', color: '#fff', padding: '3px 8px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 950, boxShadow: '0 0 10px rgba(59, 130, 246, 0.4)' }}>В РОБОТІ</div>
                              )}
                            </div>
                          )
                        }

                        // Fallback / Waiting
                        return <div style={{ background: '#d97706', color: '#fff', padding: '3px 8px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 950, boxShadow: '0 0 10px rgba(217, 119, 6, 0.4)' }}>ОЧІКУЄ</div>
                      })()}
                    </div>
                  </div>
                  {(() => {
                    // Назва виробу
                    const prodName = (order?.order_items || [])
                      .map(it => (nomenclatures || []).find(n => n.id === it.nomenclature_id)?.name)
                      .filter(Boolean)
                      .join(', ') || '—'

                    // Кількість комплектів = сума quantity з order_items (скільки виробів замовлено)
                    const totalKits = (order?.order_items || [])
                      .reduce((s, it) => s + (Number(it.quantity) || 0), 0)

                    return (
                      <div style={{ marginTop: '6px', borderTop: '1px dashed #222', paddingTop: '6px' }}>
                        {order?.customer && (
                          <div style={{ fontSize: '0.75rem', color: isCompleted ? '#333' : '#a1a1aa', fontWeight: 700 }}>
                            {order.customer}
                          </div>
                        )}
                        {prodName !== '—' && (
                          <div style={{ fontSize: '0.72rem', color: isCompleted ? '#2a2a2a' : '#71717a', marginTop: '2px', fontWeight: 600 }}>
                            Виріб: <span style={{ color: isCompleted ? '#444' : '#fff' }}>{prodName}</span>
                          </div>
                        )}
                        {totalKits > 0 && (
                          <div style={{ fontSize: '0.72rem', color: isCompleted ? '#2a2a2a' : '#71717a', marginTop: '2px', fontWeight: 600 }}>
                            Комплектів: <span style={{ color: '#8b5cf6', fontWeight: 900 }}>{totalKits} шт</span>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                  {isWaitingForShop1 && (
                    <div style={{ fontSize: '0.6rem', color: '#444', fontWeight: 900, marginTop: '8px' }}>ЧЕК. ДЕТАЛІ З ЦЕХ №1</div>
                  )}
                  {task.status === 'waiting' && hasBufferParts(task) && (
                    <div style={{ fontSize: '0.6rem', color: '#8b5cf6', fontWeight: 900, marginTop: '8px' }}>Є ДЕТАЛІ В БУФЕРІ</div>
                  )}
                  {isCompleted && <div style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 900, marginTop: '8px' }}>ВИКОНАНО</div>}
                  {!isCompleted && (task.status !== 'waiting' || hasBufferParts(task)) && (() => {
                    const isAllDone = checkIfTaskIsAllDone(task, order)

                    if (isAllDone) {
                      return (
                        <div style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 900, marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px', animation: 'pulse 2s infinite' }}>
                          <CheckCircle2 size={10} /> МОЖНА ЗАКРИВАТИ
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>
              )
            })}

            {relevantTasks.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#333', fontSize: '0.85rem' }}>
                Поки що немає нарядів для виконання
              </div>
            )}
          </div>

          {/* ПАГІНАЦІЯ */}
          {relevantTasks.length > itemsPerPage && (
            <div style={{ padding: '15px', borderTop: '1px solid #222', display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                style={{ background: '#222', border: 'none', color: '#fff', padding: '5px 12px', borderRadius: '4px', cursor: 'pointer', opacity: currentPage === 1 ? 0.3 : 1 }}
              >Назад</button>
              <div style={{ fontSize: '0.75rem', color: '#555', fontWeight: 800, alignSelf: 'center' }}>
                {currentPage} / {Math.ceil(relevantTasks.length / itemsPerPage)}
              </div>
              <button
                disabled={currentPage === Math.ceil(relevantTasks.length / itemsPerPage)}
                onClick={() => setCurrentPage(p => p + 1)}
                style={{ background: '#222', border: 'none', color: '#fff', padding: '5px 12px', borderRadius: '4px', cursor: 'pointer', opacity: currentPage === Math.ceil(relevantTasks.length / itemsPerPage) ? 0.3 : 1 }}
              >Вперед</button>
            </div>
          )}
        </div>

        {/* ───── ЦЕНТРАЛЬНА ЧАСТИНА (ДЕТАЛІЗУЦІЯ) ───── */}
        <div className="main-content" style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
          {activeTaskId ? (() => {
            const task = tasks.find(t => t.id === activeTaskId) // Шукаємо у всіх tasks, не тільки в relevant
            if (!task) return <div style={{ color: '#333' }}>Наряд не знайдено або він переміщений</div>
            const order = orders.find(o => o.id === task.order_id)
            if (!order) return <div style={{ color: '#333' }}>Дані замовлення не знайдено</div>
            const isReworkOrder = order?.order_num?.startsWith('ВБ')

            // Fallback for Product Names: if order has no items (internal rework), use snapshot names
            let productNames = order?.order_items?.map(it => nomenclatures.find(n => n.id === it.nomenclature_id)?.name).filter(Boolean).join(', ')
            if (!productNames && task.plan_snapshot) {
              productNames = Object.values(task.plan_snapshot)
                .map(s => nomenclatures.find(n => String(n.id) === String(s.id))?.name || s.name)
                .filter(Boolean)
                .join(', ')
            }

            return (
              <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
                  <div>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 950, margin: 0, display: 'flex', alignItems: 'center', gap: '15px' }}>
                      Наряд №{order?.order_num}{task.batch_index ? `/${task.batch_index}` : ''}
                      {task.status === 'completed' && (
                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#10b981', padding: '5px 15px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 950, letterSpacing: '1px' }}>
                          ВИКОНАНО
                        </div>
                      )}
                    </h2>
                    <div style={{ color: '#555', marginTop: '8px', fontSize: '1.1rem', fontWeight: 800 }}>
                      ВИРІБ: <strong style={{ color: '#8b5cf6' }}>{productNames || '—'}</strong> | {order?.customer}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '15px' }}>
                    {(() => {
                      const allCardsDone = checkIfTaskIsAllDone(task, order)

                      if (task.status !== 'completed' && allCardsDone) {
                        return (
                          <button
                            disabled={isProcessing}
                            onClick={async () => {
                              if (window.confirm('Ви впевнені, що хочете закрити наряд?')) {
                                setIsProcessing(true)
                                try {
                                  await completeTaskShop2(task.id);
                                  setShowVictory(true); // ЗАПУСКАЄМО ТРІУМФ!
                                } catch (e) {
                                  alert('Помилка: ' + e.message);
                                } finally {
                                  setIsProcessing(false)
                                }
                              }
                            }}
                            style={{
                              background: '#8b5cf6',
                              color: '#fff',
                              border: 'none',
                              padding: '12px 25px',
                              borderRadius: '14px',
                              fontWeight: 900,
                              cursor: isProcessing ? 'not-allowed' : 'pointer',
                              boxShadow: '0 10px 20px -5px rgba(139, 92, 246, 0.4)',
                              opacity: isProcessing ? 0.5 : 1
                            }}
                          >
                            {isProcessing ? 'ОБРОБКА...' : 'ЗАКРИТИ НАРЯД ЦЕХУ'}
                          </button>
                        )
                      }
                      return null
                    })()}
                  </div>
                </div>

                {/* ТАБЛИЦЯ НОМЕНКЛАТУРИ */}
                <div style={{ background: '#111', borderRadius: '28px', border: '1px solid #1a1a1a', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#0a0a0a', textAlign: 'left', color: '#555', textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: 900 }}>
                        <th style={{ padding: '15px 25px', minWidth: '220px' }}>НОМЕНКЛАТУРА</th>
                        <th style={{ padding: '15px 20px', textAlign: 'center', minWidth: '120px' }}>МАТЕРІАЛ</th>
                        <th style={{ padding: '15px 20px', textAlign: 'center', minWidth: '80px' }}>ПОТРЕБА</th>
                        {!isReworkOrder && (
                          <>
                            <th style={{ padding: '15px 20px', textAlign: 'center', color: '#eab308', minWidth: '100px' }}>БЗ (ЗАПАС)</th>
                            <th style={{ padding: '15px 20px', textAlign: 'center', minWidth: '160px' }}>ЗАГАЛЬНА КІЛЬКІСТЬ</th>
                          </>
                        )}
                        <th style={{ padding: '15px 20px', minWidth: '175px' }}>ЕТАП</th>
                        <th style={{ padding: '15px 20px', textAlign: 'center', minWidth: '130px' }}>СТАН</th>
                        <th style={{ padding: '15px 20px', textAlign: 'center', minWidth: '150px' }}>ДІЯ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const displayItems = getTaskDisplayItems(task, order)

                        return (displayItems || []).map((item, idx) => {
                          const stage = selectedStages[String(item.nom?.id)] || task.plan_snapshot?.[String(item.nom?.id)]?.shop2_stage
                          const allCardsForCheck = [...(workCards || []), ...(completedCards || []).filter(ac => !(workCards || []).some(wc => wc.id === ac.id))]
                          const existingCard = allCardsForCheck.find(wc => {
                            const idMatch = String(wc.task_id) === String(task.id) && String(wc.nomenclature_id) === String(item.nom?.id)
                            const opMatch = String(wc.operation || '').toLowerCase().trim() === String(stage || '').toLowerCase().trim()
                            return idMatch && opMatch
                          })

                          // Планова потреба з BOM
                          const plannedNeed = Number(item.need) || 0

                          const s1Task = tasks.find(t =>
                            String(t.order_id) === String(task.order_id) &&
                            t.batch_index === task.batch_index &&
                            !(t.step?.includes('Пресування') || t.step?.includes('ЦЕХ №2') || t.step?.includes('Доопрацювання'))
                          )
                          const s1TaskId = s1Task?.id

                          // Реально прийшло в буфер Цеху №2 з сортування (як ті що лежать в буфері, так і виконані в Цеху 1)
                          const s2CardsForNom = (workCards || []).filter(c =>
                            String(c.task_id) === String(s1TaskId) &&
                            String(c.nomenclature_id) === String(item.nom?.id) &&
                            (c.status === 'at-shop2-buffer' || c.status === 'completed')
                          )
                          const totalArrived = s2CardsForNom.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

                          // Перевіряємо старий масив arrivals, якщо він був заповнений
                          const snap = task.plan_snapshot || {}
                          const arrival = (snap.arrivals || []).find(a => String(a.id) === String(item.nom?.id))

                          const actualArrived = Math.max(totalArrived, arrival ? (Number(arrival.semi) || 0) + (Number(arrival.bz) || 0) : 0)

                          const displayNeed = plannedNeed
                           const plannedBz = arrival ? (Number(arrival.bz) || 0) : 0
                           const snapEntry = snap[String(item.nom?.id)] || {}
                           const unitsPerSheet = Number(snapEntry.units_per_sheet) || 1
                           
                           let displayTotal = plannedNeed + plannedBz
                           let displayBz = plannedBz
                           
                           if (actualArrived < plannedNeed) {
                             const shortage = plannedNeed - actualArrived
                             const sheetsNeeded = Math.ceil(shortage / unitsPerSheet)
                             const reissueQty = sheetsNeeded * unitsPerSheet
                             displayTotal = actualArrived + reissueQty
                             displayBz = displayTotal - plannedNeed
                          } else {
                            displayTotal = actualArrived
                            displayBz = actualArrived - plannedNeed
                          }

                          // Загальна кількість деталей, яка вже пішла в процес (згенеровані робочі карти в Цеху №2)
                          const allShop2CardsForNom = [...(workCards || []), ...(completedCards || []).filter(ac => !(workCards || []).some(wc => wc.id === ac.id))].filter(c =>
                            String(c.task_id) === String(task.id) && String(c.nomenclature_id) === String(item.nom?.id)
                          )
                          const totalInProcess = allShop2CardsForNom.reduce((s, c) => s + (Number(c.quantity) || 0), 0)

                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid #1a1a1a', opacity: (existingCard && existingCard.status === 'completed') ? 0.7 : 1 }}>
                              <td style={{ padding: '20px' }}>
                                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#fff' }}>{item.nom?.name || '—'}</div>
                                <div style={{ fontSize: '0.7rem', color: '#444', marginTop: '2px' }}>{item.code || 'БЕЗ КОДУ'}</div>
                              </td>
                              <td style={{ padding: '20px', textAlign: 'center' }}>
                                <div style={{ color: '#666', fontSize: '0.85rem', fontWeight: 700 }}>{item.nom?.material_type || '—'}</div>
                              </td>
                              <td style={{ padding: '20px', textAlign: 'center', color: '#fff', fontSize: '1.2rem', fontWeight: 600 }}>
                                {(() => {
                                  const snapEntry = snap[String(item.nom?.id)] || {}
                                  const bzStock = Number(snapEntry.stock) || 0
                                  const totalNeed = Number(snapEntry.need) || displayNeed
                                  const planToProduce = snapEntry.plan !== undefined ? Number(snapEntry.plan) : (totalNeed - bzStock)
                                  
                                  if (bzStock > 0) {
                                    return (
                                      <div>
                                        <div style={{ fontSize: '1.15rem' }}>{totalNeed}</div>
                                        <div style={{ fontSize: '0.68rem', color: '#a1a1aa', fontWeight: 600, marginTop: '4px', background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.15)', padding: '2px 6px', borderRadius: '6px', display: 'inline-block' }}>
                                          БЗ - {bzStock} / Виробити {planToProduce} шт
                                        </div>
                                      </div>
                                    )
                                  }
                                  return displayNeed
                                })()}
                              </td>
                              {!isReworkOrder && (
                                <>
                                  <td style={{ padding: '20px', textAlign: 'center', color: '#eab308', fontWeight: 1000, fontSize: '1.4rem' }}>
                                    {displayBz}
                                  </td>
                                  <td style={{ padding: '20px', textAlign: 'center', color: '#3b82f6', fontWeight: 1000, fontSize: '1.4rem' }}>
                                    <div>{actualArrived}/{displayTotal}</div>
                                    {totalInProcess > 0 && (
                                      <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'block', marginTop: '4px', fontWeight: 800 }}>
                                        ({totalInProcess} в роботі)
                                      </span>
                                    )}
                                    {(() => {
                                      const s2CardIds = new Set(allShop2CardsForNom.map(c => String(c.id)))
                                      const scrapQty = (workCardHistory || [])
                                        .filter(h => s2CardIds.has(String(h.card_id)) && String(h.nomenclature_id) === String(item.nom?.id))
                                        .reduce((sum, h) => sum + (Number(h.scrap_qty) || 0), 0)
                                      if (scrapQty > 0) {
                                        return (
                                          <span style={{ fontSize: '0.75rem', color: '#ef4444', display: 'block', marginTop: '4px', fontWeight: 800 }}>
                                            ({scrapQty} брак)
                                          </span>
                                        )
                                      }
                                      return null
                                    })()}
                                  </td>
                                </>
                              )}
                              <td style={{ padding: '20px' }}>
                                <select
                                  value={selectedStages[String(item.nom?.id)] || (task.plan_snapshot?.[String(item.nom?.id)]?.shop2_stage) || ''}
                                  disabled={task.status === 'completed'}
                                  onChange={(e) => handleUpdateStage(task, item.nom?.id, e.target.value)}
                                  style={{ width: '100%', minWidth: '150px', background: '#000', border: '1px solid #333', color: '#fff', padding: '10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                                >
                                  <option value="" disabled hidden>Оберіть етап</option>
                                  <option value="Пресування">Пресування</option>
                                  <option value="Фарбування">Фарбування</option>
                                  <option value="Доопрацювання">Доопрацювання</option>
                                  <option value="Пакування/СГП">Пакування/СГП</option>
                                </select>
                              </td>
                              <td style={{ padding: '20px', textAlign: 'center' }}>
                                <div style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  background: task.status === 'completed' ? '#10b98122' : '#8b5cf611',
                                  color: task.status === 'completed' ? '#10b981' : '#8b5cf6',
                                  padding: '6px 14px',
                                  borderRadius: '12px',
                                  fontSize: '0.75rem',
                                  fontWeight: 800
                                }}>
                                  {task.status === 'completed' ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                                  {task.status === 'completed' ? 'ГОТОВО' : 'НА ПРИЙОМЦІ'}
                                </div>
                              </td>
                              <td style={{ padding: '20px', textAlign: 'center' }}>
                                {(() => {
                                  const stage = selectedStages[String(item.nom?.id)] || task.plan_snapshot?.[String(item.nom?.id)]?.shop2_stage

                                  const isReworkOrder = order?.order_num?.startsWith('ВБ') || task.step?.includes('Доопрацювання')

                                  // Обчислюємо, чи вже була згенерована картка (з активних або архівних)
                                  const allCardsForCheck = [...(workCards || []), ...(completedCards || []).filter(ac => !(workCards || []).some(wc => wc.id === ac.id))]
                                  const existingCard = allCardsForCheck.find(wc => {
                                    const idMatch = String(wc.task_id) === String(task.id) && String(wc.nomenclature_id) === String(item.nom?.id)
                                    const opMatch = String(wc.operation || '').toLowerCase().trim() === String(stage || '').toLowerCase().trim()
                                    return idMatch && (opMatch || isReworkOrder)
                                  })

                                  // Перевіряємо чи завершені картки покривають потребу (для довипуску)
                                  const allS2CardsForRow = [...(workCards || []), ...(completedCards || []).filter(ac => !(workCards || []).some(wc => wc.id === ac.id))].filter(c =>
                                    String(c.task_id) === String(task.id) && String(c.nomenclature_id) === String(item.nom?.id)
                                  )
                                  const completedS2Qty = allS2CardsForRow.filter(c => c.status === 'completed').reduce((s, c) => s + (Number(c.quantity) || 0), 0)
                                  const isNeedCovered = plannedNeed > 0 && completedS2Qty >= plannedNeed

                                  // Залишок буфера з at-shop2-buffer карток
                                  const bufSrcCards2 = s2CardsForNom
                                  const bufTotal2 = bufSrcCards2.reduce((s, c) => s + (Number(c.quantity) || 0), 0)
                                  const bufUsed2 = bufSrcCards2.reduce((s, c) => s + (Number(c.used_in_shop2_qty) || 0), 0)
                                  const total2 = bufTotal2 - bufUsed2

                                  if (task.status === 'completed' || (existingCard && existingCard.status === 'completed' && total2 <= 0) || (isReworkOrder && (completedS2Qty >= plannedNeed || (existingCard && existingCard.status === 'completed')))) {
                                    return <div style={{ color: '#10b981', fontSize: '0.7rem', fontWeight: 900 }}>ГОТОВО</div>
                                  }

                                  // Залишок буфера доступний для генерації карт (план -> finished, надлишок -> БЗ)
                                  const effectiveTotal2 = total2
                                  const remNeed2 = Math.min(effectiveTotal2, Math.max(0, plannedNeed - completedS2Qty))
                                  const remBz2 = Math.max(0, effectiveTotal2 - remNeed2)

                                  const printBtn = existingCard ? (
                                    <button
                                      onClick={() => {
                                        const order = orders.find(o => o.id === task.order_id)
                                        setPrintModalData({
                                          cardId: existingCard.id,
                                          nomName: item.nom?.name,
                                          qty: existingCard.quantity,
                                          stage: existingCard.operation,
                                          orderNum: order?.order_num || '—',
                                          customer: order?.customer || '—'
                                        })
                                      }}
                                      style={{
                                        background: '#10b981',
                                        color: '#fff',
                                        border: 'none',
                                        padding: '10px',
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                                      }}
                                      title="Друкувати повторно"
                                    >
                                      <Printer size={16} />
                                    </button>
                                  ) : null

                                  const genBtn = effectiveTotal2 > 0 ? (
                                    <button
                                      onClick={async () => {
                                        if (stage === 'Пакування/СГП') {
                                          if (window.confirm(`Відправити ${effectiveTotal2} шт. (Потреба: ${remNeed2} + БЗ: ${remBz2}) прямо на СГП?`)) {
                                            try {
                                              setIsGenerating(true)
                                              await directHandoverToSGP(task.id, item.nom?.id, remNeed2, remBz2)
                                              alert('Передано на СГП успішно!')
                                            } catch (err) {
                                              alert('Помилка: ' + err.message)
                                            } finally {
                                              setIsGenerating(false)
                                            }
                                          }
                                        } else {
                                          handleGenerateCard(task, item, effectiveTotal2)
                                        }
                                      }}
                                      disabled={task.status === 'completed' || isGenerating || !stage}
                                      style={{
                                        background: stage === 'Пакування/СГП' ? '#10b981' : '#8b5cf6',
                                        color: '#fff',
                                        border: 'none',
                                        padding: '8px 15px',
                                        borderRadius: '10px',
                                        fontSize: '0.65rem',
                                        fontWeight: 900,
                                        cursor: 'pointer',
                                        opacity: (task.status === 'completed' || isGenerating || !stage) ? 0.3 : 1
                                      }}
                                      title={`Генерувати ще на ${effectiveTotal2} шт.`}
                                    >
                                      {isGenerating ? '...' : (stage === 'Пакування/СГП' ? 'ВІДПРАВИТИ НА СГП' : '+ ГЕНЕРУВАТИ')}
                                    </button>
                                  ) : null

                                  if (printBtn || genBtn) {
                                    return (
                                      <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                                        {printBtn}
                                        {genBtn}
                                      </div>
                                    )
                                  }

                                  if (isReworkOrder || completedS2Qty >= plannedNeed) return <div style={{ color: '#10b981', fontSize: '0.7rem', fontWeight: 900 }}>ГОТОВО</div>
                                  if (bufTotal2 === 0) return <div style={{ color: '#444', fontSize: '0.65rem', fontWeight: 700 }}>Очікує буфер</div>
                                  return <div style={{ color: '#10b981', fontSize: '0.7rem', fontWeight: 900 }}>ГОТОВО</div>
                                })()}
                              </td>
                            </tr>
                          )
                        })
                      })()}
                    </tbody>
                  </table>
                </div>

                {(() => {
                  const isAllDone = checkIfTaskIsAllDone(task, order)

                  if (isAllDone && task.status !== 'completed') {
                    return (
                      <div style={{
                        marginTop: '40px',
                        padding: '40px',
                        borderRadius: '32px',
                        background: 'linear-gradient(135deg, #10b98122 0%, #10b98144 100%)',
                        border: '2px solid #10b981',
                        textAlign: 'center',
                        boxShadow: '0 0 40px rgba(16, 185, 129, 0.2)',
                        animation: 'pulse 2s infinite'
                      }}>
                        <div style={{ color: '#10b981', fontSize: '1.8rem', fontWeight: 950, marginBottom: '10px' }}>🏆 ЛЕГЕНДА ЦЕХУ, ЦЕ ПЕРЕМОГА!</div>
                        <div style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 600, opacity: 0.9 }}>
                          Всі деталі на СГП, план розірвано в шматки! 🚀<br />
                          Тисніть на фіолетову кнопку зверху і отримайте порцію слави!
                        </div>
                      </div>
                    )
                  }

                  if (task.status === 'completed') {
                    return (
                      <div style={{ marginTop: '40px', padding: '30px', borderRadius: '24px', background: '#10b98111', border: '1px solid #10b98122', textAlign: 'center' }}>
                        <div style={{ color: '#10b981', fontSize: '1.5rem', fontWeight: 950 }}>НАРЯД ПОВНІСТЮ ВИКОНАНО</div>
                        <div style={{ color: '#10b981', opacity: 0.7, fontSize: '0.9rem', marginTop: '5px' }}>Всі деталі успішно пройшли обробку у Цеху №2</div>
                      </div>
                    )
                  }
                  return null
                })()}

                {/* ───── ВІКНО ТРІУМФУ ───── */}
                {showVictory && (
                  <div style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    background: 'rgba(0,0,0,0.95)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    animation: 'fadeIn 0.5s ease-out'
                  }}>
                    <div style={{ fontSize: '150px', marginBottom: '20px', animation: 'bounce 1s infinite' }}>🏆</div>
                    <h1 style={{ color: '#fff', fontSize: '5rem', fontWeight: 950, textAlign: 'center', margin: 0, textShadow: '0 0 50px #8b5cf6' }}>ВИ — ЧЕМПІОН!</h1>
                    <p style={{ color: '#8b5cf6', fontSize: '2rem', fontWeight: 800, marginTop: '20px' }}>Цех №2 пишається своїм лідером! 🚀</p>
                    <button
                      onClick={() => setShowVictory(false)}
                      style={{ marginTop: '50px', background: '#fff', color: '#000', padding: '15px 40px', borderRadius: '20px', fontWeight: 900, cursor: 'pointer', border: 'none' }}
                    >
                      ПРОДОВЖИТИ ПІДКОРЕННЯ СВІТУ
                    </button>
                    <style>{`
                      @keyframes bounce { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-30px) scale(1.1); } }
                      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                    `}</style>
                  </div>
                )}

                {!isReworkOrder && (
                  <>
                    <div style={{ marginTop: '40px' }}>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 950, color: '#444', textTransform: 'uppercase', marginBottom: '25px', borderLeft: '4px solid #8b5cf6', paddingLeft: '15px' }}>
                        🔵 Буфер надходжень (з Цеху №1)
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '15px' }}>
                        {(() => {
                          const s1Task = tasks.find(t =>
                            String(t.order_id) === String(task.order_id) &&
                            t.batch_index === task.batch_index &&
                            !(t.step?.includes('Пресування') || t.step?.includes('ЦЕХ №2') || t.step?.includes('Доопрацювання'))
                          )
                          const s1TaskId = s1Task?.id

                          // Читаємо at-shop2-buffer картки з Shop1 для цього наряду
                          const shop2BufferCards = (workCards || []).filter(c =>
                            String(c.task_id) === String(s1TaskId) &&
                            c.status === 'at-shop2-buffer'
                          )

                          // Групуємо по nomenclature_id
                          const byNom = {}
                          shop2BufferCards.forEach(c => {
                            const nid = String(c.nomenclature_id)
                            if (!byNom[nid]) byNom[nid] = { cards: [], totalArrived: 0, totalUsed: 0 }
                            byNom[nid].cards.push(c)
                            byNom[nid].totalArrived += (Number(c.quantity) || 0)
                            byNom[nid].totalUsed += (Number(c.used_in_shop2_qty) || 0)
                          })

                          const activeEntries = Object.entries(byNom).filter(([_, data]) => (data.totalArrived - data.totalUsed) > 0)

                          if (activeEntries.length === 0) {
                            return (
                              <div style={{ color: '#222', fontSize: '0.85rem', fontWeight: 700, padding: '20px', gridColumn: '1/-1' }}>
                                {task.status === 'waiting'
                                  ? '⏳ Очікуємо надходження деталей з Цеху №1...'
                                  : 'Буфер порожній — всі деталі вже в роботі'}
                              </div>
                            )
                          }

                          return activeEntries.map(([nomId, data]) => {
                            const nom = (nomenclatures || []).find(n => String(n?.id) === nomId)
                            const remaining = data.totalArrived - data.totalUsed
                            const shop2Cards = [...(workCards || []), ...(completedCards || []).filter(ac => !(workCards || []).some(wc => wc.id === ac.id))].filter(c =>
                              String(c.task_id) === String(task.id) && String(c.nomenclature_id) === nomId
                            )
                            const inWork = shop2Cards.reduce((s, c) => s + (Number(c.quantity) || 0), 0)

                            // Потреба з BOM (через getTaskDisplayItems)
                            const snap = task.plan_snapshot || {}
                            const arrival = (snap.arrivals || []).find(a => String(a.id) === nomId)
                            const displayItemsForNeed = getTaskDisplayItems(task, order)
                            const matchedDi = displayItemsForNeed.find(di => String(di.nom?.id) === nomId)
                            const need = Math.max(matchedDi ? Number(matchedDi.need) : 0, arrival ? (Number(arrival.semi) || 0) + (Number(arrival.bz) || 0) : 0)

                            return (
                              <div key={nomId} style={{ background: '#111', borderRadius: '24px', padding: '22px', border: remaining > 0 ? '1px solid #8b5cf644' : '1px solid #1a1a1a', boxShadow: remaining > 0 ? '0 0 20px rgba(139,92,246,0.1)' : 'none' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                                  <div>
                                    <div style={{ fontWeight: 900, fontSize: '0.9rem', color: '#fff' }}>{nom?.name || 'Деталь'}</div>
                                    <div style={{ fontSize: '0.65rem', color: '#8b5cf6', fontWeight: 900, textTransform: 'uppercase', marginTop: '4px' }}>
                                      БУФЕР ЦЕХУ №2
                                    </div>
                                  </div>
                                  <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.6rem', color: '#555', fontWeight: 900 }}>В РОБОТІ / ПОТРЕБА</div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 1000, color: inWork > 0 ? '#3b82f6' : '#fff' }}>
                                      {inWork}<span style={{ fontSize: '0.8rem', color: '#444' }}> / {need}</span>
                                    </div>
                                    {remaining > 0 && (
                                      <div style={{ fontSize: '0.65rem', color: '#8b5cf6', fontWeight: 900, marginTop: '2px' }}>
                                        ({remaining} очікують на генерацію РК)
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {remaining > 0 && (
                                  <div style={{ fontSize: '0.65rem', color: '#555', textAlign: 'center', padding: '8px', background: '#0a0a0a', borderRadius: '10px' }}>
                                    Оберіть етап у таблиці та натисніть ГЕНЕРУВАТИ
                                  </div>
                                )}
                              </div>
                            )
                          })
                        })()}
                      </div>
                    </div>

                    {(() => {
                      const displayItems = getTaskDisplayItems(task, order)
                      const waitingItems = (displayItems || []).map(item => {
                        const nomId = String(item.nom?.id)
                        
                        const s1Task = tasks.find(t =>
                          String(t.order_id) === String(task.order_id) &&
                          t.batch_index === task.batch_index &&
                          !(t.step?.includes('Пресування') || t.step?.includes('ЦЕХ №2') || t.step?.includes('Доопрацювання'))
                        )
                        const s1TaskId = s1Task?.id
                        const s2CardsForNom = (workCards || []).filter(c =>
                          String(c.task_id) === String(s1TaskId) &&
                          String(c.nomenclature_id) === nomId &&
                          (c.status === 'at-shop2-buffer' || c.status === 'completed')
                        )
                        const totalArrived = s2CardsForNom.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

                        const snap = task.plan_snapshot || {}
                        const arrival = (snap.arrivals || []).find(a => String(a.id) === nomId)
                        const actualArrived = Math.max(totalArrived, arrival ? (Number(arrival.semi) || 0) + (Number(arrival.bz) || 0) : 0)

                        const plannedNeed = Number(item.need) || 0
                        const plannedBz = arrival ? (Number(arrival.bz) || 0) : 0
                        const snapEntry = snap[nomId] || {}
                        const unitsPerSheet = Number(snapEntry.units_per_sheet) || 1
                        
                        let displayTotal = plannedNeed + plannedBz
                        if (actualArrived < plannedNeed) {
                          const shortage = plannedNeed - actualArrived
                          const sheetsNeeded = Math.ceil(shortage / unitsPerSheet)
                          const reissueQty = sheetsNeeded * unitsPerSheet
                          displayTotal = actualArrived + reissueQty
                        } else {
                          displayTotal = actualArrived
                        }
                        
                        const waitingQty = actualArrived < plannedNeed ? (displayTotal - actualArrived) : 0
                        return {
                          nom: item.nom,
                          code: item.code,
                          waitingQty,
                          actualArrived,
                          displayTotal
                        }
                      }).filter(item => item.waitingQty > 0)

                      if (waitingItems.length === 0) return null

                      return (
                        <div style={{ marginTop: '40px' }}>
                          <h3 style={{ fontSize: '1.2rem', fontWeight: 950, color: '#444', textTransform: 'uppercase', marginBottom: '25px', borderLeft: '4px solid #d97706', paddingLeft: '15px' }}>
                            ⏳ Очікується з Цеху №1 ({waitingItems.length})
                          </h3>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '15px' }}>
                            {waitingItems.map(item => (
                              <div key={item.nom?.id} style={{ background: '#111', borderRadius: '24px', padding: '22px', border: '1px solid #d9770644', boxShadow: '0 0 20px rgba(217,119,6,0.05)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <div>
                                    <div style={{ fontWeight: 900, fontSize: '0.9rem', color: '#fff' }}>{item.nom?.name || 'Деталь'}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#d97706', fontWeight: 900, textTransform: 'uppercase', marginTop: '4px' }}>
                                      У РОЗКРОЇ / В ДОРОЗІ
                                    </div>
                                    {item.code && (
                                      <div style={{ fontSize: '0.65rem', color: '#444', marginTop: '2px' }}>{item.code}</div>
                                    )}
                                  </div>
                                  <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.6rem', color: '#555', fontWeight: 900 }}>ОЧІКУЄМО</div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 1000, color: '#d97706' }}>
                                      {item.waitingQty}<span style={{ fontSize: '0.8rem', color: '#444' }}> шт</span>
                                    </div>
                                    <div style={{ fontSize: '0.65rem', color: '#555', marginTop: '2px' }}>
                                      (Прийшло {item.actualArrived} з {item.displayTotal})
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                  </>
                )}



                {/* ───── АРХІВ РОБОЧИХ КАРТОК (ЦЕХ №2) ───── */}
                <div style={{ marginTop: '60px' }}>
                  {(() => {
                    // Об'єднуємо АКТИВНІ (з глобального стейту) та ЗАВЕРШЕНІ (локально завантажені) карти
                    // Використовуємо Map для гарантованої унікальності за ID
                    const uniqueCardsMap = new Map();
                    [...(workCards || []), ...(completedCards || [])].forEach(c => {
                      if (c?.id) uniqueCardsMap.set(c.id, c);
                    });

                    const allUniqueCards = Array.from(uniqueCardsMap.values());

                    const taskCards = allUniqueCards.filter(c => {
                      const oMatch = String(c.order_id) === String(task.order_id)
                      const tMatch = String(c.task_id) === String(task.id)
                      const infoMatch = c.card_info?.includes(`Наряд №${task.order_id}`) || c.card_info?.includes(`Наряд №${task.id}`)
                      return (oMatch || tMatch || infoMatch) && c.card_info?.includes('[ЦЕХ №2]')
                    })

                    const grouped = taskCards.reduce((acc, c) => {
                      const nomId = String(c.nomenclature_id)
                      if (!acc[nomId]) acc[nomId] = []
                      acc[nomId].push(c)
                      return acc
                    }, {})

                    return (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                          <h3 style={{ fontSize: '1.2rem', fontWeight: 950, color: '#444', textTransform: 'uppercase', borderLeft: '4px solid #8b5cf6', paddingLeft: '15px', margin: 0 }}>
                            Архів робочих карток (Цех №2)
                          </h3>
                          {taskCards.length > 0 && (
                            <button
                              onClick={() => {
                                const order = orders.find(o => o.id === task.order_id)
                                setPrintModalData({
                                  isMultiple: true,
                                  cards: taskCards.map(c => {
                                    let cNom = nomenclatures.find(n => String(n.id) === String(c.nomenclature_id))
                                    if (!cNom || String(c.nomenclature_id) === 'null') {
                                      const info = c.card_info || ''
                                      const orderNumMatch = info.match(/Наряд №(\d+)/)
                                      const orderNum = orderNumMatch ? orderNumMatch[1] : null
                                      if (orderNum) {
                                        const orderObj = orders.find(o => String(o.order_num) === String(orderNum) || String(o.id) === String(orderNum))
                                        const match = orderObj?.order_items?.find(it => Number(it.quantity) === Number(c.quantity))
                                        if (match) cNom = nomenclatures.find(n => String(n.id) === String(match.nomenclature_id))
                                      }
                                    }
                                    return {
                                      cardId: c.id,
                                      nomName: cNom?.name || 'Невідома деталь',
                                      qty: c.quantity,
                                      stage: c.operation,
                                      orderNum: order?.order_num || '—',
                                      customer: order?.customer || '—'
                                    }
                                  })
                                })
                              }}
                              style={{
                                background: '#8b5cf6',
                                color: '#fff',
                                border: 'none',
                                padding: '10px 20px',
                                borderRadius: '12px',
                                fontWeight: 900,
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
                              }}
                            >
                              <Printer size={16} /> ДРУКУВАТИ ВСІ КАРТКИ ({taskCards.length})
                            </button>
                          )}
                        </div>

                        {taskCards.length === 0 ? (
                          <div style={{ color: '#222', fontSize: '0.85rem', fontWeight: 700 }}>Ще не згенеровано жодної картки</div>
                        ) : (
                          Object.keys(grouped).map(nomId => {
                            let nom = nomenclatures.find(n => String(n.id) === String(nomId))

                            // Херистіка для фантомних карток (якщо ID зламаний, групуємо за кількістю та замовленням)
                            if (!nom || nomId === 'null' || nomId === 'NaN') {
                              const sampleCard = grouped[nomId][0]
                              const info = sampleCard?.card_info || ''
                              const orderNumMatch = info.match(/Наряд №(\d+)/)
                              const orderNum = orderNumMatch ? orderNumMatch[1] : null
                              if (orderNum) {
                                const order = orders.find(o => String(o.order_num) === String(orderNum) || String(o.id) === String(orderNum))
                                const match = order?.order_items?.find(it => Number(it.quantity) === Number(sampleCard.quantity))
                                if (match) nom = nomenclatures.find(n => String(n.id) === String(match.nomenclature_id))
                              }
                            }
                            const cards = grouped[nomId]

                            return (
                              <div key={nomId} style={{ marginBottom: '30px', background: '#111', borderRadius: '24px', border: '1px solid #1a1a1a', overflowX: 'auto' }}>
                                <div style={{ padding: '15px 20px', background: '#1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ fontWeight: 900, fontSize: '0.9rem', color: '#fff' }}>{nom?.name || 'Невідома деталь'}</div>
                                  <div style={{ fontSize: '0.65rem', color: '#555', fontWeight: 800 }}>КАРТОК: {cards.length}</div>
                                </div>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ textAlign: 'left', color: '#444', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', borderBottom: '1px solid #1a1a1a' }}>
                                <th style={{ padding: '12px 20px' }}>ID КАРТКИ</th>
                                <th style={{ padding: '12px 20px' }}>ЕТАП</th>
                                <th style={{ padding: '12px 20px', textAlign: 'center' }}>КІЛЬКІСТЬ</th>
                                <th style={{ padding: '12px 20px', textAlign: 'center' }}>СТАТУС</th>
                                <th style={{ padding: '12px 20px', textAlign: 'center' }}>ДІЯ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cards.map(c => (
                                <tr key={c.id} style={{ borderBottom: '1px solid #161616' }}>
                                  <td style={{ padding: '12px 20px', fontSize: '0.75rem', color: '#888', fontWeight: 700 }}>#{String(c.id).slice(-8).toUpperCase()}</td>
                                  <td style={{ padding: '12px 20px', fontSize: '0.85rem', fontWeight: 900, color: '#fff' }}>{c.operation}</td>
                                  <td style={{ padding: '12px 20px', textAlign: 'center', fontSize: '0.9rem', fontWeight: 1000, color: '#8b5cf6' }}>{c.quantity} шт</td>
                                  <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                                    <div style={{
                                      display: 'inline-block',
                                      padding: '4px 10px',
                                      borderRadius: '10px',
                                      fontSize: '0.65rem',
                                      fontWeight: 900,
                                      background: c.status === 'completed' ? '#10b98122' : (c.status === 'in-progress' ? '#3b82f622' : '#222'),
                                      color: c.status === 'completed' ? '#10b981' : (c.status === 'in-progress' ? '#3b82f6' : '#555')
                                    }}>
                                      {c.status === 'completed' ? 'ГОТОВО' : (c.status === 'in-progress' ? 'В РОБОТІ' : 'НОВА')}
                                    </div>
                                  </td>
                                  <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                                    <button
                                      onClick={() => setPrintModalData({
                                        cardId: c.id,
                                        nomName: nom?.name,
                                        qty: c.quantity,
                                        stage: c.operation,
                                        orderNum: order?.order_num || '—',
                                        customer: order?.customer || '—'
                                      })}
                                      style={{ background: 'transparent', border: 'none', color: '#10b981', cursor: 'pointer' }}
                                    >
                                      <Printer size={16} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    })
                  )}
                </>
              )
            })()}
                </div>
              </div>
            )
          })() : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#222' }}>
              <Monitor size={100} style={{ marginBottom: '20px', opacity: 0.1 }} />
              <h3 style={{ fontSize: '1.5rem', fontWeight: 900 }}>Оберіть наряд зі списку зліва</h3>
              <p style={{ fontWeight: 600 }}>Щоб переглянути деталі та керувати процесом</p>
            </div>
          )}
        </div>
      </div>

      {/* ───── МОДАЛ ДРУКУ КАРТКИ ───── */}
      {printModalData && (
        <div className="print-modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          {printModalData.isMultiple ? (
            /* MULTIPLE CARDS MODAL */
            <div className="print-multiple-wrapper" style={{ background: '#fff', color: '#000', padding: '30px', borderRadius: '32px', maxWidth: '900px', width: '100%', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }}>
              <div className="print-hide" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 1000 }}>Друк всіх робочих карток цеху</h3>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '4px' }}>Всього карток до друку: {printModalData.cards.length} шт</div>
                </div>
                <button onClick={() => setPrintModalData(null)} style={{ background: '#f5f5f5', border: 'none', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer' }}><X size={20} /></button>
              </div>

              <div className="print-multiple-grid">
                {printModalData.cards.map((card, idx) => (
                  <div key={idx} className="print-card" style={{ background: '#fff', color: '#000', border: '1px solid #000', borderRadius: '15px', padding: '10px 15px', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box', width: '100%' }}>
                    <div className="print-layout-container" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'space-between', gap: '15px' }}>
                      <div className="print-qr-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <QRCodeCanvas
                          value={JSON.stringify({ id: card.cardId, type: 'work_card_shop2' })}
                          size={110}
                          level="H"
                          includeMargin={true}
                        />
                        <div style={{ marginTop: '5px', fontSize: '0.65rem', fontWeight: 900, color: '#000', letterSpacing: '0.1em' }}>ID: #{card.cardId.slice(-8).toUpperCase()}</div>
                      </div>

                      <div className="print-info-section" style={{ textAlign: 'left', flex: 1 }}>
                        <div className="print-only-header" style={{ marginBottom: '5px' }}>
                          <div style={{ fontSize: '0.55rem', fontWeight: 900, color: '#666', textTransform: 'uppercase', lineHeight: 1 }}>Робоча картка Цех №2</div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 1000, lineHeight: 1.1 }}>Наряд №{card.orderNum}</div>
                        </div>

                        <div style={{ marginBottom: '8px' }}>
                          <div style={{ fontSize: '0.6rem', fontWeight: 900, color: '#666', textTransform: 'uppercase' }}>Номенклатура</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 900, wordBreak: 'break-all' }}>{card.nomName}</div>
                        </div>
                        <div className="print-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div>
                            <div style={{ fontSize: '0.6rem', fontWeight: 900, color: '#666', textTransform: 'uppercase' }}>Кількість</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 1000, color: '#000' }} className="print-qty-text">{card.qty} шт</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.6rem', fontWeight: 900, color: '#666', textTransform: 'uppercase' }}>Етап</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 1000, color: '#000' }} className="print-stage-text">{card.stage}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                className="print-hide"
                onClick={() => window.print()}
                style={{ width: '100%', background: '#000', color: '#fff', border: 'none', padding: '20px', borderRadius: '20px', fontWeight: 1000, fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '30px' }}
              >
                ДРУКУВАТИ ВСІ КАРТКИ ({printModalData.cards.length} шт)
              </button>
            </div>
          ) : (
            <div className="print-card" style={{ background: '#fff', color: '#000', padding: '40px', borderRadius: '32px', maxWidth: '500px', width: '100%', textAlign: 'center', boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }}>
              <div className="print-hide" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#888', textTransform: 'uppercase' }}>Робоча картка Цех №2</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 1000 }}>Наряд №{printModalData.orderNum}</div>
                </div>
                <button onClick={() => setPrintModalData(null)} style={{ background: '#f5f5f5', border: 'none', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer' }}><X size={20} /></button>
              </div>

              <div className="print-layout-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="print-qr-section" style={{ background: '#f9f9f9', padding: '20px', borderRadius: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <QRCodeCanvas
                    value={JSON.stringify({ id: printModalData.cardId, type: 'work_card_shop2' })}
                    size={220}
                    level="H"
                    includeMargin={true}
                  />
                  <div style={{ marginTop: '15px', fontSize: '0.8rem', fontWeight: 900, color: '#aaa', letterSpacing: '0.1em' }}>ID: #{printModalData.cardId.slice(-8).toUpperCase()}</div>
                </div>

                <div className="print-info-section" style={{ textAlign: 'left' }}>
                  <div className="print-only-header" style={{ display: 'none', marginBottom: '10px' }}>
                    <div style={{ fontSize: '0.55rem', fontWeight: 900, color: '#666', textTransform: 'uppercase', lineHeight: 1 }}>Робоча картка Цех №2</div>
                    <div style={{ fontSize: '1rem', fontWeight: 1000, lineHeight: 1.1 }}>Наряд №{printModalData.orderNum}</div>
                  </div>

                  <div style={{ marginBottom: '15px' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#888', textTransform: 'uppercase' }}>Номенклатура</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, wordBreak: 'break-all' }}>{printModalData.nomName}</div>
                  </div>
                  <div className="print-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#888', textTransform: 'uppercase' }}>Кількість</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 1000, color: '#8b5cf6' }} className="print-qty-text">{printModalData.qty} шт</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#888', textTransform: 'uppercase' }}>Етап</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 1000, color: '#10b981' }} className="print-stage-text">{printModalData.stage}</div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                className="print-hide"
                onClick={() => window.print()}
                style={{ width: '100%', background: '#000', color: '#fff', border: 'none', padding: '20px', borderRadius: '20px', fontWeight: 1000, fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '30px' }}
              >
                ДРУКУВАТИ КАРТКУ
              </button>
            </div>
          )}
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          @page {
            size: auto;
            margin: 0;
          }
          body {
            margin: 0;
            background: #fff;
            color: #000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          /* Reset main module wrapper background to white */
          .shop2-module {
            background: #fff !important;
            color: #000 !important;
            min-height: 0 !important;
            height: auto !important;
          }
          /* Hide non-print layouts completely so they do not take layout space or trigger extra pages */
          header, .side-panel, .main-content, .print-hide {
            display: none !important;
          }
          /* Reset modal backdrop styles for printing */
          .print-modal-backdrop {
            position: static !important;
            background: none !important;
            padding: 0 !important;
            display: block !important;
            width: auto !important;
            height: auto !important;
            box-shadow: none !important;
          }
          .print-multiple-wrapper {
            position: static !important;
            background: none !important;
            padding: 0 !important;
            width: auto !important;
            height: auto !important;
            box-shadow: none !important;
            max-height: none !important;
            overflow: visible !important;
          }
          .print-multiple-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 6mm 10mm !important;
            padding: 15mm !important;
            box-sizing: border-box !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            max-height: none !important;
            background: none !important; /* Усуваємо темний фон */
            border: none !important;     /* Прибираємо зовнішню рамку */
          }
          .print-multiple-grid .print-card {
            position: relative !important;
            left: auto !important;
            top: auto !important;
            width: 8.6cm !important;
            height: 5.5cm !important;
            margin: 0 !important;
            padding: 0.2cm 0.4cm !important;
            border: 1px solid #000 !important; /* Чорна рамка для зручного вирізання ножницями */
            box-shadow: none !important;
            background: #fff !important;
            color: #000 !important;
            box-sizing: border-box !important;
            border-radius: 4mm !important; /* Заокруглені кути */
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: space-between !important;
            page-break-inside: avoid !important;
          }
          .print-card {
            position: absolute !important;
            left: 15mm !important;
            top: 15mm !important;
            width: 8.6cm !important;
            height: 5.5cm !important;
            margin: 0 !important;
            padding: 0.2cm 0.4cm !important;
            border: 1px solid #000 !important; /* Чорна рамка для зручного вирізання ножницями */
            box-shadow: none !important;
            background: #fff !important;
            color: #000 !important;
            box-sizing: border-box !important;
            border-radius: 4mm !important; /* Заокруглені кути */
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: space-between !important;
          }
          .print-layout-container {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            width: 100% !important;
            height: 100% !important;
            justify-content: space-between !important;
            gap: 0.4cm !important;
          }
          .print-qr-section {
            background: none !important;
            padding: 0 !important;
            margin: 0 !important;
            border-radius: 0 !important;
            width: 3.2cm !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
          }
          .print-qr-section canvas {
            width: 2.8cm !important;
            height: 2.8cm !important;
            display: block !important;
          }
          .print-qr-section div {
            margin-top: 2px !important;
            font-size: 8px !important;
            color: #000 !important;
            font-weight: bold !important;
          }
          .print-info-section {
            flex: 1 !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            text-align: left !important;
            height: 100% !important;
          }
          .print-only-header {
            display: block !important;
          }
          .print-only-header div:first-child {
            font-size: 7px !important;
            color: #555 !important;
            font-weight: 900 !important;
          }
          .print-only-header div:last-child {
            font-size: 13px !important;
            font-weight: 1000 !important;
            margin-top: 1px !important;
            color: #000 !important;
          }
          .print-info-section > div {
            margin-bottom: 4px !important;
          }
          .print-info-section > div div:first-child {
            font-size: 7px !important;
            color: #555 !important;
            font-weight: 900 !important;
          }
          .print-info-section > div div:last-child {
            font-size: 9px !important;
            font-weight: 850 !important;
            line-height: 1.1 !important;
            color: #000 !important;
          }
          .print-info-section .print-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 10px !important;
            margin-top: 2px !important;
          }
          .print-qty-text, .print-stage-text {
            font-size: 12px !important;
            font-weight: 1000 !important;
            color: #000 !important;
          }
        }
        @media (max-width: 1024px) {
          .hide-mobile { display: none !important; }
          .side-panel { position: fixed; left: 0; top: 0; bottom: 0; z-index: 100000; transform: translateX(-100%); width: 280px !important; }
          .drawer-open { transform: translateX(0); }
          .main-content { padding: 15px !important; }
        }
        .print-multiple-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
          gap: 15px;
          max-height: 60vh;
          overflow-y: auto;
          padding: 10px;
          background: #0d0d0d;
          border-radius: 20px;
          border: 1px solid #222;
        }
        .anim-fade-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
    </div>
  )
}

export default Shop2Module
