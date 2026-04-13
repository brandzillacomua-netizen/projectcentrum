import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  ArrowLeft, 
  TrendingUp, 
  Users, 
  Target, 
  AlertTriangle, 
  Clock, 
  Zap, 
  CheckCircle2, 
  BarChart3,
  Calendar,
  Layers,
  Cpu
} from 'lucide-react'
import { useMES } from '../MESContext'

const AnalyticsModule = () => {
  const { tasks, orders, workCards, workCardHistory, nomenclatures, machines, totalProduced, totalScrapCount } = useMES()
  const [archiveTab, setArchiveTab] = useState('shop1')
  const [expandedOrders, setExpandedOrders] = useState({})
  const [expandedNoms, setExpandedNoms] = useState({})

  const toggleOrder = (orderNum) => setExpandedOrders(prev => ({ ...prev, [orderNum]: !prev[orderNum] }))
  const toggleNom = (orderNum, nomId) => {
    const key = `${orderNum}_${nomId}`
    setExpandedNoms(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // --- DATA AGGREGATION ---

  const stats = useMemo(() => {
    // 1. On-Time Delivery %
    const completedOrders = orders.filter(o => o.status === 'completed' || tasks.some(t => t.order_id === o.id && t.status === 'completed'))
    const onTimeOrders = completedOrders.filter(o => {
      if (!o.deadline) return true
      const lastTask = tasks.filter(t => t.order_id === o.id).sort((a,b) => new Date(b.completed_at) - new Date(a.completed_at))[0]
      if (!lastTask?.completed_at) return true
      return new Date(lastTask.completed_at) <= new Date(o.deadline)
    })
    const onTimeRate = completedOrders.length > 0 ? Math.round((onTimeOrders.length / completedOrders.length) * 100) : 0
    const qualityRate = totalProduced > 0 ? (100 - Math.round((totalScrapCount / totalProduced) * 100)) : 0

    // 2. Operator Performance
    const operatorStats = workCardHistory.reduce((acc, h) => {
      const name = h.operator_name || 'Невідомий'
      if (!acc[name]) acc[name] = { name, produced: 0, scrap: 0, actions: 0 }
      acc[name].produced += (Number(h.qty_completed) || 0)
      acc[name].scrap += (Number(h.scrap_qty) || 0)
      acc[name].actions += 1
      return acc
    }, {})
    const sortedOperators = Object.values(operatorStats).sort((a, b) => b.produced - a.produced)

    // 3. Parts Produced by Type (Categories)
    const partsByType = workCardHistory.reduce((acc, h) => {
      const nom = nomenclatures.find(n => n.id === h.nomenclature_id)
      const type = nom?.material_type || 'Інше'
      acc[type] = (acc[type] || 0) + (Number(h.qty_completed) || 0)
      return acc
    }, {})

    // 4. Time Analytics (Average Lead Time) - Simplified
    const completedTasks = tasks.filter(t => t.status === 'completed' && t.completed_at)
    const avgLeadTimeHours = completedTasks.length > 0 
      ? completedTasks.reduce((acc, t) => {
          const duration = (new Date(t.completed_at) - new Date(t.created_at)) / (1000 * 60 * 60)
          return acc + duration
        }, 0) / completedTasks.length 
      : 0

    // 5. Shop Load (Active Tasks by Step)
    const steps = ["Розкрій", "Галтовка", "Пресування", "Фарбування", "Паквання"]
    const shopLoad = steps.map(step => {
      const activeInStep = tasks.filter(t => t.status !== 'completed' && t.step?.toLowerCase().includes(step.toLowerCase())).length
      // Scale: 0 tasks = 5%, 5+ tasks = 100% (just for visualization)
      const loadPercent = Math.min(100, Math.max(5, activeInStep * 20)) 
      return { step, count: activeInStep, loadPercent }
    })

    return {
      onTimeRate,
      qualityRate,
      shopLoad,
      sortedOperators,
      partsByType,
      avgLeadTimeHours: Math.round(avgLeadTimeHours * 10) / 10,
      totalOrders: orders.length,
      activeTasks: tasks.filter(t => t.status === 'in-progress').length
    }
  }, [tasks, orders, workCardHistory, nomenclatures])

  // --- RENDER HELPERS ---

  const renderKPI = (title, value, sub, icon, color) => (
    <div className="kpi-card glass-panel" style={{ 
      background: '#111', 
      padding: '25px', 
      borderRadius: '28px', 
      border: '1px solid #1a1a1a', 
      flex: 1, 
      minWidth: '240px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ color: '#555', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>{title}</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 1000, color: '#fff' }}>{value}</div>
          <div style={{ color: color, fontSize: '0.75rem', fontWeight: 800, marginTop: '5px' }}>{sub}</div>
        </div>
        <div style={{ background: `${color}15`, padding: '12px', borderRadius: '16px', color: color }}>
          {icon}
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '4px', background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}></div>
    </div>
  )

  return (
    <div className="analytics-module" style={{ background: '#050505', minHeight: '100vh', color: '#fff', paddingBottom: '50px' }}>
      {/* ─── NAVIGATION ─── */}
      <nav style={{ padding: '0 30px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #111', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link to="/" style={{ color: '#555', textDecoration: 'none' }}><ArrowLeft size={24} /></Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <TrendingUp size={28} color="#8b5cf6" />
            <h1 style={{ fontSize: '1.2rem', fontWeight: 950, textTransform: 'uppercase', margin: 0, letterSpacing: '1px' }}>Аналітика Виробництва</h1>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
           <div style={{ background: '#111', padding: '8px 16px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800, color: '#555', border: '1px solid #1a1a1a' }}>
             <Calendar size={14} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> ОСТАННІ 30 ДНІВ
           </div>
        </div>
      </nav>

      <div style={{ maxWidth: '1400px', margin: '40px auto', padding: '0 20px' }}>
        
        {/* ─── TOP KPI ROW ─── */}
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '40px' }}>
          {renderKPI("Виконано одиниць", (Number(totalProduced) || 0).toLocaleString(), totalProduced > 0 ? "+12% від минулого тижня" : "Дані відсутні", <Zap size={24} />, "#ff9000")}
          {renderKPI("Якість (Без браку)", totalProduced > 0 ? `${stats.qualityRate}%` : "0%", `${totalScrapCount} шт. браку всього`, <Target size={24} />, "#10b981")}
          {renderKPI("Дотримання термінів", stats.totalOrders > 0 ? `${stats.onTimeRate}%` : "0%", `${stats.totalOrders} замовлень оброблено`, <Clock size={24} />, "#3b82f6")}
          {renderKPI("Ефективність", stats.avgLeadTimeHours > 0 ? `${stats.avgLeadTimeHours}г` : "0г", "Середній час циклу наряду", <Zap size={24} />, "#8b5cf6")}
        </div>

        {/* ─── MAIN ANALYTICS GRID ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '30px', marginBottom: '40px' }}>
          
          {/* VOLUME BY MATERIAL (Chart) */}
          <div className="glass-panel" style={{ background: '#0a0a0a', padding: '30px', borderRadius: '32px', border: '1px solid #111' }}>
             <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1rem', fontWeight: 900, marginBottom: '30px', color: '#444' }}>
                <BarChart3 size={18} /> РОЗПОДІЛ ВИРОБНИЦТВА ЗА МАТЕРІАЛАМИ
             </h3>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {Object.entries(stats.partsByType).sort((a,b) => b[1] - a[1]).slice(0, 6).map(([type, qty], idx) => {
                  const max = Math.max(...Object.values(stats.partsByType))
                  const percent = (qty / max) * 100
                  return (
                    <div key={type}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 800 }}>
                        <span>{type}</span>
                        <span style={{ color: '#ff9000' }}>{qty.toLocaleString()} шт</span>
                      </div>
                      <div style={{ height: '8px', background: '#111', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${percent}%`, 
                          height: '100%', 
                          background: `linear-gradient(90deg, #8b5cf6, #d946ef)`,
                          borderRadius: '4px',
                          boxShadow: '0 0 15px rgba(139, 92, 246, 0.4)'
                        }}></div>
                      </div>
                    </div>
                  )
                })}
             </div>
          </div>

          {/* SYSTEM SNAPSHOT */}
          <div className="glass-panel" style={{ background: '#0a0a0a', padding: '30px', borderRadius: '32px', border: '1px solid #111' }}>
             <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1rem', fontWeight: 900, marginBottom: '30px', color: '#444' }}>
                <Zap size={18} /> ПОТОЧНИЙ СТАН СИСТЕМИ
             </h3>
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div style={{ background: '#000', padding: '20px', borderRadius: '20px', border: '1px solid #111' }}>
                   <div style={{ color: '#333', fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '5px' }}>В РОБОТІ</div>
                   <div style={{ fontSize: '1.8rem', fontWeight: 1000, color: '#3b82f6' }}>{stats.activeTasks}</div>
                   <div style={{ fontSize: '0.65rem', color: '#333' }}>Активні наряди</div>
                </div>
                <div style={{ background: '#000', padding: '20px', borderRadius: '20px', border: '1px solid #111' }}>
                   <div style={{ color: '#333', fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '5px' }}>БЕЗ БРАКУ</div>
                   <div style={{ fontSize: '1.8rem', fontWeight: 1000, color: '#10b981' }}>{totalProduced > 0 ? `${stats.qualityRate}%` : "0%"}</div>
                   <div style={{ fontSize: '0.65rem', color: '#333' }}>Показник якості</div>
                </div>
                <div style={{ background: '#000', padding: '20px', borderRadius: '20px', border: '1px solid #111', gridColumn: 'span 2' }}>
                   <div style={{ color: '#333', fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '10px' }}>ЗАВАНТАЖЕННЯ ЦЕХІВ</div>
                   <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', height: '60px' }}>
                      {stats.shopLoad.map((item, i) => (
                        <div key={i} title={`${item.step}: ${item.count}`} style={{ 
                          flex: 1, 
                          background: item.loadPercent > 80 ? '#ef4444' : '#8b5cf6', 
                          height: `${item.loadPercent}%`, 
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.5s ease',
                          position: 'relative'
                        }}>
                          <div style={{ position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.5rem', fontWeight: 900, color: '#444' }}>{item.count > 0 ? item.count : ''}</div>
                        </div>
                      ))}
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                      {stats.shopLoad.map((item, i) => (
                        <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: '0.5rem', color: '#333', fontWeight: 800 }}>{item.step.charAt(0)}</div>
                      ))}
                   </div>
                </div>
             </div>
          </div>

        </div>

        {/* ─── OPERATOR KPI TABLE ─── */}
        <div className="glass-panel" style={{ background: '#0a0a0a', padding: '40px', borderRadius: '32px', border: '1px solid #111' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '35px' }}>
             <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', fontWeight: 950, margin: 0 }}>
                <Users size={22} color="#8b5cf6" /> KPI ОПЕРАТОРІВ ТА ВИКОНАВЦІВ
             </h3>
             <button style={{ background: '#111', border: '1px solid #1a1a1a', color: '#555', padding: '8px 20px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer' }}>ЕКСПОРТ EXCEL</button>
          </div>
          
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#333', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', borderBottom: '1px solid #111' }}>
                <th style={{ padding: '15px 10px' }}>ОПЕРАТОР</th>
                <th style={{ padding: '15px 10px', textAlign: 'center' }}>ВИКОНАНО</th>
                <th style={{ padding: '15px 10px', textAlign: 'center' }}>БРАК</th>
                <th style={{ padding: '15px 10px', textAlign: 'center' }}>ЯКІСТЬ</th>
                <th style={{ padding: '15px 10px', textAlign: 'center' }}>АКТИВНІСТЬ</th>
                <th style={{ padding: '15px 10px', textAlign: 'right' }}>РЕЙТИНГ</th>
              </tr>
            </thead>
            <tbody>
              {stats.sortedOperators.map((op, idx) => {
                const quality = 100 - Math.round((op.scrap / (op.produced || 1)) * 100)
                return (
                  <tr key={op.name} style={{ borderBottom: '1px solid #0f0f0f', transition: '0.2s transform' }}>
                    <td style={{ padding: '20px 10px' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: `linear-gradient(135deg, #111, #000)`, border: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.8rem', color: '#8b5cf6' }}>
                             {op.name.charAt(0)}
                          </div>
                          <div style={{ fontWeight: 800, color: '#fff' }}>{op.name}</div>
                       </div>
                    </td>
                    <td style={{ padding: '20px 10px', textAlign: 'center', fontWeight: 900, fontSize: '1rem', color: '#ff9000' }}>{op.produced.toLocaleString()}</td>
                    <td style={{ padding: '20px 10px', textAlign: 'center', fontWeight: 900, color: op.scrap > 0 ? '#ef4444' : '#333' }}>{op.scrap}</td>
                    <td style={{ padding: '20px 10px', textAlign: 'center' }}>
                       <div style={{ 
                         display: 'inline-block', 
                         padding: '4px 10px', 
                         borderRadius: '8px', 
                         background: quality > 95 ? '#064e3b' : '#450a0a', 
                         color: quality > 95 ? '#10b981' : '#f87171',
                         fontSize: '0.7rem',
                         fontWeight: 900
                       }}>
                         {quality}%
                       </div>
                    </td>
                    <td style={{ padding: '20px 10px', textAlign: 'center', color: '#555', fontSize: '0.75rem', fontWeight: 700 }}>{op.actions} операцій</td>
                    <td style={{ padding: '20px 10px', textAlign: 'right' }}>
                       {idx === 0 && <span style={{ color: '#fbbf24' }}>🏆 ТОП-1</span>}
                       {idx > 0 && <span style={{ color: '#222', fontSize: '0.8rem', fontWeight: 900 }}>#{idx + 1}</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ─── ARCHIVE HISTORY ─── */}
        <div style={{ marginTop: '50px' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '25px', borderBottom: '1px solid #1a1a1a', paddingBottom: '15px' }}>
             <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', fontWeight: 950, margin: 0 }}>
                <Layers size={22} color="#3b82f6" /> АРХІВНІ ЗАПИСИ (TRACEABILITY)
             </h3>
             <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => setArchiveTab('shop1')}
                  style={{ background: archiveTab === 'shop1' ? '#3b82f6' : '#111', color: archiveTab === 'shop1' ? '#fff' : '#555', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: 900, fontSize: '0.8rem', cursor: 'pointer', transition: '0.2s' }}
                >
                  ЦЕХ №1
                </button>
                <button 
                  onClick={() => setArchiveTab('shop2')}
                  style={{ background: archiveTab === 'shop2' ? '#8b5cf6' : '#111', color: archiveTab === 'shop2' ? '#fff' : '#555', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: 900, fontSize: '0.8rem', cursor: 'pointer', transition: '0.2s' }}
                >
                  ЦЕХ №2
                </button>
             </div>
           </div>

           <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {(() => {
                // Filter by Shop
                const filteredHistory = workCardHistory.filter(h => {
                   const rootCard = (workCards || []).find(c => String(c.id) === String(h.card_id))
                   const cardInfoIsShop2 = ((rootCard?.card_info || '') + (h.card_info || '')).includes('[ЦЕХ №2]')
                   const stageIsShop2 = ['Пресування', 'Фарбування', 'Доопрацювання'].includes(h.stage_name)
                   
                   const isShop2 = cardInfoIsShop2 || stageIsShop2
                   return archiveTab === 'shop2' ? isShop2 : !isShop2
                })

                // Group by Order Num -> Nomenclature ID
                const grouped = filteredHistory.reduce((acc, h) => {
                  const rootCard = (workCards || []).find(c => String(c.id) === String(h.card_id))
                  let orderNum = "Невідоме"
                  
                  if (rootCard) {
                    const order = (orders || []).find(o => String(o.id) === String(rootCard.order_id))
                    if (order) orderNum = order.order_num
                  } else if (h.card_info) {
                    const match = h.card_info.match(/Наряд №(\d+)/)
                    if (match) orderNum = match[1]
                  }

                  if (!acc[orderNum]) acc[orderNum] = {}
                  if (!acc[orderNum][h.nomenclature_id]) acc[orderNum][h.nomenclature_id] = []
                  
                  acc[orderNum][h.nomenclature_id].push(h)
                  return acc
                }, {})

                const orderKeys = Object.keys(grouped).sort((a,b) => b.localeCompare(a))

                if (orderKeys.length === 0) return <div style={{ color: '#555', textAlign: 'center', padding: '50px' }}>Записи відсутні у вибраному цеху</div>

                return orderKeys.map(orderNum => {
                  const nomKeys = Object.keys(grouped[orderNum])
                  const totalCardsInOrder = nomKeys.reduce((sum, nId) => sum + grouped[orderNum][nId].length, 0)

                  return (
                    <div key={orderNum} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '20px', overflow: 'hidden' }}>
                      
                      <div onClick={() => toggleOrder(orderNum)} style={{ background: '#111', padding: '15px 25px', display: 'flex', alignItems: 'center', borderBottom: expandedOrders[orderNum] ? '1px solid #1a1a1a' : 'none', cursor: 'pointer', transition: '0.2s' }}>
                         <div style={{ background: archiveTab === 'shop1' ? '#3b82f620' : '#8b5cf620', color: archiveTab === 'shop1' ? '#3b82f6' : '#8b5cf6', padding: '6px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 900, marginRight: '15px' }}>
                            ЗАМОВЛЕННЯ
                         </div>
                         <div style={{ fontSize: '1.2rem', fontWeight: 950, color: '#fff', flex: 1 }}>№{orderNum}</div>
                         <div style={{ color: '#555', fontSize: '0.7rem', fontWeight: 900, background: '#1a1a1a', padding: '6px 12px', borderRadius: '8px' }}>
                            {expandedOrders[orderNum] ? '▲ ЗГОРНУТИ' : `▼ РОЗГОРНУТИ (${totalCardsInOrder} записів)`}
                         </div>
                      </div>

                      {expandedOrders[orderNum] && (
                        <div style={{ padding: '15px 25px 25px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {nomKeys.map(nomId => {
                            const nom = nomenclatures.find(n => String(n.id) === String(nomId))
                            const items = grouped[orderNum][nomId]
                            const key = `${orderNum}_${nomId}`
                            
                            return (
                              <div key={nomId} style={{ background: '#111', borderRadius: '16px', overflow: 'hidden', border: '1px solid #1a1a1a' }}>
                                 <div onClick={() => toggleNom(orderNum, nomId)} style={{ padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }}>
                                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                       <div style={{ fontWeight: 900, color: '#e2e8f0', fontSize: '1rem' }}>{nom?.name || 'Деталь'}</div>
                                       {nom?.material_type && <div style={{ fontSize: '0.7rem', color: '#10b981', background: '#10b98115', padding: '4px 10px', borderRadius: '6px', fontWeight: 800 }}>{nom.material_type}</div>}
                                    </div>
                                    <div style={{ color: '#555', fontSize: '0.7rem', fontWeight: 900, background: '#0a0a0a', padding: '4px 10px', borderRadius: '6px' }}>
                                       {expandedNoms[key] ? '▲' : `▼ ${items.length} карток`}
                                    </div>
                                 </div>

                                 {expandedNoms[key] && (
                                   <div style={{ padding: '15px 20px', display: 'flex', flexDirection: 'column', gap: '8px', background: '#0a0a0a' }}>
                                     {items.map(h => (
                                       <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', background: '#111', borderRadius: '12px', border: '1px solid #1a1a1a' }}>
                                         <div style={{ display: 'flex', gap: '25px', alignItems: 'center' }}>
                                           <div style={{ width: '120px', color: '#555', fontSize: '0.65rem', fontWeight: 800 }}>{new Date(h.completed_at).toLocaleString()}</div>
                                           <div>
                                              <div style={{ fontSize: '0.65rem', color: '#555', marginBottom: '4px', fontWeight: 900, letterSpacing: '0.05em' }}>
                                                КАРТКА <span style={{ color: '#888' }}>#{h.card_id?.slice(0,8) || '---'}</span>
                                              </div>
                                              <div style={{ fontSize: '0.85rem', color: archiveTab === 'shop1' ? '#3b82f6' : '#8b5cf6', fontWeight: 900 }}>Етап: {h.stage_name}</div>
                                           </div>
                                         </div>
                                         <div style={{ display: 'flex', gap: '40px', alignItems: 'center' }}>
                                            <div style={{ textAlign: 'right' }}>
                                               <div style={{ fontSize: '1.2rem', fontWeight: 950, color: '#ff9000' }}>{h.qty_completed} <small style={{ fontSize: '0.6rem' }}>ШТ</small></div>
                                               {Number(h.scrap_qty) > 0 ? (
                                                 <div style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: 800 }}>БРАК: {h.scrap_qty}</div>
                                               ) : (
                                                 <div style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 800 }}>ОК</div>
                                               )}
                                            </div>
                                            <div style={{ width: '100px', textAlign: 'right' }}>
                                               <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fff' }}>{h.operator_name}</div>
                                            </div>
                                         </div>
                                       </div>
                                     ))}
                                   </div>
                                 )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })
              })()}
           </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .glass-panel { backdrop-filter: blur(10px); }
        .kpi-card:hover { transform: translateY(-5px); transition: 0.3s; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
        @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
      `}} />
    </div>
  )
}

export default AnalyticsModule
