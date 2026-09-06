import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { NomCreateModal } from './NomCreateModal'
import { autoClassify } from '../utils/engineerHelpers.jsx'

export const BomRow = ({ row, idx, nomenclatures, bomItems, onUpdate, onRemove, supabase, refreshTable, onExpandAssembly }) => {
  const [query, setQuery] = useState(row.nomName || '')
  const [showDrop, setShowDrop] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const inputRef = useRef(null)

  const prevNomId = useRef(row.nomId)
  useEffect(() => {
    if (prevNomId.current !== row.nomId) {
      prevNomId.current = row.nomId
      setQuery(row.nomName || '')
    }
  }, [row.nomId, row.nomName])

  const filtered = useMemo(() => {
    if (!query || query.length < 1) return []
    const q = query.toLowerCase()
    return (nomenclatures || []).filter(n => 
      (n.name || '').toLowerCase().includes(q) ||
      (n.description || '').toLowerCase().includes(q) ||
      (n.material_type || '').toLowerCase().includes(q) ||
      (n.nomenclature_code || '').toLowerCase().includes(q)
    ).slice(0, 15)
  }, [query, nomenclatures])

  const subItems = useMemo(() => {
    if (!row.nomId || !bomItems) return []
    return bomItems.filter(b => String(b.parent_id) === String(row.nomId))
  }, [row.nomId, bomItems])

  const TYPE_COLORS = { product: '#d97706', part: '#2563eb', raw: '#059669', consumable: '#dc2626', assembly: '#7c3aed' }
  const TYPE_LABELS = { product: 'Виріб', part: 'Деталь', raw: 'Сировина', consumable: 'Метиз', assembly: 'Вузол' }

  return (
    <>
      {showCreate && (
        <NomCreateModal
          prefilledName={query}
          supabase={supabase}
          refreshTable={refreshTable}
          onClose={() => setShowCreate(false)}
          onCreated={nom => {
            setQuery(nom.name)
            setShowDrop(false)
            onUpdate(idx, { nomId: nom.id, nomName: nom.name, nomType: nom.type, nomUnit: nom.unit, group: autoClassify(nom) })
          }}
        />
      )}
      <div style={{ background: idx % 2 === 0 ? 'var(--card-header-bg, rgba(0,0,0,0.02))' : 'transparent', borderBottom: '1px solid var(--border-color, #e2e8f0)', borderRadius: '8px', padding: '6px 2px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 120px 90px 28px', gap: '8px', alignItems: 'center', padding: '4px 10px', position: 'relative' }}>
          <span style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.8rem', fontWeight: 700, textAlign: 'center' }}>{idx + 1}</span>
          <div style={{ position: 'relative' }}>
            <input
              ref={inputRef}
              value={query}
              placeholder="Пошук або назва компонента..."
              onChange={e => { setQuery(e.target.value); setShowDrop(true); onUpdate(idx, { nomId: null, nomName: e.target.value }) }}
              onFocus={() => setShowDrop(true)}
              onBlur={() => setTimeout(() => setShowDrop(false), 250)}
              style={{
                width: '100%',
                padding: '9px 12px',
                background: row.nomId ? 'rgba(16, 185, 129, 0.12)' : 'var(--input-bg, #ffffff)',
                border: `1px solid ${row.nomId ? 'rgba(16, 185, 129, 0.5)' : 'var(--border-color, #cbd5e1)'}`,
                color: 'var(--text-main, #0f172a)',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                boxSizing: 'border-box'
              }}
            />
            {showDrop && query.length >= 1 && (
              <div 
                style={{ 
                  position: 'absolute', 
                  top: '100%', 
                  left: 0, 
                  right: 0, 
                  background: 'var(--card-bg, #ffffff)', 
                  border: '2px solid #3b82f6', 
                  borderRadius: '12px', 
                  zIndex: 99999, 
                  maxHeight: '280px', 
                  overflowY: 'auto', 
                  boxShadow: '0 12px 35px rgba(0,0,0,0.25)', 
                  marginTop: '4px' 
                }}
              >
                {filtered.map(n => (
                  <div
                    key={n.id}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setQuery(n.name)
                      setShowDrop(false)
                      onUpdate(idx, { nomId: n.id, nomName: n.name, nomType: n.type, nomUnit: n.unit, group: autoClassify(n) })
                    }}
                    style={{ 
                      padding: '10px 14px', 
                      cursor: 'pointer', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      borderBottom: '1px solid var(--border-color, #e2e8f0)', 
                      transition: 'background 0.15s' 
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.12)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main, #0f172a)' }}>{n.name}</div>
                      {n.material_type && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748b)' }}>{n.material_type}</div>}
                    </div>
                    <span style={{ fontSize: '0.65rem', fontWeight: 900, background: (TYPE_COLORS[n.type] || '#555') + '22', color: TYPE_COLORS[n.type] || '#888', padding: '2px 8px', borderRadius: '20px', whiteSpace: 'nowrap' }}>{TYPE_LABELS[n.type] || n.type}</span>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div style={{ padding: '12px 14px' }}>
                    <div style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.8rem', marginBottom: '10px' }}>Нічого не знайдено за запитом «{query}»</div>
                    <button onMouseDown={(e) => { e.preventDefault(); setShowDrop(false); setShowCreate(true) }} style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid #7c3aed40', color: '#7c3aed', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Plus size={14}/> Створити «{query}»
                    </button>
                  </div>
                )}
                {filtered.length > 0 && (
                  <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
                    <button onMouseDown={(e) => { e.preventDefault(); setShowDrop(false); setShowCreate(true) }} style={{ background: 'transparent', border: 'none', color: '#7c3aed', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Plus size={12}/> Не знайшли? Створити нову
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <select
            value={row.group || 'Деталі'}
            onChange={e => onUpdate(idx, { group: e.target.value })}
            style={{ 
              padding: '9px 8px', 
              background: 'var(--input-bg, #ffffff)', 
              border: '1px solid var(--border-color, #cbd5e1)', 
              color: 'var(--text-main, #0f172a)', 
              borderRadius: '8px', 
              fontSize: '0.8rem',
              fontWeight: 600
            }}
          >
            <option>Деталі</option>
            <option>Накладки</option>
            <option>Метизи</option>
            <option>Гума/Пластик</option>
            <option>3D-друк</option>
            <option>Фурнітура</option>
            <option>Комплектуючі</option>
            <option>Інше</option>
          </select>
          <input
            type="number"
            min="1"
            step="1"
            value={row.qty}
            onChange={e => onUpdate(idx, { qty: e.target.value })}
            style={{ 
              padding: '9px 10px', 
              background: 'var(--input-bg, #ffffff)', 
              border: '1px solid var(--border-color, #cbd5e1)', 
              color: '#f59e0b', 
              borderRadius: '8px', 
              fontSize: '0.9rem', 
              fontWeight: 800, 
              textAlign: 'right' 
            }}
          />
          <button onClick={() => onRemove(idx)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', borderRadius: '6px' }} title="Видалити рядок">
            <Trash2 size={16}/>
          </button>
        </div>

        {row.nomId && row.nomType === 'assembly' && subItems.length > 0 && (
          <div style={{ marginLeft: '36px', marginRight: '10px', marginTop: '6px', marginBottom: '4px', padding: '10px 14px', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#7c3aed', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '5px' }}>📦 Вузол містить {subItems.length} компонент(ів):</span>
              <button 
                onClick={() => onExpandAssembly(row.nomId, Number(row.qty) || 1)}
                style={{ padding: '3px 8px', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', color: '#7c3aed', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 800, transition: 'all 0.2s' }}
              >
                💥 Розгорнути в окремі рядки
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {subItems.map(s => {
                const subNom = (nomenclatures || []).find(n => String(n.id) === String(s.child_id))
                return (
                  <span key={s.id} style={{ fontSize: '0.7rem', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #cbd5e1)', padding: '2px 8px', borderRadius: '6px', color: 'var(--text-main, #0f172a)' }}>
                    {subNom ? subNom.name : 'компонент'} <strong style={{ color: '#7c3aed' }}>x{s.quantity_per_parent}</strong>
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
