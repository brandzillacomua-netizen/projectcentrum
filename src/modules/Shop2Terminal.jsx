import React, { useState, useEffect } from 'react'
import {
  Tablet, ArrowLeft, Play, CheckCircle, Scan, Timer, AlertTriangle,
  X, ClipboardList, Camera, Menu, RefreshCw, Box, Layers, Gauge, Package
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'
import { supabase } from '../supabase'

const Shop2Terminal = () => {
  const { workCards, orders, nomenclatures, inventory, startWorkCard, confirmBuffer, fetchData, operators, workCardHistory, handoverToSGP } = useMES()
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
    try { const saved = localStorage.getItem('centrum_shop2_scanned'); return saved ? JSON.parse(saved) : [] }
    catch (e) { return [] }
  })

  const [isScanning, setIsScanning] = useState(false)
  const [showScrapModal, setShowScrapModal] = useState(false)
  const [scrapCounts, setScrapCounts] = useState({})
  const [detailStage, setDetailStage] = useState(null)
  const [detailTab, setDetailTab] = useState('work')
  const [showStorageExplorer, setShowStorageExplorer] = useState(false)
  const [activeExplorerTab, setActiveExplorerTab] = useState('semi')

  // Етапи лише для Цеху №2
  const shop2Stages = ['Пресування', 'Фарбування', 'Доопрацювання']

  useEffect(() => { localStorage.setItem('centrum_shop2_scanned', JSON.stringify(scannedCardIds)) }, [scannedCardIds])
  useEffect(() => { const timer = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(timer) }, [])
  
  // Скидаємо вибір етапу при зміні карти
  useEffect(() => {
    const card = workCards.find(c => String(c.id) === String(selectedCardId))
    if (card) setSelectedStage(card.operation || '')
  }, [selectedCardId])
  
  // ── РЕАЛЬНИЙ ЧАС (Підписка на зміни) ──────────────────────────
  useEffect(() => {
    const channel = supabase.channel('shop2-terminal-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_cards' }, () => {
         console.log('Realtime update: work_cards');
         if (typeof fetchData === 'function') fetchData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
         console.log('Realtime update: inventory');
         if (typeof fetchData === 'function') fetchData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchData])

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
        try {
          const qrData = JSON.parse(decodedText)
          if (qrData.type === 'work_card_shop2') {
             const cardIdStr = qrData.id
             await stopAndClose()
             let foundCard = workCards.find(c => String(c.id).trim() === String(cardIdStr).trim())
             if (!foundCard) {
               setIsSyncing(true)
               try { if (typeof fetchData === 'function') await fetchData() } catch (e) {}
               setIsSyncing(false)
               setScanError(`Картку №${cardIdStr} не знайдено в базі.`)
             } else {
               setScannedCardIds(prev => prev.includes(foundCard.id) ? prev : [...prev, foundCard.id])
               setSelectedCardId(foundCard.id)
               setScanError(null)
               window.scrollTo({ top: 0, behavior: 'smooth' })
             }
          } else {
             setScanError("Це не картка Цеху №2! Скануйте лише картки другого цеху.")
          }
        } catch(e) {
           setScanError("Невірний формат QR. Це точно картка Цеху №2?")
        }
      }).catch(err => { setScanError("Помилка камери: " + err); setIsScanning(false) })
    }
    return () => { if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop().catch(() => {}) }
  }, [isScanning, workCards])

  const currentCard = workCards.find(c => String(c.id) === String(selectedCardId))

  const getNomFromCard = (card) => {
    if (!card) return null
    const nom = nomenclatures.find(n => String(n.id) === String(card.nomenclature_id))
    if (nom) return nom
    
    // Heuristic Fallback for corrupted cards (previous Number(id) bug)
    // 1. Try to find by quantity and task/order from card_info
    const info = card.card_info || ''
    const orderNumMatch = info.match(/Наряд №(\d+)/)
    const orderNum = orderNumMatch ? orderNumMatch[1] : null
    
    if (orderNum) {
      const order = orders.find(o => String(o.order_num) === String(orderNum) || String(o.id) === String(orderNum))
      if (order?.order_items) {
        // Find item with same quantity
        const match = order.order_items.find(it => Number(it.quantity) === Number(card.quantity))
        if (match) return nomenclatures.find(n => String(n.id) === String(match.nomenclature_id))
      }
    }
    
    return null
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

  const matchesStage = (cardOp, stageName) => {
    const op = (cardOp || '').toLowerCase()
    const sk = (stageName || '').toLowerCase()
    return op === sk || op.includes(sk) || sk.includes(op)
  }

  // Тільки картки Цеху №2
  const queuedCards = workCards.filter(c =>
    c.card_info?.includes('[ЦЕХ №2]') &&
    (c.status === 'new' || c.status === 'at-buffer' || scannedCardIds.some(sid => String(sid) === String(c.id))) &&
    c.status !== 'in-progress' && c.status !== 'waiting-buffer' && c.status !== 'completed'
  )

  const handleStartOperation = async () => {
    if (!currentCard || !selectedOperator) return
    const stage = selectedStage || currentCard.operation
    setIsProcessing(true)
    try {
      await apiService.submitOperatorAction('start', currentCard.task_id, currentCard.id, selectedOperator, { stage_name: stage, machine_name: selectedMachine }, startWorkCard)
      if (!scannedCardIds.includes(currentCard.id)) setScannedCardIds(prev => [...prev, currentCard.id])
    } catch (e) { alert('Помилка при старті: ' + e.message) }
    finally { setIsProcessing(false) }
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
      fetchData() // Refresh history for local stats
    } catch (e) { alert('Помилка при завершенні: ' + e.message) }
    finally { setIsProcessing(false) }
  }

  const SpecCard = ({ icon: Icon, label, value, color = "#8b5cf6" }) => (
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
        <div style={{ textAlign: 'center', padding: '40px 10px', color: '#444', fontSize: '0.8rem' }}>Немає карток в черзі для Цеху №2. Відскануйте першу...</div>
      )}
      {queuedCards.map(card => {
        const nom = getNomFromCard(card)
        const isActive = String(selectedCardId) === String(card.id)
        return (
          <div key={card.id} onClick={() => { setSelectedCardId(card.id); setIsDrawerOpen(false); setScanError(null); }} style={{ background: isActive ? '#8b5cf6' : '#1a1a1a', borderRadius: '12px', padding: '15px', marginBottom: '10px', cursor: 'pointer', border: '1px solid', borderColor: isActive ? '#8b5cf6' : '#333', transition: '0.2s', color: isActive ? '#fff' : '#fff' }}>
            <div style={{ marginBottom: '4px' }}>
              <strong style={{ display: 'block', fontSize: '0.9rem', fontWeight: 800 }}>{nom?.name || 'Без назви'}</strong>
              <div style={{ fontSize: '0.65rem', opacity: 0.7 }}>{card.quantity} шт | Етап: {card.status === 'at-buffer' ? `Буфер ${card.operation?.toLowerCase()}` : (card.operation || '—')}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <span style={{ fontSize: '0.6rem', background: isActive ? 'rgba(0,0,0,0.2)' : 'rgba(139, 92, 246, 0.1)', color: isActive ? '#fff' : '#8b5cf6', padding: '2px 6px', borderRadius: '4px', fontWeight: 900, textTransform: 'uppercase' }}>ОЧІКУЄ</span>
              <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>{card.estimated_time || 0} хв</span>
            </div>
          </div>
        )
      })}
    </div>
  )

  const renderStorageExplorer = () => {
    const explorerTabs = [
      { id: 'semi', label: 'ДЕТАЛІ (ПОТРЕБА)', icon: <Package size={14} />, color: '#8b5cf6', type: 'semi_shop2' },
      { id: 'bz', label: 'ЗАПАС (БЗ)', icon: <Layers size={14} />, color: '#eab308', type: 'bz_shop2' }
    ]
    const filteredItems = (inventory || []).filter(i => {
      if (activeExplorerTab === 'bz') return i.type === 'bz_shop2'
      return i.type === 'semi_shop2'
    })

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #111', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#8b5cf620', padding: '8px', borderRadius: '10px' }}><Package size={20} color="#8b5cf6" /></div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 1000 }}>БУФЕР ЦЕХУ №2</h2>
              <div style={{ fontSize: '0.6rem', color: '#444', fontWeight: 800, textTransform: 'uppercase' }}>Надходження з дільниці розкрою</div>
            </div>
          </div>
          <button onClick={() => setShowStorageExplorer(false)} style={{ background: '#1a1a1a', border: 'none', color: '#fff', width: '40px', height: '40px', borderRadius: '12px', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', padding: '15px 20px', background: '#0d0d0d' }}>
          {explorerTabs.map(t => (
            <button key={t.id} onClick={() => setActiveExplorerTab(t.id)}
              style={{
                flex: 1, background: activeExplorerTab === t.id ? t.color : '#0a0a0a',
                color: activeExplorerTab === t.id ? '#000' : '#444', border: 'none',
                padding: '12px', borderRadius: '12px', fontWeight: 900, fontSize: '0.65rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'all 0.2s', cursor: 'pointer'
              }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
            {filteredItems.map(item => {
              const nom = nomenclatures.find(n => n.id === item.nomenclature_id)
              return (
                <div key={item.id} style={{ background: '#111', borderRadius: '18px', padding: '18px', border: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '2px', color: '#fff' }}>{nom?.name || item.name}</div>
                    <div style={{ fontSize: '0.6rem', color: '#555', fontWeight: 900 }}>{item.unit || 'шт'} | ОНОВЛЕНО: {new Date(item.updated_at).toLocaleDateString()}</div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: '60px' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 1000, color: explorerTabs.find(t=>t.id===activeExplorerTab).color }}>{item.total_qty}</div>
                    <div style={{ fontSize: '0.5rem', color: '#333', fontWeight: 900 }}>В НАЯВНОСТІ</div>
                  </div>
                </div>
              )
            })}
            {filteredItems.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', color: '#222' }}>
                <Package size={48} style={{ marginBottom: '15px', opacity: 0.1 }} />
                <div style={{ fontWeight: 800 }}>НЕМАЄ ДЕТАЛЕЙ В БУФЕРІ</div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderScrapModal = () => {
    if (!currentCard) return null
    const nom = getNomFromCard(currentCard)
    const currentScrap = scrapCounts[nom?.id] || 0

    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.96)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10020, padding: '20px' }}>
        <div style={{ background: '#111', width: '100%', maxWidth: '500px', borderRadius: '32px', border: '1px solid #333', overflow: 'hidden' }}>
          <div style={{ padding: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1a1a' }}>
            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 950 }}>ЗАВЕРШЕННЯ ЕТАПУ (ЦЕХ №2)</h3>
            <button onClick={() => setShowScrapModal(false)} style={{ background: 'transparent', border: 'none', color: '#555' }}><X size={26} /></button>
          </div>
          <div style={{ padding: '30px', textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: '1.4rem' }}>{nom?.name || 'Деталь'}</h2>
            <div style={{ background: '#000', padding: '25px', borderRadius: '24px' }}>
              <label style={{ color: '#ef4444', fontWeight: 900, display: 'block', marginBottom: '15px', fontSize: '0.75rem' }}>КІЛЬКІСТЬ БРАКОВАНИХ ДЕТАЛЕЙ</label>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
                <button onClick={() => setScrapCounts(p => ({ ...p, [nom?.id]: Math.max(0, currentScrap - 1) }))} style={{ width: '60px', height: '60px', background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: '15px', fontSize: '1.5rem' }}>-</button>
                <input type="number" value={currentScrap} onChange={e => setScrapCounts(p => ({ ...p, [nom?.id]: parseInt(e.target.value) || 0 }))} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '3.5rem', width: '120px', textAlign: 'center', fontWeight: 900 }} />
                <button onClick={() => setScrapCounts(p => ({ ...p, [nom?.id]: currentScrap + 1 }))} style={{ width: '60px', height: '60px', background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: '15px', fontSize: '1.5rem' }}>+</button>
              </div>
            </div>
            <button disabled={isProcessing} onClick={handleFinalFinish} style={{ width: '100%', background: '#10b981', color: '#fff', border: 'none', padding: '20px', borderRadius: '18px', fontSize: '1.3rem', fontWeight: 900, marginTop: '30px', cursor: 'pointer', opacity: isProcessing ? 0.5 : 1 }}>ПІДТВЕРДИТИ</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="operator-terminal-shop2" style={{ background: '#0a0a0a', height: '100vh', display: 'flex', flexDirection: 'column', color: '#fff', overflow: 'hidden' }}>
      <header className="terminal-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', height: '70px', background: '#000', borderBottom: '2px solid #8b5cf6', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Link to="/" style={{ color: '#94a3b8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.85rem' }}>
            <ArrowLeft size={18} /> <span className="hide-mobile">На головну</span>
          </Link>
          <button onClick={() => setIsDrawerOpen(true)} className="burger-btn mobile-only" style={{ background: 'transparent', border: 'none', color: '#fff' }}><Menu size={24} /></button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Tablet size={20} color="#8b5cf6" />
          <h1 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }} className="hide-mobile">ТЕРМІНАЛ ЦЕХУ №2 (ОПЕРАТОР)</h1>
          <button 
            onClick={() => setShowStorageExplorer(true)}
            style={{ 
              background: '#8b5cf620', color: '#8b5cf6', border: '1px solid #8b5cf644', 
              padding: '6px 12px', borderRadius: '10px', fontSize: '0.65rem', 
              fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              marginLeft: '15px'
            }}
          >
            <Package size={14} /> БУФЕР
          </button>
        </div>
        <div style={{ fontWeight: 900, fontFamily: 'monospace', fontSize: '1.2rem', color: '#8b5cf6' }}>{currentTime.toLocaleTimeString()}</div>
      </header>

      <div className="main-layout-responsive" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div className="side-panel hide-mobile" style={{ width: '300px', background: '#121212', borderRight: '1px solid #222', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '20px', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800, color: '#555', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ClipboardList size={16} /> ЧЕРГА ЦЕХ №2 ({queuedCards.length})
          </div>
          {renderQueue()}
        </div>

        {isDrawerOpen && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000 }} onClick={() => setIsDrawerOpen(false)} />}
        <div style={{ position: 'fixed', left: isDrawerOpen ? 0 : '-300px', top: 0, bottom: 0, width: '300px', background: '#121212', zIndex: 1001, transition: '0.3s', display: 'flex', flexDirection: 'column' }}>
           <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>ОБЕРІТЬ КАРТУ</span>
              <X size={20} onClick={() => setIsDrawerOpen(false)} style={{ cursor: 'pointer' }} />
           </div>
           {renderQueue()}
        </div>

        <div className="content-panel" style={{ flex: 1, padding: '20px 15px', background: '#0a0a0a', overflowY: 'auto', position: 'relative' }}>
          
          {scanError && (
             <div style={{ background: '#ef444422', border: '1px solid #ef444455', color: '#ef4444', padding: '15px', borderRadius: '15px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 800, fontSize: '0.8rem' }}>{scanError}</span>
                <X size={18} style={{ cursor: 'pointer' }} onClick={() => setScanError(null)} />
             </div>
          )}

          {currentCard ? (
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
              <div style={{ marginBottom: '35px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    {currentCard.status === 'new' && (
                      <div style={{ background: '#8b5cf6', color: 'white', padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 900 }}>НОВА КАРТА ЦЕХ №2</div>
                    )}
                    {currentCard.status === 'at-buffer' && (
                      <div style={{ background: '#eab308', color: 'white', padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 900 }}>ОЧІКУЄ ЕТАПУ</div>
                    )}
                    {currentCard.status === 'in-progress' && (
                      <div style={{ background: '#3b82f6', color: 'white', padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 900 }}>У РОБОТІ</div>
                    )}
                    <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 800 }}>
                      ЗАМОВЛЕННЯ №{orders?.find(o => o.id === currentCard.order_id)?.order_num || '—'} | КАРТКА #{currentCard.id.slice(0,8)}...
                    </div>
                  </div>
                  <h2 style={{ fontSize: '2.5rem', margin: 0, fontWeight: 950, letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {getNomFromCard(currentCard)?.name || (currentCard.card_info?.split('] ').pop() || `Картка #${currentCard.id.slice(0,8)}`)}
                  </h2>
                </div>
                <button onClick={() => setSelectedCardId(null)} style={{ background: '#111', border: 'none', color: '#555', padding: '10px', borderRadius: '12px', cursor: 'pointer' }}><X size={24} /></button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '30px' }}>
                <SpecCard icon={ClipboardList} label="Замовлення" value={`№${orders?.find(o => o.id === currentCard.order_id)?.order_num || '—'}`} color="#f43f5e" />
                <SpecCard icon={Layers} label="Матеріал" value={getNomFromCard(currentCard)?.material_type || '—'} color="#10b981" />
                <SpecCard 
                  icon={Box} 
                  label="Кількість" 
                  value={((() => {
                    const need = currentCard.card_info?.match(/\[NEED:(\d+)\]/)?.[1]
                    const bz = currentCard.card_info?.match(/\[BZ:(\d+)\]/)?.[1] || currentCard.buffer_qty
                    if (need && bz) return `${currentCard.quantity} шт (${need}+${bz} БЗ)`
                    return `${currentCard.quantity} шт`
                  }))()} 
                  color="#3b82f6" 
                />
                <SpecCard icon={Gauge} label="Етап" value={currentCard.status === 'at-buffer' ? `Буфер ${currentCard.operation?.toLowerCase()}` : (currentCard.operation || '—')} />
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '28px', border: '1px solid #1a1a1a', padding: '40px' }}>
                {(currentCard.status === 'new' || currentCard.status === 'at-buffer') ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', maxWidth: '500px', margin: '0 auto' }}>
                    <div>
                      <label style={{ color: '#555', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>Поточний етап (ЦЕХ №2)</label>
                      <select value={selectedStage || currentCard.operation} onChange={(e) => setSelectedStage(e.target.value)} style={{ width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '15px', borderRadius: '15px', fontSize: '1.1rem', fontWeight: 700 }}>
                        {shop2Stages.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ color: '#555', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>Відповідальний оператор</label>
                      <select value={selectedOperator} onChange={(e) => setSelectedOperator(e.target.value)} style={{ width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '15px', borderRadius: '15px', fontSize: '1.1rem', fontWeight: 700 }}>
                        <option value="">— Оберіть себе —</option>
                        {operators.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <button disabled={isProcessing || !selectedOperator} onClick={handleStartOperation} style={{ background: '#8b5cf6', color: '#fff', border: 'none', padding: '22px', borderRadius: '18px', fontSize: '1.4rem', fontWeight: 900, cursor: 'pointer', transition: '0.2s', opacity: (isProcessing || !selectedOperator) ? 0.3 : 1 }}>ВЗЯТИ В РОБОТУ</button>
                    {currentCard.status === 'at-buffer' && (
                      <button 
                        onClick={() => {
                          handoverToSGP(currentCard.id)
                          setSelectedCardId(null)
                        }}
                        style={{ background: '#f43f5e', color: '#fff', border: 'none', padding: '15px', borderRadius: '18px', fontSize: '1rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      >
                        <Package size={18} /> ПЕРЕДАТИ НА СКЛАД СГП
                      </button>
                    )}
                    <div style={{ textAlign: 'center', fontSize: '0.7rem', color: '#444', fontWeight: 700 }}>Робоча картка автоматично збережеться в базу</div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#8b5cf6', fontSize: '0.75rem', fontWeight: 800, marginBottom: '20px' }}>ЧАС В РОБОТІ</div>
                    <div style={{ fontSize: '6.5rem', fontWeight: 1000, color: '#fff', fontFamily: 'monospace', letterSpacing: '-2px' }}>{formatElapsedTime(currentCard.started_at)}</div>
                    <div style={{ color: '#555', marginBottom: '30px', fontWeight: 800 }}>ОПЕРАТОР: {currentCard.operator_name}</div>
                    <button onClick={submitCompletion} style={{ background: '#ec4899', color: '#fff', border: 'none', padding: '22px 70px', borderRadius: '18px', fontSize: '1.4rem', fontWeight: 900, cursor: 'pointer', boxShadow: '0 10px 40px rgba(236, 72, 153, 0.3)' }}>ЗАВЕРШИТИ ЕТАП</button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 950 }}>МОНІТОРИНГ ЦЕХУ №2</h2>
                <button onClick={() => setIsScanning(true)} style={{ background: '#8b5cf6', border: 'none', color: '#fff', padding: '15px 30px', borderRadius: '15px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}><Camera size={20} /> СКАНУВАТИ QR</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', marginBottom: '50px' }}>
                {/* ───── КАРТКА ВХІДНОГО БУФЕРА ───── */}
                {(() => {
                  const totalIncoming = (inventory || [])
                    .filter(i => i.type === 'semi_shop2' || i.type === 'bz_shop2')
                    .reduce((a, i) => a + (Number(i.total_qty) || 0), 0)
                  
                  const totalTaken = workCards
                    .filter(c => c.card_info?.includes('[ЦЕХ №2]') && (c.status === 'in-progress' || c.status === 'at-buffer' || c.status === 'waiting-buffer'))
                    .reduce((a, c) => a + (c.quantity || 0), 0)
                  
                  const bufferQty = Math.max(0, totalIncoming - totalTaken)

                  return (
                    <div onClick={() => setShowStorageExplorer(true)} style={{ background: '#111', border: '1px solid #8b5cf644', borderRadius: '24px', padding: '20px', cursor: 'pointer', transition: '0.3s', boxShadow: '0 10px 30px -10px rgba(139, 92, 246, 0.2)' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                          <span style={{ color: '#8b5cf6', fontSize: '0.7rem', fontWeight: 950, textTransform: 'uppercase' }}>ВХІДНИЙ БУФЕР</span>
                          <Package size={14} color="#8b5cf6" />
                       </div>
                       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', alignItems: 'flex-end', width: '100%' }}>
                          <div>
                            <div style={{ fontSize: '0.6rem', color: '#8b5cf6', fontWeight: 800 }}>ПРИЙНЯТО</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 1000, color: '#fff', lineHeight: 1 }}>{bufferQty}</div>
                          </div>
                          <div style={{ borderLeft: '1px solid #222', paddingLeft: '8px', gridColumn: 'span 2' }}>
                            <div style={{ fontSize: '0.55rem', color: '#555', fontWeight: 800 }}>ДЕТАЛЕЙ ОЧІКУЄ</div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#444', marginTop: '4px' }}>На складі дільниці</div>
                          </div>
                       </div>
                    </div>
                  )
                })()}

                {shop2Stages.map(stage => {
                  const stageCards = workCards.filter(c => c.card_info?.includes('[ЦЕХ №2]') && matchesStage(c.operation, stage))
                  const workQty = stageCards.filter(c => c.status === 'in-progress').reduce((acc, c) => acc + (c.quantity || 0), 0)
                  const bufferQty = stageCards.filter(c => ['at-buffer', 'waiting-buffer'].includes(c.status)).reduce((acc, c) => acc + (c.quantity || 0), 0)
                  const scrapQty = workCardHistory.filter(h => h.card_info?.includes('[ЦЕХ №2]') && matchesStage(h.stage_name, stage)).reduce((acc, h) => acc + (Number(h.scrap_qty) || 0), 0)
                  
                  return (
                    <div key={stage} onClick={() => setDetailStage(stage)} style={{ background: '#111', border: '1px solid #222', borderRadius: '24px', padding: '20px', cursor: 'pointer', transition: '0.3s' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                          <span style={{ color: '#555', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase' }}>{stage}</span>
                          <Layers size={14} color="#8b5cf6" />
                       </div>
                       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', alignItems: 'flex-end', width: '100%' }}>
                          <div>
                            <div style={{ fontSize: '0.6rem', color: '#3b82f6', fontWeight: 800 }}>В РОБОТІ</div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 950, color: workQty > 0 ? '#fff' : '#222' }}>{workQty}</div>
                          </div>
                          <div style={{ borderLeft: '1px solid #222', paddingLeft: '8px' }}>
                            <div style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 800 }}>БУФЕР</div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 950, color: bufferQty > 0 ? '#10b981' : '#222' }}>{bufferQty}</div>
                          </div>
                          <div style={{ borderLeft: '1px solid #222', paddingLeft: '8px' }}>
                            <div style={{ fontSize: '0.6rem', color: '#ef4444', fontWeight: 800 }}>БРАК</div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 950, color: scrapQty > 0 ? '#ef4444' : '#222' }}>{scrapQty}</div>
                          </div>
                       </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ background: '#111', borderRadius: '24px', border: '1px solid #222', overflow: 'hidden' }}>
                <div style={{ padding: '25px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900 }}>ДЕТАЛІ В ПРОЦЕСІ (ЦЕХ №2)</h3>
                   {isSyncing && <RefreshCw className="animate-spin" size={16} color="#8b5cf6" />}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ background: '#0a0a0a', fontSize: '0.65rem', fontWeight: 900, color: '#555', textTransform: 'uppercase' }}>
                    <tr><th style={{ padding: '15px 25px' }}>ДЕТАЛЬ</th><th style={{ padding: '15px 25px' }}>ЕТАП</th><th style={{ padding: '15px 25px' }}>К-СТЬ</th><th style={{ padding: '15px 25px' }}>ОПЕРАТОР</th><th style={{ padding: '15px 25px' }}>ЧАС</th><th style={{ padding: '15px 25px' }}></th></tr>
                  </thead>
                  <tbody>
                    {workCards.filter(c => c.card_info?.includes('[ЦЕХ №2]') && (c.status === 'in-progress' || c.status === 'at-buffer')).map(card => (
                      <tr key={card.id} style={{ borderBottom: '1px solid #1a1a1a', fontSize: '0.85rem' }}>
                        <td style={{ padding: '15px 25px', fontWeight: 800 }}>
                          {getNomFromCard(card)?.name || (card.card_info?.split('] ').pop() || `Картка #${card.id.slice(0,8)}`)}
                        </td>
                        <td style={{ padding: '15px 25px' }}><span style={{ color: card.status === 'at-buffer' ? '#10b981' : '#8b5cf6', fontWeight: 900, fontSize: '0.7rem' }}>{card.operation?.toUpperCase()}</span></td>
                        <td style={{ padding: '15px 25px', fontWeight: 900 }}>{card.quantity} шт</td>
                        <td style={{ padding: '15px 25px', color: '#aaa' }}>{card.operator_name || '—'}</td>
                        <td style={{ padding: '15px 25px', color: '#10b981' }}>{formatElapsedTime(card.started_at)}</td>
                        <td style={{ padding: '15px 25px', textAlign: 'right' }}><button onClick={() => setSelectedCardId(card.id)} style={{ background: '#222', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.7rem' }}>ВІДКРИТИ</button></td>
                      </tr>
                    ))}
                    {workCards.filter(c => c.card_info?.includes('[ЦЕХ №2]') && (c.status === 'in-progress' || c.status === 'at-buffer')).length === 0 && (
                       <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#333', fontSize: '0.8rem' }}>Немає активних процесів у другому цеху</td></tr>
                    )}
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
          <div style={{ width: '90%', maxWidth: '500px', border: '4px solid #8b5cf6', borderRadius: '32px', overflow: 'hidden' }} id="reader"></div>
          <div style={{ marginTop: '20px', color: '#555', fontWeight: 700 }}>Тримайте код в центрі рамки</div>
        </div>
      )}

      {renderScrapModal && currentCard && showScrapModal && renderScrapModal()}
      {showStorageExplorer && renderStorageExplorer()}
      {detailStage && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 10030, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
           <div style={{ width: '100%', maxWidth: '700px', background: '#111', borderRadius: '32px', border: '1px solid #333', overflow: 'hidden' }}>
              <div style={{ padding: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1a1a' }}>
                 <h2 style={{ margin: 0, color: '#8b5cf6', fontSize: '1.2rem', fontWeight: 950 }}>{detailStage.toUpperCase()}</h2>
                 <button onClick={() => setDetailStage(null)} style={{ background: '#222', border: 'none', color: '#fff', padding: '10px', borderRadius: '10px' }}><X size={20} /></button>
              </div>
              <div style={{ display: 'flex', padding: '15px', gap: '10px' }}>
                 <button onClick={() => setDetailTab('work')} style={{ flex: 1, padding: '15px', borderRadius: '15px', border: 'none', background: detailTab === 'work' ? '#8b5cf6' : '#222', color: '#fff', fontWeight: 900 }}>В РОБОТІ</button>
                 <button onClick={() => setDetailTab('buffer')} style={{ flex: 1, padding: '15px', borderRadius: '15px', border: 'none', background: detailTab === 'buffer' ? '#10b981' : '#222', color: '#fff', fontWeight: 900 }}>БУФЕР</button>
              </div>
              <div style={{ padding: '0 15px 25px', maxHeight: '450px', overflowY: 'auto' }}>
                 {(() => {
                    if (detailTab === 'buffer') {
                      const bufferCards = workCards.filter(c => c.card_info?.includes('[ЦЕХ №2]') && matchesStage(c.operation, detailStage) && c.status === 'at-buffer');
                      if (bufferCards.length === 0) return <div style={{ textAlign: 'center', padding: '50px', color: '#444', fontSize: '0.85rem' }}>Буфер пустий</div>;
                      
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {bufferCards.map((c) => {
                            const nom = getNomFromCard(c);
                            return (
                              <div key={c.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '15px 20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #1a1a1a' }}>
                                <div>
                                  <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{nom?.name || 'Деталь'}</div>
                                  <div style={{ fontSize: '0.65rem', color: '#555', marginTop: '4px' }}>Картка №{c.id.slice(0,6)}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                  <div style={{ fontWeight: 1000, fontSize: '1.3rem', color: '#10b981' }}>{c.quantity} <small style={{ fontSize: '0.6rem', opacity: 0.3 }}>шт</small></div>
                                  <button onClick={() => handoverToSGP(c.id)} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 900, cursor: 'pointer' }}>ВІДПРАВИТИ НА СГП</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    } else {
                      const agg = {};
                      workCards.filter(c => c.card_info?.includes('[ЦЕХ №2]') && matchesStage(c.operation, detailStage) && c.status === 'in-progress').forEach(c => {
                         const nom = getNomFromCard(c);
                         const name = nom?.name || 'Деталь';
                         agg[name] = (agg[name] || 0) + (c.quantity || 0);
                      });
                      const items = Object.entries(agg);
                      if (items.length === 0) return <div style={{ textAlign: 'center', padding: '50px', color: '#444', fontSize: '0.85rem' }}>Дані відсутні</div>;
                      return (
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {items.map(([name, qty], idx) => (
                               <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '15px 20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #1a1a1a' }}>
                                  <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{name}</div>
                                  <div style={{ fontWeight: 1000, fontSize: '1.3rem', color: '#8b5cf6' }}>{qty} <small style={{ fontSize: '0.6rem', opacity: 0.3 }}>шт</small></div>
                               </div>
                            ))}
                         </div>
                      );
                    }
                 })()}
              </div>
           </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #222; borderRadius: 3px; }
      `}} />
    </div>
  )
}
export default Shop2Terminal
