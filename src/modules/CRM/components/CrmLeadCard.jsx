import React from 'react'
import { Edit3, Package, Trash2 } from 'lucide-react'

export const CrmLeadCard = ({
  lead,
  stage,
  colIdx,
  stages,
  openLeadModalForEdit,
  handleDeleteLead,
  handleMoveLeadStage
}) => {
  return (
    <div
      key={lead.id}
      style={{
        background: 'var(--card-bg, rgba(30, 30, 42, 0.8))',
        border: '1px solid var(--glass-border)',
        borderRadius: '14px',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
      }}
    >
      {/* Top Meta */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.74rem', fontWeight: 900, color: stage.color }}>
          {lead.title}
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => openLeadModalForEdit(lead)}
            title="Редагувати лід"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
          >
            <Edit3 size={13} />
          </button>
          <button
            onClick={() => handleDeleteLead(lead.id)}
            title="Видалити"
            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Client Name */}
      <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text)' }}>
        {lead.clientName}
      </div>

      {/* Product Interest & Quantity */}
      {(lead.productInterest || lead.quantity) && (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Package size={13} />
          <span>{lead.productInterest || 'Виріб'} ({lead.quantity || 1} шт)</span>
        </div>
      )}

      {/* Notes snippet */}
      {lead.notes && (
        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', background: 'var(--glass-border, rgba(0,0,0,0.05))', padding: '6px 10px', borderRadius: '8px', lineHeight: 1.3 }}>
          {lead.notes}
        </div>
      )}

      {/* Footer & Stage Shift Buttons */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTop: '1px solid var(--glass-border)',
        paddingTop: '8px',
        marginTop: '4px'
      }}>
        <span style={{ fontWeight: 900, fontSize: '0.9rem', color: lead.amount > 0 ? '#10b981' : 'var(--text-muted)' }}>
          {lead.amount > 0 ? `₴${lead.amount.toLocaleString()}` : 'Без ціни'}
        </span>

        {/* Move Stage Quick Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {colIdx > 0 && (
            <button
              onClick={() => handleMoveLeadStage(lead.id, stages[colIdx - 1].id)}
              title={`Пересунути на: ${stages[colIdx - 1].title}`}
              style={{
                padding: '3px 7px',
                borderRadius: '6px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--glass-border)',
                color: 'var(--text-muted)',
                fontSize: '0.7rem',
                cursor: 'pointer'
              }}
            >
              ←
            </button>
          )}
          {colIdx < stages.length - 1 && (
            <button
              onClick={() => handleMoveLeadStage(lead.id, stages[colIdx + 1].id)}
              title={`Пересунути на: ${stages[colIdx + 1].title}`}
              style={{
                padding: '3px 7px',
                borderRadius: '6px',
                background: 'rgba(99, 102, 241, 0.18)',
                border: '1px solid #6366f1',
                color: '#6366f1',
                fontSize: '0.7rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default CrmLeadCard
