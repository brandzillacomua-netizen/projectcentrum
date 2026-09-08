import React, { useMemo } from 'react'
import { Plus, CheckCircle2, Trash2, Hash, Layers, Wrench, FileArchive, Package, Box, AlertCircle } from 'lucide-react'
import { getBoxColor, getBestRequestForNomenclature } from '../utils/packagingHelpers'

export const PackagingBomList = ({
  categorizedBOM,
  hasAnyRequests,
  activeBatchData,
  orderRequests,
  selectedNomIds,
  setSelectedNomIds,
  excludedNomIds,
  setExcludedNomIds,
  boxNumbers,
  setBoxNumbers,
  customQty,
  setCustomQty,
  setCustomItems,
  onOpenAddItemModal
}) => {
  const activeSelectedSet = selectedNomIds || excludedNomIds || new Set()

  const getIconForType = (nom) => {
    const name = (nom.name || '').toLowerCase()
    const type = (nom.type || '').toLowerCase()
    if (name.includes('кріплення') || name.includes('друк') || name.includes('3д')) return <Layers size={15} color="#d97706" />
    if (name.includes('стійка')) return <Layers size={15} color="#7c3aed" />
    if (name.includes('гвинт') || name.includes('гайка') || type.includes('метиз') || type.includes('hardware') || type.includes('fastener')) return <Wrench size={15} color="#0891b2" />
    if (name.includes('накладка') || name.includes('тримач') || name.includes('упаковка') || name.includes('пакет') || name.includes('гума')) return <FileArchive size={15} color="#2563eb" />
    if (name.includes('-іп') || name.includes(' іп') || type.includes('part') || type.includes('деталь')) return <Package size={15} color="#e11d48" />
    return <Box size={15} color="#64748b" />
  }

  const handleRemoveCustomItem = (nomId) => {
    setCustomItems(prev => prev.filter(ci => ci.nom.id !== nomId))
  }

  const allCategoriesEmpty = Object.values(categorizedBOM).every(c => c.items.length === 0)

  // ─── Всі елементи, які можна відзначати/знімати (ще не видані і не в обробці) ───
  const allToggleableItems = useMemo(() => {
    const list = []
    Object.values(categorizedBOM).forEach(cat => {
      cat.items.forEach(item => {
        const reqRequest = getBestRequestForNomenclature(orderRequests, item.nom.id)
        const isPicked = reqRequest?.status === 'completed' || reqRequest?.status === 'issued'
        const isPending = reqRequest?.status === 'pending'
        const canToggle = !hasAnyRequests && !activeBatchData.isPackaged && !isPicked && !isPending
        if (canToggle) {
          list.push(item)
        }
      })
    })
    return list
  }, [categorizedBOM, orderRequests, hasAnyRequests, activeBatchData])

  const allSelected = allToggleableItems.length > 0 && allToggleableItems.every(it => activeSelectedSet.has(it.nom.id))
  const someSelected = allToggleableItems.some(it => activeSelectedSet.has(it.nom.id))
  const isGlobalIndeterminate = someSelected && !allSelected

  // Глобальний перемикач (для всієї специфікації)
  const handleToggleAll = () => {
    if (allToggleableItems.length === 0) return
    const ns = new Set(activeSelectedSet)
    if (allSelected) {
      allToggleableItems.forEach(it => ns.delete(it.nom.id))
    } else {
      allToggleableItems.forEach(it => ns.add(it.nom.id))
    }
    if (setSelectedNomIds) setSelectedNomIds(ns)
    else if (setExcludedNomIds) setExcludedNomIds(ns)
  }

  // Елементи певної категорії, які можна перемикати
  const getCategoryToggleableItems = (catItems) => {
    return catItems.filter(item => {
      const reqRequest = getBestRequestForNomenclature(orderRequests, item.nom.id)
      const isPicked = reqRequest?.status === 'completed' || reqRequest?.status === 'issued'
      const isPending = reqRequest?.status === 'pending'
      return !hasAnyRequests && !activeBatchData.isPackaged && !isPicked && !isPending
    })
  }

  // Перемикач для конкретної категорії
  const handleToggleCategory = (catItems) => {
    const toggleable = getCategoryToggleableItems(catItems)
    if (toggleable.length === 0) return
    const ns = new Set(activeSelectedSet)
    const allInCatSelected = toggleable.every(it => ns.has(it.nom.id))
    if (allInCatSelected) {
      toggleable.forEach(it => ns.delete(it.nom.id))
    } else {
      toggleable.forEach(it => ns.add(it.nom.id))
    }
    if (setSelectedNomIds) setSelectedNomIds(ns)
    else if (setExcludedNomIds) setExcludedNomIds(ns)
  }

  let globalIndex = 0

  return (
    <div style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
      {/* 1C ERP TABULAR SECTION (ВІДОМІСТЬ КОМПЛЕКТУЮЧИХ) */}
      <div style={{
        background: '#ffffff',
        border: '1.5px solid #cbd5e1',
        borderRadius: '10px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', color: '#334155' }}>
              <th style={{ padding: '10px 8px', width: '38px', textAlign: 'center', fontWeight: 900, color: '#64748b' }}>№</th>
              
              {/* MASTER CHECKBOX IN HEADER */}
              <th style={{ padding: '6px 8px', width: '48px', textAlign: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                  <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 900 }}>ВКЛ</span>
                  {allToggleableItems.length > 0 && (
                    <div
                      onClick={handleToggleAll}
                      title={allSelected ? 'Зняти вибір з усіх позицій' : 'Обрати всі позиції наряду'}
                      style={{
                        width: '19px',
                        height: '19px',
                        borderRadius: '5px',
                        border: `1.5px solid ${allSelected || isGlobalIndeterminate ? '#0284c7' : '#cbd5e1'}`,
                        background: allSelected ? '#0284c7' : (isGlobalIndeterminate ? 'rgba(2, 132, 199, 0.15)' : '#ffffff'),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {allSelected && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      {isGlobalIndeterminate && (
                        <div style={{ width: '8px', height: '2px', background: '#0284c7', borderRadius: '1px' }} />
                      )}
                    </div>
                  )}
                </div>
              </th>

              <th style={{ padding: '10px 14px', fontWeight: 900 }}>Номенклатура матеріалу / комплектуючого</th>
              <th style={{ padding: '10px 14px', width: '130px', textAlign: 'right', fontWeight: 900 }}>Кількість</th>
              <th style={{ padding: '10px 12px', width: '160px', textAlign: 'center', fontWeight: 900 }}>Статус на складі</th>
              <th style={{ padding: '10px 12px', width: '170px', textAlign: 'center', fontWeight: 900 }}>№ Коробки</th>
              <th style={{ padding: '10px 8px', width: '50px', textAlign: 'center', fontWeight: 900 }}></th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(categorizedBOM).map(([key, cat]) => {
              if (cat.items.length === 0 && hasAnyRequests) return null

              const catToggleable = getCategoryToggleableItems(cat.items)
              const catAllSelected = catToggleable.length > 0 && catToggleable.every(it => activeSelectedSet.has(it.nom.id))
              const catSomeSelected = catToggleable.some(it => activeSelectedSet.has(it.nom.id))
              const catIndeterminate = catSomeSelected && !catAllSelected

              return (
                <React.Fragment key={key}>
                  {/* CATEGORY SECTION HEADER ROW WITH QUICK CATEGORY CHECKBOX */}
                  <tr style={{ background: '#f1f5f9', borderTop: '2px solid #cbd5e1', borderBottom: '1.5px solid #cbd5e1' }}>
                    <td colSpan={7} style={{ padding: '7px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {/* CATEGORY-LEVEL CHECKBOX */}
                          {catToggleable.length > 0 && (
                            <div
                              onClick={() => handleToggleCategory(cat.items)}
                              title={catAllSelected ? 'Зняти вибір з цієї категорії' : 'Обрати всю категорію'}
                              style={{
                                width: '19px',
                                height: '19px',
                                borderRadius: '5px',
                                border: `1.5px solid ${catAllSelected || catIndeterminate ? '#0284c7' : '#cbd5e1'}`,
                                background: catAllSelected ? '#0284c7' : (catIndeterminate ? 'rgba(2, 132, 199, 0.15)' : '#ffffff'),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                flexShrink: 0
                              }}
                            >
                              {catAllSelected && (
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                              {catIndeterminate && (
                                <div style={{ width: '8px', height: '2px', background: '#0284c7', borderRadius: '1px' }} />
                              )}
                            </div>
                          )}

                          <span style={{ color: cat.color, display: 'inline-flex', alignItems: 'center' }}>{cat.icon}</span>
                          <span style={{ fontSize: '0.84rem', fontWeight: 900, color: '#0f172a', letterSpacing: '0.3px' }}>
                            {cat.title}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>
                            ({cat.items.length} {cat.items.length === 1 ? 'позиція' : 'позицій'})
                          </span>

                          {catToggleable.length > 0 && (
                            <button
                              type="button"
                              onClick={() => handleToggleCategory(cat.items)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                padding: '2px 6px',
                                color: '#0284c7',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                textDecoration: 'underline'
                              }}
                            >
                              {catAllSelected ? 'зняти всі' : 'обрати всі'}
                            </button>
                          )}
                        </div>

                        {!activeBatchData.isPackaged && (
                          <button
                            type="button"
                            onClick={() => onOpenAddItemModal(key)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: '#ffffff',
                              border: '1.2px solid #cbd5e1',
                              borderRadius: '6px',
                              color: '#1e293b',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              padding: '4px 10px',
                              cursor: 'pointer',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = '#e2e8f0'
                              e.currentTarget.style.borderColor = '#94a3b8'
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = '#ffffff'
                              e.currentTarget.style.borderColor = '#cbd5e1'
                            }}
                          >
                            <Plus size={12} color="#0284c7" /> Додати до категорії
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* EMPTY CATEGORY MESSAGE */}
                  {cat.items.length === 0 ? (
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td colSpan={7} style={{ padding: '14px', textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem', fontStyle: 'italic' }}>
                        Немає позицій у цій категорії
                      </td>
                    </tr>
                  ) : (
                    cat.items.map((item) => {
                      globalIndex += 1
                      const reqRequest = getBestRequestForNomenclature(orderRequests, item.nom.id)
                      const isPicked = reqRequest?.status === 'completed' || reqRequest?.status === 'issued'
                      const isPending = reqRequest?.status === 'pending'
                      const isChecked = activeSelectedSet.has(item.nom.id)
                      const canToggle = !hasAnyRequests && !activeBatchData.isPackaged && !isPicked && !isPending
                      const boxNum = boxNumbers[String(item.nom.id)] || ''
                      const boxColor = getBoxColor(boxNum)
                      const hasBox = boxNum.trim() !== ''

                      return (
                        <tr
                          key={item.uid || item.nom.id}
                          style={{
                            borderBottom: '1px solid #e2e8f0',
                            background: '#ffffff',
                            transition: 'background 0.1s'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = '#f8fafc'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = '#ffffff'
                          }}
                        >
                          {/* 1. № ПОРЯДКОВИЙ */}
                          <td style={{ padding: '9px 8px', textAlign: 'center', color: '#64748b', fontWeight: 700, fontSize: '0.75rem' }}>
                            {globalIndex}
                          </td>

                          {/* 2. ЧЕКБОКС ВКЛЮЧЕННЯ / ГАЛОЧКА */}
                          <td style={{ padding: '9px 8px', textAlign: 'center' }}>
                            {!isPicked ? (
                              <div
                                onClick={() => {
                                  if (!canToggle) return
                                  const ns = new Set(activeSelectedSet)
                                  if (ns.has(item.nom.id)) {
                                    ns.delete(item.nom.id)
                                  } else {
                                    ns.add(item.nom.id)
                                  }
                                  if (setSelectedNomIds) setSelectedNomIds(ns)
                                  else if (setExcludedNomIds) setExcludedNomIds(ns)
                                }}
                                title={canToggle ? (isChecked ? 'Зняти вибір' : 'Обрати для запиту ТМЦ') : ''}
                                style={{
                                  width: '20px',
                                  height: '20px',
                                  margin: '0 auto',
                                  borderRadius: '5px',
                                  border: `1.5px solid ${isChecked ? '#0284c7' : '#cbd5e1'}`,
                                  background: isChecked ? '#0284c7' : '#ffffff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: canToggle ? 'pointer' : 'not-allowed',
                                  transition: '0.15s',
                                  boxShadow: isChecked ? '0 1px 3px rgba(2,132,199,0.25)' : 'none'
                                }}
                              >
                                {isChecked && (
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                )}
                              </div>
                            ) : (
                              <CheckCircle2 size={20} color="#059669" style={{ margin: '0 auto' }} />
                            )}
                          </td>

                          {/* 3. НАЙМЕНУВАННЯ КОМПЛЕКТУЮЧОГО */}
                          <td style={{ padding: '9px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{
                                background: '#f1f5f9',
                                border: '1px solid #e2e8f0',
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                {getIconForType(item.nom)}
                              </div>

                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.85rem' }}>
                                    {item.nom.name}
                                  </span>
                                  {item.nom.material_type && (
                                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>
                                      ({item.nom.material_type})
                                    </span>
                                  )}
                                  {item.isCustom && (
                                    <span style={{
                                      background: '#ecfeff',
                                      border: '1px solid #a5f3fc',
                                      borderRadius: '4px',
                                      color: '#0891b2',
                                      fontSize: '0.58rem',
                                      fontWeight: 900,
                                      padding: '1px 5px',
                                      letterSpacing: '0.3px'
                                    }}>
                                      ДОДАНО
                                    </span>
                                  )}
                                </div>

                                {item.nom.description && (
                                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '1px' }}>
                                    {item.nom.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* 4. КІЛЬКІСТЬ (РЕДАГОВАНА ЧИ ФІКСОВАНА) */}
                          <td style={{ padding: '9px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {!hasAnyRequests && !isPicked && !activeBatchData.isPackaged ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                <input
                                  type="number"
                                  min="0"
                                  value={
                                    item.isCustom
                                      ? (customQty[String(item.nom.id)] !== undefined ? customQty[String(item.nom.id)] : item.qty)
                                      : (customQty[String(item.nom.id)] !== undefined ? customQty[String(item.nom.id)] : item.qty)
                                  }
                                  onChange={e => {
                                    const val = e.target.value === '' ? '' : Number(e.target.value)
                                    setCustomQty(prev => ({ ...prev, [String(item.nom.id)]: val }))
                                    if (item.isCustom) {
                                      setCustomItems(prev => prev.map(ci =>
                                        ci.uid === item.uid ? { ...ci, qty: Number(val) || 1 } : ci
                                      ))
                                    }
                                  }}
                                  onClick={e => e.stopPropagation()}
                                  style={{
                                    width: '84px',
                                    background: customQty[String(item.nom.id)] !== undefined && customQty[String(item.nom.id)] !== item.qty ? '#fffbeb' : '#ffffff',
                                    border: `1.5px solid ${customQty[String(item.nom.id)] !== undefined && customQty[String(item.nom.id)] !== item.qty ? '#d97706' : '#cbd5e1'}`,
                                    borderRadius: '6px',
                                    color: customQty[String(item.nom.id)] !== undefined && customQty[String(item.nom.id)] !== item.qty ? '#b45309' : '#0f172a',
                                    fontSize: '0.9rem',
                                    fontWeight: 900,
                                    padding: '3px 6px',
                                    textAlign: 'right',
                                    outline: 'none'
                                  }}
                                />
                                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>
                                  {item.nom.unit || 'шт'}
                                </span>
                              </div>
                            ) : (
                              <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: '4px' }}>
                                <span style={{
                                  fontSize: '0.95rem',
                                  fontWeight: 900,
                                  color: isPicked ? '#059669' : (isPending ? '#d97706' : '#0f172a')
                                }}>
                                  {isPicked && reqRequest?.quantity
                                    ? reqRequest.quantity
                                    : (customQty[String(item.nom.id)] !== undefined ? customQty[String(item.nom.id)] : item.qty)}
                                </span>
                                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>
                                  {item.nom.unit || 'шт'}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* 5. СТАТУС СКЛАДСЬКОГО ЗАБЕЗПЕЧЕННЯ */}
                          <td style={{ padding: '9px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {isPicked ? (
                              <span style={{
                                background: '#f0fdf4',
                                color: '#15803d',
                                border: '1px solid #bbf7d0',
                                borderRadius: '5px',
                                padding: '3px 8px',
                                fontSize: '0.68rem',
                                fontWeight: 900
                              }}>
                                ВИДАНО СКЛАДОМ
                              </span>
                            ) : isPending ? (
                              <span style={{
                                background: '#eff6ff',
                                color: '#1d4ed8',
                                border: '1px solid #bfdbfe',
                                borderRadius: '5px',
                                padding: '3px 8px',
                                fontSize: '0.68rem',
                                fontWeight: 900
                              }}>
                                В ОБРОБЦІ НА СКЛАДІ
                              </span>
                            ) : isChecked ? (
                              <span style={{
                                background: '#f0fdf4',
                                color: '#15803d',
                                border: '1px solid #86efac',
                                borderRadius: '5px',
                                padding: '3px 8px',
                                fontSize: '0.68rem',
                                fontWeight: 900
                              }}>
                                ОБРАНО ДО ЗАПИТУ
                              </span>
                            ) : (
                              <span style={{
                                background: '#f8fafc',
                                color: '#64748b',
                                border: '1px solid #cbd5e1',
                                borderRadius: '5px',
                                padding: '3px 8px',
                                fontSize: '0.68rem',
                                fontWeight: 700
                              }}>
                                НЕ ОБРАНО
                              </span>
                            )}
                          </td>

                          {/* 6. НОМЕР КОРОБКИ ДЛЯ ПАКУВАННЯ */}
                          <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                            {isPicked && !activeBatchData.isPackaged ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', maxWidth: '140px' }}>
                                <input
                                  type="text"
                                  value={boxNum}
                                  onChange={e => setBoxNumbers(prev => ({ ...prev, [String(item.nom.id)]: e.target.value }))}
                                  placeholder="№ кор..."
                                  maxLength={20}
                                  style={{
                                    width: '100%',
                                    background: hasBox ? `${boxColor}15` : '#ffffff',
                                    border: `1.5px solid ${hasBox ? boxColor : '#cbd5e1'}`,
                                    borderRadius: '6px',
                                    color: hasBox ? boxColor : '#0f172a',
                                    fontWeight: 900,
                                    fontSize: '0.78rem',
                                    padding: '4px 8px',
                                    textAlign: 'center',
                                    outline: 'none',
                                    textTransform: 'uppercase'
                                  }}
                                />
                                {hasBox && (
                                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: boxColor, flexShrink: 0 }} />
                                )}
                              </div>
                            ) : isPicked && activeBatchData.isPackaged && hasBox ? (
                              <span style={{
                                background: `${boxColor}15`,
                                border: `1.5px solid ${boxColor}`,
                                color: boxColor,
                                borderRadius: '6px',
                                padding: '3px 8px',
                                fontWeight: 900,
                                fontSize: '0.75rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                <Hash size={11} color={boxColor} /> {boxNum.toUpperCase()}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>—</span>
                            )}
                          </td>

                          {/* 7. ДІЇ (ВИДАЛИТИ КАСТОМНУ ПОЗИЦІЮ) */}
                          <td style={{ padding: '9px 8px', textAlign: 'center' }}>
                            {item.isCustom && !isPicked && !activeBatchData.isPackaged ? (
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation()
                                  handleRemoveCustomItem(item.nom.id)
                                }}
                                title="Видалити додану позицію"
                                style={{
                                  background: '#fff1f2',
                                  border: '1px solid #fecdd3',
                                  borderRadius: '5px',
                                  color: '#e11d48',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {allCategoriesEmpty && (
        <div style={{ padding: '50px', textAlign: 'center', color: '#64748b', border: '2px dashed #cbd5e1', borderRadius: '12px', background: '#f8fafc', marginTop: '15px' }}>
          <AlertCircle size={36} style={{ margin: '0 auto 12px', opacity: 0.4, color: '#64748b' }} />
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>Специфікація порожня</div>
          <p style={{ fontSize: '0.75rem', marginTop: '4px', color: '#64748b' }}>Для цього виробу немає позицій у BOM або не призначено комплектуючі</p>
        </div>
      )}
    </div>
  )
}
