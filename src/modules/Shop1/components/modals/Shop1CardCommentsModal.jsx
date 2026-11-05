import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  X,
  MessageSquare,
  Send,
  Camera,
  Image as ImageIcon,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ZoomIn,
  Sparkles
} from 'lucide-react'
import {
  parseCardComments,
  uploadCommentPhoto,
  saveCardComment
} from '../../../../services/cardCommentsService.js'
import { useStore } from '../../../../store/index.js'

function formatUserNameCandidate(user) {
  if (!user) return ''
  const last = String(user.last_name || '').trim()
  const first = String(user.first_name || '').trim()
  if (last && first) return `${last} ${first}`
  if (first || last) return first || last
  return String(user.name || user.login || user.email?.split('@')[0] || '').trim()
}

function getInitials(name = '') {
  const parts = String(name || '').trim().split(/\s+/)
  if (!parts.length || !parts[0]) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function getAvatarColor(name = '') {
  const colors = [
    '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#14b8a6', '#f97316'
  ]
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

function formatCommentDate(isoStr) {
  if (!isoStr) return ''
  try {
    const d = new Date(isoStr)
    if (Number.isNaN(d.getTime())) return isoStr
    return d.toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return isoStr
  }
}

export function Shop1CardCommentsModal({
  isOpen,
  onClose,
  currentCard: initialCard,
  card,
  nom,
  orderNum = '',
  currentUser,
  systemUsers = [],
  selectedOperator = '',
  defaultRole,
  onCommentSaved,
  setWorkCards
}) {
  const storeUser = useStore(state => state.currentUser)
  const storeUsers = useStore(state => state.systemUsers)
  const activeUser = currentUser || storeUser || null
  const effectiveUsers = (systemUsers && systemUsers.length > 0) ? systemUsers : (storeUsers || [])

  const currentCard = initialCard || card || null

  const isShop2Card = Boolean(
    currentCard?.operation?.toLowerCase().includes('прес') ||
    currentCard?.operation?.toLowerCase().includes('порізка') ||
    currentCard?.operation?.toLowerCase().includes('фрезер') ||
    currentCard?.operation?.toLowerCase().includes('шліф') ||
    String(currentCard?.card_info || '').includes('[ЦЕХ №2]') ||
    String(currentCard?.card_info || '').includes('[ЦЕХ 2]')
  )
  const resolvedDefaultRole = defaultRole || (isShop2Card ? 'Цех №2' : 'Цех №1')

  const [commentText, setCommentText] = useState('')
  const [selectedPhotos, setSelectedPhotos] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [previewPhoto, setPreviewPhoto] = useState(null) // lightbox

  // Author customization
  const [isChangingAuthor, setIsChangingAuthor] = useState(false)
  const [authorName, setAuthorName] = useState('')
  const [authorRole, setAuthorRole] = useState('')
  const [authorId, setAuthorId] = useState(null)

  const fileInputRef = useRef(null)
  const listEndRef = useRef(null)

  // Parse existing comments from card_info
  const comments = useMemo(() => {
    return parseCardComments(currentCard?.card_info)
  }, [currentCard?.card_info])

  // Resolve initial default author (автор, який зараз пише)
  useEffect(() => {
    if (!isOpen) return

    let defName = ''
    let defRole = resolvedDefaultRole
    let defId = null

    // 1. ПЕРШИЙ І ГОЛОВНИЙ ПРІОРИТЕТ: залогінений користувач системи, який зараз пише
    if (activeUser) {
      defId = activeUser.id || null
      defName = formatUserNameCandidate(activeUser)
      defRole = activeUser.position || activeUser.role || resolvedDefaultRole
    } else if (selectedOperator) {
      defName = selectedOperator
      defRole = 'Оператор'
    } else if (currentCard?.operator_name) {
      defName = currentCard.operator_name
      defRole = 'Оператор'
    } else {
      defName = 'Працівник'
      defRole = resolvedDefaultRole
    }

    setAuthorId(defId)
    setAuthorName(defName)
    setAuthorRole(defRole)
    setIsChangingAuthor(false)
    setCommentText('')
    setSelectedPhotos([])
    setErrorMsg('')
    setSuccessMsg('')
  }, [isOpen, activeUser, selectedOperator, currentCard?.operator_name, resolvedDefaultRole])

  // Scroll to bottom when new comment is added or opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        listEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    }
  }, [isOpen, comments.length])

  if (!isOpen || !currentCard) return null

  const shortHex = String(currentCard.id || '').slice(-8).toUpperCase()
  const partName = nom?.name || currentCard.nomenclature_name || currentCard.name || (currentCard.card_info?.split('] ').pop()) || 'Деталь'

  // Photo pick handler
  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    const newPhotos = files.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
      name: file.name,
      size: file.size
    }))

    setSelectedPhotos(prev => [...prev, ...newPhotos])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemovePhoto = (idx) => {
    setSelectedPhotos(prev => {
      const copy = [...prev]
      if (copy[idx]?.previewUrl && copy[idx].previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(copy[idx].previewUrl)
      }
      copy.splice(idx, 1)
      return copy
    })
  }

  // Submit comment
  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (isSubmitting) return

    const cleanText = commentText.trim()
    if (!cleanText && selectedPhotos.length === 0) {
      setErrorMsg('Введіть текст коментаря або додайте фото')
      return
    }

    const cleanAuthor = authorName.trim() || 'Працівник'
    setIsSubmitting(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      // 1. Upload photos (if any)
      const uploadedPhotosList = []
      for (const item of selectedPhotos) {
        if (item.file) {
          const res = await uploadCommentPhoto(item.file, currentCard.id)
          if (res) uploadedPhotosList.push(res)
        }
      }

      // 2. Save comment to card_info + history + table
      const { updatedCardInfo, newComment, updatedComments } = await saveCardComment({
        card: currentCard,
        authorName: cleanAuthor,
        authorRole: authorRole.trim() || resolvedDefaultRole,
        authorId: authorId || activeUser?.id || null,
        text: cleanText,
        photos: uploadedPhotosList,
        stage: currentCard.operation || (isShop2Card ? 'Цех №2' : 'Розкрій'),
        machine: currentCard.machine || null
      })

      // 3. Update React local states
      if (typeof setWorkCards === 'function') {
        setWorkCards(prev => (prev || []).map(c => c.id === currentCard.id ? { ...c, card_info: updatedCardInfo } : c))
      }

      if (typeof onCommentSaved === 'function') {
        onCommentSaved({
          ...currentCard,
          card_info: updatedCardInfo
        }, newComment)
      }

      // Cleanup blobs
      selectedPhotos.forEach(p => {
        if (p.previewUrl && p.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(p.previewUrl)
        }
      })

      setCommentText('')
      setSelectedPhotos([])
      setSuccessMsg('Коментар успішно збережено!')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err) {
      console.error('[Shop1CardCommentsModal] Error submitting comment:', err)
      setErrorMsg(err.message || 'Не вдалося зберегти коментар')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="s1-comments-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10050,
        padding: '16px',
        overflowY: 'auto'
      }}
      onClick={onClose}
    >
      <div
        className="s1-comments-modal-content"
        style={{
          background: 'var(--surface-1, #121418)',
          width: '100%',
          maxWidth: '640px',
          maxHeight: '92vh',
          borderRadius: '24px',
          border: '1.5px solid rgba(59, 130, 246, 0.35)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: 'var(--text-strong, #fff)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="s1-comments-header"
          style={{
            padding: '16px 20px',
            background: 'var(--surface-2, #181c22)',
            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)',
                flexShrink: 0
              }}
            >
              <MessageSquare size={20} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '1rem',
                    fontWeight: 950,
                    letterSpacing: '-0.3px',
                    color: 'var(--text-strong, #fff)'
                  }}
                >
                  КОМЕНТАРІ ДО РК #{shortHex}
                </h3>
                <span
                  style={{
                    background: comments.length > 0 ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                    color: comments.length > 0 ? '#fff' : 'var(--text-muted, #94a3b8)',
                    borderRadius: '999px',
                    padding: '2px 8px',
                    fontSize: '0.68rem',
                    fontWeight: 900
                  }}
                >
                  {comments.length} {comments.length === 1 ? 'запис' : comments.length >= 2 && comments.length <= 4 ? 'записи' : 'записів'}
                </span>
              </div>
              <div
                style={{
                  fontSize: '0.68rem',
                  color: 'var(--text-muted, #94a3b8)',
                  marginTop: '3px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {partName} · {orderNum ? `Зам. №${orderNum} · ` : ''}{currentCard.operation || 'Розкрій'} · {currentCard.quantity} шт
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="s1-close-btn"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #94a3b8)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Scrollable Comments Timeline */}
        <div
          className="s1-comments-timeline"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            background: 'var(--surface-inset, #0d0f12)'
          }}
        >
          {comments.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 20px',
                textAlign: 'center',
                color: 'var(--text-muted, #64748b)'
              }}
            >
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  background: 'rgba(59, 130, 246, 0.1)',
                  color: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '12px'
                }}
              >
                <Sparkles size={26} />
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--text-strong, #e2e8f0)' }}>
                Поки що немає коментарів
              </div>
              <div style={{ fontSize: '0.72rem', maxWidth: '340px', marginTop: '6px', lineHeight: 1.4 }}>
                Тут фіксується історія зауважень, приміток та фотографій деталей на всіх етапах Цеху №1 (Розкрій, Галтовка, Прийомка, Сортування).
              </div>
            </div>
          ) : (
            comments.map((cmt, idx) => {
              const avatarColor = getAvatarColor(cmt.author_name)
              const initials = getInitials(cmt.author_name)
              const hasPhotos = Array.isArray(cmt.photos) && cmt.photos.length > 0

              return (
                <div
                  key={cmt.id || idx}
                  className="s1-comment-item"
                  style={{
                    background: 'var(--card-inner-bg, rgba(255, 255, 255, 0.035))',
                    border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                    borderRadius: '16px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  {/* Author & Meta Row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '10px',
                          background: avatarColor,
                          color: '#fff',
                          fontWeight: 950,
                          fontSize: '0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        {initials}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 950, fontSize: '0.82rem', color: 'var(--text-strong, #fff)' }}>
                            {cmt.author_name || 'Працівник'}
                          </span>
                          {cmt.author_role && (
                            <span
                              style={{
                                background: cmt.author_role.includes('ВКЯ')
                                  ? 'rgba(16, 185, 129, 0.2)'
                                  : cmt.author_role.includes('Майстер')
                                    ? 'rgba(245, 158, 11, 0.2)'
                                    : 'rgba(59, 130, 246, 0.15)',
                                color: cmt.author_role.includes('ВКЯ')
                                  ? '#10b981'
                                  : cmt.author_role.includes('Майстер')
                                    ? '#f59e0b'
                                    : '#3b82f6',
                                fontSize: '0.62rem',
                                fontWeight: 900,
                                padding: '1px 6px',
                                borderRadius: '6px'
                              }}
                            >
                              {cmt.author_role}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem', color: 'var(--text-muted, #94a3b8)' }}>
                      {cmt.stage && (
                        <span
                          style={{
                            background: 'var(--surface-black, rgba(0,0,0,0.3))',
                            border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
                            padding: '2px 6px',
                            borderRadius: '6px',
                            fontWeight: 800,
                            color: '#f59e0b'
                          }}
                        >
                          {cmt.stage}
                        </span>
                      )}
                      {cmt.machine && (
                        <span style={{ opacity: 0.8, fontSize: '0.62rem' }}>
                          • {cmt.machine}
                        </span>
                      )}
                      <span style={{ opacity: 0.7 }}>
                        {formatCommentDate(cmt.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Comment Text */}
                  {cmt.text && (
                    <div
                      style={{
                        fontSize: '0.82rem',
                        lineHeight: 1.45,
                        color: 'var(--text-color, #e2e8f0)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        paddingLeft: '41px'
                      }}
                    >
                      {cmt.text}
                    </div>
                  )}

                  {/* Attached Photos Gallery */}
                  {hasPhotos && (
                    <div
                      style={{
                        paddingLeft: '41px',
                        display: 'flex',
                        gap: '8px',
                        flexWrap: 'wrap',
                        marginTop: '2px'
                      }}
                    >
                      {cmt.photos.map((photo, pIdx) => (
                        <div
                          key={photo.id || pIdx}
                          onClick={() => setPreviewPhoto(photo)}
                          style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            position: 'relative',
                            cursor: 'pointer',
                            border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
                            background: '#000'
                          }}
                          title="Натисніть для перегляду фото на весь екран"
                        >
                          <img
                            src={photo.url}
                            alt={photo.name || 'Фото'}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover'
                            }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              bottom: '3px',
                              right: '3px',
                              background: 'rgba(0,0,0,0.6)',
                              borderRadius: '4px',
                              padding: '2px',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            <ZoomIn size={12} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
          <div ref={listEndRef} />
        </div>

        {/* New Comment Input Form */}
        <div
          className="s1-comments-form"
          style={{
            padding: '14px 20px 18px',
            background: 'var(--surface-2, #181c22)',
            borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            flexShrink: 0
          }}
        >
          {/* Author bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem' }}>
              <User size={13} style={{ color: '#3b82f6' }} />
              <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Автор:</span>
              <strong style={{ color: 'var(--text-strong, #fff)' }}>{authorName || 'Працівник'}</strong>
              {authorRole && (
                <span style={{ color: 'var(--text-dim, #64748b)', fontSize: '0.66rem' }}>({authorRole})</span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsChangingAuthor(!isChangingAuthor)}
              style={{
                background: 'none',
                border: 'none',
                color: '#3b82f6',
                fontSize: '0.68rem',
                fontWeight: 900,
                cursor: 'pointer',
                padding: '2px 6px'
              }}
            >
              {isChangingAuthor ? 'Згорнути' : 'Змінити автора'}
            </button>
          </div>

          {/* Optional: Change author dropdown / input */}
          {isChangingAuthor && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '10px 12px',
                background: 'var(--surface-inset, #0d0f12)',
                borderRadius: '12px',
                border: '1px solid rgba(59, 130, 246, 0.3)'
              }}
            >
              {effectiveUsers.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', marginBottom: '3px' }}>
                    Обрати зі списку співробітників:
                  </label>
                  <select
                    onChange={e => {
                      const uid = e.target.value
                      if (!uid) return
                      const found = effectiveUsers.find(u => String(u.id) === String(uid))
                      if (found) {
                        setAuthorId(found.id)
                        setAuthorName(formatUserNameCandidate(found))
                        setAuthorRole(found.position || found.role || resolvedDefaultRole)
                      }
                    }}
                    defaultValue=""
                    style={{
                      width: '100%',
                      background: 'var(--surface-1, #121418)',
                      border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
                      borderRadius: '8px',
                      padding: '6px 8px',
                      fontSize: '0.75rem',
                      color: '#fff',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="" disabled>-- Оберіть користувача --</option>
                    {effectiveUsers.map(u => (
                      <option key={u.id} value={u.id}>
                        {formatUserNameCandidate(u)} {u.position ? `(${u.position})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', marginBottom: '3px' }}>
                    Ім'я / Прізвище
                  </label>
                  <input
                    type="text"
                    value={authorName}
                    onChange={e => setAuthorName(e.target.value)}
                    placeholder="Введіть ім'я..."
                    style={{
                      width: '100%',
                      background: 'var(--surface-1, #121418)',
                      border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
                      borderRadius: '8px',
                      padding: '6px 8px',
                      fontSize: '0.75rem',
                      color: '#fff',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', marginBottom: '3px' }}>
                    Посада / Відділ
                  </label>
                  <select
                    value={authorRole}
                    onChange={e => setAuthorRole(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--surface-1, #121418)',
                      border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
                      borderRadius: '8px',
                      padding: '6px 8px',
                      fontSize: '0.75rem',
                      color: '#fff',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="Оператор">Оператор ЧПК</option>
                    <option value="Цех №2">Цех №2</option>
                    <option value="Пресування">Пресування</option>
                    <option value="Порізка">Порізка</option>
                    <option value="ВКЯ">Фахівець ВКЯ</option>
                    <option value="Майстер">Майстер зміни</option>
                    <option value="Інженер">Інженер-технолог</option>
                    <option value="Галтовка">Галтовка / Мийка</option>
                    <option value="Сортування">Сортування</option>
                    <option value="Керівник">Керівник / Адмін</option>
                    <option value="Цех №1">Цех №1</option>
                  </select>
                </div>
              </div>

              {activeUser && (
                <div style={{ textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthorId(activeUser.id)
                      setAuthorName(formatUserNameCandidate(activeUser))
                      setAuthorRole(activeUser.position || activeUser.role || resolvedDefaultRole)
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#10b981',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    ↩ Повернути мій профіль ({formatUserNameCandidate(activeUser)})
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Text input */}
          <div style={{ position: 'relative' }}>
            <textarea
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Напишіть коментар до цієї картки (особливості, дефекти, зауваження, примітки)..."
              rows={3}
              style={{
                width: '100%',
                background: 'var(--surface-inset, #0d0f12)',
                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
                borderRadius: '12px',
                padding: '10px 12px',
                fontSize: '0.8rem',
                color: 'var(--text-strong, #fff)',
                outline: 'none',
                resize: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit'
              }}
            />
          </div>

          {/* Selected photos preview strip */}
          {selectedPhotos.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              {selectedPhotos.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    position: 'relative',
                    width: '64px',
                    height: '64px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    flexShrink: 0,
                    border: '1px solid #3b82f6'
                  }}
                >
                  <img
                    src={item.previewUrl}
                    alt="Попередній перегляд"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(idx)}
                    style={{
                      position: 'absolute',
                      top: '2px',
                      right: '2px',
                      background: 'rgba(0,0,0,0.7)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '18px',
                      height: '18px',
                      color: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Messages */}
          {errorMsg && (
            <div style={{ color: '#ef4444', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <AlertCircle size={13} /> {errorMsg}
            </div>
          )}
          {successMsg && (
            <div style={{ color: '#10b981', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <CheckCircle2 size={13} /> {successMsg}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            {/* File input (camera / photo) */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              capture="environment"
              multiple
              onChange={handlePhotoSelect}
              style={{ display: 'none' }}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting}
              style={{
                background: 'var(--card-inner-bg, rgba(255,255,255,0.06))',
                border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
                color: 'var(--text-strong, #fff)',
                borderRadius: '10px',
                padding: '9px 14px',
                fontSize: '0.75rem',
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Сфотографувати або обрати зображення з галереї"
            >
              <Camera size={16} style={{ color: '#3b82f6' }} />
              <span>Фото</span>
              {selectedPhotos.length > 0 && (
                <span style={{ background: '#3b82f6', color: '#fff', borderRadius: '999px', padding: '1px 6px', fontSize: '0.62rem' }}>
                  +{selectedPhotos.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || (!commentText.trim() && selectedPhotos.length === 0)}
              style={{
                background: (commentText.trim() || selectedPhotos.length > 0)
                  ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                  : 'rgba(255,255,255,0.08)',
                border: 'none',
                color: '#fff',
                borderRadius: '10px',
                padding: '9px 18px',
                fontSize: '0.78rem',
                fontWeight: 950,
                cursor: (commentText.trim() || selectedPhotos.length > 0) ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: isSubmitting ? 0.7 : 1,
                boxShadow: (commentText.trim() || selectedPhotos.length > 0) ? '0 4px 14px rgba(59, 130, 246, 0.35)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="spin-s1" />
                  <span>Збереження...</span>
                </>
              ) : (
                <>
                  <Send size={15} />
                  <span>Надіслати</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox Modal for Fullscreen Photo Preview */}
      {previewPhoto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.95)',
            zIndex: 10090,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setPreviewPhoto(null)}
        >
          <button
            onClick={() => setPreviewPhoto(null)}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10
            }}
          >
            <X size={24} />
          </button>
          <img
            src={previewPhoto.url}
            alt={previewPhoto.name || 'Фото'}
            style={{
              maxWidth: '92vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: '12px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.8)'
            }}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}

