import React, { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Award,
  Briefcase,
  CheckCircle2,
  ClipboardList,
  Edit3,
  FileText,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserX,
  X
} from 'lucide-react'

const OBSERVATION_CATEGORIES = [
  { id: 'note', label: 'Нотатка', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.14)', border: 'rgba(56, 189, 248, 0.35)', icon: FileText },
  { id: 'praise', label: 'Похвала / Плюс', color: '#10b981', bg: 'rgba(16, 185, 129, 0.14)', border: 'rgba(16, 185, 129, 0.35)', icon: Award },
  { id: 'warning', label: 'Зауваження', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.14)', border: 'rgba(245, 158, 11, 0.35)', icon: AlertTriangle },
  { id: 'incident', label: 'Інцидент / Порушення', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.14)', border: 'rgba(239, 68, 68, 0.35)', icon: AlertTriangle }
]

export function EmployeeDossierModal({
  user,
  onClose,
  supabase,
  currentUser,
  moduleList = [],
  renderUserAvatar,
  getRoleStyle,
  formatLastSeen,
  editUser,
  dismissUser,
  restoreUser,
  deleteUser,
  nowTick
}) {
  const [activeTab, setActiveTab] = useState('profile') // 'profile' | 'observations' | 'stats'
  const [observations, setObservations] = useState([])
  const [obsLoading, setObsLoading] = useState(false)
  const [obsCategory, setObsCategory] = useState('note')
  const [obsTitle, setObsTitle] = useState('')
  const [obsComment, setObsComment] = useState('')
  const [isSavingObs, setIsSavingObs] = useState(false)

  const [statsLoading, setStatsLoading] = useState(false)
  const [statsData, setStatsData] = useState({ opsCount: 0, totalProduced: 0, totalScrap: 0, recent: [] })

  const fullName = useMemo(() => {
    if (!user) return ''
    return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.login || 'Без імені'
  }, [user])

  const isDismissed = Boolean(user?.is_dismissed)
  const isOnline = !isDismissed && user?.last_seen && ((nowTick || Date.now()) - new Date(user.last_seen).getTime() < 120000)

  const allowedModules = useMemo(() => {
    const rights = user?.access_rights || {}
    return moduleList.filter(m => rights[m.id] === true)
  }, [user, moduleList])

  useEffect(() => {
    if (!user?.id || !supabase) return
    let active = true

    const loadObservations = async () => {
      setObsLoading(true)
      try {
        const { data, error } = await supabase
          .from('employee_observations')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
        if (!error && active && Array.isArray(data)) {
          setObservations(data)
        }
      } catch {
        /* ignore if migration not yet applied */
      } finally {
        if (active) setObsLoading(false)
      }
    }

    loadObservations()
    return () => { active = false }
  }, [user?.id, supabase])

  useEffect(() => {
    if (!user?.id || !supabase || activeTab !== 'stats') return
    let active = true

    const loadStats = async () => {
      setStatsLoading(true)
      try {
        const sinceIso = new Date(Date.now() - 30 * 86400000).toISOString()
        const lastName = String(user.last_name || '').trim()
        const firstName = String(user.first_name || '').trim()
        const searchToken = lastName || firstName || String(user.login || '').trim()
        if (!searchToken) {
          if (active) setStatsData({ opsCount: 0, totalProduced: 0, totalScrap: 0, recent: [] })
          return
        }

        const { data, error } = await supabase
          .from('work_card_history')
          .select('id, stage_name, operator_name, qty_completed, scrap_qty, completed_at, created_at')
          .gte('created_at', sinceIso)
          .ilike('operator_name', `%${searchToken}%`)
          .order('created_at', { ascending: false })
          .limit(200)

        if (!error && active && Array.isArray(data)) {
          const totalProduced = data.reduce((sum, r) => sum + (Number(r.qty_completed) || 0), 0)
          const totalScrap = data.reduce((sum, r) => sum + (Number(r.scrap_qty) || 0), 0)
          setStatsData({
            opsCount: data.length,
            totalProduced,
            totalScrap,
            recent: data.slice(0, 12)
          })
        }
      } catch {
        /* non-fatal */
      } finally {
        if (active) setStatsLoading(false)
      }
    }

    loadStats()
    return () => { active = false }
  }, [user?.id, user?.last_name, user?.first_name, user?.login, supabase, activeTab])

  if (!user) return null

  const handleAddObservation = async (e) => {
    e.preventDefault()
    if (!obsComment.trim() || !supabase || isSavingObs) return
    setIsSavingObs(true)
    try {
      const authorName = currentUser
        ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || currentUser.login
        : 'Адміністратор'
      const { data, error } = await supabase
        .from('employee_observations')
        .insert([{
          user_id: user.id,
          category: obsCategory,
          title: obsTitle.trim() || null,
          comment: obsComment.trim(),
          author_id: currentUser?.id || null,
          author_name: authorName
        }])
        .select('*')
        .single()
      if (error) throw error
      if (data) {
        setObservations(prev => [data, ...prev])
      }
      setObsTitle('')
      setObsComment('')
    } catch (err) {
      alert('Не вдалося зберегти спостереження: ' + (err?.message || err))
    } finally {
      setIsSavingObs(false)
    }
  }

  const handleDeleteObservation = async (obsId) => {
    if (!supabase || !window.confirm('Видалити цей запис спостереження?')) return
    try {
      const { error } = await supabase.from('employee_observations').delete().eq('id', obsId)
      if (error) throw error
      setObservations(prev => prev.filter(o => o.id !== obsId))
    } catch (err) {
      alert('Помилка видалення: ' + (err?.message || err))
    }
  }

  const roleStyle = typeof getRoleStyle === 'function' ? getRoleStyle(user.position) : {}

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10050,
        background: 'rgba(15, 23, 42, 0.58)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '800px',
          maxHeight: '90vh',
          background: 'var(--bg-subtle)',
          color: 'var(--text)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '22px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.28)'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '22px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--card-header-bg)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
            {typeof renderUserAvatar === 'function' && renderUserAvatar(user)}
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '1.22rem', fontWeight: 950, color: 'var(--text-strong)' }}>{fullName}</h3>
                {isDismissed ? (
                  <span style={{ fontSize: '0.7rem', fontWeight: 900, color: '#dc2626', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', padding: '3px 10px', borderRadius: '999px' }}>
                    ЗВІЛЬНЕНИЙ
                  </span>
                ) : (
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    color: isOnline ? '#059669' : 'var(--text-muted)',
                    background: isOnline ? 'rgba(16,185,129,0.14)' : 'var(--fill-subtle)',
                    border: `1px solid ${isOnline ? 'rgba(16,185,129,0.3)' : 'var(--border-subtle)'}`,
                    padding: '3px 10px',
                    borderRadius: '999px'
                  }}>
                    {isOnline ? '● В мережі' : `Візит: ${typeof formatLastSeen === 'function' ? formatLastSeen(user.last_seen) : '—'}`}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '7px', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                <span>@{user.login}</span>
                <span>·</span>
                <span>{user.department || 'Без цеху'}</span>
                <span>·</span>
                <span style={{
                  ...roleStyle,
                  background: 'rgba(255,144,0,0.12)',
                  color: '#d97706',
                  border: '1px solid rgba(255,144,0,0.3)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 850
                }}>
                  {user.position || '—'}
                </span>
                <span>·</span>
                <span>{user.shift || 'Без зміни'}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'var(--fill-subtle)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', padding: '12px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--fill-subtle)', flexWrap: 'wrap' }}>
          {[
            { id: 'profile', label: 'Профіль і доступи', icon: ShieldCheck },
            { id: 'observations', label: `Спостереження (${observations.length})`, icon: ClipboardList },
            { id: 'stats', label: 'Статистика (30 дн.)', icon: Activity }
          ].map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: `1px solid ${active ? '#ff9000' : 'var(--border-subtle)'}`,
                  background: active ? 'rgba(255, 144, 0, 0.14)' : 'var(--card-bg)',
                  color: active ? '#ea580c' : 'var(--text-muted)',
                  fontSize: '0.78rem',
                  fontWeight: 850,
                  cursor: 'pointer'
                }}
              >
                <Icon size={14} /> {tab.label}
              </button>
            )
          })}
        </div>

        {/* Body */}
        <div style={{ padding: '22px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {activeTab === 'profile' && (
            <>
              {isDismissed && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '14px', padding: '14px 16px', color: '#dc2626', fontSize: '0.82rem', fontWeight: 700 }}>
                  <div>Працівника звільнено {user.dismissed_at ? new Date(user.dismissed_at).toLocaleString('uk-UA') : ''}.</div>
                  {user.dismissed_reason && <div style={{ marginTop: '4px', opacity: 0.9 }}>Причина: {user.dismissed_reason}</div>}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '14px 16px' }}>
                  <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>ID / Логін</div>
                  <div style={{ fontSize: '0.94rem', color: 'var(--text-strong)', fontWeight: 850, marginTop: '5px' }}>#{user.id} · @{user.login}</div>
                </div>
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '14px 16px' }}>
                  <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Підрозділ</div>
                  <div style={{ fontSize: '0.94rem', color: 'var(--text-strong)', fontWeight: 850, marginTop: '5px' }}>{user.department || 'Не призначено'}</div>
                </div>
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '14px 16px' }}>
                  <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Посада / Зміна</div>
                  <div style={{ fontSize: '0.94rem', color: 'var(--text-strong)', fontWeight: 850, marginTop: '5px' }}>{user.position || '—'} · {user.shift || 'Без зміни'}</div>
                </div>
              </div>

              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '16px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 900, textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.04em' }}>
                  Доступні модулі ({allowedModules.length})
                </div>
                {allowedModules.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Модулі не призначені</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {allowedModules.map(m => (
                      <span
                        key={m.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          background: 'rgba(255,144,0,0.1)',
                          border: '1px solid rgba(255,144,0,0.3)',
                          color: '#d97706',
                          padding: '5px 10px',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: 800
                        }}
                      >
                        <CheckCircle2 size={12} /> {m.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    if (typeof editUser === 'function') editUser(user)
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'linear-gradient(135deg, #ff9000, #ea580c)', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '10px', fontWeight: 900, fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  <Edit3 size={14} /> Редагувати профіль і права
                </button>

                {isDismissed ? (
                  typeof restoreUser === 'function' && (
                    <button
                      type="button"
                      onClick={async () => { await restoreUser(user); onClose() }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'rgba(16,185,129,0.14)', color: '#059669', border: '1px solid rgba(16,185,129,0.35)', padding: '10px 16px', borderRadius: '10px', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}
                    >
                      <RotateCcw size={14} /> Поновити на роботі
                    </button>
                  )
                ) : (
                  typeof dismissUser === 'function' && user.id !== currentUser?.id && (
                    <button
                      type="button"
                      onClick={async () => { await dismissUser(user); onClose() }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'rgba(245,158,11,0.12)', color: '#d97706', border: '1px solid rgba(245,158,11,0.35)', padding: '10px 16px', borderRadius: '10px', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}
                    >
                      <UserX size={14} /> Звільнити працівника
                    </button>
                  )
                )}

                {typeof deleteUser === 'function' && user.id !== currentUser?.id && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Остаточно видалити досьє ${fullName} (@${user.login})?`)) {
                        deleteUser(user.id)
                        onClose()
                      }
                    }}
                    style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'rgba(239,68,68,0.1)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.28)', padding: '10px 14px', borderRadius: '10px', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    <Trash2 size={14} /> Видалити
                  </button>
                )}
              </div>
            </>
          )}

          {activeTab === 'observations' && (
            <>
              <form onSubmit={handleAddObservation} style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {OBSERVATION_CATEGORIES.map(cat => {
                    const active = obsCategory === cat.id
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setObsCategory(cat.id)}
                        style={{
                          padding: '6px 11px',
                          borderRadius: '8px',
                          border: `1px solid ${active ? cat.border : 'var(--border-subtle)'}`,
                          background: active ? cat.bg : 'transparent',
                          color: active ? cat.color : 'var(--text-muted)',
                          fontSize: '0.73rem',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        {cat.label}
                      </button>
                    )
                  })}
                </div>
                <input
                  type="text"
                  value={obsTitle}
                  onChange={e => setObsTitle(e.target.value)}
                  placeholder="Короткий заголовок (необов'язково)..."
                  style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text)', padding: '10px 12px', borderRadius: '10px', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box' }}
                />
                <textarea
                  rows={3}
                  value={obsComment}
                  onChange={e => setObsComment(e.target.value)}
                  placeholder="Опишіть спостереження, зауваження чи досягнення працівника..."
                  required
                  style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text)', padding: '10px 12px', borderRadius: '10px', fontSize: '0.82rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    disabled={isSavingObs || !obsComment.trim()}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #ff9000, #ea580c)', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: '10px', fontWeight: 900, fontSize: '0.8rem', cursor: 'pointer', opacity: isSavingObs ? 0.6 : 1 }}
                  >
                    <Plus size={14} /> {isSavingObs ? 'Збереження...' : 'Додати спостереження'}
                  </button>
                </div>
              </form>

              {obsLoading ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Завантаження спостережень...</div>
              ) : observations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', border: '1px dashed var(--border-subtle)', borderRadius: '14px', fontSize: '0.82rem' }}>
                  Поки що немає жодного спостереження для цього працівника.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {observations.map(obs => {
                    const cat = OBSERVATION_CATEGORIES.find(c => c.id === obs.category) || OBSERVATION_CATEGORIES[0]
                    return (
                      <div key={obs.id} style={{ background: 'var(--card-bg)', border: `1px solid ${cat.border}`, borderRadius: '14px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.68rem', fontWeight: 900, color: cat.color, background: cat.bg, padding: '2px 8px', borderRadius: '6px' }}>{cat.label}</span>
                            {obs.title && <span style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: '0.86rem' }}>{obs.title}</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                              {obs.author_name || 'Система'} · {new Date(obs.created_at).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteObservation(obs.id)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                              title="Видалити запис"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{obs.comment}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {activeTab === 'stats' && (
            <>
              {statsLoading ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '0.84rem' }}>Завантаження статистики за 30 днів...</div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '14px' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 900, textTransform: 'uppercase' }}>Операцій (30 дн.)</div>
                      <div style={{ fontSize: '1.35rem', color: 'var(--text-strong)', fontWeight: 900, marginTop: '4px' }}>{statsData.opsCount}</div>
                    </div>
                    <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.28)', borderRadius: '14px', padding: '14px' }}>
                      <div style={{ fontSize: '0.65rem', color: '#059669', fontWeight: 900, textTransform: 'uppercase' }}>Вироблено</div>
                      <div style={{ fontSize: '1.35rem', color: '#059669', fontWeight: 900, marginTop: '4px' }}>{statsData.totalProduced.toLocaleString('uk-UA')} шт</div>
                    </div>
                    <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.28)', borderRadius: '14px', padding: '14px' }}>
                      <div style={{ fontSize: '0.65rem', color: '#dc2626', fontWeight: 900, textTransform: 'uppercase' }}>Брак</div>
                      <div style={{ fontSize: '1.35rem', color: '#dc2626', fontWeight: 900, marginTop: '4px' }}>{statsData.totalScrap.toLocaleString('uk-UA')} шт</div>
                    </div>
                  </div>

                  {statsData.recent.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 900, textTransform: 'uppercase' }}>Останні операції</div>
                      {statsData.recent.map(r => (
                        <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '12px', background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', fontSize: '0.78rem' }}>
                          <div>
                            <div style={{ fontWeight: 800, color: 'var(--text-strong)' }}>{r.stage_name || 'Операція'}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(r.completed_at || r.created_at).toLocaleString('uk-UA')}</div>
                          </div>
                          <div style={{ display: 'flex', gap: '12px', fontWeight: 900 }}>
                            <span style={{ color: '#059669' }}>+{r.qty_completed || 0} шт</span>
                            {(Number(r.scrap_qty) || 0) > 0 && <span style={{ color: '#dc2626' }}>брак {r.scrap_qty}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
