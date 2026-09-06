import React from 'react'
import { X } from 'lucide-react'
import { inputStyle } from '../utils/nomenclatureHelpers'

export const NomenclatureEditModal = ({
  isEditModalOpen,
  editItem,
  setEditItem,
  flattenedGroups,
  handleSaveEditItemSubmit,
  onClose
}) => {
  if (!isEditModalOpen || !editItem) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="packaging-modal-window" style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '24px', width: '100%', maxWidth: '520px', padding: '25px', boxShadow: 'var(--shadow, 0 20px 50px rgba(0,0,0,0.15))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <span style={{ fontSize: '0.7rem', color: '#d97706', fontWeight: 900, fontFamily: 'monospace' }}>{editItem.code}</span>
            <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.1rem', color: 'var(--text, #0f172a)' }}>Редагувати номенклатуру</h3>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted, #64748b)', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <form onSubmit={handleSaveEditItemSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 900 }}>СТАНДАРТИЗОВАНА НАЗВА</label>
            <input 
              type="text" 
              value={editItem.editName} 
              onChange={e => setEditItem({ ...editItem, editName: e.target.value })} 
              required 
              style={inputStyle} 
            />
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 900 }}>КАТЕГОРІЯ / ГРУПА КАТАЛОГУ</label>
            <select 
              value={editItem.editGroupId || ''} 
              onChange={e => setEditItem({ ...editItem, editGroupId: e.target.value })} 
              style={inputStyle}
            >
              <option value="">-- Без групи (01. Загальна) --</option>
              {flattenedGroups.map(g => (
                <option key={g.id} value={g.id}>{g.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 900 }}>ОДИНИЦЯ ВИМІРУ</label>
            <select 
              value={editItem.editUnit || 'шт'} 
              onChange={e => setEditItem({ ...editItem, editUnit: e.target.value })} 
              style={inputStyle}
            >
              <option value="шт">Штуки (шт)</option>
              <option value="компл.">Комплекти (компл.)</option>
              <option value="лист">Листи (лист)</option>
              <option value="кг">Кілограми (кг)</option>
              <option value="м">Метри (м)</option>
              <option value="м²">Квадратні метри (м²)</option>
              <option value="л">Літри (л)</option>
            </select>
          </div>

          <button 
            type="submit" 
            style={{ 
              background: '#ff9000', 
              color: '#ffffff', 
              border: 'none', 
              borderRadius: '12px', 
              padding: '14px', 
              fontWeight: 900, 
              fontSize: '0.9rem',
              cursor: 'pointer', 
              marginTop: '10px',
              boxShadow: '0 4px 15px rgba(255,144,0,0.3)'
            }}
          >
            ЗБЕРЕГТИ ЗМІНИ НОМЕНКЛАТУРИ
          </button>
        </form>
      </div>
    </div>
  )
}
