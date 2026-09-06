import React from 'react'
import { extractThicknessNumber } from '../../utils/masterHelpers'

export function MasterPrepModal({
  showPrepModal,
  setShowPrepModal,
  nomenclatures = [],
  inventory = [],
  prepQuantities = {},
  setPrepQuantities,
  prepDeadline,
  setPrepDeadline,
  handleCreatePrepOrder,
  isSubmitting
}) {
  if (!showPrepModal) return null

  const thicknessMap = {}
  ;(nomenclatures || []).forEach(n => {
    const itemName = (n.name || '').toLowerCase()
    const isSheet = /^\s*лист(?:\s|\()/i.test(itemName)
    if (!isSheet) return
    const isUnprepared = itemName.includes('непідготовлен')
    if (!isUnprepared) return

    const thickness = extractThicknessNumber(n.name) || 'Інше'
    if (!thicknessMap[thickness]) {
      thicknessMap[thickness] = { thickness, t300: null, t700: null, other: null }
    }

    const isT300 = itemName.includes('т300') || itemName.includes('t300')
    const isT700 = itemName.includes('т700') || itemName.includes('t700')

    if (isT300) {
      thicknessMap[thickness].t300 = n
    } else if (isT700) {
      thicknessMap[thickness].t700 = n
    } else {
      thicknessMap[thickness].other = n
    }
  })

  const sortedThicknesses = Object.keys(thicknessMap).sort((a, b) => {
    if (a === 'Інше') return 1
    if (b === 'Інше') return -1
    const thickA = parseFloat(a) || 0
    const thickB = parseFloat(b) || 0
    return thickA - thickB
  })

  const sheetStock = {
    operational: { prepared: {}, unprepared: {} },
    production: { prepared: {}, unprepared: {} }
  }

  ;(inventory || []).forEach(item => {
    const nomenclature = (nomenclatures || []).find(n => String(n.id) === String(item.nomenclature_id))
    const itemName = String(item.name || nomenclature?.name || '').toLowerCase()
    const isSheet = /^\s*лист(?:\s|\()/i.test(itemName)
    if (!isSheet) return

    const isUnprepared = itemName.includes('непідготовлен')
    const isPrepared = !isUnprepared && itemName.includes('підготовлен')
    if (!isPrepared && !isUnprepared) return

    const warehouseKey = item.warehouse === 'production'
      ? 'production'
      : ((item.warehouse === 'operational' || !item.warehouse) ? 'operational' : null)
    if (!warehouseKey) return

    const preparationKey = isPrepared ? 'prepared' : 'unprepared'
    const stockKey = String(item.nomenclature_id || itemName)
    const total = Number(item.total_qty) || 0
    const reserved = Number(item.reserved_qty) || 0
    const cleanName = String(item.name || nomenclature?.name || 'Лист')
      .replace(/\[\s*(?:не)?підготовлений\s*\]/gi, '')
      .replace(/\s*(?:не)?підготовлений\s*/gi, ' ')
      .trim()

    if (!sheetStock[warehouseKey][preparationKey][stockKey]) {
      sheetStock[warehouseKey][preparationKey][stockKey] = { id: stockKey, name: cleanName, total: 0, reserved: 0, free: 0 }
    }

    const stock = sheetStock[warehouseKey][preparationKey][stockKey]
    stock.total += total
    stock.reserved += reserved
    stock.free += Math.max(0, total - reserved)
  })

  const formatStock = value => new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 }).format(value)

  const getSheetThickness = name => {
    const match = String(name).match(/\((\d+(?:[.,]\d+)?)\s*мм\)/i)
    return match ? Number(match[1].replace(',', '.')) : Number.POSITIVE_INFINITY
  }

  const getSheetGrade = name => {
    const normalized = String(name).toLowerCase()
    if (normalized.includes('т300') || normalized.includes('t300')) return 300
    if (normalized.includes('т700') || normalized.includes('t700')) return 700
    return null
  }

  const sortSheetStock = (a, b) => {
    return getSheetThickness(a.name) - getSheetThickness(b.name)
      || a.name.localeCompare(b.name, 'uk', { numeric: true })
  }

  const renderQuantityInput = (entry, type, color) => {
    const nomenclature = entry[type]
    if (!nomenclature) {
      return <div style={{ color: '#333', textAlign: 'center', fontSize: '0.85rem' }}>—</div>
    }

    return (
      <input
        type="number"
        min="0"
        placeholder="0"
        value={prepQuantities[nomenclature.id] || ''}
        onChange={e => {
          const val = e.target.value
          setPrepQuantities(prev => ({
            ...prev,
            [nomenclature.id]: val === '' ? '' : Math.max(0, parseInt(val) || 0)
          }))
        }}
        style={{
          width: '100%',
          background: '#000',
          border: '1px solid #333',
          color,
          padding: '6px',
          borderRadius: '8px',
          fontSize: '1rem',
          fontWeight: 950,
          textAlign: 'center',
          outline: 'none'
        }}
      />
    )
  }

  const stockWarehouses = [
    {
      key: 'production',
      label: 'Склад виробництва',
      accent: '#0ea5e9',
      preparationTypes: [{ key: 'unprepared', label: 'Непідготовлені' }]
    },
    {
      key: 'operational',
      label: 'СО · Склад оперативний',
      accent: '#10b981',
      preparationTypes: [{ key: 'prepared', label: 'Підготовлені' }]
    }
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel" style={{ 
        background: '#0a0a0a', 
        padding: '30px', 
        borderRadius: '24px', 
        border: '1px solid #222', 
        width: 'calc(100vw - 32px)',
        maxWidth: '1600px',
        boxSizing: 'border-box',
        display: 'flex', 
        flexDirection: 'column', 
        maxHeight: '95vh',
        boxShadow: '0 10px 40px rgba(16,185,129,0.15)',
        overflowY: 'auto'
      }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '1.4rem', color: '#10b981', fontWeight: 900 }}>НАРЯД НА ПІДГОТОВКУ</h3>

        <div style={{ display: 'block', fontSize: '0.75rem', color: '#444', fontWeight: 800, textTransform: 'uppercase', marginBottom: '12px' }}>
          СИРОАВИНА (НЕПІДГОТОВЛЕНА)
        </div>

        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: '25px' }}>
          <div style={{ flex: '0.8 1 380px', display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '280px' }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1.2fr 1fr 1fr', 
              gap: '10px', 
              paddingBottom: '5px',
              borderBottom: '1px solid #222',
              fontSize: '0.7rem',
              fontWeight: 900,
              color: '#666',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              <div>Товщина</div>
              <div style={{ textAlign: 'center', color: '#22c55e' }}>Т300</div>
              <div style={{ textAlign: 'center', color: '#0ea5e9' }}>Т700</div>
            </div>
            
            {sortedThicknesses.map(thick => {
              const entry = thicknessMap[thick]
              return (
                <div key={thick} style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1.2fr 1fr 1fr', 
                  alignItems: 'center', 
                  gap: '10px', 
                  background: '#111',
                  padding: '6px 12px',
                  borderRadius: '10px',
                  border: '1px solid #1a1a1a'
                }}>
                  <span style={{ fontSize: '0.85rem', color: '#eee', fontWeight: 800 }}>Лист ({thick})</span>
                  <div>{renderQuantityInput(entry, 't300', '#22c55e')}</div>
                  <div>{renderQuantityInput(entry, 't700', '#0ea5e9')}</div>
                </div>
              )
            })}
          </div>

          <div style={{ flex: '2 1 760px', minWidth: '300px', background: '#0d0d0d', border: '1px solid #1f2937', borderRadius: '16px', padding: '16px', boxSizing: 'border-box' }}>
            <div style={{ fontSize: '0.75rem', color: '#a1a1aa', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>
              Наявність листів на складах
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px', alignItems: 'start' }}>
              {stockWarehouses.map(warehouse => (
                <div key={warehouse.key} style={{ background: '#111', border: '1px solid #202020', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid #242424', color: warehouse.accent, fontSize: '0.78rem', fontWeight: 950, textTransform: 'uppercase' }}>
                    {warehouse.label}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 1.4fr) repeat(3, minmax(58px, 0.7fr))', gap: '6px', padding: '8px 12px 5px', color: '#555', fontSize: '0.62rem', fontWeight: 900, textTransform: 'uppercase' }}>
                    <div>Стан листа</div>
                    <div style={{ textAlign: 'right' }}>Всього</div>
                    <div style={{ textAlign: 'right' }}>Резерв</div>
                    <div style={{ textAlign: 'right' }}>Вільно</div>
                  </div>
                  {warehouse.preparationTypes.map(preparation => {
                    const stockItems = Object.values(sheetStock[warehouse.key][preparation.key])
                      .sort(sortSheetStock)
                    const gradeGroups = [
                      { key: 't300', label: 'Т300', accent: '#22c55e', items: stockItems.filter(stock => getSheetGrade(stock.name) === 300) },
                      { key: 't700', label: 'Т700', accent: '#0ea5e9', items: stockItems.filter(stock => getSheetGrade(stock.name) === 700) },
                      { key: 'other', label: 'Інші', accent: '#a1a1aa', items: stockItems.filter(stock => getSheetGrade(stock.name) === null) }
                    ].filter(group => group.items.length > 0)
                    return (
                      <div key={preparation.key} style={{ borderTop: '1px solid #242424' }}>
                        <div style={{ padding: '7px 12px', color: '#a1a1aa', background: '#0d0d0d', fontSize: '0.66rem', fontWeight: 950, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {preparation.label}
                        </div>
                        {stockItems.length > 0 ? gradeGroups.map(group => (
                          <div key={group.key} style={{ borderTop: '1px solid #242424' }}>
                            <div style={{ padding: '7px 12px', color: group.accent, background: '#101010', fontSize: '0.7rem', fontWeight: 950, letterSpacing: '0.5px' }}>
                              {group.label}
                            </div>
                            {group.items.map(stock => (
                              <div key={stock.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 1.4fr) repeat(3, minmax(58px, 0.7fr))', gap: '6px', alignItems: 'center', padding: '8px 12px', borderTop: '1px solid #1d1d1d' }}>
                                <div title={stock.name} style={{ color: '#ddd', fontSize: '0.72rem', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stock.name}</div>
                                <div style={{ color: '#f4f4f5', textAlign: 'right', fontSize: '0.82rem', fontWeight: 900 }}>{formatStock(stock.total)}</div>
                                <div style={{ color: '#f59e0b', textAlign: 'right', fontSize: '0.82rem', fontWeight: 900 }}>{formatStock(stock.reserved)}</div>
                                <div style={{ color: '#22c55e', textAlign: 'right', fontSize: '0.82rem', fontWeight: 950 }}>{formatStock(stock.free)}</div>
                              </div>
                            ))}
                          </div>
                        )) : (
                          <div style={{ padding: '9px 12px', borderTop: '1px solid #1d1d1d', color: '#444', fontSize: '0.72rem' }}>Немає позицій</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '30px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', color: '#444', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>ДЕДЛАЙН</label>
          <input
            type="date"
            value={prepDeadline ? prepDeadline.split('T')[0] : ''}
            onChange={e => setPrepDeadline(e.target.value)}
            style={{ width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '1rem', fontWeight: 800 }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setShowPrepModal(false)} style={{ flex: 1, padding: '12px', background: '#222', color: '#555', border: 'none', borderRadius: '12px', fontWeight: 800, cursor: 'pointer' }}>СКАСУВАТИ</button>
          <button
            onClick={handleCreatePrepOrder}
            disabled={isSubmitting}
            style={{ flex: 2, padding: '12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 900, cursor: 'pointer' }}
          >
            {isSubmitting ? 'ЧЕКАЙТЕ...' : 'СТВОРИТИ'}
          </button>
        </div>
      </div>
    </div>
  )
}
