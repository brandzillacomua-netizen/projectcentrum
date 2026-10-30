import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Send,
  Pin,
  CheckSquare,
  Megaphone,
  MessageSquare,
  Wrench,
  Lightbulb,
  ShieldAlert,
  Loader2,
  Sparkles
} from 'lucide-react'
import { extractMentionedUserIds } from '../../utils/corporateHelpers'
import { MentionAutocomplete } from '../common/MentionAutocomplete'
import { AttachmentDropzone } from '../common/AttachmentDropzone'
import { CorporateAvatar } from '../common/CorporateAvatar'
import { useCorporateAttachmentManager } from '../../hooks/useCorporateImageCompressor'

const MODAL_CATEGORIES = [
  { id: 'announcement', label: 'Офіційні накази', icon: Megaphone, color: '#ef4444' },
  { id: 'discussion', label: 'Робочі питання', icon: MessageSquare, color: '#3b82f6' },
  { id: 'technical', label: 'Техніка & Обладнання', icon: Wrench, color: '#f59e0b' },
  { id: 'suggestion', label: 'Пропозиції та ідеї', icon: Lightbulb, color: '#10b981' }
]

export function CorporatePostModal({
  isOpen,
  onClose,
  currentUser,
  users = [],
  onSubmit,
  isSubmitting = false,
  defaultCategory = 'discussion'
}) {
  const [category, setCategory] = useState('discussion')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [requiresAck, setRequiresAck] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
  const [targetAudience, setTargetAudience] = useState('all')

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

  // Initialize or reset category when modal opens or defaultCategory changes
  useEffect(() => {
    if (isOpen) {
      const validCat = MODAL_CATEGORIES.some(c => c.id === defaultCategory)
        ? defaultCategory
        : 'discussion'
      setCategory(validCat)
      setRequiresAck(validCat === 'announcement')
    }
  }, [isOpen, defaultCategory])

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!isOpen) return
    const originalOverflow = document.body.style.overflow
    const originalPaddingRight = document.body.style.paddingRight
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`
    }
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.paddingRight = originalPaddingRight
    }
  }, [isOpen])

  // ESC key to close modal
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, content, attachments])

  if (!isOpen) return null

  const handleCategorySelect = (catId) => {
    setCategory(catId)
    if (catId === 'announcement') {
      setRequiresAck(true)
    } else {
      setRequiresAck(false)
    }
  }

  const handleTextChange = (e) => {
    const val = e.target.value
    setContent(val)

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

  const handleClose = () => {
    if (content.trim() || attachments.length > 0 || title.trim()) {
      if (!window.confirm('Скинути чернетку публікації?')) return
    }
    resetForm()
    onClose()
  }

  const resetForm = () => {
    setTitle('')
    setContent('')
    setRequiresAck(false)
    setIsPinned(false)
    setTargetAudience('all')
    setMentionQuery(null)
    setMentionPos(null)
    clearAll()
  }

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    if (!content.trim() && attachments.length === 0) return

    const mentionedIds = extractMentionedUserIds(content)

    await onSubmit({
      title: title.trim(),
      content: content.trim(),
      category,
      requires_ack: category === 'announcement' ? Boolean(requiresAck) : false,
      is_pinned: isPinned,
      target_audience: targetAudience,
      mentioned_user_ids: mentionedIds,
      attachments
    })

    resetForm()
    onClose()
  }

  const activeCategoryObj = MODAL_CATEGORIES.find(c => c.id === category) || MODAL_CATEGORIES[1]

  const modalContent = (
    <div className="corp-modal-overlay" onClick={handleClose}>
      <div
        className="corp-modal-box corp-composer-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="corp-modal-header">
          <div className="corp-modal-header-info">
            <div
              className="corp-modal-channel-icon"
              style={{
                background: `${activeCategoryObj.color}15`,
                color: activeCategoryObj.color,
                borderColor: `${activeCategoryObj.color}35`
              }}
            >
              <activeCategoryObj.icon size={18} />
            </div>
            <div>
              <h3 className="corp-modal-title">Створити публікацію</h3>
              <p className="corp-modal-subtitle">
                Канал: <strong>{activeCategoryObj.label}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            className="corp-modal-btn-close"
            onClick={handleClose}
            title="Закрити (ESC)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="corp-modal-body">
          {/* Channel Selector Row (matches sidebar channels 1:1) */}
          <div className="corp-modal-channels-bar">
            {MODAL_CATEGORIES.map(cat => {
              const isSelected = category === cat.id
              const IconComp = cat.icon
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`corp-modal-channel-pill ${isSelected ? 'active' : ''}`}
                  style={isSelected ? {
                    background: `${cat.color}18`,
                    borderColor: cat.color,
                    color: cat.color
                  } : {}}
                  onClick={() => handleCategorySelect(cat.id)}
                >
                  <IconComp size={15} />
                  <span>{cat.label}</span>
                </button>
              )
            })}
          </div>

          {/* Official Announcement Security Notice */}
          {category === 'announcement' && (
            <div className="corp-modal-announcement-banner">
              <ShieldAlert size={19} className="corp-modal-announcement-icon" />
              <div>
                <strong>Офіційне розпорядження керівництва</strong>
                <p>
                  Публікація з'явиться у пріоритетному блоці всіх співробітників компанії
                  із обов'язковою фіксацією підтвердження ознайомлення.
                </p>
              </div>
            </div>
          )}

          {/* Title Input */}
          <div className="corp-modal-field">
            <input
              type="text"
              className="corp-modal-input-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={
                category === 'announcement'
                  ? 'Тема або номер офіційного наказу / розпорядження...'
                  : 'Тема публікації (необов\'язково)...'
              }
              autoFocus={category === 'announcement'}
            />
          </div>

          {/* Content Textarea with Mention Autocomplete */}
          <div className="corp-modal-field" style={{ position: 'relative' }}>
            <textarea
              ref={textareaRef}
              className="corp-modal-textarea"
              value={content}
              onChange={handleTextChange}
              placeholder={
                category === 'announcement'
                  ? 'Введіть детальний текст розпорядження, вимоги та терміни виконання...'
                  : 'Напишіть допис, новину чи запитання для команди... Введіть @ для згадки колеги'
              }
              rows={4}
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
          <div className="corp-modal-field">
            <AttachmentDropzone
              attachments={attachments}
              onAddFiles={addFiles}
              onRemove={removeAttachment}
              isProcessing={isProcessing}
            />
          </div>

          {/* Settings & Options Row */}
          <div className="corp-modal-options-row">
            <div className="corp-modal-options-left">
              {/* Target Audience Dropdown */}
              <div className="corp-modal-audience-wrap">
                <span className="corp-modal-option-label">Одержувачі:</span>
                <select
                  value={targetAudience}
                  onChange={e => setTargetAudience(e.target.value)}
                  className="corp-select corp-modal-audience-select"
                >
                  <option value="all">Вся компанія</option>
                  <option value="shop1">Цех №1</option>
                  <option value="shop2">Цех №2</option>
                  <option value="warehouse">Склад</option>
                  <option value="office">Офіс & Керівництво</option>
                </select>
              </div>

              {/* Require Acknowledgment Toggle (only for announcements) */}
              {category === 'announcement' && (
                <button
                  type="button"
                  className={`corp-toggle-btn ${requiresAck ? 'active-ack' : ''}`}
                  onClick={() => setRequiresAck(prev => !prev)}
                  title="Вимагати від співробітників підтвердження підписом"
                >
                  <CheckSquare size={15} />
                  <span>Обов'язкове ознайомлення</span>
                </button>
              )}

              {/* Admin Pin Toggle */}
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
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="corp-modal-footer">
          <div className="corp-modal-author-badge">
            <CorporateAvatar user={currentUser} size={28} />
            <span>{currentUser?.first_name ? `${currentUser.first_name} ${currentUser.last_name || ''}`.trim() : (currentUser?.login || 'Користувач')}</span>
          </div>

          <div className="corp-modal-footer-actions">
            <button
              type="button"
              onClick={handleClose}
              className="corp-btn-subtle"
              disabled={isSubmitting}
            >
              Скасувати
            </button>

            <button
              type="button"
              className="corp-btn-primary"
              disabled={isSubmitting || (!content.trim() && attachments.length === 0)}
              onClick={handleSubmit}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>Публікуємо...</span>
                </>
              ) : (
                <>
                  <Send size={15} />
                  <span>Опублікувати</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent
}

