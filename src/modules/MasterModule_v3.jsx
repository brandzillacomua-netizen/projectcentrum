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
    orders, tasks, machines, nomenclatures, bomItems,
    totalProduced, totalScrapCount,
    createNaryad, issueMaterials, approveWarehouse
  } = useMES()

  const [activeNaryadOrder, setActiveNaryadOrder] = useState(null)
  const [selectedMachine, setSelectedMachine] = useState(null)
  const [isReprintMode, setIsReprintMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const pendingOrders = orders.filter(o => o.status === 'pending')
  const filteredPending = pendingOrders.filter(o =>
    o.order_num?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.customer?.toLowerCase().includes(searchQuery.toLowerCase())
  )

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

  const handlePrint = () => {
    if (!activeNaryadOrder) return

    // Trigger print dialog immediately
    window.print()

    if (isReprintMode) {
      setActiveNaryadOrder(null)
    } else {
      // Call with empty string or null for machine since Master no longer selects it
      apiService.submitCreateTask(activeNaryadOrder.id, '', createNaryad)
      setActiveNaryadOrder(null)
    }
  }

  const handleReprint = (task) => {
    const order = orders.find(o => o.id === task.order_id)
    if (order) {
      setIsReprintMode(true)
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

      displayParts.forEach(part => {
        if (!part.nom) return
        const totalToProduce = (Number(item.quantity) || 0) * (Number(part.quantity_per_parent) || 1)
        const unitsPerSheet = Number(part.nom.units_per_sheet) || 1
        const sheets = Math.ceil(totalToProduce / unitsPerSheet)
        const matKey = part.nom.material_type || 'Інші ТМЦ'

        if (!summary[matKey]) summary[matKey] = { name: matKey, sheets: 0 }
        summary[matKey].sheets += sheets
      })
    })
    return Object.values(summary)
  }, [activeNaryadOrder, nomenclatures, bomItems])

  const productNames = useMemo(() => {
    if (!activeNaryadOrder) return ''
    return activeNaryadOrder.order_items
      ?.map(it => nomenclatures.find(n => n.id === it.nomenclature_id)?.name)
      .filter(Boolean)
      .join(', ')
  }, [activeNaryadOrder, nomenclatures])

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
            <button onClick={() => { setIsReprintMode(false); setSelectedMachine(null); setActiveNaryadOrder(order); setIsDrawerOpen(false); }} style={{ width: '100%', padding: '10px', background: '#ff9000', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 900, cursor: 'pointer', fontSize: '0.75rem' }}>СФОРМУВАТИ НАРЯД</button>
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
                    <h2 className="doc-ti" style={{ margin: 0, fontSize: '1.8rem', color: '#ff9000', fontWeight: 950, letterSpacing: '-0.02em' }}>НАРЯД № {activeNaryadOrder.order_num}</h2>
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
                      <span style={{ fontSize: '0.65rem', color: '#555', fontWeight: 900, textTransform: 'uppercase' }}>СТАТУС</span>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: '#22c55e' }}>ПІДГОТОВКА</span>
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
                      <th style={{ padding: '12px 15px', width: '35%', borderBottom: '1.5px solid #222' }}>ДЕТАЛЬ В ПОРІЗКУ</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '8%', borderBottom: '1.5px solid #222' }}>ПЛАН</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '27%', borderBottom: '1.5px solid #222' }}>МАТЕРІАЛ</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', width: '10%', borderBottom: '1.5px solid #222' }}>ШТ/Л</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', color: '#22c55e', width: '10%', borderBottom: '1.5px solid #222' }}>ЛИСТІВ</th>
                      <th style={{ padding: '12px 15px', textAlign: 'center', color: '#ff9000', width: '10%', borderBottom: '1.5px solid #222' }}>БЗ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeNaryadOrder.order_items?.map(it => {
                      const parts = getBOMParts(it.nomenclature_id)
                      const displayParts = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === it.nomenclature_id), quantity_per_parent: 1 }]
                      return displayParts.map((part, pIdx) => {
                        const totalToProduce = (Number(it.quantity) || 0) * (Number(part.quantity_per_parent) || 1)
                        const unitsPerSheet = Number(part.nom?.units_per_sheet) || 1
                        const sheets = Math.ceil(totalToProduce / unitsPerSheet)
                        const capacityValue = Number(currentMachine?.sheet_capacity) || 1
                        const loads = Math.ceil(sheets / capacityValue)
                        const surplus = (sheets * unitsPerSheet) - totalToProduce

                        return (
                          <tr key={`${it.id}-${pIdx}`} style={{ borderBottom: '1px solid #1a1a1a', background: pIdx % 2 === 0 ? 'transparent' : 'rgba(255,144,0,0.02)' }} className="print-tr">
                            <td style={{ padding: '18px 15px' }}>
                              <div style={{ fontWeight: 1000, color: '#fff', fontSize: '0.95rem', marginBottom: '4px' }} className="print-txt">{part.nom?.name || '—'}</div>
                              <div style={{ fontSize: '0.7rem', color: '#444', fontWeight: 800 }} className="print-subtxt">{part.nom?.nomenclature_code || 'БЕЗ КОДУ'}</div>
                            </td>
                            <td style={{ padding: '18px 15px', textAlign: 'center', fontWeight: 800, fontSize: '1rem' }} className="print-txt">{(totalToProduce || 0).toString()}</td>
                            <td style={{ padding: '18px 15px', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.85rem', color: '#aaa', fontWeight: 700 }} className="print-subtxt">{part.nom?.material_type || '—'}</div>
                            </td>
                            <td style={{ padding: '18px 15px', textAlign: 'center', color: '#555' }} className="print-subtxt">{(unitsPerSheet || 0).toString()}</td>
                            <td style={{ padding: '18px 15px', textAlign: 'center', fontWeight: 1000, color: '#22c55e', fontSize: '1.2rem' }} className="print-accent-g">{(sheets || 0).toString()}</td>
                            <td style={{ padding: '18px 15px', textAlign: 'center', fontWeight: 900, color: '#ff9000' }} className="print-accent-o">{surplus > 0 ? `+${surplus}` : '0'}</td>
                          </tr>
                        )
                      })
                    })}
                  </tbody>
                  <tfoot style={{ background: 'rgba(255,144,0,0.05)', borderTop: '2px solid #ff9000' }} className="print-tf">
                    <tr>
                      <td style={{ padding: '20px 15px', fontWeight: 1000, fontSize: '1rem', textTransform: 'uppercase' }} className="print-txt">ЗАГАЛЬНИЙ ПІДСУМОК:</td>
                      <td style={{ padding: '20px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.1rem' }} className="print-txt">
                        {(activeNaryadOrder.order_items?.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0) || 0).toString()}
                      </td>
                      <td></td>
                      <td></td>
                      <td style={{ padding: '20px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.4rem', color: '#22c55e' }} className="print-accent-g">
                        {(activeNaryadOrder.order_items?.reduce((acc, it) => {
                          const parts = getBOMParts(it.nomenclature_id)
                          const displayParts = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === it.nomenclature_id), quantity_per_parent: 1 }]
                          const sh = displayParts.reduce((pa, p) => pa + Math.ceil(((Number(it.quantity) || 0) * (Number(p.quantity_per_parent) || 1)) / (Number(p.nom?.units_per_sheet) || 1)), 0)
                          return acc + sh
                        }, 0) || 0).toString()}
                      </td>
                      <td></td>
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
                        <div style={{ fontSize: '1.1rem', fontWeight: 950, color: '#fff' }} className="print-txt">{(Number(m.sheets) || 0).toString()} <small style={{ fontSize: '0.65rem', fontWeight: 400, color: '#444' }} className="print-subtxt">ЛИСТІВ</small></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="no-print" style={{ padding: '30px 40px', background: '#111', borderTop: '1px solid #222', display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
              <button onClick={() => setActiveNaryadOrder(null)} style={{ background: '#222', color: '#fff', border: 'none', padding: '12px 30px', borderRadius: '12px', fontWeight: 800, cursor: 'pointer' }}>СКАСУВАТИ</button>
              <button
                onClick={handlePrint}
                style={{
                  background: '#ff9000',
                  color: '#000',
                  border: 'none',
                  padding: '12px 45px',
                  borderRadius: '12px',
                  fontWeight: 950,
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  transition: '0.2s',
                  opacity: 1
                }}
              >
                {isReprintMode ? 'ПОВТОРНИЙ ДРУК' : 'ДРУКУВАТИ ТА В РОБОТУ'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4; margin: 10mm; }
          
          /* Hide EVERYTHING first */
          * { visibility: hidden !important; background: transparent !important; color: #000 !important; }
          
          /* Only show the target and its children */
          .print-target, .print-target * { visibility: visible !important; }
          
          /* Force White Background and Static Positioning */
          html, body { background: #fff !important; }
          .print-target { 
            position: absolute !important; 
            inset: 0 !important; 
            background: #fff !important; 
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            z-index: 99999 !important;
            width: 100% !important;
            height: auto !important;
          }
          
          .worksheet-panel {
            background: #fff !important;
            color: #000 !important;
            width: 100% !important;
            max-width: none !important;
            height: auto !important;
            position: relative !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }
          
          .worksheet-header-area { 
            background: #fff !important; 
            border-bottom: 2px solid #000 !important; 
            padding: 20px 0 !important;
          }
          
          .print-info-box { 
            background: #f9f9f9 !important; 
            border: 1px solid #ddd !important; 
            padding: 15px !important;
            border-radius: 10px !important;
          }
          
          .worksheet-scrollable { padding: 20px 0 !important; overflow: visible !important; }
          
          .print-table { border-collapse: collapse !important; width: 100% !important; }
          .print-thr { background: #eee !important; border-bottom: 2px solid #000 !important; }
          .print-tr { border-bottom: 1px solid #ddd !important; }
          .print-tf { border-top: 2px solid #000 !important; background: #f9f9f9 !important; }
          
          .print-txt { color: #000 !important; font-weight: bold !important; }
          .print-subtxt { color: #555 !important; }
          .print-accent-g { color: #065f46 !important; font-weight: bold !important; }
          .print-accent-b { color: #1e40af !important; font-weight: bold !important; }
          .print-accent-o { color: #92400e !important; font-weight: bold !important; }
          
          .mat-summary-section { 
            background: #fff !important; 
            border: 1px solid #ddd !important; 
            margin-top: 30px !important;
            padding: 20px !important;
          }
          .mat-card-p { border-left: 4px solid #000 !important; }
          
          .no-print { display: none !important; }
        }
      `}} />
    </div>
  )
}

export default MasterModule
