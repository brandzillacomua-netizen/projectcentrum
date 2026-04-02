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
          total: displayTotal,
          created: startOffset,
          metadata: createdCards.map(c => ({
            id: c.id,
            loading: c.card_info,
            qty: qtyPerLoading,
            estimatedTime: (Number(part.nom?.time_per_unit) || 0) * qtyPerLoading,
            totalLoadings: displayTotal,
            sheetsPerLoading: capacity,
            machine: selectedMachineName
          }))
        })
      } else {
        alert('Помилка: Не вдалося отримати ID створених карток.')
      }
    } catch (err) {
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
    setBufferScrapCounts({ [card.nomenclature_id]: 0 })
  }

  const submitBufferReception = async () => {
    if (!bufferScrapModal) return
    try {
      await apiService.submitBufferConfirmation(bufferScrapModal.cardId, bufferScrapCounts, confirmBuffer)
      setBufferScrapModal(null)
      setIsBufferScanning(false)
    } catch (err) {
      alert("Помилка: " + err.message)
    }
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

          {activeTaskId ? (
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
                                  <div style={{ display: 'flex', gap: '5px' }}>
                                    {(existing.length === 0 || existing.length < loads) && (
                                      <button
                                        onClick={() => {
                                          if (!rowMachineName) return;
                                          setGenModal({ task, part, total: loads, created: existing.length, rowId, machineName: rowMachineName, sheets })
                                        }}
                                        disabled={!rowMachineName}
                                        style={{
                                          flex: 1,
                                          background: existing.length === 0 ? (rowMachineName ? '#333' : '#111') : '#3b82f6',
                                          color: rowMachineName ? '#fff' : '#333',
                                          border: 'none',
                                          padding: '8px 10px',
                                          borderRadius: '10px',
                                          cursor: rowMachineName ? 'pointer' : 'not-allowed',
                                          fontWeight: 900,
                                          fontSize: '0.6rem',
                                          textTransform: 'uppercase',
                                          opacity: rowMachineName ? 1 : 0.5
                                        }}
                                      >
                                        ГЕНЕРУВАТИ
                                      </button>
                                    )}
                                    {existing.length > 0 && (
                                      <button
                                        onClick={() => {
                                          setPrintQueue({
                                            task,
                                            part,
                                            metadata: existing.map(c => ({
                                              id: c.id,
                                              loading: c.card_info,
                                              qty: c.quantity || (loads > 0 ? Math.floor(total / loads) : '—'),
                                              machine: c.machine,
                                              totalLoadings: loads,
                                              sheetsPerLoading: machines.find(m => m.name === c.machine)?.sheet_capacity || 1,
                                              estimatedTime: (Number(part.nom?.time_per_unit) || 0) * (Number(c.quantity) || 0)
                                            }))
                                          })
                                        }}
                                        style={{
                                          width: (existing.length < loads) ? '40px' : '100%',
                                          background: (existing.length < loads) ? '#222' : '#10b981',
                                          color: '#fff', border: 'none', padding: '8px', borderRadius: '10px', cursor: 'pointer', fontWeight: 900, fontSize: '0.65rem'
                                        }}
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

                  <h3 style={{ fontSize: '0.75rem', color: '#444', textTransform: 'uppercase', marginBottom: '20px' }}>Архів робочих карток</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                    {taskCards.map(card => {
                      const nom = nomenclatures.find(n => n.id === card.nomenclature_id)
                      const loadingText = card.card_info
                      return (
                        <div key={card.id} style={{ background: '#111', padding: '15px', borderRadius: '18px', display: 'flex', gap: '15px', alignItems: 'center', border: '1px solid #222' }}>
                          <div style={{ background: '#fff', padding: '6px', borderRadius: '8px' }}><QRCodeSVG value={`CENTRUM_CARD_${card.id}`} size={50} /></div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>{nom?.name || 'Деталь'}</div>
                            <div style={{ fontSize: '0.65rem', color: '#555', marginTop: '4px' }}>Завантаження: {loadingText}</div>
                          </div>
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
          <div style={{ background: '#111', width: '100%', maxWidth: '450px', borderRadius: '32px', border: '1px solid #222', padding: '40px', position: 'relative' }}>
            <button onClick={() => setGenModal(null)} style={{ position: 'absolute', top: '25px', right: '25px', background: 'none', border: 'none', color: '#444', cursor: 'pointer' }}><X size={24} /></button>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 950, margin: 0, textAlign: 'center' }}>{genModal.part.nom?.name}</h2>
            <div style={{ color: '#ef4444', fontSize: '1.2rem', fontWeight: 900, textAlign: 'center', marginTop: '10px' }}>{genModal.created} / {genModal.total} КАРТ</div>
            <div style={{ margin: '30px 0' }}>
              <input
                type="number" id="gen_count_input" defaultValue={genModal.total - genModal.created} min="1" max={genModal.total - genModal.created}
                style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', fontSize: '2rem', fontWeight: 950, textAlign: 'center', padding: '15px', borderRadius: '15px' }}
              />
            </div>
            <button onClick={() => {
              const v = parseInt(document.getElementById('gen_count_input').value);
              if (v > 0) handleGenerateFromWorksheet(genModal.task, genModal.part, genModal.sheets, genModal.machineName, v, genModal.created, genModal.total);
            }} style={{ width: '100%', background: '#ef4444', color: '#fff', padding: '20px', borderRadius: '20px', fontWeight: 950, cursor: 'pointer', border: 'none' }}>ГЕНЕРУВАТИ ТА ДРУКУВАТИ</button>
          </div>
        </div>
      )}

      {isGenerating && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 20000, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '20px' }}>
          <Loader2 size={60} color="#ef4444" className="animate-spin" />
          <h2 style={{ fontWeight: 900, textTransform: 'uppercase' }}>Генерація карток...</h2>
        </div>
      )}

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
            const finishedProduct = order?.order_items?.[0] ? nomenclatures.find(n => n.id === order.order_items[0].nomenclature_id) : null;

            const formatTime = (seconds) => {
              const h = Math.floor(seconds / 3600);
              const m = Math.floor((seconds % 3600) / 60);
              const s = Math.floor(seconds % 60);
              return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
            };

            return (
              <div key={i} className="a4-page" style={{ width: '210mm', height: '297mm', background: '#fff', padding: '10mm', margin: '0 auto 40px auto', pageBreakAfter: 'always', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', boxSizing: 'border-box' }}>
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', border: '1.5px solid #000' }}>
                  {/* UPPER TRACKING BLOCKS (Rows 1-8) - Repeated twice */}
                  {[1, 2].map(blockIdx => (
                    <div key={blockIdx} style={{ borderBottom: '1.5px solid #000', marginBottom: blockIdx === 1 ? '20px' : '0' }}>
                      {/* Sub-Header Part 1: Metadata Row 1 & 2 */}
                      <div style={{ borderTop: blockIdx === 2 ? '1.5px solid #000' : 'none' }}>
                        <div style={{ display: 'flex', height: '18px', borderBottom: '1px solid #000', textAlign: 'center', background: '#fff' }}>
                          <div style={{ width: '25%', borderRight: '1px solid #000', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Замовник</div>
                          <div style={{ width: '25%', borderRight: '1px solid #000', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Номер замовлення</div>
                          <div style={{ width: '35%', borderRight: '1px solid #000', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Планова дата відвантаження</div>
                          <div style={{ width: '15%', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Дата</div>
                        </div>
                        <div style={{ display: 'flex', height: '24px', borderBottom: '1.5px solid #000', textAlign: 'center', alignItems: 'center' }}>
                          <div style={{ width: '25%', borderRight: '1px solid #000', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10pt', fontWeight: 950 }}>
                             {order?.customer || '—'}
                          </div>
                          <div style={{ width: '25%', borderRight: '1px solid #000', fontSize: '11pt', fontWeight: 950 }}>{order?.order_num || '—'}</div>
                          <div style={{ width: '35%', borderRight: '1px solid #000', fontSize: '10pt', fontWeight: 950 }}>{order?.deadline ? new Date(order.deadline).toLocaleDateString('uk-UA') : '—'}</div>
                          <div style={{ width: '15%', fontSize: '11pt', fontWeight: 950 }}>{currentDate}</div>
                        </div>

                        {/* Sub-Header Part 2: Project Metadata Row 3 & 4 */}
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
                          <div style={{ width: '10%', borderRight: '1px solid #000', fontSize: '13pt', fontWeight: 1000 }}>{m.sheetsPerLoading}</div>
                          <div style={{ width: '12%', borderRight: '1px solid #000', fontSize: '8pt', fontWeight: 1000, lineHeight: 1.1 }}>{nomenclature?.material_type || '—'}</div>
                          <div style={{ width: '15%', borderRight: '1px solid #000', fontSize: '7.5pt', fontWeight: 1000, padding: '0 2px' }}>{m.machine}</div>
                          <div style={{ width: '15%', borderRight: '1px solid #000', fontSize: '11pt', fontWeight: 1000 }}>{m.loading}</div>
                          <div style={{ width: '18%', fontSize: '6pt', fontWeight: 900 }}></div>
                        </div>
                      </div>

                      {/* Sub-Header Part 3: Main Tracking (Rows 5-8) */}
                      <div style={{ display: 'flex', height: '125px' }}>
                        {/* Left & Middle Column Split */}
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
                                  <div style={{ width: '50%', borderRight: '1px solid #000', display: 'flex', flexDirection: 'column', padding: '1px 2px' }}>
                                     <span style={{ fontSize: '6pt', fontWeight: 900 }}>ПІБ працівника</span>
                                     <div style={{ flex: 1 }}></div>
                                  </div>
                                  <div style={{ width: '50%', display: 'flex', flexDirection: 'column', padding: '1px 2px' }}>
                                     <span style={{ fontSize: '6pt', fontWeight: 900 }}>ПІБ працівника</span>
                                     <div style={{ flex: 1 }}></div>
                                  </div>
                              </div>
                              <div style={{ display: 'flex', height: '49px' }}>
                                  <div style={{ width: '50%', borderRight: '1px solid #000', display: 'flex', flexDirection: 'column', padding: '1px 2px' }}>
                                     <span style={{ fontSize: '6pt', fontWeight: 950 }}>Дата початку / Час початку</span>
                                     <div style={{ flex: 1 }}></div>
                                  </div>
                                  <div style={{ width: '50%', display: 'flex', flexDirection: 'column', padding: '1px 2px' }}>
                                     <span style={{ fontSize: '6pt', fontWeight: 950 }}>Дата завершення / Час завершення</span>
                                     <div style={{ flex: 1 }}></div>
                                  </div>
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

                  {/* Operations Table */}
                  <div style={{ marginTop: '2px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '6.5pt' }}>
                      <thead>
                        <tr style={{ background: '#fff', textAlign: 'center', fontWeight: 'bold', height: '28px' }}>
                          <td style={{ border: '1.5px solid #000', width: '25%' }}>Операція (1 сторона)</td>
                          <td style={{ border: '1.5px solid #000', width: '8%', fontSize: '5.5pt', lineHeight: 1 }}>Статус<br/>виконання<br/>☑</td>
                          <td style={{ border: '1.5px solid #000', width: '25%' }}>Операція (2 сторона)</td>
                          <td style={{ border: '1.5px solid #000', width: '8%', fontSize: '5.5pt', lineHeight: 1 }}>Статус<br/>виконання<br/>☑</td>
                          <td style={{ border: '1.5px solid #000', width: '25%' }}>Операція (2 сторона вирізка)</td>
                          <td style={{ border: '1.5px solid #000', width: '9%', fontSize: '5.5pt', lineHeight: 1 }}>Статус<br/>виконання<br/>☑</td>
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

                  {/* Sheet-by-Sheet Tracking Rows */}
                  <div style={{ marginTop: '2px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '6.5pt' }}>
                      <tbody>
                        {[1, 2, 3, 4].map(num => (
                          <tr key={num} style={{ height: '28px' }}>
                            <td style={{ border: '1.5px solid #000', width: '130px', textAlign: 'center', fontWeight: 'bold', background: '#fff' }}>
                               {num} лист<br/>Перша деталь
                            </td>
                            <td style={{ border: '1.5px solid #000', width: '12%' }}></td>
                            <td style={{ border: '1.5px solid #000', width: '12%' }}></td>
                            <td style={{ border: '1.5px solid #000', width: '12%' }}></td>
                            <td style={{ border: '1.5px solid #000' }}></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Industrial Footer Section */}
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

      {isBufferScanning && (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 25000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={() => setIsBufferScanning(false)} style={{ position: 'absolute', top: 30, right: 30, background: '#333', color: '#fff', padding: '15px', borderRadius: '50%', border: 'none' }}><X size={32} /></button>
          <div id="buffer-reader" style={{ width: '100%', maxWidth: '500px', borderRadius: '20px', overflow: 'hidden' }}></div>
        </div>
      )}

      {bufferScrapModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 30000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#111', width: '400px', padding: '30px', borderRadius: '20px', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 20px' }}>ПРИЙОМКА НА БУФЕР</h3>
            <div style={{ marginBottom: '20px' }}>
              <label>Кількість браку:</label>
              <input type="number" style={{ width: '100%', background: '#000', color: '#fff', border: '1px solid #333', padding: '10px' }} value={bufferScrapCounts[bufferScrapModal.nomenclature_id] || 0} onChange={e => setBufferScrapCounts({ ...bufferScrapCounts, [bufferScrapModal.nomenclature_id]: parseInt(e.target.value) || 0 })} />
            </div>
            <button onClick={submitBufferReception} style={{ width: '100%', background: '#10b981', color: '#fff', padding: '15px', borderRadius: '10px', border: 'none' }}>ПІДТВЕРДИТИ</button>
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
      `}} />
    </div>
  )
}

export default ForemanWorkplace
