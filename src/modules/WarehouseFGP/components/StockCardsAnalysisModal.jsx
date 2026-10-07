import React, { useState, useEffect, useMemo } from 'react'
import { X, Search, Layers, Copy, Check, CheckCircle2, Calendar, User, FileText } from 'lucide-react'
import { useMES } from '../../../MESContext'

export function StockCardsAnalysisModal({
  item,
  receiptRows = [],
  nomenclatures = [],
  onClose
}) {
  const { theme } = useMES()
  const isLight = theme === 'light' || (typeof document !== 'undefined' && document.body.classList.contains('light-theme'))
  const isDark = !isLight

  const [modalSearch, setModalSearch] = useState('')
  const [copiedId, setCopiedId] = useState(null)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const linkedNom = useMemo(() => {
    if (!item?.nomenclature_id) return null
    return (nomenclatures || []).find(n =>
      String(n.id) === String(item.nomenclature_id) ||
      (n.legacy_ids || []).some(id => String(id) === String(item.nomenclature_id))
    )
  }, [item?.nomenclature_id, nomenclatures])

  const itemCode = linkedNom?.code || ''
  const itemNameNormalized = (item?.name || '').trim().toLowerCase()

  // Find all receipt rows that contributed to this stock item
  const matchingReceipts = useMemo(() => {
    if (!item) return []

    return receiptRows.filter(r => {
      // Match by detail code if available
      if (itemCode && r.detailCode && r.detailCode.trim().toLowerCase() === itemCode.toLowerCase()) {
        return true
      }
      // Match by detail name
      if (r.detailName && r.detailName.trim().toLowerCase() === itemNameNormalized) {
        return true
      }
      // Match by nomenclature ID if present
      if (r.nomenclature_id && item.nomenclature_id && String(r.nomenclature_id) === String(item.nomenclature_id)) {
        return true
      }
      return false
    })
  }, [receiptRows, item, itemCode, itemNameNormalized])

  // Filter matching receipts by internal modal search query
  const filteredReceipts = useMemo(() => {
    if (!modalSearch.trim()) return matchingReceipts
    const q = modalSearch.trim().toLowerCase()
    return matchingReceipts.filter(r =>
      (r.detailName || '').toLowerCase().includes(q) ||
      (r.detailCode || '').toLowerCase().includes(q) ||
      (r.cardId || '').toLowerCase().includes(q) ||
      (r.orderNumber || '').toLowerCase().includes(q) ||
      (r.operatorName || '').toLowerCase().includes(q) ||
      (r.source || '').toLowerCase().includes(q)
    )
  }, [matchingReceipts, modalSearch])

  const totalFromReceipts = useMemo(() => {
    return matchingReceipts.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)
  }, [matchingReceipts])

  const handleCopyId = (idText) => {
    if (!idText) return
    navigator.clipboard.writeText(idText)
    setCopiedId(idText)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (!item) return null

  const t = {
    modalBg: isDark ? '#12141c' : '#ffffff',
    border: isDark ? '#232938' : '#cbd5e1',
    textPrimary: isDark ? '#f8fafc' : '#0f172a',
    textSecondary: isDark ? '#94a3b8' : '#64748b',
    textMuted: isDark ? '#64748b' : '#94a3b8',
    cardBg: isDark ? '#1a1e2b' : '#f8fafc',
    headBg: isDark ? '#161924' : '#f1f5f9',
    rowBorder: isDark ? '#1f2430' : '#e2e8f0',
    accentGreen: isDark ? '#34d399' : '#059669',
    accentGreenBg: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5',
    accentGreenBorder: isDark ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0',
    inputBg: isDark ? '#1a1e2b' : '#ffffff',
    inputBorder: isDark ? '#2d3748' : '#cbd5e1'
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: isDark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(15, 23, 42, 0.6)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      backdropFilter: 'blur(5px)'
    }}>
      <div style={{
        background: t.modalBg,
        border: `1.5px solid ${t.border}`,
        borderRadius: '24px',
        padding: '30px',
        width: '100%',
        maxWidth: '850px',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '90vh',
        boxShadow: isDark ? '0 20px 60px rgba(0, 0, 0, 0.7)' : '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h3 style={{ color: t.accentGreen, margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.25rem', fontWeight: 950 }}>
              <Layers size={22} /> КАРТКИ НАПОВНЕННЯ СГП
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.98rem', color: t.textPrimary, fontWeight: 900 }}>
                {item.name}
              </span>
              {itemCode && (
                <span style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
                  color: t.textSecondary,
                  fontWeight: 800
                }}>
                  Артикул: {itemCode}
                </span>
              )}
            </div>
          </div>

          <button 
            onClick={onClose}
            style={{
              background: isDark ? '#1a1e2b' : '#f1f5f9',
              border: `1px solid ${isDark ? '#2d3748' : '#cbd5e1'}`,
              color: t.textSecondary,
              borderRadius: '50%',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: '0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = isDark ? '#2d3748' : '#e2e8f0'; e.currentTarget.style.color = t.textPrimary }}
            onMouseLeave={e => { e.currentTarget.style.background = isDark ? '#1a1e2b' : '#f1f5f9'; e.currentTarget.style.color = t.textSecondary }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Top Summary Banner */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          marginBottom: '20px'
        }}>
          <div style={{
            background: t.cardBg,
            border: `1px solid ${t.rowBorder}`,
            borderRadius: '16px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: t.accentGreenBg,
              border: `1px solid ${t.accentGreenBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: t.accentGreen
            }}>
              <CheckCircle2 size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: t.textSecondary, fontWeight: 800, textTransform: 'uppercase' }}>
                Поточний залишок SGP
              </div>
              <div style={{ fontSize: '1.2rem', color: t.textPrimary, fontWeight: 1000, marginTop: '2px' }}>
                {Number(item.total_qty || 0).toLocaleString('uk-UA')} <small style={{ fontSize: '0.78rem', color: t.textSecondary }}>{item.unit || 'шт'}</small>
              </div>
            </div>
          </div>

          <div style={{
            background: t.cardBg,
            border: `1px solid ${t.rowBorder}`,
            borderRadius: '16px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: isDark ? 'rgba(56, 189, 248, 0.12)' : '#f0f9ff',
              border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.3)' : '#bae6fd'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isDark ? '#38bdf8' : '#0284c7'
            }}>
              <FileText size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: t.textSecondary, fontWeight: 800, textTransform: 'uppercase' }}>
                Обліковано з карточок
              </div>
              <div style={{ fontSize: '1.2rem', color: isDark ? '#38bdf8' : '#0284c7', fontWeight: 1000, marginTop: '2px' }}>
                {totalFromReceipts.toLocaleString('uk-UA')} <small style={{ fontSize: '0.78rem', color: t.textSecondary }}>{item.unit || 'шт'}</small>
              </div>
            </div>
          </div>

          <div style={{
            background: t.cardBg,
            border: `1px solid ${t.rowBorder}`,
            borderRadius: '16px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: isDark ? 'rgba(245, 158, 11, 0.12)' : '#fffbeb',
              border: `1px solid ${isDark ? 'rgba(245, 158, 11, 0.3)' : '#fde68a'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isDark ? '#fbbf24' : '#b45309'
            }}>
              <Calendar size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: t.textSecondary, fontWeight: 800, textTransform: 'uppercase' }}>
                Кількість надходжень
              </div>
              <div style={{ fontSize: '1.2rem', color: isDark ? '#fbbf24' : '#b45309', fontWeight: 1000, marginTop: '2px' }}>
                {matchingReceipts.length} <small style={{ fontSize: '0.78rem', color: t.textSecondary }}>записів</small>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Search Bar */}
        {matchingReceipts.length > 5 && (
          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: t.textMuted }} />
            <input
              type="text"
              placeholder="Пошук по № картки, наряду, оператору чи цеху..."
              value={modalSearch}
              onChange={e => setModalSearch(e.target.value)}
              style={{
                width: '100%',
                background: t.inputBg,
                border: `1.5px solid ${t.inputBorder}`,
                borderRadius: '12px',
                padding: '8px 12px 8px 36px',
                color: t.textPrimary,
                fontSize: '0.82rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
        )}

        {/* Table Content */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px', borderRadius: '14px', border: `1px solid ${t.border}` }}>
          {filteredReceipts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: t.textSecondary, background: t.cardBg }}>
              {matchingReceipts.length === 0 ? (
                <>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, marginBottom: '6px' }}>
                    Надходжень по робочих картках не знайдено
                  </div>
                  <div style={{ fontSize: '0.78rem', color: t.textMuted }}>
                    Залишок міг бути зафіксований вручну під час інвентаризації або до впровадження автоматичного обліку випуску.
                  </div>
                </>
              ) : (
                <div style={{ fontSize: '0.85rem' }}>За вказаним пошуковим запитом карток не знайдено</div>
              )}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: t.headBg, borderBottom: `1.5px solid ${t.border}`, color: t.textSecondary, fontWeight: 800, fontSize: '0.74rem' }}>
                  <th style={{ padding: '12px' }}>ДАТА / ЧАС</th>
                  <th style={{ padding: '12px' }}>КАРТКА ID</th>
                  <th style={{ padding: '12px' }}>НАРЯД</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>КІЛЬКІСТЬ</th>
                  <th style={{ padding: '12px' }}>ЗВІДКИ НАДІЙШЛО</th>
                  <th style={{ padding: '12px' }}>ОПЕРАТОР</th>
                </tr>
              </thead>
              <tbody>
                {filteredReceipts.map((receipt, idx) => {
                  const fullCardId = String(receipt.cardId || receipt.id)
                  const shortCardId = `#${fullCardId.slice(-8).toUpperCase()}`
                  const isCopied = copiedId === fullCardId

                  return (
                    <tr key={receipt.id || idx} style={{ borderBottom: `1px solid ${t.rowBorder}`, background: idx % 2 === 0 ? 'transparent' : (isDark ? 'rgba(255,255,255,0.015)' : '#f8fafc') }}>
                      <td style={{ padding: '12px', color: t.textSecondary, whiteSpace: 'nowrap', fontWeight: 700 }}>
                        {receipt.timestamp ? new Date(receipt.timestamp).toLocaleString('uk-UA', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : '—'}
                      </td>
                      <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => handleCopyId(fullCardId)}
                          style={{
                            background: isDark ? 'rgba(52, 211, 153, 0.1)' : '#ecfdf5',
                            border: `1px solid ${isDark ? 'rgba(52, 211, 153, 0.3)' : '#a7f3d0'}`,
                            color: isDark ? '#34d399' : '#059669',
                            borderRadius: '8px',
                            padding: '3px 8px',
                            fontSize: '0.78rem',
                            fontWeight: 900,
                            fontFamily: 'monospace',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title={`Натисніть для копіювання повного ID: ${fullCardId}`}
                        >
                          <span>{shortCardId}</span>
                          {isCopied ? <Check size={12} color="#10b981" /> : <Copy size={11} style={{ opacity: 0.6 }} />}
                        </button>
                      </td>
                      <td style={{ padding: '12px', color: t.textPrimary, fontWeight: 900, whiteSpace: 'nowrap' }}>
                        {receipt.orderNumber ? `№${receipt.orderNumber}${receipt.batchIndex ? `/${receipt.batchIndex}` : ''}` : '—'}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-flex',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          background: t.accentGreenBg,
                          border: `1px solid ${t.accentGreenBorder}`,
                          color: t.accentGreen,
                          fontWeight: 950,
                          fontSize: '0.86rem'
                        }}>
                          +{Number(receipt.quantity || 0).toLocaleString('uk-UA')} {item.unit || 'шт'}
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: t.textPrimary, fontWeight: 750 }}>
                        {receipt.source}
                      </td>
                      <td style={{ padding: '12px', color: t.textSecondary, fontWeight: 700 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <User size={13} style={{ opacity: 0.7 }} />
                          <span>{receipt.operatorName || 'Система'}</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: `1.5px solid ${t.rowBorder}`, paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '0.78rem', color: t.textSecondary, fontWeight: 700 }}>
            Всього відображено: <strong style={{ color: t.textPrimary }}>{filteredReceipts.length}</strong> карток з сумою <strong style={{ color: t.accentGreen }}>{filteredReceipts.reduce((s, r) => s + (Number(r.quantity) || 0), 0).toLocaleString('uk-UA')} {item.unit || 'шт'}</strong>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#10b981',
              color: '#ffffff',
              border: 'none',
              padding: '10px 24px',
              borderRadius: '12px',
              fontWeight: 900,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
              transition: '0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#059669'}
            onMouseLeave={e => e.currentTarget.style.background = '#10b981'}
          >
            ЗАКРИТИ
          </button>
        </div>

      </div>
    </div>
  )
}
