import React, { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Factory, ListTodo, Loader2, X, Printer, LayoutDashboard, Layers, User, Clock, Package, Scan, CheckCircle2, AlertTriangle, Camera, Tablet } from 'lucide-react'
import { useMES } from '../MESContext'
import { QRCodeSVG } from 'qrcode.react'
import { apiService } from '../services/apiDispatcher'

const ForemanWorkplace = () => {
  const { tasks, orders, workCards, createWorkCard, completeTaskByMaster, nomenclatures, bomItems, machines, workCardHistory, confirmBuffer, fetchData } = useMES()
  const [activeTaskId, setActiveTaskId] = useState(null)
  const [activeView, setActiveView] = useState('worksheet') // 'worksheet' | 'flow'
  const [selectedMachines, setSelectedMachines] = useState({}) // { [partId]: machineName }
  const [genModal, setGenModal] = useState(null) // { task, part, total, created, rowId, machineName }
  const [printQueue, setPrintQueue] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  
  const [isBufferScanning, setIsBufferScanning] = useState(false)
  const [bufferScrapModal, setBufferScrapModal] = useState(null) // { cardId, nomenclature_id }
  const [bufferScrapCounts, setBufferScrapCounts] = useState({})

  const getBOMParts = (nomenclatureId) => {
    return bomItems
      .filter(b => b.parent_id === nomenclatureId)
      .map(b => ({
        ...b,
        nom: nomenclatures.find(n => n.id === b.child_id)
      }))
  }

  const readyTasks = tasks.filter(t => t.warehouse_conf && t.engineer_conf && t.director_conf && t.status !== 'completed')

  const handleGenerateFromWorksheet = async (task, part, sheets, selectedMachineName, count, startOffset = 0, totalToReach = 0) => {
    const machineObj = machines.find(m => m.name === selectedMachineName)
    const capacity = Number(machineObj?.sheet_capacity) || 1
    
    // Calculate how many were total supposed to be, to show correct denominator (X / totalToReach)
    const displayTotal = Math.max(1, totalToReach || Math.ceil(sheets / capacity))
    const qtyPerLoading = Math.floor((Number(part.nom?.units_per_sheet) || 1) * (sheets / displayTotal))

    setIsGenerating(true)
    try {
      const cardsBatch = []
      // Generate only the requested 'count' of cards
      for (let i = 1; i <= count; i++) {
        const currentSeq = startOffset + i
        cardsBatch.push({
          operation: 'Лазерна різка',
          machine: selectedMachineName || 'Не вказано',
          estimatedTime: (Number(part.nom?.time_per_unit) || 0) * qtyPerLoading,
          cardInfo: `${currentSeq}/${displayTotal}`,
          quantity: qtyPerLoading
        })
      }
      
      const createdCards = await apiService.submitCreateWorkCardsBatch(task.id, task.order_id, part.nom.id, cardsBatch, createWorkCard)
      
      if (createdCards && createdCards.length > 0) {
        setPrintQueue({ 
          task, 
          part, 
          metadata: createdCards.map(c => ({ 
            id: c.id, 
            loading: c.card_info, 
            qty: qtyPerLoading 
          })) 
        })
      } else {
        alert('Помилка: Не вдалося отримати ID створених карток.')
      }
    } catch(err) {
      alert('Помилка: ' + err.message)
    } finally {
      setIsGenerating(false)
      setGenModal(null)
    }
  }

  const handleBufferReception = async (cardId) => {
    const card = workCards.find(c => c.id === Number(cardId))
    if (!card) {
      alert("Картку не знайдено!")
      return
    }
    setBufferScrapModal({ cardId: card.id, nomenclature_id: card.nomenclature_id })
    // Initialize scrap counts
    setBufferScrapCounts({ [card.nomenclature_id]: 0 })
  }

  const submitBufferReception = async () => {
    if (!bufferScrapModal) return
    try {
      await apiService.submitBufferConfirmation(bufferScrapModal.cardId, bufferScrapCounts, confirmBuffer)
      setBufferScrapModal(null)
      setIsBufferScanning(false)
    } catch(err) {
      alert("Помилка: " + err.message)
    }
  }

  // Effect for Buffer Scanner
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
    return () => { if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop().catch(() => {}) }
  }, [isBufferScanning])

  return (
    <div className="foreman-module" style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <header className="module-nav no-print">
        <Link to="/" className="back-link">
          <ArrowLeft size={18} /> <span className="hide-mobile">На головну</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Factory size={22} color="#ef4444" />
          <h1 style={{ margin: 0, textTransform: 'uppercase', fontSize: '1rem', fontWeight: 900 }}>ВИРОБНИЦТВО</h1>
        </div>
        <div style={{ fontWeight: 900, color: '#ef4444', fontSize: '0.75rem' }} className="hide-mobile">РЕЖИМ МАЙСТРА</div>
      </header>

      <div className="master-grid no-print">
        <div className="side-panel">
          <div style={{ padding: '20px', color: '#444', fontWeight: 800, fontSize: '0.65rem' }}>ЧЕРГА НАРЯДІВ</div>
          {readyTasks.map(task => {
            const order = orders.find(o => o.id === task.order_id)
            const isActive = activeTaskId === task.id
            return (
              <div key={task.id} onClick={() => setActiveTaskId(task.id)} style={{ padding: '15px', borderLeft: isActive ? '4px solid #ef4444' : '4px solid transparent', background: isActive ? '#1a1a1a' : 'transparent', cursor: 'pointer' }}>
                <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>№ {order?.order_num}</div>
                <div style={{ fontSize: '0.7rem', color: '#555' }}>{order?.customer}</div>
              </div>
            )
          })}
          {readyTasks.length === 0 && <div style={{ padding: '20px', color: '#333', fontSize: '0.8rem' }}>Немає активних нарядів</div>}
        </div>

        <div className="content-panel">
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

          {activeView === 'flow' ? (
             <div style={{ padding: '60px 20px', textAlign: 'center', background: '#111', borderRadius: '32px', border: '1px solid #222', marginTop: '20px' }} className="anim-fade-in">
                <Tablet size={80} color="#eab308" style={{ marginBottom: '25px', opacity: 0.8 }} />
                <h2 style={{ fontSize: '2rem', fontWeight: 950, margin: '0 0 15px', color: '#fff' }}>МОНІТОРИНГ ПОТОКУ ПЕРЕВЕДЕНО</h2>
                <p style={{ color: '#555', fontSize: '1.1rem', maxWidth: '500px', margin: '0 auto 40px', lineHeight: 1.5 }}>
                  Загальний потік (WIP) та ланцюжок виробництва тепер доступні безпосередньо у <b>Терміналі Цеху</b>. 
                  Це дозволяє майстру зручно сканувати карти та бачити стан цеху в одному місці.
                </p>
                <Link to="/operator-terminal" style={{ background: '#eab308', color: '#000', padding: '20px 50px', borderRadius: '18px', fontWeight: 950, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '15px', fontSize: '1.2rem', boxShadow: '0 10px 30px rgba(234, 179, 8, 0.2)' }}>
                  <Scan size={24} /> ПЕРЕЙТИ ДО ТЕРМІНАЛУ
                </Link>
             </div>
          ) : activeTaskId ? (
            (() => {
              const task = readyTasks.find(t => t.id === activeTaskId)
              const order = orders.find(o => o.id === task.order_id)
              const taskCards = workCards.filter(c => c.task_id === task.id)
              const productNames = order?.order_items?.map(it => nomenclatures.find(n => n.id === it.nomenclature_id)?.name).filter(Boolean).join(', ')
              
              return (
                <div style={{ maxWidth: '1200px' }} className="anim-fade-in">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
                     <div>
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                           <h2 style={{ fontSize: '2.4rem', fontWeight: 950, margin: 0 }}>Наряд №{order?.order_num}</h2>
                        </div>
                        <div style={{ color: '#555', marginTop: '5px', fontSize: '1.1rem', fontWeight: 800 }}>
                           ВИРІБ: <strong style={{ color: '#ef4444' }}>{productNames || '—'}</strong> | {order?.customer}
                        </div>
                     </div>
                     <button onClick={() => handleCloseNaryad(task.id)} className="btn-primary" style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '12px 25px', borderRadius: '12px', fontWeight: 900, cursor: 'pointer' }}>ЗАКРИТИ НАРЯД</button>
                  </div>

                  <div style={{ marginBottom: '40px', background: '#111', borderRadius: '20px', overflow: 'hidden', border: '1px solid #222' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                      <thead>
                        <tr style={{ background: '#1a1a1a', textAlign: 'left', color: '#555' }}>
                          <th style={{ padding: '12px 15px', width: '22%' }}>ДЕТАЛЬ В ПОРІЗКУ</th>
                          <th style={{ padding: '12px 15px', textAlign: 'center', width: '8%' }}>ПЛАН</th>
                          <th style={{ padding: '12px 15px', textAlign: 'center', width: '15%' }}>МАТЕРІАЛ</th>
                          <th style={{ padding: '12px 15px', textAlign: 'center', width: '6%' }}>ШТ/Л</th>
                          <th style={{ padding: '12px 15px', textAlign: 'center', color: '#10b981', width: '6%' }}>ЛИСТІВ</th>
                          <th style={{ padding: '12px 15px', width: '15%' }}>ВЕРСТАТ</th>
                          <th style={{ padding: '12px 15px', textAlign: 'center', color: '#3b82f6', width: '8%' }}>ЗАВАНТ.</th>
                          <th style={{ padding: '12px 15px', textAlign: 'center', color: '#ef4444', width: '8%' }}>БЗ</th>
                          <th style={{ padding: '12px 15px', textAlign: 'center', width: '12%' }}>ДІЇ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order?.order_items?.flatMap(item => {
                          const parts = getBOMParts(item.nomenclature_id)
                          const rows = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === item.nomenclature_id), quantity_per_parent: 1 }]
                          return rows.map((part, idx) => {
                            const rowId = `${item.id}-${part.nom?.id || idx}`
                            const total = (Number(item.quantity) || 0) * (Number(part.quantity_per_parent) || 1)
                            const unitsPerSheet = Number(part.nom?.units_per_sheet) || 1
                            const sheets = Math.ceil(total / unitsPerSheet)
                            
                            const existing = taskCards.filter(c => c.nomenclature_id === part.nom?.id || c.card_info?.includes(`NOM_ID:${part.nom?.id}`))
                            const hasCards = existing.length > 0

                            // Get row-specific machine selection with fallback to DB
                            const rowMachineName = selectedMachines[rowId] || (hasCards ? existing[0].machine : '')
                            const rowMachineObj = machines.find(m => m.name === rowMachineName)
                            const currentCapacity = Number(rowMachineObj?.sheet_capacity) || 0
                            
                            const loads = currentCapacity > 0 ? Math.ceil(sheets / currentCapacity) : 0
                            const surplus = (sheets * unitsPerSheet) - total
                            
                            return (
                              <tr key={rowId} style={{ borderBottom: '1px solid #1a1a1a' }}>
                                <td style={{ padding: '15px' }}>
                                  <div style={{ fontWeight: 800, color: '#fff' }}>{part.nom?.name || '—'}</div>
                                  <div style={{ fontSize: '0.7rem', color: '#444' }}>{part.nom?.nomenclature_code || 'БЕЗ КОДУ'}</div>
                                </td>
                                <td style={{ padding: '15px', textAlign: 'center', fontWeight: 800 }}>{(total || 0).toString()}</td>
                                <td style={{ padding: '15px', textAlign: 'center', color: '#aaa', fontSize: '0.8rem' }}>{part.nom?.material_type || '—'}</td>
                                <td style={{ padding: '15px', textAlign: 'center', color: '#444' }}>{(unitsPerSheet || 1).toString()}</td>
                                <td style={{ padding: '15px', textAlign: 'center', color: '#10b981', fontWeight: 1000, fontSize: '1.2rem' }}>{(sheets || 0).toString()}</td>
                                <td style={{ padding: '15px' }}>
                                   <select 
                                     value={rowMachineName} 
                                     disabled={hasCards}
                                     onChange={(e) => setSelectedMachines(p => ({ ...p, [rowId]: e.target.value }))}
                                     style={{ width: '100%', background: '#000', border: rowMachineName ? '1px solid #333' : '1px solid #ef4444', color: rowMachineName ? '#fff' : '#ef4444', padding: '8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700 }}
                                   >
                                      <option value="">Оберіть верстат</option>
                                      {machines.map(m => <option key={m.id} value={m.name}>{m.name} ({m.sheet_capacity} л.)</option>)}
                                   </select>
                                </td>
                                <td style={{ padding: '15px', textAlign: 'center', color: '#3b82f6', fontWeight: 1000, fontSize: '1.2rem' }}>
                                   {rowMachineName ? (
                                      <>
                                         <span style={{ color: existing.length < loads ? '#444' : '#3b82f6' }}>{existing.length}</span>
                                         <span style={{ color: '#222', margin: '0 5px' }}>/</span>
                                         <span>{loads}</span>
                                      </>
                                   ) : (
                                      <span style={{ color: '#222', fontSize: '0.8rem' }}>—</span>
                                   )}
                                </td>
                                <td style={{ padding: '15px', textAlign: 'center', color: '#ef4444', fontWeight: 900 }}>{surplus > 0 ? `+${surplus}` : '0'}</td>
                                <td style={{ padding: '15px', textAlign: 'center' }}>
                                  <button 
                                    onClick={() => {
                                      if (!rowMachineName && !hasCards) return;
                                      if (existing.length < loads) {
                                        setGenModal({ task, part, total: loads, created: existing.length, rowId, machineName: rowMachineName, sheets })
                                      } else {
                                        setPrintQueue({ 
                                          task, 
                                          part, 
                                          metadata: existing.map(c => ({ 
                                            id: c.id, 
                                            loading: c.card_info, 
                                            qty: c.quantity || (loads > 0 ? Math.floor(total/loads) : '—'),
                                            machine: c.machine
                                          })) 
                                        })
                                      }
                                    }} 
                                    disabled={!rowMachineName && !hasCards}
                                    style={{ 
                                      background: existing.length === 0 ? (rowMachineName ? '#333' : '#111') : (existing.length < loads ? '#3b82f6' : '#10b981'), 
                                      color: rowMachineName || hasCards ? '#fff' : '#333', 
                                      border: 'none', 
                                      padding: '8px 15px', 
                                      borderRadius: '10px', 
                                      cursor: rowMachineName || hasCards ? 'pointer' : 'not-allowed', 
                                      fontWeight: 900, 
                                      fontSize: '0.65rem', 
                                      textTransform: 'uppercase',
                                      width: '100%',
                                      transition: '0.2s',
                                      opacity: rowMachineName || hasCards ? 1 : 0.5
                                    }}
                                  >
                                    {existing.length === 0 ? 'ГЕНЕРУВАТИ' : (existing.length < loads ? 'ДОВИДРУКУВАТИ' : 'ДРУК')}
                                  </button>
                                </td>
                              </tr>
                            )
                          })
                        })}
                      </tbody>
                      <tfoot style={{ background: 'rgba(239,68,68,0.05)', borderTop: '2.5px solid #ef4444' }}>
                        <tr>
                           <td style={{ padding: '20px 15px', fontWeight: 1000, textTransform: 'uppercase' }}>ЗАГАЛЬНИЙ ПІДСУМОК:</td>
                           <td style={{ padding: '20px 15px', textAlign: 'center', fontWeight: 1000 }}>
                              {(order?.order_items?.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0) || 0).toString()}
                           </td>
                           <td></td>
                           <td></td>
                           <td style={{ padding: '20px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.3rem', color: '#10b981' }}>
                              {(order?.order_items?.reduce((acc, it) => {
                                 const parts = getBOMParts(it.nomenclature_id)
                                 const items = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === it.nomenclature_id), quantity_per_parent: 1 }]
                                 return acc + items.reduce((pa, p) => pa + Math.ceil(((Number(it.quantity) || 0) * (Number(p.quantity_per_parent) || 1)) / (Number(p.nom?.units_per_sheet) || 1)), 0)
                              }, 0) || 0).toString()}
                           </td>
                           <td></td>
                           <td style={{ padding: '20px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.2rem', color: '#3b82f6' }}>
                              <span style={{ color: '#222', fontSize: '0.8rem' }}>факт:</span> 
                              {taskCards.length} 
                              <span style={{ color: '#222', margin: '0 8px' }}>/</span> 
                              <span style={{ color: '#333', fontSize: '0.8rem' }}>план:</span>
                              {(order?.order_items?.reduce((acc, it) => {
                                 const parts = getBOMParts(it.nomenclature_id)
                                 const items = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === it.nomenclature_id), quantity_per_parent: 1 }]
                                 return acc + items.reduce((pa, p, idx) => {
                                    const rowId = `${it.id}-${p.nom?.id || idx}`
                                    const sh = Math.ceil(((Number(it.quantity) || 0) * (Number(p.quantity_per_parent) || 1)) / (Number(p.nom?.units_per_sheet) || 1))
                                    const selMachineName = selectedMachines[rowId] || ''
                                    if (!selMachineName) return pa; 
                                    const mObj = machines.find(m => m.name === selMachineName)
                                    const cap = Number(mObj?.sheet_capacity) || 1
                                    return pa + Math.ceil(sh / cap)
                                 }, 0)
                              }, 0) || 0).toString()}
                           </td>
                           <td></td>
                           <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <h3 style={{ fontSize: '0.75rem', color: '#444', textTransform: 'uppercase', marginBottom: '20px' }}>Архів робочих карток</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                    {taskCards.map(card => {
                       const nom = nomenclatures.find(n => n.id === card.nomenclature_id || card.card_info?.includes(`NOM_ID:${n.id}`))
                       const loadingText = card.card_info?.split('|')?.pop()?.trim() || card.card_info
                       return (
                        <div key={card.id} style={{ background: '#111', padding: '15px', borderRadius: '18px', display: 'flex', gap: '15px', alignItems: 'center', border: '1px solid #222' }}>
                           <div style={{ background: '#fff', padding: '6px', borderRadius: '8px' }}><QRCodeSVG value={`CENTRUM_CARD_${card.id}`} size={50} /></div>
                           <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>{nom?.name || 'Деталь'}</div>
                              <div style={{ fontSize: '0.65rem', color: '#555', marginTop: '4px' }}>Завантаження: {loadingText}</div>
                           </div>
                           <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: card.status === 'completed' ? '#10b981' : '#ef4444' }}></div>
                        </div>
                       )
                    })}
                  </div>
                </div>
              )
            })()
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', opacity: 0.1 }}><ListTodo size={120} /><h3>Оберіть наряд зі списку зліва</h3></div>
          )}
        </div>
      </div>

      {genModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 15000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
           <div style={{ background: '#111', width: '100%', maxWidth: '450px', borderRadius: '32px', border: '1px solid #222', padding: '40px', position: 'relative', boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }}>
              <button onClick={() => setGenModal(null)} style={{ position: 'absolute', top: '25px', right: '25px', background: 'none', border: 'none', color: '#444', cursor: 'pointer' }}><X size={24} /></button>
              
              <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                 <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '10px' }}>Генерація карток</div>
                 <h2 style={{ fontSize: '1.8rem', fontWeight: 950, margin: 0 }}>{genModal.part.nom?.name}</h2>
                 <div style={{ color: '#ef4444', fontSize: '1.2rem', fontWeight: 900, marginTop: '5px' }}>
                    {genModal.created} / {genModal.total} <small style={{ fontSize: '0.7rem', color: '#444' }}>ЗАВАНТАЖЕНЬ</small>
                 </div>
              </div>

              <div style={{ background: '#000', padding: '30px', borderRadius: '24px', border: '1px solid #1a1a1a', marginBottom: '30px' }}>
                 <label style={{ display: 'block', color: '#555', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '15px', textAlign: 'center' }}>Скільки карт берем в роботу?</label>
                 <input 
                   type="number" 
                   id="gen_count_input"
                   defaultValue={genModal.total - genModal.created}
                   min="1"
                   max={genModal.total - genModal.created}
                   style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '2px solid #ef4444', color: '#fff', fontSize: '3rem', fontWeight: 950, textAlign: 'center', outline: 'none', padding: '10px 0' }}
                   onKeyDown={(e) => { if (e.key === 'Enter') { 
                     const val = parseInt(document.getElementById('gen_count_input').value);
                     if (val > 0) handleGenerateFromWorksheet(genModal.task, genModal.part, genModal.sheets, genModal.machineName, val, genModal.created, genModal.total);
                   }}}
                 />
                 <div style={{ color: '#333', fontSize: '0.65rem', textAlign: 'center', marginTop: '15px' }}>Максимум доступно: {genModal.total - genModal.created}</div>
              </div>

              <button 
                onClick={() => {
                   const val = parseInt(document.getElementById('gen_count_input').value);
                   if (val > 0) handleGenerateFromWorksheet(genModal.task, genModal.part, genModal.sheets, genModal.machineName, val, genModal.created, genModal.total);
                }}
                className="btn-primary" 
                style={{ width: '100%', background: '#ef4444', color: '#fff', border: 'none', padding: '20px', borderRadius: '20px', fontWeight: 950, fontSize: '1rem', cursor: 'pointer', transition: '0.3s' }}
              >
                ГЕНЕРУВАТИ ТА ДРУКУВАТИ
              </button>
           </div>
        </div>
      )}

      {isGenerating && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 20000, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '20px' }}>
           <Loader2 size={60} color="#ef4444" className="animate-spin" />
           <h2 style={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em' }}>Генерація карток...</h2>
        </div>
      )}

      {printQueue && (
        <div className="print-overlay" style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
           <div className="no-print" style={{ padding: '15px 30px', background: '#111', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222' }}>
             <h3>Друк: {printQueue.part.nom?.name}</h3>
             <div style={{ display: 'flex', gap: '15px' }}>
                <button onClick={() => setPrintQueue(null)} style={{ background: '#222', color: '#888', border: 'none', padding: '12px 25px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }}>СКАСУВАТИ</button>
                <button onClick={() => window.print()} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '12px 30px', borderRadius: '10px', cursor: 'pointer', fontWeight: 900 }}>ДРУК НА А4</button>
             </div>
           </div>
           <div className="print-scroll" style={{ flex: 1, overflowY: 'auto', background: '#1a1a1a', padding: '40px 20px' }}>
              <div className="printable-content" style={{ width: '210mm', margin: '0 auto' }}>
                 {printQueue.metadata.map((m, i) => (
                    <div key={i} className="a4-page" style={{ width: '210mm', height: '296mm', padding: '10mm', breakAfter: 'page', pageBreakAfter: 'always', backgroundColor: '#fff', color: '#000', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
                       <div style={{ border: '2px solid #000', padding: '15mm', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
                          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                             <h1 style={{ margin: '0 0 15px', fontSize: '42pt', fontWeight: 900, textTransform: 'uppercase' }}>РОБОЧА КАРТА</h1>
                             <div style={{ fontSize: '18pt', fontWeight: 700, color: '#333' }}>
                                 Верстат: {m.machine || 'Не вказано'} | Завантаження: {m.loading?.split('|')?.pop() || m.loading}
                             </div>
                          </div>
                          <div style={{ borderTop: '2px solid #000', margin: '20px 0' }}></div>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                             <div style={{ fontSize: '14pt', opacity: 0.4, textTransform: 'uppercase', marginBottom: '10px' }}>назва деталі:</div>
                             <div style={{ fontSize: '32pt', fontWeight: 900, marginBottom: '40px', textAlign: 'center', width: '100%' }}>{printQueue.part.nom?.name}</div>
                             <div style={{ background: '#f5f5f5', width: '100%', padding: '40px 20px', borderRadius: '15px', textAlign: 'center', margin: '20px 0' }}>
                                <div style={{ fontSize: '90pt', fontWeight: 900, lineHeight: 1 }}>{m.qty} <small style={{ fontSize: '30pt' }}>шт</small></div>
                             </div>
                          </div>
                          <div style={{ borderTop: '2px solid #000', margin: '20px 0' }}></div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: '20px' }}>
                             <QRCodeSVG value={`CENTRUM_CARD_${m.id}`} size={300} />
                             <div style={{ fontSize: '10pt', color: '#999', marginTop: '10px' }}>Унікальний ID: {m.id}</div>
                          </div>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      {isBufferScanning && (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 25000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <button onClick={() => setIsBufferScanning(false)} style={{ position: 'absolute', top: 30, right: 30, background: '#1a1a1a', border: 'none', color: '#fff', padding: '15px', borderRadius: '50%', cursor: 'pointer' }}><X size={32} /></button>
          <div style={{ width: '100%', maxWidth: '540px', position: 'relative' }}>
             <div id="buffer-reader" style={{ background: '#111', borderRadius: '32px', overflow: 'hidden' }}></div>
             <div style={{ position: 'absolute', inset: -5, border: '6px solid #ef4444', borderRadius: '36px', pointerEvents: 'none', animation: 'scan-glow 2s infinite' }}></div>
          </div>
          <div style={{ marginTop: '40px', color: '#ef4444', fontSize: '1rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em' }}>Скануйте карту для прийомки на буфер</div>
        </div>
      )}

      {bufferScrapModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.96)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30000, padding: '20px' }}>
          <div style={{ background: '#111', width: '100%', maxWidth: '500px', borderRadius: '32px', border: '1px solid #333', padding: '40px' }}>
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <AlertTriangle color="#ef4444" size={40} style={{ marginBottom: '15px' }} />
              <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900 }}>ПРИЙОМКА НА БУФЕР</h3>
              <p style={{ color: '#555', fontSize: '0.9rem' }}>Перевірте кількість та вкажіть брак (якщо є)</p>
            </div>
            
            <div style={{ background: '#000', padding: '25px', borderRadius: '20px', border: '1px solid #222', marginBottom: '25px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 800 }}>{nomenclatures.find(n => n.id === bufferScrapModal.nomenclature_id)?.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 900 }}>БРАК:</span>
                    <input 
                      type="number" 
                      min="0" 
                      style={{ width: '80px', background: '#111', border: '1px solid #333', color: '#fff', padding: '10px', borderRadius: '10px', textAlign: 'center', fontSize: '1.2rem', fontWeight: 900 }}
                      value={bufferScrapCounts[bufferScrapModal.nomenclature_id] || 0}
                      onChange={e => setBufferScrapCounts({ ...bufferScrapCounts, [bufferScrapModal.nomenclature_id]: parseInt(e.target.value) || 0 })}
                    />
                  </div>
               </div>
            </div>

            <button onClick={submitBufferReception} style={{ width: '100%', background: '#10b981', color: '#fff', border: 'none', padding: '20px', borderRadius: '18px', fontWeight: 900, fontSize: '1.1rem', cursor: 'pointer' }}>
               ПІДТВЕРДИТИ ПРИЙОМКУ
            </button>
            <button onClick={() => setBufferScrapModal(null)} style={{ width: '100%', background: 'transparent', border: 'none', color: '#555', marginTop: '15px', fontWeight: 800, cursor: 'pointer' }}>СКАСУВАТИ</button>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { 
            size: A4 portrait !important; 
            margin: 0 !important; 
          }
          html, body { 
            background: #fff !important; 
            color: #000 !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            width: 210mm !important;
            overflow: visible !important;
          }
          /* Hide everything except the print overlay */
          #root > *:not(.print-overlay),
          .foreman-main-ui, 
          .portal-header-v2, 
          .portal-container-v2,
          .foreman-module > *:not(.print-overlay) { 
             display: none !important; 
          }

          .print-overlay { 
            display: block !important;
            visibility: visible !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            z-index: 999999 !important;
          }
          .no-print { display: none !important; }
          .print-scroll { 
            display: block !important;
            overflow: visible !important; 
            height: auto !important; 
            padding: 0 !important; 
            background: #fff !important;
          }
          .printable-content { 
            display: block !important;
            width: 210mm !important; 
            margin: 0 !important;
            background: #fff !important;
          }
          .a4-page { 
            display: block !important; /* Force block for better page break parsing */
            position: relative !important;
            width: 210mm !important;
            height: 296.8mm !important; /* Slightly under 297 to avoid margin overflow */
            padding: 15mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            background: #fff !important;
            color: #000 !important;
            page-break-after: always !important;
            break-after: page !important;
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact;
            overflow: hidden !important;
          }
          
          /* Enforce internal layout during print */
          .a4-page > div {
             height: 100% !important;
             display: flex !important;
             flex-direction: column !important;
             box-sizing: border-box !important;
          }

          .a4-page * { 
            visibility: visible !important;
          }
        }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes scan-glow { 0% { box-shadow: 0 0 10px #ef4444; } 50% { box-shadow: 0 0 30px #ef4444; } 100% { box-shadow: 0 0 10px #ef4444; } }
      `}} />
    </div>
  )
}

export default ForemanWorkplace
