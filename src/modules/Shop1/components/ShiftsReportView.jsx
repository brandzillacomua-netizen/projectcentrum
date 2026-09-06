import React, { useRef } from 'react'
import { Calendar } from 'lucide-react'
import { useVirtualizer } from '@tanstack/react-virtual'

const ShiftReportDetailRow = React.memo(({ card, nomenclatures }) => {
  const nom = nomenclatures?.find(n => n.id === card.nomenclature_id)
  const dateText = new Date(card.completed_at || card.started_at || card.created_at).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  const opField = String(card.operation || card.stage_name || '')
  const isGalt = opField.startsWith('Галтовка') || opField === 'Галтовка'
  const opLabel = isGalt
    ? { label: '🌀 ГАЛТОВКА', bg: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.25)' }
    : { label: '✂️ РОЗКРІЙ', bg: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }
  const subStage = opField.match(/\(([^)]+)\)/)?.[1]

  return (
    <div className="shift-report-detail-item" style={{
      borderRadius: '16px',
      padding: '14px 16px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '15px'
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', flexWrap: 'wrap' }}>
          <span style={{
            background: opLabel.bg,
            color: opLabel.color,
            border: opLabel.border,
            borderRadius: '6px',
            padding: '2px 8px',
            fontSize: '0.58rem',
            fontWeight: 900,
            letterSpacing: '0.05em',
            flexShrink: 0
          }}>
            {opLabel.label}
            {subStage && <span style={{ opacity: 0.7, marginLeft: '4px' }}>({subStage})</span>}
          </span>
          <span className="card-detail-nom-name" style={{ fontWeight: 800, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nom?.name || '—'}
          </span>
        </div>
        <div className="card-detail-meta" style={{ fontSize: '0.63rem', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>#{card.id?.slice(-8).toUpperCase()}</span>
          <span>•</span>
          <span>Оператор: <strong>{card.operator_name || 'Не вказано'}</strong></span>
          {(card.machine || card.machine_name) && (card.machine || card.machine_name) !== 'Не вказано' && (
            <>
              <span>•</span>
              <span>{card.machine || card.machine_name}</span>
            </>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontWeight: 950, fontSize: '0.9rem', color: '#eab308' }}>{card.quantity || card.qty_completed || 0} шт</div>
        <div className="card-detail-date" style={{ fontSize: '0.62rem', marginTop: '2px', fontWeight: 700 }}>{dateText}</div>
      </div>
    </div>
  )
})

const ShiftReportDetailList = ({ cards, nomenclatures }) => {
  const parentRef = useRef(null)

  const isVirtualized = cards.length > 25

  const rowVirtualizer = useVirtualizer({
    count: cards.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 5
  })

  if (!isVirtualized) {
    return (
      <div style={{ padding: '20px 25px', overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {cards.map((card, idx) => (
          <ShiftReportDetailRow key={card.id || idx} card={card} nomenclatures={nomenclatures} />
        ))}
      </div>
    )
  }

  return (
    <div ref={parentRef} style={{ padding: '20px 25px', overflowY: 'auto', flexGrow: 1 }}>
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map(virtualRow => {
          const card = cards[virtualRow.index]
          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              <ShiftReportDetailRow card={card} nomenclatures={nomenclatures} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const ShiftsReportView = ({
  reportStartDate,
  setReportStartDate,
  reportEndDate,
  setReportEndDate,
  quickPeriod,
  setQuickPeriod,
  handleQuickDateSelect,
  shiftReportLoading,
  shiftStats,
  selectedReportDetails,
  setSelectedReportDetails,
  nomenclatures
}) => {
  return (
    <div className="shifts-report-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.2s ease' }}>
      {/* Filter Panel */}
      <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px' }}>
        <div className="report-filter-panel" style={{ display: 'flex', alignItems: 'center', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 15px' }} className="filter-label-box">
            <Calendar size={14} color="#888" style={{ marginRight: '8px' }} />
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 800 }}>Період:</span>
          </div>
          <input
            type="date"
            value={reportStartDate}
            onClick={(e) => e.target.showPicker && e.target.showPicker()}
            onChange={(e) => { setReportStartDate(e.target.value); setQuickPeriod(''); }}
            className="report-filter-input"
            style={{ background: 'transparent', border: 'none', padding: '12px 15px', fontSize: '0.85rem', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          />
          <span className="date-sep">—</span>
          <input
            type="date"
            value={reportEndDate}
            onClick={(e) => e.target.showPicker && e.target.showPicker()}
            onChange={(e) => { setReportEndDate(e.target.value); setQuickPeriod(''); }}
            className="report-filter-input"
            style={{ background: 'transparent', border: 'none', padding: '12px 15px', fontSize: '0.85rem', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          />
          {(reportStartDate || reportEndDate) && (
            <button
              onClick={() => { setReportStartDate(''); setReportEndDate(''); setQuickPeriod(''); }}
              className="clear-date-btn"
              style={{ background: 'transparent', border: 'none', padding: '12px 15px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              title="Очистити період"
            >
              ✕
            </button>
          )}
          <select
            onChange={(e) => handleQuickDateSelect(e.target.value)}
            value={quickPeriod}
            className="report-period-select"
            style={{ border: 'none', padding: '12px 15px', fontSize: '0.8rem', outline: 'none', cursor: 'pointer', fontWeight: 800, textTransform: 'uppercase' }}
          >
            <option value="" disabled hidden>ОБРАТИ ПЕРІОД</option>
            <option value="today">Сьогодні</option>
            <option value="yesterday">Вчора</option>
            <option value="3days">Останні 3 дні</option>
            <option value="week">Останній тиждень</option>
            <option value="month">Останній місяць</option>
            <option value="quarter">Останній квартал</option>
            <option value="halfyear">Останні пів року</option>
            <option value="year">Останній рік</option>
          </select>
        </div>
      </div>

      {shiftReportLoading && (
        <div style={{ marginBottom: '15px', padding: '12px 15px', borderRadius: '12px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.14)', color: '#60a5fa', fontSize: '0.72rem', fontWeight: 800 }}>
          Завантажується повна історія за вибраний період…
        </div>
      )}

      {/* Shift cards widgets grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
        {Object.entries(shiftStats).map(([shiftName, counts]) => {
          const total = new Set([
            ...counts.activeCards,
            ...counts.pausedCards,
            ...counts.bufferCards,
            ...counts.completedCards
          ].map(card => String(card.card_id || card.id))).size
          const queueCount = counts.buffer
          return (
            <div key={shiftName} className="shift-stat-card" style={{
              borderRadius: '24px',
              padding: '25px',
              display: 'flex',
              flexDirection: 'column',
              gap: '15px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="shift-card-title" style={{ fontSize: '0.95rem', fontWeight: 900 }}>{shiftName}</span>
                <span style={{ fontSize: '0.68rem', fontWeight: 900, padding: '4px 10px', borderRadius: '8px', background: 'rgba(234,179,8,0.1)', color: '#eab308' }}>
                  Всього: {total}
                </span>
              </div>

              {/* General counts clickable */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '15px' }}>
                <div
                  onClick={() => counts.active > 0 && setSelectedReportDetails({ shift: shiftName, type: 'active', cards: counts.activeCards })}
                  style={{ cursor: counts.active > 0 ? 'pointer' : 'default', padding: '8px', borderRadius: '12px', background: counts.active > 0 ? 'rgba(34, 197, 94, 0.03)' : 'transparent', border: counts.active > 0 ? '1px solid rgba(34, 197, 94, 0.08)' : '1px solid transparent', transition: '0.2s' }}
                  className={counts.active > 0 ? "hover-scale" : ""}
                >
                  <div style={{ fontSize: '0.58rem', color: '#555', fontWeight: 900, textTransform: 'uppercase' }}>В роботі ➔</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 950, color: '#22c55e', marginTop: '4px' }}>{counts.active} <span style={{ fontSize: '0.75rem', color: '#444', fontWeight: 700 }}>карт</span></div>
                </div>
                <div
                  onClick={() => counts.paused > 0 && setSelectedReportDetails({ shift: shiftName, type: 'paused', cards: counts.pausedCards })}
                  style={{ cursor: counts.paused > 0 ? 'pointer' : 'default', padding: '8px', borderRadius: '12px', background: counts.paused > 0 ? 'rgba(234, 179, 8, 0.03)' : 'transparent', border: counts.paused > 0 ? '1px solid rgba(234, 179, 8, 0.08)' : '1px solid transparent', transition: '0.2s' }}
                  className={counts.paused > 0 ? "hover-scale" : ""}
                >
                  <div style={{ fontSize: '0.58rem', color: '#555', fontWeight: 900, textTransform: 'uppercase' }}>На паузі →</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 950, color: '#eab308', marginTop: '4px' }}>{counts.paused} <span style={{ fontSize: '0.75rem', color: '#444', fontWeight: 700 }}>карт</span></div>
                </div>
                <div
                  onClick={() => counts.completed > 0 && setSelectedReportDetails({ shift: shiftName, type: 'completed', cards: counts.completedCards })}
                  style={{ cursor: counts.completed > 0 ? 'pointer' : 'default', padding: '8px', borderRadius: '12px', background: counts.completed > 0 ? 'rgba(59, 130, 246, 0.03)' : 'transparent', border: counts.completed > 0 ? '1px solid rgba(59, 130, 246, 0.08)' : '1px solid transparent', transition: '0.2s' }}
                  className={counts.completed > 0 ? "hover-scale" : ""}
                >
                  <div style={{ fontSize: '0.58rem', color: '#555', fontWeight: 900, textTransform: 'uppercase' }}>Завершено ➔</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 950, color: '#3b82f6', marginTop: '4px' }}>{counts.completed} <span style={{ fontSize: '0.75rem', color: '#444', fontWeight: 700 }}>карт</span></div>
                </div>
              </div>

              {/* Breakdown by operations */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '15px', fontSize: '0.7rem' }}>
                <div>
                  <div style={{ fontSize: '0.58rem', color: '#888', fontWeight: 900, marginBottom: '6px', letterSpacing: '0.05em' }}>✂️ РОЗКРІЙ</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span>Зараз у роботі: <strong style={{ color: '#22c55e' }}>{counts.cuttingActive}</strong></span>
                    <span>Здано: <strong style={{ color: '#3b82f6' }}>{counts.cuttingCompleted}</strong></span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.58rem', color: '#888', fontWeight: 900, marginBottom: '6px', letterSpacing: '0.05em' }}>🌀 ГАЛТОВКА</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span>Зараз у роботі: <strong style={{ color: '#22c55e' }}>{counts.tumblingActive}</strong></span>
                    <span>Здано: <strong style={{ color: '#3b82f6' }}>{counts.tumblingCompleted}</strong></span>
                  </div>
                </div>
              </div>

              {/* Timings */}
              <div className="shift-timing-info" style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.68rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>⏱️ Час налаштування:</span>
                  <strong className="time-val">{counts.totalTuningTimeMins} хв</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>⚙️ Фактичний час роботи:</span>
                  <strong className="time-val">{counts.totalWorkingTimeMins} хв</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>📊 Середній час на карту:</span>
                  <strong style={{ color: '#eab308' }}>
                    { counts.completed > 0 ? Math.round(counts.completedWorkingTimeMins / counts.completed) : 0 } хв
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed rgba(255,255,255,0.03)', paddingTop: '6px', marginTop: '2px' }}>
                  <span>📦 Буфер / Черга запуску:</span>
                  <strong style={{ color: queueCount > 0 ? '#eab308' : '#555' }}>{queueCount} карт</strong>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal Details */}
      {selectedReportDetails && (
        <div className="shift-modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }} onClick={() => setSelectedReportDetails(null)}>
          <div className="shift-modal-content" style={{
            borderRadius: '24px',
            width: '100%',
            maxWidth: '750px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeIn 0.15s ease-out'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 25px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 className="modal-shift-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 950 }}>
                  {selectedReportDetails.shift} — {selectedReportDetails.type === 'active' ? 'Картки в роботі' : selectedReportDetails.type === 'paused' ? 'Картки на паузі' : 'Завершені операції'}
                </h3>
                <div className="modal-shift-subtitle" style={{ fontSize: '0.7rem', marginTop: '2px', fontWeight: 700 }}>
                  Період: {reportStartDate} — {reportEndDate}
                </div>
              </div>
              <button
                onClick={() => setSelectedReportDetails(null)}
                className="btn-close-modal"
                style={{ border: 'none', cursor: 'pointer', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}
              >
                ✕
              </button>
            </div>

            <ShiftReportDetailList cards={selectedReportDetails.cards} nomenclatures={nomenclatures} />
          </div>
        </div>
      )}
    </div>
  )
}

