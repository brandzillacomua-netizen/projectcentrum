import React from 'react'
import { X } from 'lucide-react'
import { inputStyle } from '../utils/nomenclatureHelpers'

export const NomenclatureGroupModal = ({
  isGroupModalOpen,
  editingGroup,
  newGroup,
  setNewGroup,
  groups,
  flattenedGroups,
  handleSaveGroupSubmit,
  onClose
}) => {
  if (!isGroupModalOpen) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="packaging-modal-window" style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '24px', width: '100%', maxWidth: '480px', padding: '25px', boxShadow: 'var(--shadow, 0 20px 50px rgba(0,0,0,0.15))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.1rem', color: '#d97706' }}>
            {editingGroup ? `Редагування категорії: ${editingGroup.name}` : 'Нова категорія (група)'}
          </h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted, #64748b)', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <form onSubmit={handleSaveGroupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 900 }}>НАЗВА КАТЕГОРІЇ</label>
            <input value={newGroup.name} onChange={e => setNewGroup({...newGroup, name: e.target.value})} required placeholder="напр. Заклепки" style={inputStyle} />
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 900 }}>КОД ГРУПИ</label>
            <input value={newGroup.code} onChange={e => setNewGroup({...newGroup, code: e.target.value})} placeholder="напр. HW.RIVET" style={inputStyle} />
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 900 }}>БАТЬКІВСЬКА ГРУПА</label>
            <select value={newGroup.parent_id || ''} onChange={e => setNewGroup({...newGroup, parent_id: e.target.value || null})} style={inputStyle}>
              <option value="">-- Корінь (Верхній рівень) --</option>
              {flattenedGroups.filter(g => !editingGroup || g.id !== editingGroup.id).map(g => (
                <option key={g.id} value={g.id}>{g.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 900 }}>ТИП ПРАВИЛ НАЙМЕНУВАННЯ</label>
            <select value={newGroup.rule_type} onChange={e => setNewGroup({...newGroup, rule_type: e.target.value})} style={inputStyle}>
              <option value="generic">Ззвичайний (без спеціальних полів)</option>
              <option value="screw">Гвинти (Стандарт, М, Довжина, Колір)</option>
              <option value="standoff">Стійки міжплатні (TFF/TFM, М, Довжина, Матеріал)</option>
              <option value="mill">Фрези (Тип, dхDхlхL)</option>
              <option value="carbon">Карбонові листи (Марка, Товщина, Позначка)</option>
              <option value="frame_part">Деталі (Лазерне різання, Назва, Лист, Норма)</option>
              <option value="full_frame">Рами карбонові (RND/ІП, Модель)</option>
            </select>
          </div>

          <button type="submit" style={{ background: '#ff9000', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '14px', fontWeight: 900, cursor: 'pointer', marginTop: '10px', boxShadow: '0 4px 15px rgba(255,144,0,0.3)' }}>
            {editingGroup ? 'ЗБЕРЕГТИ ЗМІНИ КАТЕГОРІЇ' : 'СТВОРИТИ КАТЕГОРІЮ'}
          </button>
        </form>
      </div>
    </div>
  )
}
