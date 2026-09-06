import React from 'react'
import {
  ArrowLeft,
  MoreVertical,
  Settings as SettingsIcon
} from 'lucide-react'
import ChatAvatar from './ChatAvatar.jsx'
import { ChannelBadge } from '../ChatChannelModule.jsx'

export const ChatHeader = ({
  activeThread,
  activeParticipants,
  handleMobileBack,
  getThreadAvatar,
  getThreadDisplayTitle,
  isSuperAdmin,
  me,
  openThreadSettings,
  sending,
  showChatMenu,
  setShowChatMenu,
  clearChatHistory,
  archiveThread,
  users,
  systemUsers
}) => {
  const activeAvatar = getThreadAvatar(activeThread)
  const activeTitle = getThreadDisplayTitle(activeThread)

  return (
    <header className="chat-header">
      <button className="icon-btn mobile-back" onClick={handleMobileBack} title="До списку чатів">
        <ArrowLeft size={18} />
      </button>
      <div className="active-chat-title">
        <div className="active-chat-avatar">
          <ChatAvatar src={activeAvatar} label={activeTitle} size="large" />
        </div>
        <div>
          <h2>{activeTitle} <ChannelBadge thread={activeThread} /></h2>
          <div className="participants-line">
            {activeParticipants.length === 2 ? (
              (() => {
                const otherId = activeParticipants.find(p => p.user_id !== me.id)?.user_id
                const otherUser = users.find(u => u.id === otherId) || (systemUsers || []).find(u => u.id === otherId)
                if (!otherUser) return 'Особистий чат'

                const lastSeenISO = otherUser.last_seen
                if (!lastSeenISO) return 'Був(ла) нещодавно'

                const lastSeen = new Date(lastSeenISO)
                const now = new Date()
                const diffMinutes = (now - lastSeen) / 1000 / 60

                if (diffMinutes < 3) return <span style={{ color: '#86efac' }}>В мережі</span>

                const isToday = lastSeen.getDate() === now.getDate() && lastSeen.getMonth() === now.getMonth() && lastSeen.getFullYear() === now.getFullYear()
                const timeString = new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' }).format(lastSeen)

                if (isToday) return `Сьогодні о ${timeString}`

                const yesterday = new Date(now)
                yesterday.setDate(now.getDate() - 1)
                const isYesterday = lastSeen.getDate() === yesterday.getDate() && lastSeen.getMonth() === yesterday.getMonth() && lastSeen.getFullYear() === yesterday.getFullYear()

                if (isYesterday) return `Вчора о ${timeString}`

                const dateString = new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(lastSeen)
                return `Був(ла) ${dateString} о ${timeString}`
              })()
            ) : (
              activeParticipants.map(p => p.user_name).join(', ') || 'Без обмеження учасників'
            )}
          </div>
        </div>
      </div>
      <div className="chat-header-actions">
        {activeParticipants.length > 2 && (isSuperAdmin || activeThread?.created_by === me?.id) && (
          <button className="icon-btn" onClick={openThreadSettings} title="Налаштування групи" disabled={sending}>
            <SettingsIcon size={17} />
          </button>
        )}
        {(activeParticipants.length <= 2 || isSuperAdmin || activeThread?.created_by === me?.id) && (
          <>
            <button className="icon-btn" onClick={() => setShowChatMenu(!showChatMenu)} title="Опції" disabled={sending}>
              <MoreVertical size={17} />
            </button>
            {showChatMenu && (
              <>
                <div className="chat-menu-backdrop" onClick={() => setShowChatMenu(false)} />
                <div className="chat-options-menu">
                  <button onClick={clearChatHistory} disabled={sending}>
                    Очистити історію чату
                  </button>
                  <button onClick={archiveThread} className="danger" disabled={sending}>
                    Видалити чат
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </header>
  )
}

export default ChatHeader
