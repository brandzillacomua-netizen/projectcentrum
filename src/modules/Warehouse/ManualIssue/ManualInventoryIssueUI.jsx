import { History, PackageMinus, X } from 'lucide-react'

const overlay = {
  position: 'fixed', inset: 0, zIndex: 10100, padding: '20px',
  background: 'rgba(0,0,0,0.9)', display: 'flex',
  alignItems: 'center', justifyContent: 'center'
}

const formatQty = value => Number(value || 0).toLocaleString('uk-UA')

export function ManualIssueJournalButton({ onClick, compact = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="warehouse-nav-btn manual-issue-btn"
      title="Журнал ручної видачі"
      style={{
        height: '42px',
        padding: compact ? '0 12px' : '0 16px',
        borderRadius: '12px',
        border: '1px solid #333',
        background: '#161616',
        color: '#f59e0b',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '0.8rem',
        fontWeight: 900,
        cursor: 'pointer',
        whiteSpace: 'nowrap'
      }}
    >
      <History size={17} /> {!compact && 'РУЧНА ВИДАЧА'}
    </button>
  )
}

export function ManualInventoryIssueUI({ controller }) {
  const {
    selectedNomenclature, quantity, setQuantity, available, isSubmitting,
    error, success, journalOpen, journalRows, journalLoading,
    closeIssue, submitIssue, closeJournal
  } = controller

  return (
    <>
      {selectedNomenclature && (
        <div style={overlay}>
          <form
            onSubmit={submitIssue}
            style={{ width: '100%', maxWidth: '460px', background: '#111', border: '1px solid #333', borderRadius: '24px', overflow: 'hidden' }}
          >
            <div style={{ padding: '18px 20px', background: '#191919', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ color: '#f59e0b', display: 'flex', gap: '9px', alignItems: 'center' }}>
                <PackageMinus size={20} /> РУЧНА ВИДАЧА
              </strong>
              <button type="button" onClick={closeIssue} disabled={isSubmitting} style={{ background: 'none', border: 0, color: '#888', cursor: 'pointer' }}>
                <X size={22} />
              </button>
            </div>
            <div style={{ padding: '22px', display: 'grid', gap: '16px' }}>
              <div>
                <div style={{ color: '#fff', fontSize: '1.05rem', fontWeight: 900 }}>{selectedNomenclature.name}</div>
                {selectedNomenclature.material_type && <div style={{ color: '#888', marginTop: '4px' }}>{selectedNomenclature.material_type}</div>}
              </div>
              <div style={{ padding: '12px 14px', borderRadius: '12px', background: '#080808', color: '#aaa' }}>
                Вільний залишок на СО: <strong style={{ color: '#10b981' }}>{formatQty(available)} {selectedNomenclature.unit || 'шт'}</strong>
              </div>
              <label style={{ display: 'grid', gap: '7px', color: '#777', fontSize: '0.72rem', fontWeight: 900 }}>
                КІЛЬКІСТЬ ДО ВИДАЧІ
                <input
                  autoFocus
                  inputMode="decimal"
                  type="number"
                  min="0"
                  step="any"
                  max={available}
                  value={quantity}
                  onChange={event => setQuantity(event.target.value)}
                  placeholder="Наприклад, 4"
                  style={{ padding: '15px', borderRadius: '12px', border: '1px solid #333', background: '#050505', color: '#fff', fontSize: '1.1rem', outline: 'none' }}
                />
              </label>
              {error && <div style={{ color: '#ef4444', fontWeight: 800, fontSize: '0.82rem' }}>{error}</div>}
              {success && (
                <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(16,185,129,.12)', color: '#10b981', fontWeight: 850 }}>
                  Видано {formatQty(success.quantity)} {success.unit}. Залишок: {formatQty(success.stock_after)} {success.unit}.
                </div>
              )}
              <button
                type="submit"
                disabled={isSubmitting || !quantity || Number(quantity) <= 0 || Number(quantity) > available}
                style={{
                  padding: '15px', borderRadius: '12px', border: 0,
                  background: '#f59e0b', color: '#080808', fontWeight: 950,
                  cursor: 'pointer', opacity: isSubmitting ? 0.65 : 1
                }}
              >
                {isSubmitting ? 'ВИДАЄМО…' : 'ПІДТВЕРДИТИ ВИДАЧУ'}
              </button>
            </div>
          </form>
        </div>
      )}

      {journalOpen && (
        <div style={overlay}>
          <div style={{ width: '100%', maxWidth: '920px', maxHeight: '85vh', background: '#111', border: '1px solid #333', borderRadius: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 20px', background: '#191919', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ color: '#f59e0b', display: 'flex', gap: '9px', alignItems: 'center' }}><History size={20} /> ЖУРНАЛ РУЧНОЇ ВИДАЧІ</strong>
              <button type="button" onClick={closeJournal} style={{ background: 'none', border: 0, color: '#888', cursor: 'pointer' }}><X size={22} /></button>
            </div>
            <div style={{ overflow: 'auto', padding: '10px 18px 20px' }}>
              {journalLoading ? (
                <div style={{ padding: '35px', color: '#777', textAlign: 'center' }}>Завантаження…</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
                  <thead>
                    <tr style={{ color: '#666', fontSize: '0.68rem', textAlign: 'left' }}>
                      <th style={{ padding: '12px 8px' }}>ДАТА / ЧАС</th>
                      <th style={{ padding: '12px 8px' }}>НОМЕНКЛАТУРА</th>
                      <th style={{ padding: '12px 8px' }}>КОРИСТУВАЧ</th>
                      <th style={{ padding: '12px 8px' }}>ВИДАНО</th>
                      <th style={{ padding: '12px 8px' }}>ЗАЛИШОК</th>
                      <th style={{ padding: '12px 8px' }}>МОДУЛЬ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journalRows.map(row => (
                      <tr key={row.id} style={{ borderTop: '1px solid #222', color: '#ddd', fontSize: '0.8rem' }}>
                        <td style={{ padding: '13px 8px', whiteSpace: 'nowrap' }}>{new Date(row.created_at).toLocaleString('uk-UA')}</td>
                        <td style={{ padding: '13px 8px', fontWeight: 850 }}>{row.nomenclature_name}</td>
                        <td style={{ padding: '13px 8px' }}>{row.issued_by_name}</td>
                        <td style={{ padding: '13px 8px', color: '#f59e0b', fontWeight: 900 }}>{formatQty(row.quantity)} {row.unit}</td>
                        <td style={{ padding: '13px 8px' }}>{formatQty(row.stock_after)} {row.unit}</td>
                        <td style={{ padding: '13px 8px', color: '#777' }}>{row.source_module === 'warehouse_boxes' ? 'Бокси фрез' : 'Склад оперативний'}</td>
                      </tr>
                    ))}
                    {journalRows.length === 0 && (
                      <tr><td colSpan={6} style={{ padding: '35px', textAlign: 'center', color: '#666' }}>Ручних видач ще немає.</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
