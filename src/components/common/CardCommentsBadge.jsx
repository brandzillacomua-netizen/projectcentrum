import React from 'react'
import { MessageSquare, Camera } from 'lucide-react'
import { parseCardComments } from '../../services/cardCommentsService.js'
import { Shop1CardCommentsModal } from '../../modules/Shop1/components/modals/Shop1CardCommentsModal.jsx'
import { useStore } from '../../store/index.js'

/**
 * Universal badge component to display work card comment indicators.
 * Clicking opens comment reader/modal.
 */
export function CardCommentsBadge({
  card,
  cardInfo,
  onClick,
  showEmpty = false,
  compact = false,
  size = 'md',
  style = {}
}) {
  const rawInfo = cardInfo !== undefined ? cardInfo : card?.card_info
  const comments = parseCardComments(rawInfo)
  const count = comments.length

  if (count === 0) {
    if (!showEmpty) return null
    return (
      <span
        style={{
          color: 'var(--text-dim, #555)',
          fontSize: compact ? '0.65rem' : '0.75rem',
          padding: '0 4px',
          ...style
        }}
      >
        —
      </span>
    )
  }

  const hasPhotos = comments.some(c => Array.isArray(c.photos) && c.photos.length > 0)
  const latest = comments[count - 1]
  const dateStr = latest?.created_at ? new Date(latest.created_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) : ''
  const tooltip = `Коментарів: ${count}\nОстанній [${latest?.author_name || 'Працівник'}${dateStr ? ` • ${dateStr}` : ''}]: ${latest?.text || ''}${latest?.stage ? ` (${latest.stage})` : ''}${hasPhotos ? ' 📷 (є фото)' : ''}\nНатисніть для перегляду`

  const fontSize = compact ? '0.65rem' : (size === 'sm' ? '0.68rem' : '0.72rem')
  const iconSize = compact ? 11 : (size === 'sm' ? 12 : 13)
  const cameraSize = compact ? 10 : (size === 'sm' ? 11 : 12)

  return (
    <button
      type="button"
      onClick={(e) => {
        if (typeof onClick === 'function') {
          e.stopPropagation()
          onClick(card, comments)
        }
      }}
      title={tooltip}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: compact ? '2px 6px' : '3px 8px',
        borderRadius: '7px',
        background: 'rgba(59, 130, 246, 0.15)',
        border: '1px solid rgba(59, 130, 246, 0.35)',
        color: '#3b82f6',
        fontWeight: 900,
        fontSize,
        cursor: typeof onClick === 'function' ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
        transition: 'all 0.15s ease-in-out',
        ...style
      }}
    >
      <MessageSquare size={iconSize} />
      <span>{count}</span>
      {hasPhotos && <Camera size={cameraSize} style={{ opacity: 0.85 }} />}
    </button>
  )
}

/**
 * Universal Wrapper of Card Comments Modal.
 * Accepts either `card` or `currentCard`, handles fallbacks,
 * auto-detects Shop 1 vs Shop 2, and forwards all callbacks.
 */
export function CardCommentsModal({
  isOpen,
  onClose,
  card,
  currentCard,
  nom,
  orderNum,
  currentUser,
  systemUsers,
  selectedOperator,
  defaultRole,
  onCommentSaved,
  setWorkCards,
  ...rest
}) {
  const storeUser = useStore(state => state.currentUser)
  const storeUsers = useStore(state => state.systemUsers)
  const activeUser = currentUser || storeUser || null
  const activeUsers = (systemUsers && systemUsers.length > 0) ? systemUsers : (storeUsers || [])

  const activeCard = card || currentCard || null
  if (!isOpen || !activeCard) return null

  const resolvedNom = nom || {
    name: activeCard.nomenclature_name || activeCard.name || (activeCard.card_info?.split('] ').pop()) || 'Деталь'
  }

  const isShop2Card = Boolean(
    activeCard.operation?.toLowerCase().includes('прес') ||
    activeCard.operation?.toLowerCase().includes('порізка') ||
    activeCard.operation?.toLowerCase().includes('фрезер') ||
    activeCard.operation?.toLowerCase().includes('шліф') ||
    String(activeCard.card_info || '').includes('[ЦЕХ №2]') ||
    String(activeCard.card_info || '').includes('[ЦЕХ 2]')
  )
  const resolvedRole = defaultRole || (isShop2Card ? 'Цех №2' : 'Цех №1')

  return (
    <Shop1CardCommentsModal
      isOpen={isOpen}
      onClose={onClose}
      currentCard={activeCard}
      nom={resolvedNom}
      orderNum={orderNum || activeCard.order_num || ''}
      currentUser={activeUser}
      systemUsers={activeUsers}
      selectedOperator={selectedOperator || activeCard.operator_name || ''}
      defaultRole={resolvedRole}
      onCommentSaved={(updatedCard, newComment) => {
        if (activeCard && updatedCard?.card_info) {
          activeCard.card_info = updatedCard.card_info
        }
        if (typeof onCommentSaved === 'function') {
          onCommentSaved(updatedCard, newComment)
        }
      }}
      setWorkCards={setWorkCards}
      {...rest}
    />
  )
}

