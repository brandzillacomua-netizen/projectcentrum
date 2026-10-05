import React, { useState } from 'react'
import { Scissors, Download, Calendar, Layers, Clock, CheckCircle, RefreshCw } from 'lucide-react'

export const CuttersReportView = ({
  isSyncing,
  cuttersStats = [],
  cutterEventsList = [],
  totalCuttersUsed = 0,
  totalCuttersSupplied = 0
}) => {
  const [subTab, setSubTab] = useState('summary') // 'summary' | 'events'

  if (isSyncing) {
    return (
      <div className="glass-panel" style={{ background: 'var(--surface-inset)', padding: '60px 30px', borderRadius: '24px', border: '1px solid #27272a', color: '#aaa', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', minHeight: '350px' }}>
        <RefreshCw size={32} className="spin" color="#ff9000" />
        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-strong)' }}>Завантажуємо дані по фрезах за обраний період...</div>
        <div style={{ fontSize: '0.82rem', color: '#71717a' }}>Оновлення інформації про розхід та залишки</div>
      </div>
    )
  }

  const totalInStock = (cuttersStats || []).reduce((acc, s) => acc + Math.max(0, s.actual - s.reserved), 0)
  const topUsedCutter = (cuttersStats || []).sort((a, b) => b.used - a.used)[0]?.name || '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
      
      {/* TOP KPI DASHBOARD */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="glass-panel" style={{ background: 'var(--surface-1)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-subtle)', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, marginBottom: '8px' }}>Фактично використано (знос)</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 950, color: '#ef4444', lineHeight: 1 }}>{totalCuttersUsed} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>шт.</span></div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '8px' }}>Фактичний розхід за обраний період</div>
        </div>

        <div className="glass-panel" style={{ background: 'var(--surface-1)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-subtle)', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, marginBottom: '8px' }}>Отримано на склад</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 950, color: '#3b82f6', lineHeight: 1 }}>{totalCuttersSupplied} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>шт.</span></div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '8px' }}>Надійшло нових фрез за період</div>
        </div>

        <div className="glass-panel" style={{ background: 'var(--surface-1)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-subtle)', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, marginBottom: '8px' }}>Залишок на оперативному складі</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 950, color: '#10b981', lineHeight: 1 }}>{totalInStock} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>шт.</span></div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '8px' }}>Доступно до видачі на Складі СО</div>
        </div>

        <div className="glass-panel" style={{ background: 'var(--surface-1)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-subtle)', borderLeft: '4px solid #ff9000' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, marginBottom: '8px' }}>Топ фреза з розходу</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 950, color: '#ff9000', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{topUsedCutter}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '8px' }}>Найчастіше використовувалася у період</div>
        </div>
      </div>

      {/* MAIN CONTAINER WITH TAB TOGGLE */}
      <div className="glass-panel" style={{ background: 'var(--surface-inset)', padding: '25px', borderRadius: '24px', border: '1px solid #27272a', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
        
        {/* HEADER & TOGGLE BUTTONS */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
          <h3 style={{ margin: 0, color: '#ff9000', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '12px', textTransform: 'uppercase', fontWeight: 950, letterSpacing: '0.5px' }}>
            <Scissors size={24} color="#ff9000" /> Дашборд Використання Фрез
          </h3>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setSubTab('summary')}
              style={{
                background: subTab === 'summary' ? '#ff9000' : 'transparent',
                color: subTab === 'summary' ? '#000' : '#fff',
                border: subTab === 'summary' ? 'none' : '1px solid var(--border-subtle)',
                padding: '8px 18px', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 900, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px', transition: '0.2s'
              }}
            >
              <Layers size={16} /> Зведений баланс ({cuttersStats.length})
            </button>

            <button
              onClick={() => setSubTab('events')}
              style={{
                background: subTab === 'events' ? '#ff9000' : 'transparent',
                color: subTab === 'events' ? '#000' : '#fff',
                border: subTab === 'events' ? 'none' : '1px solid var(--border-subtle)',
                padding: '8px 18px', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 900, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px', transition: '0.2s'
              }}
            >
              <Clock size={16} /> Журнал використань ({cutterEventsList.length})
            </button>
          </div>
        </div>

        {/* SUB-TAB 1: SUMMARY BALANCE TABLE */}
        {subTab === 'summary' ? (
          <div style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid #27272a', background: 'var(--surface-inset)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', color: '#a1a1aa', textAlign: 'left', borderBottom: '2px solid #27272a' }}>
                  <th style={{ padding: '16px 20px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Назва фрези (Розхідник)</th>
                  <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#3b82f6' }}>Отримано на склад</th>
                  <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#ef4444' }}>Фактично використано (шт)</th>
                  <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}>Фактично на Складі</th>
                </tr>
              </thead>
              <tbody>
                {cuttersStats.map((stat, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)', background: 'transparent', transition: '0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '16px 20px', fontWeight: 900, color: '#f4f4f5', fontSize: '0.95rem' }}>{stat.name}</td>
                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      {stat.supplied > 0 ? <span style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', padding: '4px 12px', borderRadius: '8px', fontWeight: 900 }}>{stat.supplied} шт</span> : <span style={{ color: '#3f3f46' }}>0</span>}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      {stat.used > 0 ? <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '4px 12px', borderRadius: '8px', fontWeight: 900 }}>{stat.used} шт</span> : <span style={{ color: '#3f3f46' }}>0</span>}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.02)' }}>
                      <span style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', padding: '6px 14px', borderRadius: '10px', fontWeight: 950, fontSize: '1.05rem' }}>
                        {Math.max(0, stat.actual - stat.reserved)} шт
                      </span>
                    </td>
                  </tr>
                ))}
                {cuttersStats.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: '#71717a', fontSize: '0.9rem' }}>
                      Немає даних про фрези за обраний період
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* SUB-TAB 2: DETAILED USAGE EVENTS LOG */
          <div style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid #27272a', background: 'var(--surface-inset)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', color: '#a1a1aa', textAlign: 'left', borderBottom: '2px solid #27272a' }}>
                  <th style={{ padding: '14px 16px', fontWeight: 900 }}>Дата та час</th>
                  <th style={{ padding: '14px 16px', fontWeight: 900 }}>Фреза</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 900 }}>Кількість</th>
                  <th style={{ padding: '14px 16px', fontWeight: 900 }}>Оператор / Хто використав</th>
                  <th style={{ padding: '14px 16px', fontWeight: 900 }}>Джерело / Дільниця</th>
                  <th style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 900 }}>ID Картки</th>
                </tr>
              </thead>
              <tbody>
                {cutterEventsList.map(ev => {
                  const dateStr = ev.date ? new Date(ev.date).toLocaleString('uk-UA') : '—'
                  return (
                    <tr key={ev.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: '0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#18181b'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '14px 16px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{dateStr}</td>
                      <td style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--text-strong)' }}>{ev.cutterName}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '4px 10px', borderRadius: '6px', fontWeight: 900 }}>{ev.quantity} шт</span>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#d4d4d8' }}>{ev.operator}</td>
                      <td style={{ padding: '14px 16px', color: '#a1a1aa' }}>{ev.machine || ev.source}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', color: '#71717a', fontSize: '0.78rem' }}>{ev.cardId}</td>
                    </tr>
                  )
                })}
                {cutterEventsList.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#71717a', fontSize: '0.9rem' }}>
                      Немає зафіксованих подій використання фрез за обраний період
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
