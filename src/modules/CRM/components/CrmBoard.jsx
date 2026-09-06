import React from 'react'
import { ChevronLeft, ChevronRight, Edit3, Trash2 } from 'lucide-react'
import CrmLeadCard from './CrmLeadCard.jsx'

export const CrmBoard = ({
  stages,
  filteredLeads,
  handleMoveColumn,
  openStageModalForEdit,
  handleDeleteStage,
  openLeadModalForEdit,
  handleDeleteLead,
  handleMoveLeadStage
}) => {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${stages.length}, minmax(280px, 1fr))`,
      gap: '18px',
      overflowX: 'auto',
      paddingBottom: '20px'
    }}>
      {stages.map((stage, colIdx) => {
        const stageLeads = filteredLeads.filter(l => l.stageId === stage.id)
        const stageValue = stageLeads.reduce((s, l) => s + (Number(l.amount) || 0), 0)

        return (
          <div key={stage.id} className="glass-panel" style={{
            padding: '16px',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            background: 'var(--card-bg, rgba(18, 18, 24, 0.65))',
            border: '1px solid var(--glass-border)'
          }}>
            {/* Column Header */}
            <div style={{
              borderBottom: `2px solid ${stage.color}`,
              paddingBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 900, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: stage.color }} />
                  {stage.title}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                  {stageValue > 0 ? `₴${stageValue.toLocaleString()} · ` : ''}{stageLeads.length} запитів
                </div>
              </div>

              {/* Column Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  disabled={colIdx === 0}
                  onClick={() => handleMoveColumn(colIdx, -1)}
                  title="Перемістити колонку вліво"
                  style={{ background: 'none', border: 'none', color: colIdx === 0 ? 'var(--text-dim)' : 'var(--text-muted)', cursor: colIdx === 0 ? 'default' : 'pointer', padding: '3px' }}
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  disabled={colIdx === stages.length - 1}
                  onClick={() => handleMoveColumn(colIdx, 1)}
                  title="Перемістити колонку вправо"
                  style={{ background: 'none', border: 'none', color: colIdx === stages.length - 1 ? 'var(--text-dim)' : 'var(--text-muted)', cursor: colIdx === stages.length - 1 ? 'default' : 'pointer', padding: '3px' }}
                >
                  <ChevronRight size={14} />
                </button>
                <button
                  onClick={() => openStageModalForEdit(stage)}
                  title="Налаштувати етап"
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '3px' }}
                >
                  <Edit3 size={13} />
                </button>
                {!stage.isSystem && (
                  <button
                    onClick={() => handleDeleteStage(stage.id)}
                    title="Видалити етап"
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '3px' }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Leads List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '120px' }}>
              {stageLeads.length === 0 ? (
                <div style={{ padding: '36px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Немає запитів у цій колонці
                </div>
              ) : (
                stageLeads.map(lead => (
                  <CrmLeadCard
                    key={lead.id}
                    lead={lead}
                    stage={stage}
                    colIdx={colIdx}
                    stages={stages}
                    openLeadModalForEdit={openLeadModalForEdit}
                    handleDeleteLead={handleDeleteLead}
                    handleMoveLeadStage={handleMoveLeadStage}
                  />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default CrmBoard
