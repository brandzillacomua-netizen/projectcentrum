import React, { useState } from 'react'
import { X, Building, Phone, Mail, MapPin, Award, TrendingUp, ShoppingBag, MessageSquare, Plus, UserCheck } from 'lucide-react'
import { ClientOrderHistory } from './ClientOrderHistory'
import { ClientCommunicationHistory } from './ClientCommunicationHistory'

export const ClientCardDetailModal = ({
  client,
  isOpen,
  onClose,
  communications = [],
  onAddCommunication
}) => {
  const [activeTab, setActiveTab] = useState('orders') // 'orders', 'communications'

  if (!isOpen || !client) return null

  const isVip = client.segment === 'VIP'

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(10px)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '780px',
        maxHeight: '90vh',
        borderRadius: '24px',
        background: 'var(--card-bg)',
        border: '1px solid var(--glass-border)',
        padding: '28px',
        color: 'var(--text)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '16px',
              background: isVip ? 'linear-gradient(135deg, #ec4899, #be185d)' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: '#fff',
              fontWeight: 950,
              fontSize: '1.4rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(0,0,0,0.3)'
            }}>
              {client.name.charAt(0)}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 950 }}>{client.name}</h2>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '0.7rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  background: isVip ? 'rgba(236, 72, 153, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                  color: isVip ? '#ec4899' : '#6366f1',
                  border: isVip ? '1px solid rgba(236, 72, 153, 0.4)' : '1px solid rgba(99, 102, 241, 0.4)'
                }}>
                  {client.segment}
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Контакт: {client.contactPerson} · Менеджер: {client.manager}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={22} /></button>
        </div>

        {/* Financial Metrics Strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '14px',
          padding: '16px',
          borderRadius: '16px',
          background: 'rgba(0,0,0,0.2)',
          border: '1px solid var(--glass-border)',
          marginBottom: '20px'
        }}>
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Загальний LTV (Вал)</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 950, color: '#10b981', marginTop: '2px' }}>
              {client.totalRevenue > 0 ? `₴${client.totalRevenue.toLocaleString()}` : '₴0'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Середній Чек</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 950, color: '#ff9000', marginTop: '2px' }}>
              {client.avgCheck > 0 ? `₴${client.avgCheck.toLocaleString()}` : '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Всього Замовлень</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 950, color: '#6366f1', marginTop: '2px' }}>
              {client.ordersCount} шт
            </div>
          </div>
        </div>

        {/* Contact Details Quick Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
          fontSize: '0.8rem',
          color: 'var(--text-muted)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Phone size={14} color="#6366f1" /> {client.phone || '—'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Mail size={14} color="#ff9000" /> {client.email || '—'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={14} color="#10b981" /> {client.city || 'Україна'}, {client.address || ''}
          </div>
        </div>

        {/* Tabs Bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', marginBottom: '18px' }}>
          <button
            onClick={() => setActiveTab('orders')}
            style={{
              padding: '10px 18px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'orders' ? '2.5px solid #ff9000' : '2.5px solid transparent',
              color: activeTab === 'orders' ? '#ff9000' : 'var(--text-muted)',
              fontWeight: 900,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Історія Замовлень ({client.ordersCount})
          </button>
          <button
            onClick={() => setActiveTab('communications')}
            style={{
              padding: '10px 18px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'communications' ? '2.5px solid #ff9000' : '2.5px solid transparent',
              color: activeTab === 'communications' ? '#ff9000' : 'var(--text-muted)',
              fontWeight: 900,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Таймлайн Комунікацій ({communications.length})
          </button>
        </div>

        {/* Tab Body */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
          {activeTab === 'orders' && (
            <ClientOrderHistory orders={client.orders} />
          )}

          {activeTab === 'communications' && (
            <ClientCommunicationHistory
              clientId={client.id}
              communications={communications}
              onAddCommunication={onAddCommunication}
            />
          )}
        </div>
      </div>
    </div>
  )
}
