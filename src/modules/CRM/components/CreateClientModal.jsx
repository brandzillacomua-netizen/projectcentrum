import React, { useState } from 'react'
import { X, UserPlus, Building, Phone, Mail, MapPin, ShieldCheck, User } from 'lucide-react'

export const CreateClientModal = ({ isOpen, onClose, onSave }) => {
  const [name, setName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [tin, setTin] = useState('')
  const [city, setCity] = useState('Київ')
  const [address, setAddress] = useState('')
  const [segment, setSegment] = useState('Regular') // 'Regular', 'VIP'
  const [manager, setManager] = useState('Олександр Менеджер')

  if (!isOpen) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) {
      alert('Будь ласка, введіть назву компанії або клієнта!')
      return
    }

    onSave({
      name: name.trim(),
      company: name.trim(),
      contactPerson: contactPerson.trim() || name.trim(),
      phone: phone.trim() || '—',
      email: email.trim() || '—',
      tin: tin.trim() || '—',
      city: city.trim() || 'Київ',
      address: address.trim() || '—',
      segment,
      manager
    })

    // Reset form
    setName('')
    setContactPerson('')
    setPhone('')
    setEmail('')
    setTin('')
    setAddress('')
    onClose()
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(8px)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '560px',
        borderRadius: '24px',
        background: 'var(--card-bg)',
        border: '1px solid var(--glass-border)',
        padding: '28px',
        color: 'var(--text)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.2)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserPlus size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 950 }}>Додати Нового Клієнта</h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Створення картки компанії чи замовника в CRM</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Назва Компанії / Клієнта *
            </label>
            <input
              type="text"
              required
              placeholder="Наприклад: ТОВ Брандзілла або ФОП Коваленко"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Контактна Особа
              </label>
              <input
                type="text"
                placeholder="ПІБ контактної особи"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Телефон
              </label>
              <input
                type="text"
                placeholder="+380..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', outline: 'none' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Email
              </label>
              <input
                type="email"
                placeholder="client@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                ЄДРПОУ / ІПН (TIN)
              </label>
              <input
                type="text"
                placeholder="8-10 цифр"
                value={tin}
                onChange={(e) => setTin(e.target.value)}
                style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', outline: 'none' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Місто
              </label>
              <input
                type="text"
                placeholder="Київ, Львів..."
                value={city}
                onChange={(e) => setCity(e.target.value)}
                style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Сегмент
              </label>
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                style={{ width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', outline: 'none' }}
              >
                <option value="Regular" style={{ background: '#1c1c24' }}>Постійний Клієнт</option>
                <option value="VIP" style={{ background: '#1c1c24' }}>VIP Клієнт</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text)', fontWeight: 800, cursor: 'pointer' }}
            >
              Скасувати
            </button>
            <button
              type="submit"
              style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#fff', fontWeight: 950, cursor: 'pointer' }}
            >
              Створити Клієнта
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
