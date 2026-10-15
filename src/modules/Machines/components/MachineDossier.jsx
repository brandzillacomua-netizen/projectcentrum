import { useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Cpu,
  History,
  PackageOpen,
  Printer,
  Search,
  Settings2,
  Wrench,
  X
} from 'lucide-react'
import {
  buildUniqueMachineCardHistory,
  getMachineStatusView,
  isFairyMachine,
  MACHINE_HEADS,
  MACHINE_SPARE_PARTS,
  MAINTENANCE_TYPES
} from '../utils/machineDashboardUtils.js'

const formatDateTime = value => value
  ? new Date(value).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '—'

const formatDuration = seconds => {
  if (seconds === null || seconds === undefined) return '—'
  const total = Math.max(0, Number(seconds) || 0)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  return hours > 0 ? `${hours}г ${minutes}хв` : minutes > 0 ? `${minutes}хв ${secs}с` : `${secs}с`
}

const cardState = row => {
  if (row.is_active) return { label: 'В роботі', color: '#ef4444' }
  if (row.is_conflict) return { label: 'Конфлікт даних', color: '#ef4444' }
  if (row.is_pending) return { label: 'Очікує буфер', color: '#f59e0b' }
  return { label: 'Виконано', color: '#10b981' }
}

export function MachineDossier({
  selectedMachineId,
  setSelectedMachineId,
  selectedMachine,
  activeCallsForMachine,
  currentUser,
  supabase,
  maintenanceLogs,
  orders,
  tasks,
  workCards,
  nomenclatures,
  calculateTotalTime,
  handlePrintQR,
  getHistoryForMachine,
  startMachineMaintenance,
  completeMachineMaintenance
}) {
  const [tab, setTab] = useState('overview')
  const [search, setSearch] = useState('')
  const [maintenanceOpen, setMaintenanceOpen] = useState(false)
  const [maintenanceType, setMaintenanceType] = useState(MAINTENANCE_TYPES[0])
  const [machineHead, setMachineHead] = useState('')
  const [sparePart, setSparePart] = useState('')
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionNotice, setActionNotice] = useState('')
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPageSize, setHistoryPageSize] = useState(20)

  const history = useMemo(() => (
    buildUniqueMachineCardHistory(selectedMachine ? getHistoryForMachine(selectedMachine) : [])
  ), [getHistoryForMachine, selectedMachine])

  const cardsById = useMemo(() => new Map((workCards || []).map(card => [String(card.id), card])), [workCards])
  const ordersById = useMemo(() => new Map((orders || []).map(order => [String(order.id), order])), [orders])
  const tasksById = useMemo(() => new Map((tasks || []).map(task => [String(task.id), task])), [tasks])
  const nomsById = useMemo(() => new Map((nomenclatures || []).map(nom => [String(nom.id), nom])), [nomenclatures])

  if (!selectedMachineId || !selectedMachine) return null

  const activeRows = history.filter(row => row.is_active)
  const currentRows = history.filter(row => row.is_active || row.is_conflict)
  const completedHistory = history.filter(row => !row.is_active && !row.is_conflict)
  const status = getMachineStatusView(selectedMachine, activeRows.length > 0)
  const fairyMachine = isFairyMachine(selectedMachine)
  const requiresHead = maintenanceType === 'Заміна цанги' && fairyMachine
  const requiresSpare = maintenanceType === 'Заміна деталі у верстаті'
  const normalizedSearch = search.trim().toLowerCase()
  const filteredHistory = completedHistory.filter(row => {
    if (!normalizedSearch) return true
    const rootCard = cardsById.get(String(row.card_id))
    const task = tasksById.get(String(row.task_id || rootCard?.task_id))
    const order = ordersById.get(String(row.order_id || rootCard?.order_id || task?.order_id))
    const nom = nomsById.get(String(row.nomenclature_id || rootCard?.nomenclature_id))
    return `${row.card_id || ''} ${order?.order_num || ''} ${nom?.name || ''} ${(row.operators || []).join(' ')} ${row.operator_name || ''}`
      .toLowerCase()
      .includes(normalizedSearch)
  })
  const historyPageCount = Math.max(1, Math.ceil(filteredHistory.length / historyPageSize))
  const safeHistoryPage = Math.min(historyPage, historyPageCount)
  const paginatedHistory = filteredHistory.slice(
    (safeHistoryPage - 1) * historyPageSize,
    safeHistoryPage * historyPageSize
  )
  const pageNumbers = Array.from({ length: historyPageCount }, (_, index) => index + 1)
    .filter(page => page === 1 || page === historyPageCount || Math.abs(page - safeHistoryPage) <= 2)

  const handleResolveCall = async call => {
    try {
      const resolverName = currentUser?.name || currentUser?.login || 'Адміністратор'
      const { error } = await supabase.from('machine_calls').update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: resolverName
      }).eq('id', call.id)
      if (error) throw error
    } catch (error) {
      setActionError(`Не вдалося закрити виклик: ${error.message}`)
    }
  }

  const handleStartMaintenance = async () => {
    if (requiresHead && !machineHead) {
      setActionError('Оберіть голову верстата ФЕЯ.')
      return
    }
    if (requiresSpare && !sparePart) {
      setActionError('Перелік запчастин ще не налаштований. Додайте запчастини перед запуском цієї роботи.')
      return
    }
    setIsSaving(true)
    setActionError('')
    setActionNotice('')
    try {
      await startMachineMaintenance({
        type: maintenanceType,
        machineHead: requiresHead ? machineHead : null,
        sparePart: requiresSpare ? sparePart : null,
        notes
      })
      setMaintenanceOpen(false)
      setTab('maintenance')
      setNotes('')
      setActionNotice('Обслуговування розпочато. Верстат заблокований для запуску карток. Після завершення робіт натисніть «Завершити ТО та повернути в роботу».')
    } catch (error) {
      setActionError(`Не вдалося почати обслуговування: ${error.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCompleteMaintenance = async () => {
    setIsSaving(true)
    setActionError('')
    setActionNotice('')
    try {
      await completeMachineMaintenance()
      setActionNotice('Обслуговування завершено. Верстат знову доступний для запуску карток.')
    } catch (error) {
      setActionError(`Не вдалося завершити обслуговування: ${error.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const renderCardRows = rows => (
    <div className="machine-dossier-table-wrap">
      <table className="machine-dossier-table">
        <thead>
          <tr>
            <th>Статус / час</th>
            <th>Наряд</th>
            <th>Картка</th>
            <th>Деталь</th>
            <th>Оператор</th>
            <th className="num">К-сть</th>
            <th className="num">Брак</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const rootCard = cardsById.get(String(row.card_id))
            const task = tasksById.get(String(row.task_id || rootCard?.task_id))
            const order = ordersById.get(String(row.order_id || rootCard?.order_id || task?.order_id))
            const nom = nomsById.get(String(row.nomenclature_id || rootCard?.nomenclature_id))
            const state = cardState(row)
            const operators = [...(row.operators || []), rootCard?.operator_name]
              .map(name => String(name || '').trim())
              .filter((name, index, values) => name && !['—', '-', 'не вказано', 'невідомо'].includes(name.toLowerCase()) && values.findIndex(item => item.toLowerCase() === name.toLowerCase()) === index)
            return (
              <tr key={String(row.card_id || row.id)}>
                <td>
                  <span className="machine-row-state" style={{ color: state.color }}>{state.label}</span>
                  <small>{formatDateTime(row.completed_at || row.created_at)}</small>
                </td>
                <td className="accent">{order?.order_num ? `№${order.order_num}` : '—'}</td>
                <td title={String(row.card_id || '')}>#{String(row.card_id || row.id || '').slice(0, 8)}</td>
                <td className="machine-detail-name">{nom?.name || rootCard?.nomenclature_name || '—'}</td>
                <td className="machine-operators-cell">
                  {operators.length
                    ? operators.map((operator, index) => <div key={operator}><span>{index + 1}</span>{operator}</div>)
                    : <em>Не призначено</em>}
                </td>
                <td className="num strong">{Number(row.qty_completed || row.quantity) || 0}</td>
                <td className="num danger">{Number(row.scrap_qty) || 0}</td>
              </tr>
            )
          })}
          {rows.length === 0 && (
            <tr><td colSpan="7" className="machine-empty">Даних поки немає</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="machine-dossier-overlay" onClick={() => setSelectedMachineId(null)}>
      <section className="machine-dossier" onClick={event => event.stopPropagation()}>
        <header className="machine-dossier-header">
          <div className="machine-title-block">
            <div className="machine-dossier-icon"><Cpu size={26} /></div>
            <div>
              <div className="machine-eyebrow">КАРТКА ВЕРСТАТА</div>
              <h2>{selectedMachine.name}</h2>
              <p>Пор. №{selectedMachine.sequence_number || '—'} · Інв. {selectedMachine.inventory_no || '—'} · {selectedMachine.floor || '—'} поверх</p>
            </div>
          </div>
          <div className="machine-header-actions">
            <div className="machine-status-pill" style={{ color: status.color, borderColor: `${status.color}55`, background: `${status.color}12` }}>
              <span style={{ background: status.color }} />{status.label}
            </div>
            <button className="machine-action secondary" onClick={() => handlePrintQR(selectedMachine)}><Printer size={16} /> QR-код</button>
            <button className="machine-action maintenance" onClick={() => {
              if (selectedMachine.status === 'under_maintenance') {
                setMaintenanceOpen(false)
                setTab('maintenance')
              } else {
                setMaintenanceOpen(value => !value)
              }
            }}><Wrench size={16} /> {selectedMachine.status === 'under_maintenance' ? 'Обслуговується' : 'Обслуговування'}</button>
            <button className="machine-dossier-close" onClick={() => setSelectedMachineId(null)}><X size={22} /></button>
          </div>
        </header>

        <div className="machine-kpis">
          <div><Activity size={18} /><span>Поточний стан<strong style={{ color: status.color }}>{status.label}</strong></span></div>
          <div><PackageOpen size={18} /><span>Карток у роботі<strong>{activeRows.length}</strong></span></div>
          <div><Clock3 size={18} /><span>Загальний час<strong>{calculateTotalTime(selectedMachine)}</strong></span></div>
          <div><Settings2 size={18} /><span>Після сервісу<strong>{selectedMachine.completed_cards_count_since_maintenance || 0} карт.</strong></span></div>
          <div><AlertTriangle size={18} /><span>Активні виклики<strong>{activeCallsForMachine.length}</strong></span></div>
        </div>

        {actionError && <div className="machine-dossier-error">{actionError}</div>}
        {actionNotice && <div className="machine-dossier-notice">{actionNotice}</div>}

        {maintenanceOpen && (
          <div className="machine-maintenance-form">
            <div>
              <div className="machine-section-label">НОВА РОБОТА З ОБСЛУГОВУВАННЯ</div>
              <h3>Що потрібно зробити?</h3>
            </div>
            <label>
              Тип роботи
              <select value={maintenanceType} onChange={event => { setMaintenanceType(event.target.value); setActionError('') }}>
                {MAINTENANCE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            {requiresHead && (
              <label>
                Голова верстата ФЕЯ
                <select value={machineHead} onChange={event => setMachineHead(event.target.value)}>
                  <option value="">Оберіть голову</option>
                  {MACHINE_HEADS.map(head => <option key={head} value={head}>{head}</option>)}
                </select>
              </label>
            )}
            {requiresSpare && (
              <label>
                Запчастина
                <select value={sparePart} onChange={event => setSparePart(event.target.value)} disabled={MACHINE_SPARE_PARTS.length === 0}>
                  <option value="">{MACHINE_SPARE_PARTS.length ? 'Оберіть запчастину' : 'Перелік запчастин буде додано'}</option>
                  {MACHINE_SPARE_PARTS.map(part => <option key={part} value={part}>{part}</option>)}
                </select>
              </label>
            )}
            <label className="machine-maintenance-notes">
              Коментар
              <input value={notes} onChange={event => setNotes(event.target.value)} placeholder="Необов’язково" />
            </label>
            <button className="machine-action maintenance primary" disabled={isSaving || (requiresSpare && MACHINE_SPARE_PARTS.length === 0)} onClick={handleStartMaintenance}>
              <Wrench size={17} /> {isSaving ? 'Збереження…' : 'Почати обслуговування'}
            </button>
          </div>
        )}

        <nav className="machine-dossier-tabs">
          <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Огляд</button>
          <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>Історія <span>{completedHistory.length}</span></button>
          <button className={tab === 'maintenance' ? 'active' : ''} onClick={() => setTab('maintenance')}>Обслуговування <span>{maintenanceLogs.length}</span></button>
        </nav>

        <div className="machine-dossier-content">
          {tab === 'overview' && (
            <div className="machine-overview-grid">
              <div className="machine-panel current-work">
                <div className="machine-panel-title"><Activity size={18} /> Зараз на верстаті</div>
                {currentRows.length ? renderCardRows(currentRows) : <div className="machine-empty-state"><CheckCircle2 size={28} /> Верстат зараз вільний</div>}
              </div>
              <aside className="machine-panel machine-info-panel">
                <div className="machine-panel-title"><Cpu size={18} /> Параметри</div>
                <dl>
                  <div><dt>Тип</dt><dd>{selectedMachine.type || '—'}</dd></div>
                  <div><dt>Місткість</dt><dd>{selectedMachine.sheet_capacity || 0} листів</dd></div>
                  <div><dt>Інвентарний №</dt><dd>{selectedMachine.inventory_no || '—'}</dd></div>
                  <div><dt>Розташування</dt><dd>{selectedMachine.floor || '—'} поверх</dd></div>
                </dl>
                <p>{selectedMachine.description || 'Примітки до верстата не вказані.'}</p>
              </aside>
              {activeCallsForMachine.length > 0 && (
                <div className="machine-panel machine-calls-panel">
                  <div className="machine-panel-title danger"><AlertTriangle size={18} /> Активні виклики</div>
                  {activeCallsForMachine.map(call => (
                    <div className="machine-call-row" key={call.id}>
                      <div><strong>{call.called_role === 'master' ? 'Майстер' : call.called_role === 'engineer' ? 'Інженер' : 'ВКЯ'}</strong><small>{call.operator_name || 'Оператор'} · {formatDateTime(call.created_at)}</small></div>
                      <button onClick={() => handleResolveCall(call)}>Оброблено</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="machine-panel recent-cards">
                <div className="machine-panel-title"><History size={18} /> Останні виконані картки</div>
                {renderCardRows(completedHistory.slice(0, 8))}
              </div>
            </div>
          )}

          {tab === 'history' && (
            <div className="machine-panel machine-history-panel">
              <div className="machine-history-toolbar">
                <div><div className="machine-panel-title"><History size={18} /> Історія карток</div><small>Один рядок — одна фізична картка, без повторів по етапах.</small></div>
                <label><Search size={16} /><input value={search} onChange={event => { setSearch(event.target.value); setHistoryPage(1) }} placeholder="Наряд, картка, деталь, оператор…" /></label>
              </div>
              {renderCardRows(paginatedHistory)}
              <div className="machine-pagination">
                <div className="machine-pagination-summary">
                  Показано {filteredHistory.length ? (safeHistoryPage - 1) * historyPageSize + 1 : 0}–{Math.min(safeHistoryPage * historyPageSize, filteredHistory.length)} з {filteredHistory.length}
                  <select value={historyPageSize} onChange={event => { setHistoryPageSize(Number(event.target.value)); setHistoryPage(1) }}>
                    <option value="10">10 на сторінці</option>
                    <option value="20">20 на сторінці</option>
                    <option value="50">50 на сторінці</option>
                  </select>
                </div>
                <div className="machine-pagination-pages">
                  <button disabled={safeHistoryPage === 1} onClick={() => setHistoryPage(page => Math.max(1, page - 1))}><ChevronLeft size={16} /></button>
                  {pageNumbers.map((page, index) => {
                    const previous = pageNumbers[index - 1]
                    return <span key={page} className="machine-page-slot">{previous && page - previous > 1 ? <i>…</i> : null}<button className={page === safeHistoryPage ? 'active' : ''} onClick={() => setHistoryPage(page)}>{page}</button></span>
                  })}
                  <button disabled={safeHistoryPage === historyPageCount} onClick={() => setHistoryPage(page => Math.min(historyPageCount, page + 1))}><ChevronRight size={16} /></button>
                </div>
              </div>
            </div>
          )}

          {tab === 'maintenance' && (
            <div className="machine-panel machine-maintenance-panel">
              <div className="machine-maintenance-heading">
                <div><div className="machine-panel-title"><Wrench size={18} /> Журнал обслуговування</div><small>Причина, виконавець, реагування та тривалість.</small></div>
                {selectedMachine.status === 'under_maintenance' && (
                  <button className="machine-action success" disabled={isSaving} onClick={handleCompleteMaintenance}><CheckCircle2 size={16} /> Завершити ТО та повернути в роботу</button>
                )}
              </div>
              <div className="machine-dossier-table-wrap">
                <table className="machine-dossier-table">
                  <thead><tr><th>Робота</th><th>Статус</th><th>Початок</th><th>Завершення</th><th>Виконав</th><th>Реагування</th><th>Тривалість</th></tr></thead>
                  <tbody>
                    {maintenanceLogs.map(log => (
                      <tr key={log.id}>
                        <td className="machine-detail-name">
                          {log.maintenance_type || 'Очищення робочої поверхні'}
                          {log.machine_head ? <small>{log.machine_head}</small> : null}
                          {log.spare_part ? <small>{log.spare_part}</small> : null}
                          {log.notes ? <small>Коментар: {log.notes}</small> : null}
                        </td>
                        <td className="accent">{log.status === 'pending' ? 'Очікує' : log.status === 'in_progress' ? 'Виконується' : log.status === 'completed' ? 'Виконано' : 'Пропущено'}</td>
                        <td>{formatDateTime(log.started_at || log.triggered_at)}</td>
                        <td>{formatDateTime(log.completed_at)}</td>
                        <td>{log.performed_by || '—'}</td>
                        <td>{formatDuration(log.response_duration_seconds)}</td>
                        <td>{formatDuration(log.maintenance_duration_seconds)}</td>
                      </tr>
                    ))}
                    {maintenanceLogs.length === 0 && <tr><td colSpan="7" className="machine-empty">Журнал обслуговування порожній</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
