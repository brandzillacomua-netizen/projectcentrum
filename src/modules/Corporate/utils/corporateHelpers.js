/**
 * CENTRUM MES — Corporate Hub Helpers
 * Parsing mentions, formatting byte sizes, date helpers, task statuses.
 */

export const bytesToLabel = (bytes) => {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

export const POST_CATEGORIES = {
  announcement: { id: 'announcement', label: 'Оголошення / Наказ', color: '#ef4444' },
  discussion: { id: 'discussion', label: 'Робоче питання', color: '#3b82f6' },
  technical: { id: 'technical', label: 'Техніка / Обладнання', color: '#f59e0b' },
  general: { id: 'general', label: 'Загальне', color: '#10b981' }
}

export const TASK_STATUSES = {
  pending: { id: 'pending', label: 'До виконання', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)' },
  in_progress: { id: 'in_progress', label: 'В роботі', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
  review: { id: 'review', label: 'На перевірці', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  done: { id: 'done', label: 'Виконано', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' }
}

export const TASK_PRIORITIES = {
  low: { id: 'low', label: 'Низький', color: '#64748b' },
  medium: { id: 'medium', label: 'Звичайний', color: '#3b82f6' },
  high: { id: 'high', label: 'Терміновий', color: '#ef4444' }
}

/**
 * Extracts mentioned user IDs from text (e.g. "@[Roman Shymanskyi](usr_123)")
 */
export const extractMentionedUserIds = (text = '') => {
  if (!text) return []
  const regex = /@\[([^\]]+)\]\(([^)]+)\)/g
  const ids = []
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match[2]) ids.push(match[2])
  }
  return Array.from(new Set(ids))
}

/**
 * Renders text containing @[Name](id) as styled mention tokens
 */
export const renderFormattedContent = (text = '', users = []) => {
  if (!text) return null
  const regex = /@\[([^\]]+)\]\(([^)]+)\)/g
  const parts = []
  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index))
    }
    const rawName = match[1]
    const userId = match[2]

    // Lookup user display name from users list if available
    const matchedUser = (users || []).find(u => String(u.id) === String(userId))
    const displayName = matchedUser
      ? `${matchedUser.first_name || ''} ${matchedUser.last_name || ''}`.trim() || matchedUser.login
      : rawName

    parts.push({
      isMention: true,
      userId,
      name: displayName
    })

    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }

  return parts
}
