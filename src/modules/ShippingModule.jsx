import React, { useState } from 'react'
import { 
  Truck, 
  ArrowLeft, 
  CheckCircle2, 
  ClipboardList,
  AlertCircle,
  PackageCheck,
  Zap,
  X,
  Package
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'

const ShippingModule = () => {
  const { orders, updateOrderStatus, nomenclatures } = useMES()
  const [activeMobileSection, setActiveMobileSection] = useState('ready') // ready, plan

  const readyForShipping = orders.filter(o => o.status === 'completed')
  const inConsolidation = orders.filter(o => o.status === 'pending' || o.status === 'in-progress')

  return (
    <div className="shipping-module-v2" style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <nav className="module-nav" style={{ flexShrink: 0 }}>
        <Link to="/" className="back-link"><ArrowLeft size={18} /> <span className="hide-mobile">Назад</span></Link>
        <div className="module-title-group">
          <Truck className="text-secondary" size={24} />
          <h1 className="hide-mobile">Модуль Відвантаження</h1>
          <h1 className="mobile-only" style={{ fontSize: '1rem' }}>ЛОГІСТИКА</h1>
        </div>
      </nav>

      <div className="module-content" style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
        
        {/* Mobile Tabs */}
        <div className="mobile-only shipping-tabs" style={{ display: 'flex', background: '#111', padding: '5px', borderRadius: '14px', marginBottom: '25px' }}>
           <button onClick={() => setActiveMobileSection('ready')} className={`tab-btn-m ${activeMobileSection === 'ready' ? 'active' : ''}`}>ГОТОВО ({readyForShipping.length})</button>
           <button onClick={() => setActiveMobileSection('plan')} className={`tab-btn-m ${activeMobileSection === 'plan' ? 'active' : ''}`}>В ПЛАНІ ({inConsolidation.length})</button>
        </div>

        <div className="shipping-grid-layout" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px' }}>
           
           {/* READY FOR SHIPPING COLUMN */}
           {(activeMobileSection === 'ready' || !window.matchMedia("(max-width: 768px)").matches) && (
             <section className="ready-col">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                   <PackageCheck size={18} className="text-secondary" />
                   <h3 style={{ fontSize: '0.85rem', color: '#555', margin: 0, textTransform: 'uppercase' }}>Готово до відправки</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                   {readyForShipping.map(order => (
                     <div key={order.id} className="ship-card glass-panel" style={{ background: '#111', padding: '25px', borderRadius: '24px', border: '1px solid #222', borderLeft: '4px solid #10b981' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                           <div>
                              <strong style={{ fontSize: '1.2rem', display: 'block' }}>№{order.order_num}</strong>
                              <span style={{ fontSize: '0.9rem', color: '#888', fontWeight: 600 }}>{order.customer}</span>
                           </div>
                           <div style={{ background: '#10b98122', padding: '10px', borderRadius: '12px', color: '#10b981' }}><Zap size={20} /></div>
                        </div>
                        
                        <div style={{ background: '#0a0a0a', padding: '15px', borderRadius: '14px', marginBottom: '20px', border: '1px solid #1a1a1a' }}>
                           {order.order_items?.map((item, idx) => (
                             <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                <span style={{ color: '#444' }}>{nomenclatures.find(n => n.id === item.nomenclature_id)?.name}</span>
                                <strong>{item.quantity} шт</strong>
                             </div>
                           ))}
                        </div>

                        <button 
                          onClick={() => apiService.submitShipOrder(order.id, updateOrderStatus)}
                          style={{ width: '100%', padding: '18px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '14px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '0.95rem' }}
                        >
                           <Truck size={20} /> ВІДВАНТАЖИТИ ЗАРАЗ
                        </button>
                     </div>
                   ))}
                   {readyForShipping.length === 0 && <div className="empty-state-v2">Черга відвантаження порожня</div>}
                </div>
             </section>
           )}

           {/* PRODUCTION PLAN COLUMN */}
           {(activeMobileSection === 'plan' || !window.matchMedia("(max-width: 768px)").matches) && (
             <section className="plan-col">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                   <ClipboardList size={18} className="text-secondary" />
                   <h3 style={{ fontSize: '0.85rem', color: '#555', margin: 0, textTransform: 'uppercase' }}>Партії у виробництві</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                   {inConsolidation.map(order => (
                     <div key={order.id} style={{ background: '#0a0a0a', padding: '20px', borderRadius: '20px', border: '1px solid #1a1a1a', opacity: 0.8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                           <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>#{order.order_num} — {order.customer}</span>
                           <span style={{ fontSize: '0.6rem', padding: '4px 8px', borderRadius: '6px', background: '#222', color: '#ff9000', fontWeight: 900 }}>{order.status}</span>
                        </div>
                        <div style={{ width: '100%', height: '4px', background: '#111', borderRadius: '2px', overflow: 'hidden' }}>
                           <div style={{ width: order.status === 'in-progress' ? '60%' : '5%', height: '100%', background: '#ff9000', transition: '0.5s' }}></div>
                        </div>
                     </div>
                   ))}
                   {inConsolidation.length === 0 && <div className="empty-state-v2">Немає замовлень у виробництві</div>}
                </div>
             </section>
           )}

        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .tab-btn-m { flex: 1; padding: 12px; border: none; background: transparent; color: #444; font-weight: 900; font-size: 0.7rem; border-radius: 10px; cursor: pointer; transition: 0.3s; }
        .tab-btn-m.active { background: #222; color: #ff9000; }
        
        .ship-card { transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .ship-card:hover { transform: translateY(-5px); border-color: #10b981; box-shadow: 0 15px 35px rgba(16, 185, 129, 0.1); }
        
        .empty-state-v2 { text-align: center; padding: 60px 20px; color: #222; font-size: 0.85rem; border: 2px dashed #111; border-radius: 24px; }

        @media (max-width: 768px) { .hide-mobile { display: none !important; } }
        @media (min-width: 769px) { .mobile-only { display: none !important; } }
      `}} />
    </div>
  )
}

export default ShippingModule
