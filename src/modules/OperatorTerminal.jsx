import React, { useState, useEffect, useRef } from 'react'
import { 
  Tablet, 
  ArrowLeft, 
  Play, 
  CheckCircle, 
  Scan, 
  Timer,
  Layout,
  AlertTriangle,
  X,
  ClipboardList,
  Clock,
  Camera,
  RotateCcw,
  Fingerprint
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'

const OperatorTerminal = () => {
  const { workCards, tasks, orders, nomenclatures, startWorkCard, completeWorkCard } = useMES()
  const [selectedCardId, setSelectedCardId] = useState(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isProcessing, setIsProcessing] = useState(false)
  
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
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // QR SCANNER LOGIC
  useEffect(() => {
    if (isScanning && window.Html5Qrcode) {
      const html5QrCode = new window.Html5Qrcode("reader");
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };

      html5QrCode.start(
        { facingMode: "environment" }, 
        config, 
        (decodedText) => {
          if (decodedText.startsWith("CENTRUM_CARD_")) {
            const cardId = decodedText.replace("CENTRUM_CARD_", "")
            const foundCard = workCards.find(c => String(c.id) === String(cardId))
            if (foundCard) {
              setSelectedCardId(foundCard.id)
              html5QrCode.stop().then(() => setIsScanning(false)).catch(() => setIsScanning(false))
            } else {
              alert("Картку не знайдено в базі")
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
          html5QrCode.stop().catch(() => {});
        }
      }
    }
  }, [isScanning, workCards])

  const currentCard = workCards.find(c => c.id === selectedCardId)
  const getTaskOrder = (orderId) => orders.find(o => o.id === orderId)
  const getNomFromCard = (card) => {
     if (!card) return null
     if (card.nomenclature_id) return nomenclatures.find(n => n.id === card.nomenclature_id)
     const metaId = card.card_info?.match(/NOM_ID:(\d+)/)?.[1]
     return nomenclatures.find(n => String(n.id) === String(metaId))
  }

  const availableCards = workCards.filter(c => c.status !== 'completed')

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

  return (
    <div className="operator-terminal-v2" style={{ background: '#0a0a0a', height: '100vh', display: 'flex', flexDirection: 'column', color: '#fff', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>
      <header className="terminal-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', height: '70px', background: '#000', borderBottom: '2px solid #eab308', flexShrink: 0 }}>
        <Link to="/" style={{ color: '#94a3b8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.85rem' }}>
          <ArrowLeft size={18} /> <span className="hide-mobile">Вихід</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Tablet size={20} color="#eab308" />
          <h1 style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '0.1em', margin: 0 }} className="hide-mobile">ТЕРМІНАЛ ОПЕРАТОРА</h1>
        </div>
        <div style={{ fontWeight: 900, fontFamily: 'monospace', fontSize: '1.2rem', color: '#eab308' }}>{currentTime.toLocaleTimeString()}</div>
      </header>

      <div className="main-layout-responsive">
        {/* Left Side: Cards Queue */}
        <div className="side-panel" style={{ background: '#121212', borderRight: '1px solid #222', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800, color: '#555', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ClipboardList size={16} /> <span className="hide-mobile">Черга карт</span>
          </div>
          <div className="tasks-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 15px 25px' }}>
            {availableCards.map(card => {
              const nom = getNomFromCard(card)
              const isActive = selectedCardId === card.id
              const loadInfo = card.card_info?.split('|')?.pop()?.trim() || ''
              
              return (
                <div key={card.id} onClick={() => setSelectedCardId(card.id)} style={{ background: isActive ? '#eab308' : '#1a1a1a', borderRadius: '12px', padding: '15px', marginBottom: '10px', cursor: 'pointer', border: '1px solid', borderColor: isActive ? '#eab308' : '#333', transition: '0.2s', color: isActive ? '#000' : '#fff' }}>
                  <div style={{ marginBottom: '4px' }}>
                    <strong style={{ display: 'block', fontSize: '0.9rem', fontWeight: 800 }}>{nom?.name || 'Без назви'}</strong>
                    <div style={{ fontSize: '0.65rem', opacity: 0.7 }} className="hide-mobile">{card.operation} {loadInfo && `| ${loadInfo}`}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                     <span style={{ fontSize: '0.6rem', background: isActive ? 'rgba(0,0,0,0.2)' : 'rgba(234, 179, 8, 0.1)', color: isActive ? '#000' : '#eab308', padding: '2px 6px', borderRadius: '4px', fontWeight: 900 }}>{card.status === 'in-progress' ? 'У РОБОТІ' : 'ОЧІКУЄ'}</span>
                     <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>{card.estimated_time} хв</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Side: Workspace */}
        <div className="content-panel" style={{ padding: '20px', background: '#0a0a0a', overflowY: 'auto', position: 'relative' }}>
          {currentCard ? (
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' }}>
                <div>
                  <span style={{ color: '#3b82f6', fontWeight: 800, fontSize: '0.7rem', display: 'block', marginBottom: '8px' }}>АКТИВНА КАРТКА</span>
                  <h2 style={{ fontSize: '2.5rem', margin: 0, fontWeight: 900 }} className="responsive-title">{getNomFromCard(currentCard)?.name}</h2>
                </div>
                <div style={{ background: '#3b82f6', color: 'white', padding: '12px 25px', borderRadius: '16px', fontWeight: 900, fontSize: '0.9rem' }}>
                  {currentCard.operation.toUpperCase()}
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '32px', border: '1px solid #222', padding: '40px', textAlign: 'center' }}>
                {currentCard.status === 'pending' || currentCard.status === 'waiting' ? (
                  <>
                     <div style={{ background: '#111', padding: '30px', borderRadius: '24px', marginBottom: '40px' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>К-сть деталей: <span style={{ color: '#eab308' }}>{getTaskOrder(currentCard.order_id)?.order_items?.find(i => i.nomenclature_id === currentCard.nomenclature_id || currentCard.card_info?.includes(`NOM_ID:${i.nomenclature_id}`))?.quantity || '—'}</span> шт.</div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', marginTop: '30px' }}>
                           <div><div style={{ color: '#444', fontSize: '0.7rem', fontWeight: 800 }}>НОРМА</div><div style={{ fontSize: '1.8rem', fontWeight: 900 }}>{currentCard.estimated_time} хв</div></div>
                           <div><div style={{ color: '#444', fontSize: '0.7rem', fontWeight: 800 }}>СТАНОК</div><div style={{ fontSize: '1.8rem', fontWeight: 900 }}>{currentCard.machine}</div></div>
                        </div>
                     </div>
                     <button onClick={handleStartOperation} className="btn-action" style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '25px 60px', borderRadius: '20px', fontSize: '1.5rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '20px', margin: '0 auto' }}>
                        <Play fill="currentColor" size={28} /> РОЗПОЧАТИ
                     </button>
                  </>
                ) : (
                  <>
                    <div className="timer-display" style={{ fontSize: '6rem', fontWeight: 900, color: '#3b82f6', fontFamily: 'monospace', margin: '40px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '30px' }}>
                      <Timer className="spin-slow" size={70} />
                      <span>{formatElapsedTime(currentCard.started_at)}</span>
                    </div>
                    <button onClick={handleCompleteClick} className="btn-action" style={{ background: '#10b981', color: '#fff', border: 'none', padding: '25px 80px', borderRadius: '20px', fontSize: '1.5rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '20px', margin: '0 auto' }}>
                       <CheckCircle size={32} /> ЗАВЕРШИТИ
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
               <div style={{ width: '150px', height: '150px', borderRadius: '50%', background: 'rgba(234, 179, 8, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '30px', border: '2px dashed #333' }}>
                  <Scan size={80} color="#333" />
               </div>
               <h3 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '15px' }}>ГОТОВИЙ ДО СКАНУВАННЯ</h3>
               <p style={{ color: '#555', fontSize: '1.1rem', maxWidth: '400px' }}>Скануйте QR-код робочої карти для початку операції</p>
               <button onClick={() => setIsScanning(true)} style={{ marginTop: '40px', background: '#eab308', color: '#000', border: 'none', padding: '20px 50px', borderRadius: '16px', fontSize: '1.2rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <Camera size={24} /> ВІДКРИТИ СКАНЕР
               </button>
            </div>
          )}
        </div>
      </div>

      {/* SCANNER MODAL */}
      {isScanning && (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <button onClick={() => setIsScanning(false)} style={{ position: 'absolute', top: 30, right: 30, background: '#1a1a1a', border: 'none', color: '#fff', padding: '15px', borderRadius: '50%', cursor: 'pointer' }}><X size={32} /></button>
          <div style={{ width: '100%', maxWidth: '500px', position: 'relative' }}>
             <div id="reader" style={{ background: '#111', borderRadius: '32px', overflow: 'hidden' }}></div>
             <div style={{ position: 'absolute', inset: 0, border: '4px solid #eab308', borderRadius: '32px', pointerEvents: 'none', animation: 'pulse 2s infinite' }}></div>
          </div>
        </div>
      )}

      {/* PIN MODAL (High-Standard Numpad) */}
      {showPinModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.98)', backdropFilter: 'blur(20px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
           <div style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
              <div style={{ marginBottom: '30px' }}><Fingerprint size={50} color="#3b82f6" style={{ marginBottom: '15px' }} /><h3 style={{ fontSize: '2rem', fontWeight: 900, margin: 0 }}>CODE: 555</h3><p style={{ color: '#555' }}>Введіть ПІН-код для авторизації</p></div>
              <div style={{ background: '#111', padding: '15px', borderRadius: '24px', fontSize: '3rem', fontWeight: 900, letterSpacing: '0.4em', height: '90px', marginBottom: '30px', border: `2px solid ${pinError ? '#ef4444' : '#222'}`, color: pinError ? '#ef4444' : '#fff' }}>{pin.split('').map(() => '*').join('')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                 {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => <button key={num} onClick={() => pin.length < 6 && setPin(pin + num)} style={{ background: '#1a1a1a', border: '1px solid #333', color: '#fff', fontSize: '2rem', fontWeight: 900, padding: '25px', borderRadius: '20px', cursor: 'pointer' }}>{num}</button>)}
                 <button onClick={() => setPin('')} style={{ background: '#1a1a1a', border: '1px solid #333', color: '#ef4444', fontSize: '2rem', fontWeight: 900, borderRadius: '20px' }}>C</button>
                 <button onClick={() => pin.length < 6 && setPin(pin + '0')} style={{ background: '#1a1a1a', border: '1px solid #333', color: '#fff', fontSize: '2rem', fontWeight: 900, borderRadius: '20px' }}>0</button>
                 <button onClick={validatePin} style={{ background: '#3b82f6', border: 'none', color: '#fff', fontSize: '1.2rem', fontWeight: 900, borderRadius: '20px' }}>OK</button>
              </div>
              <button onClick={() => setShowPinModal(false)} style={{ marginTop: '30px', background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontWeight: 700 }}>СКУСУВАТИ</button>
           </div>
        </div>
      )}

      {/* SCRAP MODAL */}
      {showScrapModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(15px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#111', width: '100%', maxWidth: '600px', borderRadius: '32px', border: '1px solid #333', overflow: 'hidden' }}>
            <div style={{ padding: '30px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '15px', margin: 0, fontSize: '1.5rem' }}><AlertTriangle color="#ef4444" size={28} /> Звіт за зміну</h3>
              <button onClick={() => setShowScrapModal(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            <div style={{ padding: '30px', maxHeight: '60vh', overflowY: 'auto' }}>
              {getTaskOrder(currentCard?.order_id)?.order_items?.map(item => {
                const nom = nomenclatures.find(n => n.id === item.nomenclature_id) || nomenclatures.find(n => currentCard.card_info?.includes(`NOM_ID:${n.id}`))
                return (
                  <div key={item.id} style={{ background: '#0a0a0a', padding: '20px', borderRadius: '20px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #1a1a1a' }}>
                    <div style={{ flex: 1 }}><strong style={{ display: 'block', fontSize: '1.2rem', marginBottom: '5px' }}>{nom?.name}</strong><span style={{ color: '#555', fontSize: '0.9rem' }}>План: {item.quantity} шт</span></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <span style={{ color: '#ef4444', fontWeight: 900, fontSize: '0.8rem' }}>БРАК:</span>
                      <input type="number" min="0" style={{ background: '#000', border: '1px solid #333', color: 'white', width: '80px', padding: '15px', borderRadius: '12px', textAlign: 'center', fontSize: '1.5rem', fontWeight: 900 }} value={scrapCounts[item.nomenclature_id] || 0} onChange={e => setScrapCounts({...scrapCounts, [item.nomenclature_id]: parseInt(e.target.value) || 0})} />
                    </div>
                  </div>
                )
              })}
              <button onClick={submitCompletion} style={{ background: '#3b82f6', color: 'white', border: 'none', width: '100%', padding: '25px', borderRadius: '16px', fontWeight: 900, fontSize: '1.3rem', marginTop: '20px', cursor: 'pointer' }}>ЗБЕРЕГТИ ТА ЗАВЕРШИТИ</button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .spin-slow { animation: spin 4s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }
        .responsive-title { transition: font-size 0.3s; }
        @media (max-width: 1024px) {
          .responsive-title { font-size: 2rem !important; }
          .timer-display { font-size: 4rem !important; }
        }
        @media (max-width: 768px) {
          .responsive-title { font-size: 1.5rem !important; }
          .timer-display { font-size: 3rem !important; }
          .btn-action { padding: 20px 40px !important; font-size: 1.2rem !important; }
        }
        .tasks-scroll::-webkit-scrollbar { width: 4px; }
        .tasks-scroll::-webkit-scrollbar-thumb { background: #222; border-radius: 10px; }
      `}} />
    </div>
  )
}

export default OperatorTerminal
