import React, { useState, useMemo } from 'react'
import {
  Wrench,
  X,
  Search,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Printer,
  ChevronRight,
  Filter,
  Activity,
  Layers,
  ArrowUpRight
} from 'lucide-react'
import { MAINTENANCE_TYPES } from '../../utils/machineDashboardUtils.js'

const formatDateTime = value => {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('uk-UA', {
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

const formatDateOnly = date => {
  if (!date) return ''
  const d = new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const formatDuration = seconds => {
  if (seconds === null || seconds === undefined) return '—'
  const total = Math.max(0, Number(seconds) || 0)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (hours > 0) return `${hours}г ${minutes}хв`
  if (minutes > 0) return `${minutes}хв ${secs}с`
  return `${secs}с`
}

export function MachinesGlobalMaintenanceModal({
  isOpen,
  onClose,
  logs = [],
  machines = [],
  loading = false,
  onRefresh,
  onSelectMachine
}) {
  const [dateFilterMode, setDateFilterMode] = useState('all') // 'today', 'yesterday', '7days', 'custom', 'all'
  const [selectedDate, setSelectedDate] = useState(() => formatDateOnly(new Date()))
  const [machineFilter, setMachineFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Map machines by ID for fast lookup
  const machinesById = useMemo(() => {
    const map = new Map()
    ;(machines || []).forEach(m => {
      map.set(String(m.id), m)
    })
    return map
  }, [machines])

  // Filtered maintenance logs
  const filteredLogs = useMemo(() => {
    const now = new Date()
    const todayStr = formatDateOnly(now)
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = formatDateOnly(yesterday)

    return (logs || []).filter(log => {
      // 1. Date Filter
      const logDateStr = formatDateOnly(log.started_at || log.triggered_at || log.created_at)
      if (dateFilterMode === 'today') {
        if (logDateStr !== todayStr) return false
      } else if (dateFilterMode === 'yesterday') {
        if (logDateStr !== yesterdayStr) return false
      } else if (dateFilterMode === '7days') {
        const d = new Date(log.started_at || log.triggered_at || log.created_at)
        const diffDays = (now.getTime() - d.getTime()) / (1000 * 3600 * 24)
        if (diffDays > 7 || diffDays < 0) return false
      } else if (dateFilterMode === 'custom') {
        if (selectedDate && logDateStr !== selectedDate) return false
      }

      // 2. Machine Filter
      if (machineFilter !== 'all' && String(log.machine_id) !== String(machineFilter)) {
        return false
      }

      // 3. Maintenance Type Filter
      if (typeFilter !== 'all' && log.maintenance_type !== typeFilter) {
        return false
      }

      // 4. Status Filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'completed' && log.status !== 'completed') return false
        if (statusFilter === 'in_progress' && log.status !== 'in_progress') return false
        if (statusFilter === 'pending' && log.status !== 'pending') return false
      }

      // 5. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const machine = machinesById.get(String(log.machine_id))
        const machineName = String(machine?.name || '').toLowerCase()
        const machineType = String(machine?.type || '').toLowerCase()
        const maintenanceType = String(log.maintenance_type || '').toLowerCase()
        const performer = String(log.performed_by || '').toLowerCase()
        const notes = String(log.notes || '').toLowerCase()
        const spare = String(log.spare_part || '').toLowerCase()
        const head = String(log.machine_head || '').toLowerCase()

        const match =
          machineName.includes(q) ||
          machineType.includes(q) ||
          maintenanceType.includes(q) ||
          performer.includes(q) ||
          notes.includes(q) ||
          spare.includes(q) ||
          head.includes(q)

        if (!match) return false
      }

      return true
    })
  }, [logs, dateFilterMode, selectedDate, machineFilter, typeFilter, statusFilter, searchQuery, machinesById])

  // Summary statistics for current filtered view
  const stats = useMemo(() => {
    const total = filteredLogs.length
    const completed = filteredLogs.filter(l => l.status === 'completed').length
    const inProgress = filteredLogs.filter(l => l.status === 'in_progress').length
    const pending = filteredLogs.filter(l => l.status === 'pending').length

    let totalDurationSeconds = 0
    let totalResponseSeconds = 0
    let responseCount = 0
    const touchedMachines = new Set()

    filteredLogs.forEach(l => {
      if (l.machine_id) touchedMachines.add(String(l.machine_id))
      if (l.maintenance_duration_seconds) {
        totalDurationSeconds += Number(l.maintenance_duration_seconds) || 0
      }
      if (l.response_duration_seconds) {
        totalResponseSeconds += Number(l.response_duration_seconds) || 0
        responseCount += 1
      }
    })

    const avgResponse = responseCount > 0 ? Math.round(totalResponseSeconds / responseCount) : 0

    return {
      total,
      completed,
      inProgress,
      pending,
      totalDurationFormatted: formatDuration(totalDurationSeconds),
      avgResponseFormatted: formatDuration(avgResponse),
      uniqueMachines: touchedMachines.size
    }
  }, [filteredLogs])

  // Print function
  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) return

    const rowsHtml = filteredLogs.map((log, index) => {
      const machine = machinesById.get(String(log.machine_id))
      return `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${machine?.name || 'Верстат'}</strong><br><small>${machine?.type || '—'}</small></td>
          <td>${log.maintenance_type || 'Обслуговування'}${log.machine_head ? ` (${log.machine_head})` : ''}${log.notes ? `<br><small>${log.notes}</small>` : ''}</td>
          <td>${log.status === 'completed' ? 'Виконано' : log.status === 'in_progress' ? 'В процесі' : 'Очікує'}</td>
          <td>${formatDateTime(log.started_at || log.triggered_at)}</td>
          <td>${formatDateTime(log.completed_at)}</td>
          <td>${formatDuration(log.maintenance_duration_seconds)}</td>
          <td>${log.performed_by || '—'}</td>
        </tr>
      `
    }).join('')

    printWindow.document.write(`
      <html>
        <head>
          <title>Зведений Журнал ТО - ${new Date().toLocaleDateString('uk-UA')}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 25px; color: #111; }
            h2 { margin: 0 0 5px 0; font-size: 1.4rem; text-transform: uppercase; }
            p { margin: 0 0 20px 0; color: #555; font-size: 0.85rem; }
            table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
            th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: left; }
            th { background: #f4f4f5; font-weight: 800; }
            small { color: #666; }
          </style>
        </head>
        <body>
          <h2>Журнал технічного обслуговування верстатів (ТО)</h2>
          <p>Дата формування: ${new Date().toLocaleString('uk-UA')} | Всього записів: ${filteredLogs.length}</p>
          <table>
            <thead>
              <tr>
                <th>№</th>
                <th>Верстат</th>
                <th>Робота / Деталі</th>
                <th>Статус</th>
                <th>Початок</th>
                <th>Завершення</th>
                <th>Тривалість</th>
                <th>Виконавець</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="8" style="text-align: center; padding: 20px;">Записів не знайдено</td></tr>'}
            </tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  if (!isOpen) return null

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        className="modal-content"
        style={{
          width: '100%',
          maxWidth: '1280px',
          maxHeight: '92vh',
          background: 'var(--surface-1, #131418)',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
          borderRadius: '24px',
          boxShadow: '0 30px 90px rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: 'var(--text-strong, #ffffff)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 28px',
            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--surface-2, #181920)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '14px',
                background: 'rgba(255, 144, 0, 0.15)',
                border: '1px solid rgba(255, 144, 0, 0.35)',
                color: '#ff9000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Wrench size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 950, letterSpacing: '-0.3px' }}>
                  ЗАГАЛЬНИЙ ЖУРНАЛ ТО ТА ОБСЛУГОВУВАННЯ
                </h3>
                <span
                  style={{
                    background: 'rgba(255, 144, 0, 0.15)',
                    color: '#ff9000',
                    border: '1px solid rgba(255, 144, 0, 0.3)',
                    fontSize: '0.72rem',
                    fontWeight: 900,
                    padding: '3px 10px',
                    borderRadius: '12px'
                  }}
                >
                  {filteredLogs.length} записів
                </span>
              </div>
              <div style={{ color: 'var(--text-muted, #a1a1aa)', fontSize: '0.78rem', marginTop: '2px', fontWeight: 600 }}>
                Історія сервісних робіт, ремонтів та заміни розхідників по всіх верстатах парку
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={onRefresh}
              disabled={loading}
              title="Оновити журнал"
              style={{
                background: 'var(--surface-3, #24252e)',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                color: 'var(--text-strong, #fff)',
                padding: '8px 14px',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RefreshCw size={14} className={loading ? 'scanner-spin' : ''} />
              Оновити
            </button>

            <button
              onClick={handlePrint}
              title="Друкувати звіт"
              style={{
                background: 'rgba(255, 144, 0, 0.12)',
                border: '1px solid rgba(255, 144, 0, 0.3)',
                color: '#ff9000',
                padding: '8px 14px',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Printer size={14} />
              Друк
            </button>

            <button
              onClick={onClose}
              style={{
                width: 36,
                height: 36,
                borderRadius: '12px',
                background: 'var(--surface-3, #24252e)',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                color: 'var(--text-muted, #888)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div
          style={{
            padding: '16px 28px',
            background: 'var(--surface-2, #16171f)',
            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: '12px'
          }}
        >
          <div style={{ background: 'var(--surface-1, #1a1b24)', padding: '12px 16px', borderRadius: '14px', border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #a1a1aa)', fontWeight: 800, textTransform: 'uppercase' }}>Всього операцій ТО</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 950, color: 'var(--text-strong, #fff)', marginTop: '4px' }}>
              {stats.total}
            </div>
          </div>

          <div style={{ background: 'var(--surface-1, #1a1b24)', padding: '12px 16px', borderRadius: '14px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 800, textTransform: 'uppercase' }}>Успішно завершено</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 950, color: '#10b981', marginTop: '4px' }}>
              {stats.completed}
            </div>
          </div>

          <div style={{ background: 'var(--surface-1, #1a1b24)', padding: '12px 16px', borderRadius: '14px', border: '1px solid rgba(255, 144, 0, 0.2)' }}>
            <div style={{ fontSize: '0.72rem', color: '#ff9000', fontWeight: 800, textTransform: 'uppercase' }}>В процесі / Очікує</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 950, color: '#ff9000', marginTop: '4px' }}>
              {stats.inProgress + stats.pending}
            </div>
          </div>

          <div style={{ background: 'var(--surface-1, #1a1b24)', padding: '12px 16px', borderRadius: '14px', border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #a1a1aa)', fontWeight: 800, textTransform: 'uppercase' }}>Загальний час робіт</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 950, color: '#38bdf8', marginTop: '4px' }}>
              {stats.totalDurationFormatted}
            </div>
          </div>

          <div style={{ background: 'var(--surface-1, #1a1b24)', padding: '12px 16px', borderRadius: '14px', border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #a1a1aa)', fontWeight: 800, textTransform: 'uppercase' }}>Верстатів охоплено</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 950, color: 'var(--text-strong, #fff)', marginTop: '4px' }}>
              {stats.uniqueMachines}
            </div>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div
          style={{
            padding: '16px 28px',
            background: 'var(--surface-1, #131418)',
            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          {/* Date Mode Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'today', label: 'Сьогодні' },
              { id: 'yesterday', label: 'Вчора' },
              { id: '7days', label: '7 днів' },
              { id: 'all', label: 'Весь час' },
              { id: 'custom', label: 'Вибрати день' }
            ].map(m => {
              const active = dateFilterMode === m.id
              return (
                <button
                  key={m.id}
                  onClick={() => setDateFilterMode(m.id)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '10px',
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    border: active ? '1px solid #ff9000' : '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
                    background: active ? '#ff9000' : 'var(--surface-2, #1c1d25)',
                    color: active ? '#000' : 'var(--text-strong, #fff)',
                    transition: '0.15s'
                  }}
                >
                  {m.label}
                </button>
              )
            })}

            {dateFilterMode === 'custom' && (
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                style={{
                  background: 'var(--surface-2, #1c1d25)',
                  border: '1px solid rgba(255, 144, 0, 0.5)',
                  color: '#fff',
                  borderRadius: '10px',
                  padding: '6px 10px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  outline: 'none'
                }}
              />
            )}
          </div>

          {/* Machine & Type Dropdowns & Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
            {/* Machine select */}
            <select
              value={machineFilter}
              onChange={e => setMachineFilter(e.target.value)}
              style={{
                background: 'var(--surface-2, #1c1d25)',
                border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                color: 'var(--text-strong, #fff)',
                borderRadius: '10px',
                padding: '7px 12px',
                fontSize: '0.76rem',
                fontWeight: 700,
                outline: 'none',
                maxWidth: '200px'
              }}
            >
              <option value="all">Всі верстати ({machines.length})</option>
              {machines.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.type || 'верстат'})
                </option>
              ))}
            </select>

            {/* Type select */}
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              style={{
                background: 'var(--surface-2, #1c1d25)',
                border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                color: 'var(--text-strong, #fff)',
                borderRadius: '10px',
                padding: '7px 12px',
                fontSize: '0.76rem',
                fontWeight: 700,
                outline: 'none',
                maxWidth: '190px'
              }}
            >
              <option value="all">Всі види робіт</option>
              {MAINTENANCE_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            {/* Status select */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{
                background: 'var(--surface-2, #1c1d25)',
                border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                color: 'var(--text-strong, #fff)',
                borderRadius: '10px',
                padding: '7px 12px',
                fontSize: '0.76rem',
                fontWeight: 700,
                outline: 'none'
              }}
            >
              <option value="all">Всі статуси</option>
              <option value="completed">Виконано</option>
              <option value="in_progress">В процесі</option>
              <option value="pending">Очікує</option>
            </select>

            {/* Search Input */}
            <div style={{ position: 'relative', width: '220px' }}>
              <Search
                size={14}
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#888' }}
              />
              <input
                type="text"
                placeholder="Пошук верстата чи виконавця..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--surface-2, #1c1d25)',
                  border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                  borderRadius: '10px',
                  padding: '7px 10px 7px 32px',
                  color: '#fff',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  outline: 'none'
                }}
              />
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px 20px' }}>
          {loading ? (
            <div style={{ padding: '80px 20px', textAlign: 'center', color: '#888' }}>
              <RefreshCw size={28} className="scanner-spin" style={{ color: '#ff9000', margin: '0 auto 12px' }} />
              <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>Завантаження журналу ТО...</div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div
              style={{
                padding: '80px 20px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                color: 'var(--text-muted, #888)'
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'var(--surface-2, #1c1d25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#666'
                }}
              >
                <Wrench size={26} />
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--text-strong, #fff)' }}>
                Записів ТО не знайдено
              </div>
              <div style={{ fontSize: '0.8rem', maxWidth: '380px' }}>
                За обраними параметрами або за вибраний день технічне обслуговування не фіксувалося.
              </div>
            </div>
          ) : (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.8rem',
                marginTop: '16px'
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                    textAlign: 'left',
                    color: 'var(--text-muted, #a1a1aa)',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    fontSize: '0.68rem',
                    letterSpacing: '0.05em'
                  }}
                >
                  <th style={{ padding: '12px 14px' }}>Верстат</th>
                  <th style={{ padding: '12px 14px' }}>Вид роботи / Деталі</th>
                  <th style={{ padding: '12px 14px' }}>Статус</th>
                  <th style={{ padding: '12px 14px' }}>Початок</th>
                  <th style={{ padding: '12px 14px' }}>Завершення</th>
                  <th style={{ padding: '12px 14px' }}>Тривалість</th>
                  <th style={{ padding: '12px 14px' }}>Виконавець</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Дія</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => {
                  const machine = machinesById.get(String(log.machine_id))
                  const isCompleted = log.status === 'completed'
                  const isInProgress = log.status === 'in_progress'

                  return (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.05))',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2, rgba(255,255,255,0.03))')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Machine */}
                      <td style={{ padding: '14px', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 950, fontSize: '0.88rem', color: '#ff9000' }}>
                            {machine?.name || `Верстат #${String(log.machine_id).slice(-4)}`}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #888)', marginTop: '2px' }}>
                          {machine?.type || 'Тип не вказано'}
                        </div>
                        {machine?.inventory_no && (
                          <div style={{ fontSize: '0.68rem', color: '#666', marginTop: '1px' }}>
                            Інв: {machine.inventory_no}
                          </div>
                        )}
                      </td>

                      {/* Work Details */}
                      <td style={{ padding: '14px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 800, color: 'var(--text-strong, #fff)' }}>
                          {log.maintenance_type || 'Технічне обслуговування'}
                        </div>
                        {log.machine_head && (
                          <div style={{ fontSize: '0.72rem', color: '#38bdf8', marginTop: '2px', fontWeight: 700 }}>
                            Голова: {log.machine_head}
                          </div>
                        )}
                        {log.spare_part && (
                          <div style={{ fontSize: '0.72rem', color: '#a78bfa', marginTop: '2px', fontWeight: 700 }}>
                            Деталь: {log.spare_part}
                          </div>
                        )}
                        {log.notes && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)', marginTop: '4px', fontStyle: 'italic', maxWidth: '280px', lineHeight: 1.3 }}>
                            "{log.notes}"
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px', verticalAlign: 'top' }}>
                        {isCompleted && (
                          <span
                            style={{
                              background: 'rgba(16, 185, 129, 0.12)',
                              color: '#10b981',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              padding: '4px 10px',
                              borderRadius: '10px',
                              fontSize: '0.72rem',
                              fontWeight: 900,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}
                          >
                            <CheckCircle2 size={12} />
                            Виконано
                          </span>
                        )}
                        {isInProgress && (
                          <span
                            style={{
                              background: 'rgba(255, 144, 0, 0.15)',
                              color: '#ff9000',
                              border: '1px solid rgba(255, 144, 0, 0.35)',
                              padding: '4px 10px',
                              borderRadius: '10px',
                              fontSize: '0.72rem',
                              fontWeight: 900,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}
                          >
                            <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff9000' }} />
                            В процесі
                          </span>
                        )}
                        {!isCompleted && !isInProgress && (
                          <span
                            style={{
                              background: 'rgba(234, 179, 8, 0.12)',
                              color: '#eab308',
                              border: '1px solid rgba(234, 179, 8, 0.3)',
                              padding: '4px 10px',
                              borderRadius: '10px',
                              fontSize: '0.72rem',
                              fontWeight: 900
                            }}
                          >
                            Очікує
                          </span>
                        )}
                      </td>

                      {/* Start Time */}
                      <td style={{ padding: '14px', verticalAlign: 'top', color: 'var(--text-strong, #fff)', fontWeight: 700 }}>
                        {formatDateTime(log.started_at || log.triggered_at)}
                      </td>

                      {/* End Time */}
                      <td style={{ padding: '14px', verticalAlign: 'top', color: 'var(--text-strong, #fff)', fontWeight: 700 }}>
                        {log.completed_at ? formatDateTime(log.completed_at) : <span style={{ color: '#ff9000' }}>Триває…</span>}
                      </td>

                      {/* Duration */}
                      <td style={{ padding: '14px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 900, color: '#38bdf8' }}>
                          {formatDuration(log.maintenance_duration_seconds)}
                        </div>
                        {log.response_duration_seconds > 0 && (
                          <div style={{ fontSize: '0.68rem', color: '#888', marginTop: '2px' }}>
                            Реакція: {formatDuration(log.response_duration_seconds)}
                          </div>
                        )}
                      </td>

                      {/* Performed by */}
                      <td style={{ padding: '14px', verticalAlign: 'top', color: 'var(--text-strong, #fff)', fontWeight: 800 }}>
                        {log.performed_by || '—'}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px', verticalAlign: 'top', textAlign: 'right' }}>
                        {machine && typeof onSelectMachine === 'function' && (
                          <button
                            onClick={() => {
                              onClose()
                              onSelectMachine(machine.id)
                            }}
                            title="Відкрити досьє верстата"
                            style={{
                              background: 'var(--surface-3, #24252e)',
                              border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                              color: 'var(--text-strong, #fff)',
                              padding: '6px 12px',
                              borderRadius: '10px',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: '0.15s'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = '#ff9000'
                              e.currentTarget.style.color = '#000'
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = 'var(--surface-3, #24252e)'
                              e.currentTarget.style.color = 'var(--text-strong, #fff)'
                            }}
                          >
                            До верстата <ArrowUpRight size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
