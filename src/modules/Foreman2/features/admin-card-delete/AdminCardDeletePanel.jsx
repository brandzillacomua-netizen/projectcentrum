import React, { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Loader2,
  ShieldAlert,
  Square,
  Trash2,
  X
} from 'lucide-react'
import { isForeman2CardDeleteAdmin, isSafeCardToDelete } from './useAdminCardDelete.js'

const cardStatusLabel = (status) => {
  if (status === 'new') return 'нова'
  if (status === 'waiting-materials') return 'очікує склад'
  if (status === 'waiting-machines') return 'очікує верстат'
  if (status === 'in-progress') return 'в роботі'
  if (status === 'completed') return 'завершена'
  if (status === 'paused') return 'пауза'
  return status || 'без статусу'
}

const formatQty = (value) => Number(value || 0).toLocaleString('uk-UA')

const getPartCards = (part) => {
  return Array.from(new Map((part?.cards || []).filter(card => card?.id).map(card => [String(card.id), card])).values())
    .sort((a, b) => {
      const aTime = new Date(a.created_at || 0).getTime()
      const bTime = new Date(b.created_at || 0).getTime()
      return bTime - aTime
    })
}

function SystemDialog({ dialog, isBusy, onClose, onConfirm }) {
  if (!dialog) return null

  const isConfirm = dialog.type === 'confirm-delete'
  const isSuccess = dialog.type === 'success'
  const isError = dialog.type === 'error'
  const accent = isSuccess ? '#10b981' : '#ef4444'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40000,
        background: 'rgba(0,0,0,.72)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '18px'
      }}
      onClick={isBusy ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          width: 'min(520px, 100%)',
          background: '#111',
          border: `1px solid ${accent}55`,
          borderRadius: '14px',
          boxShadow: '0 24px 80px rgba(0,0,0,.55)',
          overflow: 'hidden'
        }}
        onClick={event => event.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '18px 20px', borderBottom: '1px solid #222' }}>
          <div style={{ width: 36, height: 36, borderRadius: '10px', background: `${accent}18`, border: `1px solid ${accent}55`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isSuccess ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#fff', fontWeight: 950, fontSize: '.95rem', letterSpacing: '.02em' }}>{dialog.title}</div>
            <div style={{ color: '#666', fontWeight: 800, fontSize: '.72rem', marginTop: '3px', textTransform: 'uppercase' }}>Системне повідомлення</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            style={{
              width: 34,
              height: 34,
              borderRadius: '9px',
              border: '1px solid #2a2a2a',
              background: '#171717',
              color: isBusy ? '#444' : '#aaa',
              cursor: isBusy ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={17} />
          </button>
        </div>

        <div style={{ padding: '18px 20px 6px', color: '#cbd5e1', fontSize: '.86rem', lineHeight: 1.55, fontWeight: 750 }}>
          {dialog.message}
          {isConfirm && (
            <div style={{ marginTop: '12px', color: '#ef4444', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', borderRadius: '9px', padding: '10px 12px', fontSize: '.78rem', fontWeight: 900 }}>
              Видаляємо тільки помилково згенеровані картки, які ще не стартували. Дія прибере прив'язані заявки й історію цих карток.
            </div>
          )}
        </div>

        <div style={{ padding: '16px 20px 20px', display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
          {isConfirm && (
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              style={{
                background: '#171717',
                border: '1px solid #333',
                color: isBusy ? '#444' : '#aaa',
                borderRadius: '9px',
                padding: '10px 14px',
                fontWeight: 900,
                cursor: isBusy ? 'not-allowed' : 'pointer'
              }}
            >
              Скасувати
            </button>
          )}
          <button
            type="button"
            onClick={isConfirm ? onConfirm : onClose}
            disabled={isBusy}
            style={{
              background: isError ? '#ef4444' : accent,
              border: 'none',
              color: '#fff',
              borderRadius: '9px',
              padding: '10px 15px',
              fontWeight: 950,
              cursor: isBusy ? 'not-allowed' : 'pointer',
              minWidth: isConfirm ? 150 : 90,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {isBusy && <Loader2 size={16} className="spin" />}
            {isConfirm ? 'Видалити картки' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminCardDeletePanel({
  model,
  currentUser,
  onDeleteCards,
  isDeleting = false,
  error,
  lastResult
}) {
  const [expandedNomId, setExpandedNomId] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [dialog, setDialog] = useState(null)

  const isAdmin = isForeman2CardDeleteAdmin(currentUser)

  const parts = useMemo(() => {
    return (model?.parts || [])
      .map(part => {
        const cards = getPartCards(part)
        const safeCards = cards.filter(isSafeCardToDelete)
        return { ...part, adminCards: cards, adminSafeCards: safeCards }
      })
      .filter(part => part.adminCards.length > 0)
  }, [model])

  const selectedCards = useMemo(() => {
    const map = new Map()
    parts.forEach(part => {
      part.adminCards.forEach(card => {
        if (selectedIds.has(String(card.id))) map.set(String(card.id), card)
      })
    })
    return [...map.values()]
  }, [parts, selectedIds])

  if (!isAdmin || !model) return null

  const toggleCard = (card) => {
    if (!isSafeCardToDelete(card) || isDeleting) return
    setSelectedIds(prev => {
      const next = new Set(prev)
      const key = String(card.id)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selectCards = (cards) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      cards.filter(isSafeCardToDelete).forEach(card => next.add(String(card.id)))
      return next
    })
  }

  const clearPartCards = (cards) => {
    const ids = new Set(cards.map(card => String(card.id)))
    setSelectedIds(prev => {
      const next = new Set(prev)
      ids.forEach(id => next.delete(id))
      return next
    })
  }

  const handleDelete = async () => {
    if (selectedCards.length === 0 || isDeleting) return
    setDialog({
      type: 'confirm-delete',
      title: 'Підтвердити видалення',
      message: `Видалити ${selectedCards.length} робочих карток з бази?`
    })
  }

  const confirmDelete = async () => {
    if (selectedCards.length === 0 || isDeleting) return
    try {
      const result = await onDeleteCards(selectedCards)
      setSelectedIds(new Set())
      setDialog({
        type: 'success',
        title: 'Картки видалено',
        message: `Видалено карток: ${result?.deletedCount || 0}. Дані оновлюються в системі.`
      })
    } catch (err) {
      setDialog({
        type: 'error',
        title: 'Не вдалося видалити картки',
        message: err?.message || 'Система не змогла виконати видалення. Перевір доступ і стан карток.'
      })
    }
  }

  return (
    <section
      style={{
        marginTop: '18px',
        background: '#101010',
        border: '1px solid rgba(239,68,68,.35)',
        borderRadius: '10px',
        overflow: 'hidden'
      }}
    >
      <SystemDialog
        dialog={dialog}
        isBusy={isDeleting}
        onClose={() => {
          if (!isDeleting) setDialog(null)
        }}
        onConfirm={confirmDelete}
      />

      <div style={{ padding: '14px 16px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <ShieldAlert size={18} color="#ef4444" />
        <div style={{ flex: 1, minWidth: '220px' }}>
          <div style={{ color: '#ef4444', fontWeight: 950, letterSpacing: '.5px', textTransform: 'uppercase', fontSize: '.78rem' }}>
            Адмін-видалення робочих карток
          </div>
          <div style={{ color: '#666', fontWeight: 800, fontSize: '.72rem', marginTop: '3px' }}>
            Доступні тільки картки без фактичного проходження етапів: нові, очікують склад або верстат.
          </div>
        </div>
        <button
          type="button"
          onClick={() => selectCards(parts.flatMap(part => part.adminSafeCards))}
          disabled={isDeleting}
          style={{
            background: 'rgba(59,130,246,.12)',
            border: '1px solid rgba(59,130,246,.35)',
            color: '#3b82f6',
            borderRadius: '8px',
            padding: '8px 11px',
            fontWeight: 900,
            fontSize: '.72rem',
            cursor: isDeleting ? 'not-allowed' : 'pointer'
          }}
        >
          вибрати всі безпечні
        </button>
        <button
          type="button"
          onClick={() => setSelectedIds(new Set())}
          disabled={isDeleting || selectedIds.size === 0}
          style={{
            background: '#151515',
            border: '1px solid #333',
            color: selectedIds.size === 0 ? '#444' : '#aaa',
            borderRadius: '8px',
            padding: '8px 11px',
            fontWeight: 900,
            fontSize: '.72rem',
            cursor: isDeleting || selectedIds.size === 0 ? 'not-allowed' : 'pointer'
          }}
        >
          очистити вибір
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting || selectedCards.length === 0}
          style={{
            background: selectedCards.length === 0 ? '#222' : '#ef4444',
            border: 'none',
            color: selectedCards.length === 0 ? '#555' : '#fff',
            borderRadius: '8px',
            padding: '9px 13px',
            fontWeight: 950,
            fontSize: '.74rem',
            cursor: isDeleting || selectedCards.length === 0 ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px'
          }}
        >
          {isDeleting ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />}
          видалити ({selectedCards.length})
        </button>
      </div>

      {error && (
        <div style={{ margin: '12px 16px 0', color: '#ef4444', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', borderRadius: '8px', padding: '10px 12px', fontSize: '.76rem', fontWeight: 850 }}>
          <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          {error}
        </div>
      )}
      {lastResult?.deletedCount > 0 && !error && (
        <div style={{ margin: '12px 16px 0', color: '#10b981', background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.22)', borderRadius: '8px', padding: '10px 12px', fontSize: '.76rem', fontWeight: 850 }}>
          Видалено карток: {lastResult.deletedCount}
        </div>
      )}

      <div style={{ padding: '12px 16px 16px', display: 'grid', gap: '8px' }}>
        {parts.length === 0 && (
          <div style={{ color: '#555', fontWeight: 850, fontSize: '.78rem', padding: '10px' }}>
            У цьому наряді поки немає робочих карток.
          </div>
        )}
        {parts.map(part => {
          const isExpanded = expandedNomId === String(part.nomId)
          const safeCount = part.adminSafeCards.length
          const selectedInPart = part.adminCards.filter(card => selectedIds.has(String(card.id))).length
          return (
            <div key={part.nomId} style={{ border: '1px solid #222', borderRadius: '8px', background: '#0b0b0b', overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setExpandedNomId(isExpanded ? null : String(part.nomId))}
                style={{
                  width: '100%',
                  border: 'none',
                  background: 'transparent',
                  color: '#fff',
                  padding: '11px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  textAlign: 'left'
                }}
              >
                {isExpanded ? <ChevronDown size={15} color="#777" /> : <ChevronRight size={15} color="#777" />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 950, fontSize: '.86rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{part.name}</div>
                  <div style={{ color: '#555', fontSize: '.68rem', fontWeight: 850, marginTop: '2px' }}>
                    карток: {part.adminCards.length} | можна видалити: {safeCount} | вибрано: {selectedInPart}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    selectCards(part.adminSafeCards)
                  }}
                  disabled={isDeleting || safeCount === 0}
                  style={{
                    background: 'rgba(59,130,246,.1)',
                    border: '1px solid rgba(59,130,246,.3)',
                    color: safeCount === 0 ? '#444' : '#3b82f6',
                    borderRadius: '7px',
                    padding: '6px 9px',
                    fontWeight: 900,
                    fontSize: '.68rem',
                    cursor: isDeleting || safeCount === 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  вибрати
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    clearPartCards(part.adminCards)
                  }}
                  disabled={isDeleting || selectedInPart === 0}
                  style={{
                    background: '#141414',
                    border: '1px solid #2a2a2a',
                    color: selectedInPart === 0 ? '#444' : '#aaa',
                    borderRadius: '7px',
                    padding: '6px 9px',
                    fontWeight: 900,
                    fontSize: '.68rem',
                    cursor: isDeleting || selectedInPart === 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  скинути
                </button>
              </button>

              {isExpanded && (
                <div style={{ borderTop: '1px solid #1b1b1b', padding: '10px 12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '8px' }}>
                  {part.adminCards.map(card => {
                    const safe = isSafeCardToDelete(card)
                    const selected = selectedIds.has(String(card.id))
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => toggleCard(card)}
                        disabled={!safe || isDeleting}
                        title={!safe ? 'Ця картка вже стартувала або завершена, з інтерфейсу не видаляємо.' : 'Вибрати картку для видалення'}
                        style={{
                          background: selected ? 'rgba(239,68,68,.14)' : '#080808',
                          border: selected ? '1px solid rgba(239,68,68,.55)' : '1px solid #222',
                          color: safe ? '#fff' : '#555',
                          borderRadius: '8px',
                          padding: '10px',
                          cursor: !safe || isDeleting ? 'not-allowed' : 'pointer',
                          textAlign: 'left',
                          opacity: safe ? 1 : .55,
                          display: 'grid',
                          gap: '6px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {selected ? <CheckSquare size={16} color="#ef4444" /> : <Square size={16} color={safe ? '#777' : '#333'} />}
                          <strong style={{ fontSize: '.78rem' }}>Картка {card.card_info || String(card.id).slice(0, 8)}</strong>
                        </div>
                        <div style={{ color: safe ? '#888' : '#555', fontSize: '.68rem', fontWeight: 800 }}>
                          {card.operation || 'операція не вказана'} | {cardStatusLabel(card.status)}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#aaa', fontSize: '.72rem', fontWeight: 900 }}>
                          <span>к-сть: {formatQty(card.quantity)}</span>
                          <span>БЗ: {formatQty(card.buffer_qty || card.bufferQty)}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
