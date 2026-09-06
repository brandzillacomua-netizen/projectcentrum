import React, { useState, useEffect } from 'react'

const getInitials = (nameOrUser) => {
  const formatUserName = (user) => {
    if (!user) return 'Користувач'
    const fullName = [user.last_name, user.first_name].filter(Boolean).join(' ').trim()
    return fullName || user.login || 'Користувач'
  }
  const name = typeof nameOrUser === 'string' ? nameOrUser : formatUserName(nameOrUser)
  const parts = name.split(/\s+/).filter(Boolean)
  return (parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2)).toUpperCase()
}

const getAvatarGradient = (value = '') => {
  switch (value) {
    case 'purple': return 'linear-gradient(135deg, #a855f7, #6366f1)'
    case 'blue': return 'linear-gradient(135deg, #3b82f6, #06b6d4)'
    case 'emerald': return 'linear-gradient(135deg, #10b981, #059669)'
    case 'ruby': return 'linear-gradient(135deg, #f43f5e, #be123c)'
    case 'orange': return 'linear-gradient(135deg, #ff9000, #ff5500)'
    default: return 'linear-gradient(135deg, #1f2937, #111827)'
  }
}

export const ChatAvatar = ({ src, label, size = 'small' }) => {
  const [failed, setFailed] = useState(false)
  const canUseImage = src && !failed && (src.startsWith('data:image/') || src.startsWith('http') || src.startsWith('/'))

  useEffect(() => {
    setFailed(false)
  }, [src])

  if (canUseImage) {
    return <img src={src} alt={label} onError={() => setFailed(true)} />
  }

  const getLabelGradient = (name = '') => {
    const str = String(name || 'User')
    let hash = 0
    for (let i = 0; i < str.length; i += 1) {
      hash = (hash << 5) - hash + str.charCodeAt(i)
      hash |= 0
    }
    const gradients = [
      'linear-gradient(135deg, #6366f1, #4f46e5)',
      'linear-gradient(135deg, #3b82f6, #1d4ed8)',
      'linear-gradient(135deg, #10b981, #047857)',
      'linear-gradient(135deg, #f59e0b, #d97706)',
      'linear-gradient(135deg, #8b5cf6, #6d28d9)',
      'linear-gradient(135deg, #ec4899, #be185d)',
      'linear-gradient(135deg, #06b6d4, #0e7490)'
    ]
    const index = Math.abs(hash) % gradients.length
    return gradients[index]
  }

  const bgStyle = (src && getAvatarGradient(src) !== getAvatarGradient(''))
    ? getAvatarGradient(src)
    : getLabelGradient(label)

  return (
    <span className={`chat-initials-avatar ${size}`} style={{ background: bgStyle, color: '#ffffff' }}>
      {getInitials(label)}
    </span>
  )
}

export default ChatAvatar
