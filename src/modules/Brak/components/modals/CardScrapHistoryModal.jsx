import React, { useEffect, useState } from 'react'
import { X, Layers, AlertTriangle, User, Calendar, CheckCircle2, Clock, ShieldAlert } from 'lucide-react'
import { supabase } from '../../../../supabase'

export const CardScrapHistoryModal = ({ card, cardInfo, onClose }) => {
  const targetCard = card || cardInfo
  const [loading, setLoading] = useState(true)
  const [historyRows, setHistoryRows] = useState([])
  const [classifications, setClassifications] = useState([])

  useEffect(() => {
    if (!targetCard?.id) return

    let isMounted = true
    setLoading(true)

    async function loadScrapPortions() {
      try {
        const { data: rows, error: rowsErr } = await supabase
          .from('work_card_history')
          .select('*')
          .eq('card_id', targetCard.id)
          .gt('scrap_qty', 0)
          .order('created_at', { ascending: false })

        if (rowsErr) throw rowsErr
        if (!isMounted) return

        setHistoryRows(rows || [])

        const historyIds = (rows || []).map(r => r.id).filter(Boolean)
        if (historyIds.length > 0) {
          const { data: classData } = await supabase
            .from('scrap_classifications')
            .select('*')
            .in('source_history_id', historyIds)

          if (isMounted) setClassifications(classData || [])
        } else {
          if (isMounted) setClassifications([])
        }
      } catch (err) {
        console.error('Failed to load card scrap history portions:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadScrapPortions()
    return () => { isMounted = false }
  }, [targetCard?.id])

  if (!targetCard) return null

  const cardCode = targetCard.id ? String(targetCard.id).slice(-8).toUpperCase() : '—'
  const cardLabelMatch = String(targetCard.card_info || '').match(/№\s*(\d+(?:\/\d+)?)/)
  const cardSeqLabel = cardLabelMatch ? `№${cardLabelMatch[1]}` : (targetCard.card_sequence ? `№${targetCard.card_sequence}` : `#${cardCode}`)

  const totalScrapQty = historyRows.reduce((sum, r) => sum + (Number(r.scrap_qty) || 0), 0)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 20000,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card-bg, #0d0d0d)',
          borderRadius: '28px',
          border: '1px solid #f9731650',
          padding: '28px',
          boxShadow: '0 25px 80px rgba(0,0,0,0.9)',
          width: '100%',
          maxWidth: '750px',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
          boxSizing: 'border-box'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid var(--border-color, var(--border-subtle))', paddingBottom: '16px' }}>
          <div>
            <div style={{ color: '#f97316', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldAlert size={15} /> ІСТОРІЯ ПОРЦІЙ БРАКУ ПО КАРТЦІ
            </div>
            <h3 style={{ margin: '6px 0 0', fontSize: '1.4rem', fontWeight: 950, color: 'var(--text-color, #fff)' }}>
              Картка {cardSeqLabel} <small style={{ color: 'var(--text-muted, #777)', fontSize: '0.8rem', fontWeight: 800 }}>({cardCode})</small>
            </h3>
            {targetCard.card_info && (
              <div style={{ color: 'var(--text-muted, #666)', fontSize: '0.72rem', marginTop: '4px', fontWeight: 800 }}>
                {targetCard.card_info}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--btn-ghost-bg, #1c1c1c)',
              border: 'none',
              color: 'var(--text-muted, #888)',
              cursor: 'pointer',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Summary Card */}
        <div style={{
          background: 'rgba(249, 115, 22, 0.08)',
          border: '1px solid rgba(249, 115, 22, 0.25)',
          borderRadius: '18px',
          padding: '16px 20px',
          marginBottom: '25px',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '15px'
        }}>
          <div>
            <div style={{ color: '#f97316', fontWeight: 950, fontSize: '0.85rem' }}>ЗАГАЛЬНИЙ НАКОПИЧЕНИЙ БРАК</div>
            <div style={{ color: 'var(--text-muted, #888)', fontSize: '0.75rem', marginTop: '3px' }}>
              Кількість порцій: <strong>{historyRows.length}</strong>
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 1000, color: '#f97316' }}>
            {totalScrapQty} <small style={{ fontSize: '0.8rem', color: '#fff', opacity: 0.6 }}>шт</small>
          </div>
        </div>

        {/* Portions Timeline */}
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted, #777)', fontSize: '0.9rem', fontWeight: 850 }}>
            Завантаження порцій браку...
          </div>
        ) : historyRows.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted, #555)', background: 'var(--card-bg, #080808)', borderRadius: '16px', border: '1px dashed var(--border-color, #222)' }}>
            Для цієї картки не знайдено записів про фіксацію браку
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {historyRows.map((row, idx) => {
              const rowClassifications = classifications.filter(c => c.source_history_id === row.id)
              const classifiedQty = rowClassifications.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
              const isFullyClassified = classifiedQty >= Number(row.scrap_qty || 0)

              let catsInfo = []
              if (row.qc_scrap_comment && row.qc_scrap_comment.includes('SCRAP_CAT:')) {
                try {
                  const m = row.qc_scrap_comment.match(/\[SCRAP_CAT:([^\]]+)\]/)
                  if (m) {
                    const parsed = JSON.parse(m[1])
                    Object.entries(parsed).forEach(([cat, qty]) => {
                      if (Number(qty) > 0) {
                        const catLabel = cat === 'cat1' ? 'Кат 1 (Ремонт)' : cat === 'cat2' ? 'Кат 2 (Доопрацювання)' : cat === 'cat3' ? 'Кат 3 (Брак постачальника)' : cat === 'cat4' ? 'Кат 4 (Утиль)' : cat === 'restoration' ? 'Відновлення' : cat
                        catsInfo.push(`${catLabel}: ${qty} шт`)
                      }
                    })
                  }
                } catch (e) {}
              }

              return (
                <div
                  key={row.id || idx}
                  style={{
                    background: 'var(--card-inner-bg, #111)',
                    borderRadius: '18px',
                    padding: '18px 20px',
                    border: '1px solid var(--border-color, var(--border-subtle))',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        background: '#f9731615',
                        border: '1px solid #f9731650',
                        color: '#f97316',
                        padding: '6px 14px',
                        borderRadius: '12px',
                        fontWeight: 1000,
                        fontSize: '1.1rem'
                      }}>
                        +{row.scrap_qty} шт
                      </span>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: '0.95rem', color: 'var(--text-color, #fff)' }}>
                          {row.stage_name || 'Операція'}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#8b5cf6', fontWeight: 850, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <User size={12} /> Оператор: {row.operator_name || 'Не вказано'}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', fontSize: '0.7rem', color: 'var(--text-muted, #777)', fontWeight: 800 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                        <Clock size={12} /> {new Date(row.completed_at || row.created_at).toLocaleString('uk-UA')}
                      </div>
                    </div>
                  </div>

                  {/* Status & Classification Breakdown */}
                  <div style={{
                    background: 'var(--card-bg, #080808)',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    fontSize: '0.72rem',
                    fontWeight: 850,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                    border: '1px solid var(--border-color, #222)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isFullyClassified ? (
                        <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <CheckCircle2 size={14} /> Класифіковано ВКЯ
                        </span>
                      ) : (
                        <span style={{ color: '#eab308', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Clock size={14} /> Очікує рішення ВКЯ (Карантин)
                        </span>
                      )}
                    </div>

                    {catsInfo.length > 0 && (
                      <div style={{ color: '#38bdf8' }}>
                        {catsInfo.join(' · ')}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer close */}
        <div style={{ marginTop: '25px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              background: 'var(--btn-ghost-bg, #222)',
              border: '1px solid var(--border-color, #333)',
              color: 'var(--text-color, #fff)',
              padding: '12px 24px',
              borderRadius: '14px',
              fontWeight: 900,
              cursor: 'pointer'
            }}
          >
            Закрити
          </button>
        </div>
      </div>
    </div>
  )
}
