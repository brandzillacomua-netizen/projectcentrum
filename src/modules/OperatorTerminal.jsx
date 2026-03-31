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
  Fingerprint
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'

const OperatorTerminal = () => {
  const { workCards, orders, nomenclatures, startWorkCard, completeWorkCard } = useMES()
  const [selectedCardId, setSelectedCardId] = useState(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  
  // Persistent scanned IDs for the session
  const [scannedCardIds, setScannedCardIds] = useState(() => {
    try { 
      const saved = localStorage.getItem('centrum_operator_scanned')
      return saved ? JSON.parse(saved) : [] 
    } catch(e) { return [] }
  })

  // States for Scanner
  const [isScanning, setIsScanning] = useState(false)

  // States for PIN Auth
  const [showPinModal, setShowPinModal] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState(false)

  // Status for completion
  const [showScrapModal, setShowScrapModal] = useState(false)
  const [scrapCounts, setScrapCounts] = useState({})

  useEffect(() => {
    localStorage.setItem('centrum_operator_scanned', JSON.stringify(scannedCardIds))
  }, [scannedCardIds])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // QR SCANNER LOGIC
  useEffect(() => {
    if (isScanning && window.Html5Qrcode) {
      const html5QrCode = new window.Html5Qrcode("reader")
      const config = { fps: 10, qrbox: { width: 250, height: 250 } }

      html5QrCode.start(
        { facingMode: "environment" }, 
        config, 
        (decodedText) => {
          if (decodedText.startsWith("CENTRUM_CARD_")) {
            const cardIdStr = decodedText.replace("CENTRUM_CARD_", "")
            const cardId = isNaN(Number(cardIdStr)) ? cardIdStr : Number(cardIdStr)
            const foundCard = workCards.find(c => String(c.id) === String(cardId))
            
            if (foundCard) {
              // 1. Assign to this session
              setScannedCardIds(prev => prev.includes(foundCard.id) ? prev : [...prev, foundCard.id])
              // 2. Select it
              setSelectedCardId(foundCard.id)
              // 3. Close scanner immediately
              html5QrCode.stop().then(() => setIsScanning(false)).catch(() => setIsScanning(false))
            } else {
              alert("Картку не знайдено в базі!")
            }
          }
        },
        () => {}
      ).catch(err => {
        alert("Помилка камери: " + err)
        setIsScanning(false)
      })

      return () => {
        if (html5QrCode.isScanning) {
          html5QrCode.stop().catch(() => {})
        }
      }
    }
  }, [isScanning, workCards, scannedCardIds])

  const currentCard = workCards.find(c => c.id === selectedCardId)
  const getTaskOrder = (orderId) => orders.find(o => o.id === orderId)
  const getNomFromCard = (card) => {
     if (!card) return null
     if (card.nomenclature_id) return nomenclatures.find(n => n.id === card.nomenclature_id)
     const metaId = card.card_info?.match(/NOM_ID:(\d+)/)?.[1]
     return nomenclatures.find(n => String(n.id) === String(metaId))
  }

  // ONLY SHOW SCANNED OR ALREADY IN PROGRESS CARDS
  const availableCards = workCards.filter(c => 
    c.status !== 'completed' && 
    (scannedCardIds.includes(c.id) || c.status === 'in-progress')
  )

  const handleStartOperation = () => {
    setShowPinModal(true)
    setPin('')
    setPinError(false)
  }

  const validatePin = async () => {
    if (pin === '555') {
       setIsProcessing(true)
       try {
         await apiService.submitOperatorAction('start', currentCard.task_id, currentCard.id, 'Оператор Тест (555)', {}, startWorkCard)
         setShowPinModal(false)
       } finally {
         setIsProcessing(false)
       }
    } else {
      setPinError(true)
      setPin('')
      setTimeout(() => setPinError(false), 1000)
    }
  }

  const handleCompleteClick = () => {
    if (!currentCard) return
    const order = getTaskOrder(currentCard.order_id)
    const initialScrap = {}
    order?.order_items?.forEach(item => {
      initialScrap[item.nomenclature_id] = 0
    })
    setScrapCounts(initialScrap)
    setShowScrapModal(true)
  }

  const submitCompletion = async () => {
    if (!currentCard) return
    setIsProcessing(true)
    try {
      await apiService.submitOperatorAction('complete', currentCard.task_id, currentCard.id, 'Оператор Тест (555)', { scrap_counts: scrapCounts }, completeWorkCard)
      setShowScrapModal(false)
      setSelectedCardId(null)
      // Remove from scanned list once finished
      setScannedCardIds(prev => prev.filter(id => id !== currentCard.id))
    } finally {
      setIsProcessing(false)
    }
  }

  const formatElapsedTime = (startIso) => {
    if (!startIso) return '00:00:00'
    const start = new Date(startIso)
    const diff = Math.floor((currentTime - start) / 1000)
    const h = Math.floor(diff / 3600).toString().padStart(2, '0')
    const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0')
    const s = (diff % 60).toString().padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  const renderQueue = () => (
    <div className="tasks-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 15px 25px' }}>
      {availableCards.length === 0 && (
         <div style={{ textAlign: 'center', padding: '40px 10px', color: '#444', fontSize: '0.8rem' }}>Поки що немає прийнятих карт. Відскануйте першу...</div>
      )}
      {availableCards.map(card => {
        const nom = getNomFromCard(card)
        const isActive = selectedCardId === card.id
        const loadInfo = card.card_info?.split('|')?.pop()?.trim() || ''
        
        return (
          <div key={card.id} onClick={() => { setSelectedCardId(card.id); setIsDrawerOpen(false); }} style={{ background: isActive ? '#eab308' : '#1a1a1a', borderRadius: '12px', padding: '15px', marginBottom: '10px', cursor: 'pointer', border: '1px solid', borderColor: isActive ? '#eab308' : '#333', transition: '0.2s', color: isActive ? '#000' : '#fff' }}>
            <div style={{ marginBottom: '4px' }}>
              <strong style={{ display: 'block', fontSize: '0.9rem', fontWeight: 800 }}>{nom?.name || 'Без назви'}</strong>
              <div style={{ fontSize: '0.65rem', opacity: 0.7 }}>{card.operation} {loadInfo && `| ${loadInfo}`}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
               <span style={{ fontSize: '0.6rem', background: isActive ? 'rgba(0,0,0,0.2)' : 'rgba(234, 179, 8, 0.1)', color: isActive ? '#000' : '#eab308', padding: '2px 6px', borderRadius: '4px', fontWeight: 900 }}>{card.status === 'in-progress' ? 'У РОБОТІ' : 'ОЧІКУЄ'}</span>
               <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>{card.estimated_time || 0} хв</span>
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="operator-terminal-v2" style={{ background: '#0a0a0a', height: '100vh', display: 'flex', flexDirection: 'column', color: '#fff', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>
      <header className="terminal-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', height: '70px', background: '#000', borderBottom: '2px solid #eab308', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
           <Link to="/" style={{ color: '#94a3b8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.85rem' }}>
             <ArrowLeft size={18} /> <span className="hide-mobile">Вихід</span>
           </Link>
           <button onClick={() => setIsDrawerOpen(true)} className="burger-btn mobile-only"><Menu size={24} /></button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Tablet size={20} color="#eab308" />
          <h1 style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '0.1em', margin: 0 }} className="hide-mobile">ТЕРМІНАЛ ОПЕРАТОРА</h1>
        </div>
        <div style={{ fontWeight: 900, fontFamily: 'monospace', fontSize: '1.2rem', color: '#eab308' }}>{currentTime.toLocaleTimeString()}</div>
      </header>

      <div className="main-layout-responsive" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Desktop Sidebar */}
        <div className="side-panel hide-mobile" style={{ width: '300px', background: '#121212', borderRight: '1px solid #222', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '20px', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800, color: '#555', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ClipboardList size={16} /> ЧЕРГА КАРТ ({availableCards.length})
          </div>
          {renderQueue()}
        </div>

        {/* Mobile Side Drawer Overlay */}
        {isDrawerOpen && <div className="drawer-backdrop" onClick={() => setIsDrawerOpen(false)} />}
        <div className={`side-drawer ${isDrawerOpen ? 'open' : ''}`}>
           <div className="drawer-header">
              <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>ОБЕРІТЬ КАРТУ</span>
              <button onClick={() => setIsDrawerOpen(false)} className="burger-btn"><X size={20} /></button>
           </div>
           {renderQueue()}
        </div>

        {/* Workspace */}
        <div className="content-panel" style={{ flex: 1, padding: '20px', background: '#0a0a0a', overflowY: 'auto', position: 'relative' }}>
          {currentCard ? (
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' }}>
                <div>
                  <span style={{ color: '#3b82f6', fontWeight: 800, fontSize: '0.7rem', display: 'block', marginBottom: '8px' }}>АКТИВНА КАРТКА</span>
                  <h2 style={{ fontSize: '2rem', margin: 0, fontWeight: 900 }} className="responsive-title">{getNomFromCard(currentCard)?.name}</h2>
                </div>
                <div style={{ background: '#3b82f6', color: 'white', padding: '10px 20px', borderRadius: '12px', fontWeight: 900, fontSize: '0.8rem' }}>
                  {currentCard.operation.toUpperCase()}
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '1px solid #222', padding: '30px', textAlign: 'center' }}>
                {currentCard.status === 'pending' || currentCard.status === 'waiting' ? (
                  <>
                     <div style={{ background: '#111', padding: '25px', borderRadius: '20px', marginBottom: '30px' }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>К-сть деталей: <span style={{ color: '#eab308' }}>{getTaskOrder(currentCard.order_id)?.order_items?.find(i => i.nomenclature_id === currentCard.nomenclature_id || currentCard.card_info?.includes(`NOM_ID:${i.nomenclature_id}`))?.quantity || '—'}</span> шт.</div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '25px', marginTop: '25px' }}>
                           <div><div style={{ color: '#444', fontSize: '0.65rem', fontWeight: 800 }}>НОРМА</div><div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{currentCard.estimated_time || 0} хв</div></div>
                           <div><div style={{ color: '#444', fontSize: '0.65rem', fontWeight: 800 }}>СТАНОК</div><div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{currentCard.machine}</div></div>
                        </div>
                     </div>
                     <button disabled={isProcessing} onClick={handleStartOperation} className="btn-action" style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '20px 50px', borderRadius: '16px', fontSize: '1.3rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '15px', margin: '0 auto' }}>
                        <Play fill="currentColor" size={24} /> РОЗПОЧАТИ
                     </button>
                  </>
                ) : (
                  <>
                    <div className="timer-display" style={{ fontSize: '5rem', fontWeight: 900, color: '#3b82f6', fontFamily: 'monospace', margin: '30px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
                      <Timer className="spin-slow" size={50} />
                      <span>{formatElapsedTime(currentCard.started_at)}</span>
                    </div>
                    <button disabled={isProcessing} onClick={handleCompleteClick} className="btn-action" style={{ background: '#10b981', color: '#fff', border: 'none', padding: '20px 60px', borderRadius: '16px', fontSize: '1.3rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '15px', margin: '0 auto' }}>
                       <CheckCircle size={28} /> ЗАВЕРШИТИ
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
               <div style={{ width: '130px', height: '130px', borderRadius: '50%', background: 'rgba(234, 179, 8, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '25px', border: '2px dashed #333' }}>
                  <Scan size={70} color="#333" />
               </div>
               <h3 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '12px' }}>ГОТОВИЙ ДО СКАНУВАННЯ</h3>
               <p style={{ color: '#555', fontSize: '1rem', maxWidth: '350px' }}>Відскануйте QR-код робочої карти для початку операції</p>
               <button onClick={() => setIsScanning(true)} style={{ marginTop: '35px', background: '#eab308', color: '#000', border: 'none', padding: '18px 45px', borderRadius: '14px', fontSize: '1.1rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Camera size={22} /> ВІДКРИТИ СКАНЕР
               </button>
            </div>
          )}
        </div>
      </div>

      {/* SCANNER MODAL */}
      {isScanning && (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 10001, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <button onClick={() => setIsScanning(false)} style={{ position: 'absolute', top: 30, right: 30, background: '#1a1a1a', border: 'none', color: '#fff', padding: '15px', borderRadius: '50%', cursor: 'pointer', zIndex: 10002 }}><X size={32} /></button>
          <div style={{ width: '100%', maxWidth: '500px', position: 'relative' }}>
             <div id="reader" style={{ background: '#111', borderRadius: '24px', overflow: 'hidden' }}></div>
             <div style={{ position: 'absolute', inset: 0, border: '4px solid #eab308', borderRadius: '24px', pointerEvents: 'none', animation: 'pulse 2s infinite' }}></div>
          </div>
        </div>
      )}

      {/* PIN MODAL */}
      {showPinModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.98)', backdropFilter: 'blur(20px)', zIndex: 10010, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
           <div style={{ width: '100%', maxWidth: '360px', textAlign: 'center' }}>
              <div style={{ marginBottom: '25px' }}><Fingerprint size={45} color="#3b82f6" style={{ marginBottom: '10px' }} /><h3 style={{ fontSize: '1.8rem', fontWeight: 900, margin: 0 }}>CODE: 555</h3><p style={{ color: '#555', fontSize: '0.9rem' }}>Авторизація оператора</p></div>
              <div style={{ background: '#111', padding: '10px', borderRadius: '20px', fontSize: '2.5rem', fontWeight: 900, letterSpacing: '0.4em', height: '80px', marginBottom: '25px', border: `2px solid ${pinError ? '#ef4444' : '#222'}`, color: pinError ? '#ef4444' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{pin.split('').map(() => '*').join('')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                 {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => <button key={num} onClick={() => pin.length < 6 && setPin(pin + num)} style={{ background: '#1a1a1a', border: '1px solid #333', color: '#fff', fontSize: '1.8rem', fontWeight: 900, padding: '20px', borderRadius: '16px', cursor: 'pointer' }}>{num}</button>)}
                 <button onClick={() => setPin('')} style={{ background: '#1a1a1a', border: '1px solid #333', color: '#ef4444', fontSize: '1.8rem', fontWeight: 900, borderRadius: '16px' }}>C</button>
                 <button onClick={() => pin.length < 6 && setPin(pin + '0')} style={{ background: '#1a1a1a', border: '1px solid #333', color: '#fff', fontSize: '1.8rem', fontWeight: 900, borderRadius: '16px' }}>0</button>
                 <button disabled={isProcessing} onClick={validatePin} style={{ background: '#3b82f6', border: 'none', color: '#fff', fontSize: '1.1rem', fontWeight: 900, borderRadius: '16px' }}>OK</button>
              </div>
              <button onClick={() => setShowPinModal(false)} style={{ marginTop: '25px', background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontWeight: 700 }}>СКАСУВАТИ</button>
           </div>
        </div>
      )}

      {/* SCRAP MODAL */}
      {showScrapModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(15px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10020, padding: '20px' }}>
          <div style={{ background: '#111', width: '100%', maxWidth: '550px', borderRadius: '28px', border: '1px solid #333', overflow: 'hidden' }}>
            <div style={{ padding: '25px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 0, fontSize: '1.3rem' }}><AlertTriangle color="#ef4444" size={24} /> Звіт за зміну</h3>
              <button onClick={() => setShowScrapModal(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            <div style={{ padding: '25px', maxHeight: '60vh', overflowY: 'auto' }}>
              {getTaskOrder(currentCard?.order_id)?.order_items?.map(item => {
                const nom = nomenclatures.find(n => n.id === item.nomenclature_id) || nomenclatures.find(n => currentCard.card_info?.includes(`NOM_ID:${n.id}`))
                return (
                  <div key={item.id} style={{ background: '#0a0a0a', padding: '15px', borderRadius: '16px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #1a1a1a' }}>
                    <div style={{ flex: 1 }}><strong style={{ display: 'block', fontSize: '1.1rem', marginBottom: '4px' }}>{nom?.name}</strong><span style={{ color: '#555', fontSize: '0.8rem' }}>План: {item.quantity} шт</span></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ color: '#ef4444', fontWeight: 900, fontSize: '0.7rem' }}>БРАК:</span>
                      <input type="number" min="0" style={{ background: '#000', border: '1px solid #333', color: 'white', width: '70px', padding: '12px', borderRadius: '10px', textAlign: 'center', fontSize: '1.3rem', fontWeight: 900 }} value={scrapCounts[item.nomenclature_id] || 0} onChange={e => setScrapCounts({...scrapCounts, [item.nomenclature_id]: parseInt(e.target.value) || 0})} />
                    </div>
                  </div>
                )
              })}
              <button disabled={isProcessing} onClick={submitCompletion} style={{ background: '#3b82f6', color: 'white', border: 'none', width: '100%', padding: '20px', borderRadius: '14px', fontWeight: 900, fontSize: '1.2rem', marginTop: '15px', cursor: 'pointer' }}>ЗБЕРЕГТИ ТА ЗАВЕРШИТИ</button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .spin-slow { animation: spin 4s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }
        @media (max-width: 1024px) {
          .responsive-title { font-size: 1.8rem !important; }
          .timer-display { font-size: 4rem !important; }
        }
        @media (max-width: 768px) {
          .responsive-title { font-size: 1.4rem !important; }
          .timer-display { font-size: 3rem !important; }
        }
        .tasks-scroll::-webkit-scrollbar { width: 3px; }
        .tasks-scroll::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      `}} />
    </div>
  )
}

export default OperatorTerminal
