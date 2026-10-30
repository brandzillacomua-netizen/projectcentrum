import React, { useState, useMemo } from 'react'
import {
  Search,
  X,
  Inbox,
  PenSquare,
  Plus,
  MessageSquare,
  Bell,
  Wrench,
  Lightbulb,
  Pin,
  Building2
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
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)

  const activeCat = selectedCategory || 'all'
  const activeChannel = CHANNEL_META[activeCat] || CHANNEL_META.all
  const ActiveIcon = activeChannel.icon

  const filteredPosts = useMemo(() => {
    return (posts || []).filter(post => {
      // Channel / Pinned filter
      if (activeCat === 'pinned') {
        if (!post.is_pinned) return false
      } else if (activeCat !== 'all' && post.category !== activeCat) {
        return false
      }

      // Search query filter (title, content, author)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const title = String(post.title || '').toLowerCase()
        const content = String(post.content || '').toLowerCase()
        const authorName = `${post.author?.first_name || ''} ${post.author?.last_name || ''}`.toLowerCase()
        if (!title.includes(q) && !content.includes(q) && !authorName.includes(q)) {
          return false
        }
      }
      return true
    })
  }, [posts, activeCat, searchQuery])

  return (
    <div className="corp-feed-container">
      {/* ── FEED ACTIONS & SEARCH TOOLBAR ─────────────────────────────── */}
      <div className="corp-card corp-channel-toolbar">
        {/* Active Channel Tag & Count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            className="corp-channel-badge"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: '10px',
              fontWeight: 800,
              fontSize: '0.82rem',
              color: activeChannel.color,
              background: 'var(--ch-surface-inset)',
              border: '1px solid var(--ch-border)'
            }}
          >
            <ActiveIcon size={14} />
            <span>#{activeChannel.label}</span>
          </span>
          <span className="corp-channel-toolbar-count">
            {filteredPosts.length} {filteredPosts.length === 1 ? 'допис' : filteredPosts.length < 5 ? 'дописи' : 'дописів'}
          </span>
        </div>

        {/* Right Tools: Search & Create Button */}
        <div className="corp-channel-toolbar-tools">
          <div className="corp-search-box">
            <Search size={15} color="var(--ch-text-dim)" />
            <input
              type="text"
              className="corp-search-input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Пошук у стрічці..."
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="corp-search-clear-btn"
                title="Очистити пошук"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            type="button"
            className="corp-btn-primary"
            onClick={() => setIsModalOpen(true)}
            style={{ padding: '8px 16px', borderRadius: '12px', fontSize: '0.82rem' }}
          >
            <Plus size={15} />
            <span>Створити допис</span>
          </button>
        </div>
      </div>

      {/* ── SLEEK FEED PROMPT BAR ─────────────────────────────────────── */}
      <div
        className="corp-card corp-feed-prompt-bar"
        onClick={() => setIsModalOpen(true)}
        role="button"
        tabIndex={0}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
          <CorporateAvatar user={currentUser} size={42} />
          <div className="corp-feed-prompt-input">
            Опублікувати допис у #{activeChannel.label}...
          </div>
        </div>

        <button
          type="button"
          className="corp-btn-primary corp-feed-prompt-btn"
          onClick={(e) => {
            e.stopPropagation()
            setIsModalOpen(true)
          }}
        >
          <PenSquare size={15} />
          <span>Написати допис</span>
        </button>
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
                {searchQuery ? 'За вашим запитом нічого не знайдено' : 'У цьому каналі поки немає публікацій'}
              </h3>
              <p className="corp-feed-empty-desc">
                {searchQuery
                  ? 'Спробуйте уточнити пошукові слова або скинути рядок пошуку.'
                  : `Будьте першим, хто поділиться важливою інформацією у каналі #${activeChannel.label}.`}
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
