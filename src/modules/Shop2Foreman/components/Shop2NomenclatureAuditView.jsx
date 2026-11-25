import React, { useMemo, useState } from 'react'
import { Search, CheckCircle2, AlertTriangle, Edit3, X, SlidersHorizontal } from 'lucide-react'
import { useStore } from '../../../store/index.js'
import { useMES } from '../../../MESContext.jsx'
import {
  getShop2OperationTimings,
  formatShop2PlannedMinutes
} from '../../../utils/shop2RoutingUtils.js'
import {
  getPartShop2RoutingFlags,
  isMissingColumnDbError,
  stripOptionalNomColumns
} from '../../Nomenclature/utils/nomenclatureHelpers.js'
import { Shop2OperationTimingsPanel } from '../../Nomenclature/components/NomenclatureCardModal/Shop2OperationTimingsPanel.jsx'

export const Shop2NomenclatureAuditView = () => {
  const { supabase, fetchData } = useMES()
  const nomenclatures = useStore(state => state.nomenclatures) || []
  const setNomenclatures = useStore(state => state.setNomenclatures)

  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState('all')
  const [editingItem, setEditingItem] = useState(null)

  const partRows = useMemo(() => {
    return (nomenclatures || [])
      .filter(n => !n?.type || n.type === 'part')
      .map(nom => {
        const flags = getPartShop2RoutingFlags(nom)
        const timings = getShop2OperationTimings(nom)
        const shelfCap = flags.paintingUnitsPerShelf || 0

        const missingPressingTime = flags.requiresPressing && timings.pressing <= 0
        const missingPaintingShelf = flags.requiresPainting && shelfCap <= 0
        const missingPaintingTime = flags.requiresPainting && timings.paintingPerCassette <= 0 && timings.painting <= 0
        const noShop2OpsConfigured = !flags.requiresPressing && !flags.requiresPainting && timings.rework <= 0

        const hasMissingData = missingPressingTime || missingPaintingShelf || missingPaintingTime || noShop2OpsConfigured

        return {
          nom,
          flags,
          timings,
          shelfCap,
          missingPressingTime,
          missingPaintingShelf,
          missingPaintingTime,
          noShop2OpsConfigured,
          hasMissingData
        }
      })
      .sort((a, b) => String(a.nom?.name || '').localeCompare(String(b.nom?.name || ''), 'uk'))
  }, [nomenclatures])

  const stats = useMemo(() => {
    const total = partRows.length
    const missing = partRows.filter(r => r.hasMissingData).length
    const complete = total - missing
    const pressingCount = partRows.filter(r => r.flags.requiresPressing).length
    const paintingCount = partRows.filter(r => r.flags.requiresPainting).length
    const reworkCount = partRows.filter(r => r.timings.rework > 0).length
    return { total, missing, complete, pressingCount, paintingCount, reworkCount }
  }, [partRows])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return partRows.filter(row => {
      if (filterMode === 'missing' && !row.hasMissingData) return false
      if (filterMode === 'complete' && row.hasMissingData) return false
      if (filterMode === 'pressing' && !row.flags.requiresPressing) return false
      if (filterMode === 'painting' && !row.flags.requiresPainting) return false
      if (filterMode === 'rework' && row.timings.rework <= 0) return false

      if (!q) return true
      const name = String(row.nom?.name || '').toLowerCase()
      const code = String(row.nom?.nomenclature_code || row.nom?.code || '').toLowerCase()
      return name.includes(q) || code.includes(q)
    })
  }, [partRows, filterMode, search])

  const handleSaveShop2Timings = async ({
    shop2_operation_timings,
    requiresPressing,
    requiresPainting,
    paintingUnitsPerShelf
  }) => {
    if (!editingItem?.id) return
    const normalizedShelfQty =
      requiresPainting && Number(paintingUnitsPerShelf) > 0
        ? Math.floor(Number(paintingUnitsPerShelf))
        : null

    const nextRuleParams = {
      ...(editingItem.rule_params || {}),
      shop2_operation_timings,
      requiresPressing,
      requiresPainting,
      paintingUnitsPerShelf: normalizedShelfQty
    }

    const v2Payload = {
      rule_params: nextRuleParams,
      requires_pressing: requiresPressing,
      requires_painting: requiresPainting,
      painting_units_per_shelf: normalizedShelfQty,
      updated_at: new Date().toISOString()
    }

    let { error: v2Err } = await supabase
      .from('nomenclatures_v2')
      .update(v2Payload)
      .eq('id', editingItem.id)

    if (v2Err && isMissingColumnDbError(v2Err)) {
      const retry = await supabase
        .from('nomenclatures_v2')
        .update(stripOptionalNomColumns(v2Payload))
        .eq('id', editingItem.id)
      v2Err = retry.error
    }

    if (v2Err) {
      console.warn('[Shop2NomenclatureAudit] nomenclatures_v2 update warning:', v2Err)
    }

    try {
      const v1Payload = {
        requires_pressing: requiresPressing,
        requires_painting: requiresPainting,
        painting_units_per_shelf: normalizedShelfQty
      }
      const { error: v1Err } = await supabase.from('nomenclatures').update(v1Payload).eq('id', editingItem.id)
      if (v1Err && isMissingColumnDbError(v1Err)) {
        // Legacy table might not have optional columns
      }
    } catch (_) {}

    const updated = {
      ...editingItem,
      rule_params: nextRuleParams,
      requires_pressing: requiresPressing,
      requires_painting: requiresPainting,
      painting_units_per_shelf: normalizedShelfQty,
      requiresPressing,
      requiresPainting,
      paintingUnitsPerShelf: normalizedShelfQty
    }

    setEditingItem(updated)
    if (typeof setNomenclatures === 'function') {
      setNomenclatures(prev => (prev || []).map(n => (String(n.id) === String(updated.id) ? { ...n, ...updated } : n)))
    }
    if (typeof fetchData === 'function') {
      fetchData(['nomenclatures'], { force: true }).catch(() => {})
    }
    return updated
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '14px 16px' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Всього деталей</div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-strong)', marginTop: '4px' }}>{stats.total}</div>
        </div>
        <div style={{ background: 'var(--surface-1)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: '14px', padding: '14px 16px' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase' }}>Потрібно заповнити</div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#f59e0b', marginTop: '4px' }}>{stats.missing}</div>
        </div>
        <div style={{ background: 'var(--surface-1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '14px', padding: '14px 16px' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#10b981', textTransform: 'uppercase' }}>Повністю готові</div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#10b981', marginTop: '4px' }}>{stats.complete}</div>
        </div>
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '14px 16px' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#a855f7', textTransform: 'uppercase' }}>Пресування / Фарбув.</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-strong)', marginTop: '6px' }}>
            {stats.pressingCount} / {stats.paintingCount}
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginLeft: '6px' }}>
              (дооп.: {stats.reworkCount})
            </span>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '16px',
        padding: '14px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            ['all', `Всі (${stats.total})`],
            ['missing', `Пропуски (${stats.missing})`],
            ['complete', `Готові (${stats.complete})`],
            ['pressing', `Пресування (${stats.pressingCount})`],
            ['painting', `Фарбування (${stats.paintingCount})`],
            ['rework', `Доопрацювання (${stats.reworkCount})`]
          ].map(([key, label]) => {
            const active = filterMode === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilterMode(key)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '10px',
                  border: active ? '1px solid rgba(139, 92, 246, 0.5)' : '1px solid var(--border-subtle)',
                  background: active ? 'rgba(139, 92, 246, 0.14)' : 'var(--surface-inset)',
                  color: active ? '#8b5cf6' : 'var(--text-muted)',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        <div style={{ position: 'relative', minWidth: '250px', flex: '0 1 320px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Пошук по назві або коду деталі..."
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '8px 12px 8px 34px',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface-inset)',
              color: 'var(--text-strong)',
              fontSize: '0.82rem',
              fontWeight: 600,
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '18px',
        overflow: 'hidden'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '920px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--surface-inset)', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.68rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>Номенклатура</th>
                <th style={{ padding: '12px 16px', color: '#a855f7' }}>Пресування</th>
                <th style={{ padding: '12px 16px', color: '#ec4899' }}>Фарбування</th>
                <th style={{ padding: '12px 16px', color: '#f97316' }}>Доопрацювання</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Стан / Дії</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    За вибраними фільтрами деталей не знайдено.
                  </td>
                </tr>
              ) : filteredRows.map(row => {
                const { nom, flags, timings, shelfCap } = row
                const code = nom?.nomenclature_code || nom?.code

                return (
                  <tr key={nom.id} style={{ borderBottom: '1px solid var(--border-subtle)', fontSize: '0.82rem' }}>
                    {/* Номенклатура */}
                    <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: 800, color: 'var(--text-strong)' }}>{nom.name || '—'}</div>
                      {code && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'monospace' }}>
                          {code}
                        </div>
                      )}
                    </td>

                    {/* ПРЕСУВАННЯ */}
                    <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{
                          display: 'inline-block',
                          width: 'fit-content',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          background: flags.requiresPressing ? 'rgba(168, 85, 247, 0.14)' : 'var(--fill-subtle)',
                          color: flags.requiresPressing ? '#a855f7' : 'var(--text-muted)'
                        }}>
                          {flags.requiresPressing ? 'Потрібно' : 'Не потрібно'}
                        </span>
                        {timings.pressing > 0 ? (
                          <div style={{ fontWeight: 800, color: 'var(--text)' }}>
                            {formatShop2PlannedMinutes(timings.pressing)} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>/ шт</span>
                          </div>
                        ) : flags.requiresPressing ? (
                          <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#ef4444' }}>
                            ⚠️ Не вказано час
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>—</div>
                        )}
                      </div>
                    </td>

                    {/* ФАРБУВАННЯ */}
                    <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{
                          display: 'inline-block',
                          width: 'fit-content',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          background: flags.requiresPainting ? 'rgba(236, 72, 153, 0.14)' : 'var(--fill-subtle)',
                          color: flags.requiresPainting ? '#ec4899' : 'var(--text-muted)'
                        }}>
                          {flags.requiresPainting ? 'Потрібно' : 'Не потрібно'}
                        </span>

                        {(shelfCap > 0 || timings.paintingPerCassette > 0 || timings.painting > 0) ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.76rem' }}>
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Касета: </span>
                              {shelfCap > 0 ? (
                                <strong style={{ color: 'var(--text-strong)' }}>{shelfCap} шт/касету</strong>
                              ) : (
                                <strong style={{ color: '#ef4444' }}>⚠️ не вказано</strong>
                              )}
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Час касети: </span>
                              {timings.paintingPerCassette > 0 ? (
                                <strong style={{ color: 'var(--text-strong)' }}>{formatShop2PlannedMinutes(timings.paintingPerCassette)}</strong>
                              ) : timings.painting > 0 ? (
                                <strong style={{ color: 'var(--text-strong)' }}>{formatShop2PlannedMinutes(timings.painting)} / шт</strong>
                              ) : (
                                <strong style={{ color: '#ef4444' }}>⚠️ не вказано</strong>
                              )}
                              {timings.painting > 0 && timings.paintingPerCassette > 0 && (
                                <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>
                                  (~{formatShop2PlannedMinutes(timings.painting)}/шт)
                                </span>
                              )}
                            </div>
                          </div>
                        ) : flags.requiresPainting ? (
                          <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#ef4444' }}>
                            ⚠️ Не вказано касету і час
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>—</div>
                        )}
                      </div>
                    </td>

                    {/* ДООПРАЦЮВАННЯ */}
                    <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                      {timings.rework > 0 ? (
                        <div>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            background: 'rgba(249, 115, 22, 0.14)',
                            color: '#f97316',
                            marginBottom: '4px'
                          }}>
                            Задано
                          </span>
                          <div style={{ fontWeight: 800, color: 'var(--text)' }}>
                            {formatShop2PlannedMinutes(timings.rework)} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>/ шт</span>
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>

                    {/* СТАН / ДІЇ */}
                    <td style={{ padding: '12px 16px', verticalAlign: 'top', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {row.hasMissingData ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 9px',
                            borderRadius: '8px',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            background: 'rgba(245, 158, 11, 0.14)',
                            color: '#f59e0b',
                            border: '1px solid rgba(245, 158, 11, 0.3)'
                          }}>
                            <AlertTriangle size={12} /> {row.noShop2OpsConfigured ? 'Не налаштовано' : 'Є пропуски'}
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 9px',
                            borderRadius: '8px',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            background: 'rgba(16, 185, 129, 0.14)',
                            color: '#10b981',
                            border: '1px solid rgba(16, 185, 129, 0.3)'
                          }}>
                            <CheckCircle2 size={12} /> Заповнено
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => setEditingItem(nom)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--surface-inset)',
                            color: 'var(--text-strong)',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <Edit3 size={13} /> Змінити
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Timings & Cassette Capacity Modal */}
      {editingItem && (
        <div
          onClick={() => setEditingItem(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(6px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '720px',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'var(--surface-1)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '20px',
              padding: '22px',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <SlidersHorizontal size={18} color="#8b5cf6" />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {editingItem.name}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Норми Цеху №2 (Пресування, Фарбування, Касети, Доопрацювання)
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                style={{
                  background: 'var(--surface-inset)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            <Shop2OperationTimingsPanel item={editingItem} onSave={handleSaveShop2Timings} />
          </div>
        </div>
      )}
    </div>
  )
}
