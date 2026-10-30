import React, { useState, useMemo } from 'react'
import {
  Inbox,
  PenSquare,
  Plus,
  MessageSquare,
  Bell,
  Wrench,
  Lightbulb,
  Pin,
  Building2,
  Image,
  Paperclip
} from 'lucide-react'
import { POST_CATEGORIES } from '../../utils/corporateHelpers'
import { CorporatePostCard } from './CorporatePostCard'
import { CorporatePostModal } from './CorporatePostModal'
import { CorporateAvatar } from '../common/CorporateAvatar'

const CHANNEL_META = {
  all: { label: 'Вся стрічка', icon: Building2, color: 'var(--ch-accent)', desc: 'Всі публікації підприємства' },
  announcement: { label: 'Офіційні накази', icon: Bell, color: '#ef4444', desc: 'Накази керівництва та обов\'язкові інструкції' },
  discussion: { label: 'Робочі питання', icon: MessageSquare, color: '#3b82f6', desc: 'Оперативні питання та робочі узгодження' },
  technical: { label: 'Техніка & Обладнання', icon: Wrench, color: '#f59e0b', desc: 'Стан станків, інструменту та оснастки' },
  suggestion: { label: 'Пропозиції та ідеї', icon: Lightbulb, color: '#10b981', desc: 'Раціоналізаторські ідеї та покращення' },
  pinned: { label: 'Закріплені дописи', icon: Pin, color: '#f59e0b', desc: 'Важливі закріплені матеріали' }
}

export function CorporateFeed({
  posts = [],
  currentUser,
  users = [],
  onCreatePost,
  onDeletePost,
  onToggleAck,
  onTogglePin,
  onCreateTaskFromPost,
  isSubmitting = false,
  selectedCategory = 'all',
  onSelectCategory
}) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const activeCat = selectedCategory || 'all'
  const activeChannel = CHANNEL_META[activeCat] || CHANNEL_META.all
  const ActiveIcon = activeChannel.icon

  const filteredPosts = useMemo(() => {
    return (posts || []).filter(post => {
      if (activeCat === 'pinned') {
        return Boolean(post.is_pinned)
      } else if (activeCat !== 'all' && post.category !== activeCat) {
        return false
      }
      return true
    })
  }, [posts, activeCat])

  return (
    <div className="corp-feed-container">
      {/* ── MOBILE HORIZONTAL CHANNELS SCROLLBAR (Visible on mobile/tablet <=860px) ── */}
      <div className="corp-mobile-channels-bar">
        {Object.entries(CHANNEL_META).map(([key, meta]) => {
          const Icon = meta.icon
          const isSelected = activeCat === key
          const count = key === 'all'
            ? posts.length
            : key === 'pinned'
            ? posts.filter(p => p.is_pinned).length
            : posts.filter(p => p.category === key).length

          return (
            <button
              key={key}
              type="button"
              className={`corp-mobile-channel-chip ${isSelected ? 'active' : ''}`}
              onClick={() => onSelectCategory && onSelectCategory(key)}
              style={isSelected ? { color: meta.color, borderColor: meta.color } : {}}
            >
              <Icon size={13} />
              <span>{meta.label}</span>
              <span className="corp-mobile-channel-badge">{count}</span>
            </button>
          )
        })}
      </div>

      {/* ── PROMINENT SPACIOUS CREATION PROMPT CARD ───────────────────── */}
      <div
        className="corp-card corp-feed-prompt-card"
        onClick={() => setIsModalOpen(true)}
        role="button"
        tabIndex={0}
      >
        <div className="corp-prompt-card-top">
          <CorporateAvatar user={currentUser} size={46} />
          <div className="corp-prompt-card-fake-input">
            Поділіться новиною, оголошенням чи робочим питанням у #{activeChannel.label}...
          </div>
        </div>

        <div className="corp-prompt-card-bottom">
          <div className="corp-prompt-channel-tag" style={{ color: activeChannel.color }}>
            <ActiveIcon size={15} />
            <span>#{activeChannel.label}</span>
            <span className="corp-prompt-channel-count">
              ({filteredPosts.length} {filteredPosts.length === 1 ? 'допис' : filteredPosts.length < 5 ? 'дописи' : 'дописів'})
            </span>
          </div>

          <div className="corp-prompt-actions-row">
            <button
              type="button"
              className="corp-prompt-tool-btn"
              onClick={(e) => {
                e.stopPropagation()
                setIsModalOpen(true)
              }}
              title="Додати фото"
            >
              <Image size={15} color="#10b981" />
              <span>Фото</span>
            </button>

            <button
              type="button"
              className="corp-prompt-tool-btn"
              onClick={(e) => {
                e.stopPropagation()
                setIsModalOpen(true)
              }}
              title="Додати документ"
            >
              <Paperclip size={15} color="#3b82f6" />
              <span>Файл</span>
            </button>

            <button
              type="button"
              className="corp-btn-primary corp-prompt-submit-btn"
              onClick={(e) => {
                e.stopPropagation()
                setIsModalOpen(true)
              }}
            >
              <PenSquare size={15} />
              <span>Написати допис</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── POSTS STREAM ──────────────────────────────────────────────── */}
      <div className="corp-feed-stream">
        {filteredPosts.map(post => (
          <CorporatePostCard
            key={post.id}
            post={post}
            currentUser={currentUser}
            users={users}
            onToggleAck={onToggleAck}
            onDelete={onDeletePost}
            onTogglePin={onTogglePin}
            onCreateTaskFromPost={onCreateTaskFromPost}
          />
        ))}

        {filteredPosts.length === 0 && (
          <div className="corp-card corp-feed-empty-state">
            <div className="corp-feed-empty-icon">
              <Inbox size={28} strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="corp-feed-empty-title">
                У цьому каналі поки немає публікацій
              </h3>
              <p className="corp-feed-empty-desc">
                Будьте першим, хто поділиться важливою інформацією у каналі #{activeChannel.label}.
              </p>
            </div>
            <button
              type="button"
              className="corp-btn-subtle"
              onClick={() => setIsModalOpen(true)}
              style={{ marginTop: '8px' }}
            >
              <Plus size={14} />
              <span>Опублікувати допис</span>
            </button>
          </div>
        )}
      </div>

      {/* ── POST CREATION MODAL ───────────────────────────────────────── */}
      <CorporatePostModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentUser={currentUser}
        users={users}
        onSubmit={onCreatePost}
        isSubmitting={isSubmitting}
        defaultCategory={activeCat !== 'all' && activeCat !== 'pinned' ? activeCat : 'discussion'}
      />
    </div>
  )
}
