import React from 'react'
import { X } from 'lucide-react'
import { MACHINE_TYPES } from '../../utils/masterHelpers'

export function MasterCustomCardModal({
  showCustomCardModal,
  setShowCustomCardModal,
  nomenclatures = [],
  customCardNomId,
  setCustomCardNomId,
  customCardQty,
  setCustomCardQty,
  customCardMachine,
  setCustomCardMachine,
  customCardDeadline,
  setCustomCardDeadline,
  customCardSearch,
  setCustomCardSearch,
  handleCreateCustomCard,
  isSubmitting
}) {
  if (!showCustomCardModal) return null

  const partNomenclatures = (nomenclatures || []).filter(n => n.type === 'part')
  const filteredNoms = partNomenclatures.filter(n => 
    n.name?.toLowerCase().includes(customCardSearch.toLowerCase()) || 
    n.description?.toLowerCase().includes(customCardSearch.toLowerCase()) || 
    n.additional_info?.toLowerCase().includes(customCardSearch.toLowerCase()) || 
    n.material_type?.toLowerCase().includes(customCardSearch.toLowerCase())
  ).slice(0, 15)

  const selectedNom = (nomenclatures || []).find(n => n.id === customCardNomId)

  return (
    <div className="worksheet-modal-overlay no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(5px)' }}>
      <div className="worksheet-panel" style={{ background: '#0d0d0d', border: '1px solid #222', width: '100%', maxWidth: '600px', borderRadius: '24px', padding: '30px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', overflowY: 'auto', maxHeight: '90vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #1a1a1a', paddingBottom: '15px' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 950, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>СТВОРИТИ ВЛАСНУ РОБОЧУ КАРТКУ</h2>
          <button onClick={() => setShowCustomCardModal(false)} style={{ background: '#1a1a1a', border: '1px solid #333', color: '#aaa', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={16} /></button>
        </div>

        {/* NOMENCLATURE SELECTION */}
        <div style={{ marginBottom: '20px', position: 'relative' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', color: '#555', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>Деталь (Номенклатура)</label>
          {selectedNom ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111', border: '1px solid #22c55e', borderRadius: '12px', padding: '12px' }}>
              <div>
                <div style={{ fontWeight: 800, color: '#fff', fontSize: '0.9rem' }}>{selectedNom.name}</div>
                {selectedNom.description && (
                  <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '2px' }}>{selectedNom.description}</div>
                )}
                {selectedNom.additional_info && (
                  <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>{selectedNom.additional_info}</div>
                )}
              </div>
              <button 
                onClick={() => {
                  setCustomCardNomId('')
                  setCustomCardSearch('')
                }} 
                style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer' }}
              >
                Змінити
              </button>
            </div>
          ) : (
            <div>
              <input
                type="text"
                placeholder="Введіть назву, опис або параметри деталі..."
                value={customCardSearch}
                onChange={e => setCustomCardSearch(e.target.value)}
                style={{ width: '100%', background: '#000', border: '1px solid #222', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '0.9rem', outline: 'none' }}
              />
              {customCardSearch.trim().length > 0 && (
                <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', background: '#0d0d0d', border: '1px solid #222', borderRadius: '12px', zIndex: 10001, marginTop: '5px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', maxHeight: '200px', overflowY: 'auto' }}>
                  {filteredNoms.length > 0 ? (
                    filteredNoms.map(n => (
                      <div 
                        key={n.id} 
                        onClick={() => {
                          setCustomCardNomId(n.id)
                          setCustomCardSearch('')
                        }}
                        className="search-nom-item"
                        style={{ padding: '12px 15px', borderBottom: '1px solid #111', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '2px', transition: 'background 0.2s' }}
                      >
                        <span style={{ color: '#fff', fontWeight: 800, fontSize: '0.85rem' }}>{n.name}</span>
                        {(n.description || n.additional_info) && (
                          <span style={{ color: '#aaa', fontSize: '0.7rem' }}>{n.description || n.additional_info}</span>
                        )}
                        <span style={{ color: '#444', fontSize: '0.65rem' }}>Матеріал: {n.material_type || '—'}</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '15px', color: '#444', fontSize: '0.8rem', textAlign: 'center' }}>Нічого не знайдено</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* QUANTITY */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', color: '#555', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>Кількість деталей, шт</label>
          <input
            type="number"
            min="1"
            placeholder="Введіть потрібну кількість"
            value={customCardQty}
            onChange={e => setCustomCardQty(e.target.value)}
            style={{ width: '100%', background: '#000', border: '1px solid #222', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '1rem', fontWeight: 800, outline: 'none' }}
          />
        </div>

        {/* MACHINE / CNC TYPE */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', color: '#555', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>CNC Верстат</label>
          <select
            value={customCardMachine}
            onChange={e => setCustomCardMachine(e.target.value)}
            style={{ width: '100%', background: '#000', border: '1px solid #222', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 800, outline: 'none' }}
          >
            <option value="">Оберіть верстат</option>
            {MACHINE_TYPES.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* DEADLINE */}
        <div style={{ marginBottom: '30px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', color: '#555', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>Дедлайн</label>
          <input
            type="date"
            value={customCardDeadline}
            onChange={e => setCustomCardDeadline(e.target.value)}
            style={{ width: '100%', background: '#000', border: '1px solid #222', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 800, outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => setShowCustomCardModal(false)} style={{ flex: 1, padding: '12px', background: '#1a1a1a', color: '#888', border: 'none', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}>СКАСУВАТИ</button>
          <button
            onClick={handleCreateCustomCard}
            disabled={isSubmitting}
            style={{ flex: 2, padding: '12px', background: '#ff9000', color: '#000', border: 'none', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', transition: 'all 0.2s' }}
          >
            {isSubmitting ? 'ЗБЕРЕЖЕННЯ...' : 'СТВОРИТИ'}
          </button>
        </div>
      </div>
    </div>
  )
}
