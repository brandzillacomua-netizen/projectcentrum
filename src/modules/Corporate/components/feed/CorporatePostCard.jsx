import React, { useState } from 'react'
import {
  Pin,
  CheckCircle2,
  MessageSquare,
  CheckSquare,
  FileText,
  User,
  Trash2,
  PlusCircle,
  Clock,
  Download,
  AlertTriangle,
  Users
} from 'lucide-react'
import { POST_CATEGORIES, renderFormattedContent, bytesToLabel } from '../../utils/corporateHelpers'
import { CorporateComments } from './CorporateComments'
import { CorporateAckModal } from './CorporateAckModal'
import { CorporateAvatar } from '../common/CorporateAvatar'
import { CorporateImageLightbox } from '../common/CorporateImageLightbox'

export function CorporatePostCard({
  post,
  currentUser,
  users = [],
  onToggleAck,
  onDelete,
  onTogglePin,
  onCreateTaskFromPost
}) {
  const [showComments, setShowComments] = useState(false)
  const [showAckModal, setShowAckModal] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(null)

  const author = post.author
  const authorName = author
    ? `${author.first_name || ''} ${author.last_name || ''}`.trim() || author.login
    : 'Співробітник'
  const authorInitials = author?.first_name
    ? `${author.first_name[0]}${author.last_name ? author.last_name[0] : ''}`.toUpperCase()
    : 'U'
  const categoryConfig = POST_CATEGORIES[post.category] || POST_CATEGORIES.general
  const dateStr = post.created_at
    ? new Date(post.created_at).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : ''

  const isAuthor = String(post.author_id) === String(currentUser?.id)
  const isAdmin = currentUser?.login === 'admin@workshop.local' ||
    currentUser?.position === 'Адмін' ||
    currentUser?.access_rights?.director

  const ackCount = (post.acks || []).length
  const isAckedByMe = (post.acks || []).some(a => String(a.user_id) === String(currentUser?.id))

  const contentTokens = renderFormattedContent(post.content, users)

  const isImageAttachment = (att) => {
    if (!att || !att.url) return false
    if (String(att.url).startsWith('blob:')) return false
    if (att.type === 'image') return true
    if (att.mime && att.mime.startsWith('image/')) return true
    if (String(att.url).startsWith('data:image/')) return true
    const name = att.name || att.url || ''
    return /\.(webp|jpg|jpeg|png|gif|svg|avif|bmp|ico)(\?.*)?$/i.test(name)
  }

  const imageAttachments = Array.isArray(post.attachments)
    ? post.attachments.filter(isImageAttachment)
    : []
  const fileAttachments = Array.isArray(post.attachments)
    ? post.attachments.filter(a => a?.url && !String(a.url).startsWith('blob:') && !isImageAttachment(a))
    : []

  return (
    <article className={`corp-card corp-post-card ${post.is_pinned ? 'pinned' : ''}`}>
      {/* Top row: Category, Pin, Author, Date, Actions */}
      <div className="corp-post-header">
        <div className="corp-post-author-wrap">
          <CorporateAvatar
            user={author}
            size={44}
            borderRadius="14px"
          />

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h4 className="corp-post-author-name">{authorName}</h4>
              {author?.position && (
                <span style={{ fontSize: '0.74rem', color: 'var(--ch-text-dim)', fontWeight: 600 }}>
                  · {author.position}
                </span>
              )}
            </div>

            <div className="corp-post-meta">
              <span className="corp-post-time">
                <Clock size={12} /> {dateStr}
              </span>

              <span
                className="corp-cat-badge"
                style={{
                  background: `${categoryConfig.color}15`,
                  color: categoryConfig.color,
                  border: `1px solid ${categoryConfig.color}35`
                }}
              >
                {categoryConfig.label}
              </span>

              {post.target_audience && post.target_audience !== 'all' && (
                <span className="corp-audience-badge">
                  {post.target_audience === 'shop1' ? 'ЦЕХ №1' : post.target_audience === 'shop2' ? 'ЦЕХ №2' : post.target_audience === 'warehouse' ? 'СКЛАД' : 'ОФІС'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right tools (Pin / Delete) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {post.is_pinned && (
            <div className="corp-pinned-banner">
              <Pin size={12} />
              <span>ЗАКРІПЛЕНО</span>
            </div>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={() => onTogglePin(post.id, post.is_pinned)}
              className="corp-footer-action-btn"
              style={{ color: post.is_pinned ? '#f59e0b' : undefined, padding: '4px 8px' }}
              title={post.is_pinned ? 'Відкріпити' : 'Закріпити вгорі'}
            >
              <Pin size={15} />
            </button>
          )}

          {(isAuthor || isAdmin) && (
            <button
              type="button"
              onClick={() => onDelete(post.id)}
              className="corp-footer-action-btn"
              style={{ padding: '4px 8px' }}
              onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--ch-text-muted)'}
              title="Видалити публікацію"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Title if present */}
      {post.title && (
        <h3 className="corp-post-title">
          {post.title}
        </h3>
      )}

      {/* Main Content with Formatted Mentions */}
      <div className="corp-post-body">
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
          post.content
        )}
      </div>

      {/* Attachments: Image Gallery */}
      {imageAttachments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: imageAttachments.length === 1 ? '1fr' : (imageAttachments.length === 2 ? '1fr 1fr' : 'repeat(auto-fit, minmax(220px, 1fr))'),
              gap: '12px',
              borderRadius: '16px',
              overflow: 'hidden'
            }}
          >
            {imageAttachments.map((att, idx) => (
              <div
                key={idx}
                className="corp-post-image-thumb"
                onClick={() => setLightboxIndex(idx)}
                role="button"
                tabIndex={0}
                title="Натисніть для перегляду фото на весь екран"
                style={{
                  borderRadius: '14px',
                  overflow: 'hidden',
                  border: '1px solid var(--ch-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--ch-surface-inset)',
                  maxHeight: imageAttachments.length === 1 ? '560px' : '320px',
                  cursor: 'zoom-in',
                  position: 'relative'
                }}
              >
                <img
                  src={att.url}
                  alt={att.name || 'Зображення публікації'}
                  loading="lazy"
                  style={{
                    maxWidth: '100%',
                    maxHeight: imageAttachments.length === 1 ? '560px' : '320px',
                    width: imageAttachments.length === 1 ? 'auto' : '100%',
                    height: 'auto',
                    objectFit: 'contain',
                    display: 'block',
                    margin: '0 auto',
                    transition: 'transform 0.25s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.015)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  onError={e => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attachments: Files / Documents */}
      {fileAttachments.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {fileAttachments.map((att, idx) => (
            <a
              key={idx}
              href={att.url}
              target="_blank"
              rel="noreferrer"
              download
              className="corp-btn-subtle"
              style={{ textDecoration: 'none', padding: '8px 12px' }}
            >
              <FileText size={16} color="var(--ch-accent)" />
              <span style={{ fontWeight: 800 }}>{att.name}</span>
              {att.size && (
                <span style={{ color: 'var(--ch-text-dim)', fontSize: '0.72rem' }}>
                  ({bytesToLabel(att.size)})
                </span>
              )}
              <Download size={13} style={{ marginLeft: '4px', opacity: 0.6 }} />
            </a>
          ))}
        </div>
      )}

      {/* Official Acknowledgment Hero Callout (Only for Official Announcements) */}
      {post.requires_ack && post.category === 'announcement' && (
        <div className={`corp-ack-hero-box ${isAckedByMe ? 'acknowledged' : ''}`}>
          <div className="corp-ack-hero-text">
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: isAckedByMe ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: isAckedByMe ? '#10b981' : '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {isAckedByMe ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            </div>
            <div>
              <div style={{ fontSize: '0.86rem', fontWeight: 900, color: 'var(--ch-text-primary)' }}>
                {isAckedByMe
                  ? 'Ви успішно підтвердили ознайомлення з цим розпорядженням'
                  : 'Офіційний наказ: обов\'язкове ознайомлення співробітника'}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--ch-text-muted)', marginTop: '2px' }}>
                Підтвердження фіксується у внутрішньому реєстрі підприємства.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => onToggleAck(post.id)}
              className={`corp-ack-btn-sign ${isAckedByMe ? 'completed' : 'pending'}`}
            >
              <CheckCircle2 size={16} />
              <span>{isAckedByMe ? 'Ознайомлено' : 'Я ознайомився(-лась)'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAckModal(true)}
              className="corp-btn-subtle"
              style={{ padding: '8px 12px', fontSize: '0.76rem' }}
              title="Переглянути список усіх, хто підписав"
            >
              <Users size={14} />
              <span>{ackCount} підписів</span>
            </button>
          </div>
        </div>
      )}

      {/* Footer Toolbar: Task conversion & Comments toggle */}
      <div className="corp-post-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onCreateTaskFromPost && (
            <button
              type="button"
              onClick={() => onCreateTaskFromPost(post)}
              className="corp-footer-action-btn"
              title="Створити завдання на основі цього обговорення"
            >
              <PlusCircle size={15} color="var(--ch-accent)" />
              <span>Створити завдання</span>
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setShowComments(!showComments)}
            className={`corp-footer-action-btn ${showComments ? 'active' : ''}`}
          >
            <MessageSquare size={15} />
            <span>Коментарі</span>
            {post.comments_count > 0 && (
              <span className="corp-nav-badge" style={{ marginLeft: '4px' }}>
                {post.comments_count}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Comments section */}
      {showComments && (
        <CorporateComments
          postId={post.id}
          currentUser={currentUser}
          users={users}
        />
      )}

      {/* Acknowledgment List Modal */}
      {showAckModal && (
        <CorporateAckModal
          postId={post.id}
          postTitle={post.title}
          onClose={() => setShowAckModal(false)}
        />
      )}

      {/* Social Media Style Image Lightbox Viewer */}
      <CorporateImageLightbox
        isOpen={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
        images={imageAttachments}
        initialIndex={lightboxIndex !== null ? lightboxIndex : 0}
      />
    </article>
  )
}
