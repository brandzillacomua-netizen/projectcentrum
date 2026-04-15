import React, { useState, useEffect } from 'react'
import {
  Tablet, ArrowLeft, Play, CheckCircle, Scan, Timer, AlertTriangle,
  X, ClipboardList, Camera, Menu, Fingerprint, RefreshCw, Search,
  Box, Layers, FileCode, Gauge
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'

const OperatorTerminal = () => {
  const { workCards, orders, nomenclatures, startWorkCard, completeWorkCard, confirmBuffer, fetchData, operators, productionStages, machines, workCardHistory } = useMES()
  const [selectedCardId, setSelectedCardId] = useState(null)
  const [selectedStage, setSelectedStage] = useState('')
  const [selectedOperator, setSelectedOperator] = useState('')
  const [selectedMachine, setSelectedMachine] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [scanError, setScanError] = useState(null)

  const [scannedCardIds, setScannedCardIds] = useState(() => {
    try { const saved = localStorage.getItem('centrum_operator_scanned'); return saved ? JSON.parse(saved) : [] }
    catch (e) { return [] }
  })

  const [isScanning, setIsScanning] = useState(false)
  const [showScrapModal, setShowScrapModal] = useState(false)
  const [scrapCounts, setScrapCounts] = useState({})
  const [showPinModal, setShowPinModal] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState(false)
  const [detailStage, setDetailStage] = useState(null)
  const [detailTab, setDetailTab] = useState('work')
  const [filterStage, setFilterStage] = useState('all')

  useEffect(() => { localStorage.setItem('centrum_operator_scanned', JSON.stringify(scannedCardIds)) }, [scannedCardIds])
  useEffect(() => { const timer = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(timer) }, [])

  useEffect(() => {
    let html5QrCode = null
    if (isScanning && window.Html5Qrcode) {
      html5QrCode = new window.Html5Qrcode("reader")
      const config = { fps: 15, qrbox: { width: 260, height: 260 } }
      const stopAndClose = async () => {
        if (html5QrCode && html5QrCode.isScanning) await html5QrCode.stop().catch(() => {})
        setIsScanning(false)
      }
      html5QrCode.start({ facingMode: "environment" }, config, async (decodedText) => {
        if (decodedText.startsWith("CENTRUM_CARD_")) {
          const cardIdStr = decodedText.replace("CENTRUM_CARD_", "").trim()
          await stopAndClose()
          let foundCard = workCards.find(c => String(c.id).trim() === cardIdStr)
          if (!foundCard) {
            setIsSyncing(true)
            try { if (typeof fetchData === 'function') await fetchData() } catch (e) {}
            setIsSyncing(false)
            setScanError(`Картку №${cardIdStr} не знайдено. Спробуйте відсканувати ще раз.`)
          } else {
            setScannedCardIds(prev => prev.includes(foundCard.id) ? prev : [...prev, foundCard.id])
            setSelectedCardId(foundCard.id)
            setScanError(null)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }
        }
      }).catch(err => { setScanError("Помилка камери: " + err); setIsScanning(false) })
    }
    return () => { if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop().catch(() => {}) }
  }, [isScanning, workCards])

  const currentCard = workCards.find(c => c.id === selectedCardId)
  const getNomFromCard = (card) => {
    if (!card) return null
    if (card.nomenclature_id) return nomenclatures.find(n => n.id === card.nomenclature_id)
    const matchId = card.card_info?.match(/NOM_ID:([^|]+)/)
    const metaId = matchId ? matchId[1].trim() : null
    return nomenclatures.find(n => String(n.id) === String(metaId))
  }
  const getQtyFromCard = (card) => {
    if (!card) return 0
    if (card.quantity && card.quantity > 0) return card.quantity
    const matchQty = card.card_info?.match(/QTY:([^|]+)/)
    return matchQty ? matchQty[1].trim() : 0
  }
  const getSheetsFromCard = (card) => {
    if (!card?.card_info) return null
    const match = card.card_info.match(/(\d+\/\d+)/)
    return match ? match[1] : null
  }
  const formatElapsedTime = (startIso) => {
    if (!startIso) return '00:00:00'
    const start = new Date(startIso)
    const diff = Math.floor((currentTime - start) / 1000)
    if (isNaN(diff) || diff < 0) return '00:00:00'
    const h = Math.floor(diff / 3600).toString().padStart(2, '0')
    const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0')
    const s = (diff % 60).toString().padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  // Helper: bidirectional stage matching
  const matchesStage = (cardOp, stageName) => {
    const op = (cardOp || '').toLowerCase()
    const sk = (stageName || '').toLowerCase()
    return op === sk || op.includes(sk) || sk.includes(op)
  }

  const queuedCards = workCards.filter(c =>
    (c.status === 'new' || scannedCardIds.includes(c.id)) &&
    c.status !== 'in-progress' && c.status !== 'waiting-buffer' && c.status !== 'completed' && c.status !== 'at-buffer'
  )

  const handleStartOperation = async () => {
    if (!currentCard || !selectedStage || !selectedOperator) return
    setIsProcessing(true)
    try {
      const selectedMachineObj = machines.find(m => m.id === selectedMachine || m.name === selectedMachine)
      console.log("--- STARTING WORK ---", {
        taskId: currentCard.task_id,
        cardId: currentCard.id,
        operator: selectedOperator,
        machineId: selectedMachineObj?.id,
        machineName: selectedMachineObj?.name
      })
      
      await apiService.submitOperatorAction('start', currentCard.task_id, currentCard.id, selectedOperator, { 
        stage_name: selectedStage, 
        machine_name: selectedMachineObj?.name || selectedMachine,
        machine_id: selectedMachineObj?.id || null
      }, startWorkCard)
      if (!scannedCardIds.includes(currentCard.id)) setScannedCardIds(prev => [...prev, currentCard.id])
    } catch (e) { alert('Помилка при старті: ' + e.message) }
    finally { setIsProcessing(false) }
  }

  const validatePin = async () => {
    if (pin === '555') {
      setIsProcessing(true)
      try {
        const selectedMachineObj = machines.find(m => m.id === selectedMachine || m.name === selectedMachine)
        await apiService.submitOperatorAction('start', currentCard.task_id, currentCard.id, 'Оператор Тест (555)', {
          machine_id: selectedMachineObj?.id || null
        }, startWorkCard)
        setShowPinModal(false)
      } finally { setIsProcessing(false) }
    } else { setPinError(true); setPin(''); setTimeout(() => setPinError(false), 1000) }
  }

  const submitCompletion = async () => {
    if (!currentCard) return
    const nom = getNomFromCard(currentCard)
    setScrapCounts({ [nom?.id]: 0 })
    setShowScrapModal(true)
  }

  const handleFinalFinish = async () => {
    if (!currentCard) return
    setIsProcessing(true)
    try {
      await apiService.submitBufferConfirmation(currentCard.id, scrapCounts, confirmBuffer)
      setSelectedCardId(null)
      setShowScrapModal(false)
      setScannedCardIds(prev => prev.filter(id => id !== currentCard.id))
    } catch (e) { alert('Помилка при оприбуткуванні: ' + e.message) }
    finally { setIsProcessing(false) }
  }

  const SpecCard = ({ icon: Icon, label, value, color = "#eab308" }) => (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1a1a1a', padding: '18px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '130px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#555', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>
        <Icon size={14} /> {label}
      </div>
      <div style={{ fontSize: '1.2rem', fontWeight: 900, color }}>{value}</div>
    </div>
  )

  const renderQueue = () => (
    <div className="tasks-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 15px 25px' }}>
      {queuedCards.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 10px', color: '#444', fontSize: '0.8rem' }}>Поки що немає прийнятих карт. Відскануйте першу...</div>
      )}
      {queuedCards.map(card => {
        const nom = getNomFromCard(card)
        const isActive = selectedCardId === card.id
        const batchQty = getQtyFromCard(card)
        return (
          <div key={card.id} onClick={() => { setSelectedCardId(card.id); setIsDrawerOpen(false) }} style={{ background: isActive ? '#eab308' : '#1a1a1a', borderRadius: '12px', padding: '15px', marginBottom: '10px', cursor: 'pointer', border: '1px solid', borderColor: isActive ? '#eab308' : '#333', transition: '0.2s', color: isActive ? '#000' : '#fff' }}>
            <div style={{ marginBottom: '4px' }}>
              <strong style={{ display: 'block', fontSize: '0.9rem', fontWeight: 800 }}>{nom?.name || 'Без назви'}</strong>
              <div style={{ fontSize: '0.65rem', opacity: 0.7 }}>
                №{orders?.find(o => o.id === card.order_id)?.order_num || '—'} | {(() => {
                  const bz = Number(card.buffer_qty) || Number(card.card_info?.match(/\[BZ:(\d+)\]/)?.[1]) || 0
                  const need = Number(card.card_info?.match(/\[NEED:(\d+)\]/)?.[1]) || (Number(card.quantity) - bz)
                  if (bz > 0) return `${card.quantity} шт (${need}+${bz} БЗ)`
                  return `${card.quantity} шт`
                })()} | {card.operation} {getSheetsFromCard(card) ? `| Лист ${getSheetsFromCard(card)}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <span style={{ fontSize: '0.6rem', background: isActive ? 'rgba(0,0,0,0.2)' : 'rgba(234, 179, 8, 0.1)', color: isActive ? '#000' : '#eab308', padding: '2px 6px', borderRadius: '4px', fontWeight: 900, textTransform: 'uppercase' }}>{card.status === 'in-progress' ? 'У РОБОТІ' : 'ОЧІКУЄ'}</span>
              <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>{card.estimated_time || 0} хв</span>
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="operator-terminal-v2" style={{ background: '#0a0a0a', height: '100vh', display: 'flex', flexDirection: 'column', color: '#fff', overflow: 'hidden' }}>
      <header className="terminal-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', height: '70px', background: '#000', borderBottom: '2px solid #eab308', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Link to="/" style={{ color: '#94a3b8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.85rem' }}>
            <ArrowLeft size={18} /> <span className="hide-mobile">Вихід</span>
          </Link>
          <button onClick={() => setIsDrawerOpen(true)} className="burger-btn mobile-only"><Menu size={24} /></button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Tablet size={20} color="#eab308" />
          <h1 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }} className="hide-mobile">ТЕРМІНАЛ ЦЕХУ (МАЙСТЕР)</h1>
        </div>
        <div style={{ fontWeight: 900, fontFamily: 'monospace', fontSize: '1.2rem', color: '#eab308' }}>{currentTime.toLocaleTimeString()}</div>
      </header>

      <div className="main-layout-responsive" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div className="side-panel hide-mobile" style={{ width: '300px', background: '#121212', borderRight: '1px solid #222', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '20px', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800, color: '#555', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ClipboardList size={16} /> ЧЕРГА КАРТ ({queuedCards.length})
          </div>
          {renderQueue()}
        </div>

        {isDrawerOpen && <div className="drawer-backdrop" onClick={() => setIsDrawerOpen(false)} />}
        <div className={`side-drawer ${isDrawerOpen ? 'open' : ''}`}>
          <div className="drawer-header"><span style={{ fontSize: '0.8rem', fontWeight: 900 }}>ОБЕРІТЬ КАРТУ</span><button onClick={() => setIsDrawerOpen(false)} className="burger-btn"><X size={20} /></button></div>
          {renderQueue()}
        </div>

        <div className="content-panel" style={{ flex: 1, padding: '20px 15px', background: '#0a0a0a', overflowY: 'auto', position: 'relative' }}>
          {currentCard ? (
            <div style={{ maxWidth: '900px', margin: '0 auto' }} className="anim-fade-in">
              <div style={{ marginBottom: '35px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ background: currentCard.status === 'new' ? '#ef4444' : '#3b82f6', color: 'white', padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 900 }}>{currentCard.status === 'new' ? 'НОВА КАРТА' : 'РОБОЧА КАРТА'}</div>
                    <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 800 }}>
                      ЗАМОВЛЕННЯ №{orders?.find(o => o.id === currentCard.order_id)?.order_num || '—'} | КАРТКА #{currentCard.id.slice(0,8).toUpperCase()}... | {(() => {
                        const bz = Number(currentCard.buffer_qty) || Number(currentCard.card_info?.match(/\[BZ:(\d+)\]/)?.[1]) || 0
                        const need = Number(currentCard.card_info?.match(/\[NEED:(\d+)\]/)?.[1]) || (Number(currentCard.quantity) - bz)
                        if (bz > 0) return `${currentCard.quantity} ШТ (${need}+${bz} БЗ)`
                        return `${currentCard.quantity} ШТ`
                      })()}
                    </div>
                  </div>
                  <h2 style={{ fontSize: '2.5rem', margin: 0, fontWeight: 950, letterSpacing: '-0.02em', lineHeight: 1 }}>{getNomFromCard(currentCard)?.name || 'Деталь'}</h2>
                </div>
                <button onClick={() => setSelectedCardId(null)} style={{ background: '#111', border: 'none', color: '#555', padding: '10px', borderRadius: '12px', cursor: 'pointer' }}><X size={24} /></button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '30px' }}>
                <SpecCard icon={Layers} label="Матеріал" value={getNomFromCard(currentCard)?.material_type || '—'} color="#10b981" />
                <SpecCard icon={Box} label="Кількість" value={`${currentCard.quantity || getQtyFromCard(currentCard)} шт`} color="#3b82f6" />
                <SpecCard icon={Gauge} label="Обладнання" value={currentCard.machine || '—'} />
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '28px', border: '1px solid #1a1a1a', padding: '40px' }}>
                {currentCard.status === 'new' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', maxWidth: '500px', margin: '0 auto' }}>
                    <div>
                      <label style={{ color: '#555', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>Етап робіт</label>
                      <select value={selectedStage || currentCard.operation} onChange={(e) => setSelectedStage(e.target.value)} style={{ width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '15px', borderRadius: '15px', fontSize: '1.1rem', fontWeight: 700 }}>
                        <option value="">— Оберіть етап —</option>
                        {productionStages.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ color: '#555', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>Виберіть верстат</label>
                      <select value={selectedMachine} onChange={(e) => setSelectedMachine(e.target.value)} style={{ width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '15px', borderRadius: '15px', fontSize: '1.1rem', fontWeight: 700 }}>
                        <option value="">— Оберіть обладнання —</option>
                        {machines.map(m => <option key={m.id} value={m.id}>{m.name} {m.floor ? `(${m.floor} пов.)` : ''}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ color: '#555', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>Відповідальний оператор</label>
                      <select value={selectedOperator} onChange={(e) => setSelectedOperator(e.target.value)} style={{ width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '15px', borderRadius: '15px', fontSize: '1.1rem', fontWeight: 700 }}>
                        <option value="">— Оберіть оператора —</option>
                        {operators.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <button disabled={isProcessing || !selectedOperator} onClick={handleStartOperation} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '22px', borderRadius: '18px', fontSize: '1.4rem', fontWeight: 900, cursor: 'pointer' }}>ВЗЯТИ В РОБОТУ</button>
                    <button onClick={() => setShowPinModal(true)} style={{ background: 'transparent', border: 'none', color: '#555', fontSize: '0.8rem', cursor: 'pointer' }}>ШВИДКИЙ ВХІД (555)</button>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 800, marginBottom: '20px' }}>ЧАС ВИКОНАННЯ</div>
                    <div style={{ fontSize: '6rem', fontWeight: 1000, color: '#10b981', fontFamily: 'monospace' }}>{formatElapsedTime(currentCard.started_at)}</div>
                    <button onClick={submitCompletion} style={{ background: '#ec4899', color: '#fff', border: 'none', padding: '22px 70px', borderRadius: '18px', fontSize: '1.4rem', fontWeight: 900, cursor: 'pointer', marginTop: '30px' }}>ЗАВЕРШИТИ ТА В БУФЕР</button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 950 }}>ЛАНЦЮЖОК ВИРОБНИЦТВА</h2>
                <button onClick={() => setIsScanning(true)} style={{ background: '#eab308', border: 'none', color: '#000', padding: '15px 30px', borderRadius: '15px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}><Camera size={20} /> ВІДКРИТИ СКАНЕР</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', marginBottom: '50px' }}>
                {productionStages.map(stage => {
                  const stageKey = stage.toLowerCase()
                  const stageCards = workCards.filter(c => matchesStage(c.operation, stage))
                  const workQty = stageCards.filter(c => c.status === 'in-progress').reduce((acc, c) => acc + (c.quantity || 0), 0)
                  const bufferQty = stageCards.filter(c => ['at-buffer', 'waiting-buffer'].includes(c.status)).reduce((acc, c) => acc + (c.quantity || 0), 0)
                  const scrapQty = workCardHistory.filter(h => matchesStage(h.stage_name, stage)).reduce((acc, h) => acc + (Number(h.scrap_qty) || 0), 0)
                  return (
                    <div key={stage} onClick={() => setDetailStage(stage)} className="stage-card-hover" style={{ background: '#111', border: '1px solid #222', borderRadius: '24px', padding: '20px', cursor: 'pointer', position: 'relative' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <span style={{ color: '#555', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase' }}>{stage}</span>
                        <Layers size={14} color="#333" />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', alignItems: 'flex-end', width: '100%' }}>
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontSize: '0.6rem', color: '#3b82f6', fontWeight: 800, whiteSpace: 'nowrap' }}>У РОБОТІ</div>
                          <div style={{ fontSize: '1.3rem', fontWeight: 950, whiteSpace: 'nowrap', letterSpacing: '-0.02em', color: workQty > 0 ? '#fff' : '#222' }}>{workQty} <small style={{ fontSize: '0.55rem', opacity: 0.3 }}>шт</small></div>
                        </div>
                        <div style={{ borderLeft: '1px solid #222', paddingLeft: '8px', overflow: 'hidden' }}>
                          <div style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 800, whiteSpace: 'nowrap' }}>БУФЕР</div>
                          <div style={{ fontSize: '1.3rem', fontWeight: 950, whiteSpace: 'nowrap', letterSpacing: '-0.02em', color: bufferQty > 0 ? '#10b981' : '#222' }}>{bufferQty} <small style={{ fontSize: '0.55rem', opacity: 0.3 }}>шт</small></div>
                        </div>
                        <div style={{ borderLeft: '1px solid #222', paddingLeft: '8px', overflow: 'hidden' }}>
                          <div style={{ fontSize: '0.6rem', color: '#ef4444', fontWeight: 800, whiteSpace: 'nowrap' }}>БРАК</div>
                          <div style={{ fontSize: '1.3rem', fontWeight: 950, whiteSpace: 'nowrap', letterSpacing: '-0.02em', color: scrapQty > 0 ? '#ef4444' : '#222' }}>{scrapQty} <small style={{ fontSize: '0.55rem', opacity: 0.3 }}>шт</small></div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', marginTop: '10px' }}><span style={{ fontSize: '0.55rem', color: '#333', fontWeight: 900 }}>ВСЬОГО: {stageCards.length}</span></div>
                    </div>
                  )
                })}
              </div>

              <div style={{ background: '#111', borderRadius: '24px', border: '1px solid #222', overflow: 'hidden' }}>
                <div style={{ padding: '25px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900 }}>В РОБОТІ ТА БУФЕРІ</h3>
                  {isSyncing && <div style={{ fontSize: '0.7rem', color: '#eab308', display: 'flex', alignItems: 'center', gap: '8px' }}><RefreshCw className="animate-spin" size={12} /> ОНОВЛЕННЯ...</div>}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ background: '#0a0a0a', fontSize: '0.65rem', fontWeight: 900, color: '#555', textTransform: 'uppercase' }}>
                    <tr><th style={{ padding: '15px 25px' }}>ДЕТАЛЬ</th><th style={{ padding: '15px 25px' }}>ЕТАП</th><th style={{ padding: '15px 25px' }}>К-СТЬ</th><th style={{ padding: '15px 25px' }}>ОПЕРАТОР</th><th style={{ padding: '15px 25px' }}>ЧАС</th><th style={{ padding: '15px 25px' }}></th></tr>
                  </thead>
                  <tbody>
                    {workCards.filter(c => c.status === 'in-progress' || c.status === 'at-buffer').map(card => (
                      <tr key={card.id} style={{ borderBottom: '1px solid #1a1a1a', fontSize: '0.85rem' }}>
                        <td style={{ padding: '15px 25px', fontWeight: 800 }}>{getNomFromCard(card)?.name}</td>
                        <td style={{ padding: '15px 25px' }}><span style={{ color: card.status === 'at-buffer' ? '#10b981' : '#3b82f6', fontWeight: 900, fontSize: '0.7rem' }}>{card.status === 'at-buffer' ? 'БУФЕР' : card.operation?.toUpperCase()}</span></td>
                        <td style={{ padding: '15px 25px', fontWeight: 900 }}>{card.quantity} шт</td>
                        <td style={{ padding: '15px 25px', color: '#aaa' }}>{card.operator_name || '—'}</td>
                        <td style={{ padding: '15px 25px', color: '#10b981' }}>{formatElapsedTime(card.started_at)}</td>
                        <td style={{ padding: '15px 25px', textAlign: 'right' }}><button onClick={() => setSelectedCardId(card.id)} style={{ background: '#222', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.7rem' }}>ВІДКРИТИ</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {isScanning && (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 10001, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={() => setIsScanning(false)} style={{ position: 'absolute', top: 30, right: 30, color: '#fff', background: '#1a1a1a', border: 'none', padding: '15px', borderRadius: '50%' }}><X size={32} /></button>
          <div style={{ width: '90%', maxWidth: '500px', border: '4px solid #3b82f6', borderRadius: '32px', overflow: 'hidden' }} id="reader"></div>
        </div>
      )}

      {showPinModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.98)', zIndex: 10010, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: '350px', textAlign: 'center' }}>
            <div style={{ background: '#111', padding: '20px', borderRadius: '24px', fontSize: '3rem', fontWeight: 1000, marginBottom: '30px', border: `3px solid ${pinError ? '#ef4444' : '#222'}` }}>{pin.split('').map(() => '*').join('')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
              {[1,2,3,4,5,6,7,8,9].map(num => <button key={num} onClick={() => setPin(pin + num)} style={{ background: '#1a1a1a', color: '#fff', border: '1px solid #333', fontSize: '2rem', padding: '20px', borderRadius: '15px' }}>{num}</button>)}
              <button onClick={() => setPin('')} style={{ background: '#1a1a1a', color: '#ef4444', fontSize: '2rem', borderRadius: '15px' }}>C</button>
              <button onClick={() => setPin(pin + '0')} style={{ background: '#1a1a1a', color: '#fff', fontSize: '2rem', borderRadius: '15px' }}>0</button>
              <button onClick={validatePin} style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '15px', fontSize: '1.2rem' }}>OK</button>
            </div>
            <button onClick={() => setShowPinModal(false)} style={{ marginTop: '30px', background: 'transparent', color: '#555', border: 'none' }}>СКАСУВАТИ</button>
          </div>
        </div>
      )}

      {showScrapModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.96)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10020, padding: '20px' }}>
          <div style={{ background: '#111', width: '100%', maxWidth: '500px', borderRadius: '32px', border: '1px solid #333', overflow: 'hidden' }}>
            <div style={{ padding: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1a1a' }}>
              <h3 style={{ margin: 0 }}>ЗАВЕРШИТЬ ЕТАП</h3>
              <button onClick={() => setShowScrapModal(false)} style={{ background: 'transparent', border: 'none', color: '#555' }}><X size={26} /></button>
            </div>
            <div style={{ padding: '30px', textAlign: 'center' }}>
              <h2 style={{ margin: '0 0 20px' }}>{getNomFromCard(currentCard)?.name}</h2>
              <div style={{ background: '#000', padding: '20px', borderRadius: '20px' }}>
                <label style={{ color: '#ef4444', fontWeight: 900, display: 'block', marginBottom: '15px' }}>КІЛЬКІСТЬ БРАКУ</label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
                  <button onClick={() => setScrapCounts(p => ({ ...p, [getNomFromCard(currentCard)?.id]: Math.max(0, (p[getNomFromCard(currentCard)?.id] || 0) - 1) }))} style={{ width: '50px', height: '50px', background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: '12px' }}>-</button>
                  <input type="number" value={scrapCounts[getNomFromCard(currentCard)?.id] || 0} onChange={e => setScrapCounts({ [getNomFromCard(currentCard)?.id]: parseInt(e.target.value) || 0 })} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '3rem', width: '100px', textAlign: 'center' }} />
                  <button onClick={() => setScrapCounts(p => ({ ...p, [getNomFromCard(currentCard)?.id]: (p[getNomFromCard(currentCard)?.id] || 0) + 1 }))} style={{ width: '50px', height: '50px', background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: '12px' }}>+</button>
                </div>
              </div>
              <button onClick={handleFinalFinish} style={{ width: '100%', background: '#10b981', color: '#fff', border: 'none', padding: '20px', borderRadius: '15px', fontWeight: 900, marginTop: '30px' }}>ПІДТВЕРДИТИ ТА В БУФЕР</button>
            </div>
          </div>
        </div>
      )}

      {detailStage && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 10030, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '700px', background: '#111', borderRadius: '32px', border: '1px solid #333', overflow: 'hidden' }}>
            <div style={{ padding: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1a1a' }}>
              <h2 style={{ margin: 0, color: '#eab308' }}>{detailStage.toUpperCase()}</h2>
              <button onClick={() => setDetailStage(null)} style={{ background: '#222', border: 'none', color: '#fff', padding: '10px', borderRadius: '10px' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', padding: '15px', gap: '10px' }}>
              <button onClick={() => setDetailTab('work')} style={{ flex: 1, padding: '15px', borderRadius: '15px', border: 'none', background: detailTab === 'work' ? '#3b82f6' : '#222', color: '#fff', fontWeight: 900 }}>У РОБОТІ</button>
              <button onClick={() => setDetailTab('buffer')} style={{ flex: 1, padding: '15px', borderRadius: '15px', border: 'none', background: detailTab === 'buffer' ? '#10b981' : '#222', color: '#fff', fontWeight: 900 }}>БУФЕР</button>
              <button onClick={() => setDetailTab('scrap')} style={{ flex: 1, padding: '15px', borderRadius: '15px', border: 'none', background: detailTab === 'scrap' ? '#ef4444' : '#222', color: '#fff', fontWeight: 900 }}>БРАК</button>
            </div>
            <div style={{ padding: '0 15px 15px', maxHeight: '450px', overflowY: 'auto' }}>
              {(() => {
                const agg = {}
                if (detailTab === 'scrap') {
                  workCardHistory
                    .filter(h => matchesStage(h.stage_name, detailStage))
                    .forEach(h => {
                      if (Number(h.scrap_qty) > 0) {
                        const nom = nomenclatures.find(n => String(n.id) === String(h.nomenclature_id))
                        const name = nom?.name || 'Деталь'
                        agg[name] = (agg[name] || 0) + Number(h.scrap_qty)
                      }
                    })
                } else {
                  workCards
                    .filter(c => {
                      const stageMatch = matchesStage(c.operation, detailStage)
                      const statusMatch = detailTab === 'work'
                        ? c.status === 'in-progress'
                        : ['at-buffer', 'waiting-buffer'].includes(c.status)
                      return stageMatch && statusMatch
                    })
                    .forEach(c => {
                      const nom = getNomFromCard(c)
                      const name = nom?.name || 'Деталь'
                      agg[name] = (agg[name] || 0) + (c.quantity || 0)
                    })
                }
                const items = Object.entries(agg)
                if (items.length === 0) return <div style={{ textAlign: 'center', padding: '50px', color: '#444' }}>Немає даних</div>
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {items.map(([name, qty], idx) => (
                      <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '15px 20px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 800 }}>{name}</div>
                        <div style={{ fontWeight: 1000, fontSize: '1.2rem', color: detailTab === 'work' ? '#3b82f6' : detailTab === 'buffer' ? '#10b981' : '#ef4444' }}>{qty} <small style={{ opacity: 0.3 }}>шт</small></div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .stage-card-hover:hover { background: #181818 !important; transform: translateY(-5px); }
        .stage-card-hover { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </div>
  )
}

export default OperatorTerminal
