import React, { useState, useEffect } from 'react'
import { 
  Tablet, 
  ArrowLeft, 
  Play, 
  CheckCircle, 
  Scan, 
  Timer,
  AlertTriangle,
  X,
  ClipboardList,
  Camera,
  Menu,
  Fingerprint,
  RefreshCw,
  Search,
  Box,
  Layers,
  FileCode,
  Gauge
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'

const OperatorTerminal = () => {
  const { workCards, orders, nomenclatures, startWorkCard, completeWorkCard, fetchData, operators, productionStages } = useMES()
  const [selectedCardId, setSelectedCardId] = useState(null)
  const [selectedStage, setSelectedStage] = useState('')
  const [selectedOperator, setSelectedOperator] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [scanError, setScanError] = useState(null)
  
  // Persistent scanned IDs (only active/in-progress cards)
  const [scannedCardIds, setScannedCardIds] = useState(() => {
    try { 
      const saved = localStorage.getItem('centrum_operator_scanned')
      return saved ? JSON.parse(saved) : [] 
    } catch(e) { return [] }
  })

  const [isScanning, setIsScanning] = useState(false)
  const [showScrapModal, setShowScrapModal] = useState(false)
  const [scrapCounts, setScrapCounts] = useState({})
  const [showPinModal, setShowPinModal] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState(false)

  useEffect(() => {
    localStorage.setItem('centrum_operator_scanned', JSON.stringify(scannedCardIds))
  }, [scannedCardIds])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // QR SCANNER LOGIC
  useEffect(() => {
    let html5QrCode = null
    if (isScanning && window.Html5Qrcode) {
      html5QrCode = new window.Html5Qrcode("reader")
      const config = { fps: 15, qrbox: { width: 260, height: 260 } }
      const stopAndClose = async () => {
        if (html5QrCode && html5QrCode.isScanning) await html5QrCode.stop().catch(() => {})
        setIsScanning(false)
      }
      html5QrCode.start(
        { facingMode: "environment" }, config, async (decodedText) => {
          if (decodedText.startsWith("CENTRUM_CARD_")) {
            const cardIdStr = decodedText.replace("CENTRUM_CARD_", "").trim()
            await stopAndClose()
            let foundCard = workCards.find(c => String(c.id).trim() === cardIdStr)
            if (!foundCard) {
              setIsSyncing(true)
              try {
                if (typeof fetchData === 'function') {
                  await fetchData()
                }
              } catch(e) {}
              setIsSyncing(false)
              setScanError(`Картку №${cardIdStr} не знайдено. Спробуйте відсканувати ще раз.`)
            } else {
              setScannedCardIds(prev => prev.includes(foundCard.id) ? prev : [...prev, foundCard.id])
              setSelectedCardId(foundCard.id)
              setScanError(null)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }
          }
        }
      ).catch(err => {
        setScanError("Помилка камери: " + err)
        setIsScanning(false)
      })
    }
    return () => { if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop().catch(() => {}) }
  }, [isScanning, workCards])

  const currentCard = workCards.find(c => c.id === selectedCardId)
  const getTaskOrder = (orderId) => orders.find(o => o.id === orderId)
  
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
     return matchQty ? matchQty[1].trim() : '—'
  }

  const getSheetsFromCard = (card) => {
    if (!card?.card_info) return null
    // Matches patterns like "1/5" or "Loading: 2/10"
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

  const availableCards = workCards.filter(c => 
    c.status === 'in-progress' || 
    c.status === 'new' || 
    c.status === 'waiting-buffer' || 
    c.status === 'at-buffer' ||
    scannedCardIds.includes(c.id)
  )
  
  const handleStartOperation = async () => {
    console.log('--- 🛡️ TERMINAL START CLICKED ---', { currentCard, selectedStage, selectedOperator });
    if (!currentCard || !selectedStage || !selectedOperator) {
      console.warn('Abort: Missing card, stage or operator');
      return
    }
    setIsProcessing(true)
    try {
      await apiService.submitOperatorAction('start', currentCard.task_id, currentCard.id, selectedOperator, { stage_name: selectedStage }, startWorkCard)
      if (!scannedCardIds.includes(currentCard.id)) {
        setScannedCardIds(prev => [...prev, currentCard.id])
      }
      console.log('--- 🛡️ TERMINAL START CALL SENT ---');
    } catch (e) {
      console.error('Terminal start error:', e);
      alert('Помилка при старті: ' + e.message);
    } finally { setIsProcessing(false) }
  }

  const validatePin = async () => {
    if (pin === '555') {
       setIsProcessing(true)
       try {
         await apiService.submitOperatorAction('start', currentCard.task_id, currentCard.id, 'Оператор Тест (555)', {}, startWorkCard)
         setShowPinModal(false)
       } finally { setIsProcessing(false) }
    } else { setPinError(true); setPin(''); setTimeout(() => setPinError(false), 1000) }
  }

  const submitCompletion = async () => {
    if (!currentCard) return
    setIsProcessing(true)
    try {
      await apiService.submitOperatorAction('complete', currentCard.task_id, currentCard.id, currentCard.operator_name, {}, completeWorkCard)
      setSelectedCardId(null);
      setSelectedStage('');
      setSelectedOperator('');
      setScannedCardIds(prev => prev.filter(id => id !== currentCard.id))
    } finally { setIsProcessing(false) }
  }



  const SpecCard = ({ icon: Icon, label, value, color="#eab308" }) => (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1a1a1a', padding: '18px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '130px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#555', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>
        <Icon size={14} /> {label}
      </div>
      <div style={{ fontSize: '1.2rem', fontWeight: 900, color }}>{value}</div>
    </div>
  )

  const renderQueue = () => (
    <div className="tasks-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 15px 25px' }}>
      {availableCards.length === 0 && (
         <div style={{ textAlign: 'center', padding: '40px 10px', color: '#444', fontSize: '0.8rem' }}>Поки що немає прийнятих карт. Відскануйте першу...</div>
      )}
      {availableCards.map(card => {
        const nom = getNomFromCard(card)
        const isActive = selectedCardId === card.id
        const batchQty = getQtyFromCard(card)
        
        return (
          <div key={card.id} onClick={() => { setSelectedCardId(card.id); setIsDrawerOpen(false); }} style={{ background: isActive ? '#eab308' : '#1a1a1a', borderRadius: '12px', padding: '15px', marginBottom: '10px', cursor: 'pointer', border: '1px solid', borderColor: isActive ? '#eab308' : '#333', transition: '0.2s', color: isActive ? '#000' : '#fff' }}>
            <div style={{ marginBottom: '4px' }}>
              <strong style={{ display: 'block', fontSize: '0.9rem', fontWeight: 800 }}>{nom?.name || 'Без назви'}</strong>
              <div style={{ fontSize: '0.65rem', opacity: 0.7 }}>{batchQty} шт | {card.operation} {getSheetsFromCard(card) ? `| Лист ${getSheetsFromCard(card)}` : ''}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <span style={{ fontSize: '0.6rem', background: isActive ? 'rgba(0,0,0,0.2)' : 'rgba(234, 179, 8, 0.1)', color: isActive ? '#000' : '#eab308', padding: '2px 6px', borderRadius: '4px', fontWeight: 900, textTransform: 'uppercase' }}>{card.status === 'in-progress' ? (card.operation || 'У РОБОТІ') : 'ОЧІКУЄ'}</span>
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
            <ClipboardList size={16} /> ЧЕРГА КАРТ ({availableCards.length})
          </div>
          {renderQueue()}
        </div>

        {isDrawerOpen && <div className="drawer-backdrop" onClick={() => setIsDrawerOpen(false)} />}
        <div className={`side-drawer ${isDrawerOpen ? 'open' : ''}`}>
           <div className="drawer-header"><span style={{ fontSize: '0.8rem', fontWeight: 900 }}>ОБЕРІТЬ КАРТУ</span><button onClick={() => setIsDrawerOpen(false)} className="burger-btn"><X size={20} /></button></div>
           {renderQueue()}
        </div>

        <div className="content-panel" style={{ flex: 1, padding: '20px 15px', background: '#0a0a0a', overflowY: 'auto', position: 'relative' }}>
          {isSyncing && (
            <div style={{ position: 'absolute', top: 20, right: 20, background: '#eab308', color: '#000', padding: '10px 20px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px', zIndex: 100 }}>
              <RefreshCw className="animate-spin" size={16} /> СИНХРОНІЗАЦІЯ ДАНИХ...
            </div>
          )}

          {scanError && !isScanning && (
            <div style={{ background: '#ef4444', color: '#fff', padding: '12px 20px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}><AlertTriangle size={18} /> {scanError}</div>
               <button onClick={() => setScanError(null)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
            </div>
          )}

          {currentCard ? (
            <div style={{ maxWidth: '900px', margin: '0 auto' }} className="anim-fade-in">
              <div style={{ marginBottom: '35px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                     <div style={{ background: currentCard.status === 'new' ? '#ef4444' : '#3b82f6', color: 'white', padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 900 }}>
                        {currentCard.status === 'new' ? 'НОВА КАРТА' : 'РОБОЧА КАРТА'}
                     </div>
                     <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 800 }}>№ {currentCard.id}</div>
                  </div>
                  <h2 style={{ fontSize: '2.5rem', margin: 0, fontWeight: 950, letterSpacing: '-0.02em', lineHeight: 1 }}>{getNomFromCard(currentCard)?.name || 'Деталь'}</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px', color: '#3b82f6' }}>
                     <FileCode size={18}/> <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{getNomFromCard(currentCard)?.cnc_program || 'БЕЗ ПРОГРАМИ'}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedCardId(null)} style={{ background: '#111', border: 'none', color: '#555', padding: '10px', borderRadius: '12px', cursor: 'pointer' }}><X size={24}/></button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '30px' }}>
                <SpecCard icon={Layers} label="Матеріал / Сировина" value={getNomFromCard(currentCard)?.material_type || '—'} color="#10b981" />
                <SpecCard icon={Box} label="Кількість у карті" value={`${currentCard.quantity || getQtyFromCard(currentCard)} шт`} color="#3b82f6" />
                <SpecCard icon={Gauge} label="Норма часу" value={`${currentCard.estimated_time || 0} хв`} />
                <SpecCard icon={Tablet} label="Обладнання" value={currentCard.machine || '—'} />
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '28px', border: '1px solid #1a1a1a', padding: '40px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: currentCard.status === 'in-progress' ? '#10b981' : '#222' }} />
                
                {currentCard.status === 'new' || currentCard.status === 'at-buffer' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', maxWidth: '500px', margin: '0 auto' }}>
                     <div style={{ textAlign: 'left' }}>
                        <label style={{ color: '#555', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>1. Етап робіт</label>
                        <select 
                          value={selectedStage || currentCard.operation} 
                          onChange={(e) => setSelectedStage(e.target.value)} 
                          style={{ width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '15px', borderRadius: '15px', fontSize: '1.1rem', fontWeight: 700 }}
                        >
                           <option value="">— Оберіть етап —</option>
                           {productionStages.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                     </div>

                     <div style={{ textAlign: 'left' }}>
                        <label style={{ color: '#555', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>2. Відповідальний оператор</label>
                        <select 
                          value={selectedOperator} 
                          onChange={(e) => setSelectedOperator(e.target.value)} 
                          style={{ width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '15px', borderRadius: '15px', fontSize: '1.1rem', fontWeight: 700 }}
                        >
                           <option value="">— Оберіть оператора —</option>
                           {operators.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                     </div>

                     <button 
                       disabled={isProcessing || !selectedOperator} 
                       onClick={handleStartOperation} 
                       className="btn-action pulse-blue" 
                       style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '22px 60px', borderRadius: '18px', fontSize: '1.4rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginTop: '20px' }}
                     >
                        ВЗЯТИ В РОБОТУ
                     </button>
                  </div>
                ) : currentCard.status === 'in-progress' ? (
                  <>
                     <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '35px' }}>
                        <div style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '5px 15px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 900, marginBottom: '20px' }}>
                           ЕТАП: {currentCard.operation?.toUpperCase()} | ОПЕРАТОР: {currentCard.operator_name || 'Не вказано'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#10b981', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em' }}><Timer size={16} /> ЧАС ВИКОНАННЯ</div>
                        <div className="timer-display" style={{ fontSize: '6rem', fontWeight: 1000, color: '#10b981', fontFamily: 'monospace', letterSpacing: '-0.05em' }}>{formatElapsedTime(currentCard.started_at)}</div>
                     </div>
                     <button disabled={isProcessing} onClick={submitCompletion} className="btn-action" style={{ background: '#ec4899', color: '#fff', border: 'none', padding: '22px 70px', borderRadius: '18px', fontSize: '1.4rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '15px', margin: '0 auto' }}>
                        <CheckCircle size={30} /> ЗАВЕРШИТИ ТА В БУФЕР
                     </button>
                  </>
                ) : (
                   <div style={{ textAlign: 'center', padding: '40px' }}>
                      <CheckCircle size={60} color="#10b981" style={{ marginBottom: '20px' }} />
                      <h3 style={{ margin: 0 }}>Очікує прийомки на буфер</h3>
                      <p style={{ color: '#444' }}>Статус: {currentCard.status}</p>
                   </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: '1200px', margin: '0 auto' }} className="anim-fade-in">
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: 950, margin: 0 }}>ЛАНЦЮЖОК ВИРОБНИЦТВА</h2>
                  <button onClick={() => { setIsScanning(true); setScanError(null); }} style={{ background: '#eab308', color: '#000', border: 'none', padding: '15px 30px', borderRadius: '15px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 10px 20px rgba(234, 179, 8, 0.2)' }}>
                     <Camera size={20} /> ВІДКРИТИ СКАНЕР
                  </button>
               </div>

               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                  {['Різка', 'Галтовка', 'Гнуття', 'Зварювання', 'Покраска'].map(stage => {
                     const inWork = workCards.filter(c => c.operation === stage && c.status === 'in-progress')
                     const atBuffer = workCards.filter(c => c.operation === stage && (c.status === 'at-buffer' || c.status === 'completed'))
                     
                     const workQty = inWork.reduce((sum, c) => sum + (c.quantity || 0), 0)
                     const bufferQty = atBuffer.reduce((sum, c) => sum + (c.quantity || 0), 0)

                     return (
                        <div key={stage} style={{ background: '#111', padding: '25px', borderRadius: '24px', border: '1px solid #222', position: 'relative', overflow: 'hidden' }}>
                           <div style={{ color: '#555', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '15px', letterSpacing: '0.1em' }}>{stage}</div>
                           <div style={{ display: 'flex', alignItems: 'flex-end', gap: '15px' }}>
                              <div>
                                 <div style={{ fontSize: '0.65rem', color: '#3b82f6', fontWeight: 800, marginBottom: '2px' }}>У РОБОТІ</div>
                                 <div style={{ fontSize: '2rem', fontWeight: 950, color: workQty > 0 ? '#fff' : '#222' }}>{workQty} <span style={{ fontSize: '0.8rem', opacity: 0.3 }}>шт</span></div>
                              </div>
                              <div style={{ width: '1px', height: '30px', background: '#222' }} />
                              <div>
                                 <div style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 800, marginBottom: '2px' }}>БУФЕР</div>
                                 <div style={{ fontSize: '2rem', fontWeight: 950, color: bufferQty > 0 ? '#10b981' : '#222' }}>{bufferQty} <span style={{ fontSize: '0.8rem', opacity: 0.3 }}>шт</span></div>
                              </div>
                           </div>
                           <div style={{ position: 'absolute', bottom: 0, left: 0, height: '4px', background: workQty > 0 ? '#3b82f6' : '#222', width: '100%' }} />
                        </div>
                     )
                  })}
               </div>

               <div style={{ background: '#111', padding: '30px', borderRadius: '24px', border: '1px solid #222', textAlign: 'center', opacity: 0.5 }}>
                  <Tablet size={50} color="#222" style={{ marginBottom: '15px' }} />
                  <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>ОБЕРІТЬ КАРТУ ЗІ СПИСКУ ЗЛІВА АБО ВІДСКАНУЙТЕ QR</div>
               </div>
            </div>
          )}
        </div>
      </div>

      {isScanning && (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 10001, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <button onClick={() => setIsScanning(false)} style={{ position: 'absolute', top: 30, right: 30, background: '#1a1a1a', border: 'none', color: '#fff', padding: '15px', borderRadius: '50%', cursor: 'pointer', zIndex: 10002 }}><X size={32} /></button>
          <div style={{ width: '100%', maxWidth: '540px', position: 'relative' }}>
             <div id="reader" style={{ background: '#111', borderRadius: '32px', overflow: 'hidden' }}></div>
             <div style={{ position: 'absolute', inset: -5, border: '6px solid #3b82f6', borderRadius: '36px', pointerEvents: 'none', animation: 'scan-glow 2s infinite' }}></div>
          </div>
          <div style={{ marginTop: '40px', color: '#3b82f6', fontSize: '1rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em' }}>Зчитайте QR-код з робочої карти</div>
        </div>
      )}

      {showPinModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.98)', backdropFilter: 'blur(30px)', zIndex: 10010, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
           <div style={{ width: '100%', maxWidth: '380px', textAlign: 'center' }}>
              <div style={{ marginBottom: '30px' }}><Fingerprint size={50} color="#3b82f6" style={{ marginBottom: '12px' }} /><h3 style={{ fontSize: '2rem', fontWeight: 950, margin: 0 }}>ВХІД: 555</h3><p style={{ color: '#555', fontSize: '0.9rem' }}>Підтвердіть особу оператора для початку робіт</p></div>
              <div style={{ background: '#111', padding: '10px', borderRadius: '24px', fontSize: '3rem', fontWeight: 1000, letterSpacing: '0.4em', height: '90px', marginBottom: '30px', border: `3px solid ${pinError ? '#ef4444' : '#222'}`, color: pinError ? '#ef4444' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{pin.split('').map(() => '*').join('')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                 {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => <button key={num} onClick={() => pin.length < 6 && setPin(pin + num)} style={{ background: '#1a1a1a', border: '1px solid #333', color: '#fff', fontSize: '2rem', fontWeight: 900, padding: '22px', borderRadius: '18px', cursor: 'pointer' }}>{num}</button>)}
                 <button onClick={() => setPin('')} style={{ background: '#1a1a1a', border: '1px solid #333', color: '#ef4444', fontSize: '2rem', fontWeight: 900, borderRadius: '18px' }}>C</button>
                 <button onClick={() => pin.length < 6 && setPin(pin + '0')} style={{ background: '#1a1a1a', border: '1px solid #333', color: '#fff', fontSize: '2rem', fontWeight: 900, borderRadius: '18px' }}>0</button>
                 <button disabled={isProcessing} onClick={validatePin} style={{ background: '#3b82f6', border: 'none', color: '#fff', fontSize: '1.2rem', fontWeight: 900, borderRadius: '18px' }}>OK</button>
              </div>
              <button onClick={() => setShowPinModal(false)} style={{ marginTop: '30px', background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontWeight: 800 }}>СКАСУВАТИ</button>
           </div>
        </div>
      )}

      {showScrapModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.96)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10020, padding: '20px' }}>
          <div style={{ background: '#111', width: '100%', maxWidth: '580px', borderRadius: '32px', border: '1px solid #333', overflow: 'hidden' }}>
            <div style={{ padding: '30px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 0, fontSize: '1.4rem', fontWeight: 900 }}><AlertTriangle color="#ef4444" size={26} /> Звіт по браку за партію</h3>
              <button onClick={() => setShowScrapModal(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={26} /></button>
            </div>
            <div style={{ padding: '30px', maxHeight: '60vh', overflowY: 'auto' }}>
              {getTaskOrder(currentCard?.order_id)?.order_items?.map(item => {
                const nom = nomenclatures.find(n => n.id === item.nomenclature_id) || nomenclatures.find(n => currentCard.card_info?.includes(`NOM_ID:${n.id}`))
                return (
                  <div key={item.id} style={{ background: '#0a0a0a', padding: '20px', borderRadius: '20px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #222' }}>
                    <div style={{ flex: 1 }}><strong style={{ display: 'block', fontSize: '1.2rem', marginBottom: '6px' }}>{nom?.name}</strong><span style={{ color: '#555', fontSize: '0.85rem' }}>План замовлення: {item.quantity} шт</span></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                       <span style={{ color: '#ef4444', fontWeight: 950, fontSize: '0.75rem' }}>БРАК:</span>
                       <input type="number" min="0" style={{ background: '#000', border: '2px solid #333', color: 'white', width: '85px', padding: '15px', borderRadius: '12px', textAlign: 'center', fontSize: '1.5rem', fontWeight: 900 }} value={scrapCounts[item.nomenclature_id] || 0} onChange={e => setScrapCounts({...scrapCounts, [item.nomenclature_id]: parseInt(e.target.value) || 0})} />
                    </div>
                  </div>
                )
              })}
              <button disabled={isProcessing} onClick={submitCompletion} style={{ background: '#3b82f6', color: 'white', border: 'none', width: '100%', padding: '22px', borderRadius: '18px', fontWeight: 900, fontSize: '1.3rem', marginTop: '20px', cursor: 'pointer' }}>ЗАВЕРШИТИ ПАРТІЮ ТА ЗБЕРЕГТИ</button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes scan-glow { 0% { box-shadow: 0 0 10px #3b82f6; } 50% { box-shadow: 0 0 30px #3b82f6; } 100% { box-shadow: 0 0 10px #3b82f6; } }
        @keyframes pulse-blue { 0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); } 70% { box-shadow: 0 0 0 15px rgba(59, 130, 246, 0); } 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); } }
        .pulse-blue { animation: pulse-blue 2s infinite; }
      `}} />
    </div>
  )
}

export default OperatorTerminal
