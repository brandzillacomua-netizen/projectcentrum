import React, { useState, useEffect, useRef } from 'react'
import { Send, User, Trash2, Image as ImageIcon } from 'lucide-react'
import { corporateApi } from '../../services/corporateApi'
import { renderFormattedContent, extractMentionedUserIds } from '../../utils/corporateHelpers'
import { MentionAutocomplete } from '../common/MentionAutocomplete'
import { CorporateAvatar } from '../common/CorporateAvatar'
import { compressImageClient } from '../../hooks/useCorporateImageCompressor'

export function CorporateComments({
  postId,
  currentUser,
  users = []
}) {
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [pendingPhoto, setPendingPhoto] = useState(null)

  // Mentions in comments
  const [mentionQuery, setMentionQuery] = useState(null)
  const [mentionPos, setMentionPos] = useState(null)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    let mounted = true
    corporateApi.fetchComments(postId).then(data => {
      if (mounted) {
        setComments(data || [])
        setLoading(false)
      }
    })
    return () => { mounted = false }
  }, [postId])

  const handleTextChange = (e) => {
    const val = e.target.value
    setText(val)

    const cursor = e.target.selectionStart
    const textBeforeCursor = val.slice(0, cursor)
    const atMatch = textBeforeCursor.match(/@([a-zA-Zа-яА-ЯіІїЇєЄ0-9_-]*)$/)

    if (atMatch) {
      setMentionQuery(atMatch[1])
      setMentionPos(cursor)
    } else {
      setMentionQuery(null)
      setMentionPos(null)
    }
  }

  const handleSelectMention = (user) => {
    if (!mentionPos && mentionPos !== 0) return
    const textBeforeAt = text.slice(0, mentionPos - (mentionQuery ? mentionQuery.length + 1 : 1))
    const textAfterCursor = text.slice(mentionPos)
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.login
    const newText = `${textBeforeAt}@[${fullName}](${user.id}) ${textAfterCursor}`

    setText(newText)
    setMentionQuery(null)
    setMentionPos(null)
  }

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const compressed = await compressImageClient(file)
      setPendingPhoto({
        type: 'image',
        file: compressed.blob,
        name: compressed.name,
        mime: compressed.mime,
        previewUrl: compressed.previewUrl,
        size: compressed.compressedSize
      })
    } catch (err) {
      alert(err.message)
    }
    e.target.value = ''
  }

  const handleSend = async () => {
    if (!text.trim() && !pendingPhoto) return
    try {
      setSubmitting(true)
      const mentionedIds = extractMentionedUserIds(text)
      const rawAttachments = pendingPhoto ? [pendingPhoto] : []

      const newComment = await corporateApi.createComment(postId, {
        author_id: currentUser?.id,
        content: text.trim(),
        mentioned_user_ids: mentionedIds
      }, rawAttachments)

      setComments(prev => [...prev, newComment])
      setText('')
      setPendingPhoto(null)
    } catch (err) {
      console.error(err)
      alert('Помилка відправки коментаря: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--ch-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Existing comments */}
      {loading ? (
        <div style={{ fontSize: '0.78rem', color: 'var(--ch-text-dim)', padding: '6px 0' }}>Завантаження відповідей...</div>
      ) : (
        comments.map(c => {
          const author = c.author
          const authorName = author ? `${author.first_name || ''} ${author.last_name || ''}`.trim() || author.login : 'Користувач'
          const authorInitials = author?.first_name ? author.first_name[0] : 'U'
          const timeStr = c.created_at
            ? new Date(c.created_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
            : ''
          const contentTokens = renderFormattedContent(c.content, users)

          return (
            <div
              key={c.id}
              style={{
                display: 'flex',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: '12px',
                background: 'var(--ch-surface-inset)',
                border: '1px solid var(--ch-border)'
              }}
            >
              <CorporateAvatar
                user={author}
                size={30}
              />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--ch-text-primary)' }}>{authorName}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--ch-text-dim)' }}>{timeStr}</span>
                </div>

                <div style={{ fontSize: '0.86rem', color: 'var(--ch-text-secondary)', marginTop: '4px', lineHeight: 1.45, wordBreak: 'break-word' }}>
                  {Array.isArray(contentTokens) ? (
                    contentTokens.map((token, idx) => {
                      if (typeof token === 'object' && token.isMention) {
                        return (
                          <span key={idx} className="corp-mention-pill">
                            @{token.name}
                          </span>
                        )
                      }
                      return token
                    })
                  ) : (
                    c.content
                  )}
                </div>

                {/* Comment photo attachment */}
                {Array.isArray(c.attachments) && c.attachments.filter(att => att?.url && !String(att.url).startsWith('blob:')).length > 0 && (
                  <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                    {c.attachments.filter(att => att?.url && !String(att.url).startsWith('blob:')).map((att, idx) => (
                      <a key={idx} href={att.url} target="_blank" rel="noreferrer">
                        <img
                          src={att.url}
                          alt=""
                          style={{ width: '80px', height: '80px', borderRadius: '10px', objectFit: 'cover', border: '1px solid var(--ch-border)' }}
                          onError={e => { e.currentTarget.style.display = 'none' }}
                        />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })
      )}

      {/* Comment composer */}
      <div style={{ position: 'relative', zIndex: mentionQuery !== null ? 9999 : 10, display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
        {pendingPhoto && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '8px', width: 'fit-content' }}>
            <img src={pendingPhoto.previewUrl} alt="" style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'cover' }} />
            <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 800 }}>Фото прикріплено (стиснуто)</span>
            <button type="button" onClick={() => setPendingPhoto(null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, fontWeight: 900 }}>✕</button>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handlePhotoSelect}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="corp-btn-subtle"
            style={{ padding: '8px 10px' }}
            title="Прикріпити фото (з автостисненням)"
          >
            <ImageIcon size={16} />
          </button>

          <input
            ref={textareaRef}
            type="text"
            value={text}
            onChange={handleTextChange}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Напишіть відповідь... (Введіть @ для згадки колеги)"
            style={{
              flex: 1,
              padding: '9px 14px',
              borderRadius: '12px',
              background: 'var(--ch-surface-inset)',
              border: '1px solid var(--ch-border)',
              color: 'var(--ch-text-primary)',
              fontSize: '0.86rem',
              outline: 'none',
              fontFamily: 'inherit'
            }}
          />

          <button
            type="button"
            disabled={submitting || (!text.trim() && !pendingPhoto)}
            onClick={handleSend}
            className="corp-btn-primary"
            style={{ padding: '9px 14px' }}
          >
            <Send size={14} />
          </button>
        </div>

        {mentionQuery !== null && (
          <MentionAutocomplete
            users={users}
            query={mentionQuery}
            onSelect={handleSelectMention}
            style={{ bottom: 'calc(100% + 6px)', top: 'auto' }}
          />
        )}
      </div>
    </div>
  )
}
