import React, { useState, useMemo } from 'react'
import { Package, CheckCircle, Send, PackageCheck } from 'lucide-react'


export const BoxesView = ({
  cardsWithBoxes,
  searchQuery,
  orders,
  expandedNaryads,
  setExpandedNaryads,
  expandedNomenclatures,
  setExpandedNomenclatures,
  checkedCutters,
  handleToggleCutterCheck,
  handlePrepareBox,
  handleIssueBox,
  isProcessing
}) => {
  const [checkedSheets, setCheckedSheets] = useState({})
  const [selectedOrder, setSelectedOrder] = useState('all')

  // ── Unique naряds for the filter dropdown ──────────────────────────
  const orderOptions = useMemo(() => {
    const seen = new Set()
    const opts = []
    cardsWithBoxes.forEach(box => {
      const o = (orders || []).find(o => String(o.id) === String(box.card.order_id || box.task?.order_id))
      const num = o?.order_num || 'Інші'
      if (!seen.has(num)) { seen.add(num); opts.push({ num, label: `Наряд #${num}` }) }
    })
    return opts.sort((a, b) => a.num.localeCompare(b.num))
  }, [cardsWithBoxes, orders])

  // ── Summary counts ─────────────────────────────────────────────────
  const counts = useMemo(() => {
    const visible = selectedOrder === 'all'
      ? cardsWithBoxes
      : cardsWithBoxes.filter(b => {
          const o = (orders || []).find(o => String(o.id) === String(b.card.order_id || b.task?.order_id))
          return (o?.order_num || 'Інші') === selectedOrder
        })
    return {
      toPrep:   visible.filter(b => !b.isPrepared && !b.isIssued).length,
      toIssue:  visible.filter(b =>  b.isPrepared && !b.isIssued).length,
      issued:   visible.filter(b =>  b.isIssued).length,
    }
  }, [cardsWithBoxes, selectedOrder, orders])

  // ── Group boxes ────────────────────────────────────────────────────
  const buildGroups = (filterFn) => {
    const groups = {}
    cardsWithBoxes.forEach(box => {
      if (!filterFn(box)) return
      const search = (searchQuery || '').toLowerCase().trim()
      const cardNum  = box.card.card_info?.split(' ')[0] || ''
      const partName = box.nom?.name || ''
      const o = (orders || []).find(o => String(o.id) === String(box.card.order_id || box.task?.order_id))
      const orderNum = o?.order_num || 'Інші'

      if (selectedOrder !== 'all' && orderNum !== selectedOrder) return
      if (search && !cardNum.toLowerCase().includes(search) && !partName.toLowerCase().includes(search) && !orderNum.toLowerCase().includes(search)) return

      if (!groups[orderNum]) groups[orderNum] = { orderNum, orderId: o?.id, nomenclatures: {} }
      const nomName = box.nom?.name || 'Без деталі'
      if (!groups[orderNum].nomenclatures[nomName]) groups[orderNum].nomenclatures[nomName] = []
      groups[orderNum].nomenclatures[nomName].push(box)
    })
    const parseIdx = b => { const m = b.card.card_info?.split(' ')[0]?.match(/^(\d+)\//) ; return m ? parseInt(m[1]) : 999 }
    Object.values(groups).forEach(g => Object.keys(g.nomenclatures).forEach(k => g.nomenclatures[k].sort((a,b) => parseIdx(a)-parseIdx(b))))
    return Object.values(groups)
  }

  const toPrepGroups  = buildGroups(b => !b.isPrepared && !b.isIssued)
  const toIssueGroups = buildGroups(b =>  b.isPrepared && !b.isIssued)
  const issuedGroups  = buildGroups(b =>  b.isIssued)

  // ── Shared renderers ───────────────────────────────────────────────
  const StatBlock = ({ icon, label, count, color, bg }) => (
    <div style={{ flex: 1, minWidth: 140, background: bg, borderRadius: 18, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ background: color + '22', borderRadius: 12, padding: 10, color }}>{icon}</div>
      <div>
        <div style={{ fontSize: '2rem', fontWeight: 900, lineHeight: 1, color }}>{count}</div>
        <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.06em', color: color + 'cc', marginTop: 4 }}>{label}</div>
      </div>
    </div>
  )

  const SectionHeader = ({ label, accent, count }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
      <div style={{ width: 4, height: 32, borderRadius: 4, background: accent }} />
      <span style={{ fontSize: '0.9rem', fontWeight: 900, letterSpacing: '0.06em', color: accent }}>{label}</span>
      <span style={{ background: accent + '22', color: accent, borderRadius: 8, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 900 }}>{count} бокс{count === 1 ? '' : 'ів'}</span>
    </div>
  )

  const NaryadBlock = ({ g, accentColor, actionSlot }) => {
    const isExpanded = expandedNaryads[`${g.orderNum}-${accentColor}`] === true
    const total   = Object.values(g.nomenclatures).reduce((a, l) => a + l.length, 0)
    const prepared = Object.values(g.nomenclatures).reduce((a, l) => a + l.filter(b => b.isPrepared || b.isIssued).length, 0)
    return (
      <div style={{ borderRadius: 20, overflow: 'hidden', border: `1px solid ${accentColor}33`, marginBottom: 8, background: '#111' }}>
        <div
          onClick={() => setExpandedNaryads(prev => ({ ...prev, [`${g.orderNum}-${accentColor}`]: !isExpanded }))}
          style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderLeft: `4px solid ${accentColor}` }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '1.1rem' }}>📦</span>
            <div>
              <div style={{ fontWeight: 900, fontSize: '1rem', color: '#fff', letterSpacing: '0.02em' }}>НАРЯД #{g.orderNum}</div>
              <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: 3 }}>
                Зібрано: <strong style={{ color: prepared === total ? '#10b981' : accentColor }}>{prepared}</strong> / {total} боксів
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {actionSlot}
            <span style={{ color: accentColor, fontSize: '0.8rem', fontWeight: 900 }}>{isExpanded ? '▲' : '▼'}</span>
          </div>
        </div>

        {isExpanded && (
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 20, background: '#0a0a0a' }}>
            {Object.entries(g.nomenclatures).map(([nomName, boxList]) => {
              const nomKey = `${g.orderNum}-${nomName}-${accentColor}`
              const isNomExpanded = expandedNomenclatures[nomKey] === true
              const sheetsSummary = {}
              const cuttersSummary = {}
              boxList.forEach(item => {
                sheetsSummary[item.activeMaterialName || 'Листи'] = (sheetsSummary[item.activeMaterialName || 'Листи'] || 0) + item.cardSheets
                item.cutters.forEach(c => { cuttersSummary[c.name] = (cuttersSummary[c.name] || 0) + c.qty })
              })

              return (
                <div key={nomName}>
                  <div
                    onClick={() => setExpandedNomenclatures(prev => ({ ...prev, [nomKey]: !isNomExpanded }))}
                    style={{
                      background: '#181818',
                      border: `1px solid ${isNomExpanded ? accentColor + '44' : '#2a2a2a'}`,
                      borderRadius: 14,
                      padding: '13px 16px',
                      cursor: 'pointer',
                      marginBottom: isNomExpanded ? 12 : 0,
                      transition: 'border-color 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <span style={{ fontWeight: 800, fontSize: '0.88rem', flex: 1, color: '#f0f0f0', lineHeight: 1.3 }}>{nomName}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                        <span style={{ background: accentColor + '22', color: accentColor, padding: '3px 10px', borderRadius: 8, fontSize: '0.68rem', fontWeight: 900 }}>
                          {boxList.length} бокс{boxList.length === 1 ? '' : 'ів'}
                        </span>
                        <span style={{ color: '#bbb', fontSize: '0.75rem', fontWeight: 700, minWidth: 14, textAlign: 'center' }}>{isNomExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 18, marginTop: 8, flexWrap: 'wrap', fontSize: '0.72rem', color: '#999' }}>
                      <span>⚡ {Object.entries(sheetsSummary).map(([m, q]) => `${q}л ${m}`).join(', ')}</span>
                      <span>🛠️ {Object.entries(cuttersSummary).map(([n, q]) => `${q}шт`).slice(0, 2).join(', ')}{Object.keys(cuttersSummary).length > 2 ? ' …' : ''}</span>
                    </div>
                  </div>

                  {isNomExpanded && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 16 }}>
                      {boxList.map(boxItem => {
                        const cardId = boxItem.card.id
                        const cardNum = boxItem.card.card_info?.split(' ')[0] || `#${cardId.slice(0,6)}`
                        const isAllChecked = boxItem.cutters.every(c => checkedCutters[cardId]?.[c.nomenclature_id])
                        const isSheetChecked = !!checkedSheets[cardId] || boxItem.isPrepared || boxItem.isIssued
                        const canSubmit = isAllChecked && isSheetChecked

                        return (
                          <div key={cardId} style={{ background: '#111', borderRadius: 18, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, border: `1px solid ${boxItem.isIssued ? '#10b98133' : boxItem.isPrepared ? '#3b82f633' : '#ff900022'}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <strong style={{ fontSize: '0.95rem' }}>Картка {cardNum}</strong>
                              {boxItem.isIssued ? (
                                <span style={{ background: '#10b98122', color: '#10b981', padding: '3px 10px', borderRadius: 8, fontSize: '0.62rem', fontWeight: 900 }}>✓ ВИДАНО</span>
                              ) : boxItem.isPrepared ? (
                                <span style={{ background: '#3b82f622', color: '#3b82f6', padding: '3px 10px', borderRadius: 8, fontSize: '0.62rem', fontWeight: 900 }}>✓ ГОТОВИЙ</span>
                              ) : (
                                <span style={{ background: '#ff900015', color: '#ff9000', padding: '3px 10px', borderRadius: 8, fontSize: '0.62rem', fontWeight: 900 }}>ОЧІКУЄ</span>
                              )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: '#0d0d0d', borderRadius: 12, padding: '10px 14px', fontSize: '0.72rem', color: '#ccc' }}>
                              <div><div style={{ color: '#888', fontSize: '0.6rem', fontWeight: 800, marginBottom: 2 }}>ВЕРСТАТ</div>{boxItem.card.machine || '—'}</div>
                              <div><div style={{ color: '#888', fontSize: '0.6rem', fontWeight: 800, marginBottom: 2 }}>ЛИСТИ</div>{boxItem.cardSheets} л.</div>
                            </div>

                            {!boxItem.isPrepared && !boxItem.isIssued && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#888', marginBottom: 2 }}>НАПОВНЕННЯ БОКСУ:</div>
                                <div
                                  onClick={() => setCheckedSheets(prev => ({ ...prev, [cardId]: !prev[cardId] }))}
                                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 10, cursor: 'pointer', background: isSheetChecked ? '#10b98110' : '#0d0d0d', border: `1px solid ${isSheetChecked ? '#10b98133' : '#222'}` }}
                                >
                                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.73rem' }}>
                                    <input type="checkbox" checked={isSheetChecked} onChange={() => {}} style={{ accentColor: '#10b981' }} />
                                    <span style={{ fontWeight: isSheetChecked ? 700 : 400 }}>{boxItem.activeMaterialName}</span>
                                  </div>
                                  <strong style={{ color: isSheetChecked ? '#10b981' : '#555', fontSize: '0.75rem' }}>{boxItem.cardSheets} л.</strong>
                                </div>
                                {boxItem.cutters.map(cutter => {
                                  const isChecked = !!checkedCutters[cardId]?.[cutter.nomenclature_id]
                                  return (
                                    <div
                                      key={cutter.nomenclature_id}
                                      onClick={() => handleToggleCutterCheck(cardId, cutter.nomenclature_id)}
                                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 10, cursor: 'pointer', background: isChecked ? '#10b98110' : '#0d0d0d', border: `1px solid ${isChecked ? '#10b98133' : '#222'}` }}
                                    >
                                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.73rem', flex: 1, marginRight: 8 }}>
                                        <input type="checkbox" checked={isChecked} onChange={() => {}} style={{ accentColor: '#10b981' }} />
                                        <span style={{ fontWeight: isChecked ? 700 : 400, lineHeight: 1.3 }}>{cutter.name}</span>
                                      </div>
                                      <strong style={{ color: isChecked ? '#10b981' : '#555', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{cutter.qty} шт</strong>
                                    </div>
                                  )
                                })}
                              </div>
                            )}

                            {/* Action buttons */}
                            {!boxItem.isPrepared && !boxItem.isIssued && (
                              <button
                                disabled={isProcessing || !canSubmit}
                                onClick={() => handlePrepareBox(boxItem, null)}
                                style={{ width: '100%', padding: '11px', background: canSubmit ? '#ff9000' : '#1a1a1a', color: canSubmit ? '#000' : '#444', border: 'none', borderRadius: 12, fontWeight: 900, fontSize: '0.78rem', textTransform: 'uppercase', cursor: (isProcessing || !canSubmit) ? 'not-allowed' : 'pointer', transition: 'all 0.2s', marginTop: 4 }}
                              >
                                <Package size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                                {!canSubmit ? 'Позначте всі матеріали' : 'Завершити комплектацію'}
                              </button>
                            )}
                            {boxItem.isPrepared && !boxItem.isIssued && (
                              <button
                                disabled={isProcessing}
                                onClick={() => handleIssueBox && handleIssueBox(boxItem)}
                                style={{ width: '100%', padding: '11px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 900, fontSize: '0.78rem', textTransform: 'uppercase', cursor: isProcessing ? 'not-allowed' : 'pointer', transition: 'all 0.2s', marginTop: 4 }}
                              >
                                <Send size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                                ВИДАТИ БОКС
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const EmptyState = ({ label }) => (
    <div style={{ textAlign: 'center', padding: '30px 20px', color: '#333', fontSize: '0.8rem', border: '1px dashed #1e1e1e', borderRadius: 16 }}>
      {label}
    </div>
  )

  return (
    <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* ── Stat blocks + naряд filter ── */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'stretch' }}>
        <StatBlock icon={<Package size={22} />}    label="ПІДГОТУВАТИ БОКСІВ" count={counts.toPrep}  color="#ff9000" bg="rgba(255,144,0,0.06)" />
        <StatBlock icon={<Send size={22} />}        label="ВИДАТИ БОКСІВ"      count={counts.toIssue} color="#3b82f6" bg="rgba(59,130,246,0.06)" />
        <StatBlock icon={<PackageCheck size={22} />} label="ВИДАНО БОКСІВ"      count={counts.issued}  color="#10b981" bg="rgba(16,185,129,0.06)" />


        {/* Naряд filter */}
        {orderOptions.length > 1 && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
            <select
              value={selectedOrder}
              onChange={e => setSelectedOrder(e.target.value)}
              style={{ background: '#111', color: '#fff', border: '1px solid #2a2a2a', borderRadius: 14, padding: '10px 16px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', outline: 'none', minWidth: 180 }}
            >
              <option value="all">🗂️ Всі наряди</option>
              {orderOptions.map(o => (
                <option key={o.num} value={o.num}>{o.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── ПІДГОТУВАТИ ── */}
      <div>
        <SectionHeader label="ПІДГОТУВАТИ БОКСІВ" accent="#ff9000" count={counts.toPrep} />
        {toPrepGroups.length === 0
          ? <EmptyState label="Немає боксів для підготовки" />
          : toPrepGroups.map(g => <NaryadBlock key={g.orderNum + '-prep'} g={g} accentColor="#ff9000" actionSlot={null} />)
        }
      </div>

      {/* ── ВИДАТИ ── */}
      <div>
        <SectionHeader label="ВИДАТИ БОКСІВ" accent="#3b82f6" count={counts.toIssue} />
        {toIssueGroups.length === 0
          ? <EmptyState label="Немає готових боксів для видачі" />
          : toIssueGroups.map(g => <NaryadBlock key={g.orderNum + '-issue'} g={g} accentColor="#3b82f6" actionSlot={null} />)
        }
      </div>

      {/* ── ВИДАНО ── */}
      <div>
        <SectionHeader label="ВИДАНО БОКСІВ" accent="#10b981" count={counts.issued} />
        {issuedGroups.length === 0
          ? <EmptyState label="Ще немає виданих боксів" />
          : issuedGroups.map(g => <NaryadBlock key={g.orderNum + '-done'} g={g} accentColor="#10b981" actionSlot={null} />)
        }
      </div>
    </div>
  )
}
