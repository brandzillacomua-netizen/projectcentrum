import React from 'react'
import { X } from 'lucide-react'

export const VKYARestorationLegacyModal = ({
  legacyDraft,
  onClose,
  legacyQuantity,
  setLegacyQuantity,
  legacyStageId,
  setLegacyStageId,
  restorationStages,
  assignLegacyItem,
  saving
}) => {
  if (!legacyDraft) return null

  return (
    <div onClick={() => !saving && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 10060, background: 'rgba(0,0,0,.88)', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div onClick={event => event.stopPropagation()} style={{ width: '100%', maxWidth: 500, background: 'var(--card-bg, #0d0d0d)', border: '1px solid #f59e0b55', borderRadius: 22, padding: 25, color: 'var(--text, #fff)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
          <div>
            <div style={{ color: '#f59e0b', fontSize: '.68rem', fontWeight: 1000 }}>РОЗПОДІЛИТИ У КАРТУ</div>
            <h2 style={{ margin: '7px 0 3px', overflowWrap: 'anywhere', color: 'var(--text, #fff)' }}>{legacyDraft.name}</h2>
            <div style={{ color: 'var(--text-muted, #777)' }}>Доступно: {legacyDraft.total_qty} {legacyDraft.unit || 'шт'}</div>
          </div>
          <button onClick={onClose} style={{ alignSelf: 'flex-start', background: 'transparent', border: 0, color: 'var(--text-muted, #777)', cursor: 'pointer' }}><X/></button>
        </div>

        <label style={{ display: 'block', color: 'var(--text-muted, #888)', fontSize: '.7rem', fontWeight: 950, margin: '22px 0 7px' }}>КІЛЬКІСТЬ</label>
        <input
          autoFocus
          type="number"
          min="1"
          max={legacyDraft.total_qty}
          value={legacyQuantity}
          onChange={event => setLegacyQuantity(event.target.value)}
          style={{ boxSizing: 'border-box', width: '100%', background: 'var(--bg, #050505)', border: '1px solid var(--glass-border, #333)', borderRadius: 11, color: 'var(--text, #fff)', padding: 13 }}
        />

        <label style={{ display: 'block', color: 'var(--text-muted, #888)', fontSize: '.7rem', fontWeight: 950, margin: '17px 0 7px' }}>ЕТАП ВІДНОВЛЕННЯ</label>
        <select
          value={legacyStageId}
          onChange={event => setLegacyStageId(event.target.value)}
          style={{ boxSizing: 'border-box', width: '100%', background: 'var(--bg, #050505)', border: '1px solid var(--glass-border, #333)', borderRadius: 11, color: 'var(--text, #fff)', padding: 13 }}
        >
          <option value="">Оберіть етап</option>
          {restorationStages.map(stage => (
            <option key={stage.id} value={stage.id}>{stage.name}</option>
          ))}
        </select>

        <button
          onClick={assignLegacyItem}
          disabled={saving || !legacyStageId || !Number.isInteger(Number(legacyQuantity)) || Number(legacyQuantity) <= 0 || Number(legacyQuantity) > Number(legacyDraft.total_qty)}
          style={{ width: '100%', marginTop: 21, background: '#f59e0b', color: '#170d00', border: 0, borderRadius: 12, padding: 14, fontWeight: 1000, cursor: 'pointer' }}
        >
          {saving ? 'СТВОРЕННЯ...' : 'СТВОРИТИ КАРТУ'}
        </button>
      </div>
    </div>
  )
}

export default VKYARestorationLegacyModal
