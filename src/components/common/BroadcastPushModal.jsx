import React, { useState, useEffect } from 'react'
import {
  Bell,
  Send,
  X,
  Users,
  Building2,
  User,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Radio,
  ExternalLink,
  Smartphone,
  ShieldCheck,
  FileText
} from 'lucide-react'
import { useMES } from '../../MESContext'
import {
  sendBroadcastPush,
  sendPushToUsers,
  getActivePushSubscriptionsCount,
  isPushSubscribed,
  subscribeToPush
} from '../../services/pushService'
import { corporateApi } from '../../modules/Corporate/services/corporateApi'

const TEMPLATES = [
  {
    id: 'urgent_meeting',
    label: 'Терміновий збір',
    title: 'Терміновий збір команди',
    body: 'Прохання всім відповідальним працівникам терміново зібратися на нараду.',
    path: '/corporate'
  },
  {
    id: 'official_order',
    label: 'Офіційний наказ',
    title: 'Офіційне повідомлення керівництва',
    body: 'Увага: опубліковано нове розпорядження керівництва підприємства. Ознайомтеся з деталями.',
    path: '/corporate'
  },
  {
    id: 'schedule_change',
    label: 'Зміна графіку',
    title: 'Зміна графіку / розкладу змін',
    body: 'Зверніть увагу: оновлено робочий графік змін. Перевірте актуальний розклад.',
    path: '/settings'
  },
  {
    id: 'equipment_maintenance',
    label: 'Технічні роботи',
    title: 'Технічне обслуговування обладнання',
    body: 'Початок планового технічного обслуговування. Прохання зупинити поточні операції.',
    path: '/machines'
  },
  {
    id: 'priority_shipping',
    label: 'Термінове замовлення',
    title: 'Пріоритетне відвантаження',
    body: 'Термінове замовлення передано на комплектацію та контроль якості.',
    path: '/shipping'
  }
]

