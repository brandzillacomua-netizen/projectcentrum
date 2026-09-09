import React from 'react'

export const CutterSelectorRow = ({
  cutter,
  nomenclatures = [],
  inventory = [],
  selectedNomId,
  onSelectCutter,
  getMatchingCutters,
  isLight = false
}) => {
  const cutterKey = String(cutter.nomenclature_id || cutter.name)
  const categoryName = cutter.name
  const { matching, others, targetDia } = getMatchingCutters(categoryName, nomenclatures, inventory, cutter.nomenclature_id)

  const chosenNom = nomenclatures.find(n => String(n.id) === String(selectedNomId))
  const effectiveNomId = chosenNom ? chosenNom.id : null

  const getStockForNom = (nomId, nomName) => {
    // Only explicitly operational warehouse rows — do NOT use !i.warehouse (pocket items have no warehouse set)
    const opItems = (inventory || []).filter(i => {
      const w = (i.warehouse || '').toLowerCase().trim()
      const isOp = w === 'operational' || w === 'склад оперативний'
      if (!isOp) return false
      const idMatch = nomId && String(i.nomenclature_id) === String(nomId)
      const nameMatch = nomName && i.name && i.name.trim().toLowerCase() === String(nomName).trim().toLowerCase()
      return idMatch || nameMatch
    })
    if (opItems.length > 0) {
      return Math.max(0, opItems.reduce((sum, item) => sum + (Number(item.total_qty) || 0) - (Number(item.reserved_qty) || 0), 0))
    }
    return 0
  }

  const available = effectiveNomId ? getStockForNom(effectiveNomId, chosenNom?.name) : 0
  const isSufficient = chosenNom ? (available >= cutter.qty) : false

  const options = matching.length > 0 ? matching : others

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      padding: '12px 14px',
      background: isLight ? '#f8fafc' : 'linear-gradient(135deg, #0d1117, #080c14)',
      borderRadius: '14px',
      border: isLight
        ? (!chosenNom ? '1.5px solid #f59e0b' : (isSufficient ? '1.5px solid #10b981' : '1.5px solid #ef4444'))
        : (!chosenNom
            ? '1px solid rgba(234, 179, 8, 0.35)'
            : (isSufficient ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)')),
      boxShadow: isLight ? '0 2px 8px rgba(0,0,0,0.06)' : '0 4px 12px rgba(0,0,0,0.3)',
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>
      {/* Top Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span style={{ fontSize: '1rem' }}>✂️</span>
          <span style={{ color: isLight ? '#0f172a' : '#fff', fontWeight: 950, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cutter.name}
          </span>
          <span style={{ 
            fontSize: '0.62rem', 
            color: isLight ? '#0284c7' : '#38bdf8', 
            background: isLight ? '#e0f2fe' : 'rgba(56,189,248,0.12)', 
            padding: '2px 8px', 
            borderRadius: '6px', 
            border: isLight ? '1px solid #bae6fd' : '1px solid rgba(56,189,248,0.3)', 
            fontWeight: 800 
          }}>
            Тип фрези
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span style={{ color: isLight ? '#d97706' : '#ff9000', fontWeight: 950, fontSize: '0.9rem' }}>{cutter.qty} шт.</span>
          {chosenNom ? (
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: '6px',
              background: isSufficient ? (isLight ? '#dcfce7' : 'rgba(16,185,129,0.15)') : (isLight ? '#fee2e2' : 'rgba(239,68,68,0.15)'),
              color: isSufficient ? (isLight ? '#15803d' : '#10b981') : (isLight ? '#b91c1c' : '#ef4444'),
              border: `1px solid ${isSufficient ? (isLight ? '#86efac' : 'rgba(16,185,129,0.4)') : (isLight ? '#fca5a5' : 'rgba(239,68,68,0.4)')}`
            }}>
              на СО: {available} шт.
            </span>
          ) : (
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: '6px',
              background: isLight ? '#fef3c7' : 'rgba(234,179,8,0.12)',
              color: isLight ? '#b45309' : '#eab308',
              border: isLight ? '1px solid #fde68a' : '1px solid rgba(234,179,8,0.35)'
            }}>
              Оберіть модель
            </span>
          )}
        </div>
      </div>

      {/* Selector Row */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
        <label style={{ 
          fontSize: '0.68rem', 
          color: chosenNom ? (isLight ? '#0284c7' : '#38bdf8') : (isLight ? '#b45309' : '#eab308'), 
          fontWeight: 900, 
          textTransform: 'uppercase', 
          letterSpacing: '0.3px' 
        }}>
          {chosenNom ? `Обрана модель фрези (${cutter.name}):` : `⚠️ Оберіть конкретну модель фрези (${cutter.name}):`}
        </label>
        <select
          value={selectedNomId || ''}
          onChange={(e) => onSelectCutter(cutterKey, categoryName, e.target.value)}
          style={{
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            background: isLight ? '#ffffff' : '#040810',
            color: chosenNom ? (isLight ? '#0f172a' : '#fff') : (isLight ? '#b45309' : '#eab308'),
            border: chosenNom 
              ? (isLight ? '1.5px solid #93c5fd' : '1px solid rgba(56, 189, 248, 0.45)') 
              : (isLight ? '1.5px solid #f59e0b' : '1px solid rgba(234, 179, 8, 0.5)'),
            borderRadius: '10px',
            padding: '9px 12px',
            fontSize: '0.8rem',
            fontWeight: 800,
            outline: 'none',
            cursor: 'pointer',
            boxSizing: 'border-box',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap'
          }}
        >
          <option value="" style={{ background: isLight ? '#ffffff' : '#0d1117', color: isLight ? '#64748b' : '#888' }}>
            -- Оберіть модель фрези для {cutter.name} --
          </option>
          {options.map(opt => {
            const optAvail = getStockForNom(opt.id, opt.name)
            return (
              <option key={opt.id} value={opt.id} style={{ background: isLight ? '#ffffff' : '#0d1117', color: isLight ? '#0f172a' : '#fff' }}>
                {opt.name} — [на СО: {optAvail} шт.]
              </option>
            )
          })}
        </select>
      </div>
    </div>
  )
}
