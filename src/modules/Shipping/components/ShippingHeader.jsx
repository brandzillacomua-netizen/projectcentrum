import React from 'react'
import { Truck, ArrowLeft, User } from 'lucide-react'
import { Link } from 'react-router-dom'

export const ShippingHeader = React.memo(({ currentUser }) => {
  return (
    <header className="shipping-header" style={{ padding: '20px 40px', background: 'var(--header-bg, rgba(10,10,10,0.95))', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border, #1a1a1a)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <Link to="/" style={{ background: 'var(--card-bg, #111)', color: 'var(--text-secondary, #555)', width: '44px', height: '44px', borderRadius: '14px', border: '1px solid var(--border, #222)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s', textDecoration: 'none' }}>
          <ArrowLeft size={20} />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ background: 'linear-gradient(135deg, #ff9000 0%, #ff5e00 100%)', padding: '12px', borderRadius: '16px', boxShadow: '0 8px 20px rgba(255,144,0,0.25)' }}>
            <Truck size={24} color="#000" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0, letterSpacing: '-0.02em', color: 'var(--text, #fff)' }}>ЛОГІСТИЧНИЙ ЦЕНТР</h1>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary, #555)', fontWeight: 600, textTransform: 'uppercase', marginTop: '2px' }}>Управління відвантаженням та ТТН</div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text, #fff)' }}>{currentUser?.first_name} {currentUser?.last_name}</div>
          <div style={{ fontSize: '0.65rem', color: '#ff9000', fontWeight: 800 }}>ВІДДІЛ ВІДВАНТАЖЕННЯ</div>
        </div>
        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#ff900015', border: '1px solid #ff900030', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <User size={20} color="#ff9000" />
        </div>
      </div>
    </header>
  )
})

export default ShippingHeader
