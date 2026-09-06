import React from 'react'
import { X, Info } from 'lucide-react'
import { MasterStockInfoModal } from './MasterStockInfoModal'

export function MasterNaryadModal({
  activeNaryadOrder,
  setActiveNaryadOrder,
  isReprintMode,
  reprintTask,
  setReprintTask,
  naryadQtys,
  setNaryadQtys,
  naryadDeadline,
  setNaryadDeadline,
  useStockBZ,
  setUseStockBZ,
  partBZOverrides,
  setPartBZOverrides,
  isPartBZActive,
  rowMachines,
  rowMachinesSplits,
  materialSplits,
  selectedCutters,
  setSelectedCutters,
  partCutterOverrides,
  setPartCutterOverrides,
  nomenclatures = [],
  inventory = [],
  tasks = [],
  machineOperations = [],
  requests = [],
  getBatchSuffix,
  productNames,
  materialSummary = [],
  isSheetDistributionComplete,
  isPrintDisabled,
  isSubmitting,
  handlePrint,
  handleShowStockInfo,
  handleSplitChange,
  getPlannedQty,
  getDisplayPartsForOrderItem,
  partSearchQueries,
  setPartSearchQueries,
  openDropdownRowKey,
  setOpenDropdownRowKey,
  naryadParts,
  setNaryadParts,
  setSearchParams,
  stockInfoModalData,
  setStockInfoModalData,
  theme
}) {
  if (!activeNaryadOrder) return null
  const isLight = theme === 'light'

  return (
    <div className="worksheet-modal-overlay print-target" style={{ position: 'fixed', inset: 0, background: isLight ? 'rgba(15, 23, 42, 0.6)' : 'rgba(0,0,0,0.92)', backdropFilter: isLight ? 'blur(4px)' : 'none', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '15px' }}>
      <div className="worksheet-panel glass-panel" style={{ background: isLight ? '#ffffff' : '#0a0a0a', width: '100%', maxWidth: '1300px', maxHeight: '100vh', borderRadius: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: isLight ? '1px solid #cbd5e1' : '1px solid #222', boxShadow: isLight ? '0 25px 50px -12px rgba(0, 0, 0, 0.25)' : 'none' }}>

        <div className="worksheet-header-area" style={{ padding: '35px 45px', background: isLight ? '#ffffff' : '#0a0a0a', borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <h2 className="doc-ti" style={{ margin: 0, fontSize: '1.8rem', color: isLight ? '#f97316' : '#ff9000', fontWeight: 950, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '15px' }}>
                  НАРЯД № {activeNaryadOrder.order_num}
                  {getBatchSuffix()}
                  <button
                    type="button"
                    onClick={() => {
                      const url = new URL(window.location.href)
                      url.searchParams.delete('order')
                      url.searchParams.delete('task')
                      if (reprintTask?.id) {
                        url.searchParams.set('task', reprintTask.id)
                      } else {
                        url.searchParams.set('order', activeNaryadOrder.id)
                      }
                      navigator.clipboard.writeText(url.toString())
                      alert('Посилання скопійовано!')
                    }}
                    style={{
                      background: isLight ? '#f1f5f9' : 'rgba(255, 144, 0, 0.1)',
                      border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 144, 0, 0.3)',
                      color: isLight ? '#475569' : '#ff9000',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 900,
                      cursor: 'pointer',
                      marginLeft: '10px'
                    }}
                    className="no-print"
                  >
                    Копіювати посилання
                  </button>
                </h2>
              </div>
              <button onClick={() => {
                setActiveNaryadOrder(null);
                setSearchParams({});
              }} className="no-print" style={{ background: isLight ? '#f1f5f9' : '#111', border: isLight ? '1px solid #e2e8f0' : '1px solid #222', color: isLight ? '#64748b' : '#555', cursor: 'pointer', width: '45px', height: '45px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={24} /></button>
            </div>

            <div style={{ background: isLight ? '#f8fafc' : '#111', padding: '20px 25px', borderRadius: '20px', border: isLight ? '1px solid #e2e8f0' : '1px solid #1a1a1a' }} className="print-info-box">
              <div className="print-prod-info" style={{ fontSize: '1.25rem', color: isLight ? '#0f172a' : '#fff', fontWeight: 1000, marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '4px', height: '24px', background: isLight ? '#f97316' : '#ff9000', borderRadius: '2px' }} className="no-print"></div>
                ВИРІБ: <span style={{ color: isLight ? '#0f172a' : '#ff9000' }}>{productNames || '—'}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '25px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <span style={{ fontSize: '0.65rem', color: isLight ? '#64748b' : '#555', fontWeight: 900, textTransform: 'uppercase' }}>ЗАМОВНИК</span>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: isLight ? '#0f172a' : '#eee' }}>{activeNaryadOrder.customer}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <span style={{ fontSize: '0.65rem', color: isLight ? '#64748b' : '#555', fontWeight: 900, textTransform: 'uppercase' }}>ДАТА ФОРМУВАННЯ</span>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: isLight ? '#0f172a' : '#eee' }}>{new Date().toLocaleDateString('uk-UA')}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <span style={{ fontSize: '0.65rem', color: isLight ? '#64748b' : '#555', fontWeight: 900, textTransform: 'uppercase' }}>ДЕДЛАЙН НА ЦЮ ПАРТІЮ</span>
                  <div className="no-print">
                    <input
                      type="date"
                      value={naryadDeadline ? naryadDeadline.split('T')[0] : ''}
                      onChange={(e) => setNaryadDeadline(e.target.value)}
                      style={{ background: isLight ? '#ffffff' : '#111', border: isLight ? '1px solid #cbd5e1' : '1px solid #333', color: isLight ? '#0f172a' : '#fff', padding: '5px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 800 }}
                    />
                  </div>
                  <span className="print-only" style={{ fontSize: '1rem', fontWeight: 800, color: isLight ? '#0f172a' : '#eee' }}>
                    {(isReprintMode && reprintTask)
                      ? (reprintTask.planned_deadline ? new Date(reprintTask.planned_deadline).toLocaleDateString('uk-UA') : '—')
                      : (naryadDeadline ? new Date(naryadDeadline).toLocaleDateString('uk-UA') : '—')}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }} className="no-print">
                  <span style={{ fontSize: '0.65rem', color: isLight ? '#64748b' : '#555', fontWeight: 900, textTransform: 'uppercase' }}>ВИКОРИСТОВУВАТИ БЗ</span>
                  <button
                    type="button"
                    onClick={() => {
                      setUseStockBZ(prev => !prev)
                      setPartBZOverrides({})
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      background: isLight ? '#f1f5f9' : '#0a0a0a',
                      border: `1px solid ${useStockBZ ? (isLight ? '#f9731677' : '#ff900055') : (isLight ? '#cbd5e1' : '#222')}`,
                      padding: '6px 12px',
                      borderRadius: '12px',
                      outline: 'none'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(useStockBZ)}
                      onChange={() => {}}
                      style={{ accentColor: isLight ? '#f97316' : '#ff9000', width: '17px', height: '17px', cursor: 'pointer', pointerEvents: 'none' }}
                    />
                    <span style={{ fontSize: '0.85rem', fontWeight: 900, color: useStockBZ ? (isLight ? '#f97316' : '#ff9000') : (isLight ? '#64748b' : '#666') }}>
                      {useStockBZ ? 'Враховувати БЗ зі складу' : 'Всюди 0 в колонці БЗ'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <style>{`
          .worksheet-scrollable::-webkit-scrollbar {
            width: 7px;
          }
          .worksheet-scrollable::-webkit-scrollbar-track {
            background: transparent;
          }
          .worksheet-scrollable::-webkit-scrollbar-thumb {
            background: ${isLight ? '#cbd5e1' : '#333333'};
            border-radius: 999px;
          }
          .worksheet-scrollable::-webkit-scrollbar-thumb:hover {
            background: ${isLight ? '#94a3b8' : '#555555'};
          }
        `}</style>
        <div className="worksheet-scrollable" style={{ flex: 1, overflowY: 'auto', padding: '30px 40px', scrollBehavior: 'smooth' }}>

          <div className="table-responsive-container" style={{ marginBottom: '35px' }}>
            <table className="print-table screen-only-table no-print" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: isLight ? '#f8fafc' : '#111', textAlign: 'left', color: isLight ? '#475569' : '#555' }} className="print-thr">
                  <th style={{ padding: '12px 8px', width: '30%', minWidth: '170px', borderBottom: isLight ? '1.5px solid #e2e8f0' : '1.5px solid #222' }} className="col-name">ДЕТАЛЬ В РОЗКРІЙ</th>
                  <th style={{ padding: '12px 4px', textAlign: 'center', width: '5%' }} className="no-print">ПОТРЕБА</th>
                  <th style={{ padding: '12px 4px', textAlign: 'center', width: '5%' }} className="no-print">СКЛАД БЗ</th>
                  <th style={{ padding: '12px 4px', textAlign: 'center', width: '5%', color: isLight ? '#f97316' : '#ff9000' }} className="col-plan">ПЛАН</th>
                  <th style={{ padding: '12px 6px', textAlign: 'center', width: '12%' }} className="col-material">МАТЕРІАЛ</th>
                  <th style={{ padding: '12px 4px', textAlign: 'center', width: '4%' }} className="col-qty-sh">ШТ/Л</th>
                  <th style={{ padding: '12px 4px', textAlign: 'center', width: '11%', color: isLight ? '#9333ea' : '#a855f7' }} className="col-sheets-total">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                      ЗАГАЛОМ ЛИСТІВ
                      <button
                        type="button"
                        onClick={handleShowStockInfo}
                        title="Показати залишки на складі СО"
                        style={{
                          background: isLight ? 'rgba(147, 51, 234, 0.1)' : 'linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(124, 58, 237, 0.3) 100%)',
                          border: isLight ? '1px solid rgba(147, 51, 234, 0.3)' : '1px solid rgba(168, 85, 247, 0.5)',
                          borderRadius: '50%',
                          color: isLight ? '#9333ea' : '#d8b4fe',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '20px',
                          height: '20px',
                          outline: 'none',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          marginLeft: '2px',
                          verticalAlign: 'middle'
                        }}
                      >
                        <Info size={11} style={{ strokeWidth: 2.5 }} />
                      </button>
                    </div>
                  </th>
                  <th style={{ padding: '12px 4px', textAlign: 'center', width: '9%', color: isLight ? '#16a34a' : '#22c55e' }} className="col-sheets">ЛИСТІВ Т300</th>
                  <th style={{ padding: '12px 4px', textAlign: 'center', width: '9%', color: isLight ? '#0284c7' : '#0ea5e9' }} className="col-sheets-t700">ЛИСТІВ Т700</th>
                  <th style={{ padding: '12px 4px', textAlign: 'center', width: '4%', color: isLight ? '#f97316' : '#ff9000' }} className="col-bz">БЗ</th>
                </tr>
              </thead>
              <tbody>
                {activeNaryadOrder.isVirtualDraft && !isReprintMode && (
                  <tr className="no-print" style={{ borderBottom: '1px solid #1a1a1a' }}>
                    <td colSpan={11} style={{ padding: '12px 15px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const firstPart = nomenclatures.find(n => n.type === 'part') || nomenclatures[0]
                          const newItemId = 'draft-item-' + Date.now()
                          setActiveNaryadOrder(prev => {
                            const nextItems = [...(prev.order_items || [])]
                            nextItems.push({
                              id: newItemId,
                              order_id: prev.id,
                              nomenclature_id: firstPart?.id,
                              quantity: 1,
                              nomenclature: firstPart
                            })
                            return { ...prev, order_items: nextItems }
                          })
                          setNaryadQtys(prev => ({
                            ...prev,
                            [newItemId]: 1
                          }))
                          setNaryadParts(prev => ({
                            ...prev,
                            [newItemId]: [{
                              nom: firstPart,
                              quantity_per_parent: 1
                            }]
                          }))
                        }}
                        style={{
                          background: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          color: '#10b981',
                          padding: '8px 16px',
                          borderRadius: '10px',
                          fontSize: '0.8rem',
                          fontWeight: 900,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.2s'
                        }}
                      >
                        ➕ Додати деталь в розкрій
                      </button>
                    </td>
                  </tr>
                )}
                {activeNaryadOrder.order_items?.map(it => {
                  const nom = nomenclatures.find(n => n.id === it.nomenclature_id)
                  const thisNaryadQty = isReprintMode ? Number(it.quantity) : (naryadQtys[it.id] || 0)
                  if (thisNaryadQty <= 0) return null

                  if (activeNaryadOrder.isPrepOrder) {
                    return (
                      <tr key={it.id} style={{ borderBottom: '1px solid #1a1a1a' }} className="print-tr">
                        <td style={{ padding: '18px 15px' }} className="col-name">
                          <div style={{ fontWeight: 1000, color: '#fff', fontSize: '1rem', letterSpacing: '-0.01em' }} className="print-txt">{nom?.name || '—'}</div>
                          {nom?.nomenclature_code && (
                            <div style={{ fontSize: '0.6rem', color: '#444', fontWeight: 900, marginTop: '3px', textTransform: 'uppercase' }} className="print-subtxt">{nom.nomenclature_code}</div>
                          )}
                        </td>
                        <td style={{ padding: '18px 15px', textAlign: 'center', fontSize: '0.85rem', color: '#aaa', fontWeight: 800 }} className="no-print">
                          PREP-TERM
                        </td>
                        <td style={{ padding: '18px 15px', textAlign: 'center', fontSize: '1.1rem', color: '#fff', fontWeight: 900 }} className="no-print">
                          {thisNaryadQty.toString()}
                        </td>
                        <td style={{ padding: '18px 15px', textAlign: 'center', color: '#555', fontSize: '0.85rem' }} className="no-print">
                          —
                        </td>
                        <td style={{ padding: '18px 15px', textAlign: 'center', fontSize: '1.2rem', color: '#ff9000', fontWeight: 1000 }} className="col-plan">
                          {thisNaryadQty.toString()}
                        </td>
                        <td style={{ padding: '18px 15px', textAlign: 'center' }} className="col-material">
                          <div style={{ fontSize: '0.85rem', color: '#aaa', fontWeight: 700 }} className="print-subtxt">{nom?.name || '—'}</div>
                        </td>
                        <td style={{ padding: '18px 15px', textAlign: 'center', color: '#555', fontSize: '0.9rem' }} className="col-qty-sh">
                          1
                        </td>
                        <td style={{ padding: '18px 15px', textAlign: 'center', fontWeight: 1000, color: '#22c55e', fontSize: '1.4rem' }} className="col-sheets print-accent-g">
                          {thisNaryadQty.toString()}
                        </td>
                        <td style={{ padding: '18px 15px', textAlign: 'center', fontSize: '1rem', color: '#ff9000', fontWeight: 900 }} className="col-bz">
                          0
                        </td>
                      </tr>
                    )
                  }

                  const displayParts = getDisplayPartsForOrderItem(it)

                  const rows = displayParts.map((part, pIdx) => {
                    const snapshot = reprintTask?.plan_snapshot?.[String(part.nom?.id)]

                    const totalNeeded = snapshot ? snapshot.need : (thisNaryadQty * (Number(part.quantity_per_parent) || 1))
                    const availableBZ = (() => {
                      const bzInv = inventory.find(i => String(i.nomenclature_id) === String(part.nom?.id) && i.type === 'bz' && (!i.pocket_owner || i.pocket_owner === 'Не вказано'))
                      return bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0
                    })()
                    const isPartActiveBZ = isPartBZActive(part.nom?.id)
                    const inStock = snapshot ? (snapshot.stock || 0) : (isPartActiveBZ ? Math.min(totalNeeded, availableBZ) : 0)
                    const totalToProduce = snapshot ? snapshot.plan : Math.max(0, totalNeeded - inStock)

                    const unitsPerSheet = Number(part.nom?.units_per_sheet) || 1
                    const sheets = Math.ceil(totalToProduce / unitsPerSheet)

                    const sheets_t300 = snapshot
                      ? (snapshot.sheets_t300 !== undefined ? Number(snapshot.sheets_t300) : 0)
                      : (materialSplits[part.nom?.id]?.t300 !== undefined ? Number(materialSplits[part.nom?.id].t300) : 0)
                    const sheets_t700 = snapshot
                      ? (snapshot.sheets_t700 !== undefined ? Number(snapshot.sheets_t700) : 0)
                      : (materialSplits[part.nom?.id]?.t700 !== undefined ? Number(materialSplits[part.nom?.id].t700) : 0)

                    const totalSplitsSheets = sheets_t300 + sheets_t700

                    return (
                      <tr key={`${it.id}-${pIdx}`} style={{ borderBottom: '1px solid #1a1a1a' }} className="print-tr">
                        <td style={{ padding: '10px 6px', minWidth: '170px' }} className="col-name">
                          {!isReprintMode ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {(() => {
                                  const rowKey = `${it.id}-${pIdx}`
                                  const query = partSearchQueries[rowKey] !== undefined ? partSearchQueries[rowKey] : ''
                                  const filteredParts = nomenclatures.filter(n =>
                                    n.type === 'part' &&
                                    (query === '' ||
                                     n.name.toLowerCase().includes(query.toLowerCase()) ||
                                     (n.nomenclature_code && n.nomenclature_code.toLowerCase().includes(query.toLowerCase())) ||
                                     (n.description && n.description.toLowerCase().includes(query.toLowerCase())) ||
                                     (n.additional_info && n.additional_info.toLowerCase().includes(query.toLowerCase())) ||
                                     (n.material_type && n.material_type.toLowerCase().includes(query.toLowerCase())))
                                  )
                                  const currentName = partSearchQueries[rowKey] !== undefined ? partSearchQueries[rowKey] : (part.nom?.name || '')
                                  return (
                                    <div style={{ position: 'relative', flex: 1 }}>
                                      <input
                                        type="text"
                                        value={currentName}
                                        title={currentName}
                                        onChange={(e) => {
                                          const val = e.target.value
                                          setPartSearchQueries(prev => ({ ...prev, [rowKey]: val }))
                                        }}
                                        onFocus={() => {
                                          setOpenDropdownRowKey(rowKey)
                                          setPartSearchQueries(prev => ({ ...prev, [rowKey]: part.nom?.name || '' }))
                                        }}
                                        onBlur={() => setTimeout(() => {
                                          setOpenDropdownRowKey(null)
                                          setPartSearchQueries(prev => {
                                            const next = { ...prev }
                                            delete next[rowKey]
                                            return next
                                          })
                                        }, 250)}
                                        placeholder="Пошук деталі..."
                                        style={{
                                          background: '#111',
                                          border: '1px solid #333',
                                          color: '#fff',
                                          padding: '6px 12px',
                                          borderRadius: '10px',
                                          fontSize: '0.9rem',
                                          fontWeight: 'bold',
                                          width: '100%',
                                          outline: 'none'
                                        }}
                                      />
                                      {openDropdownRowKey === rowKey && (
                                        <div style={{
                                          position: 'absolute',
                                          top: '100%',
                                          left: 0,
                                          right: 0,
                                          background: '#0d0d0d',
                                          border: '1px solid #333',
                                          borderRadius: '10px',
                                          maxHeight: '220px',
                                          overflowY: 'auto',
                                          zIndex: 9999,
                                          marginTop: '5px',
                                          boxShadow: '0 10px 30px rgba(0,0,0,0.8)'
                                        }}>
                                          {filteredParts.length === 0 ? (
                                            <div style={{ padding: '10px', color: '#555', fontSize: '0.8rem', textAlign: 'center' }}>Немає таких деталей</div>
                                          ) : (
                                            filteredParts.map(n => (
                                              <div
                                                key={n.id}
                                                onMouseDown={() => {
                                                  setNaryadParts(prev => {
                                                    const itemParts = [...(prev[it.id] || [])]
                                                    itemParts[pIdx] = { ...itemParts[pIdx], nom: n }
                                                    return { ...prev, [it.id]: itemParts }
                                                  })
                                                  setOpenDropdownRowKey(null)
                                                }}
                                                style={{ padding: '10px 12px', borderBottom: '1px solid #1a1a1a', cursor: 'pointer', fontSize: '0.85rem', color: '#fff' }}
                                              >
                                                <div style={{ fontWeight: 'bold' }}>{n.name}</div>
                                                {n.material_type && <div style={{ fontSize: '0.7rem', color: '#888' }}>{n.material_type}</div>}
                                              </div>
                                            ))
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })()}
                                <input
                                  type="number"
                                  min="1"
                                  value={part.quantity_per_parent || 1}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 1
                                    setNaryadParts(prev => {
                                      const itemParts = [...(prev[it.id] || [])]
                                      itemParts[pIdx] = { ...itemParts[pIdx], quantity_per_parent: val }
                                      return { ...prev, [it.id]: itemParts }
                                    })
                                  }}
                                  style={{
                                    width: '60px',
                                    background: '#000',
                                    border: '1px solid #222',
                                    color: '#ff9000',
                                    padding: '4px 6px',
                                    borderRadius: '6px',
                                    fontSize: '0.8rem',
                                    fontWeight: 'bold',
                                    textAlign: 'center'
                                  }}
                                />
                                {part.nom?.nomenclature_code && (
                                  <span style={{ fontSize: '0.6rem', color: '#444', fontWeight: 900, textTransform: 'uppercase', marginLeft: 'auto' }}>
                                    {part.nom.nomenclature_code}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <>
                              <div style={{ fontWeight: 1000, color: '#fff', fontSize: '1rem', letterSpacing: '-0.01em' }} className="print-txt">{part.nom?.name || '—'}</div>
                              {part.nom?.nomenclature_code && (
                                <div style={{ fontSize: '0.6rem', color: '#444', fontWeight: 900, marginTop: '3px', textTransform: 'uppercase' }} className="print-subtxt">{part.nom.nomenclature_code}</div>
                              )}
                            </>
                          )}
                        </td>

                        <td style={{ padding: '10px 4px', textAlign: 'center', fontSize: '1.1rem', color: '#fff', fontWeight: 900 }} className="no-print">
                          {activeNaryadOrder.isVirtualDraft ? (
                            <input
                              type="number"
                              min="1"
                              value={thisNaryadQty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0
                                setNaryadQtys(prev => ({
                                  ...prev,
                                  [it.id]: val
                                }))
                              }}
                              style={{
                                width: '65px',
                                background: '#000',
                                border: '1px solid #333',
                                color: '#fff',
                                padding: '6px 4px',
                                borderRadius: '8px',
                                fontSize: '1rem',
                                fontWeight: 950,
                                textAlign: 'center',
                                outline: 'none'
                              }}
                            />
                          ) : (
                            totalNeeded.toString()
                          )}
                        </td>
                        <td style={{ padding: '6px 4px', textAlign: 'center' }} className="no-print">
                          {isReprintMode ? (
                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: inStock > 0 ? '#10b981' : '#666' }}>
                              {inStock}
                            </span>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <label
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  cursor: 'pointer',
                                  userSelect: 'none',
                                  padding: '3px 8px',
                                  borderRadius: '8px',
                                  background: isPartActiveBZ ? (availableBZ > 0 ? 'rgba(16, 185, 129, 0.12)' : '#111') : 'rgba(239, 68, 68, 0.1)',
                                  border: `1px solid ${isPartActiveBZ ? (availableBZ > 0 ? 'rgba(16, 185, 129, 0.35)' : '#222') : 'rgba(239, 68, 68, 0.3)'}`,
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isPartActiveBZ}
                                  onChange={(e) => {
                                    const val = e.target.checked
                                    setPartBZOverrides(prev => ({ ...prev, [String(part.nom?.id)]: val }))
                                  }}
                                  style={{ accentColor: '#ff9000', width: '15px', height: '15px', cursor: 'pointer' }}
                                />
                                <span style={{
                                  fontSize: '0.85rem',
                                  fontWeight: 950,
                                  color: isPartActiveBZ ? (availableBZ > 0 ? '#10b981' : '#777') : '#ef4444'
                                }}>
                                  <span style={{ textDecoration: !isPartActiveBZ && availableBZ > 0 ? 'line-through' : 'none' }}>
                                    {inStock}
                                  </span>
                                  {availableBZ > 0 && (
                                    <span style={{ fontSize: '0.72rem', color: isPartActiveBZ ? 'rgba(16, 185, 129, 0.75)' : 'rgba(239, 68, 68, 0.75)', marginLeft: '3px', fontWeight: 800 }}>
                                      ({availableBZ})
                                    </span>
                                  )}
                                </span>
                              </label>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'center', fontSize: '1.2rem', color: '#ff9000', fontWeight: 1000 }} className="col-plan">
                          {totalToProduce.toString()}
                        </td>
                        <td style={{ padding: '10px 6px', textAlign: 'center' }} className="col-material">
                          <div style={{ fontSize: '0.85rem', color: '#aaa', fontWeight: 700 }} className="print-subtxt">
                            {(part.nom?.material_type || '—').replace(/т300/gi, '').replace(/t300/gi, '').replace(/т700/gi, '').replace(/t700/gi, '').replace(/\s+/g, ' ').trim()}
                          </div>
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'center', color: '#555', fontSize: '0.9rem' }} className="col-qty-sh">
                          {unitsPerSheet.toString()}
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'center', fontWeight: 1000, color: '#a855f7', fontSize: '1.4rem' }} className="col-sheets-total print-accent-p">
                          {totalToProduce > 0 ? (sheets || 0).toString() : '0'}
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'center', fontWeight: 1000, color: '#22c55e', fontSize: '1.4rem' }} className="col-sheets print-accent-g">
                          {isReprintMode ? (
                            sheets_t300.toString()
                          ) : totalToProduce > 0 ? (
                            <input
                              type="number"
                              min="0"
                              max={sheets}
                              value={sheets_t300}
                              onChange={(e) => handleSplitChange(part.nom?.id, 't300', e.target.value, sheets)}
                              style={{
                                width: '55px',
                                background: '#111',
                                border: '1px solid #333',
                                color: '#22c55e',
                                padding: '5px 2px',
                                borderRadius: '5px',
                                textAlign: 'center',
                                fontWeight: 'bold',
                                fontSize: '1.1rem'
                              }}
                            />
                          ) : '0'}
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'center', fontWeight: 1000, color: '#0ea5e9', fontSize: '1.4rem' }} className="col-sheets-t700 print-accent-b">
                          {isReprintMode ? (
                            sheets_t700.toString()
                          ) : totalToProduce > 0 ? (
                            <input
                              type="number"
                              min="0"
                              max={sheets}
                              value={sheets_t700}
                              onChange={(e) => handleSplitChange(part.nom?.id, 't700', e.target.value, sheets)}
                              style={{
                                width: '55px',
                                background: '#111',
                                border: '1px solid #333',
                                color: '#0ea5e9',
                                padding: '5px 2px',
                                borderRadius: '5px',
                                textAlign: 'center',
                                fontWeight: 'bold',
                                fontSize: '1.1rem'
                              }}
                            />
                          ) : '0'}
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'center', fontSize: '1rem', color: '#ff9000', fontWeight: 900 }} className="col-bz">
                          {totalToProduce > 0 && totalSplitsSheets > 0 ? `+${(totalSplitsSheets * unitsPerSheet) - totalToProduce}` : '0'}
                        </td>
                      </tr>
                    )
                  })

                  if (!isReprintMode) {
                    rows.push(
                      <tr key={`add-part-${it.id}`} style={{ borderBottom: '1px solid #1a1a1a', background: 'rgba(255,144,0,0.015)' }} className="no-print">
                        <td colSpan={11} style={{ padding: '12px 15px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              const firstPart = nomenclatures.find(n => n.type === 'part' || n.type === 'raw' || !n.type)
                              setNaryadParts(prev => {
                                const itemParts = [...(prev[it.id] || [])]
                                itemParts.push({
                                  nom: firstPart,
                                  quantity_per_parent: 1
                                })
                                return { ...prev, [it.id]: itemParts }
                              })
                            }}
                            style={{
                              background: 'rgba(16, 185, 129, 0.1)',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              color: '#10b981',
                              padding: '8px 16px',
                              borderRadius: '10px',
                              fontSize: '0.8rem',
                              fontWeight: 900,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'all 0.2s'
                            }}
                          >
                            ➕ Додати деталь в розкрій
                          </button>
                        </td>
                      </tr>
                    )
                  }
                  return rows
                })}
              </tbody>
              <tfoot style={{ background: 'rgba(255,144,0,0.05)', borderTop: '2px solid #ff9000' }} className="print-tf">
                {(() => {
                  let totalNeed = 0;
                  let totalPlan = 0;
                  let totalSheetsT300 = 0;
                  let totalSheetsT700 = 0;

                  if (activeNaryadOrder.isPrepOrder) {
                    activeNaryadOrder.order_items?.forEach(it => {
                      totalNeed += Number(it.quantity);
                      totalPlan += Number(it.quantity);
                      totalSheetsT300 += Number(it.quantity);
                    });
                  } else {
                    activeNaryadOrder.order_items?.forEach(it => {
                      const thisNaryadQty = isReprintMode ? Number(it.quantity) : (naryadQtys[it.id] || 0);
                      const displayParts = getDisplayPartsForOrderItem(it);

                      displayParts.forEach(part => {
                        const snapshot = reprintTask?.plan_snapshot?.[String(part.nom?.id)];
                        const need = snapshot ? snapshot.need : (thisNaryadQty * (Number(part.quantity_per_parent) || 1));
                        const inStock = snapshot ? (snapshot.stock || 0) : (useStockBZ ? (() => {
                          const bzInv = inventory.find(i => String(i.nomenclature_id) === String(part.nom?.id) && i.type === 'bz' && (!i.pocket_owner || i.pocket_owner === 'Не вказано'));
                          return bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0;
                        })() : 0);
                        const plan = snapshot ? snapshot.plan : Math.max(0, need - inStock);
                        const unitsPerSheet = Number(part.nom?.units_per_sheet) || 1;
                        const sheets = Math.ceil(plan / unitsPerSheet);

                        const sheets_t300 = snapshot
                          ? (snapshot.sheets_t300 !== undefined ? Number(snapshot.sheets_t300) : 0)
                          : (materialSplits[part.nom?.id]?.t300 !== undefined ? Number(materialSplits[part.nom?.id].t300) : 0);
                        const sheets_t700 = snapshot
                          ? (snapshot.sheets_t700 !== undefined ? Number(snapshot.sheets_t700) : 0)
                          : (materialSplits[part.nom?.id]?.t700 !== undefined ? Number(materialSplits[part.nom?.id].t700) : 0);

                        totalNeed += need;
                        totalPlan += plan;
                        totalSheetsT300 += sheets_t300;
                        totalSheetsT700 += sheets_t700;
                      });
                    });
                  }

                  return (
                    <tr>
                      <td style={{ padding: '12px 15px', fontWeight: 1000, fontSize: '1.1rem', textTransform: 'uppercase', border: '1px solid #000' }} className="col-name print-txt">ЗАГАЛЬНИЙ ПІДСУМОК:</td>
                      <td className="no-print" style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.2rem', border: '1px solid #000' }}>{totalNeed.toString()}</td>
                      <td className="no-print" style={{ border: '1px solid #000' }}></td>
                      <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.4rem', color: '#ff9000', border: '1px solid #000' }} className="col-plan print-txt">
                        {totalPlan.toString()}
                      </td>
                      <td style={{ border: '1px solid #000' }} className="col-material"></td>
                      <td style={{ border: '1px solid #000' }} className="col-qty-sh"></td>
                      <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.6rem', color: '#a855f7', border: '1px solid #000' }} className="col-sheets-total print-accent-p">
                        {(totalSheetsT300 + totalSheetsT700).toString()}
                      </td>
                      <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.6rem', color: '#22c55e', border: '1px solid #000' }} className="col-sheets print-accent-g">
                        {totalSheetsT300.toString()}
                      </td>
                      <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.6rem', color: '#0ea5e9', border: '1px solid #000' }} className="col-sheets-t700 print-accent-b">
                        {totalSheetsT700.toString()}
                      </td>
                      <td className="col-bz" style={{ border: '1px solid #000' }}></td>
                    </tr>
                  );
                })()}
              </tfoot>
            </table>

            {/* PRINT ONLY TABLE (EXACTLY 8 COLUMNS FOR SPLIT SHEETS) */}
            <table className="print-table print-only-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: '#111', textAlign: 'left', color: '#555' }} className="print-thr">
                  <th style={{ padding: '12px 15px', width: '30%' }} className="col-name">ДЕТАЛЬ В РОЗКРІЙ</th>
                  <th style={{ padding: '12px 15px', textAlign: 'center', width: '8%' }} className="col-plan">ПЛАН</th>
                  <th style={{ padding: '12px 15px', textAlign: 'center', width: '16%' }} className="col-material">МАТЕРІАЛ</th>
                  <th style={{ padding: '12px 15px', textAlign: 'center', width: '6%' }} className="col-qty-sh">ШТ/Л</th>
                  <th style={{ padding: '12px 15px', textAlign: 'center', width: '10%', color: '#a855f7' }} className="col-sheets-total">ЗАГАЛОМ ЛИСТІВ</th>
                  <th style={{ padding: '12px 15px', textAlign: 'center', width: '10%', color: '#22c55e' }} className="col-sheets">ЛИСТІВ Т300</th>
                  <th style={{ padding: '12px 15px', textAlign: 'center', width: '10%', color: '#0ea5e9' }} className="col-sheets-t700">ЛИСТІВ Т700</th>
                  <th style={{ padding: '12px 15px', textAlign: 'center', width: '10%' }} className="col-bz">БЗ</th>
                </tr>
              </thead>
              <tbody>
                {activeNaryadOrder.order_items?.map(it => {
                  const nom = nomenclatures.find(n => n.id === it.nomenclature_id)
                  const thisNaryadQty = isReprintMode ? Number(it.quantity) : (naryadQtys[it.id] || 0)
                  if (thisNaryadQty <= 0) return null

                  if (activeNaryadOrder.isPrepOrder) {
                    return (
                      <tr key={it.id} style={{ borderBottom: '1px solid #1a1a1a' }} className="print-tr">
                        <td className="col-name">
                          <div style={{ fontWeight: 1000, color: '#000', fontSize: '0.75rem', letterSpacing: '-0.01em' }} className="print-txt">{nom?.name || '—'}</div>
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 1000 }} className="col-plan">
                          {thisNaryadQty.toString()}
                        </td>
                        <td style={{ textAlign: 'center' }} className="col-material">
                          <div style={{ fontSize: '0.7rem', color: '#000', fontWeight: 700 }} className="print-subtxt">
                            {(nom?.name || '—').replace(/т300/gi, '').replace(/t300/gi, '').replace(/т700/gi, '').replace(/t700/gi, '').replace(/\s+/g, ' ').trim()}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '0.8rem' }} className="col-qty-sh">
                          1
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 1000, fontSize: '0.9rem' }} className="col-sheets-total print-accent-p">
                          {thisNaryadQty.toString()}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 1000, fontSize: '0.9rem' }} className="col-sheets print-accent-g">
                          {thisNaryadQty.toString()}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 1000, fontSize: '0.9rem' }} className="col-sheets-t700 print-accent-b">
                          0
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 900 }} className="col-bz">
                          0
                        </td>
                      </tr>
                    )
                  }

                  const displayParts = getDisplayPartsForOrderItem(it)

                  return displayParts.map((part, pIdx) => {
                    const snapshot = reprintTask?.plan_snapshot?.[String(part.nom?.id)]

                    const totalNeeded = snapshot ? snapshot.need : (thisNaryadQty * (Number(part.quantity_per_parent) || 1))
                    const isPartActiveBZ = isPartBZActive(part.nom?.id)
                    const inStock = snapshot ? (snapshot.stock || 0) : (isPartActiveBZ ? (() => {
                      const bzInv = inventory.find(i => String(i.nomenclature_id) === String(part.nom?.id) && i.type === 'bz' && (!i.pocket_owner || i.pocket_owner === 'Не вказано'))
                      return bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0
                    })() : 0)
                    const totalToProduce = snapshot ? snapshot.plan : Math.max(0, totalNeeded - inStock)

                    const unitsPerSheet = Number(part.nom?.units_per_sheet) || 1
                    const sheets = Math.ceil(totalToProduce / unitsPerSheet)

                    const isDefaultT700 = (part.nom?.material_type || part.nom?.name || '').toLowerCase().includes('т700') || (part.nom?.material_type || part.nom?.name || '').toLowerCase().includes('t700')
                    const defaultT300 = isDefaultT700 ? 0 : (totalToProduce > 0 ? sheets : 0)
                    const defaultT700 = isDefaultT700 ? (totalToProduce > 0 ? sheets : 0) : 0

                    const sheets_t300 = snapshot
                      ? (snapshot.sheets_t300 !== undefined ? Number(snapshot.sheets_t300) : (isDefaultT700 ? 0 : Number(snapshot.sheets)))
                      : (materialSplits[part.nom?.id]?.t300 !== undefined ? materialSplits[part.nom?.id].t300 : defaultT300)
                    const sheets_t700 = snapshot
                      ? (snapshot.sheets_t700 !== undefined ? Number(snapshot.sheets_t700) : (isDefaultT700 ? Number(snapshot.sheets) : 0))
                      : (materialSplits[part.nom?.id]?.t700 !== undefined ? materialSplits[part.nom?.id].t700 : defaultT700)

                    const totalSplitsSheets = sheets_t300 + sheets_t700

                    return (
                      <tr key={`${it.id}-${pIdx}`} style={{ borderBottom: '1px solid #1a1a1a' }} className="print-tr">
                        <td className="col-name">
                          <div style={{ fontWeight: 1000, color: '#000', fontSize: '0.75rem', letterSpacing: '-0.01em' }} className="print-txt">{part.nom?.name || '—'}</div>
                          {part.nom?.nomenclature_code && (
                            <div style={{ fontSize: '0.55rem', color: '#444', fontWeight: 900, marginTop: '3px', textTransform: 'uppercase' }} className="print-subtxt">{part.nom.nomenclature_code}</div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 1000 }} className="col-plan">
                          {totalToProduce.toString()}
                        </td>
                        <td style={{ textAlign: 'center' }} className="col-material">
                          <div style={{ fontSize: '0.7rem', color: '#000', fontWeight: 700 }} className="print-subtxt">
                            {(part.nom?.material_type || '—').replace(/т300/gi, '').replace(/t300/gi, '').replace(/т700/gi, '').replace(/t700/gi, '').replace(/\s+/g, ' ').trim()}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '0.8rem' }} className="col-qty-sh">
                          {unitsPerSheet.toString()}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 1000, fontSize: '0.9rem' }} className="col-sheets-total print-accent-p">
                          {totalToProduce > 0 ? (sheets || 0).toString() : '0'}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 1000, fontSize: '0.9rem' }} className="col-sheets print-accent-g">
                          {totalToProduce > 0 ? (sheets_t300 || 0).toString() : '0'}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 1000, fontSize: '0.9rem' }} className="col-sheets-t700 print-accent-b">
                          {totalToProduce > 0 ? (sheets_t700 || 0).toString() : '0'}
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 900 }} className="col-bz">
                          {totalToProduce > 0 ? `+${(totalSplitsSheets * unitsPerSheet) - totalToProduce}` : '0'}
                        </td>
                      </tr>
                    )
                  })
                })}
              </tbody>
              <tfoot style={{ background: 'rgba(255,144,0,0.05)', borderTop: '2px solid #ff9000' }} className="print-tf">
                {(() => {
                  let totalNeed = 0;
                  let totalPlan = 0;
                  let totalSheetsT300 = 0;
                  let totalSheetsT700 = 0;

                  if (activeNaryadOrder.isPrepOrder) {
                    activeNaryadOrder.order_items?.forEach(it => {
                      totalNeed += Number(it.quantity);
                      totalPlan += Number(it.quantity);
                      totalSheetsT300 += Number(it.quantity);
                    });
                  } else {
                    activeNaryadOrder.order_items?.forEach(it => {
                      const thisNaryadQty = isReprintMode ? Number(it.quantity) : (naryadQtys[it.id] || 0);
                      const displayParts = getDisplayPartsForOrderItem(it);

                      displayParts.forEach(part => {
                        const snapshot = reprintTask?.plan_snapshot?.[String(part.nom?.id)];
                        const need = snapshot ? snapshot.need : (thisNaryadQty * (Number(part.quantity_per_parent) || 1));
                        const inStock = snapshot ? snapshot.stock : (() => {
                          const bzInv = inventory.find(i => String(i.nomenclature_id) === String(part.nom?.id) && i.type === 'bz' && (!i.pocket_owner || i.pocket_owner === 'Не вказано'));
                          return bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0;
                        })();
                        const plan = snapshot ? snapshot.plan : Math.max(0, need - inStock);
                        const unitsPerSheet = Number(part.nom?.units_per_sheet) || 1;
                        const sheets = Math.ceil(plan / unitsPerSheet);

                        const sheets_t300 = snapshot
                          ? (snapshot.sheets_t300 !== undefined ? Number(snapshot.sheets_t300) : 0)
                          : (materialSplits[part.nom?.id]?.t300 !== undefined ? Number(materialSplits[part.nom?.id].t300) : 0);
                        const sheets_t700 = snapshot
                          ? (snapshot.sheets_t700 !== undefined ? Number(snapshot.sheets_t700) : 0)
                          : (materialSplits[part.nom?.id]?.t700 !== undefined ? Number(materialSplits[part.nom?.id].t700) : 0);

                        totalNeed += need;
                        totalPlan += plan;
                        totalSheetsT300 += sheets_t300;
                        totalSheetsT700 += sheets_t700;
                      });
                    });
                  }

                  return (
                    <tr>
                      <td style={{ padding: '12px 15px', fontWeight: 1000, fontSize: '1.1rem', textTransform: 'uppercase', border: '1px solid #000' }} className="col-name print-txt">ЗАГАЛЬНИЙ ПІДСУМОК:</td>
                      <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.4rem', color: '#ff9000', border: '1px solid #000' }} className="col-plan print-txt">
                        {totalPlan.toString()}
                      </td>
                      <td style={{ border: '1px solid #000' }} className="col-material"></td>
                      <td style={{ border: '1px solid #000' }} className="col-qty-sh"></td>
                      <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.6rem', color: '#a855f7', border: '1px solid #000' }} className="col-sheets-total print-accent-p">
                        {(totalSheetsT300 + totalSheetsT700).toString()}
                      </td>
                      <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.6rem', color: '#22c55e', border: '1px solid #000' }} className="col-sheets print-accent-g">
                        {totalSheetsT300.toString()}
                      </td>
                      <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 1000, fontSize: '1.6rem', color: '#0ea5e9', border: '1px solid #000' }} className="col-sheets-t700 print-accent-b">
                        {totalSheetsT700.toString()}
                      </td>
                      <td className="col-bz" style={{ border: '1px solid #000' }}></td>
                    </tr>
                  );
                })()}
              </tfoot>
            </table>
          </div>

          {materialSummary.length > 0 && (
            <div className="mat-summary-section" style={{ marginTop: '25px', padding: '20px 30px', borderRadius: '18px', border: isLight ? '1px solid #e2e8f0' : '1px solid #222', background: isLight ? '#f8fafc' : '#070707' }}>
              <h4 style={{ margin: '0 0 15px', fontSize: '0.75rem', fontWeight: 950, color: isLight ? '#64748b' : '#444', textTransform: 'uppercase' }}>ВІДОМІСТЬ МАТЕРІАЛІВ:</h4>
              <div className="mat-flex-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '25px', overflowX: 'hidden' }}>
                {materialSummary.map((m, idx) => {
                  const totalSheets = Number(m.sheets) || 0
                  let displayQtyText = `${totalSheets}`
                  
                  if (isReprintMode && reprintTask) {
                    const normStrLocal = str => str ? str.toLowerCase().replace(/[^a-z0-9а-яєіїґ]/g, '') : ''
                    const remaining = (requests || []).filter(r => 
                      r.task_id === reprintTask.id && 
                      r.status !== 'completed' && 
                      (() => {
                        const reqNom = nomenclatures.find(n => n.id === r.nomenclature_id)
                        const name = reqNom?.name || r.details || ''
                        const lowerName = name.toLowerCase()
                        const isSheet = lowerName.includes('лист') || lowerName.includes('sheet')
                        if (!isSheet) return false
                        
                        const rNameNorm = normStrLocal(name)
                        const mNameNorm = normStrLocal(m.name)
                        return rNameNorm.includes(mNameNorm) || mNameNorm.includes(rNameNorm)
                      })()
                    ).reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)
                    
                    const issued = Math.max(0, totalSheets - remaining)
                    displayQtyText = `${issued}/${totalSheets}`
                  }

                  return (
                    <div key={idx} className="mat-card-p" style={{ flex: 1, padding: '0 0 5px 15px', borderLeft: isLight ? '4px solid #f97316' : '4px solid #ff9000', minWidth: 'min-content' }}>
                      <div style={{ fontSize: '0.65rem', color: isLight ? '#64748b' : '#555', fontWeight: 800, marginBottom: '3px' }} className="print-subtxt">{m.name || '—'}</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 950, color: isLight ? '#0f172a' : '#fff' }} className="print-txt">{displayQtyText} <small style={{ fontSize: '0.65rem', fontWeight: 400, color: isLight ? '#64748b' : '#444' }} className="print-subtxt">{m.unit || 'ЛИСТІВ'}</small></div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>

        <div className="no-print" style={{ padding: '30px 40px', background: isLight ? '#ffffff' : '#111', borderTop: isLight ? '1px solid #e2e8f0' : '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px' }}>
          {!isReprintMode && !isSheetDistributionComplete && (
            <div style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239,68,68,0.1)', padding: '8px 16px', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.2)' }}>
              ⚠️ Розподіліть всі листи (Т300 / Т700) у таблиці, щоб створити наряд
            </div>
          )}
          <div style={{ display: 'flex', gap: '15px', marginLeft: 'auto' }}>
            <button onClick={() => { setActiveNaryadOrder(null); setReprintTask(null); setSelectedCutters({}); setPartCutterOverrides({}); }} style={{ background: isLight ? '#e2e8f0' : '#222', color: isLight ? '#334155' : '#fff', border: 'none', padding: '12px 30px', borderRadius: '12px', fontWeight: 800, cursor: 'pointer' }}>СКАСУВАТИ</button>
            <button
              onClick={handlePrint}
              disabled={isPrintDisabled}
              style={{
                background: isPrintDisabled ? (isLight ? '#cbd5e1' : '#222') : (isLight ? '#f97316' : '#ff9000'),
                color: isPrintDisabled ? (isLight ? '#94a3b8' : '#555') : (isLight ? '#ffffff' : '#000'),
                border: 'none',
                padding: '12px 45px',
                borderRadius: '12px',
                fontWeight: 950,
                cursor: isPrintDisabled ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem',
                transition: '0.2s',
                opacity: isPrintDisabled ? 0.6 : 1
              }}
            >
              {isSubmitting ? 'ЧЕКАЙТЕ...' : (isReprintMode ? 'ПОВТОРНИЙ ДРУК' : 'ДРУКУВАТИ ТА В РОБОТУ')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
