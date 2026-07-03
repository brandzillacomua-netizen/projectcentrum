import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Clock, AlertTriangle, Layers, Calendar, ChevronRight, CheckCircle, Play, Sparkles } from 'lucide-react'
import { useMES } from '../MESContext'
import { getCurrentTime } from '../supabase'

export default function TumblingDashboard() {
  const { workCards, nomenclatures, bomItems, orders, tasks, workCardHistory } = useMES()
  const [currentTime, setCurrentTime] = useState(getCurrentTime())

  // Toggle for full-screen or simulated display properties
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [autoScrollActive, setAutoScrollActive] = useState(true)

  // References for auto-scrolling columns
  const col1Ref = useRef(null)
  const col2Ref = useRef(null)
  const col3Ref = useRef(null)

  // Tick the clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(getCurrentTime()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Auto-scrolling effect for TV monitors (slowly scrolls when content overflows)
  useEffect(() => {
    if (!autoScrollActive) return

    const scrollInterval = setInterval(() => {
      [col2Ref, col3Ref].forEach(ref => {
        if (ref.current) {
          const el = ref.current
          if (el.scrollHeight > el.clientHeight) {
            // Scroll down by 1px
            el.scrollTop += 1
            // If we reached the bottom (with some tolerance), reset to top
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
              // Smoothly scroll back to top or jump
              el.scrollTop = 0
            }
          }
        }
      })
    }, 45) // 45ms per pixel (smooth slow scroll)

    return () => clearInterval(scrollInterval)
  }, [autoScrollActive])

  // Get nomenclature helper
  const getNom = (nomId) => nomenclatures.find(n => n.id === nomId)

  // Check if a work card has completed tumbling (either in subsequent stages or in tumbling buffer)
  const hasPassedTumbling = (card) => {
    if (!card) return false
    if (card.status === 'completed') return true

    const op = card.operation || ''
    if (op === 'Галтовка' && card.status === 'at-buffer') return true

    const subsequentStages = ['Прийомка', 'completed', 'Пресування', 'Фарбування', 'Паквання', 'Сортування']
    return subsequentStages.some(stage => op.includes(stage))
  }

  // Next sub-stage mapping
  const getNextTumblingOperation = (currentOp) => {
    if (currentOp === 'Розкрій') return 'Галтовка (Вібростіл)'
    if (currentOp === 'Галтовка (Вібростіл)') return 'Галтовка (Мийка)'
    if (currentOp === 'Галтовка (Мийка)') return 'Галтовка (Галтовка)'
    if (currentOp === 'Галтовка (Галтовка)') return 'Галтовка (Сушка)'
    return 'Галтовка (Вібростіл)'
  }

  // 1. Process active orders and compute component kit completion & bottleneck priority
  const orderKits = useMemo(() => {
    // Filter active orders that have work cards in the system
    const activeOrderIds = new Set(workCards.map(c => c.order_id).filter(Boolean))
    
    return Array.from(activeOrderIds).map(orderId => {
      const order = orders.find(o => String(o.id) === String(orderId))
      if (!order) return null

      // Get target quantity of the product
      const targetQty = Number(order.quantity) || 1000 // default fallback
      const parentNom = getNom(order.nomenclature_id)

      // Find children BOM components and keep ONLY those that actually have work cards (active in this order, or in history)
      const orderBoms = bomItems.filter(b => {
        if (b.parent_id !== order.nomenclature_id) return false
        
        const childNom = getNom(b.child_id)
        if (!childNom) return false
        
        // 1. Exclude typical hardware/bought-in items by name
        const nameLower = (childNom.name || '').toLowerCase()
        const isExcluded = 
          nameLower.includes('гвинт') ||
          nameLower.includes('метиз') ||
          nameLower.includes('накладк') ||
          nameLower.includes('гайка') ||
          nameLower.includes('шайба') ||
          nameLower.includes('заклепк') ||
          nameLower.includes('болт') ||
          nameLower.includes('шпильк') ||
          nameLower.includes('саморіз') ||
          nameLower.includes('стійка') ||
          nameLower.includes('тримач') ||
          nameLower.includes('демпфер') ||
          nameLower.includes('пластик') ||
          nameLower.includes('кабель') ||
          nameLower.includes('хомут') ||
          nameLower.includes('скло') ||
          nameLower.includes('ніжка') ||
          nameLower.includes('резинк') ||
          nameLower.includes('ущільн') ||
          nameLower.includes('прокладк') ||
          nameLower.includes('стріч') ||
          nameLower.includes('скотч') ||
          nameLower.includes('клей') ||
          nameLower.includes('втулк')
        
        if (isExcluded) return false

        // 2. Crucial check: Only keep if it has active work cards for this order OR has ever had a work card in history
        const hasActiveCard = workCards.some(c => c.nomenclature_id === b.child_id && String(c.order_id) === String(orderId))
        const hasHistoryCard = workCardHistory?.some(h => h.nomenclature_id === b.child_id)
        
        return hasActiveCard || hasHistoryCard
      })
      if (orderBoms.length === 0) return null

      // Find all work cards associated with this order
      const orderCards = workCards.filter(c => String(c.order_id) === String(orderId))

      // Analyze each component
      const components = orderBoms.map(bom => {
        const childNom = getNom(bom.child_id)
        const qtyPerParent = Number(bom.quantity_per_parent) || 1
        const totalNeeded = targetQty * qtyPerParent

        // Filter cards for this specific component
        const compCards = orderCards.filter(c => c.nomenclature_id === bom.child_id)

        // Sum quantities of cards that have passed tumbling
        const passedQty = compCards.filter(hasPassedTumbling).reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

        // Completed kits ratio
        const completedKits = passedQty / qtyPerParent
        const kitRatio = targetQty > 0 ? completedKits / targetQty : 0

        return {
          id: bom.child_id,
          name: childNom?.name || 'Компонент',
          qtyPerParent,
          totalNeeded,
          passedQty,
          completedKits,
          kitRatio,
          // Store raw cards for sorting reference
          cards: compCards
        }
      })

      // Identify the bottleneck component (lowest kit ratio)
      let bottleneckId = null
      let minRatio = Infinity
      components.forEach(comp => {
        if (comp.kitRatio < minRatio) {
          minRatio = comp.kitRatio
          bottleneckId = comp.id
        }
      })

      // Get deadline for sorting
      const taskObj = tasks.find(t => String(t.order_id) === String(orderId))
      const deadlineStr = taskObj?.planned_deadline || order.deadline || null
      const deadlineDate = deadlineStr ? new Date(deadlineStr) : null

      return {
        orderId,
        orderNum: order.order_num || `Наряд #${String(orderId).slice(-6)}`,
        productName: parentNom?.name || 'Готовий виріб',
        targetQty,
        components,
        bottleneckId,
        deadlineDate,
        deadlineStr
      }
    }).filter(Boolean)
  }, [workCards, orders, bomItems, tasks, nomenclatures])

  // Pagination & auto-rotation for active orders in Column 1 to make it TV-friendly
  const [orderPage, setOrderPage] = useState(0)
  const ordersPerPage = 1
  const totalPages = Math.ceil(orderKits.length / ordersPerPage)

  useEffect(() => {
    if (totalPages <= 1) {
      setOrderPage(0)
      return
    }
    const timer = setInterval(() => {
      setOrderPage(prev => (prev + 1) % totalPages)
    }, 10000) // Rotate pages every 10 seconds
    return () => clearInterval(timer)
  }, [totalPages])

  const displayedKits = useMemo(() => {
    const start = orderPage * ordersPerPage
    return orderKits.slice(start, start + ordersPerPage)
  }, [orderKits, orderPage])

  // Map to easily check if a nomenclature is a bottleneck in its order
  const bottleneckNomenclaturesMap = useMemo(() => {
    const map = {}
    orderKits.forEach(kit => {
      if (kit.bottleneckId) {
        map[kit.bottleneckId] = true
      }
    })
    return map
  }, [orderKits])

  // Get deadline of a card's order helper
  const getCardDeadline = (card) => {
    const kit = orderKits.find(k => String(k.orderId) === String(card.order_id))
    return kit?.deadlineDate || null
  }

  const waitingQueue = useMemo(() => {
    return workCards
      .filter(c => c.status === 'at-buffer' && (c.operation === 'Розкрій' || c.operation === 'Галтовка (Вібростіл)' || c.operation === 'Галтовка (Мийка)' || c.operation === 'Галтовка (Галтовка)'))
      .map(card => {
        const isBottleneck = bottleneckNomenclaturesMap[card.nomenclature_id] || false
        
        // Find the kit ratio for this card's nomenclature in its order
        const kit = orderKits.find(k => String(k.orderId) === String(card.order_id))
        const comp = kit?.components?.find(co => co.id === card.nomenclature_id)
        const kitRatio = comp ? comp.kitRatio : 1.0 // fallback if not in BOM
        
        const deadline = getCardDeadline(card)
        return {
          ...card,
          isBottleneck,
          kitRatio,
          deadline
        }
      })
      .sort((a, b) => {
        // Tier 1: Kit completion ratio (lowest first, which handles absolute and next bottlenecks dynamically)
        if (a.kitRatio !== b.kitRatio) {
          return a.kitRatio - b.kitRatio
        }
        // Tier 2: Deadline (earlier first)
        if (a.deadline && b.deadline) {
          return a.deadline - b.deadline
        }
        if (a.deadline) return -1
        if (b.deadline) return 1

        // Tier 3: FIFO (completion date of previous stage)
        const dateA = new Date(a.completed_at || a.started_at || 0)
        const dateB = new Date(b.completed_at || b.started_at || 0)
        return dateA - dateB
      })
  }, [workCards, bottleneckNomenclaturesMap, orderKits])

  // 3. In-progress queue: cards active on sub-stages
  const inProgressQueue = useMemo(() => {
    return workCards
      .filter(c => c.status === 'in-progress' && c.operation?.startsWith('Галтовка'))
      .sort((a, b) => {
        const dateA = new Date(a.started_at || 0)
        const dateB = new Date(b.started_at || 0)
        return dateA - dateB
      })
  }, [workCards])

  // Live timer formatting for active cards
  const formatLiveDuration = (isoStart) => {
    if (!isoStart) return '00:00:00'
    const diff = Math.max(0, Math.floor((currentTime.getTime() - new Date(isoStart).getTime()) / 1000))
    const h = Math.floor(diff / 3600)
    const m = Math.floor((diff % 3600) / 60)
    const s = diff % 60
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':')
  }

  // Format waiting time for queued cards
  const formatWaitingTime = (isoCompleted) => {
    if (!isoCompleted) return '—'
    const diff = Math.max(0, Math.floor((currentTime.getTime() - new Date(isoCompleted).getTime()) / 1000))
    const m = Math.floor(diff / 60)
    if (m < 60) return `${m} хв`
    const h = Math.floor(m / 60)
    const remM = m % 60
    return `${h} год ${remM} хв`
  }

  return (
    <div style={{
      background: '#07070a',
      height: '100vh',
      maxHeight: '100vh',
      color: '#fff',
      fontFamily: "'Outfit', 'Inter', sans-serif",
      display: 'flex',
      flexDirection: 'column',
      padding: isFullScreen ? '10px' : '20px',
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>
      
      {/* top navbar */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(15, 15, 22, 0.85)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderRadius: '16px',
        padding: '12px 24px',
        marginBottom: '16px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link to="/" style={{ color: '#888', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700 }}>
            <ArrowLeft size={16} /> На головну
          </Link>
          <div style={{ width: '1px', height: '20px', background: 'rgba(255, 255, 255, 0.1)' }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#ff9000' }}>
                МОНІТОР ГАЛТОВКИ · ЦЕХ №1
              </h1>
              <span style={{ background: 'rgba(255, 144, 0, 0.1)', color: '#ff9000', fontSize: '0.65rem', padding: '2px 8px', borderRadius: '20px', border: '1px solid rgba(255,144,0,0.2)', fontWeight: 800 }}>
                ТВ Режим
              </span>
            </div>
            <div style={{ fontSize: '0.65rem', color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Черга та пріоритети на основі комплектності готової продукції
            </div>
          </div>
        </div>

        {/* Right side widgets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Controls */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setAutoScrollActive(!autoScrollActive)}
              style={{
                background: autoScrollActive ? 'rgba(6,182,212,0.1)' : '#1a1a24',
                color: autoScrollActive ? '#06b6d4' : '#888',
                border: `1px solid ${autoScrollActive ? 'rgba(6,182,212,0.3)' : 'rgba(255,255,255,0.05)'}`,
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.7rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Авто-скрол: {autoScrollActive ? 'Увімкнено' : 'Вимкнено'}
            </button>
            <button 
              onClick={() => setIsFullScreen(!isFullScreen)}
              style={{
                background: '#1a1a24',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.05)',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.7rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              {isFullScreen ? 'Стиснути' : 'На весь екран'}
            </button>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, fontFamily: 'monospace', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={16} color="#06b6d4" />
              {currentTime.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div style={{ fontSize: '0.65rem', color: '#555', fontWeight: 800, textTransform: 'uppercase' }}>
              {currentTime.toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>
      </header>

      {/* Main Grid Section */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr 1fr',
        gap: '16px',
        overflow: 'hidden'
      }}>
        
        {/* COLUMN 1: KITS & BOTTLENECKS */}
        <section style={{
          background: 'rgba(15, 15, 22, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.03)',
          borderRadius: '20px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '16px 20px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h2 style={{ fontSize: '0.85rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#ff9000', margin: 0 }}>
              Комплектність нарядів {totalPages > 1 ? `(${orderPage + 1}/${totalPages})` : ''}
            </h2>
            <Sparkles size={14} color="#ff9000" />
          </div>

          <div ref={col1Ref} style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            scrollbarWidth: 'none'
          }}>
            {orderKits.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.15 }}>
                <Layers size={48} />
                <div style={{ fontSize: '0.75rem', marginTop: '8px' }}>Немає активних нарядів</div>
              </div>
            ) : (
              displayedKits.map(kit => (
                <div key={kit.orderId} style={{
                  background: 'rgba(255, 255, 255, 0.01)',
                  border: '1px solid rgba(255, 255, 255, 0.03)',
                  borderRadius: '16px',
                  padding: '14px',
                  position: 'relative'
                }}>
                  {/* Order header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 950, color: '#ff9000', letterSpacing: '0.5px' }}>{kit.orderNum}</div>
                      <div style={{ fontSize: '0.95rem', color: '#fff', marginTop: '6px', fontWeight: 800 }}>{kit.productName}</div>
                    </div>
                    {kit.deadlineStr && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.8rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        fontWeight: 900
                      }}>
                        <Calendar size={12} />
                        {new Date(kit.deadlineStr).toLocaleDateString('uk-UA')}
                      </div>
                    )}
                  </div>

                  {/* Components breakdown */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {kit.components.map(comp => {
                      const isBottleneck = comp.id === kit.bottleneckId
                      const percent = Math.min(100, Math.round(comp.kitRatio * 100))

                      return (
                        <div key={comp.id} style={{
                          padding: '12px 14px',
                          background: isBottleneck ? 'rgba(239, 68, 68, 0.04)' : 'rgba(255,255,255,0.01)',
                          border: isBottleneck ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(255,255,255,0.03)',
                          borderRadius: '12px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: isBottleneck ? '#ef4444' : '#eee' }}>
                              {comp.name}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {isBottleneck && (
                                <span style={{
                                  background: '#ef4444',
                                  color: '#000',
                                  fontSize: '0.6rem',
                                  fontWeight: 950,
                                  padding: '2px 6px',
                                  borderRadius: '5px',
                                  textTransform: 'uppercase',
                                  animation: 'pulse 1.5s infinite'
                                }}>
                                  Вузьке місце
                                </span>
                              )}
                              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#aaa' }}>
                                {Math.round(comp.completedKits)} / {kit.targetQty} компл. ({percent}%)
                              </span>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${percent}%`,
                              height: '100%',
                              background: isBottleneck ? 'linear-gradient(90deg, #ef4444, #f97316)' : 'linear-gradient(90deg, #3b82f6, #06b6d4)',
                              borderRadius: '4px',
                              transition: 'width 0.4s'
                            }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', padding: '12px 0', background: 'rgba(0,0,0,0.15)', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
              {Array.from({ length: totalPages }).map((_, i) => (
                <div key={i} style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: orderPage === i ? '#ff9000' : 'rgba(255,255,255,0.2)',
                  transition: 'background 0.3s'
                }} />
              ))}
            </div>
          )}
        </section>

        {/* COLUMN 2: WAITING QUEUE */}
        <section style={{
          background: 'rgba(15, 15, 22, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.03)',
          borderRadius: '20px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '16px 20px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h2 style={{ fontSize: '0.85rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#ff9000', margin: 0 }}>
              Черга очікування ({waitingQueue.length})
            </h2>
            <span style={{ fontSize: '0.6rem', color: '#888', fontWeight: 800 }}>ЧЕРГА FIFO + ДЕДЛАЙН</span>
          </div>

          <div ref={col2Ref} style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            scrollbarWidth: 'none'
          }}>
            {waitingQueue.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.15 }}>
                <Layers size={48} />
                <div style={{ fontSize: '0.75rem', marginTop: '8px' }}>Черга порожня</div>
              </div>
            ) : (
              waitingQueue.map((card, idx) => {
                const nom = getNom(card.nomenclature_id)
                const nextOp = getNextTumblingOperation(card.operation)

                return (
                  <div key={card.id} style={{
                    background: '#0d0d12',
                    border: card.isBottleneck 
                      ? '1px solid rgba(239, 68, 68, 0.25)' 
                      : '1px solid rgba(255, 255, 255, 0.03)',
                    borderRadius: '14px',
                    padding: '12px 14px',
                    position: 'relative',
                    boxShadow: card.isBottleneck ? '0 4px 15px rgba(239,68,68,0.04)' : 'none'
                  }}>
                    {/* Index & Priority banner */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{
                          background: card.isBottleneck ? '#ef4444' : '#1e1e2d',
                          color: card.isBottleneck ? '#000' : '#888',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.65rem',
                          fontWeight: 950
                        }}>
                          {idx + 1}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#ff9000', fontWeight: 900 }}>
                          #{card.id.slice(-8).toUpperCase()}
                        </span>
                        {(() => {
                          const order = orders.find(o => String(o.id) === String(card.order_id))
                          return order?.order_num ? (
                            <span style={{ background: 'rgba(255, 255, 255, 0.06)', color: '#aaa', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '1px 6px', borderRadius: '5px', fontSize: '0.6rem', fontWeight: 900 }}>
                              {order.order_num}
                            </span>
                          ) : null
                        })()}
                        {(() => {
                          const seqMatch = (card.card_info || '').match(/(\d+\/\d+)/)
                          return seqMatch ? (
                            <span style={{ background: 'rgba(255, 144, 0, 0.15)', color: '#ff9000', border: '1px solid rgba(255, 144, 0, 0.3)', padding: '1px 6px', borderRadius: '5px', fontSize: '0.6rem', fontWeight: 900 }}>
                              {seqMatch[1]}
                            </span>
                          ) : null
                        })()}
                      </div>
                      
                      {card.isBottleneck ? (
                        <span style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: '#ef4444',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          fontSize: '0.55rem',
                          padding: '2px 6px',
                          borderRadius: '5px',
                          fontWeight: 900,
                          textTransform: 'uppercase'
                        }}>
                          КРИТИЧНО
                        </span>
                      ) : (
                        <span style={{
                          background: 'rgba(59, 130, 246, 0.12)',
                          color: '#3b82f6',
                          border: '1px solid rgba(59, 130, 246, 0.2)',
                          fontSize: '0.55rem',
                          padding: '2px 6px',
                          borderRadius: '5px',
                          fontWeight: 900
                        }}>
                          Черга
                        </span>
                      )}
                    </div>

                    <h4 style={{ fontSize: '0.8rem', fontWeight: 800, margin: '0 0 6px 0', color: '#fff' }}>
                      {nom?.name || 'Невказана деталь'}
                    </h4>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                      <span style={{ fontSize: '0.65rem', color: '#888', fontWeight: 700 }}>
                        К-сть: <strong style={{ color: '#fff' }}>{card.quantity} шт</strong>
                      </span>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.62rem', color: '#777', fontWeight: 800 }}>
                        <Clock size={10} />
                        Очікує: {formatWaitingTime(card.completed_at || card.started_at)}
                      </div>
                    </div>

                    {/* Step indicator */}
                    <div style={{
                      marginTop: '8px',
                      padding: '4px 8px',
                      background: 'rgba(255,255,255,0.02)',
                      borderRadius: '8px',
                      fontSize: '0.62rem',
                      color: '#06b6d4',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <ChevronRight size={10} />
                      Переходить на: {nextOp}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* COLUMN 3: IN WORK */}
        <section style={{
          background: 'rgba(15, 15, 22, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.03)',
          borderRadius: '20px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '16px 20px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h2 style={{ fontSize: '0.85rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#10b981', margin: 0 }}>
              Зараз у роботі ({inProgressQueue.length})
            </h2>
            <Play size={14} color="#10b981" fill="currentColor" />
          </div>

          <div ref={col3Ref} style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            scrollbarWidth: 'none'
          }}>
            {inProgressQueue.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.15 }}>
                <Play size={48} />
                <div style={{ fontSize: '0.75rem', marginTop: '8px' }}>Зараз нічого не обробляється</div>
              </div>
            ) : (
              inProgressQueue.map(card => {
                const nom = getNom(card.nomenclature_id)

                return (
                  <div key={card.id} style={{
                    background: 'rgba(16, 185, 129, 0.02)',
                    border: '1px solid rgba(16, 185, 129, 0.12)',
                    borderRadius: '14px',
                    padding: '12px 14px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.7rem', color: '#ff9000', fontWeight: 900 }}>
                          #{card.id.slice(-8).toUpperCase()}
                        </span>
                        {(() => {
                          const order = orders.find(o => String(o.id) === String(card.order_id))
                          return order?.order_num ? (
                            <span style={{ background: 'rgba(255, 255, 255, 0.06)', color: '#aaa', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '1px 6px', borderRadius: '5px', fontSize: '0.6rem', fontWeight: 900 }}>
                              {order.order_num}
                            </span>
                          ) : null
                        })()}
                        {(() => {
                          const seqMatch = (card.card_info || '').match(/(\d+\/\d+)/)
                          return seqMatch ? (
                            <span style={{ background: 'rgba(255, 144, 0, 0.15)', color: '#ff9000', border: '1px solid rgba(255, 144, 0, 0.3)', padding: '1px 6px', borderRadius: '5px', fontSize: '0.6rem', fontWeight: 900 }}>
                              {seqMatch[1]}
                            </span>
                          ) : null
                        })()}
                      </div>
                      <span style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                        fontSize: '0.55rem',
                        padding: '2px 6px',
                        borderRadius: '5px',
                        fontWeight: 900,
                        textTransform: 'uppercase'
                      }}>
                        {card.operation?.replace('Галтовка (', '').replace(')', '') || 'Обробка'}
                      </span>
                    </div>

                    <h4 style={{ fontSize: '0.8rem', fontWeight: 800, margin: '0 0 6px 0', color: '#fff' }}>
                      {nom?.name || 'Невказана деталь'}
                    </h4>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.65rem', color: '#888', fontWeight: 700 }}>
                        К-сть: <strong style={{ color: '#fff' }}>{card.quantity} шт</strong>
                      </span>
                      
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.75rem',
                        fontFamily: 'monospace',
                        color: '#10b981',
                        fontWeight: 900
                      }}>
                        <Clock size={11} />
                        {formatLiveDuration(card.started_at)}
                      </div>
                    </div>

                    {card.operator_name && (
                      <div style={{
                        marginTop: '8px',
                        fontSize: '0.62rem',
                        color: '#666',
                        fontWeight: 700
                      }}>
                        Оператор: <span style={{ color: '#aaa' }}>{card.operator_name.split(' (')[0]}</span>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </section>

      </div>

      {/* Global CSS for blink animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
