import React from 'react'

export const CutterSelectorRow = ({
  cutter,
  nomenclatures = [],
  inventory = [],
  selectedNomId,
  onSelectCutter,
  getMatchingCutters
}) => {
  const cutterKey = String(cutter.nomenclature_id || cutter.name)
  const categoryName = cutter.name
  const { matching, others, targetDia } = getMatchingCutters(categoryName, nomenclatures, inventory, cutter.nomenclature_id)

  const chosenNom = nomenclatures.find(n => String(n.id) === String(selectedNomId))
  const effectiveNomId = chosenNom ? chosenNom.id : null

  const invItem = effectiveNomId ? inventory.find(i =>
    (i.warehouse === 'operational' || !i.warehouse) &&
    String(i.nomenclature_id) === String(effectiveNomId)
  ) : null
  const available = invItem ? Math.max(0, (Number(invItem.total_qty) || 0) - (Number(invItem.reserved_qty) || 0)) : 0
  const isSufficient = chosenNom ? (available >= cutter.qty) : false

  const getStockForNom = (nomId) => {
    const inv = (inventory || []).find(i => (i.warehouse === 'operational' || !i.warehouse) && String(i.nomenclature_id) === String(nomId))
    return inv ? Math.max(0, (Number(inv.total_qty) || 0) - (Number(inv.reserved_qty) || 0)) : 0
  }

  const options = matching.length > 0 ? matching : others

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      padding: '12px 14px',
      background: 'linear-gradient(135deg, #0d1117, #080c14)',
      borderRadius: '14px',
      border: !chosenNom
        ? '1px solid rgba(234, 179, 8, 0.35)'
        : (isSufficient ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)'),
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>
      {/* Top Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span style={{ fontSize: '1rem' }}>✂️</span>
          <span style={{ color: '#fff', fontWeight: 950, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cutter.name}
          </span>
          <span style={{ fontSize: '0.62rem', color: '#38bdf8', background: 'rgba(56,189,248,0.12)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(56,189,248,0.3)', fontWeight: 800 }}>
            Тип фрези
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span style={{ color: '#ff9000', fontWeight: 950, fontSize: '0.9rem' }}>{cutter.qty} шт.</span>
          {chosenNom ? (
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: '6px',
              background: isSufficient ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
              color: isSufficient ? '#10b981' : '#ef4444',
              border: `1px solid ${isSufficient ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`
            }}>
              на СО: {available} шт.
            </span>
          ) : (
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: '6px',
              background: 'rgba(234,179,8,0.12)',
              color: '#eab308',
              border: '1px solid rgba(234,179,8,0.35)'
            }}>
              Оберіть модель
            </span>
          )}
        </div>
      </div>

      {/* Selector Row */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
        <label style={{ fontSize: '0.68rem', color: chosenNom ? '#38bdf8' : '#eab308', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
          {chosenNom ? `Обрана модель фрези (${cutter.name}):` : `⚠️ Оберіть конкретну модель фрези (${cutter.name}):`}
        </label>
        <select
          value={selectedNomId || ''}
          onChange={(e) => onSelectCutter(cutterKey, categoryName, e.target.value)}
          style={{
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            background: '#040810',
            color: chosenNom ? '#fff' : '#eab308',
            border: chosenNom ? '1px solid rgba(56, 189, 248, 0.45)' : '1px solid rgba(234, 179, 8, 0.5)',
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
          <option value="" style={{ background: '#0d1117', color: '#888' }}>
            -- Оберіть модель фрези для {cutter.name} --
          </option>
          {options.map(opt => {
            const optAvail = getStockForNom(opt.id)
            return (
              <option key={opt.id} value={opt.id} style={{ background: '#0d1117', color: '#fff' }}>
                {opt.name} — [на СО: {optAvail} шт.]
              </option>
            )
          })}
        </select>
      </div>
    </div>
  )
}

