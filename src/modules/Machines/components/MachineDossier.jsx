import { useMemo, useState, useEffect } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Cpu,
  Hammer,
  History,
  PackageOpen,
  PhoneCall,
  Printer,
  Search,
  Settings2,
  ShieldAlert,
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
import {
  createMachineCall,
  fetchPublicMachineCallContext
} from '../../../services/machineCallService.js'

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
  activeCallsForMachine = [],
  currentUser,
  supabase,
  fetchData,
  maintenanceLogs,
  orders,
  tasks,
  workCards,
  nomenclatures,
  calculateTotalTime,
  handlePrintQR,
  onOpenBatchQrPrint,
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

  // ── CALL PERSONS STATE ──────────────────────────────────────
  const [callUsers, setCallUsers] = useState([])
  const [operatorName, setOperatorName] = useState(() => {
    return currentUser?.name || currentUser?.first_name
      ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim()
      : (currentUser?.login || '')
  })
  const [selectedMasterId, setSelectedMasterId] = useState('')
  const [selectedEngineerId, setSelectedEngineerId] = useState('')
  const [selectedQualityId, setSelectedQualityId] = useState('')
  const [isCalling, setIsCalling] = useState(false)
  const [callNotice, setCallNotice] = useState('')
  const [callMenuOpen, setCallMenuOpen] = useState(false)

  useEffect(() => {
    if (!selectedMachine?.id) return
    let active = true
    fetchPublicMachineCallContext(selectedMachine.id).then(ctx => {
      if (active && ctx?.users) {
        setCallUsers(ctx.users)
      }
    }).catch(err => {
      console.warn('[MachineDossier] Failed to load call context users:', err)
    })
    return () => { active = false }
  }, [selectedMachine?.id])

  const masters = useMemo(() => callUsers.filter(u => u.call_roles?.includes('master')), [callUsers])
  const engineers = useMemo(() => callUsers.filter(u => u.call_roles?.includes('engineer')), [callUsers])
  const qualities = useMemo(() => callUsers.filter(u => u.call_roles?.includes('quality')), [callUsers])

  const activeMasterCall = useMemo(() => (
    (activeCallsForMachine || []).find(c => c.called_role === 'master')
  ), [activeCallsForMachine])

  const activeEngineerCall = useMemo(() => (
    (activeCallsForMachine || []).find(c => c.called_role === 'engineer')
  ), [activeCallsForMachine])

  const activeQualityCall = useMemo(() => (
    (activeCallsForMachine || []).find(c => c.called_role === 'quality' || c.called_role === 'qc')
  ), [activeCallsForMachine])

  const handleTriggerCall = async (role) => {
    if (isCalling || !selectedMachine?.id) return
    setIsCalling(true)
    setActionError('')
    setCallNotice('')

    if (navigator.vibrate) navigator.vibrate(100)

    let employeeId = null
    if (role === 'master') employeeId = selectedMasterId || null
    else if (role === 'engineer') employeeId = selectedEngineerId || null
    else if (role === 'quality') employeeId = selectedQualityId || null

    try {
      await createMachineCall({
        machineId: selectedMachine.id,
        role,
        operatorName: operatorName.trim() || currentUser?.name || currentUser?.login || 'Оператор',
        employeeId
      })
      const roleLabel = role === 'master' ? 'Майстра' : role === 'engineer' ? 'Інженера' : 'ВКЯ'
      setCallNotice(`Виклик ${roleLabel} надіслано в чергу!`)
      setTimeout(() => setCallNotice(''), 4500)
      if (typeof fetchData === 'function') fetchData(['machine_calls'])
    } catch (err) {
      setActionError(`Помилка виклику: ${err.message}`)
    } finally {
      setIsCalling(false)
    }
  }

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
      setCallNotice('Виклик позначено як оброблений.')
      setTimeout(() => setCallNotice(''), 3000)
      if (typeof fetchData === 'function') fetchData(['machine_calls'])
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
      <section className="machine-dossier" onClick={event => { event.stopPropagation(); if (callMenuOpen) setCallMenuOpen(false) }}>
        <header className="machine-dossier-header">
          <div className="machine-header-main">
            <div className="machine-title-block">
              <div className="machine-dossier-icon"><Cpu size={28} /></div>
              <div className="machine-title-info">
                <div className="machine-eyebrow">ВІДСКАНОВАНО ВЕРСТАТ</div>
                <h2>{selectedMachine.name}</h2>
                <div className="machine-meta-chips">
                  <span className="machine-chip accent">№{selectedMachine.sequence_number || '—'}</span>
                  {selectedMachine.type && <span className="machine-chip">{selectedMachine.type}</span>}
                  {selectedMachine.inventory_no && <span className="machine-chip">Інв. {selectedMachine.inventory_no}</span>}
                  <span className="machine-chip">{selectedMachine.floor ? `${selectedMachine.floor} поверх` : 'Цех №1'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="machine-header-actions">
            <div className="machine-status-pill" style={{ color: status.color, borderColor: `${status.color}55`, background: `${status.color}12` }}>
              <span style={{ background: status.color }} />{status.label}
            </div>

            <div className="machine-header-call-wrap" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                className={`machine-action secondary call-header-btn ${callMenuOpen ? 'is-open' : ''} ${activeCallsForMachine.length > 0 ? 'has-active-calls' : ''}`}
                title="Швидкий виклик персоналу"
                onClick={() => setCallMenuOpen(prev => !prev)}
              >
                <PhoneCall size={15} color="#ff9000" />
                <span>Виклик</span>
                {activeCallsForMachine.length > 0 && (
                  <span className="call-header-badge">{activeCallsForMachine.length}</span>
                )}
              </button>

              {callMenuOpen && (
                <div className="machine-header-call-popover">
                  <div className="machine-quick-calls-header">
                    <div className="machine-panel-title" style={{ marginBottom: 0 }}>
                      <PhoneCall size={16} color="#ff9000" />
                      <span>Швидкий виклик персоналу</span>
                    </div>
                    <button
                      type="button"
                      className="machine-close-inline-btn"
                      onClick={() => setCallMenuOpen(false)}
                      title="Закрити"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <div className="machine-quick-calls-operator" style={{ marginTop: '10px', marginBottom: '10px' }}>
                    <label>Оператор:</label>
                    <input
                      type="text"
                      value={operatorName}
                      onChange={e => setOperatorName(e.target.value)}
                      placeholder="Вкажіть ім'я..."
                    />
                  </div>

                  {callNotice && (
                    <div className="machine-dossier-notice" style={{ margin: '0 0 10px 0' }}>
                      <CheckCircle2 size={15} /> {callNotice}
                    </div>
                  )}

                  <div className="machine-call-popover-list">
                    {/* 1. MASTER */}
                    <div className={`machine-call-card master ${activeMasterCall ? 'is-active' : ''}`}>
                      <div className="call-card-header">
                        <div className="call-card-icon master"><PhoneCall size={17} /></div>
                        <div className="call-card-meta">
                          <div className="call-card-title">МАЙСТЕР</div>
                          <div className="call-card-sub">Зміна / бригадир</div>
                        </div>
                        {activeMasterCall && (
                          <span className="call-badge active-master">
                            <span className="pulse-dot" /> В ЧЕРЗІ
                          </span>
                        )}
                      </div>
                      {activeMasterCall ? (
                        <div className="call-card-active-info">
                          <div className="call-active-time">
                            Надіслано: {formatDateTime(activeMasterCall.created_at)} · <strong>{activeMasterCall.operator_name || 'Оператор'}</strong>
                          </div>
                          <button className="call-resolve-btn master" onClick={() => handleResolveCall(activeMasterCall)}>
                            <CheckCircle2 size={14} /> Оброблено
                          </button>
                        </div>
                      ) : (
                        <div className="call-card-action-block">
                          <select
                            value={selectedMasterId}
                            onChange={e => setSelectedMasterId(e.target.value)}
                            className="call-select master"
                          >
                            <option value="">-- Всі майстри (Загальний) --</option>
                            {masters.map(u => (
                              <option key={u.id} value={u.id}>
                                {u.first_name || ''} {u.last_name || ''} {u.position ? `(${u.position})` : ''}
                              </option>
                            ))}
                          </select>
                          <button
                            className="call-trigger-btn master"
                            disabled={isCalling}
                            onClick={() => handleTriggerCall('master')}
                          >
                            <PhoneCall size={15} /> Викликати майстра
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 2. ENGINEER */}
                    <div className={`machine-call-card engineer ${activeEngineerCall ? 'is-active' : ''}`}>
                      <div className="call-card-header">
                        <div className="call-card-icon engineer"><Hammer size={17} /></div>
                        <div className="call-card-meta">
                          <div className="call-card-title">ІНЖЕНЕР</div>
                          <div className="call-card-sub">Налагодження / ремонт</div>
                        </div>
                        {activeEngineerCall && (
                          <span className="call-badge active-engineer">
                            <span className="pulse-dot" /> В ЧЕРЗІ
                          </span>
                        )}
                      </div>
                      {activeEngineerCall ? (
                        <div className="call-card-active-info">
                          <div className="call-active-time">
                            Надіслано: {formatDateTime(activeEngineerCall.created_at)} · <strong>{activeEngineerCall.operator_name || 'Оператор'}</strong>
                          </div>
                          <button className="call-resolve-btn engineer" onClick={() => handleResolveCall(activeEngineerCall)}>
                            <CheckCircle2 size={14} /> Оброблено
                          </button>
                        </div>
                      ) : (
                        <div className="call-card-action-block">
                          <select
                            value={selectedEngineerId}
                            onChange={e => setSelectedEngineerId(e.target.value)}
                            className="call-select engineer"
                          >
                            <option value="">-- Всі інженери (Загальний) --</option>
                            {engineers.map(u => (
                              <option key={u.id} value={u.id}>
                                {u.first_name || ''} {u.last_name || ''} {u.position ? `(${u.position})` : ''}
                              </option>
                            ))}
                          </select>
                          <button
                            className="call-trigger-btn engineer"
                            disabled={isCalling}
                            onClick={() => handleTriggerCall('engineer')}
                          >
                            <Hammer size={15} /> Викликати інженера
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 3. QUALITY CONTROL */}
                    <div className={`machine-call-card quality ${activeQualityCall ? 'is-active' : ''}`}>
                      <div className="call-card-header">
                        <div className="call-card-icon quality"><ShieldAlert size={17} /></div>
                        <div className="call-card-meta">
                          <div className="call-card-title">ВКЯ</div>
                          <div className="call-card-sub">Контроль якості / брак</div>
                        </div>
                        {activeQualityCall && (
                          <span className="call-badge active-quality">
                            <span className="pulse-dot" /> В ЧЕРЗІ
                          </span>
                        )}
                      </div>
                      {activeQualityCall ? (
                        <div className="call-card-active-info">
                          <div className="call-active-time">
                            Надіслано: {formatDateTime(activeQualityCall.created_at)} · <strong>{activeQualityCall.operator_name || 'Оператор'}</strong>
                          </div>
                          <button className="call-resolve-btn quality" onClick={() => handleResolveCall(activeQualityCall)}>
                            <CheckCircle2 size={14} /> Оброблено
                          </button>
                        </div>
                      ) : (
                        <div className="call-card-action-block">
                          <select
                            value={selectedQualityId}
                            onChange={e => setSelectedQualityId(e.target.value)}
                            className="call-select quality"
                          >
                            <option value="">-- Всі фахівці ВКЯ (Загальний) --</option>
                            {qualities.map(u => (
                              <option key={u.id} value={u.id}>
                                {u.first_name || ''} {u.last_name || ''} {u.position ? `(${u.position})` : ''}
                              </option>
                            ))}
                          </select>
                          <button
                            className="call-trigger-btn quality"
                            disabled={isCalling}
                            onClick={() => handleTriggerCall('quality')}
                          >
                            <ShieldAlert size={15} /> Викликати ВКЯ
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              className="machine-action secondary"
              title="Друкувати QR-код"
              onClick={() => {
                if (onOpenBatchQrPrint) {
                  onOpenBatchQrPrint(selectedMachine)
                } else {
                  handlePrintQR(selectedMachine)
                }
              }}
            >
              <Printer size={16} /> <span className="hide-on-mobile">QR-код</span>
            </button>
            <button className="machine-dossier-close" onClick={() => setSelectedMachineId(null)} title="Закрити картку та повернутися">
              <X size={22} />
            </button>
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

        <nav className="machine-dossier-tabs">
          <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Огляд</button>
          <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>Історія <span>{completedHistory.length}</span></button>
          <button className={tab === 'maintenance' ? 'active' : ''} onClick={() => setTab('maintenance')}>Обслуговування <span>{maintenanceLogs.length}</span></button>
        </nav>

        <div className="machine-dossier-content">
          {tab === 'overview' && (
            <div className="machine-overview-grid">
              {/* ── 1. MAINTENANCE ACTION PANEL (Moved here above calls) ── */}
              <div className="machine-panel machine-maintenance-action-panel">
                <div className="machine-maintenance-panel-header">
                  <div className="machine-panel-title">
                    <Wrench size={19} color="#ff9000" />
                    <span>Технічне обслуговування (ТО)</span>
                  </div>
                  <div className={`machine-maintenance-status-badge ${selectedMachine.status === 'under_maintenance' ? 'is-busy' : 'is-idle'}`}>
                    {selectedMachine.status === 'under_maintenance' ? '⚠️ НА ОБСЛУГОВУВАННІ' : '✅ ДОСТУПНИЙ ДО РОБОТИ'}
                  </div>
                </div>

                {selectedMachine.status === 'under_maintenance' ? (
                  <div className="machine-maintenance-active-banner anim-slide-down">
                    <div className="machine-maintenance-active-desc">
                      <strong>Верстат заблоковано для роботи</strong>
                      <p>Зараз тривають сервісні або ремонтні роботи. Запуск нових карток тимчасово зупинено. Після завершення робіт натисніть кнопку нижче.</p>
                    </div>
                    <button
                      className="machine-action success full-width-action-btn"
                      disabled={isSaving}
                      onClick={handleCompleteMaintenance}
                    >
                      <CheckCircle2 size={18} />
                      <span>{isSaving ? 'Завершення…' : 'ЗАВЕРШИТИ ТО ТА ПОВЕРНУТИ В РОБОТУ'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="machine-maintenance-idle-box">
                    <div className="machine-maintenance-meta-row">
                      <div className="machine-maintenance-meta-item">
                        Після останнього сервісу: <strong>{selectedMachine.completed_cards_count_since_maintenance || 0} карток</strong>
                      </div>
                      <button
                        type="button"
                        className="machine-link-btn"
                        onClick={() => setTab('maintenance')}
                      >
                        Журнал ТО ({maintenanceLogs.length}) →
                      </button>
                    </div>

                    {!maintenanceOpen ? (
                      <button
                        type="button"
                        className="machine-action maintenance full-width-action-btn"
                        onClick={() => { setMaintenanceOpen(true); setActionError('') }}
                      >
                        <Wrench size={18} />
                        <span>ПОЧАТИ ОБСЛУГОВУВАННЯ ВЕРСТАТА</span>
                      </button>
                    ) : (
                      <div className="machine-maintenance-inline-form anim-slide-down">
                        <div className="machine-form-header">
                          <div className="machine-section-label">ПАРАМЕТРИ НОВОГО ТО</div>
                          <button
                            type="button"
                            className="machine-close-inline-btn"
                            onClick={() => setMaintenanceOpen(false)}
                            title="Скасувати"
                          >
                            <X size={16} />
                          </button>
                        </div>

                        <div className="machine-form-grid">
                          <label>
                            <span>Тип роботи:</span>
                            <select value={maintenanceType} onChange={event => { setMaintenanceType(event.target.value); setActionError('') }}>
                              {MAINTENANCE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                            </select>
                          </label>

                          {requiresHead && (
                            <label>
                              <span>Голова верстата ФЕЯ:</span>
                              <select value={machineHead} onChange={event => setMachineHead(event.target.value)}>
                                <option value="">Оберіть голову</option>
                                {MACHINE_HEADS.map(head => <option key={head} value={head}>{head}</option>)}
                              </select>
                            </label>
                          )}

                          {requiresSpare && (
                            <label>
                              <span>Запчастина:</span>
                              <select value={sparePart} onChange={event => setSparePart(event.target.value)} disabled={MACHINE_SPARE_PARTS.length === 0}>
                                <option value="">{MACHINE_SPARE_PARTS.length ? 'Оберіть запчастину' : 'Перелік запчастин буде додано'}</option>
                                {MACHINE_SPARE_PARTS.map(part => <option key={part} value={part}>{part}</option>)}
                              </select>
                            </label>
                          )}

                          <label className="machine-form-full-width">
                            <span>Коментар:</span>
                            <input value={notes} onChange={event => setNotes(event.target.value)} placeholder="Опис робіт або дефекту (необов’язково)" />
                          </label>
                        </div>

                        <div className="machine-form-footer">
                          <button
                            type="button"
                            className="machine-action maintenance primary"
                            disabled={isSaving || (requiresSpare && MACHINE_SPARE_PARTS.length === 0)}
                            onClick={handleStartMaintenance}
                          >
                            <Wrench size={17} /> {isSaving ? 'Збереження…' : 'Підтвердити та почати ТО'}
                          </button>
                          <button
                            type="button"
                            className="machine-action secondary"
                            onClick={() => setMaintenanceOpen(false)}
                          >
                            Скасувати
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

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