export function BroadcastPushModal({ isOpen, onClose }) {
  const { currentUser, systemUsers = [] } = useMES()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [path, setPath] = useState('/corporate')
  const [audience, setAudience] = useState('all') // 'all', 'department', 'specific'
  const [selectedDept, setSelectedDept] = useState('all')
  const [selectedUserIds, setSelectedUserIds] = useState([])
  const [alsoPostToCorporate, setAlsoPostToCorporate] = useState(false)

  // Status & device metrics
  const [subscribedCount, setSubscribedCount] = useState(0)
  const [isCurrentDeviceSubscribed, setIsCurrentDeviceSubscribed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resultMessage, setResultMessage] = useState(null) // { type: 'success' | 'error', text: '' }

  // Load device counts and permissions on mount
  useEffect(() => {
    if (!isOpen) return
    getActivePushSubscriptionsCount().then(cnt => setSubscribedCount(cnt))
    isPushSubscribed().then(sub => setIsCurrentDeviceSubscribed(sub))
    setResultMessage(null)
  }, [isOpen])

  if (!isOpen) return null

  const handleApplyTemplate = (tpl) => {
    setTitle(tpl.title)
    setBody(tpl.body)
    if (tpl.path) setPath(tpl.path)
  }

  const handleSubscribeCurrentDevice = async () => {
    if (!currentUser?.id) return
    const ok = await subscribeToPush(currentUser.id)
    if (ok) {
      setIsCurrentDeviceSubscribed(true)
      const count = await getActivePushSubscriptionsCount()
      setSubscribedCount(count)
    }
  }

  const handleSendPush = async (e) => {
    e.preventDefault()
    if (!title.trim() || !body.trim() || isSubmitting) return

    setIsSubmitting(true)
    setResultMessage(null)

    try {
      let sentCount = 0

      // 1. Determine target and send
      if (audience === 'all') {
        const res = await sendBroadcastPush(title.trim(), body.trim(), path, {
          senderName: currentUser?.first_name || currentUser?.login || 'Адміністратор',
          sentAt: new Date().toISOString()
        })
        sentCount = res?.sent || subscribedCount || 1
      } else if (audience === 'department') {
        const deptUsers = (systemUsers || []).filter(u => {
          if (selectedDept === 'all') return true
          return (u.department || '').toLowerCase().includes(selectedDept.toLowerCase())
        })
        const userIds = deptUsers.map(u => u.id).filter(Boolean)
        await sendPushToUsers(userIds, title.trim(), body.trim(), path)
        sentCount = userIds.length
      } else if (audience === 'specific') {
        await sendPushToUsers(selectedUserIds, title.trim(), body.trim(), path)
        sentCount = selectedUserIds.length
      }

      // 2. Optionally create corporate post
      if (alsoPostToCorporate && currentUser?.id) {
        try {
          await corporateApi.createPost({
            author_id: currentUser.id,
            title: title.trim(),
            content: body.trim(),
            category: 'announcement',
            is_pinned: true,
            requires_ack: true
          })
        } catch (postErr) {
          console.warn('[BroadcastPushModal] Could not create corporate post:', postErr)
        }
      }

      // Save to local broadcast history
      try {
        const history = JSON.parse(localStorage.getItem('centrum_push_broadcast_history') || '[]')
        history.unshift({
          id: Date.now(),
          title: title.trim(),
          body: body.trim(),
          path,
          audience,
          sender: currentUser?.first_name ? `${currentUser.first_name} ${currentUser.last_name || ''}`.trim() : currentUser?.login,
          sentAt: new Date().toISOString(),
          sentCount
        })
        localStorage.setItem('centrum_push_broadcast_history', JSON.stringify(history.slice(0, 30)))
      } catch {}

      setResultMessage({
        type: 'success',
        text: `Push-сповіщення успішно надіслано на підписані пристрої!`
      })

      // Reset form after 2.5s or close
      setTimeout(() => {
        setTitle('')
        setBody('')
        setResultMessage(null)
      }, 3000)

    } catch (err) {
      console.error('[BroadcastPushModal] Send error:', err)
      setResultMessage({
        type: 'error',
        text: 'Помилка при відправці сповіщення: ' + (err.message || 'Перевірте інтернет-з’єднання')
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filter distinct departments from system users
  const departments = Array.from(new Set(systemUsers.map(u => u.department).filter(Boolean)))

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(8px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--ch-surface-solid, #121622)',
          border: '1px solid var(--ch-border, rgba(255, 255, 255, 0.12))',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '580px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65)',
          overflow: 'hidden',
          color: 'var(--ch-text-primary, #ffffff)',
          fontFamily: "'Inter', sans-serif"
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── HEADER ────────────────────────────────────────────────────────── */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--ch-border, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.08) 0%, transparent 100%)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 6px 16px rgba(99, 102, 241, 0.35)'
              }}
            >
              <Radio size={22} />
            </div>

            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
                Центр Push-сповіщень
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--ch-text-muted, #94a3b8)' }}>
                  Масова розсилка на браузери та телефони
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    padding: '2px 7px',
                    borderRadius: '6px',
                    border: '1px solid rgba(16, 185, 129, 0.3)'
                  }}
                >
                  {subscribedCount} пристроїв онлайн
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--ch-text-dim, #64748b)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* ── BODY ──────────────────────────────────────────────────────────── */}
        <form
          onSubmit={handleSendPush}
          style={{
            padding: '24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}
        >
          {/* Status Alert if device not subscribed */}
          {!isCurrentDeviceSubscribed && (
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '12px',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#f59e0b' }}>
                <Smartphone size={16} />
                <span>Цей браузер ще не підписаний на отримання сповіщень.</span>
              </div>
              <button
                type="button"
                onClick={handleSubscribeCurrentDevice}
                style={{
                  background: '#f59e0b',
                  border: 'none',
                  color: '#000',
                  fontWeight: 800,
                  fontSize: '0.74rem',
                  padding: '5px 10px',
                  borderRadius: '7px',
                  cursor: 'pointer'
                }}
              >
                Підписати
              </button>
            </div>
          )}

          {/* Quick Templates */}
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--ch-text-dim, #94a3b8)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.04em' }}>
              Швидкі шаблони сповіщення
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {TEMPLATES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleApplyTemplate(t)}
                  style={{
                    background: 'var(--ch-surface-inset, rgba(255, 255, 255, 0.05))',
                    border: '1px solid var(--ch-border, rgba(255, 255, 255, 0.1))',
                    color: 'var(--ch-text-secondary, #cbd5e1)',
                    borderRadius: '8px',
                    padding: '5px 10px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--ch-accent, #6366f1)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--ch-border, rgba(255, 255, 255, 0.1))'}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title Field */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, marginBottom: '6px', color: 'var(--ch-text-primary, #fff)' }}>
              Заголовок Push-сповіщення *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Наприклад: Термінове оголошення для всіх змін"
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: '12px',
                background: 'var(--ch-surface-inset, rgba(10, 13, 20, 0.65))',
                border: '1px solid var(--ch-border, rgba(255, 255, 255, 0.12))',
                color: 'var(--ch-text-primary, #fff)',
                fontSize: '0.9rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Body Field */}
          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 800, marginBottom: '6px', color: 'var(--ch-text-primary, #fff)' }}>
              <span>Текст повідомлення *</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--ch-text-dim, #64748b)' }}>{body.length} символів</span>
            </label>
            <textarea
              required
              rows={4}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Введіть повний текст повідомлення, яке відобразиться на екрані співробітників..."
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '12px',
                background: 'var(--ch-surface-inset, rgba(10, 13, 20, 0.65))',
                border: '1px solid var(--ch-border, rgba(255, 255, 255, 0.12))',
                color: 'var(--ch-text-primary, #fff)',
                fontSize: '0.88rem',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                lineHeight: 1.45
              }}
            />
          </div>

          {/* Target Audience Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, marginBottom: '8px', color: 'var(--ch-text-primary, #fff)' }}>
              Кому надіслати:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setAudience('all')}
                style={{
                  background: audience === 'all' ? 'var(--ch-accent-subtle, rgba(99, 102, 241, 0.15))' : 'var(--ch-surface-inset, rgba(0,0,0,0.2))',
                  border: `1px solid ${audience === 'all' ? 'var(--ch-accent, #6366f1)' : 'var(--ch-border, rgba(255,255,255,0.08))'}`,
                  color: audience === 'all' ? 'var(--ch-accent, #6366f1)' : 'var(--ch-text-muted, #94a3b8)',
                  borderRadius: '10px',
                  padding: '9px 10px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Radio size={14} />
                <span>Усім</span>
              </button>

              <button
                type="button"
                onClick={() => setAudience('department')}
                style={{
                  background: audience === 'department' ? 'var(--ch-accent-subtle, rgba(99, 102, 241, 0.15))' : 'var(--ch-surface-inset, rgba(0,0,0,0.2))',
                  border: `1px solid ${audience === 'department' ? 'var(--ch-accent, #6366f1)' : 'var(--ch-border, rgba(255,255,255,0.08))'}`,
                  color: audience === 'department' ? 'var(--ch-accent, #6366f1)' : 'var(--ch-text-muted, #94a3b8)',
                  borderRadius: '10px',
                  padding: '9px 10px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Building2 size={14} />
                <span>За відділом</span>
              </button>

              <button
                type="button"
                onClick={() => setAudience('specific')}
                style={{
                  background: audience === 'specific' ? 'var(--ch-accent-subtle, rgba(99, 102, 241, 0.15))' : 'var(--ch-surface-inset, rgba(0,0,0,0.2))',
                  border: `1px solid ${audience === 'specific' ? 'var(--ch-accent, #6366f1)' : 'var(--ch-border, rgba(255,255,255,0.08))'}`,
                  color: audience === 'specific' ? 'var(--ch-accent, #6366f1)' : 'var(--ch-text-muted, #94a3b8)',
                  borderRadius: '10px',
                  padding: '9px 10px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <User size={14} />
                <span>Окремі люди</span>
              </button>
            </div>

            {/* Department dropdown */}
            {audience === 'department' && (
              <div style={{ marginTop: '10px' }}>
                <select
                  value={selectedDept}
                  onChange={e => setSelectedDept(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    background: 'var(--ch-surface-inset, #0e121e)',
                    border: '1px solid var(--ch-border, rgba(255, 255, 255, 0.12))',
                    color: 'var(--ch-text-primary, #fff)',
                    fontSize: '0.82rem',
                    outline: 'none'
                  }}
                >
                  <option value="all">Усі відділи</option>
                  {departments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Specific users selector */}
            {audience === 'specific' && (
              <div style={{ marginTop: '10px', maxHeight: '130px', overflowY: 'auto', border: '1px solid var(--ch-border, rgba(255,255,255,0.1))', borderRadius: '10px', padding: '8px' }}>
                {systemUsers.map(u => (
                  <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px', fontSize: '0.78rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(u.id)}
                      onChange={e => {
                        if (e.target.checked) setSelectedUserIds(prev => [...prev, u.id])
                        else setSelectedUserIds(prev => prev.filter(id => id !== u.id))
                      }}
                      style={{ accentColor: 'var(--ch-accent, #6366f1)' }}
                    />
                    <span>{`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.login} ({u.position || 'Працівник'})</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Action on Click (Path) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, marginBottom: '6px', color: 'var(--ch-text-dim, #94a3b8)' }}>
                Куди перейде користувач при кліку
              </label>
              <select
                value={path}
                onChange={e => setPath(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  background: 'var(--ch-surface-inset, #0e121e)',
                  border: '1px solid var(--ch-border, rgba(255, 255, 255, 0.12))',
                  color: 'var(--ch-text-primary, #fff)',
                  fontSize: '0.82rem',
                  outline: 'none'
                }}
              >
                <option value="/">Корпоративний портал (/)</option>
                <option value="/notifications">Центр сповіщень (/notifications)</option>
                <option value="/tasks">Задачник Канбан (/tasks)</option>
                <option value="/dashboard">Каталог модулів (/dashboard)</option>
                <option value="/shipping">Відвантаження (/shipping)</option>
                <option value="/machines">Обладнання (/machines)</option>
              </select>
            </div>

            {/* Checkbox: Also publish in corporate feed */}
            <div style={{ display: 'flex', alignItems: 'center', paddingTop: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--ch-text-secondary, #cbd5e1)' }}>
                <input
                  type="checkbox"
                  checked={alsoPostToCorporate}
                  onChange={e => setAlsoPostToCorporate(e.target.checked)}
                  style={{ accentColor: 'var(--ch-accent, #6366f1)', width: '16px', height: '16px' }}
                />
                <span>Створити офіційний наказ у стрічці</span>
              </label>
            </div>
          </div>

          {/* Result Alert */}
          {resultMessage && (
            <div
              style={{
                borderRadius: '12px',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.82rem',
                fontWeight: 700,
                background: resultMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: resultMessage.type === 'success' ? '#10b981' : '#ef4444',
                border: `1px solid ${resultMessage.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
              }}
            >
              {resultMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>{resultMessage.text}</span>
            </div>
          )}

          {/* ── FOOTER ACTIONS ──────────────────────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '10px',
              borderTop: '1px solid var(--ch-border, rgba(255, 255, 255, 0.08))'
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--ch-text-muted, #94a3b8)',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.84rem'
              }}
            >
              Скасувати
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || !body.trim()}
              style={{
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                border: 'none',
                color: '#fff',
                fontWeight: 900,
                fontSize: '0.86rem',
                padding: '10px 22px',
                borderRadius: '12px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 6px 18px rgba(99, 102, 241, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: isSubmitting || !title.trim() || !body.trim() ? 0.6 : 1
              }}
            >
              <Send size={15} />
              <span>{isSubmitting ? 'ВІДПРАВКА...' : 'НАДІСЛАТИ PUSH ВСІМ'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

