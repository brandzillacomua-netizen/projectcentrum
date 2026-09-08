import React, { useState, useMemo } from 'react'
import { 
  FileText, Search, Filter, CheckCircle2, Clock, Scan, 
  ArrowRight, Zap, RefreshCw, Layers, Calendar, ChevronRight 
} from 'lucide-react'

export const Packaging1CJournal = ({
  batchList = [],
  onSelectBatch,
  onOpenSplitModal,
  fetchData
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all', 'ready', 'processing', 'completed'
  const [sortField, setSortField] = useState('deadline') // 'orderNum', 'deadline', 'plannedSets'
  const [sortAsc, setSortAsc] = useState(true)

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    try {
      const clean = String(dateStr).split('T')[0]
      const parts = clean.split('-')
      if (parts.length === 3) {
        return `${parts[2]}.${parts[1]}.${parts[0]}`
      }
      return clean
    } catch (e) {
      return String(dateStr)
    }
  }

  const counts = useMemo(() => {
    return {
      all: batchList.length,
      ready: batchList.filter(b => b.packStatus === 'ready').length,
      processing: batchList.filter(b => b.packStatus === 'processing' || b.packStatus === 'waiting').length,
      completed: batchList.filter(b => b.packStatus === 'completed').length
    }
  }, [batchList])

  const filteredBatches = useMemo(() => {
    return batchList
      .filter(b => {
        if (statusFilter === 'ready' && b.packStatus !== 'ready') return false
        if (statusFilter === 'processing' && (b.packStatus !== 'processing' && b.packStatus !== 'waiting')) return false
        if (statusFilter === 'completed' && b.packStatus !== 'completed') return false

        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase()
          const matchNum = String(b.orderNum || '').toLowerCase().includes(q)
          const matchCust = String(b.customer || '').toLowerCase().includes(q)
          const matchProd = String(b.productNames || '').toLowerCase().includes(q)
          const matchIdx = String(b.batchIndex || '').toLowerCase().includes(q)
          if (!matchNum && !matchCust && !matchProd && !matchIdx) return false
        }
        return true
      })
      .sort((a, b) => {
        let cmp = 0
        if (sortField === 'orderNum') {
          cmp = String(a.orderNum || '').localeCompare(String(b.orderNum || ''), undefined, { numeric: true })
        } else if (sortField === 'deadline') {
          cmp = String(a.deadline || '').localeCompare(String(b.deadline || ''))
        } else if (sortField === 'plannedSets') {
          cmp = (Number(a.plannedSets) || 0) - (Number(b.plannedSets) || 0)
        }
        return sortAsc ? cmp : -cmp
      })
  }, [batchList, statusFilter, searchTerm, sortField, sortAsc])

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(true)
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#ffffff',
      border: '1.5px solid #cbd5e1',
      borderRadius: '12px',
      overflow: 'hidden',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    }}>
      {/* 1C TOP TOOLBAR */}
      <div style={{
        background: '#f8fafc',
        borderBottom: '1.5px solid #e2e8f0',
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: '#0284c7', color: '#fff', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.2px' }}>
              ЖУРНАЛ ДОКУМЕНТІВ: НАРИЯДИ НА ПАКУВАННЯ ТА КОМПЛЕКТУВАННЯ
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, marginTop: '1px' }}>
              Оперативний облік партій готової продукції (1С ERP концепція)
            </div>
          </div>
        </div>

        {/* REFRESH */}
        {typeof fetchData === 'function' && (
          <button
            type="button"
            onClick={() => fetchData(['tasks', 'orders', 'packaging_boxes'])}
            title="Оновити список"
            style={{
              padding: '7px 14px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '0.78rem',
              fontWeight: 800,
              color: '#334155',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              transition: '0.15s'
            }}
          >
            <RefreshCw size={14} /> Оновити
          </button>
        )}
      </div>

      {/* KPI STATS BAR (LIGHT THEME ELEVATED TILES) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '10px',
        padding: '12px 18px',
        background: '#f8fafc',
        borderBottom: '1.5px solid #e2e8f0'
      }}>
        <div 
          onClick={() => setStatusFilter('all')}
          style={{
            background: '#ffffff',
            border: `1.5px solid ${statusFilter === 'all' ? '#0284c7' : '#cbd5e1'}`,
            borderRadius: '10px',
            padding: '10px 14px',
            cursor: 'pointer',
            boxShadow: statusFilter === 'all' ? '0 0 0 2px rgba(2,132,199,0.2)' : '0 1px 3px rgba(0,0,0,0.04)',
            transition: '0.15s'
          }}
        >
          <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Всього в журналі</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 1000, color: '#0f172a', marginTop: '2px' }}>
            {counts.all} <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>документів</span>
          </div>
        </div>

        <div 
          onClick={() => setStatusFilter('ready')}
          style={{
            background: statusFilter === 'ready' ? '#f0fdf4' : '#ffffff',
            border: `1.5px solid ${statusFilter === 'ready' ? '#16a34a' : '#bbf7d0'}`,
            borderRadius: '10px',
            padding: '10px 14px',
            cursor: 'pointer',
            boxShadow: statusFilter === 'ready' ? '0 0 0 2px rgba(22,163,74,0.2)' : '0 1px 3px rgba(0,0,0,0.04)',
            transition: '0.15s'
          }}
        >
          <div style={{ fontSize: '0.68rem', color: '#16a34a', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Готові до пакування</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 1000, color: '#15803d', marginTop: '2px' }}>
            {counts.ready} <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#16a34a' }}>нарядів</span>
          </div>
        </div>

        <div 
          onClick={() => setStatusFilter('processing')}
          style={{
            background: statusFilter === 'processing' ? '#fffbeb' : '#ffffff',
            border: `1.5px solid ${statusFilter === 'processing' ? '#d97706' : '#fde68a'}`,
            borderRadius: '10px',
            padding: '10px 14px',
            cursor: 'pointer',
            boxShadow: statusFilter === 'processing' ? '0 0 0 2px rgba(217,119,6,0.2)' : '0 1px 3px rgba(0,0,0,0.04)',
            transition: '0.15s'
          }}
        >
          <div style={{ fontSize: '0.68rem', color: '#b45309', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>В роботі / Очікує</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 1000, color: '#b45309', marginTop: '2px' }}>
            {counts.processing} <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#b45309' }}>нарядів</span>
          </div>
        </div>

        <div 
          onClick={() => setStatusFilter('completed')}
          style={{
            background: statusFilter === 'completed' ? '#f1f5f9' : '#ffffff',
            border: `1.5px solid ${statusFilter === 'completed' ? '#475569' : '#cbd5e1'}`,
            borderRadius: '10px',
            padding: '10px 14px',
            cursor: 'pointer',
            boxShadow: statusFilter === 'completed' ? '0 0 0 2px rgba(71,85,105,0.2)' : '0 1px 3px rgba(0,0,0,0.04)',
            transition: '0.15s'
          }}
        >
          <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Спаковані (Архів)</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 1000, color: '#334155', marginTop: '2px' }}>
            {counts.completed} <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>партій</span>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH ROW */}
      <div style={{
        padding: '10px 18px',
        borderBottom: '1.5px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
        background: '#ffffff'
      }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '440px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Швидкий пошук за номером наряду, замовником, виробом..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '8px 12px 8px 36px',
              border: '1.5px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '0.82rem',
              color: '#0f172a',
              background: '#ffffff'
            }}
          />
        </div>

        <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700 }}>
          Знайдено документів: <strong style={{ color: '#0f172a' }}>{filteredBatches.length}</strong>
        </div>
      </div>

      {/* 1C ERP REGISTRY TABLE (CLEAN, HIGH CONTRAST) */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', color: '#334155', position: 'sticky', top: 0, zIndex: 10 }}>
              <th 
                onClick={() => handleSort('orderNum')} 
                style={{ padding: '11px 14px', fontWeight: 900, cursor: 'pointer', userSelect: 'none' }}
              >
                № Наряду / Партія {sortField === 'orderNum' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th 
                onClick={() => handleSort('deadline')} 
                style={{ padding: '11px 14px', fontWeight: 900, cursor: 'pointer', userSelect: 'none' }}
              >
                Дедлайн {sortField === 'deadline' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '11px 14px', fontWeight: 900 }}>Контрагент (Замовник)</th>
              <th style={{ padding: '11px 14px', fontWeight: 900 }}>Виріб (Номенклатура)</th>
              <th 
                onClick={() => handleSort('plannedSets')} 
                style={{ padding: '11px 14px', fontWeight: 900, cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}
              >
                План (шт) {sortField === 'plannedSets' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '11px 14px', fontWeight: 900, textAlign: 'center' }}>Статус ТМЦ</th>
              <th style={{ padding: '11px 14px', fontWeight: 900, textAlign: 'center' }}>Статус документа</th>
              <th style={{ padding: '11px 18px', fontWeight: 900, textAlign: 'right', whiteSpace: 'nowrap', width: '200px' }}>Дія</th>
            </tr>
          </thead>
          <tbody>
            {filteredBatches.map(batch => {
              const isCompleted = batch.packStatus === 'completed'
              const isReady = batch.packStatus === 'ready'
              const isProc = batch.packStatus === 'processing'

              let statusColor = '#b45309', statusBg = '#fffbeb', statusBorder = '#fde68a', statusText = 'ОЧІКУЄ ЗАПИТУ'
              if (isCompleted) { statusColor = '#475569'; statusBg = '#f8fafc'; statusBorder = '#cbd5e1'; statusText = 'СПАКОВАНО' }
              else if (isReady) { statusColor = '#15803d'; statusBg = '#f0fdf4'; statusBorder = '#bbf7d0'; statusText = 'ГОТОВО ДО ПАКУВАННЯ' }
              else if (isProc) { statusColor = '#1d4ed8'; statusBg = '#eff6ff'; statusBorder = '#bfdbfe'; statusText = 'ЗАПИТ В ОБРОБЦІ' }

              return (
                <tr
                  key={batch.key}
                  onClick={() => onSelectBatch(batch)}
                  style={{
                    borderBottom: '1px solid #e2e8f0',
                    cursor: 'pointer',
                    background: '#ffffff',
                    transition: 'background 0.1s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                >
                  {/* НАРИЯД */}
                  <td style={{ padding: '11px 14px', fontWeight: 900, color: '#0f172a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.92rem', color: '#0f172a' }}>
                        № {batch.orderNum}{batch.batchIndex ? `/${batch.batchIndex}` : ''}
                      </span>
                      {batch.batchIndex && (
                        <span style={{ background: '#0284c7', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 900 }}>
                          {batch.batchIndex}
                        </span>
                      )}
                      {batch.hasPendingScheduleSplit && (
                        <span style={{ background: '#f59e0b', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Zap size={10} /> {batch.batchSchedule?.length} ПАРТІЇ
                        </span>
                      )}
                    </div>
                  </td>

                  {/* ДЕДЛАЙН (FORMATTED CLEAN DATE) */}
                  <td style={{ padding: '11px 14px', color: '#334155', fontWeight: 800, whiteSpace: 'nowrap' }}>
                    {batch.deadline ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={13} color="#64748b" /> {formatDate(batch.deadline)}
                      </span>
                    ) : '—'}
                  </td>

                  {/* КОНТРАГЕНТ */}
                  <td style={{ padding: '11px 14px', color: '#1e293b', fontWeight: 800 }}>
                    {batch.customer}
                  </td>

                  {/* ВИРІБ */}
                  <td style={{ padding: '11px 14px', color: '#b45309', fontWeight: 800 }}>
                    {batch.productNames}
                  </td>

                  {/* ОБСЯГ */}
                  <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 1000, color: '#059669', fontSize: '0.95rem' }}>
                    {batch.plannedSets} <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>шт</span>
                  </td>

                  {/* СКЛАДСЬКИЙ СТАТУС ТМЦ */}
                  <td style={{ padding: '11px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {isReady ? (
                      <span style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 900 }}>
                        ВИДАНО СКЛАДОМ
                      </span>
                    ) : isProc ? (
                      <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 900 }}>
                        ЗАПИТ НА СКЛАДІ
                      </span>
                    ) : (
                      <span style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800 }}>
                        НЕ ЗАПИТАНО
                      </span>
                    )}
                  </td>

                  {/* СТАТУС ДОКУМЕНТА */}
                  <td style={{ padding: '11px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: statusBg,
                      color: statusColor,
                      border: `1px solid ${statusBorder}`,
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 900
                    }}>
                      {isCompleted ? <CheckCircle2 size={12} /> : (isReady ? <Scan size={12} /> : <Clock size={12} />)}
                      {statusText}
                    </span>
                  </td>

                  {/* ДІЯ (ПРОФЕСІЙНІ СВІТЛІ КОНТРАСТНІ КНОПКИ З ЧІТКИМ ТЕКСТОМ) */}
                  <td style={{ padding: '8px 18px', textAlign: 'right', whiteSpace: 'nowrap', width: '210px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                      {batch.hasPendingScheduleSplit && (
                        <button
                          type="button"
                          className="p1c-btn-split"
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelectBatch(batch)
                            if (typeof onOpenSplitModal === 'function') onOpenSplitModal(batch)
                          }}
                          style={{
                            padding: '6px 11px',
                            background: '#fffbeb',
                            border: '1.5px solid #d97706',
                            borderRadius: '7px',
                            color: '#92400e',
                            fontWeight: 900,
                            fontSize: '0.74rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            boxShadow: '0 1px 2px rgba(217, 119, 6, 0.12)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <Zap size={13} color="#d97706" />
                          <span style={{ color: '#92400e', fontWeight: 900 }}>Розділити</span>
                        </button>
                      )}

                      <button
                        type="button"
                        className="p1c-btn-open"
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectBatch(batch)
                        }}
                        style={{
                          padding: '6px 14px',
                          background: '#f1f5f9',
                          color: '#0f172a',
                          border: '1.5px solid #475569',
                          borderRadius: '7px',
                          fontWeight: 800,
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span style={{ color: '#0f172a', fontWeight: 800 }}>Відкрити</span>
                        <ChevronRight size={14} color="#0f172a" strokeWidth={2.5} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}

            {filteredBatches.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 800 }}>Не знайдено нарядів за вказаними фільтрами</div>
                  <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>Спробуйте змінити пошуковий запит або статус</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 1C BOTTOM STATUS LINE */}
      <div style={{
        background: '#f8fafc',
        borderTop: '1.5px solid #e2e8f0',
        padding: '10px 18px',
        fontSize: '0.78rem',
        color: '#64748b',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          Стан: <strong>Активний</strong> | Користувач: <strong>Пакувальник</strong>
        </div>
        <div>
          Всього документів у вибірці: <strong>{filteredBatches.length}</strong> із <strong>{batchList.length}</strong>
        </div>
      </div>

      {/* SCOPED STYLES FOR HIGH CONTRAST & PROFESSIONAL LOOK */}
      <style dangerouslySetInnerHTML={{ __html: `
        .p1c-btn-open {
          background: #f1f5f9 !important;
          color: #0f172a !important;
          border: 1.5px solid #475569 !important;
          border-radius: 7px !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05) !important;
          transition: all 0.15s ease !important;
        }
        .p1c-btn-open span {
          color: #0f172a !important;
          font-weight: 800 !important;
        }
        .p1c-btn-open svg {
          stroke: #0f172a !important;
        }
        .p1c-btn-open:hover {
          background: #e2e8f0 !important;
          border-color: #0f172a !important;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1) !important;
        }
        .p1c-btn-split {
          background: #fffbeb !important;
          color: #92400e !important;
          border: 1.5px solid #d97706 !important;
          border-radius: 7px !important;
          box-shadow: 0 1px 2px rgba(217, 119, 6, 0.12) !important;
          transition: all 0.15s ease !important;
        }
        .p1c-btn-split span {
          color: #92400e !important;
          font-weight: 900 !important;
        }
        .p1c-btn-split svg {
          stroke: #d97706 !important;
        }
        .p1c-btn-split:hover {
          background: #fef3c7 !important;
          border-color: #b45309 !important;
          box-shadow: 0 2px 5px rgba(217, 119, 6, 0.2) !important;
        }
      ` }} />
    </div>
  )
}
