import React from 'react'
import { X } from 'lucide-react'

export const Shop2AdminCardModal = ({
  showAdminCardModal,
  setShowAdminCardModal,
  nomenclatures,
  tasks,
  orders,
  adminNomId,
  setAdminNomId,
  adminTaskId,
  setAdminTaskId,
  adminQty,
  setAdminQty,
  adminStage,
  setAdminStage,
  nomSearchText,
  setNomSearchText,
  showNomDropdown,
  setShowNomDropdown,
  handleCreateAdminCard,
  isProcessing
}) => {
  if (!showAdminCardModal) return null

  const parts = (nomenclatures || []).filter(n => n.type === 'part').sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  const activeShop2Tasks = (tasks || [])
    .filter(t => t.status !== 'completed' && (t.step?.includes('Пресування') || t.step?.includes('ЦЕХ №2') || t.step?.includes('Доопрацювання')))
    .map(t => {
      const o = (orders || []).find(ord => ord.id === t.order_id)
      return {
        id: t.id,
        label: `Наряд №${o?.order_num || '—'}${t.batch_index ? `/${t.batch_index}` : ''} (${o?.customer || '—'})`
      }
    })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10030, padding: '20px', backdropFilter: 'blur(6px)' }}>
      <div style={{ background: '#111', width: '100%', maxWidth: '550px', borderRadius: '30px', border: '1px solid #333', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
        <div style={{ padding: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#181818', borderBottom: '1px solid #222' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 950, color: '#8b5cf6', letterSpacing: '0.5px' }}>СТВОРЕННЯ КАРТКИ ЦЕХУ №2 (АДМІН)</h3>
          <button onClick={() => { setShowAdminCardModal(false); setNomSearchText(''); setShowNomDropdown(false); }} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer' }}><X size={24} /></button>
        </div>
        <div style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ position: 'relative' }}>
            <label style={{ color: '#555', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Номенклатура (деталь) *</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="🔍 Оберіть або почніть писати назву деталі..."
                value={nomSearchText}
                onFocus={() => setShowNomDropdown(true)}
                onChange={e => {
                  setNomSearchText(e.target.value)
                  setShowNomDropdown(true)
                  const match = parts.find(p => p.name === e.target.value)
                  if (match) setAdminNomId(match.id)
                  else setAdminNomId('')
                }}
                style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '12px', paddingRight: '40px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 700 }}
              />
              <div
                onClick={() => setShowNomDropdown(!showNomDropdown)}
                style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', color: '#8b5cf6', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 900 }}
              >
                ▼
              </div>
            </div>

            {showNomDropdown && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 10039 }} onClick={() => setShowNomDropdown(false)} />
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#111', border: '1px solid #333', borderRadius: '12px', marginTop: '5px', maxHeight: '200px', overflowY: 'auto', zIndex: 10040, boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                  {parts.filter(p =>
                    (p.name || '').toLowerCase().includes(nomSearchText.toLowerCase()) ||
                    (p.nomenclature_code || '').toLowerCase().includes(nomSearchText.toLowerCase())
                  ).map(p => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setAdminNomId(p.id)
                        setNomSearchText(p.name)
                        setShowNomDropdown(false)
                      }}
                      style={{ padding: '12px', cursor: 'pointer', fontSize: '0.85rem', color: '#fff', borderBottom: '1px solid #222', background: adminNomId === p.id ? '#8b5cf633' : 'transparent', transition: 'background 0.2s' }}
                    >
                      {p.name} {p.nomenclature_code ? `(${p.nomenclature_code})` : ''}
                    </div>
                  ))}
                  {parts.filter(p =>
                    (p.name || '').toLowerCase().includes(nomSearchText.toLowerCase()) ||
                    (p.nomenclature_code || '').toLowerCase().includes(nomSearchText.toLowerCase())
                  ).length === 0 && (
                    <div style={{ padding: '12px', color: '#555', textAlign: 'center', fontSize: '0.85rem' }}>Нічого не знайдено</div>
                  )}
                </div>
              </>
            )}
          </div>

          <div>
            <label style={{ color: '#555', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Наряд / Наказ (необов'язково)</label>
            <select value={adminTaskId} onChange={e => setAdminTaskId(e.target.value)} style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 700 }}>
              <option value="">— Без прив'язки до наряду (загальний запас) —</option>
              {activeShop2Tasks.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <label style={{ color: '#555', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Кількість деталей *</label>
              <input type="number" value={adminQty} onChange={e => setAdminQty(e.target.value)} placeholder="0" style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 700 }} />
            </div>
            <div>
              <label style={{ color: '#555', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Технологічний етап *</label>
              <select value={adminStage} onChange={e => setAdminStage(e.target.value)} style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 700 }}>
                <option value="Пресування">Пресування</option>
                <option value="Фарбування">Фарбування</option>
                <option value="Доопрацювання">Доопрацювання</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
            <button onClick={() => { setShowAdminCardModal(false); setNomSearchText(''); setShowNomDropdown(false); }} style={{ flex: 1, background: '#1a1a1a', border: '1px solid #333', color: '#888', padding: '14px', borderRadius: '14px', fontWeight: 900, cursor: 'pointer' }}>СКАСУВАТИ</button>
            <button disabled={isProcessing} onClick={handleCreateAdminCard} style={{ flex: 1, background: '#8b5cf6', color: '#fff', border: 'none', padding: '14px', borderRadius: '14px', fontWeight: 900, cursor: 'pointer', opacity: isProcessing ? 0.5 : 1 }}>СТВОРІТИ КАРТКУ</button>
          </div>
        </div>
      </div>
    </div>
  )
}
