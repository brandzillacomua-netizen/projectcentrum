import React from 'react'
import { Check, Image as ImageIcon, Loader2, Plus, Search, Settings as SettingsIcon, X } from 'lucide-react'
import ChatAvatar from '../ChatAvatar.jsx'
import { formatUserName, bytesToLabel } from '../../hooks/useChatData.js'

export const ChatThreadSettingsModal = ({
  showThreadSettings,
  activeThread,
  setShowThreadSettings,
  setSettingsAvatar,
  settingsAvatar,
  getThreadDisplayTitle,
  avatarInputRef,
  settingsSaving,
  handleAvatarFile,
  settingsTitle,
  setSettingsTitle,
  settingsUserSearch,
  setSettingsUserSearch,
  settingsUserIds,
  settingsFilteredUsers,
  toggleSettingsUser,
  saveThreadSettings
}) => {
  if (!showThreadSettings || !activeThread) return null

  return (
    <div className="modal-backdrop">
      <div className="new-chat-modal settings-modal">
        <div className="modal-head">
          <div>
            <div className="eyebrow"><SettingsIcon size={14} /> Налаштування</div>
            <h3>Група</h3>
          </div>
          <button
            className="icon-btn"
            onClick={() => {
              setShowThreadSettings(false)
              setSettingsAvatar(prev => {
                if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
                return null
              })
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="avatar-editor">
          <div className="group-avatar-preview">
            {settingsAvatar?.previewUrl ? (
              <img src={settingsAvatar.previewUrl} alt="Нова аватарка" />
            ) : activeThread.avatar_url ? (
              <ChatAvatar src={activeThread.avatar_url} label={getThreadDisplayTitle(activeThread)} size="xlarge" />
            ) : (
              <ChatAvatar src="" label={getThreadDisplayTitle(activeThread)} size="xlarge" />
            )}
          </div>
          <div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={e => handleAvatarFile(e.target.files?.[0])}
              style={{ display: 'none' }}
            />
            <button className="secondary-btn" onClick={() => avatarInputRef.current?.click()} disabled={settingsSaving}>
              <ImageIcon size={16} /> Змінити аватарку
            </button>
            <span className="avatar-hint">
              {settingsAvatar ? `Стиснуто до ${bytesToLabel(settingsAvatar.size)}` : 'Фото буде обрізане в квадрат і стиснуте'}
            </span>
          </div>
        </div>

        <input
          className="title-input"
          value={settingsTitle}
          onChange={e => setSettingsTitle(e.target.value)}
          placeholder="Назва групи..."
        />

        <div className="member-search">
          <Search size={16} />
          <input
            value={settingsUserSearch}
            onChange={e => setSettingsUserSearch(e.target.value)}
            placeholder="Додати або знайти учасника..."
          />
          {settingsUserSearch && (
            <button className="mini-clear" onClick={() => setSettingsUserSearch('')} title="Очистити пошук">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="member-count">
          Учасників: {settingsUserIds.length + 1}
        </div>

        <div className="users-picker settings-users">
          {settingsFilteredUsers.length === 0 ? (
            <div className="empty-state compact">Нікого не знайдено</div>
          ) : settingsFilteredUsers.map(user => {
            const selected = settingsUserIds.includes(user.id)
            return (
              <button
                key={user.id}
                className={`user-pick ${selected ? 'selected' : ''}`}
                onClick={() => toggleSettingsUser(user.id)}
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

        <button className="create-btn" onClick={saveThreadSettings} disabled={settingsSaving || !settingsTitle.trim()}>
          {settingsSaving ? <Loader2 className="spin" size={18} /> : <Check size={18} />} Зберегти налаштування
        </button>
      </div>
    </div>
  )
}

export default ChatThreadSettingsModal
