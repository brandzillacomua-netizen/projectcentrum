import React, { useState, useEffect } from 'react'
import {
  ArrowLeft,
  Edit3,
  Check,
  X,
  Phone,
  Mail,
  MapPin,
  Building,
  User,
  Crown,
  FileText,
  Award,
  TrendingUp,
  ShoppingBag,
  Send,
  ShieldCheck,
  Sparkles,
  Truck,
  Trash2
} from 'lucide-react'
import { useMES } from '../../../MESContext'
import { ClientOrderHistory } from './ClientOrderHistory'
import { ClientCommunicationHistory } from './ClientCommunicationHistory'
import { NovaPoshtaDeliverySelect } from './NovaPoshtaDeliverySelect'
import { DeleteClientModal } from './DeleteClientModal'

export const ClientDetailPage = ({
  client,
  onBack,
  onUpdateClient,
  onDeleteClient,
  onCreateClient,
  communications = [],
  onAddCommunication
}) => {
  const { currentUser } = useMES()
  const isAdmin = currentUser?.login === 'admin@workshop.local' || currentUser?.role === 'admin' || currentUser?.role === 'director' || (currentUser?.position || '').toLowerCase().includes('адмін')
  const isNew = !client || client.id === 'new'
  const [isEditing, setIsEditing] = useState(isNew)
  const [activeTab, setActiveTab] = useState('orders') // 'orders', 'communications'
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  const [selectedAddressIdx, setSelectedAddressIdx] = useState(0)

  // Editable Form State
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    tin: '',
    city: '',
    address: '',
    manager: '',
    segment: 'Regular',
    notes: '',
    deliveryAddresses: [],
    deliveryMethod: 'np_warehouse',
    deliveryCity: 'Київ',
    deliveryWarehouse: '',
    deliveryAddress: '',
    deliveryRecipientName: '',
    deliveryRecipientPhone: ''
  })

  useEffect(() => {
    if (client) {
      const rawAddrs = client.deliveryAddresses || []
      const addresses = rawAddrs.length > 0 ? rawAddrs : [
        {
          id: 'addr_' + Date.now(),
          title: 'Основна адреса',
          deliveryMethod: client?.deliveryMethod || 'np_warehouse',
          city: client?.deliveryCity || client?.city || 'Київ',
          warehouse: client?.deliveryWarehouse || '',
          address: client?.deliveryAddress || client?.address || '',
          recipientName: client?.deliveryRecipientName || client?.contactPerson || '',
          recipientPhone: client?.deliveryRecipientPhone || client?.phone || '',
          isLegalEntity: client?.isLegalEntity || false,
          edrpou: client?.edrpou || client?.tin || '',
          legalEntityName: client?.legalEntityName || client?.company || '',
          isDefault: true
        }
      ]

      const defaultAddr = addresses.find(a => a.isDefault) || addresses[0]

      setFormData({
        name: client.name || '',
        contactPerson: client.contactPerson || '',
        phone: client.phone || '',
        email: client.email || '',
        tin: client.tin || '',
        city: client.city || 'Київ',
        address: client.address || '',
        manager: client.manager || 'Олександр Менеджер',
        segment: client.segment || 'Regular',
        notes: client.notes || (isNew ? '' : 'Надійний постійний партнер'),
        deliveryAddresses: addresses,
        deliveryMethod: defaultAddr?.deliveryMethod || client?.deliveryMethod || 'np_warehouse',
        deliveryCity: defaultAddr?.city || client?.deliveryCity || client?.city || 'Київ',
        deliveryWarehouse: defaultAddr?.warehouse || client?.deliveryWarehouse || '',
        deliveryAddress: defaultAddr?.address || client?.deliveryAddress || client?.address || '',
        deliveryRecipientName: defaultAddr?.recipientName || client?.deliveryRecipientName || client?.contactPerson || '',
        deliveryRecipientPhone: defaultAddr?.recipientPhone || client?.deliveryRecipientPhone || client?.phone || '',
        isLegalEntity: defaultAddr?.isLegalEntity !== undefined ? defaultAddr.isLegalEntity : (client?.isLegalEntity || false),
        edrpou: defaultAddr?.edrpou || client?.edrpou || client?.tin || '',
        legalEntityName: defaultAddr?.legalEntityName || client?.legalEntityName || client?.company || ''
      })
      setSelectedAddressIdx(0)
    }
  }, [client])

  if (!client) return null

  const isVip = formData.segment === 'VIP'

  const handleSave = (e) => {
    if (e) e.preventDefault()
    if (!formData.name.trim()) {
      alert('Будь ласка, введіть назву компанії або клієнта!')
      return
    }

    if (isNew && onCreateClient) {
      onCreateClient(formData)
    } else if (onUpdateClient) {
      onUpdateClient(client.id, formData)
      setIsEditing(false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Navigation Top Header */}
      <div className="client-detail-top-bar" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        paddingLeft: '65px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={onBack}
            style={{
              padding: '10px 16px',
              borderRadius: '12px',
              border: '1px solid var(--glass-border)',
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--text)',
              fontWeight: 850,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <ArrowLeft size={18} /> Назад до бази клієнтів
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 950, letterSpacing: '-0.4px', color: 'var(--text)' }}>
                {formData.name}
              </h1>
              <span style={{
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '0.72rem',
                fontWeight: 900,
                textTransform: 'uppercase',
                background: isVip ? 'rgba(236, 72, 153, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                color: isVip ? '#ec4899' : '#6366f1',
                border: isVip ? '1px solid rgba(236, 72, 153, 0.4)' : '1px solid rgba(99, 102, 241, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                {isVip && <Crown size={13} />} {formData.segment}
              </span>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Контакт: {formData.contactPerson} · Менеджер: {formData.manager}
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '12px',
                  border: '1px solid var(--glass-border)',
                  background: 'transparent',
                  color: 'var(--text)',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Скасувати
              </button>
              <button
                onClick={handleSave}
                style={{
                  padding: '10px 20px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#fff',
                  fontWeight: 950,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.35)'
                }}
              >
                <Check size={18} /> Зберегти Зміни
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '12px',
                  border: '1px solid #6366f1',
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: '#6366f1',
                  fontWeight: 900,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Edit3 size={16} /> Редагувати Картку
              </button>
              {formData.phone && formData.phone !== '—' && (
                <a
                  href={`tel:${formData.phone}`}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '12px',
                    border: '1px solid var(--glass-border)',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--text)',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    textDecoration: 'none'
                  }}
                >
                  <Phone size={16} color="#10b981" /> Дзвінок
                </a>
              )}
              {isAdmin && !isNew && onDeleteClient && (
                <button
                  onClick={() => setIsDeleteModalOpen(true)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '12px',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    background: 'rgba(239, 68, 68, 0.12)',
                    color: '#ef4444',
                    fontWeight: 900,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Trash2 size={16} /> Видалити Клієнта
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Save Success Alert Banner */}
      {saveSuccess && (
        <div style={{
          padding: '14px 20px',
          borderRadius: '14px',
          background: 'rgba(16, 185, 129, 0.18)',
          border: '1px solid #10b981',
          color: '#10b981',
          fontWeight: 900,
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <Check size={20} /> Картку клієнта успішно оновлено!
        </div>
      )}

      {/* Executive Financial KPI Strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px'
      }}>
        {/* KPI 1: LTV */}
        <div className="glass-panel" style={{ padding: '20px 24px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.18)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 850, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Загальний LTV (Вал)
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 950, color: '#10b981', marginTop: '2px' }}>
              {client.totalRevenue > 0 ? `₴${client.totalRevenue.toLocaleString()}` : '₴0'}
            </div>
          </div>
        </div>

        {/* KPI 2: Avg Check */}
        <div className="glass-panel" style={{ padding: '20px 24px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(255, 144, 0, 0.18)', color: '#ff9000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Award size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 850, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Середній Чек
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 950, color: '#ff9000', marginTop: '2px' }}>
              {client.avgCheck > 0 ? `₴${client.avgCheck.toLocaleString()}` : '—'}
            </div>
          </div>
        </div>

        {/* KPI 3: Total Orders */}
        <div className="glass-panel" style={{ padding: '20px 24px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(99, 102, 241, 0.18)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShoppingBag size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 850, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Всього Замовлень
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 950, color: '#6366f1', marginTop: '2px' }}>
              {client.ordersCount} шт
            </div>
          </div>
        </div>

        {/* KPI 4: Last Contact */}
        <div className="glass-panel" style={{ padding: '20px 24px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(236, 72, 153, 0.18)', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 850, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Останній Контакт
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 950, color: 'var(--text)', marginTop: '4px' }}>
              {new Date(client.lastOrderDate).toLocaleDateString('uk-UA')}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Layout Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 360px) 1fr', gap: '24px', width: '100%' }}>
        {/* Left Column: Client Profile & Editable Form */}
        <div className="glass-panel" style={{ borderRadius: '24px', padding: '24px', height: 'fit-content' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '18px',
              background: isVip ? 'linear-gradient(135deg, #ec4899, #be185d)' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: '#fff',
              fontWeight: 950,
              fontSize: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(0,0,0,0.3)'
            }}>
              {formData.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 950, color: 'var(--text)' }}>
                {formData.name}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                ID: {client.id}
              </div>
            </div>
          </div>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Field: Company Name */}
            <div>
              <label style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                Назва Компанії / Клієнта
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #6366f1', background: 'rgba(0,0,0,0.3)', color: 'var(--text)', outline: 'none', fontWeight: 800 }}
                />
              ) : (
                <div style={{ fontSize: '0.9rem', fontWeight: 850, color: 'var(--text)' }}>{formData.name}</div>
              )}
            </div>

            {/* Field: Contact Person */}
            <div>
              <label style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                Контактна Особа (ПІБ)
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #6366f1', background: 'rgba(0,0,0,0.3)', color: 'var(--text)', outline: 'none', fontWeight: 800 }}
                />
              ) : (
                <div style={{ fontSize: '0.88rem', fontWeight: 750, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <User size={15} color="#6366f1" /> {formData.contactPerson || '—'}
                </div>
              )}
            </div>

            {/* Field: Phone */}
            <div>
              <label style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                Телефон
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #6366f1', background: 'rgba(0,0,0,0.3)', color: 'var(--text)', outline: 'none', fontWeight: 800 }}
                />
              ) : (
                <div style={{ fontSize: '0.88rem', fontWeight: 750, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Phone size={15} color="#10b981" /> {formData.phone || '—'}
                </div>
              )}
            </div>

            {/* Field: Email */}
            <div>
              <label style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                Email
              </label>
              {isEditing ? (
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #6366f1', background: 'rgba(0,0,0,0.3)', color: 'var(--text)', outline: 'none', fontWeight: 800 }}
                />
              ) : (
                <div style={{ fontSize: '0.88rem', fontWeight: 750, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Mail size={15} color="#ff9000" /> {formData.email || '—'}
                </div>
              )}
            </div>

            {/* Field: TIN / ЄДРПОУ */}
            <div>
              <label style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                ЄДРПОУ / ІПН
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.tin}
                  onChange={(e) => setFormData({ ...formData, tin: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #6366f1', background: 'rgba(0,0,0,0.3)', color: 'var(--text)', outline: 'none', fontWeight: 800 }}
                />
              ) : (
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text)' }}>
                  {formData.tin || '—'}
                </div>
              )}
            </div>

            {/* Field: City & Address */}
            <div>
              <label style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                Місто та Адреса
              </label>
              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Місто"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1px solid #6366f1', background: 'rgba(0,0,0,0.3)', color: 'var(--text)', outline: 'none' }}
                  />
                  <input
                    type="text"
                    placeholder="Адреса"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1px solid #6366f1', background: 'rgba(0,0,0,0.3)', color: 'var(--text)', outline: 'none' }}
                  />
                </div>
              ) : (
                <div style={{ fontSize: '0.85rem', fontWeight: 750, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={15} color="#ec4899" /> {formData.city}, {formData.address || ''}
                </div>
              )}
            </div>

            {/* Field: Segment */}
            <div>
              <label style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                Сегмент
              </label>
              {isEditing ? (
                <select
                  value={formData.segment}
                  onChange={(e) => setFormData({ ...formData, segment: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #6366f1', background: 'rgba(0,0,0,0.3)', color: 'var(--text)', outline: 'none', fontWeight: 800 }}
                >
                  <option value="Regular" style={{ background: '#1c1c24' }}>Постійний Клієнт</option>
                  <option value="VIP" style={{ background: '#1c1c24' }}>👑 VIP Клієнт</option>
                </select>
              ) : (
                <div style={{ fontSize: '0.85rem', fontWeight: 900, color: isVip ? '#ec4899' : '#6366f1' }}>
                  {formData.segment}
                </div>
              )}
            </div>

            {/* Field: Manager Notes */}
            <div>
              <label style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                Примітки Менеджера
              </label>
              {isEditing ? (
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #6366f1', background: 'rgba(0,0,0,0.3)', color: 'var(--text)', outline: 'none', fontSize: '0.82rem', resize: 'vertical' }}
                />
              ) : (
                <div style={{ fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.4, background: 'var(--glass-border, rgba(0,0,0,0.05))', padding: '10px 12px', borderRadius: '10px' }}>
                  {formData.notes || 'Немає додаткових приміток.'}
                </div>
              )}
            </div>

            {/* Field Group: Delivery & Nova Poshta (Multiple Addresses Support) */}
            <div style={{ marginTop: '10px', paddingTop: '16px', borderTop: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Truck size={18} color="#ff9000" />
                  <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 950, color: 'var(--text)' }}>
                    Адреси доставки клієнта ({formData.deliveryAddresses?.length || 1})
                  </h4>
                </div>
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => {
                      const newAddr = {
                        id: 'addr_' + Date.now(),
                        title: `Адреса #${(formData.deliveryAddresses || []).length + 1}`,
                        deliveryMethod: 'np_warehouse',
                        city: formData.city || 'Київ',
                        warehouse: '',
                        address: '',
                        recipientName: formData.contactPerson || '',
                        recipientPhone: formData.phone || '',
                        isLegalEntity: false,
                        edrpou: '',
                        legalEntityName: '',
                        isDefault: (formData.deliveryAddresses || []).length === 0
                      }
                      setFormData(prev => ({
                        ...prev,
                        deliveryAddresses: [...(prev.deliveryAddresses || []), newAddr]
                      }))
                      setSelectedAddressIdx((formData.deliveryAddresses || []).length)
                    }}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '8px',
                      border: '1px solid #ff9000',
                      background: 'rgba(255,144,0,0.12)',
                      color: '#ff9000',
                      fontSize: '0.72rem',
                      fontWeight: 900,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    + Додати ще адресу
                  </button>
                )}
              </div>

              {/* Delivery Address Selector Pills */}
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '14px' }}>
                {(formData.deliveryAddresses || []).map((addr, idx) => {
                  const isSel = selectedAddressIdx === idx
                  const isDef = addr.isDefault
                  return (
                    <button
                      key={addr.id || idx}
                      type="button"
                      onClick={() => setSelectedAddressIdx(idx)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '10px',
                        border: isSel ? '1.5px solid #ff9000' : '1px solid var(--glass-border)',
                        background: isSel ? 'rgba(255, 144, 0, 0.16)' : 'var(--glass-border, rgba(0,0,0,0.03))',
                        color: isSel ? '#ff9000' : 'var(--text-muted)',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s'
                      }}
                    >
                      <span>📍 {addr.title || addr.city || `Адреса #${idx + 1}`}</span>
                      {isDef && (
                        <span style={{ background: '#ff9000', color: '#000', padding: '1px 5px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 950 }}>
                          ★ Основна
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Controls for currently selected address */}
              {(() => {
                const currentAddr = (formData.deliveryAddresses || [])[selectedAddressIdx] || (formData.deliveryAddresses || [])[0] || {}
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {isEditing && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                        <input
                          type="text"
                          value={currentAddr.title || ''}
                          onChange={(e) => {
                            const newTitle = e.target.value
                            setFormData(prev => {
                              const list = [...(prev.deliveryAddresses || [])]
                              const idx = selectedAddressIdx < list.length ? selectedAddressIdx : 0
                              list[idx] = { ...list[idx], title: newTitle }
                              return { ...prev, deliveryAddresses: list }
                            })
                          }}
                          placeholder="Назва адреси (напр. Склад Калуш)..."
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text)',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            outline: 'none',
                            flex: 1
                          }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {!currentAddr.isDefault && (
                            <button
                              type="button"
                              onClick={() => {
                                setFormData(prev => {
                                  const list = (prev.deliveryAddresses || []).map((a, i) => ({
                                    ...a,
                                    isDefault: i === selectedAddressIdx
                                  }))
                                  const def = list[selectedAddressIdx]
                                  return {
                                    ...prev,
                                    deliveryAddresses: list,
                                    deliveryMethod: def.deliveryMethod,
                                    deliveryCity: def.city,
                                    deliveryWarehouse: def.warehouse,
                                    deliveryAddress: def.address,
                                    deliveryRecipientName: def.recipientName,
                                    deliveryRecipientPhone: def.recipientPhone
                                  }
                                })
                              }}
                              style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #ff9000', background: 'transparent', color: '#ff9000', fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer' }}
                            >
                              ★ Зробити основною
                            </button>
                          )}
                          {(formData.deliveryAddresses || []).length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setFormData(prev => {
                                  const list = prev.deliveryAddresses.filter((_, i) => i !== selectedAddressIdx)
                                  if (!list.some(a => a.isDefault)) list[0].isDefault = true
                                  return { ...prev, deliveryAddresses: list }
                                })
                                setSelectedAddressIdx(0)
                              }}
                              style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer' }}
                            >
                              Видалити
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <NovaPoshtaDeliverySelect
                      deliveryMethod={currentAddr.deliveryMethod || 'np_warehouse'}
                      city={currentAddr.city || formData.city || 'Київ'}
                      warehouse={currentAddr.warehouse || ''}
                      address={currentAddr.address || ''}
                      recipientName={currentAddr.recipientName || formData.contactPerson || ''}
                      recipientPhone={currentAddr.recipientPhone || formData.phone || ''}
                      isLegalEntity={currentAddr.isLegalEntity || false}
                      edrpou={currentAddr.edrpou || formData.tin || ''}
                      legalEntityName={currentAddr.legalEntityName || formData.name || ''}
                      isEditing={isEditing}
                      onChange={(updates) => {
                        setFormData(prev => {
                          const list = [...(prev.deliveryAddresses || [])]
                          const idx = selectedAddressIdx < list.length ? selectedAddressIdx : 0
                          list[idx] = { ...list[idx], ...updates }

                          const isDef = list[idx].isDefault
                          const defaultAddr = list.find(a => a.isDefault) || list[0] || {}

                          return {
                            ...prev,
                            deliveryAddresses: list,
                            deliveryMethod: defaultAddr.deliveryMethod,
                            deliveryCity: defaultAddr.city,
                            deliveryWarehouse: defaultAddr.warehouse,
                            deliveryAddress: defaultAddr.address,
                            deliveryRecipientName: defaultAddr.recipientName,
                            deliveryRecipientPhone: defaultAddr.recipientPhone,
                            ...(isDef ? {
                              isLegalEntity: defaultAddr.isLegalEntity,
                              edrpou: defaultAddr.edrpou,
                              legalEntityName: defaultAddr.legalEntityName
                            } : {})
                          }
                        })
                      }}
                    />
                  </div>
                )
              })()}
            </div>

            {isEditing && (
              <button
                type="submit"
                style={{
                  marginTop: '15px',
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#fff',
                  fontWeight: 950,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.35)'
                }}
              >
                <Check size={18} /> {isNew ? 'Зберегти Нового Клієнта' : 'Зберегти Картку Клієнта'}
              </button>
            )}
          </form>
        </div>

        {/* Right Column: Main Content Tabs */}
        <div className="glass-panel" style={{ borderRadius: '24px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
          {/* Tabs Navigation Header */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', marginBottom: '20px' }}>
            <button
              onClick={() => setActiveTab('orders')}
              style={{
                padding: '12px 20px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'orders' ? '3px solid #ff9000' : '3px solid transparent',
                color: activeTab === 'orders' ? '#ff9000' : 'var(--text-muted)',
                fontWeight: 950,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              📋 Історія Замовлень ({client.ordersCount})
            </button>
            <button
              onClick={() => setActiveTab('communications')}
              style={{
                padding: '12px 20px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'communications' ? '3px solid #ff9000' : '3px solid transparent',
                color: activeTab === 'communications' ? '#ff9000' : 'var(--text-muted)',
                fontWeight: 950,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              💬 Таймлайн Комунікацій ({communications.length})
            </button>
          </div>

          {/* Active Tab Content */}
          <div>
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

      <DeleteClientModal
        isOpen={isDeleteModalOpen}
        clientName={formData.name}
        onConfirm={() => {
          onDeleteClient(client.id, formData.name)
          setIsDeleteModalOpen(false)
          if (onBack) onBack()
        }}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
    </div>
  )
}
