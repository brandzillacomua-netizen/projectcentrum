import React from 'react'
import { Check, Loader2, Plus, Search, Users, X } from 'lucide-react'
import { formatUserName } from '../../hooks/useChatData.js'

export const ChatNewThreadModal = ({
  showNewChat,
  setShowNewChat,
  isSuperAdmin,
  newChatType,
  setNewChatType,
  setSelectedUserIds,
  setNewTitle,
  newTitle,
  userSearch,
  setUserSearch,
  filteredUsers,
  selectedUserIds,
  toggleSelectedUser,
  createThread,
  sending,
  users
}) => {
  if (!showNewChat) return null

  return (
    <div className="modal-backdrop" onClick={() => setShowNewChat(false)}>
      <div className="new-chat-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <div>
            <div className="eyebrow"><Users size={14} /> Нова бесіда</div>
            <h3>Створити чат</h3>
          </div>
          <button
            className="icon-btn"
            onClick={() => {
              setShowNewChat(false)
              setUserSearch('')
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="new-chat-type-switcher" style={{ display: 'flex', gap: '8px', padding: '4px', marginTop: '10px', marginBottom: '8px' }}>
          <button
            className={`new-chat-type-btn ${newChatType === 'private' ? 'active' : ''}`}
            onClick={() => { setNewChatType('private'); setSelectedUserIds([]); setNewTitle(''); }}
          >Особистий</button>
          <button
            className={`new-chat-type-btn ${newChatType === 'group' ? 'active' : ''}`}
            onClick={() => { setNewChatType('group'); setSelectedUserIds([]); }}
          >Група</button>
          {isSuperAdmin && (
            <button
              className={`new-chat-type-btn ${newChatType === 'channel' ? 'active' : ''}`}
              onClick={() => { setNewChatType('channel'); setSelectedUserIds(users.map(user => user.id)); setNewTitle(''); }}
            >Канал</button>
          )}
        </div>

        {newChatType !== 'private' && (
          <input
            className="title-input"
            style={{ margin: '8px 0', width: '100%' }}
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder={newChatType === 'channel' ? 'Назва каналу...' : 'Введіть назву групи...'}
          />
        )}

        <div className="member-search" style={{ marginTop: newChatType !== 'private' ? 0 : '8px' }}>
          <Search size={16} />
          <input
            value={userSearch}
            onChange={e => setUserSearch(e.target.value)}
            placeholder={newChatType === 'private' ? "Пошук співрозмовника..." : "Пошук учасників..."}
            autoFocus
          />
          {userSearch && (
            <button className="mini-clear" onClick={() => setUserSearch('')} title="Очистити пошук">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="users-picker">
          {filteredUsers.length === 0 ? (
            <div className="empty-state compact">Нікого не знайдено</div>
          ) : filteredUsers.map(user => {
            const selected = selectedUserIds.includes(user.id)
            return (
              <button
                key={user.id}
                className={`user-pick ${selected ? 'selected' : ''}`}
                onClick={() => {
                  if (newChatType === 'private') {
                    setSelectedUserIds([user.id])
                  } else {
                    toggleSelectedUser(user.id)
                  }
                }}
              >
                <span className="user-pick-main">
                  <b>{formatUserName(user)}</b>
                  <small>{[user.position, user.department, user.login].filter(Boolean).join(' · ')}</small>
                </span>
                {selected ? <Check size={16} /> : <Plus size={15} />}
              </button>
            )
          })}
        </div>
        <button
          className="create-btn"
          onClick={createThread}
          disabled={sending || selectedUserIds.length === 0 || (newChatType === 'group' && selectedUserIds.length < 2) || (newChatType === 'channel' && !newTitle.trim())}
        >
          {sending ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}
          {newChatType === 'channel' ? `Створити канал (${selectedUserIds.length})` : (newChatType === 'group' ? `Створити групу (${selectedUserIds.length})` : 'Почати чат')}
        </button>
      </div>
    </div>
  )
}

export default ChatNewThreadModal
