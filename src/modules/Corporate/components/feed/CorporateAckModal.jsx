import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, CheckCircle2, User, Clock, ShieldCheck } from 'lucide-react'
import { corporateApi } from '../../services/corporateApi'
import { CorporateAvatar } from '../common/CorporateAvatar'

export function CorporateAckModal({
  postId,
  postTitle,
  onClose
}) {
  const [acks, setAcks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    corporateApi.fetchPostAcksList(postId)
      .then(data => {
        if (mounted) {
          setAcks(data || [])
          setLoading(false)
        }
      })
      .catch(err => {
        console.error(err)
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [postId])

  const modalContent = (
    <div className="corp-modal-overlay" onClick={onClose}>
      <div className="corp-modal-box" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: '1px solid var(--ch-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--ch-text-primary)' }}>
                Реєстр підтверджень ознайомлення
              </div>
              {postTitle && (
                <div style={{ fontSize: '0.75rem', color: 'var(--ch-text-dim)', marginTop: '2px', maxWidth: '340px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {postTitle}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="corp-footer-action-btn"
            style={{ padding: '6px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content list */}
        <div style={{ padding: '16px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--ch-text-dim)', fontSize: '0.85rem' }}>
              Завантаження підписів...
            </div>
          ) : acks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--ch-text-dim)', fontSize: '0.85rem' }}>
              Ще ніхто зі співробітників не підтвердив ознайомлення
            </div>
          ) : (
            acks.map((ack, idx) => {
              const u = ack.user
              const uName = u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.login : 'Користувач'
              const uInitials = u?.first_name ? u.first_name[0] : 'U'
              const timeStr = ack.acknowledged_at
                ? new Date(ack.acknowledged_at).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                : ''

              const modalContent = (
                <div
                  key={ack.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    background: 'var(--ch-surface-inset)',
                    border: '1px solid var(--ch-border)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CorporateAvatar
                      user={u}
                      size={32}
                    />
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--ch-text-primary)' }}>{uName}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--ch-text-dim)' }}>{u?.position || u?.department || 'Працівник'}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#10b981', fontWeight: 800 }}>
                    <CheckCircle2 size={14} />
                    <span>{timeStr}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--ch-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--ch-surface-inset)' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--ch-text-muted)', fontWeight: 700 }}>
            Всього підтвердили: <strong style={{ color: 'var(--ch-text-primary)' }}>{acks.length}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="corp-btn-subtle"
          >
            Закрити
          </button>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent
}
