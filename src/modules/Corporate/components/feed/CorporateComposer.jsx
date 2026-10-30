import React, { useState, useRef, useEffect } from 'react'
import {
  Send,
  Pin,
  CheckSquare,
  X,
  Paperclip,
  Megaphone,
  MessageSquare,
  ShieldAlert
} from 'lucide-react'
import { POST_CATEGORIES, extractMentionedUserIds } from '../../utils/corporateHelpers'
import { MentionAutocomplete } from '../common/MentionAutocomplete'
import { AttachmentDropzone } from '../common/AttachmentDropzone'
import { CorporateAvatar } from '../common/CorporateAvatar'
import { useCorporateAttachmentManager } from '../../hooks/useCorporateImageCompressor'

export function CorporateComposer({
  currentUser,
  users = [],
  onSubmit,
  isSubmitting = false,
  initialCategory = 'discussion'
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [category, setCategory] = useState(initialCategory)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [requiresAck, setRequiresAck] = useState(initialCategory === 'announcement')
  const [isPinned, setIsPinned] = useState(false)
  const [targetAudience, setTargetAudience] = useState('all')

  // Sync if initialCategory prop changes
  useEffect(() => {
    if (initialCategory) {
      setCategory(initialCategory)
      if (initialCategory === 'announcement') {
        setRequiresAck(true)
      }
    }
  }, [initialCategory])

  // Mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState(null)
  const [mentionPos, setMentionPos] = useState(null)
  const textareaRef = useRef(null)

  const {
    attachments,
    isProcessing,
    addFiles,
    removeAttachment,
    clearAll
  } = useCorporateAttachmentManager()

  const isAdmin = currentUser?.login === 'admin@workshop.local' ||
    currentUser?.position === 'Адмін' ||
    currentUser?.access_rights?.director

  const handleTextChange = (e) => {
    const val = e.target.value
    setContent(val)

    // Check if cursor is immediately after '@'
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
    const textBeforeAt = content.slice(0, mentionPos - (mentionQuery ? mentionQuery.length + 1 : 1))
    const textAfterCursor = content.slice(mentionPos)
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.login
    const newText = `${textBeforeAt}@[${fullName}](${user.id}) ${textAfterCursor}`

    setContent(newText)
    setMentionQuery(null)
    setMentionPos(null)

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
      }
    }, 50)
  }

  const handleCancel = () => {
    if (content.trim() || attachments.length > 0) {
      if (!window.confirm('Скинути чернетку публікації?')) return
    }
    setContent('')
    setTitle('')
    clearAll()
    setIsExpanded(false)
  }

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    if (!content.trim() && attachments.length === 0) return

    const mentionedIds = extractMentionedUserIds(content)

    await onSubmit({
      title: title.trim(),
      content: content.trim(),
      category,
      requires_ack: requiresAck,
      is_pinned: isPinned,
      target_audience: targetAudience,
      mentioned_user_ids: mentionedIds,
      attachments
    })

    // Reset
    setTitle('')
    setContent('')
    setRequiresAck(false)
    setIsPinned(false)
    clearAll()
    setIsExpanded(false)
  }

  // ── COLLAPSED PROMPT STATE ────────────────────────────────────────────────
  if (!isExpanded && !content.trim() && attachments.length === 0) {
    return (
      <div
        className="corp-card corp-composer-collapsed"
        onClick={() => setIsExpanded(true)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
          <CorporateAvatar user={currentUser} size={38} />
          <div className="corp-composer-fake-input">
            Поділіться новиною, оголошенням або робочим питанням...
          </div>
        </div>

        <div className="corp-composer-quick-actions">
          <button
            type="button"
            className="corp-quick-action-btn announcement"
            onClick={(e) => {
              e.stopPropagation()
              setCategory('announcement')
              setRequiresAck(true)
              setIsExpanded(true)
            }}
            title="Створити офіційне оголошення або наказ"
          >
            <Megaphone size={14} color="#ef4444" />
            <span>Наказ</span>
          </button>

          <button
            type="button"
            className="corp-quick-action-btn discussion"
            onClick={(e) => {
              e.stopPropagation()
              setCategory('discussion')
              setIsExpanded(true)
            }}
            title="Задати робоче питання"
          >
            <MessageSquare size={14} color="#3b82f6" />
            <span>Питання</span>
          </button>

          <button
            type="button"
            className="corp-quick-action-btn attachment"
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(true)
            }}
            title="Додати фото або файл"
          >
            <Paperclip size={14} color="#10b981" />
            <span>Файл</span>
          </button>
        </div>
      </div>
    )
  }

  // ── EXPANDED STUDIO STATE ────────────────────────────────────────────────
  return (
    <div
      className="corp-card corp-composer-card corp-composer-expanded"
      style={{
        overflow: 'visible',
        position: 'relative',
        zIndex: mentionQuery !== null ? 9999 : 20
      }}
    >
      {/* Category selector row & Close button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--ch-border)', paddingBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div className="corp-composer-categories">
          {Object.values(POST_CATEGORIES).map(cat => {
            const isSelected = category === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                className={`corp-cat-pill ${isSelected ? 'active' : ''}`}
                style={{
                  '--cat-color': cat.color,
                  '--cat-color-subtle': `${cat.color}18`
                }}
                onClick={() => {
                  setCategory(cat.id)
                  if (cat.id === 'announcement') setRequiresAck(true)
                }}
              >
                <span>{cat.label}</span>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={handleCancel}
          className="corp-btn-close-composer"
          title="Згорнути"
        >
          <X size={16} />
        </button>
      </div>

      {/* Official Announcement Security Alert Banner */}
      {category === 'announcement' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '12px',
            padding: '10px 14px',
            fontSize: '0.8rem',
            color: '#ef4444',
            fontWeight: 700
          }}
        >
          <ShieldAlert size={18} flexShrink={0} />
          <span>
            <strong>Офіційне оголошення або наказ:</strong> Публікація з'явиться у пріоритетному блоці всіх співробітників із вимогою підтвердження ознайомлення.
          </span>
        </div>
      )}

      {/* Optional Title input */}
      {(category === 'announcement' || category === 'technical' || title) && (
        <input
          type="text"
          className="corp-composer-title-input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={category === 'announcement' ? 'Тема офіційного наказу або розпорядження...' : 'Тема публікації...'}
          autoFocus={category === 'announcement'}
        />
      )}

      {/* Content Textarea with Mention Trigger */}
      <div style={{ position: 'relative', zIndex: 9999 }}>
        <textarea
          ref={textareaRef}
          className="corp-composer-textarea"
          value={content}
          onChange={handleTextChange}
          placeholder="Напишіть допис або новину для команди... Введіть @ для згадки колеги"
          rows={3}
          autoFocus={category !== 'announcement'}
        />

        {mentionQuery !== null && (
          <MentionAutocomplete
            users={users}
            query={mentionQuery}
            onSelect={handleSelectMention}
          />
        )}
      </div>

      {/* Attachments preview & upload dropzone */}
      <AttachmentDropzone
        attachments={attachments}
        onAddFiles={addFiles}
        onRemove={removeAttachment}
        isProcessing={isProcessing}
      />

      {/* Actions Row */}
      <div className="corp-composer-actions-row">
        <div className="corp-composer-tools-left">
          {/* Require acknowledgment styled toggle */}
          <button
            type="button"
            className={`corp-toggle-btn ${requiresAck ? 'active-ack' : ''}`}
            onClick={() => setRequiresAck(prev => !prev)}
            title="Вимагати від співробітників підтвердження підписом"
          >
            <CheckSquare size={15} />
            <span>Обов'язкове ознайомлення</span>
          </button>

          {/* Admin Pin to top styled toggle */}
          {isAdmin && (
            <button
              type="button"
              className={`corp-toggle-btn ${isPinned ? 'active-pin' : ''}`}
              onClick={() => setIsPinned(prev => !prev)}
              title="Закріпити публікацію нагорі стрічки"
            >
              <Pin size={15} />
              <span>Закріпити нагорі</span>
            </button>
          )}

          {/* Audience picker */}
          <select
            value={targetAudience}
            onChange={e => setTargetAudience(e.target.value)}
            className="corp-select"
            title="Одержувачі повідомлення"
          >
            <option value="all">Для всієї компанії</option>
            <option value="shop1">Тільки Цех №1</option>
            <option value="shop2">Тільки Цех №2</option>
            <option value="warehouse">Тільки Склад</option>
            <option value="office">Тільки Офіс & Керівництво</option>
          </select>
        </div>

        <div className="corp-composer-tools-right">
          <button
            type="button"
            onClick={handleCancel}
            className="corp-btn-subtle"
            style={{ padding: '9px 16px', borderRadius: '12px' }}
          >
            Скасувати
          </button>

          <button
            type="button"
            className="corp-btn-primary"
            disabled={isSubmitting || (!content.trim() && attachments.length === 0)}
            onClick={handleSubmit}
          >
            <Send size={15} />
            <span>{isSubmitting ? 'Публікуємо...' : 'Опублікувати'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
