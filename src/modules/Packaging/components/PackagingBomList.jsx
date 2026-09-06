import React from 'react'
import { Plus, CheckCircle2, Trash2, Hash, Layers, Wrench, FileArchive, Package, Box, AlertCircle } from 'lucide-react'
import { getBoxColor, getBestRequestForNomenclature } from '../utils/packagingHelpers'

export const PackagingBomList = ({
  categorizedBOM,
  hasAnyRequests,
  activeBatchData,
  orderRequests,
  excludedNomIds,
  setExcludedNomIds,
  boxNumbers,
  setBoxNumbers,
  customQty,
  setCustomQty,
  setCustomItems,
  onOpenAddItemModal
}) => {
  const getIconForType = (nom) => {
    const name = (nom.name || '').toLowerCase()
    const type = (nom.type || '').toLowerCase()
    if (name.includes('кріплення') || name.includes('друк') || name.includes('3д')) return <Layers size={16} color="#d97706" />
    if (name.includes('стійка')) return <Layers size={16} color="#7c3aed" />
    if (name.includes('гвинт') || name.includes('гайка') || type.includes('метиз') || type.includes('hardware') || type.includes('fastener')) return <Wrench size={16} color="#0891b2" />
    if (name.includes('накладка') || name.includes('тримач') || name.includes('упаковка') || name.includes('пакет') || name.includes('гума')) return <FileArchive size={16} color="#2563eb" />
    if (name.includes('-іп') || name.includes(' іп') || type.includes('part') || type.includes('деталь')) return <Package size={16} color="#e11d48" />
    return <Box size={16} color="var(--text-muted, #64748b)" />
  }

  const handleRemoveCustomItem = (nomId) => {
    setCustomItems(prev => prev.filter(ci => ci.nom.id !== nomId))
  }

  const allCategoriesEmpty = Object.values(categorizedBOM).every(c => c.items.length === 0)

  return (
    <>
      {Object.entries(categorizedBOM).map(([key, cat]) => {
        if (cat.items.length === 0 && hasAnyRequests) return null
        return (
          <div key={key} style={{ marginBottom: '35px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', borderBottom: `1px solid ${cat.color}33`, paddingBottom: '10px' }}>
              <div style={{ color: cat.color }}>{cat.icon}</div>
              <h4 style={{ margin: 0, fontSize: '0.85rem', color: cat.color, fontWeight: 900, letterSpacing: '1px' }}>{cat.title}</h4>
              <span style={{ marginLeft: 'auto', color: 'var(--text-muted, #64748b)', fontSize: '0.75rem', fontWeight: 800 }}>{cat.items.length} ПОЗИЦІЙ</span>
              {/* ─── Кнопка + Додати позицію ─── */}
              {!activeBatchData.isPackaged && (
                <button
                  onClick={() => onOpenAddItemModal(key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    background: `${cat.color}14`,
                    border: `1px solid ${cat.color}33`,
                    borderRadius: '8px',
                    color: cat.color,
                    fontSize: '0.7rem',
                    fontWeight: 900,
                    padding: '5px 10px',
                    cursor: 'pointer',
                    transition: '0.2s',
                    letterSpacing: '0.3px'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${cat.color}25`; e.currentTarget.style.borderColor = `${cat.color}66` }}
                  onMouseLeave={e => { e.currentTarget.style.background = `${cat.color}14`; e.currentTarget.style.borderColor = `${cat.color}33` }}
                >
                  <Plus size={12} /> ДОДАТИ
                </button>
              )}
            </div>

            {cat.items.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted, #64748b)', border: '1px dashed var(--border-color, #cbd5e1)', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                Немає позицій у цій категорії
              </div>
            ) : (
              <div className="bom-required-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
                {cat.items.map((item, idx) => {
                  const reqRequest = getBestRequestForNomenclature(orderRequests, item.nom.id)
                  const isPicked = reqRequest?.status === 'completed' || reqRequest?.status === 'issued'
                  const isPending = reqRequest?.status === 'pending'
                  const isExcluded = excludedNomIds.has(item.nom.id)
                  const canToggle = !hasAnyRequests && !activeBatchData.isPackaged && !isPicked
                  const boxNum = boxNumbers[String(item.nom.id)] || ''
                  const boxColor = getBoxColor(boxNum)
                  const hasBox = boxNum.trim() !== ''

                  return (
                    <div key={item.uid || idx} style={{
                      background: isExcluded 
                        ? 'var(--card-header-bg, #f1f5f9)' 
                        : (isPicked 
                            ? 'rgba(16, 185, 129, 0.08)' 
                            : (isPending 
                                ? 'rgba(234, 179, 8, 0.08)' 
                                : (item.isCustom ? 'rgba(6, 182, 212, 0.08)' : 'var(--card-bg, #ffffff)'))),
                      borderRadius: '16px',
                      border: `1.5px solid ${isExcluded ? 'var(--border-color, #e2e8f0)' : (hasBox && isPicked ? boxColor + '66' : (isPicked ? 'rgba(16, 185, 129, 0.4)' : (isPending ? 'rgba(234, 179, 8, 0.4)' : (item.isCustom ? 'rgba(6, 182, 212, 0.4)' : 'var(--border-color, #e2e8f0)'))))}`,
                      boxShadow: 'var(--shadow, 0 2px 8px rgba(0,0,0,0.04))',
                      transition: '0.25s',
                      overflow: 'hidden',
                      opacity: isExcluded ? 0.45 : 1,
                      position: 'relative'
                    }}>
                      {/* Custom badge */}
                      {item.isCustom && (
                        <div style={{
                          position: 'absolute', top: '6px', right: '6px',
                          background: 'rgba(6, 182, 212, 0.15)',
                          border: '1px solid rgba(6, 182, 212, 0.4)',
                          borderRadius: '6px',
                          color: '#0891b2',
                          fontSize: '0.55rem',
                          fontWeight: 900,
                          padding: '2px 6px',
                          letterSpacing: '0.5px'
                        }}>ДОДАНО</div>
                      )}

                      {/* Верхня частина — назва + кількість */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 14px 10px' }}>
                        {/* Чекбокс або статус */}
                        {!isPicked ? (
                          <div onClick={() => {
                            if (!canToggle) return
                            const ns = new Set(excludedNomIds)
                            ns.has(item.nom.id) ? ns.delete(item.nom.id) : ns.add(item.nom.id)
                            setExcludedNomIds(ns)
                          }} style={{ width: '22px', height: '22px', borderRadius: '6px', border: `2px solid ${isExcluded ? 'var(--border-color, #94a3b8)' : '#f43f5e'}`, background: isExcluded ? 'transparent' : '#f43f5e', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canToggle ? 'pointer' : 'not-allowed', flexShrink: 0, transition: '0.2s' }}>
                            {!isExcluded && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                          </div>
                        ) : (
                          <CheckCircle2 size={22} color="#059669" style={{ flexShrink: 0 }} />
                        )}

                        <div style={{ background: 'var(--card-header-bg, #f1f5f9)', border: '1px solid var(--border-color, #e2e8f0)', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {getIconForType(item.nom)}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            title={item.nom.name}
                            style={{
                              fontSize: '0.88rem',
                              fontWeight: 800,
                              color: 'var(--text, #0f172a)',
                              lineHeight: 1.25,
                              whiteSpace: 'normal',
                              overflowWrap: 'anywhere'
                            }}
                          >
                            {item.nom.name}
                            {item.nom.material_type && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748b)', marginLeft: '5px', fontWeight: 600 }}>({item.nom.material_type})</span>}
                          </div>
                          {item.nom.description && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748b)', marginTop: '2px', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.nom.description}>
                              {item.nom.description}
                            </div>
                          )}
                          <div style={{ fontSize: '0.62rem', color: isExcluded ? 'var(--text-muted, #94a3b8)' : (isPicked ? '#059669' : (isPending ? '#d97706' : (item.isCustom ? '#0891b2' : 'var(--text-muted, #64748b)'))), fontWeight: 900, textTransform: 'uppercase', marginTop: '2px' }}>
                            {isExcluded ? 'Виключено' : (isPicked ? 'Підтверджено складом' : (isPending ? 'В обробці' : (item.isCustom ? 'Додано пакувальником' : 'Очікує')))}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                          {/* Редаговане поле кількості — тільки до відправки запиту */}
                          {!hasAnyRequests && !isPicked && !activeBatchData.isPackaged && !isExcluded ? (
                            <>
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
                                  width: '100px',
                                  background: customQty[String(item.nom.id)] !== undefined && customQty[String(item.nom.id)] !== item.qty ? 'rgba(234, 179, 8, 0.15)' : 'var(--input-bg, #f8fafc)',
                                  border: `1.5px solid ${customQty[String(item.nom.id)] !== undefined && customQty[String(item.nom.id)] !== item.qty ? '#d97706' : 'var(--border-color, #cbd5e1)'}`,
                                  borderRadius: '8px',
                                  color: customQty[String(item.nom.id)] !== undefined && customQty[String(item.nom.id)] !== item.qty ? '#b45309' : 'var(--text, #0f172a)',
                                  fontSize: '1.1rem',
                                  fontWeight: 1000,
                                  padding: '4px 8px',
                                  textAlign: 'right',
                                  outline: 'none',
                                }}
                              />
                              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>{item.nom.unit || 'шт'}</div>
                              {customQty[String(item.nom.id)] !== undefined && customQty[String(item.nom.id)] !== item.qty && (
                                <div style={{ fontSize: '0.58rem', color: '#d97706', fontWeight: 900 }}>план: {item.qty}</div>
                              )}
                              {/* Кнопка видалення для кастомних позицій */}
                              {item.isCustom && !isPicked && !activeBatchData.isPackaged && (
                                <button
                                  onClick={e => { e.stopPropagation(); handleRemoveCustomItem(item.nom.id) }}
                                  title="Видалити позицію"
                                  style={{
                                    marginTop: '4px',
                                    background: 'rgba(244, 63, 94, 0.12)',
                                    border: '1px solid rgba(244, 63, 94, 0.3)',
                                    borderRadius: '6px',
                                    color: '#e11d48',
                                    cursor: 'pointer',
                                    padding: '3px 6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    fontSize: '0.6rem',
                                    fontWeight: 900
                                  }}
                                >
                                  <Trash2 size={10} /> ВИДАЛИТИ
                                </button>
                              )}
                            </>
                          ) : (
                            <div>
                              <div style={{ fontSize: '1.25rem', fontWeight: 1000, color: isExcluded ? 'var(--text-muted, #94a3b8)' : (isPicked ? '#059669' : (isPending ? '#d97706' : 'var(--text, #0f172a)')) }}>
                                {isPicked && reqRequest?.quantity
                                  ? reqRequest.quantity
                                  : (customQty[String(item.nom.id)] !== undefined ? customQty[String(item.nom.id)] : item.qty)}
                              </div>
                              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>{item.nom.unit || 'шт'}</div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Нижня частина — поле номера коробки (тільки якщо склад підтвердив) */}
                      {isPicked && !isExcluded && !activeBatchData.isPackaged && (
                        <div style={{ padding: '0 14px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Hash size={13} color="var(--text-muted, #64748b)" style={{ flexShrink: 0 }} />
                          <input
                            type="text"
                            value={boxNum}
                            onChange={e => setBoxNumbers(prev => ({ ...prev, [String(item.nom.id)]: e.target.value }))}
                            placeholder="Номер коробки..."
                            maxLength={20}
                            className="box-number-input"
                            style={{
                              flex: 1,
                              background: hasBox ? `${boxColor}18` : 'var(--input-bg, #f8fafc)',
                              border: `1.5px solid ${hasBox ? boxColor + '66' : 'var(--border-color, #cbd5e1)'}`,
                              borderRadius: '10px',
                              color: hasBox ? boxColor : 'var(--text, #0f172a)',
                              fontWeight: 900,
                              fontSize: '0.85rem',
                              padding: '8px 12px',
                              outline: 'none',
                              transition: '0.2s',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}
                          />
                          {hasBox && (
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: boxColor, flexShrink: 0, boxShadow: `0 0 8px ${boxColor}88` }} />
                          )}
                        </div>
                      )}

                      {/* Якщо вже запаковано — показуємо збережений номер */}
                      {isPicked && !isExcluded && activeBatchData.isPackaged && hasBox && (
                        <div style={{ padding: '0 14px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Hash size={13} color={boxColor} style={{ flexShrink: 0 }} />
                          <span style={{ fontSize: '0.85rem', fontWeight: 900, color: boxColor, letterSpacing: '0.5px' }}>Коробка {boxNum.toUpperCase()}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {allCategoriesEmpty && (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted, #64748b)', border: '2px dashed var(--border-color, #cbd5e1)', borderRadius: '20px' }}>
          <AlertCircle size={40} style={{ margin: '0 auto 15px', opacity: 0.3 }} />
          <div style={{ fontWeight: 800 }}>Специфікація порожня</div>
          <p style={{ fontSize: '0.75rem', marginTop: '10px' }}>Перевірте налаштування BOM для цього виробу</p>
        </div>
      )}
    </>
  )
}
