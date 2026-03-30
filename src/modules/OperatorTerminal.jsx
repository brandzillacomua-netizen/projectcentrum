import React, { useState, useEffect } from 'react'
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
  Clock
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'

const OperatorTerminal = () => {
  const { workCards, tasks, orders, nomenclatures, startWorkCard, completeWorkCard } = useMES()
  const [selectedCardId, setSelectedCardId] = useState(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isProcessing, setIsProcessing] = useState(false)
  const [showScrapModal, setShowScrapModal] = useState(false)
  const [scrapCounts, setScrapCounts] = useState({})

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const currentCard = workCards.find(c => c.id === selectedCardId)
  const getTaskOrder = (orderId) => orders.find(o => o.id === orderId)

  const availableCards = workCards.filter(c => c.status !== 'completed')

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
      await completeWorkCard(currentCard.id, scrapCounts)
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
    <div className="operator-terminal-v2">
      <header className="terminal-nav">
        <Link to="/" className="back-link"><ArrowLeft size={20} /> Вихід</Link>
        <div className="terminal-id">
          <Tablet size={24} className="text-primary" />
          <h1>ТЕРМІНАЛ ОПЕРАТОРА</h1>
        </div>
        <div className="timer-nav">{currentTime.toLocaleTimeString()}</div>
      </header>

      <div className="terminal-body">
        {/* Left Sidebar: Task List */}
        <div className="task-panel">
          <div className="panel-header">
            <ClipboardList size={18} /> Черга виробництва
          </div>
          <div className="tasks-scroll">
            {availableCards.map(card => {
              const order = getTaskOrder(card.order_id)
              return (
                <div 
                  key={card.id} 
                  className={`task-row ${selectedCardId === card.id ? 'active' : ''}`}
                  onClick={() => setSelectedCardId(card.id)}
                >
                  <div className="task-info">
                    <strong>№{order?.order_num}</strong>
                    <small>{card.operation} | {card.machine}</small>
                  </div>
                  <div className={`status-tag ${card.status}`}>{card.status === 'in-progress' ? 'В роботі' : 'Очікує'}</div>
                </div>
              )
            })}
            {availableCards.length === 0 && <div className="empty-tasks">Завдання відсутні</div>}
          </div>
        </div>

        {/* Right Content: Active Task Details */}
        <div className="workspace-panel">
          {currentCard ? (
            <div className="active-task-view">
              <div className="view-header">
                <div>
                  <span className="order-label">ЗАМОВЛЕННЯ</span>
                  <h2>№{getTaskOrder(currentCard.order_id)?.order_num} — {getTaskOrder(currentCard.order_id)?.customer}</h2>
                </div>
                <div className="step-badge">{currentCard.operation} — {currentCard.machine}</div>
              </div>

              <div className="view-content">
                <div className="stats-row">
                  <div style={{ gridColumn: 'span 2' }}>
                    <div className="stat-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ margin: 0 }}>Нормативний час на виконання (Робоча картка)</label>
                      <div className="val">{formatDuration(currentCard.estimated_time)}</div>
                    </div>
                  </div>
                </div>

                <div className="control-section">
                  {currentCard.status === 'pending' || currentCard.status === 'waiting' ? (
                    <div className="start-prompt">
                      <div className="task-details-preview">
                        <div className="details-header">Склад замовлення (для довідки):</div>
                        <div className="details-list">
                          {getTaskOrder(currentCard.order_id)?.order_items?.map(item => {
                            const nom = nomenclatures.find(n => n.id === item.nomenclature_id)
                            return (
                              <div key={item.id} className="detail-item">
                                <span className="nom-name">{nom?.name}</span>
                                <span className="nom-qty">{item.quantity} шт</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      
                      <button className="btn-primary-glow" onClick={() => startWorkCard(currentCard.id)}>
                        <Play fill="currentColor" /> РОЗПОЧАТИ ОПЕРАЦІЮ
                      </button>
                    </div>
                  ) : (
                    <div className="execution-view">
                      <div className="runtime-display">
                        <Timer className="spin-slow" />
                        <span>{formatElapsedTime(currentCard.started_at)}</span>
                      </div>
                      <button 
                        className="btn-success-glow" 
                        disabled={isProcessing}
                        onClick={handleCompleteClick}
                      >
                        {isProcessing ? 'ЗУПИНКА...' : <><CheckCircle /> ЗАВЕРШИТИ ОПЕРАЦІЮ</>}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="welcome-view">
              <Scan size={80} className="pulse-icon" />
              <h3>Виберіть завдання з черги зліва</h3>
              <p>Оберіть наряд для початку роботи та відстеження часу</p>
            </div>
          )}
        </div>
      </div>

      {showScrapModal && (
        <div className="scrap-overlay">
          <div className="scrap-dialog">
            <div className="dialog-header">
              <h3><AlertTriangle className="text-danger" /> Звіт про брак</h3>
              <button onClick={() => setShowScrapModal(false)}><X size={20} /></button>
            </div>
            <div className="dialog-body">
              {getTaskOrder(currentCard?.order_id)?.order_items?.map(item => {
                const nom = nomenclatures.find(n => n.id === item.nomenclature_id)
                return (
                  <div key={item.id} className="scrap-row">
                    <div className="nom-meta">
                      <strong>{nom?.name}</strong>
                      <span>Замовлено: {item.quantity} шт</span>
                    </div>
                    <div className="scrap-input">
                      <label>БРАК:</label>
                      <input 
                        type="number"
                        min="0"
                        max={item.quantity}
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
              <button className="btn-submit-scrap" disabled={isProcessing} onClick={submitCompletion}>
                {isProcessing ? 'ЗБЕРЕЖЕННЯ...' : 'ПІДТВЕРДИТИ ТА СКЛАДУВАТИ'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        :root { --p-orange: #ff9000; --p-charcoal: #1b1b1b; --p-black: #121212; --p-blue: #3b82f6; }
        .operator-terminal-v2 { background: var(--p-black); color: #fff; height: 100vh; display: flex; flex-direction: column; font-family: 'Inter', sans-serif; }
        
        .approvals-check { display: flex; flex-direction: column; gap: 10px; margin-top: 15px; }
        .check-item { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; font-weight: 700; padding: 10px 15px; border-radius: 10px; background: rgba(0,0,0,0.3); border: 1px solid #333; }
        .check-item.ok { color: #10b981; border-color: rgba(16,185,129,0.3); background: rgba(16,185,129,0.05); }
        .check-item.wait { color: #64748b; }
        
        .approval-lock-msg { margin-top: 30px; display: flex; flex-direction: column; align-items: center; gap: 15px; padding: 30px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); border-radius: 20px; color: #ef4444; text-align: center; }
        .approval-lock-msg span { font-weight: 900; font-size: 0.8rem; letter-spacing: 0.1em; line-height: 1.4; }

        .terminal-nav { display: flex; justify-content: space-between; align-items: center; padding: 0 30px; height: 70px; background: #000; border-bottom: 2px solid var(--p-orange); }
        .back-link { color: #94a3b8; text-decoration: none; display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 0.9rem; }
        .terminal-id { display: flex; align-items: center; gap: 12px; }
        .terminal-id h1 { font-size: 1.1rem; font-weight: 800; letter-spacing: 0.1em; color: #fff; }
        .text-primary { color: var(--p-orange); }
        .timer-nav { font-weight: 900; font-family: monospace; font-size: 1.4rem; color: var(--p-orange); }

        .terminal-body { flex: 1; display: grid; grid-template-columns: 350px 1fr; overflow: hidden; }
        .task-panel { background: var(--p-charcoal); border-right: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; }
        .panel-header { padding: 25px; font-size: 0.8rem; text-transform: uppercase; font-weight: 800; color: #475569; display: flex; align-items: center; gap: 10px; }
        .tasks-scroll { flex: 1; overflow-y: auto; padding: 0 15px 25px; }
        .task-row { 
          background: rgba(255,255,255,0.03); border-radius: 16px; padding: 20px; margin-bottom: 12px; 
          cursor: pointer; border: 1px solid transparent; transition: 0.2s; display: flex; justify-content: space-between; align-items: center;
        }
        .task-row:hover { background: rgba(255,255,255,0.07); }
        .task-row.active { background: var(--p-orange); border-color: var(--p-orange); color: white; }
        .task-info strong { display: block; font-size: 1.1rem; margin-bottom: 4px; }
        .task-info small { color: #64748b; font-weight: 600; }
        
        .status-tag { padding: 4px 8px; border-radius: 6px; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; background: #334155; color: #94a3b8; }
        .status-tag.in-progress { background: #fff7ed; color: #c2410c; }

        .workspace-panel { flex: 1; padding: 40px; background: #121212; overflow-y: auto; }
        .active-task-view { max-width: 900px; margin: 0 auto; }
        .view-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 50px; }
        .order-label { color: var(--p-blue); font-weight: 800; font-size: 0.8rem; letter-spacing: 0.2em; display: block; margin-bottom: 12px; }
        .view-header h2 { font-size: 3rem; margin: 0; font-weight: 900; }
        .step-badge { background: var(--p-blue); color: white; padding: 8px 20px; border-radius: 12px; font-weight: 800; font-size: 0.9rem; margin-top: 15px; box-shadow: 0 10px 20px rgba(59, 130, 246, 0.3); }

        .stats-row { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 50px; }
        .stat-card { background: rgba(255,255,255,0.03); border-radius: 24px; padding: 30px; border: 1px solid rgba(255,255,255,0.05); }
        .stat-card label { color: #64748b; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 15px; }
        .stat-card .val { font-size: 2.5rem; font-weight: 900; }

        .control-section { background: rgba(15, 23, 42, 0.4); border-radius: 32px; padding: 40px; border: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; align-items: center; width: 100%; min-height: 300px; }
        .start-prompt { width: 100%; display: flex; flex-direction: column; align-items: center; }
        
        .task-details-preview { background: rgba(2, 6, 23, 0.4); border-radius: 20px; padding: 25px; width: 100%; max-width: 600px; border: 1px solid rgba(255,255,255,0.05); }
        .details-header { color: #888; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 15px; border-bottom: 1px solid #222; padding-bottom: 8px; }
        .details-list { display: flex; flex-direction: column; gap: 10px; }
        .detail-item { display: flex; justify-content: space-between; align-items: center; }
        .nom-name { font-weight: 600; color: #eee; font-size: 0.9rem; }
        .nom-qty { background: #333; color: white; padding: 4px 12px; border-radius: 8px; font-weight: 800; font-size: 0.8rem; }

        .btn-primary-glow { background: var(--p-blue); color: white; border: none; padding: 22px 80px; border-radius: 20px; font-size: 1.4rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 15px; box-shadow: 0 20px 40px rgba(59, 130, 246, 0.4); margin-top: 30px; transition: 0.3s; }
        .btn-primary-glow:hover { transform: scale(1.02); background: #2563eb; }

        .execution-view { width: 100%; display: flex; flex-direction: column; align-items: center; }
        .runtime-display { font-size: 6rem; font-weight: 900; color: var(--p-blue); font-family: monospace; display: flex; align-items: center; gap: 30px; margin-bottom: 40px; }
        .spin-slow { animation: spin 4s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        .btn-success-glow { background: #10b981; color: white; border: none; padding: 22px 80px; border-radius: 20px; font-size: 1.4rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 15px; box-shadow: 0 20px 40px rgba(16, 185, 129, 0.4); width: 100%; justify-content: center; }

        .welcome-view { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; opacity: 0.15; text-align: center; }
        .welcome-view h3 { font-size: 2rem; margin: 20px 0 10px; }
        .pulse-icon { animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }

        .scrap-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.9); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .scrap-dialog { background: #111; width: 100%; max-width: 600px; border-radius: 24px; border: 1px solid #333; overflow: hidden; }
        .dialog-header { padding: 25px; border-bottom: 1px solid #222; display: flex; justify-content: space-between; align-items: center; }
        .dialog-body { padding: 25px; }
        .scrap-row { background: #0a0a0a; padding: 20px; border-radius: 16px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #1a1a1a; }
        .nom-meta strong { display: block; font-size: 1.1rem; margin-bottom: 4px; color: #fff; }
        .nom-meta span { color: #555; font-size: 0.8rem; }
        .scrap-input { display: flex; align-items: center; gap: 15px; }
        .scrap-input label { color: #ef4444; font-weight: 900; font-size: 0.7rem; }
        .scrap-input input { background: #000; border: 1px solid #333; color: white; width: 80px; padding: 12px; border-radius: 10px; text-align: center; font-size: 1.2rem; font-weight: 800; }
        .btn-submit-scrap { background: var(--p-blue); color: white; border: none; width: 100%; padding: 20px; border-radius: 12px; font-weight: 800; font-size: 1.1rem; margin-top: 15px; cursor: pointer; }
      `}} />
    </div>
  )
}

export default OperatorTerminal
