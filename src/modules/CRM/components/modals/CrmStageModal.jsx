import React from 'react'
import { X } from 'lucide-react'

export const CrmStageModal = ({
  isAddStageOpen,
  setIsAddStageOpen,
  editingStage,
  stageForm,
  setStageForm,
  handleSaveStage
}) => {
  if (!isAddStageOpen) return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      backdropFilter: 'blur(10px)'
    }}>
      <div style={{
        background: 'var(--card-bg, #1a1a24)',
        border: '1px solid var(--glass-border)',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '420px',
        padding: '24px',
        color: 'var(--text)',
        boxShadow: '0 25px 50px rgba(0,0,0,0.4)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900 }}>
            {editingStage ? 'Редагувати Етап' : 'Новий Етап Воронки'}
          </h3>
          <button onClick={() => setIsAddStageOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSaveStage} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Назва Етапу *</label>
            <input
              type="text"
              required
              placeholder="напр.: Узгодження Договору..."
              value={stageForm.title}
              onChange={e => setStageForm({ ...stageForm, title: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Колір Етапу</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="color"
                value={stageForm.color}
                onChange={e => setStageForm({ ...stageForm, color: e.target.value })}
                style={{ width: '44px', height: '38px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'transparent' }}
              />
              <input
                type="text"
                value={stageForm.color}
                onChange={e => setStageForm({ ...stageForm, color: e.target.value })}
                style={{ flex: 1, padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', outline: 'none' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => setIsAddStageOpen(false)}
              style={{ padding: '10px 16px', borderRadius: '10px', border: 'none', background: 'transparent', color: 'var(--text-muted)', fontWeight: 800, cursor: 'pointer' }}
            >
              Скасувати
            </button>
            <button
              type="submit"
              style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: '#6366f1', color: '#fff', fontWeight: 900, cursor: 'pointer' }}
            >
              Зберегти Етап
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CrmStageModal
