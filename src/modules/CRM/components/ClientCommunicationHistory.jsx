import React, { useState } from 'react'
import { Phone, MessageSquare, Calendar, Mail, FileText, Plus, Send, User } from 'lucide-react'

export const ClientCommunicationHistory = ({ clientId, communications = [], onAddCommunication }) => {
  const [commType, setCommType] = useState('call') // 'call', 'meeting', 'note', 'email'
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) {
      alert('Будь ласка, введіть тему та опис комунікації!')
      return
    }

    onAddCommunication({
      clientId,
      type: commType,
      title: title.trim(),
      content: content.trim(),
      author: 'Олександр Менеджер'
    })

    setTitle('')
    setContent('')
    setShowAddForm(false)
  }

  const getTypeIcon = (type) => {
    switch (type) {
      case 'call': return <Phone size={16} color="#6366f1" />
      case 'meeting': return <Calendar size={16} color="#10b981" />
      case 'email': return <Mail size={16} color="#ff9000" />
      default: return <FileText size={16} color="#ec4899" />
    }
  }

  const getTypeName = (type) => {
    switch (type) {
      case 'call': return 'Дзвінок'
      case 'meeting': return 'Зустріч'
      case 'email': return 'Email'
      default: return 'Нотатка'
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header & Add Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
          Історія Комунікацій ({communications.length})
        </h4>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            padding: '7px 14px',
            borderRadius: '10px',
            background: 'rgba(99, 102, 241, 0.18)',
            border: '1px solid #6366f1',
            color: '#6366f1',
            fontWeight: 800,
            fontSize: '0.78rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Plus size={14} /> Додати Нотатку / Дзвінок
        </button>
      </div>

      {/* Form to Add Communication */}
      {showAddForm && (
        <form onSubmit={handleSubmit} style={{
          background: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: '16px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['call', 'meeting', 'note', 'email'].map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setCommType(t)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: commType === t ? '1px solid #6366f1' : '1px solid transparent',
                  background: commType === t ? '#6366f1' : 'rgba(255,255,255,0.05)',
                  color: commType === t ? '#fff' : 'var(--text-muted)',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                {getTypeName(t)}
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Тема комунікації (наприклад: Узгодження термінів)..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.3)', color: 'var(--text)', outline: 'none', fontSize: '0.85rem' }}
          />

          <textarea
            rows={3}
            placeholder="Деталі розмови, досягнуті домовленості..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.3)', color: 'var(--text)', outline: 'none', fontSize: '0.85rem', resize: 'vertical' }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}
            >
              Скасувати
            </button>
            <button
              type="submit"
              style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#6366f1', color: '#fff', fontWeight: 900, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Send size={13} /> Зберегти
            </button>
          </div>
        </form>
      )}

      {/* Timeline List */}
      {communications.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
          Немає збережених записів комунікацій. Натисніть «Додати Нотатку / Дзвінок».
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', paddingLeft: '14px' }}>
          {/* Vertical Timeline Line */}
          <div style={{ position: 'absolute', left: '6px', top: '10px', bottom: '10px', width: '2px', background: 'rgba(255,255,255,0.08)' }} />

          {communications.map((comm) => (
            <div key={comm.id} style={{
              position: 'relative',
              background: 'var(--card-bg, rgba(22, 24, 34, 0.6))',
              border: '1px solid var(--glass-border)',
              borderRadius: '14px',
              padding: '14px 16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {getTypeIcon(comm.type)}
                  <span style={{ fontSize: '0.88rem', fontWeight: 900, color: 'var(--text)' }}>
                    {comm.title}
                  </span>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {new Date(comm.createdAt).toLocaleString('uk-UA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                {comm.content}
              </p>

              <div style={{ marginTop: '8px', fontSize: '0.68rem', color: '#6366f1', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <User size={12} /> {comm.author || 'Менеджер'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
