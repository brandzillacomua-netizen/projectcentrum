import React, { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { History, Minus, Plus, RefreshCw, X } from 'lucide-react'
import { supabase } from '../../../supabase'

const formatQty = (val) => {
  const n = Number(val || 0)
  return Number.isInteger(n) ? n.toLocaleString('uk-UA') : n.toLocaleString('uk-UA', { maximumFractionDigits: 2 })
}

const formatDateTime = (iso) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return '—'
  }
}

/** @param {{ currentUser?: any, fetchData?: any, sourceModule?: string }} [params] */
export function useInventoryAdjustment({ currentUser = null, fetchData = undefined, sourceModule = 'warehouse' } = {}) {
  const [targetItem, setTargetItem] = useState(null)
  const [action, setAction] = useState('add') // 'add' | 'subtract'
  const [deltaQty, setDeltaQty] = useState('')
  const [reason, setReason] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const [isJournalOpen, setIsJournalOpen] = useState(false)
  const [journalRows, setJournalRows] = useState([])
  const [journalLoading, setJournalLoading] = useState(false)
  const [journalError, setJournalError] = useState('')

  const openAdjustment = useCallback((item) => {
    setTargetItem(item)
    setAction('add')
    setDeltaQty('')
    setReason('')
    setError('')
  }, [])

  const closeAdjustment = useCallback(() => {
    if (isSaving) return
    setTargetItem(null)
    setError('')
  }, [isSaving])

  const submitAdjustment = useCallback(async (e) => {
    e?.preventDefault()
    if (!targetItem) return
    const qty = Number(deltaQty)
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Введіть коректну кількість більше 0.')
      return
    }
    const actorName = `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim() || currentUser?.login || 'Адміністратор'
    setIsSaving(true)
    setError('')
    try {
      const { error: rpcError } = await supabase.rpc('adjust_inventory_manually', {
        p_inventory_id: targetItem.id,
        p_action: action,
        p_delta_qty: qty,
        p_actor_id: currentUser?.id ? Number(currentUser.id) : null,
        p_actor_name: actorName,
        p_reason: reason.trim() || null,
        p_source_module: sourceModule
      })
      if (rpcError) throw rpcError
      if (typeof fetchData === 'function') {
        await fetchData(['inventory'])
      }
      setTargetItem(null)
    } catch (err) {
      setError(err?.message || 'Не вдалося виконати ручну корекцію.')
    } finally {
      setIsSaving(false)
    }
  }, [targetItem, deltaQty, action, reason, currentUser, sourceModule, fetchData])

  const loadJournal = useCallback(async () => {
    setJournalLoading(true)
    setJournalError('')
    try {
      const { data, error: rpcError } = await supabase.rpc('get_inventory_adjustments_journal', {
        p_limit: 200
      })
      if (rpcError) throw rpcError
      setJournalRows(Array.isArray(data) ? data : [])
    } catch (err) {
      setJournalError(err?.message || 'Не вдалося завантажити журнал корекцій.')
    } finally {
      setJournalLoading(false)
    }
  }, [])

  const openJournal = useCallback(() => {
    setIsJournalOpen(true)
    loadJournal()
  }, [loadJournal])

  const closeJournal = useCallback(() => {
    setIsJournalOpen(false)
  }, [])

  return {
    targetItem,
    action,
    setAction,
    deltaQty,
    setDeltaQty,
    reason,
    setReason,
    isSaving,
    error,
    openAdjustment,
    closeAdjustment,
    submitAdjustment,
    isJournalOpen,
    journalRows,
    journalLoading,
    journalError,
    openJournal,
    closeJournal,
    loadJournal
  }
}

export function InventoryAdjustmentButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="warehouse-nav-btn"
      title="Журнал ручних корекцій залишків"
      style={{
        height: '38px',
        padding: '0 14px',
        borderRadius: '10px',
        border: '1px solid var(--border-subtle)',
        background: 'var(--surface-2)',
        color: '#3b82f6',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '0.78rem',
        fontWeight: 900,
        cursor: 'pointer',
        whiteSpace: 'nowrap'
      }}
    >
      <History size={16} />
      <span className="wh-label-full">ЖУРНАЛ КОРЕКЦІЙ</span>
      <span className="wh-label-short">КОРЕКЦІЇ</span>
    </button>
  )
}

export function InventoryAdjustmentModals({ controller }) {
  const {
    targetItem,
    action,
    setAction,
    deltaQty,
    setDeltaQty,
    reason,
    setReason,
    isSaving,
    error,
    closeAdjustment,
    submitAdjustment,
    isJournalOpen,
    journalRows,
    journalLoading,
    journalError,
    closeJournal,
    loadJournal
  } = controller

  const currentTotal = Number(targetItem?.total_qty || 0)
  const currentReserved = Number(targetItem?.reserved_qty || 0)
  const parsedDelta = Number(deltaQty) || 0
  const previewAfter = action === 'add'
    ? currentTotal + parsedDelta
    : Math.max(0, currentTotal - parsedDelta)

  return (
    <>
      {targetItem && createPortal(
        <div
          onMouseDown={e => e.target === e.currentTarget && closeAdjustment()}
          style={{ position: 'fixed', inset: 0, zIndex: 60000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '18px' }}
        >
          <form
            onSubmit={submitAdjustment}
            style={{ width: 'min(480px, 95vw)', background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '18px', padding: '22px', color: 'var(--text-strong)', boxShadow: '0 24px 70px rgba(0,0,0,0.65)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900 }}>Ручна корекція залишку</h3>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>{targetItem.name}</div>
              </div>
              <button type="button" onClick={closeAdjustment} disabled={isSaving} style={{ background: 'none', border: 0, color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ marginTop: '14px', padding: '12px', borderRadius: '10px', background: 'var(--surface-inset)', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span>Поточний залишок: <strong>{formatQty(currentTotal)} {targetItem.unit}</strong></span>
              <span style={{ color: '#3b82f6' }}>Резерв: <strong>{formatQty(currentReserved)}</strong></span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => setAction('add')}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: '2px solid',
                  borderColor: action === 'add' ? '#10b981' : 'var(--border-subtle)',
                  background: action === 'add' ? 'rgba(16, 185, 129, 0.14)' : 'var(--surface-2)',
                  color: action === 'add' ? '#10b981' : 'var(--text-soft)',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Plus size={16} /> Додати на склад
              </button>
              <button
                type="button"
                onClick={() => setAction('subtract')}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: '2px solid',
                  borderColor: action === 'subtract' ? '#ef4444' : 'var(--border-subtle)',
                  background: action === 'subtract' ? 'rgba(239, 68, 68, 0.14)' : 'var(--surface-2)',
                  color: action === 'subtract' ? '#ef4444' : 'var(--text-soft)',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Minus size={16} /> Відняти зі складу
              </button>
            </div>

            <div style={{ marginTop: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                Кількість ({targetItem.unit || 'шт'})
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                value={deltaQty}
                onChange={e => setDeltaQty(e.target.value)}
                placeholder="Введіть кількість..."
                autoFocus
                style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '9px', border: '1px solid var(--border-subtle)', background: 'var(--surface-inset)', color: 'var(--text-strong)', fontSize: '1rem', fontWeight: 800 }}
              />
              {parsedDelta > 0 && (
                <div style={{ marginTop: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Було: <strong>{formatQty(currentTotal)}</strong> → Стане: <strong style={{ color: action === 'add' ? '#10b981' : '#ef4444' }}>{formatQty(previewAfter)} {targetItem.unit}</strong>
                </div>
              )}
            </div>

            <div style={{ marginTop: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                Причина (необов'язково)
              </label>
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Напр.: Інвентаризація, пересортиця, знайдено залишок..."
                style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '9px', border: '1px solid var(--border-subtle)', background: 'var(--surface-inset)', color: 'var(--text-strong)', fontSize: '0.84rem' }}
              />
            </div>

            {error && <div style={{ marginTop: '10px', color: '#ef4444', fontSize: '0.8rem', fontWeight: 700 }}>{error}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button type="button" onClick={closeAdjustment} disabled={isSaving} style={{ padding: '10px 16px', borderRadius: '9px', border: 0, background: 'var(--surface-3)', color: 'var(--text-soft)', fontWeight: 800, cursor: 'pointer' }}>
                Скасувати
              </button>
              <button
                type="submit"
                disabled={isSaving || parsedDelta <= 0}
                style={{
                  padding: '10px 18px',
                  borderRadius: '9px',
                  border: 0,
                  background: action === 'add' ? '#10b981' : '#ef4444',
                  color: '#fff',
                  fontWeight: 900,
                  cursor: isSaving ? 'wait' : 'pointer',
                  opacity: parsedDelta <= 0 ? 0.5 : 1
                }}
              >
                {isSaving ? 'Збереження...' : (action === 'add' ? 'Підтвердити додавання' : 'Підтвердити віднімання')}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {isJournalOpen && createPortal(
        <div
          onMouseDown={e => e.target === e.currentTarget && closeJournal()}
          style={{ position: 'fixed', inset: 0, zIndex: 60000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '18px' }}
        >
          <div style={{ width: 'min(920px, 96vw)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '18px', overflow: 'hidden', color: 'var(--text-strong)', boxShadow: '0 24px 70px rgba(0,0,0,0.65)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 900, fontSize: '1.05rem' }}>
                <History size={18} color="#3b82f6" />
                Журнал ручних корекцій залишків
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button type="button" onClick={loadJournal} disabled={journalLoading} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--surface-2)', color: 'var(--text-soft)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', fontWeight: 700 }}>
                  <RefreshCw size={14} className={journalLoading ? 'spin' : ''} /> Оновити
                </button>
                <button type="button" onClick={closeJournal} style={{ background: 'none', border: 0, color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 20px' }}>
              {journalError && <div style={{ color: '#ef4444', marginBottom: '10px', fontSize: '0.82rem' }}>{journalError}</div>}
              {journalLoading && journalRows.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Завантаження журналу...</div>
              ) : journalRows.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Ручних корекцій ще не зафіксовано.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '9px 10px' }}>Дата і час</th>
                      <th style={{ padding: '9px 10px' }}>Позиція</th>
                      <th style={{ padding: '9px 10px' }}>Дія</th>
                      <th style={{ padding: '9px 10px', textAlign: 'right' }}>Зміна</th>
                      <th style={{ padding: '9px 10px', textAlign: 'right' }}>Було → Стало</th>
                      <th style={{ padding: '9px 10px' }}>Хто змінив</th>
                      <th style={{ padding: '9px 10px' }}>Причина</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journalRows.map(row => {
                      const isAdd = row.action === 'add'
                      return (
                        <tr key={row.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '9px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDateTime(row.created_at)}</td>
                          <td style={{ padding: '9px 10px', fontWeight: 800 }}>{row.item_name}</td>
                          <td style={{ padding: '9px 10px' }}>
                            <span style={{ padding: '2px 7px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 900, background: isAdd ? 'rgba(16, 185, 129, 0.14)' : 'rgba(239, 68, 68, 0.14)', color: isAdd ? '#10b981' : '#ef4444' }}>
                              {isAdd ? '+ ДОДАНО' : '− ВІДНЯТО'}
                            </span>
                          </td>
                          <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 900, color: isAdd ? '#10b981' : '#ef4444' }}>
                            {isAdd ? '+' : '−'}{formatQty(row.delta_qty)}
                          </td>
                          <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>
                            {formatQty(row.qty_before)} → <strong style={{ color: 'var(--text-strong)' }}>{formatQty(row.qty_after)}</strong>
                          </td>
                          <td style={{ padding: '9px 10px', fontWeight: 700 }}>{row.actor_name}</td>
                          <td style={{ padding: '9px 10px', color: 'var(--text-muted)' }}>{row.reason || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
