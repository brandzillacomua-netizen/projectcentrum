import React from 'react'
import { getLastName, getInitials } from '../utils/kanbanHelpers'

export const UserAvatar = ({ user, size = 28, showName = false }) => {
  const initials = getInitials(user)
  const lastName = getLastName(user)

  const getGradient = (name) => {
    switch (name) {
      case 'purple': return 'linear-gradient(135deg, #a855f7, #6366f1)';
      case 'blue': return 'linear-gradient(135deg, #3b82f6, #06b6d4)';
      case 'emerald': return 'linear-gradient(135deg, #10b981, #059669)';
      case 'ruby': return 'linear-gradient(135deg, #f43f5e, #be123c)';
      case 'orange': return 'linear-gradient(135deg, #ff9000, #ff5500)';
      default: return 'linear-gradient(135deg, #333, #111)';
    }
  }

  const isImg = user?.avatar && user.avatar.startsWith('data:image/')
  const bgStyle = isImg ? {} : { background: getGradient(user?.avatar) }

  return (
    <div className="user-avatar-wrap" title={lastName}>
      <div className="user-avatar" style={{ width: size, height: size, fontSize: size * 0.35, ...bgStyle }}>
        {isImg
          ? <img src={user.avatar} alt={initials} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          : initials}
      </div>
      {showName && <span className="avatar-name">{lastName}</span>}
    </div>
  )
}
