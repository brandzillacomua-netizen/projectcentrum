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
  const scannerRef = useRef(null)

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
          // Success: CENTRUM_CARD_123
          console.log("Scanned:", decodedText)
          if (decodedText.startsWith("CENTRUM_CARD_")) {
            const cardId = decodedText.replace("CENTRUM_CARD_", "")
            const foundCard = workCards.find(c => String(c.id) === String(cardId))
            if (foundCard) {
              setSelectedCardId(foundCard.id)
              stopScanner(html5QrCode)
            } else {
              alert("Картку не знайдено в базі")
            }
          }
        },
        (errorMessage) => { /* ignore */ }
      ).catch(err => {
        console.error("Scanner Error:", err)
        alert("Не вдалося запустити камеру: " + err)
        setIsScanning(false)
      })

      return () => {
        if (html5QrCode.isScanning) {
          html5QrCode.stop().catch(() => {});
        }
      }
    }
  }, [isScanning, workCards])

  const stopScanner = (scannerInstance) => {
    if (scannerInstance) {
      scannerInstance.stop().then(() => {
        setIsScanning(false)
      })
    } else {
      setIsScanning(false)
    }
  }

  const currentCard = workCards.find(c => c.id === selectedCardId)
  const getTaskOrder = (orderId) => orders.find(o => o.id === orderId)
  const getNomFromCard = (card) => {
     if (card.nomenclature_id) return nomenclatures.find(n => n.id === card.nomenclature_id)
     // Fallback search in card_info metadata
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

  const formatDuration = (totalMinutes) => {
    if (!totalMinutes || isNaN(totalMinutes)) return '0 хв'
    const hours = Math.floor(totalMinutes / 60)
    const minutes = Math.round(totalMinutes % 60)
    if (hours === 0) return `${minutes} хв`
    return `${hours} год ${minutes > 0 ? minutes + ' хв' : ''}`
  }

  return (
    <div className="operator-terminal-v2" style={{ background: '#0a0a0a', height: '100vh', display: 'flex', flexDirection: 'column', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
      <header className="terminal-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 30px', height: '70px', background: '#000', borderBottom: '2px solid #eab308' }}>
        <Link to="/" style={{ color: '#94a3b8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.9rem' }}>
          <ArrowLeft size={20} /> Вихід
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Tablet size={24} color="#eab308" />
          <h1 style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '0.1em', margin: 0 }}>ТЕРМІНАЛ ОПЕРАТОРА</h1>
        </div>
        <div style={{ fontWeight: 900, fontFamily: 'monospace', fontSize: '1.4rem', color: '#eab308' }}>{currentTime.toLocaleTimeString()}</div>
      </header>

      <div className="terminal-body" style={{ flex: 1, display: 'grid', gridTemplateColumns: '350px 1fr', overflow: 'hidden' }}>
        {/* Left Sidebar: Cards List */}
        <div className="task-panel" style={{ background: '#121212', borderRight: '1px solid #222', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '25px', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 800, color: '#555', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ClipboardList size={18} /> Черга карт
          </div>
          <div className="tasks-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 15px 25px' }}>
            {availableCards.map(card => {
              const nom = getNomFromCard(card)
              const isActive = selectedCardId === card.id
              const loadingInfo = card.card_info?.split('|')?.pop()?.trim() || ''
              
              return (
                <div key={card.id} onClick={() => setSelectedCardId(card.id)} style={{ background: isActive ? '#eab308' : '#1a1a1a', borderRadius: '16px', padding: '18px', marginBottom: '12px', cursor: 'pointer', border: '1px solid', borderColor: isActive ? '#eab308' : '#333', transition: '0.2s', color: isActive ? '#000' : '#fff' }}>
                  <div style={{ marginBottom: '5px' }}>
                    <strong style={{ display: 'block', fontSize: '1rem', fontWeight: 800 }}>{nom?.name || 'Без назви'}</strong>
                    <div style={{ fontSize: '0.7rem', opacity: 0.7, fontWeight: 700 }}>{card.operation} {loadingInfo && `— ${loadingInfo}`}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                     <span style={{ fontSize: '0.65rem', background: isActive ? 'rgba(0,0,0,0.2)' : 'rgba(234, 179, 8, 0.1)', color: isActive ? '#000' : '#eab308', padding: '3px 8px', borderRadius: '4px', fontWeight: 900 }}>{card.status === 'in-progress' ? 'У РОБОТІ' : 'ОЧІКУЄ'}</span>
                     <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>{card.estimated_time} хв</span>
                  </div>
                </div>
              )
            })}
            {availableCards.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: '#333' }}>Завдання відсутні</div>}
          </div>
        </div>

        {/* Right Content: Active Card Details */}
        <div className="workspace-panel" style={{ flex: 1, padding: '40px', background: '#0a0a0a', overflowY: 'auto', position: 'relative' }}>
          {currentCard ? (
            <div className="active-task-view" style={{ maxWidth: '900px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
                <div>
                  <span style={{ color: '#3b82f6', fontWeight: 800, fontSize: '0.8rem', letterSpacing: '0.2em', display: 'block', marginBottom: '12px' }}>АКТИВНА РОБОЧА КАРТКА</span>
                  <h2 style={{ fontSize: '3rem', margin: 0, fontWeight: 900 }}>{getNomFromCard(currentCard)?.name}</h2>
                  <div style={{ color: '#888', fontSize: '1.2rem', marginTop: '10px' }}>{getNomFromCard(currentCard)?.material_type}</div>
                </div>
                <div style={{ background: '#3b82f6', color: 'white', padding: '12px 25px', borderRadius: '16px', fontWeight: 900, boxShadow: '0 10px 20px rgba(59, 130, 246, 0.3)' }}>
                  {currentCard.operation.toUpperCase()}
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '32px', border: '1px solid #222', padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {currentCard.status === 'pending' || currentCard.status === 'waiting' ? (
                  <div style={{ width: '100%', textAlign: 'center' }}>
                     <div style={{ background: '#111', padding: '30px', borderRadius: '24px', marginBottom: '40px', border: '1px solid #222' }}>
                        <div style={{ color: '#555', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '20px' }}>Параметри завантаження:</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>
                           К-сть деталей: <span style={{ color: '#eab308' }}>
                            {getTaskOrder(currentCard.order_id)?.order_items?.find(i => i.nomenclature_id === currentCard.nomenclature_id || currentCard.card_info?.includes(`NOM_ID:${i.nomenclature_id}`))?.quantity || '—'}
                          </span>
                        </div>
                        <div style={{ fontSize: '1.2rem', color: '#888', marginTop: '10px' }}>{currentCard.card_info?.split('|')?.pop()}</div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', marginTop: '30px' }}>
                           <div>
                              <div style={{ color: '#444', fontSize: '0.7rem', fontWeight: 800 }}>НОРМА ЧАСУ</div>
                              <div style={{ fontSize: '1.8rem', fontWeight: 900 }}>{currentCard.estimated_time} хв</div>
                           </div>
                           <div style={{ width: '1px', background: '#222' }}></div>
                           <div>
                              <div style={{ color: '#444', fontSize: '0.7rem', fontWeight: 800 }}>СТАНОК</div>
                              <div style={{ fontSize: '1.8rem', fontWeight: 900 }}>{currentCard.machine}</div>
                           </div>
                        </div>
                     </div>

                    <button 
                       className="btn-start"
                       onClick={handleStartOperation}
                       style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '25px 60px', borderRadius: '20px', fontSize: '1.5rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '20px', boxShadow: '0 20px 40px rgba(59, 130, 246, 0.3)', transition: '0.2s' }}
                    >
                      <Play fill="currentColor" size={28} /> РОЗПОЧАТИ ОПЕРАЦІЮ
                    </button>
                  </div>
                ) : (
                  <div style={{ width: '100%', textAlign: 'center' }}>
                    <div style={{ fontSize: '6rem', fontWeight: 900, color: '#3b82f6', fontFamily: 'monospace', margin: '40px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '30px' }}>
                      <Timer className="spin-slow" size={80} />
                      <span>{formatElapsedTime(currentCard.started_at)}</span>
                    </div>
                    <button 
                      onClick={handleCompleteClick}
                      disabled={isProcessing}
                      style={{ background: '#10b981', color: '#fff', border: 'none', padding: '25px 80px', borderRadius: '20px', fontSize: '1.4rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 20px 40px rgba(16, 185, 129, 0.3)', margin: '0 auto' }}
                    >
                      {isProcessing ? 'ЗУПИНКА...' : <><CheckCircle size={28} /> ЗАВЕРШИТИ ОПЕРАЦІЮ</>}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
               <div style={{ width: '150px', height: '150px', borderRadius: '50%', background: 'rgba(234, 179, 8, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '30px', border: '2px dashed #333' }}>
                  <Scan size={70} color="#333" />
               </div>
               <h3 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '15px' }}>ГОТОВИЙ ДО СКАНУВАННЯ</h3>
               <p style={{ color: '#555', fontSize: '1.2rem', maxWidth: '500px', textAlign: 'center', lineHeight: 1.5 }}>Відскануйте QR-код на паперовій робочій картці або натисніть кнопку нижче, щоб відкрити камеру</p>
               
               <button 
                  onClick={() => setIsScanning(true)}
                  style={{ marginTop: '40px', background: '#eab308', color: '#000', border: 'none', padding: '20px 50px', borderRadius: '16px', fontSize: '1.2rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 10px 30px rgba(234, 179, 8, 0.2)' }}
               >
                  <Camera size={24} /> ВІДКРИТИ СКАНЕР КАМЕРИ
               </button>
            </div>
          )}
        </div>
      </div>

      {/* SCANNER MODAL */}
      {isScanning && (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zize: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', top: 30, right: 30, zIndex: 10 }}>
            <button onClick={() => setIsScanning(false)} style={{ background: '#1a1a1a', border: 'none', color: '#fff', padding: '15px', borderRadius: '50%', cursor: 'pointer' }}>
               <X size={32} />
            </button>
          </div>
          
          <div style={{ width: '80%', maxWidth: '500px', position: 'relative' }}>
             <div id="reader" style={{ background: '#111', borderRadius: '24px', overflow: 'hidden' }}></div>
             <div style={{ position: 'absolute', inset: 0, border: '2px solid #eab308', borderRadius: '24px', pointerEvents: 'none', animation: 'pulse 2s infinite' }}></div>
          </div>
          
          <div style={{ marginTop: '40px', textAlign: 'center' }}>
             <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>ОБ'ЄКТИВ КАМЕРИ АКТИВНИЙ</h3>
             <p style={{ color: '#555' }}>Піднесіть QR-код до вікна сканування</p>
          </div>
        </div>
      )}

      {/* PIN MODAL (Numpad) */}
      {showPinModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(15px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
           <div style={{ width: '400px', textAlign: 'center' }}>
              <div style={{ marginBottom: '30px' }}>
                 <div style={{ display: 'inline-flex', padding: '20px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '24px', marginBottom: '15px' }}>
                    <Fingerprint size={48} color="#3b82f6" />
                 </div>
                 <h3 style={{ fontSize: '1.8rem', fontWeight: 900, margin: 0 }}>ВВЕДІТЬ ПІН-КОД</h3>
                 <p style={{ color: '#555' }}>Авторизація для початку операції</p>
              </div>

              <div style={{ background: '#111', padding: '10px', borderRadius: '20px', fontSize: '2.5rem', fontWeight: 900, letterSpacing: '0.3em', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: pinError ? '#ef4444' : '#fff', border: `2px solid ${pinError ? '#ef4444' : '#222'}`, marginBottom: '30px' }}>
                 {pin.split('').map(() => '*').join('')}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                 {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                   <button key={num} onClick={() => pin.length < 6 && setPin(pin + num)} style={{ background: '#1a1a1a', border: '1px solid #333', color: '#fff', fontSize: '1.5rem', fontWeight: 800, padding: '25px', borderRadius: '16px', cursor: 'pointer' }}>{num}</button>
                 ))}
                 <button onClick={() => setPin('')} style={{ background: '#1a1a1a', border: '1px solid #333', color: '#ef4444', fontSize: '1.5rem', fontWeight: 800, padding: '25px', borderRadius: '16px', cursor: 'pointer' }}>C</button>
                 <button onClick={() => pin.length < 6 && setPin(pin + '0')} style={{ background: '#1a1a1a', border: '1px solid #333', color: '#fff', fontSize: '1.5rem', fontWeight: 800, padding: '25px', borderRadius: '16px', cursor: 'pointer' }}>0</button>
                 <button onClick={validatePin} style={{ background: '#3b82f6', border: 'none', color: '#fff', fontSize: '1rem', fontWeight: 900, padding: '25px', borderRadius: '16px', cursor: 'pointer' }}>OK</button>
              </div>
              
              <button onClick={() => setShowPinModal(false)} style={{ marginTop: '30px', background: 'transparent', border: 'none', color: '#555', cursor: 'pointer' }}>Скасувати</button>
           </div>
        </div>
      )}

      {/* SCRAP MODAL */}
      {showScrapModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#111', width: '100%', maxWidth: '600px', borderRadius: '24px', border: '1px solid #333', overflow: 'hidden' }}>
            <div style={{ padding: '25px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}><AlertTriangle color="#ef4444" /> Звіт про брак</h3>
              <button onClick={() => setShowScrapModal(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '25px' }}>
              {getTaskOrder(currentCard?.order_id)?.order_items?.map(item => {
                const nom = nomenclatures.find(n => n.id === item.nomenclature_id)
                return (
                  <div key={item.id} style={{ background: '#0a0a0a', padding: '20px', borderRadius: '16px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #1a1a1a' }}>
                    <div style={{ flex: 1 }}>
                      <strong style={{ display: 'block', fontSize: '1.1rem', marginBottom: '4px' }}>{nom?.name}</strong>
                      <span style={{ color: '#555', fontSize: '0.8rem' }}>Замовлено: {item.quantity} шт</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <label style={{ color: '#ef4444', fontWeight: 900, fontSize: '0.7rem' }}>БРАК:</label>
                      <input 
                        type="number"
                        min="0"
                        max={item.quantity}
                        style={{ background: '#000', border: '1px solid #333', color: 'white', width: '80px', padding: '12px', borderRadius: '10px', textAlign: 'center', fontSize: '1.2rem', fontWeight: 800 }}
                        value={scrapCounts[item.nomenclature_id] || 0}
                        onChange={e => {
                          const val = Math.min(item.quantity, Math.max(0, parseInt(e.target.value) || 0))
                          setScrapCounts({...scrapCounts, [item.nomenclature_id]: val})
                        }}
                      />
                    </div>
                  </div>
                )
              })}
              <button onClick={submitCompletion} disabled={isProcessing} style={{ background: '#3b82f6', color: 'white', border: 'none', width: '100%', padding: '20px', borderRadius: '12px', fontWeight: 800, fontSize: '1.1rem', marginTop: '15px', cursor: 'pointer' }}>
                {isProcessing ? 'ЗБЕРЕЖЕННЯ...' : 'ПІДТВЕРДИТИ ТА СКЛАДУВАТИ'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .spin-slow { animation: spin 4s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }
        .btn-start:hover { transform: scale(1.05); }
        .tasks-scroll::-webkit-scrollbar { width: 4px; }
        .tasks-scroll::-webkit-scrollbar-thumb { background: #222; border-radius: 10px; }
      `}} />
    </div>
  )
}

export default OperatorTerminal
