import React, { useState, useMemo } from 'react'
import { Search, Filter, AlertCircle, FileText, X, Inbox } from 'lucide-react'
import { POST_CATEGORIES } from '../../utils/corporateHelpers'
import { CorporateComposer } from './CorporateComposer'
import { CorporatePostCard } from './CorporatePostCard'

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
  const [internalCategory, setInternalCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const activeCat = onSelectCategory ? selectedCategory : internalCategory
  const setCat = onSelectCategory || setInternalCategory

  const filteredPosts = useMemo(() => {
    return (posts || []).filter(post => {
      // Category or Pinned filter
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Search & Filter Bar */}
      <div className="corp-card corp-filter-bar">
        {/* Search */}
        <div className="corp-search-box">
          <Search size={16} color="var(--ch-text-dim)" />
          <input
            type="text"
            className="corp-search-input"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Пошук публікацій, наказів або колег..."
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', color: 'var(--ch-text-dim)', cursor: 'pointer', padding: 0 }}
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="corp-filter-chips">
          <button
            type="button"
            className={`corp-chip ${activeCat === 'all' ? 'active' : ''}`}
            onClick={() => setCat('all')}
          >
            <span>Всі</span>
            <span style={{ opacity: 0.75 }}>({posts.length})</span>
          </button>

          {Object.values(POST_CATEGORIES).map(cat => {
            const count = posts.filter(p => p.category === cat.id).length
            const isSelected = activeCat === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                className={`corp-chip ${isSelected ? 'active' : ''}`}
                onClick={() => setCat(cat.id)}
                style={isSelected ? { background: cat.color, borderColor: cat.color } : {}}
              >
                <span>{cat.label}</span>
                <span style={{ opacity: 0.75 }}>({count})</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Post Composer Studio */}
      <CorporateComposer
        currentUser={currentUser}
        users={users}
        onSubmit={onCreatePost}
        isSubmitting={isSubmitting}
        initialCategory={activeCat !== 'all' && activeCat !== 'pinned' ? activeCat : 'discussion'}
      />

      {/* Posts Feed Stream */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
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
          <div
            className="corp-card"
            style={{
              padding: '60px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px'
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: 'var(--ch-surface-inset)',
                border: '1px solid var(--ch-border)',
                color: 'var(--ch-text-dim)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Inbox size={26} strokeWidth={1.75} />
            </div>
            <div>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 800, color: 'var(--ch-text-primary)' }}>
                {searchQuery ? 'За вашим запитом нічого не знайдено' : 'Стрічка очікує першого допису'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--ch-text-muted)', maxWidth: '420px', lineHeight: 1.5 }}>
                {searchQuery
                  ? 'Спробуйте змінити пошукові слова або скинути категорію фільтрації.'
                  : 'Створіть робоче оголошення, технічне питання або поділіться новиною з колегами вище.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
