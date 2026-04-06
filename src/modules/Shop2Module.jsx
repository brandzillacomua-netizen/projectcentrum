import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Monitor, Clock, CheckCircle2 } from 'lucide-react'
import { useMES } from '../MESContext'

const Shop2Module = () => {
  const { tasks, orders } = useMES()

  // Фільтруємо наряди для Цеху №2 (Пресування)
  const shop2Tasks = tasks.filter(t => t.step === 'Пресування' && t.status !== 'completed')

  return (
    <div className="shop2-module" style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <header className="module-nav" style={{ padding: '20px', background: '#111', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/" className="back-link" style={{ color: '#fff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700 }}>
          <ArrowLeft size={18} /> На головну
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Monitor size={22} color="#8b5cf6" />
          <h1 style={{ margin: 0, textTransform: 'uppercase', fontSize: '1.2rem', fontWeight: 900 }}>Цех №2 · Пресування</h1>
        </div>
        <div style={{ width: '100px' }}></div>
      </header>

      <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 950 }}>Черга нарядів</h2>
          <p style={{ color: '#555', fontWeight: 700 }}>Наряди, що надійшли з Цеху №1 (Лазерна різка)</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {shop2Tasks.map(task => {
            const order = orders.find(o => o.id === task.order_id)
            return (
              <div key={task.id} className="glass-panel" style={{ background: '#111', padding: '25px', borderRadius: '24px', border: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ color: '#8b5cf6', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '5px' }}>НОВИЙ НАРЯД</div>
                    <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 950 }}>№ {order?.order_num}</h3>
                  </div>
                  <div style={{ background: '#8b5cf622', color: '#8b5cf6', padding: '5px 12px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 900 }}>ОЧІКУЄ</div>
                </div>
                
                <div style={{ borderTop: '1px solid #222', paddingTop: '15px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#666', fontWeight: 500 }}>ЗАМОВНИК:</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800 }}>{order?.customer}</div>
                </div>

                <div style={{ display: 'flex', gap: '20px', color: '#444', fontSize: '0.7rem', fontWeight: 700 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={14} /> {new Date(task.created_at).toLocaleDateString('uk-UA')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={14} /> Передано з Цеху №1
                  </div>
                </div>
              </div>
            )
          })}

          {shop2Tasks.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '100px', textAlign: 'center', color: '#222' }}>
              <Monitor size={80} style={{ opacity: 0.1, marginBottom: '20px' }} />
              <h3>Наразі черга порожня</h3>
              <p>Очікуйте на передачу нарядів від майстра першого цеху</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Shop2Module
