import React, { useState, useMemo } from 'react'
import { Plus, X, Search, CheckCircle2, Layers, Wrench, FileArchive, Package, Box } from 'lucide-react'
import { detectCategoryKey } from '../utils/packagingHelpers'

export const PackagingAddItemModal = ({
  nomenclatures,
  inventory,
  initialCategoryKey,
  onClose,
  onConfirmAddItem
}) => {
  const [addItemSearch, setAddItemSearch] = useState('')
  const [addItemQty, setAddItemQty] = useState(1)
  const [addItemSelectedNom, setAddItemSelectedNom] = useState(null)
  const [addItemCategoryKey, setAddItemCategoryKey] = useState(initialCategoryKey || 'hardware')

  const getIconForType = (nom) => {
    const name = (nom.name || '').toLowerCase()
    const type = (nom.type || '').toLowerCase()
    if (name.includes('кріплення') || name.includes('друк') || name.includes('3д')) return <Layers size={16} color="#eab308" />
    if (name.includes('стійка')) return <Layers size={16} color="#8b5cf6" />
    if (name.includes('гвинт') || name.includes('гайка') || type.includes('метиз') || type.includes('hardware') || type.includes('fastener')) return <Wrench size={16} color="#06b6d4" />
    if (name.includes('накладка') || name.includes('тримач') || name.includes('упаковка') || name.includes('пакет') || name.includes('гума')) return <FileArchive size={16} color="#3b82f6" />
    if (name.includes('-іп') || name.includes(' іп') || type.includes('part') || type.includes('деталь')) return <Package size={16} color="#f43f5e" />
    return <Box size={16} color="var(--text-muted, #555)" />
  }

  const addItemSearchResults = useMemo(() => {
    const trimmed = addItemSearch.trim()
    if (!trimmed) return []
    const q = trimmed.toLowerCase()
    return (nomenclatures || [])
      .filter(n => {
        const name = (n.name || '').toLowerCase()
        const aliases = (n.aliases || '').toLowerCase()
        const code = (n.nomenclature_code || '').toLowerCase()
        const desc = (n.description || '').toLowerCase()
        return name.includes(q) || aliases.includes(q) || code.includes(q) || desc.includes(q)
      })
      .slice(0, 15)
  }, [nomenclatures, addItemSearch])

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.8)',
      backdropFilter: 'blur(20px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '20px'
    }}>
      <div className="packaging-modal-window" style={{
        background: 'var(--card-bg, #ffffff)',
        border: '1px solid var(--border-color, #e2e8f0)',
        borderRadius: '28px',
        width: '100%',
        maxWidth: '540px',
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        boxShadow: 'var(--shadow, 0 30px 80px rgba(0,0,0,0.15))'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px', height: '46px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(6,182,212,0.35)'
            }}>
              <Plus size={22} color="#fff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 950, color: 'var(--text, #0f172a)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Додати позицію
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', lineHeight: '1.4' }}>
                Пошук по назві, коду або синоніму
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#888', cursor: 'pointer', padding: '8px', display: 'flex', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#888' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Category selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '0.65rem', fontWeight: 900, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: '1px' }}>Категорія</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { key: 'sgp', label: 'СГП / ДЕТАЛІ', color: '#f43f5e' },
              { key: 'mounts', label: 'КРІПЛЕННЯ', color: '#eab308' },
              { key: 'hardware', label: 'МЕТИЗИ', color: '#06b6d4' },
              { key: 'spacers', label: 'СТІЙКИ', color: '#8b5cf6' },
              { key: 'other', label: 'НАКЛАДКИ / ІНШЕ', color: '#3b82f6' }
            ].map(cat => (
              <button
                key={cat.key}
                onClick={() => setAddItemCategoryKey(cat.key)}
                style={{
                  padding: '6px 12px',
                  background: addItemCategoryKey === cat.key ? `${cat.color}22` : 'rgba(255,255,255,0.03)',
                  border: `1.5px solid ${addItemCategoryKey === cat.key ? cat.color + '66' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: '10px',
                  color: addItemCategoryKey === cat.key ? cat.color : '#555',
                  fontSize: '0.65rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  letterSpacing: '0.5px'
                }}
              >{cat.label}</button>
            ))}
          </div>
        </div>

        {/* Search field */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '0.65rem', fontWeight: 900, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: '1px' }}>Пошук номенклатури</label>
          <div style={{ position: 'relative' }}>
            <Search size={16} color="#555" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              autoFocus
              type="text"
              value={addItemSearch}
              onChange={e => { setAddItemSearch(e.target.value); setAddItemSelectedNom(null) }}
              placeholder="Введіть назву, код або синонім..."
              style={{
                width: '100%',
                padding: '13px 14px 13px 42px',
                background: 'var(--input-bg, #f8fafc)',
                border: '1.5px solid var(--border-color, #cbd5e1)',
                borderRadius: '14px',
                color: 'var(--text, #0f172a)',
                fontSize: '0.9rem',
                fontWeight: 600,
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s'
              }}
              onFocus={e => { e.target.style.borderColor = '#06b6d4' }}
              onBlur={e => { e.target.style.borderColor = 'var(--border-color, #cbd5e1)' }}
            />
          </div>

          {/* Search results */}
          {addItemSearch.trim() && addItemSearchResults.length > 0 && !addItemSelectedNom && (
            <div style={{
              background: 'var(--card-bg, #ffffff)',
              border: '1px solid var(--border-color, #cbd5e1)',
              borderRadius: '14px',
              overflow: 'hidden',
              maxHeight: '220px',
              overflowY: 'auto'
            }}>
              {addItemSearchResults.map(nom => (
                <div
                  key={nom.id}
                  onClick={() => {
                    setAddItemSelectedNom(nom)
                    setAddItemSearch(nom.name)
                    const detectedCat = detectCategoryKey(nom)
                    setAddItemCategoryKey(prev => prev || detectedCat)
                  }}
                  style={{
                    padding: '10px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    borderBottom: '1px solid var(--border-color, #e2e8f0)',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(6,182,212,0.08)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ background: 'var(--card-header-bg, #f1f5f9)', padding: '6px', borderRadius: '6px', flexShrink: 0 }}>
                    {getIconForType(nom)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text, #0f172a)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nom.name}</div>
                    <div style={{ fontSize: '0.65rem', color: '#3a5a6a', fontWeight: 600, marginTop: '2px' }}>
                      {nom.nomenclature_code && <span style={{ marginRight: '8px', color: '#4a8a9a' }}>Код: {nom.nomenclature_code}</span>}
                      {nom.description && <span style={{ color: '#06b6d4', marginRight: '8px' }}>{nom.description}</span>}
                      {nom.aliases && <span style={{ color: '#2a5a6a', marginLeft: '6px', fontStyle: 'italic' }}>{nom.aliases}</span>}
                    </div>
                  </div>
                  <div style={{
                    marginLeft: 'auto',
                    background: 'rgba(236,72,153,0.12)',
                    border: '1px solid rgba(236,72,153,0.3)',
                    borderRadius: '8px',
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 900,
                    color: '#ec4899',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}>
                    Вільний залишок: {(() => {
                      const items = (inventory || []).filter(i => String(i.nomenclature_id) === String(nom.id));
                      const total = items.reduce((acc, cur) => acc + (Number(cur.total_qty) || 0), 0);
                      const reserved = items.reduce((acc, cur) => acc + (Number(cur.reserved_qty) || 0), 0);
                      return total - reserved;
                    })()} шт.
                  </div>
                </div>
              ))}
            </div>
          )}

          {addItemSearch.trim() && addItemSearchResults.length === 0 && !addItemSelectedNom && (
            <div style={{ padding: '12px 16px', textAlign: 'center', color: '#3a5a6a', fontSize: '0.8rem', fontWeight: 700, background: 'rgba(6,182,212,0.04)', borderRadius: '10px', border: '1px solid rgba(6,182,212,0.1)' }}>
              Нічого не знайдено
            </div>
          )}

          {addItemSelectedNom && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              background: 'rgba(6,182,212,0.1)',
              border: '1.5px solid rgba(6,182,212,0.35)',
              borderRadius: '12px'
            }}>
              <CheckCircle2 size={16} color="#06b6d4" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{addItemSelectedNom.name}</div>
                <div style={{ fontSize: '0.65rem', color: '#06b6d4', fontWeight: 700, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {addItemSelectedNom.nomenclature_code && <span>Код: {addItemSelectedNom.nomenclature_code}</span>}
                  {addItemSelectedNom.description && <span style={{ color: '#a0aec0' }}>{addItemSelectedNom.description}</span>}
                </div>
              </div>
              <div style={{
                background: 'rgba(236,72,153,0.12)',
                border: '1px solid rgba(236,72,153,0.3)',
                borderRadius: '8px',
                padding: '4px 10px',
                fontSize: '0.75rem',
                fontWeight: 900,
                color: '#ec4899',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}>
                Вільний залишок: {(() => {
                  const items = (inventory || []).filter(i => String(i.nomenclature_id) === String(addItemSelectedNom.id));
                  const total = items.reduce((acc, cur) => acc + (Number(cur.total_qty) || 0), 0);
                  const reserved = items.reduce((acc, cur) => acc + (Number(cur.reserved_qty) || 0), 0);
                  return total - reserved;
                })()} шт.
              </div>
              <button onClick={() => { setAddItemSelectedNom(null); setAddItemSearch('') }} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', padding: '2px' }}>
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Quantity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '0.65rem', fontWeight: 900, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: '1px' }}>Кількість</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setAddItemQty(q => Math.max(1, Number(q) - 1))}
              style={{ width: '40px', height: '40px', background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: '10px', color: '#06b6d4', fontSize: '1.2rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(6,182,212,0.18)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(6,182,212,0.08)'}
            >−</button>
            <input
              type="number"
              min="1"
              value={addItemQty}
              onChange={e => setAddItemQty(Math.max(1, Number(e.target.value) || 1))}
              style={{
                flex: 1,
                padding: '10px',
                background: 'rgba(6,182,212,0.06)',
                border: '1.5px solid rgba(6,182,212,0.2)',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '1.2rem',
                fontWeight: 1000,
                textAlign: 'center',
                outline: 'none'
              }}
            />
            <button
              onClick={() => setAddItemQty(q => Number(q) + 1)}
              style={{ width: '40px', height: '40px', background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: '10px', color: '#06b6d4', fontSize: '1.2rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(6,182,212,0.18)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(6,182,212,0.08)'}
            >+</button>
            {addItemSelectedNom?.unit && (
              <span style={{ fontSize: '0.75rem', color: '#3a6a7a', fontWeight: 800 }}>{addItemSelectedNom.unit}</span>
            )}
          </div>
        </div>

        {/* Confirm */}
        <button
          disabled={!addItemSelectedNom || !addItemQty || Number(addItemQty) <= 0}
          onClick={() => onConfirmAddItem(addItemSelectedNom, addItemQty, addItemCategoryKey)}
          style={{
            padding: '15px',
            background: addItemSelectedNom
              ? 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)'
              : 'rgba(255,255,255,0.04)',
            border: 'none',
            borderRadius: '14px',
            color: addItemSelectedNom ? '#fff' : '#333',
            fontSize: '0.9rem',
            fontWeight: 900,
            cursor: addItemSelectedNom ? 'pointer' : 'not-allowed',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            transition: 'all 0.3s',
            boxShadow: addItemSelectedNom ? '0 8px 24px rgba(6,182,212,0.35)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px'
          }}
          onMouseEnter={e => { if (addItemSelectedNom) e.currentTarget.style.transform = 'translateY(-2px)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
        >
          <Plus size={18} /> Додати до списку комплектування
        </button>
      </div>
    </div>
  )
}
