import React from 'react'
import {
  Building2,
  MessageSquare,
  CheckSquare,
  RefreshCw,
  Bell,
  Pin,
  FileCheck2,
  Users,
  PlusCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  Wrench,
  Lightbulb,
  AlertCircle,
  Radio
} from 'lucide-react'
import { POST_CATEGORIES } from '../utils/corporateHelpers'
import { CorporateAvatar } from './common/CorporateAvatar'
import { BroadcastPushModal } from '../../../components/common/BroadcastPushModal'

export function CorporateLayout({
  activeTab = 'feed', // 'feed' | 'tasks'
  onTabChange,
  postsCount = 0,
  tasksCount = 0,
  unreadAcksCount = 0,
  onRefresh,
  loading = false,
  currentUser,
  users = [],
  tasks = [],
  posts = [],
  selectedCategory = 'all',
  onSelectCategory,
  onToggleAck,
  onOpenNewTaskModal,
  children
}) {
  const currentUserId = String(currentUser?.id || '')
  const [isPushBroadcastOpen, setIsPushBroadcastOpen] = React.useState(false)

  // Current user display info
  const fullName = currentUser
    ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || currentUser.login
    : 'Користувач'
  const userInitials = currentUser?.first_name
    ? `${currentUser.first_name[0]}${currentUser.last_name ? currentUser.last_name[0] : ''}`.toUpperCase()
    : 'U'
  const roleText = currentUser?.position || (currentUser?.access_rights?.director ? 'Керівник' : 'Співробітник')
  const shiftText = currentUser?.shift ? `Зміна ${currentUser.shift}` : (currentUser?.department || 'Виробництво')

  // Top pending tasks for right widget (from company managementTasks)
  const userLogin = currentUser?.login || ''
  const myPendingTasks = (tasks || [])
    .filter(t => {
      if (t.status === 'done') return false
      const assignees = t.assignees || (t.assigned_to ? [t.assigned_to] : [])
      const isAssignedToMe = assignees.includes(userLogin) || assignees.includes(currentUserId)
      return isAssignedToMe || assignees.length === 0
    })
    .slice(0, 5)

  // Unread urgent official announcements for right widget
  const unreadAnnouncements = (posts || []).filter(p => {
    if (!p.requires_ack) return false
    const isAcked = (p.acks || []).some(a => String(a.user_id) === currentUserId)
    return !isAcked
  }).slice(0, 3)

  return (
    <div className="corp-hub-root">
      <div className={`corp-hub-container ${activeTab === 'tasks' ? 'tasks-active' : ''}`}>
        {/* ── LEFT ASIDE: PROFILE & CHANNEL NAVIGATION ──────────────── */}
        <aside className="corp-hub-aside-left">
          {/* User Identity Mini Card */}
          <div className="corp-card corp-profile-card">
            <div className="corp-profile-avatar-wrap">
              <CorporateAvatar
                user={currentUser}
                size={50}
                borderRadius="16px"
              />
              <div className="corp-profile-status-dot" title="В мережі" />
            </div>

            <div className="corp-profile-info">
              <h3 className="corp-profile-name" title={fullName}>{fullName}</h3>
              <div className="corp-profile-role" title={`${roleText} · ${shiftText}`}>
                {roleText} · {shiftText}
              </div>
              <div className="corp-profile-badge">
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                <span>В мережі</span>
              </div>
            </div>
          </div>

          {/* Navigation Channels */}
          <div className="corp-card corp-nav-section">
            <p className="corp-nav-title">Канали компанії</p>

            {/* All Feed */}
            <button
              type="button"
              className={`corp-nav-btn ${activeTab === 'feed' && selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => {
                onTabChange('feed')
                if (onSelectCategory) onSelectCategory('all')
              }}
            >
              <div className="corp-nav-btn-content">
                <MessageSquare size={17} />
                <span>Вся стрічка</span>
              </div>
              <span className="corp-nav-badge">{postsCount}</span>
            </button>

            {/* Official Announcements / Orders */}
            <button
              type="button"
              className={`corp-nav-btn ${activeTab === 'feed' && selectedCategory === 'announcement' ? 'active' : ''}`}
              onClick={() => {
                onTabChange('feed')
                if (onSelectCategory) onSelectCategory('announcement')
              }}
            >
              <div className="corp-nav-btn-content">
                <Bell size={17} color={unreadAcksCount > 0 ? '#ef4444' : undefined} />
                <span>Офіційні накази</span>
              </div>
              {unreadAcksCount > 0 ? (
                <span className="corp-nav-badge danger">
                  {unreadAcksCount} нових
                </span>
              ) : (
                <span className="corp-nav-badge">
                  {(posts || []).filter(p => p.category === 'announcement').length}
                </span>
              )}
            </button>

            {/* Work Discussions */}
            <button
              type="button"
              className={`corp-nav-btn ${activeTab === 'feed' && selectedCategory === 'discussion' ? 'active' : ''}`}
              onClick={() => {
                onTabChange('feed')
                if (onSelectCategory) onSelectCategory('discussion')
              }}
            >
              <div className="corp-nav-btn-content">
                <MessageSquare size={17} />
                <span>Робочі питання</span>
              </div>
              <span className="corp-nav-badge">
                {(posts || []).filter(p => p.category === 'discussion').length}
              </span>
            </button>

            {/* Technical & Equipment */}
            <button
              type="button"
              className={`corp-nav-btn ${activeTab === 'feed' && selectedCategory === 'technical' ? 'active' : ''}`}
              onClick={() => {
                onTabChange('feed')
                if (onSelectCategory) onSelectCategory('technical')
              }}
            >
              <div className="corp-nav-btn-content">
                <Wrench size={17} />
                <span>Техніка & Обладнання</span>
              </div>
              <span className="corp-nav-badge">
                {(posts || []).filter(p => p.category === 'technical').length}
              </span>
            </button>

            {/* Suggestions & Ideas */}
            <button
              type="button"
              className={`corp-nav-btn ${activeTab === 'feed' && selectedCategory === 'suggestion' ? 'active' : ''}`}
              onClick={() => {
                onTabChange('feed')
                if (onSelectCategory) onSelectCategory('suggestion')
              }}
            >
              <div className="corp-nav-btn-content">
                <Lightbulb size={17} />
                <span>Пропозиції та ідеї</span>
              </div>
              <span className="corp-nav-badge">
                {(posts || []).filter(p => p.category === 'suggestion').length}
              </span>
            </button>

            {/* Pinned Posts */}
            <button
              type="button"
              className={`corp-nav-btn ${activeTab === 'feed' && selectedCategory === 'pinned' ? 'active' : ''}`}
              onClick={() => {
                onTabChange('feed')
                if (onSelectCategory) onSelectCategory('pinned')
              }}
            >
              <div className="corp-nav-btn-content">
                <Pin size={17} color="#f59e0b" />
                <span>Закріплені дописи</span>
              </div>
              <span className="corp-nav-badge">
                {(posts || []).filter(p => p.is_pinned).length}
              </span>
            </button>

            <div style={{ height: '1px', background: 'var(--ch-border)', margin: '8px 4px' }} />

            <p className="corp-nav-title">Координація дій</p>

            {/* Task Manager */}
            <button
              type="button"
              className={`corp-nav-btn ${activeTab === 'tasks' ? 'active' : ''}`}
              onClick={() => onTabChange('tasks')}
            >
              <div className="corp-nav-btn-content">
                <CheckSquare size={17} />
                <span>Задачник (Канбан)</span>
              </div>
              <span className="corp-nav-badge">{tasksCount}</span>
            </button>
          </div>

          {/* Quick Metrics Widget */}
          <div className="corp-card" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--ch-text-dim)', letterSpacing: '0.04em', marginBottom: '12px' }}>
              Пульс корпоративного порталу
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ background: 'var(--ch-surface-inset)', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--ch-border)' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--ch-accent)' }}>
                  {tasksCount}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--ch-text-muted)', fontWeight: 600 }}>
                  Завдань у роботі
                </div>
              </div>

              <div style={{ background: 'var(--ch-surface-inset)', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--ch-border)' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: unreadAcksCount > 0 ? '#ef4444' : '#10b981' }}>
                  {unreadAcksCount}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--ch-text-muted)', fontWeight: 600 }}>
                  Очікують підпису
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ── CENTER: FEED OR TASKS MAIN VIEW ────────────────────────── */}
        <main className="corp-feed-col">
          {/* Top Header Bar */}
          <div className="corp-card corp-header-bar">
            <div className="corp-header-title-wrap">
              <div className="corp-header-icon-box">
                {activeTab === 'feed' ? <Building2 size={22} /> : <CheckSquare size={22} />}
              </div>
              <div>
                <h1 className="corp-header-title">
                  {activeTab === 'feed'
                    ? (selectedCategory === 'announcement'
                        ? 'Офіційні накази та розпорядження'
                        : selectedCategory === 'pinned'
                        ? 'Закріплені публікації'
                        : 'Корпоративна стрічка')
                    : 'Командний задачник'}
                </h1>
                <p className="corp-header-subtitle">
                  {activeTab === 'feed'
                    ? 'Комунікація підприємства, накази керівництва та координація змін'
                    : 'Оперативні доручення, чек-листи та контроль виконання'}
                </p>
              </div>
            </div>

            {/* Actions: Tab toggles & Refresh */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="corp-tabs-group">
                <button
                  type="button"
                  className={`corp-tab-btn ${activeTab === 'feed' ? 'active' : ''}`}
                  onClick={() => onTabChange('feed')}
                >
                  <MessageSquare size={15} />
                  <span>Стрічка</span>
                  {unreadAcksCount > 0 && (
                    <span style={{ fontSize: '0.65rem', background: '#ef4444', color: '#fff', padding: '1px 6px', borderRadius: '10px', fontWeight: 900 }}>
                      {unreadAcksCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  className={`corp-tab-btn ${activeTab === 'tasks' ? 'active' : ''}`}
                  onClick={() => onTabChange('tasks')}
                >
                  <CheckSquare size={15} />
                  <span>Завдання ({tasksCount})</span>
                </button>
              </div>

              {/* Push Broadcast Button */}
              <button
                type="button"
                onClick={() => setIsPushBroadcastOpen(true)}
                className="corp-btn-primary"
                title="Масова розсилка Push-сповіщень на всі пристрої"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
                  padding: '7px 14px',
                  fontSize: '0.78rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Radio size={14} />
                <span>Надіслати PUSH</span>
              </button>

              <button
                type="button"
                onClick={onRefresh}
                disabled={loading}
                className="corp-btn-subtle"
                title="Оновити дані"
                style={{ padding: '8px 10px' }}
              >
                <RefreshCw size={15} className={loading ? 'spin' : ''} />
              </button>
            </div>
          </div>

          {/* Children: CorporateFeed or CorporateTasksView */}
          {children}
        </main>

        {/* ── RIGHT ASIDE: PRODUCTIVITY & HOT TASKS ──────────────────── */}
        {activeTab !== 'tasks' && (
          <aside className="corp-hub-aside-right">
            {/* Urgent Announcements requiring Ack */}
          {unreadAnnouncements.length > 0 && (
            <div className="corp-card corp-aside-widget" style={{ borderColor: 'rgba(239, 68, 68, 0.35)' }}>
              <div className="corp-aside-widget-header">
                <h4 className="corp-aside-widget-title" style={{ color: '#ef4444' }}>
                  <Bell size={16} />
                  <span>Очікують підпису ({unreadAnnouncements.length})</span>
                </h4>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {unreadAnnouncements.map(post => (
                  <div
                    key={post.id}
                    style={{
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      borderRadius: '12px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--ch-text-primary)', lineHeight: 1.35 }}>
                      {post.title || (post.content ? post.content.slice(0, 60) + '...' : 'Офіційний наказ')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--ch-text-muted)' }}>
                        від {post.author?.first_name || 'Керівництва'}
                      </span>
                      {onToggleAck && (
                        <button
                          type="button"
                          onClick={() => onToggleAck(post.id)}
                          style={{
                            background: '#ef4444',
                            border: 'none',
                            color: '#fff',
                            borderRadius: '8px',
                            padding: '4px 10px',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <CheckCircle2 size={12} />
                          <span>Підтвердити</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hot My Tasks Widget */}
          <div className="corp-card corp-aside-widget">
            <div className="corp-aside-widget-header">
              <h4 className="corp-aside-widget-title">
                <CheckSquare size={16} color="var(--ch-accent)" />
                <span>Мої активні завдання</span>
              </h4>
              {onOpenNewTaskModal && (
                <button
                  type="button"
                  onClick={onOpenNewTaskModal}
                  className="corp-btn-subtle"
                  style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                  title="Створити нове завдання"
                >
                  <PlusCircle size={13} />
                  <span>Додати</span>
                </button>
              )}
            </div>

            {myPendingTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 10px', color: 'var(--ch-text-dim)', fontSize: '0.8rem' }}>
                <CheckCircle2 size={24} color="#10b981" style={{ margin: '0 auto 8px', display: 'block' }} />
                Чудова робота! Всі призначені вам завдання виконані.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {myPendingTasks.map(t => {
                  const isOverdue = t.deadline && new Date(t.deadline) < new Date()
                  const checklist = Array.isArray(t.checklist) ? t.checklist : []
                  const doneCount = checklist.filter(c => c.done || c.completed).length

                  return (
                    <div
                      key={t.id}
                      className="corp-mini-task"
                      onClick={() => onTabChange('tasks')}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="corp-mini-task-title">{t.title}</div>
                      <div className="corp-mini-task-meta">
                        {t.deadline ? (
                          <span style={{ color: isOverdue ? '#ef4444' : undefined, fontWeight: isOverdue ? 800 : 600 }}>
                            {isOverdue ? 'Протерміновано' : new Date(t.deadline).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })}
                          </span>
                        ) : (
                          <span>Без терміну</span>
                        )}

                        {checklist.length > 0 && (
                          <span>{doneCount}/{checklist.length} чек-лист</span>
                        )}
                      </div>
                    </div>
                  )
                })}

                <button
                  type="button"
                  onClick={() => onTabChange('tasks')}
                  className="corp-btn-subtle"
                  style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}
                >
                  <span>Відкрити весь задачник</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            )}
          </div>

          {/* Company Members / Shift Contacts */}
          <div className="corp-card corp-aside-widget">
            <div className="corp-aside-widget-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <h4 className="corp-aside-widget-title" style={{ margin: 0 }}>
                <Users size={16} />
                <span>Команда</span>
              </h4>
              <span style={{ fontSize: '0.72rem', color: 'var(--ch-text-dim)', whiteSpace: 'nowrap' }}>
                {users.length} співробітників
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
              {(users || []).slice(0, 10).map(u => {
                const uName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.login
                return (
                  <div
                    key={u.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '7px 10px',
                      borderRadius: '10px',
                      background: 'var(--ch-surface-inset)'
                    }}
                  >
                    <CorporateAvatar
                      user={u}
                      size={32}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--ch-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {uName}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--ch-text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {u.position || u.department || 'Працівник'}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </aside>
      )}

      {/* Broadcast Push Notification Modal */}
      <BroadcastPushModal
        isOpen={isPushBroadcastOpen}
        onClose={() => setIsPushBroadcastOpen(false)}
      />
    </div>
    </div>
  )
}
