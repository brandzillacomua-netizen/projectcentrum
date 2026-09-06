import React from 'react'
import { X } from 'lucide-react'

export const CrmLeadModal = ({
  isAddLeadOpen,
  setIsAddLeadOpen,
  editingLead,
  leadForm,
  setLeadForm,
  stages,
  handleSaveLead
}) => {
  if (!isAddLeadOpen) return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      backdropFilter: 'blur(10px)'
    }}>
      <div style={{
        background: 'var(--card-bg, #1a1a24)',
        border: '1px solid var(--glass-border)',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '520px',
        padding: '24px',
        color: 'var(--text)',
        boxShadow: '0 25px 50px rgba(0,0,0,0.4)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900 }}>
            {editingLead ? 'Редагування Ліда' : 'Новий Запит / Лід'}
          </h3>
          <button onClick={() => setIsAddLeadOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSaveLead} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Тема Запиту / Назва Ліда *</label>
            <input
              type="text"
              required
              placeholder="напр.: Запит на 50 рами F610..."
              value={leadForm.title}
              onChange={e => setLeadForm({ ...leadForm, title: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Замовник / Компанія *</label>
            <input
              type="text"
              required
              placeholder="напр.: ТОВ Метал-Тех..."
              value={leadForm.clientName}
              onChange={e => setLeadForm({ ...leadForm, clientName: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Телефон Контакту</label>
              <input
                type="text"
                placeholder="+380..."
                value={leadForm.phone}
                onChange={e => setLeadForm({ ...leadForm, phone: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Email</label>
              <input
                type="email"
                placeholder="info@client.com"
                value={leadForm.email}
                onChange={e => setLeadForm({ ...leadForm, email: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', outline: 'none' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Продукт / Виріб</label>
              <input
                type="text"
                placeholder="Рама / Корпус..."
                value={leadForm.productInterest}
                onChange={e => setLeadForm({ ...leadForm, productInterest: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Кількість</label>
              <input
                type="number"
                min={1}
                value={leadForm.quantity}
                onChange={e => setLeadForm({ ...leadForm, quantity: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Оціночна Сума (₴)</label>
              <input
                type="number"
                placeholder="0.00"
                value={leadForm.amount}
                onChange={e => setLeadForm({ ...leadForm, amount: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', outline: 'none' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Етап Воронки</label>
            <select
              value={leadForm.stageId}
              onChange={e => setLeadForm({ ...leadForm, stageId: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--card-bg, rgba(0,0,0,0.2))', color: 'var(--text)', outline: 'none', fontWeight: 700 }}
            >
              {stages.map(s => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Примітки / Коментар</label>
            <textarea
              rows={3}
              placeholder="Вкажіть особливі вимоги замовника..."
              value={leadForm.notes}
              onChange={e => setLeadForm({ ...leadForm, notes: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', outline: 'none', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => setIsAddLeadOpen(false)}
              style={{ padding: '10px 16px', borderRadius: '10px', border: 'none', background: 'transparent', color: 'var(--text-muted)', fontWeight: 800, cursor: 'pointer' }}
            >
              Скасувати
            </button>
            <button
              type="submit"
              style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: '#6366f1', color: '#fff', fontWeight: 900, cursor: 'pointer' }}
            >
              Зберегти Лід
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CrmLeadModal
