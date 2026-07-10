import React, { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, X } from 'lucide-react'

export function ReceptionAcceptanceModal({
  doc,
  nomenclatures = [],
  isProcessing = false,
  onClose,
  onConfirm
}) {
  const initialRows = useMemo(() => {
    return (Array.isArray(doc?.items) ? doc.items : []).map((item, index) => {
      const nom = nomenclatures.find(n => String(n.id) === String(item.nomenclature_id))
      const name = nom
        ? `${nom.name}${nom.material_type ? ` (${nom.material_type})` : ''}`
        : (item.name || item.reqDetails || item.details || `Позиція ${index + 1}`)
      const expected = Number(item.expected_qty ?? item.qty ?? item.missingAmount ?? item.quantity ?? item.needed ?? 0) || 0
      const actual = Number(item.actual_qty ?? item.accepted_qty ?? expected) || 0
      return {
        index,
        name,
        expected,
        actual: String(actual),
        note: item.discrepancy_note || ''
      }
    })
  }, [doc, nomenclatures])

  const [rows, setRows] = useState(initialRows)
  const [generalNote, setGeneralNote] = useState('')

  if (!doc) return null

  const parsedRows = rows.map(row => {
    const actual = Math.max(0, Number(row.actual) || 0)
    return {
      ...row,
      actual,
      diff: actual - row.expected
    }
  })

  const discrepancyRows = parsedRows.filter(row => row.diff !== 0)
  const totalExpected = parsedRows.reduce((sum, row) => sum + row.expected, 0)
  const totalActual = parsedRows.reduce((sum, row) => sum + row.actual, 0)

  const updateRow = (index, patch) => {
    setRows(prev => prev.map(row => row.index === index ? { ...row, ...patch } : row))
  }

  const handleConfirm = async () => {
    await onConfirm({
      actualItems: parsedRows.map(row => ({
        index: row.index,
        actual_qty: row.actual,
        note: row.note
      })),
      note: generalNote
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 12000, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '760px', maxHeight: '90vh', background: '#101010', border: '1px solid #2a2a2a', borderRadius: '22px', overflow: 'hidden', display: 'flex', flexDirection: 'column', color: '#fff' }}>
        <div style={{ padding: '18px 22px', background: '#171717', borderBottom: '1px solid #242424', display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center' }}>
          <div>
            <div style={{ color: '#0ea5e9', fontSize: '0.72rem', fontWeight: 950, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Контрольна прийомка</div>
            <div style={{ fontSize: '1rem', fontWeight: 950, marginTop: '4px' }}>Документ #{String(doc.id).slice(0, 8)}</div>
          </div>
          <button type="button" onClick={onClose} disabled={isProcessing} style={{ background: 'transparent', border: 'none', color: '#888', cursor: isProcessing ? 'not-allowed' : 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        <div style={{ padding: '18px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            <div style={{ background: '#0a0a0a', border: '1px solid #202020', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '0.62rem', color: '#666', fontWeight: 900 }}>ОЧІКУЄТЬСЯ</div>
              <strong style={{ color: '#fff', fontSize: '1.1rem' }}>{totalExpected}</strong>
            </div>
            <div style={{ background: '#0a0a0a', border: '1px solid #202020', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '0.62rem', color: '#666', fontWeight: 900 }}>ФАКТИЧНО</div>
              <strong style={{ color: '#10b981', fontSize: '1.1rem' }}>{totalActual}</strong>
            </div>
            <div style={{ background: discrepancyRows.length ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)', border: `1px solid ${discrepancyRows.length ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.22)'}`, borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '0.62rem', color: discrepancyRows.length ? '#ef4444' : '#10b981', fontWeight: 900 }}>РОЗБІЖНОСТІ</div>
              <strong style={{ color: discrepancyRows.length ? '#ef4444' : '#10b981', fontSize: '1.1rem' }}>{discrepancyRows.length}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {rows.map(row => {
              const actual = Math.max(0, Number(row.actual) || 0)
              const diff = actual - row.expected
              const hasDiff = diff !== 0
              return (
                <div key={row.index} style={{ background: '#080808', border: hasDiff ? '1px solid rgba(239,68,68,0.35)' : '1px solid #1f1f1f', borderRadius: '12px', padding: '12px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 110px 120px 105px', gap: '10px', alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.78rem', color: '#ddd', fontWeight: 800, wordBreak: 'break-word' }}>{row.name}</div>
                    {hasDiff && (
                      <input
                        value={row.note}
                        onChange={e => updateRow(row.index, { note: e.target.value })}
                        placeholder="Коментар до розбіжності..."
                        style={{ marginTop: '8px', width: '100%', boxSizing: 'border-box', background: '#000', border: '1px solid #242424', color: '#fff', borderRadius: '8px', padding: '7px 9px', fontSize: '0.72rem', outline: 'none' }}
                      />
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.58rem', color: '#666', fontWeight: 900 }}>ДОКУМЕНТ</div>
                    <strong>{row.expected}</strong>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.58rem', color: '#666', fontWeight: 900 }}>ФАКТ</div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.actual}
                      onChange={e => updateRow(row.index, { actual: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', background: '#000', border: hasDiff ? '1px solid #ef4444' : '1px solid #333', color: '#fff', borderRadius: '8px', padding: '8px 10px', fontWeight: 900, outline: 'none' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.58rem', color: '#666', fontWeight: 900 }}>РІЗНИЦЯ</div>
                    <strong style={{ color: diff < 0 ? '#ef4444' : (diff > 0 ? '#f59e0b' : '#10b981') }}>
                      {diff > 0 ? `+${diff}` : diff}
                    </strong>
                  </div>
                </div>
              )
            })}
          </div>

          {discrepancyRows.length > 0 && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.24)', borderRadius: '12px', padding: '12px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: '0.76rem', color: '#fca5a5', lineHeight: 1.45 }}>
                Після підтвердження буде оприбутковано тільки фактичну кількість. Різниця залишиться в документі як акт розбіжності.
              </div>
            </div>
          )}

          <textarea
            value={generalNote}
            onChange={e => setGeneralNote(e.target.value)}
            placeholder="Загальний коментар до прийомки..."
            style={{ minHeight: '70px', resize: 'vertical', background: '#050505', border: '1px solid #222', color: '#fff', borderRadius: '10px', padding: '10px 12px', outline: 'none', fontFamily: 'inherit' }}
          />
        </div>

        <div style={{ padding: '16px 22px', background: '#171717', borderTop: '1px solid #242424', display: 'flex', gap: '12px' }}>
          <button type="button" onClick={onClose} disabled={isProcessing} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: '#262626', color: '#fff', border: 'none', fontWeight: 900, cursor: isProcessing ? 'not-allowed' : 'pointer' }}>
            Скасувати
          </button>
          <button type="button" onClick={handleConfirm} disabled={isProcessing} style={{ flex: 2, padding: '12px', borderRadius: '10px', background: discrepancyRows.length ? '#ef4444' : '#10b981', color: '#000', border: 'none', fontWeight: 950, cursor: isProcessing ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', opacity: isProcessing ? 0.6 : 1 }}>
            <CheckCircle2 size={17} /> {isProcessing ? 'Приймаємо...' : (discrepancyRows.length ? 'Прийняти з актом розбіжності' : 'Прийняти без розбіжностей')}
          </button>
        </div>
      </div>
    </div>
  )
}
