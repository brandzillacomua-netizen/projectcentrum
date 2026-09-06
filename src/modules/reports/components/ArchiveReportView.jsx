import React from 'react'
import { Search, X, RefreshCw, CheckCircle2, Clock, Archive, ChevronLeft, ChevronRight } from 'lucide-react'

export const ArchiveReportView = ({
  filteredArchiveTasks = [],
  archiveSearch = '',
  setArchiveSearch,
  archiveStatusFilter = 'all',
  setArchiveStatusFilter,
  archiveLoading = false,
  setArchiveLoaded,
  setAllArchiveTasks,
  loadArchive,
  archivePage = 0,
  archiveTotalCount = 0,
  archiveTotalPages = 0
}) => {
  const statusLabel = { 'in-progress': 'В роботі', 'completed': 'Завершено', 'pending': 'Очікує', 'paused': 'Призупинено' }
  const statusColor = { 'in-progress': '#eab308', 'completed': '#10b981', 'pending': '#3b82f6', 'paused': '#6b7280' }
  const statusBg = { 'in-progress': 'rgba(234,179,8,0.12)', 'completed': 'rgba(16,185,129,0.12)', 'pending': 'rgba(59,130,246,0.12)', 'paused': 'rgba(107,114,128,0.12)' }

  const handlePageChange = (newPage) => {
    if (newPage >= 0 && newPage < archiveTotalPages && !archiveLoading) {
      loadArchive(newPage, archiveSearch, archiveStatusFilter)
    }
  }

  const startRecord = filteredArchiveTasks.length > 0 ? (archivePage * 50) + 1 : 0
  const endRecord = Math.min((archivePage + 1) * 50, archiveTotalCount)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header + Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: '#fff' }}>Архів нарядів</h2>
          <div style={{ fontSize: '0.8rem', color: '#71717a', marginTop: '4px' }}>
            Серверний архів: знайдено {archiveTotalCount} {archiveTotalCount === 1 ? 'партію' : archiveTotalCount < 5 ? 'партії' : 'партій'}
            {archiveTotalPages > 1 && ` • Сторінка ${archivePage + 1} з ${archiveTotalPages}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#555' }} />
            <input
              value={archiveSearch}
              onChange={e => setArchiveSearch(e.target.value)}
              placeholder="Пошук за номером, клієнтом, кроком..."
              style={{ background: '#0a0a0a', border: '1px solid #222', color: '#fff', padding: '10px 15px 10px 35px', borderRadius: '10px', fontSize: '0.85rem', width: '280px', outline: 'none' }}
            />
            {archiveSearch && <X size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#555', cursor: 'pointer' }} onClick={() => setArchiveSearch('')} />}
          </div>
          {/* Status Filter */}
          <select
            value={archiveStatusFilter}
            onChange={e => setArchiveStatusFilter(e.target.value)}
            style={{ background: '#0a0a0a', border: '1px solid #222', color: '#fff', padding: '10px 15px', borderRadius: '10px', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
          >
            <option value="all">-- Всі статуси --</option>
            <option value="completed">Завершено</option>
            <option value="in-progress">В роботі</option>
            <option value="pending">Очікує</option>
            <option value="paused">Призупинено</option>
          </select>
          {/* Reload */}
          <button
            onClick={() => { setArchiveLoaded(false); setAllArchiveTasks([]); loadArchive(0, archiveSearch, archiveStatusFilter) }}
            disabled={archiveLoading}
            style={{ background: 'rgba(255,144,0,0.1)', border: '1px solid rgba(255,144,0,0.2)', color: '#ff9000', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '0.75rem' }}
          >
            <RefreshCw size={14} style={{ animation: archiveLoading ? 'spin 1s linear infinite' : 'none' }} />
            ОНОВИТИ
          </button>
        </div>
      </div>

      {/* Table */}
      {archiveLoading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#71717a' }}>
          <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: '16px', display: 'block', margin: '0 auto 16px', color: '#ff9000' }} />
          Завантаження архіву з сервера...
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid #1e1e1e', background: '#09090b' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#111', color: '#71717a', textAlign: 'left', borderBottom: '2px solid #1e1e1e' }}>
                <th style={{ padding: '16px 20px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.7rem' }}>#</th>
                <th style={{ padding: '16px 20px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.7rem' }}>Замовлення</th>
                <th style={{ padding: '16px 20px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.7rem' }}>Клієнт</th>
                <th style={{ padding: '16px 20px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.7rem' }}>Крок</th>
                <th style={{ padding: '16px 20px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.7rem', textAlign: 'center' }}>Партія</th>
                <th style={{ padding: '16px 20px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.7rem', textAlign: 'center' }}>Комплектів</th>
                <th style={{ padding: '16px 20px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.7rem', textAlign: 'center' }}>Статус</th>
                <th style={{ padding: '16px 20px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.7rem' }}>Створено</th>
                <th style={{ padding: '16px 20px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.7rem' }}>Завершено</th>
              </tr>
            </thead>
            <tbody>
              {filteredArchiveTasks.map((task, idx) => {
                const order = task._order
                const status = task.status || 'pending'
                const label = statusLabel[status] || status
                const color = statusColor[status] || '#71717a'
                const bg = statusBg[status] || 'rgba(107,114,128,0.1)'
                const createdDate = task.created_at ? new Date(task.created_at).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
                const completedDate = task.completed_at ? new Date(task.completed_at).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
                const rowNumber = (archivePage * 50) + idx + 1

                return (
                  <tr
                    key={task.id}
                    style={{ borderBottom: '1px solid #111', transition: 'background 0.15s', background: 'transparent', cursor: 'default' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#111'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '14px 20px', color: '#3f3f46', fontWeight: 700, fontSize: '0.75rem' }}>{rowNumber}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ fontWeight: 900, color: '#f4f4f5', fontSize: '0.95rem' }}>№ {order?.order_num || '—'}</span>
                    </td>
                    <td style={{ padding: '14px 20px', color: '#a1a1aa', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {order?.customer || <span style={{ color: '#3f3f46' }}>—</span>}
                    </td>
                    <td style={{ padding: '14px 20px', color: '#a1a1aa' }}>
                      {task.step || <span style={{ color: '#3f3f46' }}>—</span>}
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                      <span style={{ background: '#18181b', color: '#a1a1aa', padding: '3px 10px', borderRadius: '6px', fontWeight: 700, fontSize: '0.8rem' }}>#{task.batch_index || '1'}</span>
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                      <span style={{ fontWeight: 900, color: '#ff9000' }}>{task.planned_sets || '—'}</span>
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                      <span style={{ background: bg, color, padding: '4px 12px', borderRadius: '8px', fontWeight: 800, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                        {status === 'completed' ? <CheckCircle2 size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} /> : <Clock size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />}
                        {label}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', color: '#71717a', fontSize: '0.8rem' }}>{createdDate}</td>
                    <td style={{ padding: '14px 20px', color: status === 'completed' ? '#10b981' : '#3f3f46', fontSize: '0.8rem', fontWeight: status === 'completed' ? 700 : 400 }}>{completedDate}</td>
                  </tr>
                )
              })}
              {filteredArchiveTasks.length === 0 && !archiveLoading && (
                <tr>
                  <td colSpan={9} style={{ padding: '60px', textAlign: 'center', color: '#3f3f46' }}>
                    <Archive size={40} style={{ display: 'block', margin: '0 auto 16px', opacity: 0.3 }} />
                    Нарядів не знайдено за заданими критеріями
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modern Server Pagination Bar */}
      {archiveTotalPages > 1 && !archiveLoading && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', background: '#09090b', borderRadius: '12px', border: '1px solid #1e1e1e', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ fontSize: '0.8rem', color: '#71717a' }}>
            Показано <strong style={{ color: '#fff' }}>{startRecord}–{endRecord}</strong> із <strong style={{ color: '#fff' }}>{archiveTotalCount}</strong> нарядів
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => handlePageChange(archivePage - 1)}
              disabled={archivePage === 0 || archiveLoading}
              style={{
                padding: '7px 14px',
                background: archivePage === 0 ? '#121214' : '#1f1f23',
                color: archivePage === 0 ? '#3f3f46' : '#fff',
                border: '1px solid #27272a',
                borderRadius: '8px',
                cursor: archivePage === 0 ? 'not-allowed' : 'pointer',
                fontSize: '0.8rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <ChevronLeft size={14} /> Попередня
            </button>

            <span style={{ fontSize: '0.85rem', color: '#a1a1aa', fontWeight: 800, padding: '0 10px' }}>
              {archivePage + 1} / {archiveTotalPages}
            </span>

            <button
              onClick={() => handlePageChange(archivePage + 1)}
              disabled={archivePage >= archiveTotalPages - 1 || archiveLoading}
              style={{
                padding: '7px 14px',
                background: archivePage >= archiveTotalPages - 1 ? '#121214' : '#1f1f23',
                color: archivePage >= archiveTotalPages - 1 ? '#3f3f46' : '#fff',
                border: '1px solid #27272a',
                borderRadius: '8px',
                cursor: archivePage >= archiveTotalPages - 1 ? 'not-allowed' : 'pointer',
                fontSize: '0.8rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              Наступна <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
