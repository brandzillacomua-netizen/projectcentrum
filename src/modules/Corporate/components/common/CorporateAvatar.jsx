import React, { useState } from 'react'

const GRADIENTS = [
  'linear-gradient(135deg, #6366f1, #4f46e5)',
  'linear-gradient(135deg, #3b82f6, #0284c7)',
  'linear-gradient(135deg, #10b981, #059669)',
  'linear-gradient(135deg, #f59e0b, #d97706)',
  'linear-gradient(135deg, #8b5cf6, #7c3aed)',
  'linear-gradient(135deg, #ec4899, #db2777)',
  'linear-gradient(135deg, #06b6d4, #0891b2)',
  'linear-gradient(135deg, #f43f5e, #e11d48)'
]

const getGradientForUser = (user, avatar) => {
  if (typeof avatar === 'string' && avatar.startsWith('#')) {
    return `linear-gradient(135deg, ${avatar}, #000000)`
  }
  const str = String(user?.id || user?.login || user?.first_name || 'u')
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const idx = Math.abs(hash) % GRADIENTS.length
  return GRADIENTS[idx]
}

const getInitials = (user, name) => {
  const first = user?.first_name || ''
  const last = user?.last_name || ''
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase()
  if (first) return first.slice(0, 2).toUpperCase()
  const fallback = name || user?.login || 'U'
  const parts = String(fallback).trim().split(/\s+/)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return String(fallback).slice(0, 2).toUpperCase()
}

export function CorporateAvatar({
  user,
  avatar,
  name,
  size = 36,
  borderRadius = '50%',
  className = '',
  style = {}
}) {
  const [imgError, setImgError] = useState(false)

  const rawAvatar = avatar || user?.avatar || user?.avatar_url
  const displayName = name || (user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.login : 'Користувач')
  const initials = getInitials(user, displayName)

  const isValidImageUrl = typeof rawAvatar === 'string' && !imgError && (
    rawAvatar.startsWith('http://') ||
    rawAvatar.startsWith('https://') ||
    rawAvatar.startsWith('data:image/') ||
    rawAvatar.startsWith('/')
  )

  if (isValidImageUrl) {
    return (
      <img
        src={rawAvatar}
        alt={displayName}
        onError={() => setImgError(true)}
        className={className}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius,
          objectFit: 'cover',
          flexShrink: 0,
          border: '1px solid var(--ch-border)',
          ...style
        }}
      />
    )
  }

  return (
    <div
      className={className}
      title={displayName}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius,
        background: getGradientForUser(user, rawAvatar),
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size > 40 ? '1rem' : (size > 28 ? '0.78rem' : '0.66rem'),
        fontWeight: 900,
        letterSpacing: '-0.02em',
        flexShrink: 0,
        userSelect: 'none',
        border: '1px solid var(--ch-border)',
        ...style
      }}
    >
      {initials}
    </div>
  )
}

