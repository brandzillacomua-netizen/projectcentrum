import React, { useState, useMemo } from 'react'
import {
  ClipboardCheck,
  ArrowLeft,
  Printer,
  Play,
  History,
  Search,
  Menu,
  X,
  ListChecks,
  Monitor
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'

const MasterModule = () => {
  const {
    orders, tasks, machines, nomenclatures, bomItems, inventory,
    totalProduced, totalScrapCount,
    createNaryad, issueMaterials, approveWarehouse
  } = useMES()

  const [activeNaryadOrder, setActiveNaryadOrder] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedMachine, setSelectedMachine] = useState(null)
  const [isReprintMode, setIsReprintMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [reprintTask, setReprintTask] = useState(null)
  
  // Quick Plan state
  const [quickPlanOrder, setQuickPlanOrder] = useState(null)
  const [tempSets, setTempSets] = useState(0)
  const [tempDeadline, setTempDeadline] = useState('')

  const getPlannedQty = (orderItemId) => {
    const item = orders.flatMap(o => o.order_items || []).find(it => it.id === orderItemId)
    if (!item) return 0
    
    // Simplest and most reliable logic: sum planned_sets from all tasks for this order
    // Since a task represents a batch of sets for the entire order
    return tasks
      .filter(t => String(t.order_id) === String(item.order_id))
      .reduce((acc, t) => acc + (Number(t.planned_sets) || 0), 0)
  }

  const pendingOrders = orders.filter(o => {
    if (o.status === 'pending') return true
    if (o.status === 'in-progress') {
      // Check if any order item has unplanned balance
      return o.order_items?.some(it => getPlannedQty(it.id) < Number(it.quantity))
    }
    return false
  })
  const filteredPending = pendingOrders.filter(o =>
    o.order_num?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.customer?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const [naryadQtys, setNaryadQtys] = useState({}) // { [orderItemId]: qty }
  const [naryadDeadline, setNaryadDeadline] = useState('')

  const handleOpenNaryadModal = (order, sets, deadline) => {
    setIsReprintMode(false)
    setSelectedMachine(null)
    setActiveNaryadOrder(order)
    setIsDrawerOpen(false)
    setNaryadDeadline(deadline || order.deadline || '')
    
    // Default quantities to remaining balance or proportional to sets
    const initialQtys = {}
    
    if (sets !== undefined) {
      // PROPORTIONAL LOGIC
      const totalRef = Math.max(...(order.order_items?.map(it => Number(it.quantity)) || [1]))
      const isFullPackage = sets >= (totalRef - Math.max(...(order.order_items?.map(it => getPlannedQty(it.id)) || [0])))
      
      order.order_items?.forEach(it => {
        const planned = getPlannedQty(it.id)
        const total = Number(it.quantity)
        const remaining = Math.max(0, total - planned)
        
        if (isFullPackage) {
           initialQtys[it.id] = remaining
        } else {
           const ratio = sets / totalRef
           const calc = Math.min(remaining, Math.round(total * ratio))
           initialQtys[it.id] = calc
        }
      })
    } else {
      order.order_items?.forEach(it => {
        const remaining = Math.max(0, Number(it.quantity) - getPlannedQty(it.id))
        initialQtys[it.id] = remaining
      })
    }
    setNaryadQtys(initialQtys)
  }

  const getBOMParts = (nomenclatureId) => {
    return bomItems
      .filter(b => b.parent_id === nomenclatureId)
      .map(b => ({
        nom: nomenclatures.find(n => n.id === b.child_id),
        quantity_per_parent: b.quantity_per_parent
      }))
  }

  // Robust machine lookup to ensure we have capacity even in reprint mode
  const currentMachine = useMemo(() => {
    if (!selectedMachine) return null
    if (selectedMachine.sheet_capacity) return selectedMachine
    return machines.find(m => m.name === selectedMachine.name) || selectedMachine
  }, [selectedMachine, machines])

  const handlePrint = async () => {
    if (!activeNaryadOrder || isSubmitting) return

    setIsSubmitting(true)
    try {
      // Trigger print dialog immediately
      window.print()

      if (isReprintMode) {
        setReprintTask(null)
        setActiveNaryadOrder(null)
      } else {
        // Call with custom quantities and deadline
        await apiService.submitCreateTask(activeNaryadOrder.id, '', (oid, m) => createNaryad(oid, m, naryadQtys, naryadDeadline))
        setActiveNaryadOrder(null)
      }
    } catch (err) {
      console.error("Naryad creation error:", err)
      alert("Помилка створення наряду: " + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReprint = (task) => {
    const order = orders.find(o => o.id === task.order_id)
    if (order) {
      setIsReprintMode(true)
      setReprintTask(task)
      setSelectedMachine({ name: task.machine_name })
      setActiveNaryadOrder(order)
    }
  }

  const materialSummary = useMemo(() => {
    if (!activeNaryadOrder) return []
    const summary = {}

    activeNaryadOrder.order_items?.forEach(item => {
      const parts = getBOMParts(item.nomenclature_id)
      const displayParts = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === item.nomenclature_id), quantity_per_parent: 1 }]

      const currentQty = isReprintMode ? Number(item.quantity) : (naryadQtys[item.id] || 0)
      if (currentQty <= 0) return

      displayParts.forEach(part => {
        if (!part.nom || part.nom.type === 'hardware' || part.nom.type === 'fastener') return
        
        const snapshot = reprintTask?.plan_snapshot?.[String(part.nom.id)]
        const totalNeeded = snapshot ? snapshot.need : (currentQty * (Number(part.quantity_per_parent) || 1))
        const inStock = snapshot ? snapshot.stock : (() => {
          const bzInv = inventory.find(i => String(i.nomenclature_id) === String(part.nom.id) && i.type === 'bz')
          return bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0
        })()
        
        const totalToProduce = Math.max(0, totalNeeded - inStock)
        if (totalToProduce <= 0) return

        const matKey = (part.nom.material_type || part.nom.name || 'Інше').trim()
        const unitsPerSheet = Number(part.nom.units_per_sheet) || 1
        const sheets = Math.ceil(totalToProduce / unitsPerSheet)
        const unit = (part.nom.type === 'hardware' || part.nom.type === 'fastener') ? 'шт' : 'ЛИСТІВ'

        if (!summary[matKey]) {
          summary[matKey] = { name: matKey, sheets: 0, unit }
        }
        summary[matKey].sheets += sheets
      })
    })

    return Object.values(summary)
  }, [activeNaryadOrder, inventory, reprintTask, nomenclatures, bomItems, naryadQtys, isReprintMode])

  const productNames = useMemo(() => {
    if (!activeNaryadOrder) return ''
    return activeNaryadOrder.order_items
      ?.map(it => nomenclatures.find(n => n.id === it.nomenclature_id)?.name)
      .filter(Boolean)
      .join(', ')
  }, [activeNaryadOrder, nomenclatures])

  const consumableSummary = useMemo(() => {
    if (!activeNaryadOrder) return []
    const totalSheetsCount = materialSummary.reduce((acc, m) => acc + (Number(m.sheets) || 0), 0)
    if (totalSheetsCount <= 0) return []

    return nomenclatures
      .filter(n => n.type === 'consumable' && (Number(n.consumption_per_sheet) || 0) > 0)
      .map(n => ({
        name: n.name,
        total: Math.ceil(totalSheetsCount * Number(n.consumption_per_sheet))
      }))
  }, [activeNaryadOrder, materialSummary, nomenclatures])

  const renderAnalytics = () => (
    <div className="analytics-scroll" style={{ overflowX: 'auto', marginBottom: '25px', display: 'flex', gap: '15px', paddingBottom: '10px' }}>
      <div className="ana-card-v2" style={{ minWidth: '140px', flex: 1, background: '#111', padding: '15px', borderRadius: '16px', border: '1px solid #222' }}>
        <div style={{ color: '#555', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase' }}>Виконано</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#ff9000' }}>{(Number(totalProduced) || 0).toString()}</div>
      </div>
      <div className="ana-card-v2" style={{ minWidth: '140px', flex: 1, background: '#111', padding: '15px', borderRadius: '16px', border: '1px solid #222' }}>
        <div style={{ color: '#555', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase' }}>Брак</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#ef4444' }}>{(Number(totalScrapCount) || 0).toString()} <small style={{ fontSize: '0.7rem' }}>шт</small></div>
      </div>
      <div className="ana-card-v2" style={{ minWidth: '140px', flex: 1, background: '#111', padding: '15px', borderRadius: '16px', border: '1px solid #222' }}>
        <div style={{ color: '#555', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase' }}>В роботі</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#3b82f6' }}>{tasks.filter(t => t.status === 'in-progress').length}</div>
      </div>
    </div>
  )

  const renderOrderQueue = () => (
    <section className="grid-col">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ fontSize: '0.85rem', color: '#555', margin: 0 }}><ListChecks size={16} /> ЧЕРГА ЗАМОВЛЕНЬ</h3>
        <div style={{ position: 'relative' }}>
          <Search size={12} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#444' }} />
          <input style={{ background: '#000', border: '1px solid #222', borderRadius: '8px', padding: '4px 8px 4px 25px', color: '#fff', fontSize: '0.75rem', width: '110px' }} placeholder="Пошук..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
      </div>
      <div className="v-stack" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredPending.map(order => (
          <div key={order.id} className="order-p-card glass-panel" style={{ background: '#0f0f0f', padding: '15px', borderRadius: '16px', border: '1px solid #1a1a1a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <strong style={{ fontSize: '1rem' }}>№{order.order_num}</strong>
              <span style={{ fontSize: '0.65rem', color: '#444' }}>{order.order_date ? new Date(order.order_date).toLocaleDateString() : ''}</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '12px' }}>{order.customer}</div>
            <div style={{ marginBottom: '12px' }}>
              {order.order_items?.map(it => {
                const planned = getPlannedQty(it.id)
                const total = Number(it.quantity)
                const nom = nomenclatures.find(n => n.id === it.nomenclature_id)
                return (
                  <div key={it.id} style={{ fontSize: '0.65rem', color: planned >= total ? '#22c55e' : '#ff9000', display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span>{nom?.name}:</span>
                    <span>{planned} / {total} шт</span>
                  </div>
                )
              })}
            </div>
            <button 
              onClick={() => {
                setQuickPlanOrder(order);
                const maxRem = Math.max(...(order.order_items?.map(it => Number(it.quantity) - getPlannedQty(it.id)) || [0]));
                setTempSets(maxRem);
                setTempDeadline(order.deadline || '');
              }} 
              style={{ width: '100%', padding: '10px', background: '#ff9000', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 900, cursor: 'pointer', fontSize: '0.75rem' }}
            >
              СФОРМУВАТИ НАРЯД
            </button>
          </div>
        ))}
      </div>
    </section>
  )

  return (
    <div className="master-module-v2" style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <nav className="module-nav no-print" style={{ flexShrink: 0, padding: '0 20px', height: '70px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#000', borderBottom: '1px solid #222' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Link to="/" className="back-link" style={{ color: '#555', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}><ArrowLeft size={18} /> <span className="hide-mobile">Назад</span></Link>
          <button onClick={() => setIsDrawerOpen(true)} className="burger-btn mobile-only"><Menu size={24} /></button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ClipboardCheck className="text-accent" size={24} color="#ff9000" />
          <h1 style={{ fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase', margin: 0 }} className="hide-mobile">Керування виробництвом</h1>
        </div>
        <div className="hide-mobile" style={{ fontSize: '0.8rem', color: '#444', fontWeight: 700 }}>СИСТЕМА MES v2.1</div>
      </nav>

      <div className="module-content no-print" style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
        <div className="hide-mobile">
          {renderAnalytics()}
        </div>

        <div className="master-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 320px) 1fr minmax(280px, 300px)', gap: '25px' }}>
          <div className="hide-mobile">{renderOrderQueue()}</div>

          <section className="grid-col">
            <h3 style={{ fontSize: '0.85rem', color: '#555', marginBottom: '15px' }}><Play size={16} fill="currentColor" /> АКТИВНІ В ЦЕХУ</h3>
            <div className="v-stack" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {tasks.filter(t => t.status !== 'completed' && t.status !== 'pending').map(task => {
                const order = orders.find(o => o.id === task.order_id)
                const taskProductNames = order?.order_items
                  ?.map(it => nomenclatures.find(n => n.id === it.nomenclature_id)?.name)
                  .filter(Boolean)
                  .join(', ') || 'Вирів...'

                const isSkladConfirmed = task.warehouse_conf === true
                const isTechConfirmed = task.engineer_conf === true
                const isDirConfirmed = task.director_conf === true

                return (
                  <div key={task.id} style={{ position: 'relative', background: '#111', padding: '20px', borderRadius: '20px', border: '1px solid #222', borderLeft: '4px solid #ff9000' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '1rem', fontWeight: 900 }}>{order?.order_num} — {order?.customer}</strong>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <button onClick={() => handleReprint(task)} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer' }} title="Друк наряду"><Printer size={20} /></button>
                        {isSkladConfirmed && isTechConfirmed && isDirConfirmed && <div style={{ width: '10px', height: '10px', background: '#22c55e', borderRadius: '2px' }}></div>}
                      </div>
                    </div>

                    <div className="card-product-label" style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 1000, marginBottom: '12px', textTransform: 'uppercase' }}>
                      {taskProductNames}
                    </div>

                    <div style={{ fontSize: '0.75rem', color: '#444', fontWeight: 600, marginBottom: '15px', display: 'flex', gap: '10px' }}>
                      <span>{task.step} |</span>
                      <span style={{ color: '#ff9000', fontWeight: 800 }}>{task.machine_name}</span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{
                        fontSize: '0.65rem',
                        padding: '5px 12px',
                        borderRadius: '8px',
                        background: isSkladConfirmed ? '#064e3b' : '#1a1a1a',
                        color: isSkladConfirmed ? '#10b981' : '#333',
                        fontWeight: 1000,
                        border: isSkladConfirmed ? '1px solid #10b981' : '1px solid #222'
                      }}>СКЛАД</div>
                      <div style={{
                        fontSize: '0.65rem',
                        padding: '5px 12px',
                        borderRadius: '8px',
                        background: isTechConfirmed ? '#064e3b' : '#1a1a1a',
                        color: isTechConfirmed ? '#10b981' : '#333',
                        fontWeight: 1000,
                        border: isTechConfirmed ? '1px solid #10b981' : '1px solid #222'
                      }}>ІНЖЕНЕР</div>
                      <div style={{
                        fontSize: '0.65rem',
                        padding: '5px 12px',
                        borderRadius: '8px',
                        background: isDirConfirmed ? '#064e3b' : '#1a1a1a',
                        color: isDirConfirmed ? '#10b981' : '#333',
                        fontWeight: 1000,
                        border: isDirConfirmed ? '1px solid #10b981' : '1px solid #222'
                      }}>ДИРЕКТОР</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="grid-col">
            <h3 style={{ fontSize: '0.85rem', color: '#555', marginBottom: '15px' }}><History size={16} /> АРХІВ СЬОГОДНІ</h3>
            <div className="v-stack" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {tasks.filter(t => {
                if (t.status !== 'completed' || !t.completed_at) return false
                const d = new Date(t.completed_at)
                const now = new Date()
                return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
              }).sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at)).map(task => {
                const order = orders.find(o => o.id === task.order_id)
                return (
                  <div key={task.id} style={{ background: '#0a0a0a', padding: '15px', borderRadius: '16px', border: '1px solid #1a1a1a', opacity: 0.6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '0.9rem', color: '#fff' }}>№{order?.order_num}</strong>
                      <span style={{ fontSize: '0.65rem', color: '#444' }}>{new Date(task.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#555', marginBottom: '8px' }}>{order?.customer}</div>
                    <div style={{ fontSize: '0.65rem', color: '#333', fontWeight: 800, textTransform: 'uppercase' }}>{task.step}</div>
                  </div>
                )
              })}
              {tasks.filter(t => t.status === 'completed' && new Date(t.completed_at).toDateString() === new Date().toDateString()).length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#222', fontSize: '0.75rem' }}>Сьогодні ще немає завершених нарядів</div>
              )}
            </div>
          </section>
        </div>
      </div>

      {activeNaryadOrder && (
        <div className="worksheet-modal-overlay print-target" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '15px' }}>
          <div className="worksheet-panel glass-panel" style={{ background: '#0a0a0a', width: '100%', maxWidth: '1000px', maxHeight: '100vh', borderRadius: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #222' }}>

            <div className="worksheet-header-area" style={{ padding: '35px 45px', background: '#0a0a0a', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <h2 className="doc-ti" style={{ margin: 0, fontSize: '1.8rem', color: '#ff9000', fontWeight: 950, letterSpacing: '-0.02em' }}>
                      НАРЯД № {activeNaryadOrder.order_num}
                      {(() => {
                        if (isReprintMode && reprintTask) {
                          return reprintTask.batch_index ? `/${reprintTask.batch_index}` : '';
                        }
                        const totalUnits = activeNaryadOrder.order_items?.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0) || 0;
                        const thisNaryadTotal = Object.values(naryadQtys).reduce((acc, v) => acc + (Number(v) || 0), 0) || 0;
                        const alreadyPlanned = tasks.filter(t => String(t.order_id) === String(activeNaryadOrder.id)).reduce((acc, t) => acc + (Number(t.planned_sets) || 0), 0);
                        
                        if (thisNaryadTotal < totalUnits || alreadyPlanned > 0) {
                           const idx = tasks.filter(t => t.order_id === activeNaryadOrder.id).length + 1;
                           return `/${idx}`;
                        }
                        return '';
                      })()}
                    </h2>
                  </div>
                  <button onClick={() => setActiveNaryadOrder(null)} className="no-print" style={{ background: '#111', border: '1px solid #222', color: '#555', cursor: 'pointer', width: '45px', height: '45px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={24} /></button>
                </div>

                <div style={{ background: '#111', padding: '20px 25px', borderRadius: '20px', border: '1px solid #1a1a1a' }} className="print-info-box">
                  <div className="print-prod-info" style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 1000, marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '4px', height: '24px', background: '#ff9000', borderRadius: '2px' }} className="no-print"></div>
                    ВИРІБ: <span style={{ color: '#ff9000' }}>{productNames || '—'}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '25px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <span style={{ fontSize: '0.65rem', color: '#555', fontWeight: 900, textTransform: 'uppercase' }}>ЗАМОВНИК</span>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: '#eee' }}>{activeNaryadOrder.customer}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <span style={{ fontSize: '0.65rem', color: '#555', fontWeight: 900, textTransform: 'uppercase' }}>ДАТА ФОРМУВАННЯ</span>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: '#eee' }}>{new Date().toLocaleDateString('uk-UA')}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <span style={{ fontSize: '0.65rem', color: '#555', fontWeight: 900, textTransform: 'uppercase' }}>ДЕДЛАЙН НА ЦЮ ПАРТІЮ</span>
                      <div className="no-print">
                        <input 
                          type="date" 
                          value={naryadDeadline ? naryadDeadline.split('T')[0] : ''} 
                          onChange={(e) => setNaryadDeadline(e.target.value)}
                          style={{ background: '#111', border: '1px solid #333', color: '#fff', padding: '5px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 800 }}
                        />
                      </div>
                      <span className="print-only" style={{ fontSize: '1rem', fontWeight: 800, color: '#eee' }}>
                        {(isReprintMode && reprintTask) 
                           ? (reprintTask.planned_deadline ? new Date(reprintTask.planned_deadline).toLocaleDateString('uk-UA') : '—')
                           : (naryadDeadline ? new Date(naryadDeadline).toLocaleDateString('uk-UA') : '—')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="worksheet-scrollable" style={{ flex: 1, overflowY: 'auto', padding: '30px 40px' }}>


              <div className="table-responsive-container" style={{ marginBottom: '35px' }}>
                <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ background: '#111', textAlign: 'left', color: '#555' }} className="print-thr">
                      <th style={{ padding: '12px 15px', width: '30%', borderBottom: '1.5px solid #222' }}>ДЕТАЛЬ В РОЗКРІЙ</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '8%' }}>ПОТРЕБА</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '10%' }}>СКЛАД БЗ</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '8%', color: '#ff9000' }}>ПЛАН</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '22%' }}>МАТЕРІАЛ</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '7%' }}>ШТ/Л</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '7%', color: '#22c55e' }}>ЛИСТІВ</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '8%', color: '#ff9000' }}>БЗ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeNaryadOrder.order_items?.map(it => {
                      const planned = getPlannedQty(it.id)
                      const remainingBalance = Math.max(0, Number(it.quantity) - planned)
                      const thisNaryadQty = naryadQtys[it.id] || 0

                      const parts = getBOMParts(it.nomenclature_id)
                      const allParts = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === it.nomenclature_id), quantity_per_parent: 1 }]
                      const displayParts = allParts.filter(p => p.nom?.type === 'part')
                      
                      return displayParts.map((part, pIdx) => {
                        const snapshot = reprintTask?.plan_snapshot?.[String(part.nom?.id)]
                        
                        // If reprint, use snapshot. Otherwise use thisNaryadQty
                        const totalNeeded = snapshot ? snapshot.need : (thisNaryadQty * (Number(part.quantity_per_parent) || 1))
                        const inStock = snapshot ? snapshot.stock : (() => {
                          const bzInv = inventory.find(i => String(i.nomenclature_id) === String(part.nom?.id) && i.type === 'bz')
                          return bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0
                        })()
                        const totalToProduce = snapshot ? snapshot.plan : Math.max(0, totalNeeded - inStock)

                        const unitsPerSheet = Number(part.nom?.units_per_sheet) || 1
                        const sheets = Math.ceil(totalToProduce / unitsPerSheet)

                        return (
                          <tr key={`${it.id}-${pIdx}`} style={{ borderBottom: '1px solid #1a1a1a' }} className="print-tr">
                            <td style={{ padding: '18px 15px' }}>
                              <div style={{ fontWeight: 1000, color: '#fff', fontSize: '1rem', letterSpacing: '-0.01em' }} className="print-txt">{part.nom?.name || '—'}</div>
                              <div style={{ fontSize: '0.6rem', color: '#444', fontWeight: 900, marginTop: '3px', textTransform: 'uppercase' }} className="print-subtxt">{part.nom?.nomenclature_code || 'БЕЗ КОДУ'}</div>
                            </td>
                            <td style={{ padding: '18px 15px', textAlign: 'center', fontSize: '1.1rem', color: '#fff', fontWeight: 900 }}>
                              {totalNeeded.toString()}
                            </td>
                            <td style={{ padding: '18px 15px', textAlign: 'center', color: '#555', fontSize: '0.85rem' }}>
                              {inStock.toString()}
                            </td>
                            <td style={{ padding: '18px 15px', textAlign: 'center', fontSize: '1.2rem', color: '#ff9000', fontWeight: 1000 }}>
                              {totalToProduce.toString()}
                            </td>
                            <td style={{ padding: '18px 15px', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.85rem', color: '#aaa', fontWeight: 700 }} className="print-subtxt">{part.nom?.material_type || '—'}</div>
                            </td>
                            <td style={{ padding: '18px 15px', textAlign: 'center', color: '#555', fontSize: '0.9rem' }}>
                              {unitsPerSheet.toString()}
                            </td>
                            <td style={{ padding: '18px 15px', textAlign: 'center', fontWeight: 1000, color: '#22c55e', fontSize: '1.4rem' }} className="print-accent-g">
                              {totalToProduce > 0 ? (sheets || 0).toString() : '0'}
                            </td>
                            <td style={{ padding: '18px 15px', textAlign: 'center', fontSize: '1rem', color: '#ff9000', fontWeight: 900 }}>
                              {totalToProduce > 0 ? `+${(sheets * unitsPerSheet) - totalToProduce}` : '0'}
                            </td>
                          </tr>
                        )
                      })
                    })}
                  </tbody>
                  <tfoot style={{ background: 'rgba(255,144,0,0.05)', borderTop: '2px solid #ff9000' }} className="print-tf">
                    <tr>
                      <td style={{ padding: '12px 15px', fontWeight: 1000, fontSize: '1.1rem', textTransform: 'uppercase', border: '1px solid #000' }} className="print-txt">ЗАГАЛЬНИЙ ПІДСУМОК:</td>
                      <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.2rem', border: '1px solid #000' }} className="print-txt">
                        {(activeNaryadOrder.order_items?.reduce((acc, it) => acc + (isReprintMode ? Number(it.quantity) : (naryadQtys[it.id] || 0)), 0) || 0).toString()}
                      </td>
                      <td style={{ border: '1px solid #000' }}></td>
                      <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.4rem', color: '#ff9000', border: '1px solid #000' }} className="print-txt">
                        {(() => {
                          if (isReprintMode && reprintTask) return (reprintTask.planned_sets || 0).toString();
                          return (Object.values(naryadQtys).length > 0 ? Math.max(...Object.values(naryadQtys).map(v => Number(v) || 0)) : 0).toString();
                        })()}
                      </td>
                      <td style={{ border: '1px solid #000' }}></td>
                      <td style={{ border: '1px solid #000' }}></td>
                      <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.6rem', color: '#22c55e', border: '1px solid #000' }} className="print-accent-g">
                        {materialSummary.reduce((acc, m) => acc + (m.sheets || 0), 0).toString()}
                      </td>
                      <td style={{ border: '1px solid #000' }}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {materialSummary.length > 0 && (
                <div className="mat-summary-section" style={{ marginTop: '25px', padding: '20px 30px', borderRadius: '18px', border: '1px solid #222', background: '#070707' }}>
                  <h4 style={{ margin: '0 0 15px', fontSize: '0.75rem', fontWeight: 950, color: '#444', textTransform: 'uppercase' }}>ВІДОМІСТЬ МАТЕРІАЛІВ:</h4>
                  <div className="mat-flex-row" style={{ display: 'flex', flexWrap: 'nowrap', gap: '25px', overflowX: 'hidden' }}>
                    {materialSummary.map((m, idx) => (
                      <div key={idx} className="mat-card-p" style={{ flex: 1, padding: '0 0 5px 15px', borderLeft: '4px solid #ff9000', minWidth: 'min-content' }}>
                        <div style={{ fontSize: '0.6rem', color: '#555', fontWeight: 800, marginBottom: '3px' }} className="print-subtxt">{m.name || '—'}</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 950, color: '#fff' }} className="print-txt">{(Number(m.sheets) || 0).toString()} <small style={{ fontSize: '0.65rem', fontWeight: 400, color: '#444' }} className="print-subtxt">{m.unit || 'ЛИСТІВ'}</small></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {consumableSummary.length > 0 && (
                <div className="consumable-summary-section" style={{ marginTop: '15px', padding: '20px 30px', borderRadius: '18px', border: '1px solid #222', background: 'rgba(59,130,246,0.05)' }}>
                  <h4 style={{ margin: '0 0 15px', fontSize: '0.75rem', fontWeight: 950, color: '#3b82f6', textTransform: 'uppercase' }}>ВИТРАТНІ МАТЕРІАЛИ:</h4>
                  <div className="mat-flex-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '25px' }}>
                    {consumableSummary.map((c, idx) => (
                      <div key={idx} className="mat-card-p" style={{ padding: '0 0 5px 15px', borderLeft: '4px solid #3b82f6', minWidth: '150px' }}>
                        <div style={{ fontSize: '0.6rem', color: '#555', fontWeight: 800, marginBottom: '3px' }} className="print-subtxt">{c.name}</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 950, color: '#fff' }} className="print-txt">{(Number(c.total) || 0).toString()} <small style={{ fontSize: '0.65rem', fontWeight: 400, color: '#444' }} className="print-subtxt">ОД.</small></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="no-print" style={{ padding: '30px 40px', background: '#111', borderTop: '1px solid #222', display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
              <button onClick={() => { setActiveNaryadOrder(null); setReprintTask(null); }} style={{ background: '#222', color: '#fff', border: 'none', padding: '12px 30px', borderRadius: '12px', fontWeight: 800, cursor: 'pointer' }}>СКАСУВАТИ</button>
              <button
                onClick={handlePrint}
                disabled={isSubmitting}
                style={{
                  background: isSubmitting ? '#444' : '#ff9000',
                  color: isSubmitting ? '#888' : '#000',
                  border: 'none',
                  padding: '12px 45px',
                  borderRadius: '12px',
                  fontWeight: 950,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  transition: '0.2s',
                  opacity: isSubmitting ? 0.7 : 1
                }}
              >
                {isSubmitting ? 'ЧЕКАЙТЕ...' : (isReprintMode ? 'ПОВТОРНИЙ ДРУК' : 'ДРУКУВАТИ ТА В РОБОТУ')}
              </button>
            </div>
          </div>
        </div>
      )}

      {quickPlanOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ background: '#0a0a0a', padding: '30px', borderRadius: '24px', border: '1px solid #222', width: '90%', maxWidth: '400px' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '1.2rem', color: '#ff9000', fontWeight: 900 }}>ШВИДКЕ ПЛАНУВАННЯ</h3>
            <p style={{ fontSize: '0.8rem', color: '#555', marginBottom: '25px' }}>Вкажіть кількість комплектів для цього наряду та планивий дедлайн.</p>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.65rem', color: '#444', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>КІЛЬКІСТЬ КОМПЛЕКТІВ</label>
              <input 
                type="number" 
                value={tempSets}
                onChange={e => setTempSets(Number(e.target.value))}
                style={{ width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 900 }} 
              />
            </div>
            
            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', fontSize: '0.65rem', color: '#444', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>ДЕЛАЙН ПАРТІЇ</label>
              <input 
                type="date" 
                value={tempDeadline ? tempDeadline.split('T')[0] : ''}
                onChange={e => setTempDeadline(e.target.value)}
                style={{ width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '1rem', fontWeight: 800 }} 
              />
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setQuickPlanOrder(null)} style={{ flex: 1, padding: '12px', background: '#222', color: '#555', border: 'none', borderRadius: '12px', fontWeight: 800, cursor: 'pointer' }}>СКАСУВАТИ</button>
              <button 
                onClick={() => {
                  handleOpenNaryadModal(quickPlanOrder, tempSets, tempDeadline);
                  setQuickPlanOrder(null);
                }} 
                style={{ flex: 2, padding: '12px', background: '#ff9000', color: '#000', border: 'none', borderRadius: '12px', fontWeight: 900, cursor: 'pointer' }}
              >
                ДАЛІ
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          @page { 
            size: A4 portrait; 
            margin: 0 !important; 
          }
          
          /* Force box-sizing and white backgrounds */
          * { 
            visibility: hidden !important; 
            background: transparent !important; 
            color: #000 !important; 
            box-sizing: border-box !important;
            box-shadow: none !important;
            text-shadow: none !important;
            -webkit-print-color-adjust: exact !important;
          }
          
          .print-target, .print-target * { 
            visibility: visible !important; 
          }
          
          /* FIXED WIDTH CONTAINER FOR A4 */
          .print-target { 
            position: absolute !important; 
            top: 0 !important; 
            left: 0 !important;
            width: 210mm !important;
            min-height: 297mm !important;
            background: #fff !important; 
            display: block !important;
            padding: 10mm !important;
            margin: 0 !important;
            z-index: 99999 !important;
            overflow: visible !important;
          }
          
          .worksheet-panel {
            background: #fff !important;
            width: 100% !important;
            max-width: 190mm !important; /* Content area */
            height: auto !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          
          .worksheet-header-area { 
            border-bottom: 2px solid #000 !important; 
            padding: 0 0 10px 0 !important;
            margin-bottom: 15px !important;
            width: 100% !important;
          }

          .doc-ti { 
            font-size: 2.2rem !important; 
            margin-bottom: 10px !important;
          }
          
          .print-info-box { 
            border: 2px solid #000 !important; 
            padding: 10px 15px !important;
            margin-bottom: 15px !important;
            width: 100% !important;
          }

          .print-prod-info {
            font-size: 1.4rem !important;
            text-decoration: underline !important;
          }
          
          .worksheet-scrollable, .table-responsive-container { 
            padding: 0 !important; 
            margin: 0 !important;
            overflow: visible !important; 
            width: 100% !important;
            display: block !important;
          }

          /* STRICT TABLE LAYOUT */
          .print-table { 
            border-collapse: collapse !important; 
            width: 190mm !important; 
            border: 2px solid #000 !important;
            table-layout: fixed !important;
          }

          /* COLUMN SIZING (TOTAL: 190mm) */
          /* Name: 80, Need: 15, Stock: 15, Plan: 15, Material: 30, QTY/SH: 10, Sheets: 10, Surplus: 15 */
          .print-table th:nth-child(1), .print-table td:nth-child(1) { width: 80mm !important; text-align: left !important; }
          .print-table th:nth-child(2), .print-table td:nth-child(2) { width: 15mm !important; text-align: center !important; white-space: nowrap !important; }
          .print-table th:nth-child(3), .print-table td:nth-child(3) { width: 15mm !important; text-align: center !important; white-space: nowrap !important; }
          .print-table th:nth-child(4), .print-table td:nth-child(4) { width: 15mm !important; text-align: center !important; white-space: nowrap !important; }
          .print-table th:nth-child(5), .print-table td:nth-child(5) { width: 30mm !important; text-align: left !important; }
          .print-table th:nth-child(6), .print-table td:nth-child(6) { width: 10mm !important; text-align: center !important; white-space: nowrap !important; }
          .print-table th:nth-child(7), .print-table td:nth-child(7) { width: 10mm !important; text-align: center !important; white-space: nowrap !important; }
          .print-table th:nth-child(8), .print-table td:nth-child(8) { width: 15mm !important; text-align: center !important; white-space: nowrap !important; }

          .print-thr th {
             padding: 4px 3px !important;
             font-size: 0.65rem !important;
             border: 1px solid #000 !important;
             background: #eee !important;
             text-transform: uppercase !important;
          }
          .print-tr td {
            padding: 3px 4px !important;
            border: 1px solid #000 !important;
            font-size: 0.75rem !important;
            vertical-align: middle !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            word-break: break-all !important;
          }
          .print-tf td {
            font-weight: bold !important;
            font-size: 1rem !important;
            padding: 6px 5px !important;
            border: 2px solid #000 !important;
            background: #eee !important;
          }
          
          .print-txt { font-weight: bold !important; }
          .print-subtxt { font-weight: bold !important; font-size: 0.6rem !important; }
          
          /* Summaries */
          .mat-summary-section, .consumable-summary-section { 
            border: 2px solid #000 !important; 
            margin-top: 15px !important;
            padding: 10px !important;
            width: 100% !important;
            page-break-inside: avoid !important;
          }
          .mat-card-p { 
            border-left: 5px solid #000 !important; 
            margin-bottom: 5px !important;
          }
          
          .no-print { display: none !important; }
          ::-webkit-scrollbar { display: none !important; }
        }
      `}} />
    </div>
  )
}

export default MasterModule
