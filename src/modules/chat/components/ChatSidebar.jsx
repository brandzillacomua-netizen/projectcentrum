import React from 'react'
import {
  Check,
  CheckCheck,
  Loader2,
  Menu,
  MessageCircle,
  Pin,
  Plus,
  Search,
  Users
} from 'lucide-react'
import ChatAvatar from './ChatAvatar.jsx'
import { ChannelBadge, isChannelThread } from '../ChatChannelModule.jsx'

export const ChatSidebar = ({
  isSuperAdmin,
  navigate,
  setShowNewChat,
  search,
  setSearch,
  loadingThreads,
  filteredThreads,
  participants,
  activeThreadId,
  setActiveThreadId,
  getThreadAvatar,
  getThreadDisplayTitle,
  formatThreadTime,
  me
}) => {
  return (
    <aside className="chat-sidebar">
      <div className="chat-sidebar-head">
        <div className="chat-title-row">
          {isSuperAdmin && (
            <button className="icon-btn system-menu" onClick={() => navigate('/')} title="До системи">
              <Menu size={18} />
            </button>
          )}
          <div>
            <div className="eyebrow"><MessageCircle size={14} /> Внутрішній чат</div>
            <h1>Чат</h1>
          </div>
        </div>
        <button className="icon-btn accent" onClick={() => setShowNewChat(true)} title="Новий чат">
          <Plus size={18} />
        </button>
      </div>

      <div className="search-box">
        <Search size={16} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Пошук чату..." />
      </div>

      <div className="thread-list">
        {loadingThreads ? (
          <div className="empty-state"><Loader2 className="spin" size={20} /> Завантаження...</div>
        ) : filteredThreads.length === 0 ? (
          <div className="empty-state">Немає чатів</div>
        ) : filteredThreads.map(thread => {
          const rows = participants.filter(p => p.thread_id === thread.id)
          const threadAvatar = getThreadAvatar(thread)
          const displayTitle = getThreadDisplayTitle(thread)
          const isUnread = thread.unreadCount > 0
          const isPinned = thread.is_pinned || isChannelThread(thread)

          return (
            <button
              key={thread.id}
              className={`thread-card ${thread.id === activeThreadId ? 'active' : ''} ${isUnread ? 'unread' : ''} ${isPinned ? 'pinned' : ''}`}
              onClick={() => setActiveThreadId(thread.id)}
            >
              <div className="thread-icon">
                <ChatAvatar src={threadAvatar} label={displayTitle} />
              </div>
              <div className="thread-main">
                <div className="thread-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {rows.length > 2 && <Users size={12} style={{ opacity: 0.6 }} title="Груповий чат" />}
                  {displayTitle}
                  <ChannelBadge thread={thread} />
                </div>

                <div className="thread-last">
                  {thread.lastMessageSenderId === me.id && (
                    <span style={{ marginRight: 4, color: (rows.find(p => p.user_id !== me.id)?.last_read_at && new Date(rows.find(p => p.user_id !== me.id).last_read_at).getTime() >= new Date(thread.last_message_at || thread.updated_at).getTime()) ? '#3b82f6' : '#888' }}>
                      {(rows.find(p => p.user_id !== me.id)?.last_read_at && new Date(rows.find(p => p.user_id !== me.id).last_read_at).getTime() >= new Date(thread.last_message_at || thread.updated_at).getTime()) ? <CheckCheck size={14} /> : <Check size={14} />}
                    </span>
                  )}
                  {thread.lastMessagePreview || thread.last_message || `${rows.length} учасн.`}
                </div>
              </div>
              <div className="thread-time-col">
                <div className="thread-time">{formatThreadTime(thread.last_message_at || thread.updated_at)}</div>
                {isPinned && <Pin className="thread-pin" size={14} />}
                {thread.unreadCount > 0 && (
                  <span className="unread-badge" title={`${thread.unreadCount} нових повідомлень`}>
                    {thread.unreadCount}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </aside>
  )
}

export default ChatSidebar
