import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Users,
  Calendar,
  LayoutDashboard,
  Save,
  Plus,
  RefreshCw,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  UserPlus,
  Shield,
  Briefcase,
  Play,
  Pause,
  AlertTriangle,
  RotateCcw
} from 'lucide-react'
import { useMES } from '../MESContext'

export default function Shop1ForemanModule() {
  const {
    systemUsers,
    currentUser,
    upsertUser,
    workCards,
    workCardHistory,
    fetchData,
    machines,
    nomenclatures,
    formatUserName,
    supabase,
    companyPositions,
    companyStructure,
    tasks,
    orders,
    bomItems,
    inventory
  } = useMES()

  const [activeTab, setActiveTab] = useState('calendar') // 'dashboard' | 'calendar' | 'staff'
  const [userSearch, setUserSearch] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Dynamically resolve Shop 1 Positions from database companyPositions
  const resolvedShop1Positions = useMemo(() => {
    // Find departments that belong to Shop 1
    const s1Depts = (companyStructure || []).filter(d => {
      const name = String(d.name || '').toLowerCase()
      return (
        name.includes('цех 1') ||
        name.includes('цех №1') ||
        name.includes('галтовка') ||
        name.includes('прийомка') ||
        name.includes('сортування')
      )
    })
    const s1DeptIds = s1Depts.map(d => d.id)

    // Filter positions belonging to these departments
    const dbPositions = (companyPositions || []).filter(p => {
      if (!p.department_id) return true // general positions
      return s1DeptIds.includes(p.department_id)
    }).map(p => p.name)

    // If database positions are empty or don't cover core Shop 1 needs, fallback to default lists
    if (dbPositions.length > 0) {
      return Array.from(new Set(dbPositions))
    }

    return [
      'Оператор розкрою',
      'Галтовщик',
      'Приймальник',
      'Сортувальник',
      'Начальник дільниці',
      'Помічник оператора'
    ]
  }, [companyPositions, companyStructure])

  // Staff Form State
  const [userForm, setUserForm] = useState({
    id: null,
    login: '',
    password: '',
    first_name: '',
    last_name: '',
    position: 'Оператор розкрою',
    department: 'Цех №1',
    shift: 'Зміна 1',
    access_rights: {
      operator: true,
      shop1: true,
      tumbling_terminal: true,
      reception_terminal: true,
      sorting_terminal: true
    }
  })

  // Calendar States
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth()) // 0-11
  const [calendarSaving, setCalendarSaving] = useState(false)
  const [openAccordions, setOpenAccordions] = useState({
    '👥 ЗМІНА 1': true,
    '👥 ЗМІНА 2': true,
    '👥 ЗМІНА 3': true,
    '👥 ЗМІНА 4': true,
    '👥 БЕЗ ЗМІНИ': true
  })

  const toggleAccordion = (title) => {
    setOpenAccordions(prev => ({
      ...prev,
      [title]: !prev[title]
    }))
  }

  // Shift Report States (Period Selection + Card List Modal)
  const [reportStartDate, setReportStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7) // Last 7 days by default
    return d.toISOString().split('T')[0]
  })
  const [reportEndDate, setReportEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [quickPeriod, setQuickPeriod] = useState('week')
  const [selectedReportDetails, setSelectedReportDetails] = useState(null) // { shift: string, type: 'active' | 'completed' }
  const [shiftReportHistory, setShiftReportHistory] = useState([])
  const [shiftReportLoading, setShiftReportLoading] = useState(false)

  // Nariad Reports States
  const [nariadSearch, setNariadSearch] = useState('')
  const [selectedNariadTaskId, setSelectedNariadTaskId] = useState(null)
  const [nariadReportLoading, setNariadReportLoading] = useState(false)
  const [nariadReportData, setNariadReportData] = useState(null) // { historyRows, taskCards, materialRequests }
  const [nariadStageFilter, setNariadStageFilter] = useState('All')
  const [nariadNomFilter, setNariadNomFilter] = useState('All')
  const [nariadSortBy, setNariadSortBy] = useState('date')
  const [nariadDetailModal, setNariadDetailModal] = useState(null)
  const [nariadCatalog, setNariadCatalog] = useState([])
  const [nariadCatalogLoading, setNariadCatalogLoading] = useState(false)
  const [nariadCatalogTotal, setNariadCatalogTotal] = useState(0)
  const [nariadCatalogPage, setNariadCatalogPage] = useState(0)
  const nariadReportCache = useRef(new Map())

  // The archive is intentionally loaded independently from the global MES state.
  // Only 50 lightweight rows are transferred; report details are fetched on demand.
  useEffect(() => {
    if (activeTab !== 'nariad_reports') return
    const timer = setTimeout(async () => {
      setNariadCatalogLoading(true)
      try {
        const { data, error } = await supabase.rpc('shop1_naryad_catalog', {
          p_search: nariadSearch.trim() || null,
          p_limit: 50,
          p_offset: nariadCatalogPage * 50
        })
        if (error) throw error
        const rows = data || []
        setNariadCatalog(rows)
        setNariadCatalogTotal(Number(rows[0]?.total_count) || rows.length)
      } catch (error) {
        // Safe compatibility path while the accompanying migration is being deployed.
        console.warn('Naryad catalog RPC unavailable, using the locally loaded window', error)
        setNariadCatalog([])
        setNariadCatalogTotal(0)
      } finally {
        setNariadCatalogLoading(false)
      }
    }, nariadSearch ? 300 : 0)
    return () => clearTimeout(timer)
  }, [activeTab, nariadSearch, nariadCatalogPage, supabase])

  useEffect(() => { setNariadCatalogPage(0) }, [nariadSearch])

  const handleQuickDateSelect = (val) => {
    if (!val) return;
    const today = new Date();
    const toISO = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const todayStr = toISO(today);
    let startStr = '';
    let endStr = todayStr;

    if (val === 'today') {
      startStr = todayStr;
    } else if (val === 'yesterday') {
      const yest = new Date();
      yest.setDate(yest.getDate() - 1);
      startStr = toISO(yest);
      endStr = startStr;
    } else if (val === '3days') {
      const d = new Date();
      d.setDate(d.getDate() - 2);
      startStr = toISO(d);
    } else if (val === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      startStr = toISO(d);
    } else if (val === 'month') {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      startStr = toISO(d);
    } else if (val === 'quarter') {
      const d = new Date();
      d.setMonth(d.getMonth() - 3);
      startStr = toISO(d);
    } else if (val === 'halfyear') {
      const d = new Date();
      d.setMonth(d.getMonth() - 6);
      startStr = toISO(d);
    } else if (val === 'year') {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 1);
      startStr = toISO(d);
    }

    setReportStartDate(startStr);
    setReportEndDate(endStr);
    setQuickPeriod(val);
  };

  useEffect(() => {
    fetchData(['work_cards', 'work_card_history']).catch(e => console.error(e))
  }, [])

  // The global MES context intentionally keeps only the latest 500 history rows.
  // Shift reports need the complete selected period, so fetch it independently
  // in pages without inflating the global application cache.
  useEffect(() => {
    if (activeTab !== 'shifts_report' || !reportStartDate || !reportEndDate) return
    let cancelled = false

    const loadShiftReportHistory = async () => {
      setShiftReportLoading(true)
      try {
        const periodStart = new Date(`${reportStartDate}T00:00:00`).toISOString()
        const periodEnd = new Date(`${reportEndDate}T23:59:59.999`).toISOString()
        const pageSize = 1000
        let offset = 0
        let rows = []

        while (!cancelled) {
          const { data, error } = await supabase
            .from('work_card_history')
            .select('*')
            .gte('completed_at', periodStart)
            .lte('completed_at', periodEnd)
            .order('completed_at', { ascending: true })
            .range(offset, offset + pageSize - 1)
          if (error) throw error
          const page = data || []
          rows = rows.concat(page)
          if (page.length < pageSize) break
          offset += pageSize
        }

        if (!cancelled) setShiftReportHistory(rows)
      } catch (error) {
        console.error('Failed to load complete shift report history:', error)
        if (!cancelled) setShiftReportHistory(workCardHistory || [])
      } finally {
        if (!cancelled) setShiftReportLoading(false)
      }
    }

    loadShiftReportHistory()
    return () => { cancelled = true }
  }, [activeTab, reportStartDate, reportEndDate, supabase])

  // Filter only Shop 1 Users
  const shop1Users = useMemo(() => {
    return (systemUsers || []).filter(u => {
      const dept = String(u.department || '').toLowerCase()
      const pos = String(u.position || '').toLowerCase()
      return (
        dept.includes('цех 1') ||
        dept.includes('цех №1') ||
        dept.includes('галтовка') ||
        dept.includes('прийомка') ||
        dept.includes('сортування') ||
        resolvedShop1Positions.some(p => pos.includes(p.toLowerCase()))
      )
    })
  }, [systemUsers, resolvedShop1Positions])

  // Filtered shop1 users list for registry
  const filteredUsers = useMemo(() => {
    return shop1Users.filter(u => {
      const q = userSearch.toLowerCase().trim()
      if (!q) return true
      const fullName = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase()
      return (
        fullName.includes(q) ||
        String(u.login || '').toLowerCase().includes(q) ||
        String(u.position || '').toLowerCase().includes(q)
      )
    })
  }, [shop1Users, userSearch])

  // Live Machine Monitor
  const machineMonitorList = useMemo(() => {
    const s1Machines = (machines || []).filter(m => {
      const name = String(m.name || '').toLowerCase()
      const type = String(m.type || '').toLowerCase()
      return (
        name.includes('cnc') ||
        name.includes('ке xin') ||
        name.includes('вібростіл') ||
        name.includes('сушка') ||
        type.includes('cnc') ||
        type.includes('galt') ||
        type.includes('галтовка')
      )
    })

    return s1Machines.map(m => {
      const activeCard = (workCards || []).find(c => {
        if (c.status !== 'in-progress' && c.status !== 'paused') return false
        const cardMachine = String(c.machine || '').toLowerCase()
        const matchName = String(m.name || '').toLowerCase()
        const matchInv = String(m.inventory_no || '').toLowerCase()
        const matchSeq = String(m.sequence_number || '').toLowerCase()

        return (
          cardMachine.includes(matchName) ||
          (matchInv && cardMachine.includes(matchInv)) ||
          (matchSeq && cardMachine.includes(matchSeq))
        )
      })

      const nom = activeCard ? nomenclatures.find(n => n.id === activeCard.nomenclature_id) : null

      return {
        machine: m,
        activeCard,
        nomenclature: nom
      }
    })
  }, [machines, workCards, nomenclatures])

  // Save/Edit user logic
  const handleSaveUser = async (e) => {
    e.preventDefault()
    if (!userForm.login || (!userForm.id && !userForm.password)) return

    const cleanLogin = userForm.login.trim()
    const cleanPassword = userForm.password.trim()

    if (!userForm.id) {
      const exists = (systemUsers || []).some(u => u.login.toLowerCase().trim() === cleanLogin.toLowerCase())
      if (exists) {
        alert(`Логін "${cleanLogin}" вже зайнятий! Оберіть інший.`)
        return
      }
    }

    setIsProcessing(true)
    const payload = {
      login: cleanLogin,
      password: cleanPassword,
      first_name: userForm.first_name || '',
      last_name: userForm.last_name || '',
      position: userForm.position,
      department: 'Цех №1',
      shift: userForm.shift || 'Без зміни',
      access_rights: userForm.access_rights
    }

    if (userForm.id) {
      payload.id = userForm.id
    }

    const { error } = await upsertUser(payload)
    setIsProcessing(false)

    if (error) {
      alert(`Помилка збереження: ${error.message}`)
    } else {
      setUserForm({
        id: null,
        login: '',
        password: '',
        first_name: '',
        last_name: '',
        position: 'Оператор розкрою',
        department: 'Цех №1',
        shift: 'Зміна 1',
        access_rights: {
          operator: true,
          shop1: true,
          tumbling_terminal: true,
          reception_terminal: true,
          sorting_terminal: true
        }
      })
    }
  }

  const editUser = (user) => {
    setUserForm({
      ...user,
      password: '••••••••',
      access_rights: {
        operator: true,
        shop1: true,
        tumbling_terminal: true,
        reception_terminal: true,
        sorting_terminal: true,
        ...(user.access_rights || {})
      }
    })
  }

  const handleResetPassword = async (user) => {
    const newPass = window.prompt(`Введіть новий пароль для @${user.login}:`, '123456')
    if (!newPass) return
    setIsProcessing(true)
    const { error } = await upsertUser({
      ...user,
      password: newPass
    })
    setIsProcessing(false)
    if (error) {
      alert('Помилка оновлення пароля: ' + error.message)
    } else {
      alert('Пароль успішно змінено!')
    }
  }

  // Calendar Helpers
  const daysInMonth = useMemo(() => {
    return new Date(currentYear, currentMonth + 1, 0).getDate()
  }, [currentYear, currentMonth])

  const monthNames = [
    'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
    'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
  ]

  const handleMonthChange = (direction) => {
    if (direction === 'prev') {
      if (currentMonth === 0) {
        setCurrentMonth(11)
        setCurrentYear(prev => prev - 1)
      } else {
        setCurrentMonth(prev => prev - 1)
      }
    } else {
      if (currentMonth === 11) {
        setCurrentMonth(0)
        setCurrentYear(prev => prev + 1)
      } else {
        setCurrentMonth(prev => prev + 1)
      }
    }
  }

  // Toggle shift day status
  const handleToggleDayShift = async (user, day) => {
    setCalendarSaving(true)
    const calendarKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const currentCal = user.shift_calendar || {}
    const currentVal = currentCal[calendarKey]
    
    let newVal = 'Р'
    if (currentVal === 'Р') newVal = 'В'
    else if (currentVal === 'В') newVal = 'Л'
    else if (currentVal === 'Л') newVal = null

    const updatedCal = {
      ...currentCal,
      [calendarKey]: newVal
    }

    Object.keys(updatedCal).forEach(k => {
      if (!updatedCal[k]) delete updatedCal[k]
    })

    const { error } = await upsertUser({
      ...user,
      shift_calendar: updatedCal
    })
    setCalendarSaving(false)
    if (error) {
      alert('Помилка оновлення календаря: ' + error.message)
    }
  }

  // Group by Shift and sort so that Masters are on top inside each shift category
  const categorizedCalendarUsers = useMemo(() => {
    const shiftGroups = {
      'Зміна 1': [],
      'Зміна 2': [],
      'Зміна 3': [],
      'Зміна 4': [],
      'Без зміни': []
    }

    shop1Users.forEach(u => {
      let shift = String(u.shift || 'Без зміни')
      if (!shiftGroups[shift]) {
        shiftGroups[shift] = []
      }
      shiftGroups[shift].push(u)
    })

    const sortByPosition = (a, b) => {
      const isAMaster = ['начальник', 'майстер', 'мастер', 'керівник'].some(kw => String(a.position || '').toLowerCase().includes(kw))
      const isBMaster = ['начальник', 'майстер', 'мастер', 'керівник'].some(kw => String(b.position || '').toLowerCase().includes(kw))

      if (isAMaster && !isBMaster) return -1
      if (!isAMaster && isBMaster) return 1
      return 0
    }

    return Object.entries(shiftGroups).map(([shiftName, users]) => {
      return {
        title: `👥 ${shiftName.toUpperCase()}`,
        users: [...users].sort(sortByPosition)
      }
    }).filter(group => group.users.length > 0)
  }, [shop1Users])

  // Count active and completed cards for each shift, sub-divided by cutting vs tumbling, including timing metrics & buffers
  const shiftStats = useMemo(() => {
    const emptyShiftStats = () => ({
      active: 0, paused: 0, buffer: 0, completed: 0,
      activeCards: [], pausedCards: [], bufferCards: [], completedCards: [],
      cuttingActive: 0, cuttingCompleted: 0,
      tumblingActive: 0, tumblingCompleted: 0,
      totalTuningTimeMins: 0, totalWorkingTimeMins: 0,
      completedWorkingTimeMins: 0,
      completedOperationKeys: new Set()
    })
    const stats = {
      'Зміна 1': emptyShiftStats(),
      'Зміна 2': emptyShiftStats(),
      'Зміна 3': emptyShiftStats(),
      'Зміна 4': emptyShiftStats(),
      'Без зміни': emptyShiftStats()
    }

    const start = new Date(reportStartDate + 'T00:00:00')
    const end = new Date(reportEndDate + 'T23:59:59')

    // Current state is mutually exclusive: working, paused or waiting in buffer.
    ;(workCards || []).forEach(c => {
      const status = String(c.status || '')
      const isWorking = status === 'in-progress'
      const isPaused = status === 'paused'
      const isBuffer = ['at-buffer', 'waiting-buffer'].includes(status)
      if (!isWorking && !isPaused && !isBuffer) return

      const startedDate = c.started_at || c.created_at
      if (startedDate) {
        const d = new Date(startedDate)
        if (d < start || d > end) return
      }

      const user = (systemUsers || []).find(u => formatUserName(u) === c.operator_name)
      const shift = c.shift_name || user?.shift || 'Без зміни'
      const targetGroup = stats[shift] || stats['Без зміни']

      if (isPaused) {
        targetGroup.paused += 1
        targetGroup.pausedCards.push(c)
        return
      }
      if (isBuffer) {
        targetGroup.buffer += 1
        targetGroup.bufferCards.push(c)
        return
      }

      targetGroup.active += 1
      targetGroup.activeCards.push(c)

      // Sub-divide by operation: tumbling starts with 'Галтовка', everything else is cutting/розкрій
      const op = String(c.operation || '')
      if (op.startsWith('Галтовка')) {
        targetGroup.tumblingActive += 1
      } else {
        targetGroup.cuttingActive += 1
      }

      // Timing estimates for active cards (only accumulated for active/working)
      if (c.started_at) {
        const diffMins = Math.max(0, Math.floor((new Date() - new Date(c.started_at)) / 60000))
        targetGroup.totalWorkingTimeMins += diffMins
      }
    })

    // Completed Cards (history)
    ;(shiftReportHistory || []).forEach(h => {
      const compDate = h.completed_at || h.started_at || h.created_at
      // Date filter: only skip if a date exists and it is outside the range
      if (compDate) {
        const d = new Date(compDate)
        if (d < start || d > end) return
      }
      // If compDate is empty, include it (unknown completion date — we still count it)

      const user = (systemUsers || []).find(u => formatUserName(u) === h.operator_name)
      const shift = h.shift_name || user?.shift || 'Без зміни'
      const targetGroup = stats[shift] || stats['Без зміни']

      // stage_name is the correct field in work_card_history (not 'operation')
      const hop = String(h.stage_name || h.operation || '')
      const isShiftHandover = hop === 'Розкрій (перезмінка)'
      const isPausedWorkSession = String(h.card_info || '').includes('[PAUSED_WORK_LOG]')
      const isPauseInterval = hop === 'Розкрій (зупинка)'
      const isServiceSession = isShiftHandover || isPausedWorkSession || isPauseInterval
      const isCuttingCompletion = hop === 'Розкрій'
      const isTumblingCompletion = hop === 'Галтовка' || hop.startsWith('Галтовка ')
      const isTrackedCompletion = isCuttingCompletion || isTumblingCompletion

      // A handover is a finished operator work session, not a finished card.
      // Its duration belongs to the previous shift, while output is credited once
      // by the final operation-completion history row.
      if (!isServiceSession && isTrackedCompletion) {
        const operationType = isTumblingCompletion ? 'tumbling' : 'cutting'
        const operationKey = `${h.card_id || h.id}:${operationType}`
        if (!targetGroup.completedOperationKeys.has(operationKey)) {
          targetGroup.completedOperationKeys.add(operationKey)
          targetGroup.completed += 1
          targetGroup.completedCards.push(h)
          if (operationType === 'tumbling') {
            targetGroup.tumblingCompleted += 1
          } else {
            targetGroup.cuttingCompleted += 1
          }
        }
      }

      // Truthful Timing logic based on database timestamps (completed_at - started_at)
      if (!isPauseInterval && h.completed_at && h.started_at) {
        const actualDiffMins = Math.max(0, Math.floor((new Date(h.completed_at) - new Date(h.started_at)) / 60000))
        // Protect against extreme anomalies (e.g. card left active for weeks) by ignoring values over 48 hours for averages
        if (actualDiffMins < 2880) {
          targetGroup.completedWorkingTimeMins += actualDiffMins
          targetGroup.totalWorkingTimeMins += actualDiffMins
        }
      } else if (!isPauseInterval) {
        // Fallback to written columns if dates are missing
        const workTime = Number(h.working_time_mins || h.duration_mins || 0)
        targetGroup.completedWorkingTimeMins += workTime
        targetGroup.totalWorkingTimeMins += workTime
      }
      
      const setupTime = Number(h.setup_time_mins || h.tuning_time_mins || h.setup_duration || 0)
      targetGroup.totalTuningTimeMins += setupTime
    })

    Object.values(stats).forEach(group => { delete group.completedOperationKeys })
    return stats
  }, [workCards, shiftReportHistory, systemUsers, reportStartDate, reportEndDate])

  // Map of operator checks to calculate actual activity.
  // Format: { "Operator Name": { "YYYY-MM-DD": true } }
  const parsedCheckins = useMemo(() => {
    const map = {}
    
    // Process work card history to find who checked in on which days
    if (workCardHistory && workCardHistory.length > 0) {
      workCardHistory.forEach(h => {
        const opName = h.operator_name
        if (!opName || opName === 'Не вказано') return

        const completedDate = h.completed_at || h.started_at || h.created_at
        if (!completedDate) return

        try {
          const dateStr = completedDate.split('T')[0] // Get YYYY-MM-DD
          if (!map[opName]) {
            map[opName] = {}
          }
          map[opName][dateStr] = true
        } catch (e) {
          // ignore date parse issues
        }
      })
    }

    // Also scan active running cards
    if (workCards && workCards.length > 0) {
      workCards.forEach(c => {
        const opName = c.operator_name
        if (!opName || opName === 'Не вказано') return
        const startedDate = c.started_at || c.created_at
        if (!startedDate) return

        try {
          const dateStr = startedDate.split('T')[0]
          if (!map[opName]) {
            map[opName] = {}
          }
          map[opName][dateStr] = true
        } catch (e) {}
      })
    }

    return map
  }, [workCardHistory, workCards])

  const tabBtnStyle = (tabId) => ({
    background: activeTab === tabId ? '#eab308' : 'rgba(255,255,255,0.02)',
    color: activeTab === tabId ? '#000' : '#888',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '12px',
    fontSize: '0.85rem',
    fontWeight: 900,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s',
    boxShadow: activeTab === tabId ? '0 4px 12px rgba(234,179,8,0.2)' : 'none'
  })

  const formInputStyle = {
    width: '100%',
    background: '#09090b',
    border: '1px solid rgba(255,255,255,0.06)',
    color: '#fff',
    padding: '12px',
    borderRadius: '12px',
    fontSize: '0.85rem',
    fontWeight: 600,
    boxSizing: 'border-box',
    outline: 'none',
    marginTop: '6px'
  }

  // Row Renderer for Calendar Table
  const renderCalendarRow = (user) => {
    const initials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || '?'
    const isMaster = ['начальник', 'майстер', 'мастер', 'керівник'].some(kw => String(user.position || '').toLowerCase().includes(kw))
    const uName = formatUserName(user)

    return (
      <tr key={user.id} style={{ 
        borderBottom: '1px solid rgba(255,255,255,0.01)', 
        transition: 'background 0.2s',
        background: isMaster ? 'rgba(234,179,8,0.02)' : 'transparent' 
      }}>
        <td style={{ 
          padding: '10px 16px', 
          fontWeight: 800, 
          position: 'sticky', 
          left: 0, 
          background: isMaster ? '#15130b' : '#0d0d0d', 
          zIndex: 9, 
          borderRight: '1px solid #1a1a1a' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ 
              width: '28px', 
              height: '28px', 
              borderRadius: '8px', 
              background: isMaster ? 'linear-gradient(135deg, #ff9000, #ff5500)' : 'linear-gradient(135deg, #eab308, #ca8a04)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: '#000', 
              fontWeight: 900, 
              fontSize: '0.7rem' 
            }}>
              {initials}
            </div>
            <div>
              <div style={{ color: isMaster ? '#ff9000' : '#fff', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                {uName} {isMaster && <span style={{ fontSize: '0.6rem', background: '#ff9000', color: '#000', padding: '1px 4px', borderRadius: '4px', fontWeight: 900 }}>M</span>}
              </div>
              <div style={{ color: '#555', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', marginTop: '2px' }}>{user.position || 'Робітник'}</div>
            </div>
          </div>
        </td>

        {Array.from({ length: daysInMonth }).map((_, dayIdx) => {
          const day = dayIdx + 1
          const calendarKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          
          // Check manual schedule
          const status = user.shift_calendar?.[calendarKey]

          // Check if operator actually has checks/checkins for this day
          const hasCheckins = parsedCheckins[uName]?.[calendarKey]

          let bg = 'rgba(255,255,255,0.01)'
          let color = '#333'
          let borderStyle = '1px solid rgba(255,255,255,0.03)'

          if (status === 'Р') { bg = '#22c55e'; color = '#000' }
          else if (status === 'В') { bg = '#3b82f6'; color = '#fff' }
          else if (status === 'Л') { bg = '#ef4444'; color = '#fff' }
          else if (hasCheckins) {
            bg = 'rgba(34, 197, 94, 0.15)'
            color = '#22c55e'
            borderStyle = '1px dashed #22c55e'
          }

          let finalBorder = borderStyle
          if (status && hasCheckins) {
            finalBorder = '2px dashed #22c55e'
          }

          return (
            <td key={dayIdx} 
              onClick={() => handleToggleDayShift(user, day)}
              style={{ 
                padding: '8px 4px', 
                textAlign: 'center', 
                cursor: 'pointer',
                borderRight: '1px solid rgba(255,255,255,0.01)',
                transition: 'all 0.15s'
              }}
            >
              <div style={{
                background: bg,
                color: color,
                borderRadius: '6px',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.68rem',
                fontWeight: 900,
                margin: '0 auto',
                border: finalBorder,
                position: 'relative'
              }} title={hasCheckins ? `Зафіксовано роботу по картках!${status ? ` (За планом: ${status})` : ''}` : ""}>
                {status || (hasCheckins ? '✓' : day)}
                {status && hasCheckins && (
                  <span style={{
                    position: 'absolute',
                    bottom: '-4px',
                    right: '-4px',
                    background: '#22c55e',
                    color: '#000',
                    borderRadius: '50%',
                    width: '10px',
                    height: '10px',
                    fontSize: '0.55rem',
                    fontWeight: 950,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #000'
                  }}>✓</span>
                )}
              </div>
            </td>
          )
        })}
      </tr>
    )
  }

  return (
    <div style={{ background: '#050505', minHeight: '100vh', color: '#fff', padding: '30px 20px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '25px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <Link to="/" style={{ background: '#111', border: '1px solid #222', borderRadius: '12px', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', textDecoration: 'none' }}>
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 950, color: '#eab308', display: 'flex', alignItems: 'center', gap: '8px' }}>
                👑 КАБІНЕТ НАЧАЛЬНИКА ЦЕХУ №1
              </h1>
              <div style={{ fontSize: '0.75rem', color: '#555', marginTop: '2px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Контроль верстатів, розклад операторів та управління правами цеху
              </div>
            </div>
          </div>

          {/* Tab Selection */}
          <div style={{ display: 'flex', gap: '6px', background: '#0d0d0d', padding: '6px', borderRadius: '16px', border: '1px solid #1a1a1a', flexWrap: 'wrap' }}>
            <button onClick={() => setActiveTab('dashboard')} style={tabBtnStyle('dashboard')}>
              <LayoutDashboard size={16} /> Моніторинг
            </button>
            <button onClick={() => setActiveTab('calendar')} style={tabBtnStyle('calendar')}>
              <Calendar size={16} /> Календар змін
            </button>
            <button onClick={() => setActiveTab('shifts_report')} style={tabBtnStyle('shifts_report')}>
              <RefreshCw size={16} /> Звіт по змінах
            </button>
            <button onClick={() => setActiveTab('nariad_reports')} style={tabBtnStyle('nariad_reports')}>
              <Briefcase size={16} /> Звіти по нарядах
            </button>
            <button onClick={() => setActiveTab('staff')} style={tabBtnStyle('staff')}>
              <Users size={16} /> Персонал
            </button>
          </div>
        </div>

        <hr style={{ border: 'none', height: '1px', background: 'rgba(255,255,255,0.03)', margin: '0' }} />

        {/* 1. MONITORING TAB */}
        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#888', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              🔌 СТАТУС ВЕРСТАТІВ ТА ОБЛАДНАННЯ
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
              {machineMonitorList.map(({ machine, activeCard, nomenclature }) => {
                const isPaused = activeCard?.status === 'paused'
                const isWorking = activeCard?.status === 'in-progress'
                const pauseReason = isPaused 
                  ? activeCard.card_info?.match(/\[PAUSED:([^\]]+)\]/)?.[1] || 'Причина не вказана'
                  : null
                const start = activeCard?.started_at ? new Date(activeCard.started_at) : null
                const runningMins = start ? Math.max(0, Math.floor((Date.now() - start.getTime()) / 60000)) : 0

                return (
                  <div key={machine.id} style={{
                    background: '#0d0d0d',
                    border: '1px solid',
                    borderColor: isWorking ? 'rgba(34,197,94,0.15)' : isPaused ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.03)',
                    borderRadius: '24px',
                    padding: '22px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '15px',
                    boxShadow: isWorking ? '0 4px 20px rgba(34,197,94,0.03)' : isPaused ? '0 4px 20px rgba(239,68,68,0.03)' : 'none'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 900, color: '#fff' }}>{machine.name}</h3>
                        <span style={{ fontSize: '0.65rem', color: '#555', fontWeight: 800 }}>№ {machine.sequence_number || '—'} | Інв. {machine.inventory_no || '—'}</span>
                      </div>
                      <span style={{
                        fontSize: '0.65rem',
                        fontWeight: 900,
                        padding: '4px 10px',
                        borderRadius: '8px',
                        textTransform: 'uppercase',
                        background: isWorking ? 'rgba(34,197,94,0.08)' : isPaused ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)',
                        color: isWorking ? '#22c55e' : isPaused ? '#ef4444' : '#666',
                        border: '1px solid',
                        borderColor: isWorking ? 'rgba(34,197,94,0.2)' : isPaused ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)'
                      }}>
                        {isWorking ? '● В роботі' : isPaused ? '🛑 На паузі' : '⚪ Вільний'}
                      </span>
                    </div>

                    {(isWorking || isPaused) && activeCard ? (
                      <div style={{ background: '#050507', padding: '12px 14px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div>
                          <div style={{ fontSize: '0.55rem', color: '#444', fontWeight: 900, textTransform: 'uppercase' }}>Поточне завдання</div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#ddd', marginTop: '2px' }}>{nomenclature?.name || 'Деталь'}</div>
                          <div style={{ fontSize: '0.65rem', color: '#555', marginTop: '2px' }}>Картка #{activeCard.id?.slice(-8).toUpperCase()}</div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '8px' }}>
                          <div>
                            <span style={{ fontSize: '0.55rem', color: '#444', display: 'block', fontWeight: 800 }}>ОПЕРАТОР</span>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#888' }}>{activeCard.operator_name || 'Невідомо'}</span>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.55rem', color: '#444', display: 'block', fontWeight: 800 }}>КІЛЬКІСТЬ</span>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#888' }}>{activeCard.quantity} шт</span>
                          </div>
                        </div>

                        {isPaused && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(239,68,68,0.04)', border: '1px dashed rgba(239,68,68,0.2)', padding: '8px 10px', borderRadius: '8px', marginTop: '4px' }}>
                            <AlertTriangle size={14} color="#ef4444" style={{ flexShrink: 0 }} />
                            <div style={{ fontSize: '0.68rem', color: '#f87171', fontWeight: 700 }}>
                              Простій: {pauseReason}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ color: '#444', fontSize: '0.78rem', fontStyle: 'italic', padding: '10px 0' }}>Верстат зараз не активний</div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '12px', fontSize: '0.7rem', color: '#555' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} /> {activeCard ? `В роботі: ${runningMins} хв` : 'Очікує запуску'}
                      </span>
                      <span>{activeCard?.shift_name || 'Без зміни'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 1.1 SHIFTS REPORT TAB */}
        {activeTab === 'shifts_report' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.2s ease' }}>
            {/* Filter Panel matching ReportsModule Style */}
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', background: '#0d0d0d', borderRadius: '16px', border: '1px solid #1a1a1a', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 15px', borderRight: '1px solid #1a1a1a' }}>
                  <Calendar size={14} color="#888" style={{ marginRight: '8px' }} />
                  <span style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', fontWeight: 800 }}>Період:</span>
                </div>
                <input 
                  type="date" 
                  value={reportStartDate} 
                  onClick={(e) => e.target.showPicker && e.target.showPicker()}
                  onChange={(e) => { setReportStartDate(e.target.value); setQuickPeriod(''); }}
                  style={{ background: 'transparent', border: 'none', color: reportStartDate ? '#fff' : '#555', padding: '12px 15px', fontSize: '0.85rem', outline: 'none', cursor: 'pointer', fontFamily: 'inherit', colorScheme: 'dark' }}
                />
                <span style={{ color: '#333' }}>—</span>
                <input 
                  type="date" 
                  value={reportEndDate} 
                  onClick={(e) => e.target.showPicker && e.target.showPicker()}
                  onChange={(e) => { setReportEndDate(e.target.value); setQuickPeriod(''); }}
                  style={{ background: 'transparent', border: 'none', color: reportEndDate ? '#fff' : '#555', padding: '12px 15px', fontSize: '0.85rem', outline: 'none', cursor: 'pointer', fontFamily: 'inherit', colorScheme: 'dark' }}
                />
                {(reportStartDate || reportEndDate) && (
                  <button 
                    onClick={() => { setReportStartDate(''); setReportEndDate(''); setQuickPeriod(''); }}
                    style={{ background: 'transparent', border: 'none', padding: '12px 15px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#ef4444', borderLeft: '1px solid #1a1a1a' }}
                    title="Очистити період"
                  >
                    ✕
                  </button>
                )}
                <select 
                  onChange={(e) => handleQuickDateSelect(e.target.value)} 
                  value={quickPeriod}
                  style={{ background: '#0d0d0d', border: 'none', borderLeft: '1px solid #1a1a1a', color: '#eab308', padding: '12px 15px', fontSize: '0.8rem', outline: 'none', cursor: 'pointer', fontWeight: 800, textTransform: 'uppercase' }}
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
                  <div key={shiftName} style={{
                    background: '#0d0d0d',
                    border: '1px solid rgba(255,255,255,0.03)',
                    borderRadius: '24px',
                    padding: '25px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '15px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#fff' }}>{shiftName}</span>
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

                    {/* Breakdown by operations: Cutting vs Tumbling */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '15px', fontSize: '0.7rem' }}>
                      <div>
                        <div style={{ fontSize: '0.58rem', color: '#888', fontWeight: 900, marginBottom: '6px', letterSpacing: '0.05em' }}>✂️ РОЗКРІЙ</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ color: '#aaa' }}>Зараз у роботі: <strong style={{ color: '#22c55e' }}>{counts.cuttingActive}</strong></span>
                          <span style={{ color: '#aaa' }}>Здано: <strong style={{ color: '#3b82f6' }}>{counts.cuttingCompleted}</strong></span>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.58rem', color: '#888', fontWeight: 900, marginBottom: '6px', letterSpacing: '0.05em' }}>🌀 ГАЛТОВКА</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ color: '#aaa' }}>Зараз у роботі: <strong style={{ color: '#22c55e' }}>{counts.tumblingActive}</strong></span>
                          <span style={{ color: '#aaa' }}>Здано: <strong style={{ color: '#3b82f6' }}>{counts.tumblingCompleted}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Timings and Buffers/Queue */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.68rem', color: '#666' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>⏱️ Час налаштування:</span>
                        <strong style={{ color: '#bbb' }}>{counts.totalTuningTimeMins} хв</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>⚙️ Фактичний час роботи:</span>
                        <strong style={{ color: '#bbb' }}>{counts.totalWorkingTimeMins} хв</strong>
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

            {/* Interactive Card Details Modal */}
            {selectedReportDetails && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.85)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: '20px'
              }} onClick={() => setSelectedReportDetails(null)}>
                <div style={{
                  background: '#0a0a0b',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '24px',
                  width: '100%',
                  maxWidth: '750px',
                  maxHeight: '80vh',
                  display: 'flex',
                  flexDirection: 'column',
                  onClick: e => e.stopPropagation(),
                  animation: 'fadeIn 0.15s ease-out'
                }} onClick={e => e.stopPropagation()}>
                  
                  {/* Modal Header */}
                  <div style={{ padding: '20px 25px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 950, color: '#fff' }}>
                        {selectedReportDetails.shift} — {selectedReportDetails.type === 'active' ? 'Картки в роботі' : selectedReportDetails.type === 'paused' ? 'Картки на паузі' : 'Завершені операції'}
                      </h3>
                      <div style={{ fontSize: '0.7rem', color: '#555', marginTop: '2px', fontWeight: 700 }}>
                        Період: {reportStartDate} — {reportEndDate}
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedReportDetails(null)} 
                      style={{ background: 'rgba(255,255,255,0.03)', border: 'none', color: '#888', cursor: 'pointer', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Modal List */}
                  <div style={{ padding: '20px 25px', overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {selectedReportDetails.cards.map((card, idx) => {
                      const nom = nomenclatures?.find(n => n.id === card.nomenclature_id)
                      const dateText = new Date(card.completed_at || card.started_at || card.created_at).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                      // Determine operation type: active cards use 'operation', history cards use 'stage_name'
                      const opField = String(card.operation || card.stage_name || '')
                      const isGalt = opField.startsWith('Галтовка') || opField === 'Галтовка'
                      const opLabel = isGalt
                        ? { label: '🌀 ГАЛТОВКА', bg: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.25)' }
                        : { label: '✂️ РОЗКРІЙ', bg: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }
                      // Show sub-stage if it has parentheses e.g. "Галтовка (Мийка)"
                      const subStage = opField.match(/\(([^)]+)\)/)?.[1]

                      return (
                        <div key={card.id || idx} style={{
                          background: 'rgba(255,255,255,0.015)',
                          border: '1px solid rgba(255,255,255,0.04)',
                          borderRadius: '16px',
                          padding: '14px 16px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '15px'
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', flexWrap: 'wrap' }}>
                              {/* Operation type badge */}
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
                              <span style={{ fontWeight: 800, color: '#fff', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {nom?.name || '—'}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.63rem', color: '#555', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                              <span>#{card.id?.slice(-8).toUpperCase()}</span>
                              <span>•</span>
                              <span>Оператор: <strong style={{ color: '#777' }}>{card.operator_name || 'Не вказано'}</strong></span>
                              {(card.machine || card.machine_name) && (card.machine || card.machine_name) !== 'Не вказано' && (
                                <>
                                  <span>•</span>
                                  <span style={{ color: '#555' }}>{card.machine || card.machine_name}</span>
                                </>
                              )}
                            </div>
                          </div>
                          
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontWeight: 950, fontSize: '0.9rem', color: '#eab308' }}>{card.quantity || card.qty_completed || 0} шт</div>
                            <div style={{ fontSize: '0.62rem', color: '#444', marginTop: '2px', fontWeight: 700 }}>{dateText}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 1.5 NARIAD REPORTS TAB */}
        {activeTab === 'nariad_reports' && (() => {
          // ── Load report for a selected task ────────────────────────────────
          const handleOpenNariadReport = async (task, force = false) => {
            if (nariadReportLoading) return
            setSelectedNariadTaskId(task.id)
            setNariadReportData(null)
            setNariadStageFilter('All')
            setNariadNomFilter('All')
            setNariadSortBy('date')
            setNariadReportLoading(true)
            try {
              const cached = nariadReportCache.current.get(task.id)
              if (!force && cached && Date.now() - cached.savedAt < 5 * 60 * 1000) {
                setNariadReportData(cached.data)
                return
              }

              const { data: rpcData, error: rpcError } = await supabase.rpc('shop1_naryad_report', {
                p_task_id: task.id
              })
              if (!rpcError && rpcData) {
                let orderItems = rpcData.orderItems || rpcData.order_items || []
                // Compatibility with an older deployed RPC: fetch only the finished
                // product rows for this order instead of falling back to BOM details.
                if (orderItems.length === 0 && task.order_id) {
                  const { data: dbOrderItems } = await supabase
                    .from('order_items')
                    .select('nomenclature_id, quantity, nomenclature:nomenclatures(id, name)')
                    .eq('order_id', task.order_id)
                  orderItems = (dbOrderItems || []).map(item => ({
                    nomenclature_id: item.nomenclature_id,
                    quantity: item.quantity,
                    name: item.nomenclature?.name || null
                  }))
                }
                const normalized = {
                  historyRows: rpcData.historyRows || rpcData.history_rows || [],
                  taskCards: rpcData.taskCards || rpcData.task_cards || [],
                  materialRequests: rpcData.materialRequests || rpcData.material_requests || [],
                  planSnapshot: rpcData.planSnapshot || rpcData.plan_snapshot || null,
                  orderItems,
                  taskCount: Number(rpcData.taskCount || rpcData.task_count) || 1
                }
                nariadReportCache.current.set(task.id, { data: normalized, savedAt: Date.now() })
                setNariadReportData(normalized)
                return
              }

              const { data: matReqs } = await supabase
                .from('material_requests')
                .select('*, nomenclature:nomenclatures(*)')
                .eq('task_id', task.id)

              const { data: dbOrderItems } = task.order_id
                ? await supabase
                    .from('order_items')
                    .select('nomenclature_id, quantity, nomenclature:nomenclatures(id, name)')
                    .eq('order_id', task.order_id)
                : { data: [] }

              const { data: dbCards } = await supabase
                .from('work_cards')
                .select('id, created_at, card_info')
                .eq('task_id', task.id)
                .order('created_at', { ascending: true })
                .limit(10000)

              const allCardIds = [...new Set((dbCards || []).map(c => c.id))]
              let historyRows = []
              for (let i = 0; i < allCardIds.length; i += 100) {
                const chunk = allCardIds.slice(i, i + 100)
                const { data: histChunk } = await supabase
                  .from('work_card_history').select('*').in('card_id', chunk).limit(10000)
                if (histChunk) historyRows = historyRows.concat(histChunk)
              }
              historyRows.sort((a, b) => new Date(a.completed_at || 0) - new Date(b.completed_at || 0))
              const fallbackData = {
                historyRows,
                taskCards: (dbCards || []).map((card, index) => ({ ...card, card_number: index + 1 })),
                materialRequests: matReqs || [],
                orderItems: (dbOrderItems || []).map(item => ({ nomenclature_id: item.nomenclature_id, quantity: item.quantity, name: item.nomenclature?.name || null }))
              }
              nariadReportCache.current.set(task.id, { data: fallbackData, savedAt: Date.now() })
              setNariadReportData(fallbackData)
            } catch (e) {
              console.error(e)
              alert('Помилка завантаження звіту: ' + e.message)
            } finally {
              setNariadReportLoading(false)
            }
          }

          // ── Sorted + filtered task list ─────────────────────────────────────
          const allOrdersMap = {}
          ;(orders || []).forEach(o => { allOrdersMap[o.id] = o })

          const localFilteredTasks = (tasks || [])
            .filter(t => {
              const order = allOrdersMap[t.order_id]
              // Never turn an orphan task UUID suffix into a visible naryad number.
              if (!order?.order_num) return false
              const orderNum = order?.order_num || ''
              const customer = order?.customer || ''
              const q = nariadSearch.toLowerCase().trim()
              if (!q) return true
              return (
                orderNum.toLowerCase().includes(q) ||
                customer.toLowerCase().includes(q) ||
                String(t.id).toLowerCase().includes(q)
              )
            })
            .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))

          const filteredTasks = nariadCatalog.length > 0
            ? nariadCatalog.filter(row => row.order_num).map(row => ({
                ...row,
                id: row.task_id,
                plan_snapshot: row.plan_snapshot || null,
                _catalogOrder: { id: row.order_id, order_num: row.order_num, customer: row.customer, order_items: [] }
              }))
            : localFilteredTasks

          const selectedTask = filteredTasks.find(t => t.id === selectedNariadTaskId) || (tasks || []).find(t => t.id === selectedNariadTaskId)
          const selectedOrder = selectedTask ? (selectedTask._catalogOrder || allOrdersMap[selectedTask.order_id]) : null

          // ── Helpers for inline report ───────────────────────────────────────
          const formatDurHMS = (totalSec) => {
            if (totalSec === null || totalSec === undefined || totalSec < 0) return '—'
            const h = Math.floor(totalSec / 3600)
            const m = Math.floor((totalSec % 3600) / 60)
            const s = Math.floor(totalSec % 60)
            const p = n => String(n).padStart(2, '0')
            return `${p(h)}год. ${p(m)}хв. ${p(s)}с`
          }

          const statusMeta = (status) => {
            if (status === 'completed') return { label: 'Завершено', color: '#10b981', bg: 'rgba(16,185,129,0.1)' }
            if (status === 'in-progress') return { label: 'В роботі', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' }
            if (status === 'paused') return { label: 'Призупинено', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' }
            return { label: status || 'Новий', color: '#888', bg: 'rgba(255,255,255,0.05)' }
          }

          return (
            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', minHeight: '70vh' }}>

              {/* LEFT PANEL — Task List */}
              <div style={{ width: '340px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Search */}
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#555' }} />
                  <input
                    type="text"
                    placeholder="Пошук по номеру наряду або замовнику..."
                    value={nariadSearch}
                    onChange={e => setNariadSearch(e.target.value)}
                    style={{
                      width: '100%', background: '#0d0d0d', border: '1px solid #1a1a1a',
                      color: '#fff', borderRadius: '12px', padding: '10px 12px 10px 34px',
                      fontSize: '0.78rem', fontWeight: 700, boxSizing: 'border-box', outline: 'none'
                    }}
                  />
                </div>

                {/* Task count */}
                <div style={{ fontSize: '0.65rem', color: '#555', fontWeight: 800, paddingLeft: '4px' }}>
                  {nariadCatalogLoading ? 'Завантаження…' : `${nariadCatalogTotal || filteredTasks.length} нарядів`}
                </div>

                {/* Task list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '78vh', paddingRight: '4px' }}>
                  {filteredTasks.map(task => {
                    const order = task._catalogOrder || allOrdersMap[task.order_id]
                    const sm = statusMeta(task.status)
                    const isSelected = task.id === selectedNariadTaskId
                    const partCount = task.plan_snapshot
                      ? Object.keys(task.plan_snapshot).filter(k => !k.startsWith('_') && !['materialSummary','arrivals','arrival_doc_id','arrival_doc','nomenclatures','selectedCutters','consumables'].includes(k)).length
                      : Number(task.card_count) || 0
                    const createdDate = task.created_at ? new Date(task.created_at).toLocaleDateString('uk-UA', { day:'2-digit', month:'2-digit', year:'2-digit' }) : '—'

                    return (
                      <div
                        key={task.id}
                        onClick={() => handleOpenNariadReport(task)}
                        style={{
                          background: isSelected ? 'rgba(234,179,8,0.06)' : '#0d0d0d',
                          border: `1px solid ${isSelected ? 'rgba(234,179,8,0.25)' : 'rgba(255,255,255,0.04)'}`,
                          borderRadius: '14px',
                          padding: '13px 15px',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div style={{ fontWeight: 900, fontSize: '0.85rem', color: isSelected ? '#eab308' : '#fff' }}>
                            Наряд №{order?.order_num}
                            {task.batch_index ? `/${task.batch_index}` : ''}
                          </div>
                          <span style={{ background: sm.bg, color: sm.color, fontSize: '0.58rem', fontWeight: 900, padding: '2px 7px', borderRadius: '5px', flexShrink: 0 }}>
                            {sm.label}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#666', fontWeight: 700 }}>
                          {order?.customer || 'Замовник не вказано'}
                        </div>
                        <div style={{ display: 'flex', gap: '10px', fontSize: '0.62rem', color: '#444', fontWeight: 700, marginTop: '2px' }}>
                          <span>📅 {createdDate}</span>
                          {partCount > 0 && <span>📦 {partCount} деталей</span>}
                          {Number(task.task_count) > 1 && <span style={{ color: '#8b5cf6' }}>⛓ Цех 1 + Цех 2</span>}
                        </div>
                      </div>
                    )
                  })}
                  {filteredTasks.length === 0 && (
                    <div style={{ color: '#555', fontSize: '0.78rem', textAlign: 'center', padding: '30px 0', fontWeight: 700 }}>
                      Нарядів не знайдено
                    </div>
                  )}
                  {nariadCatalogTotal > 50 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', paddingTop: '4px' }}>
                      <button disabled={nariadCatalogPage === 0 || nariadCatalogLoading} onClick={() => setNariadCatalogPage(p => Math.max(0, p - 1))} style={{ background: '#111', border: '1px solid #222', color: '#aaa', borderRadius: '8px', padding: '7px 10px', cursor: 'pointer', fontWeight: 800 }}>←</button>
                      <span style={{ color: '#555', fontSize: '0.65rem', fontWeight: 800 }}>{nariadCatalogPage + 1} / {Math.ceil(nariadCatalogTotal / 50)}</span>
                      <button disabled={(nariadCatalogPage + 1) * 50 >= nariadCatalogTotal || nariadCatalogLoading} onClick={() => setNariadCatalogPage(p => p + 1)} style={{ background: '#111', border: '1px solid #222', color: '#aaa', borderRadius: '8px', padding: '7px 10px', cursor: 'pointer', fontWeight: 800 }}>→</button>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT PANEL — Inline Report */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {!selectedNariadTaskId && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '15px', color: '#333' }}>
                    <div style={{ fontSize: '3rem' }}>📋</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#444' }}>Оберіть наряд зі списку</div>
                    <div style={{ fontSize: '0.75rem', color: '#333', fontWeight: 700 }}>Звіт з'явиться тут</div>
                  </div>
                )}

                {nariadReportLoading && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '15px' }}>
                    <div style={{ width: '40px', height: '40px', border: '3px solid #1a1a1a', borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <div style={{ color: '#555', fontSize: '0.85rem', fontWeight: 800 }}>Завантаження звіту...</div>
                  </div>
                )}

                {selectedTask && nariadReportData && !nariadReportLoading && (() => {
                  const rd = nariadReportData
                  const snapshot = rd.planSnapshot || selectedTask.plan_snapshot

                  // ── Stats calculation ───────────────────────────────────────
                  const cutterRequests = (rd.materialRequests || []).filter(r => {
                    const name = r.nomenclature?.name?.toLowerCase() || ''
                    return name.includes('фреза') || (r.details || '').toLowerCase().includes('фреза')
                  })
                  const getReqQty = r => r.quantity !== null && r.quantity !== undefined ? Number(r.quantity) : Number((r.details || '').match(/—\s*(\d+)/)?.[1] || 0)
                  const totalPlannedCutters = cutterRequests.reduce((s, r) => s + getReqQty(r), 0)
                  const plannedCuttersBreakdown = cutterRequests.reduce((result, request) => {
                    const name = request.nomenclature?.name || 'Фреза'
                    result[name] = (result[name] || 0) + getReqQty(request)
                    return result
                  }, {})
                  const actualCuttersBreakdown = {}
                  rd.historyRows.forEach(row => {
                    const info = row.card_info || ''
                    const idx = info.indexOf('[CUTTERS_BREAKDOWN:')
                    if (idx !== -1) {
                      const start = info.indexOf('{', idx)
                      if (start !== -1) {
                        let depth = 0, end = -1
                        for (let i = start; i < info.length; i++) {
                          if (info[i] === '{') depth++
                          else if (info[i] === '}') { depth--; if (depth === 0) { end = i; break } }
                        }
                        if (end !== -1) { try { Object.assign(actualCuttersBreakdown, JSON.parse(info.slice(start, end + 1))) } catch(e){} }
                      }
                    } else if (Number(row.cutters_used) > 0) {
                      actualCuttersBreakdown['Фреза'] = (actualCuttersBreakdown['Фреза'] || 0) + Number(row.cutters_used)
                    }
                  })
                  const totalActualCutters = Object.values(actualCuttersBreakdown).reduce((s, v) => s + v, 0)

                  let totalScrap = rd.historyRows.reduce((s, r) => s + (Number(r.scrap_qty) || 0), 0)

                  const shop1StageNames = ['Розкрій', 'Галтовка', 'Прийомка', 'Сортування']
                  const shop2DefaultStages = ['Пресування', 'Фарбування', 'Доопрацювання', 'Контроль ВКЯ']
                  const isShop1History = row => {
                    const stage = String(row.stage_name || '')
                    return shop1StageNames.some(name => stage === name || stage.startsWith(name)) || stage.startsWith('Буфер ')
                  }
                  const isTechnicalHistory = row => ['completed', 'Склад БЗ', 'Склад СГП', 'Склад (БРОНЬ)'].includes(String(row.stage_name || ''))
                  const isShop2History = row => String(row.card_info || '').includes('[ЦЕХ №2]') || (!isShop1History(row) && !isTechnicalHistory(row))

                  const buildTimeAnalytics = (rows, defaults = []) => {
                    const stageTotals = Object.fromEntries(defaults.map(name => [name, { total: 0, count: 0 }]))
                    const bufferTotals = {}
                    let first = null
                    let last = null
                    rows.forEach(row => {
                      const started = row.started_at ? new Date(row.started_at) : null
                      const completed = row.completed_at ? new Date(row.completed_at) : null
                      if (started && (!first || started < first)) first = started
                      if (completed && (!last || completed > last)) last = completed
                      if (!started || !completed) return
                      const stage = String(row.stage_name || 'Без назви')
                      // The pause interval remains part of total elapsed time, but is
                      // not productive operator time.
                      if (stage === 'Розкрій (зупинка)') return
                      const seconds = Math.max(0, Math.round((completed - started) / 1000))
                      const target = stage.startsWith('Буфер ') ? bufferTotals : stageTotals
                      if (!target[stage]) target[stage] = { total: 0, count: 0 }
                      target[stage].total += seconds
                      target[stage].count += 1
                    })
                    return {
                      stageTotals,
                      bufferTotals,
                      total: first && last ? Math.max(0, Math.round((last - first) / 1000)) : 0,
                      active: Object.values(stageTotals).reduce((sum, item) => sum + item.total, 0),
                      buffer: Object.values(bufferTotals).reduce((sum, item) => sum + item.total, 0),
                      cards: new Set(rows.map(row => row.card_id).filter(Boolean)).size || 1
                    }
                  }

                  const shop1Time = buildTimeAnalytics(rd.historyRows.filter(isShop1History), shop1StageNames)
                  const shop2Time = buildTimeAnalytics(rd.historyRows.filter(isShop2History), shop2DefaultStages)
                  const actualShop2Stages = [...new Set(rd.historyRows.filter(isShop2History).map(row => row.stage_name).filter(Boolean))]
                  const availableStageFilters = [...new Set(['All', 'Цех №1', 'Цех №2', ...shop1StageNames, ...actualShop2Stages])]
                  const renderTimeAnalytics = (title, stats, color, subtitle) => (
                    <div style={{ background: '#0d0d0d', border: '1px solid #222', borderRadius: '20px', padding: '20px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color, fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '15px' }}>
                        <Clock size={14} /> {title}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(205px, 1fr))', gap: '16px' }}>
                        <div style={{ background: '#090909', border: '1px solid #1a1a1a', borderRadius: '14px', padding: '15px', textAlign: 'center' }}>
                          <div style={{ color: '#777', fontSize: '0.62rem', fontWeight: 900, textTransform: 'uppercase' }}>Загальний час проходження</div>
                          <div style={{ color, fontSize: '1.45rem', fontWeight: 1000, margin: '8px 0 5px' }}>{stats.total ? formatDurHMS(stats.total) : '—'}</div>
                          <div style={{ color: '#444', fontSize: '0.58rem', borderBottom: '1px solid #1a1a1a', paddingBottom: '8px' }}>{subtitle}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', color: '#777', fontSize: '0.65rem', marginTop: '8px', textAlign: 'left' }}><span>Сер. робота / картку:</span><strong style={{ color: '#3b82f6' }}>{formatDurHMS(Math.round(stats.active / stats.cards))}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', color: '#777', fontSize: '0.65rem', marginTop: '5px', textAlign: 'left' }}><span>Сер. буфер / картку:</span><strong style={{ color: '#f59e0b' }}>{formatDurHMS(Math.round(stats.buffer / stats.cards))}</strong></div>
                        </div>
                        <div style={{ background: '#090909', border: '1px solid #1a1a1a', borderRadius: '14px', padding: '15px' }}>
                          <div style={{ color: '#777', fontSize: '0.62rem', fontWeight: 900, textTransform: 'uppercase', borderBottom: '1px solid #181818', paddingBottom: '7px', marginBottom: '8px' }}>Робочі етапи · активна робота</div>
                          {Object.entries(stats.stageTotals).map(([name, item]) => <div key={name} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', color: '#888', fontSize: '0.68rem', padding: '4px 0' }}><span>{name}:</span><strong style={{ color: '#3b82f6' }}>{formatDurHMS(item.total)}</strong></div>)}
                        </div>
                        <div style={{ background: '#090909', border: '1px solid #1a1a1a', borderRadius: '14px', padding: '15px' }}>
                          <div style={{ color: '#777', fontSize: '0.62rem', fontWeight: 900, textTransform: 'uppercase', borderBottom: '1px solid #181818', paddingBottom: '7px', marginBottom: '8px' }}>Буфери накопичення</div>
                          {Object.keys(stats.bufferTotals).length > 0 ? Object.entries(stats.bufferTotals).map(([name, item]) => <div key={name} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', color: '#888', fontSize: '0.68rem', padding: '4px 0' }}><span>{name}:</span><strong style={{ color: '#f59e0b' }}>{formatDurHMS(item.total)}</strong></div>) : <div style={{ color: '#444', fontSize: '0.65rem', paddingTop: '4px' }}>Час у буферах не зафіксовано</div>}
                        </div>
                      </div>
                    </div>
                  )

                  // Accepted parts
                  const acceptedQty = rd.historyRows.filter(r => r.stage_name === 'Прийомка' || r.stage_name === 'completed').reduce((s, r) => s + (Number(r.qty_completed) || 0), 0)
                  const totalPlannedParts = snapshot && typeof snapshot === 'object'
                    ? Object.entries(snapshot).filter(([key, value]) => !key.startsWith('_') && value && typeof value === 'object' && (value.id || value.name)).reduce((sum, [, value]) => sum + (Number(value.plan ?? value.need ?? value.quantity) || 0), 0)
                    : 0

                  // Same plan/fact sheet calculation as the foreman report.
                  const matStats = {}
                  const snapshotParts = snapshot && typeof snapshot === 'object'
                    ? Object.entries(snapshot).filter(([key, value]) => !key.startsWith('_') && value && typeof value === 'object' && (value.id || value.name))
                    : []
                  snapshotParts.forEach(([nomId, entry]) => {
                    const actualNomId = entry.id || nomId
                    const nom = nomenclatures?.find(item => String(item.id) === String(actualNomId))
                    if (nom && nom.type !== 'part') return
                    const unitsPerSheet = Number(entry.units_per_sheet) || Number(nom?.units_per_sheet) || 1
                    const planned = Number(entry.sheets) || Math.ceil((Number(entry.plan) || 0) / unitsPerSheet)
                    const cutQty = rd.historyRows
                      .filter(row => String(row.nomenclature_id) === String(actualNomId) && row.stage_name === 'Розкрій' && !String(row.card_info || '').includes('[PAUSED_WORK_LOG]'))
                      .reduce((sum, row) => sum + (Number(row.qty_completed) || 0), 0)
                    const actual = Math.ceil(cutQty / unitsPerSheet)
                    const material = entry.material || nom?.material_type || 'Матеріал'
                    if (!matStats[material]) matStats[material] = { planned: 0, actual: 0 }
                    matStats[material].planned += planned
                    matStats[material].actual += actual
                  })
                  const totalPlannedSheets = Object.values(matStats).reduce((sum, item) => sum + item.planned, 0)
                  const totalActualSheets = Object.values(matStats).reduce((sum, item) => sum + item.actual, 0)

                  // Filtered + sorted log rows
                  let logRows = rd.historyRows.filter(row => {
                    if (nariadStageFilter === 'All') return true
                    if (nariadStageFilter === 'Цех №1') return isShop1History(row)
                    if (nariadStageFilter === 'Цех №2') return isShop2History(row)
                    if (nariadStageFilter === 'Галтовка') return row.stage_name?.startsWith('Галтовка')
                    if (nariadStageFilter === 'Прийомка') return row.stage_name === 'Прийомка' || row.stage_name === 'completed'
                    return row.stage_name === nariadStageFilter
                  }).filter(row => nariadNomFilter === 'All' || String(row.nomenclature_id) === nariadNomFilter)

                  logRows.sort((a, b) => {
                    if (nariadSortBy === 'shop') return Number(isShop2History(a)) - Number(isShop2History(b)) || new Date(a.started_at || a.created_at || 0) - new Date(b.started_at || b.created_at || 0)
                    if (nariadSortBy === 'min-time') {
                      const da = a.started_at && a.completed_at ? new Date(a.completed_at) - new Date(a.started_at) : 0
                      const db2 = b.started_at && b.completed_at ? new Date(b.completed_at) - new Date(b.started_at) : 0
                      return da - db2
                    }
                    if (nariadSortBy === 'max-time') {
                      const da = a.started_at && a.completed_at ? new Date(a.completed_at) - new Date(a.started_at) : 0
                      const db2 = b.started_at && b.completed_at ? new Date(b.completed_at) - new Date(b.started_at) : 0
                      return db2 - da
                    }
                    if (nariadSortBy === 'scrap') return (Number(b.scrap_qty) || 0) - (Number(a.scrap_qty) || 0)
                    return new Date(a.started_at || a.created_at || 0) - new Date(b.started_at || b.created_at || 0)
                  })

                  let productNames = (rd.orderItems || []).map(item => item.name || nomenclatures?.find(n => String(n.id) === String(item.nomenclature_id))?.name).filter(Boolean).join(', ')
                  if (!productNames) productNames = selectedOrder?.order_items?.map(it => nomenclatures?.find(n => n.id === it.nomenclature_id)?.name).filter(Boolean).join(', ')
                  productNames ||= '—'
                  const sm2 = statusMeta(selectedTask.status)

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                      {/* Report header */}
                      <div style={{ borderBottom: '1px solid #1a1a1a', padding: '4px 0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '15px', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#3b82f6', fontSize: '0.68rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '4px' }}>
                            <Clock size={13} /> Звіт по виробництву · Цех №1 + Цех №2
                          </div>
                          <h3 style={{ margin: 0, fontSize: '1.7rem', fontWeight: 950 }}>
                            Наряд №{selectedOrder?.order_num}{selectedTask.batch_index ? `/${selectedTask.batch_index}` : ''}
                          </h3>
                          <div style={{ color: '#aaa', fontSize: '0.85rem', marginTop: '4px', fontWeight: 700 }}>
                            Виріб: <strong style={{ color: '#ef4444' }}>{productNames}</strong>
                            {selectedOrder?.customer && ` | Замовник: ${selectedOrder.customer}`}
                          </div>
                          {(rd.taskCount > 1 || Number(selectedTask.task_count) > 1) && (
                            <div style={{ color: '#8b5cf6', fontSize: '0.68rem', marginTop: '8px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Єдина історія руху · Цех №1 → Цех №2
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ background: sm2.bg, color: sm2.color, fontSize: '0.7rem', fontWeight: 900, padding: '5px 12px', borderRadius: '8px', border: `1px solid ${sm2.color}30` }}>
                            {sm2.label}
                          </span>
                          <button
                            onClick={() => handleOpenNariadReport(selectedTask, true)}
                            style={{ background: '#0d1424', border: '1px solid #3b82f640', color: '#3b82f6', padding: '8px 14px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            <RotateCcw size={12} /> Оновити дані
                          </button>
                        </div>
                      </div>

                      {/* Stats cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px' }}>
                        {/* Cutters */}
                        <div style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '16px', padding: '16px' }}>
                          <div style={{ color: '#555', fontSize: '0.62rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>✂️ Фрези (Розкрій)</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', borderBottom: '1px solid #1a1a1a', paddingBottom: '6px', marginBottom: '6px' }}>
                            <span style={{ color: '#888' }}>План: <strong style={{ color: '#fff' }}>{totalPlannedCutters} шт</strong></span>
                            <span style={{ color: '#888' }}>Факт: <strong style={{ color: totalActualCutters > totalPlannedCutters ? '#ef4444' : '#eab308' }}>{totalActualCutters} шт</strong></span>
                          </div>
                          {[...new Set([...Object.keys(plannedCuttersBreakdown), ...Object.keys(actualCuttersBreakdown)])].map(name => (
                            <div key={name} style={{ fontSize: '0.65rem', color: '#555', marginBottom: '5px', borderBottom: '1px solid #171717', paddingBottom: '4px' }}>
                              <div style={{ color: '#777', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}><span>План: <strong>{plannedCuttersBreakdown[name] || 0} шт</strong></span><span>Факт: <strong style={{ color: '#eab308' }}>{actualCuttersBreakdown[name] || 0} шт</strong></span></div>
                            </div>
                          ))}
                          {Object.keys(plannedCuttersBreakdown).length === 0 && Object.keys(actualCuttersBreakdown).length === 0 && <div style={{ fontSize: '0.62rem', color: '#333', fontStyle: 'italic' }}>Без витрат</div>}
                        </div>

                        {/* Sheets */}
                        <div style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '16px', padding: '16px' }}>
                          <div style={{ color: '#555', fontSize: '0.62rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>🗂️ Листи (Матеріал)</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', borderBottom: '1px solid #1a1a1a', paddingBottom: '6px', marginBottom: '6px' }}><span style={{ color: '#888' }}>План: <strong style={{ color: '#fff' }}>{totalPlannedSheets} л.</strong></span><span style={{ color: '#888' }}>Факт: <strong style={{ color: totalActualSheets > totalPlannedSheets ? '#ef4444' : '#10b981' }}>{totalActualSheets} л.</strong></span></div>
                          {Object.entries(matStats).length > 0 ? Object.entries(matStats).map(([mat, sheets]) => (
                            <div key={mat} style={{ fontSize: '0.68rem', color: '#666', borderBottom: '1px solid #111', paddingBottom: '4px', marginBottom: '4px' }}>
                              <div style={{ color: '#888', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={mat}>{mat}</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}><span>План: <strong>{sheets.planned} л.</strong></span><span>Факт: <strong style={{ color: '#10b981' }}>{sheets.actual} л.</strong></span></div>
                            </div>
                          )) : <div style={{ fontSize: '0.62rem', color: '#333', fontStyle: 'italic' }}>Немає даних</div>}
                        </div>

                        {/* Parts */}
                        <div style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '16px', padding: '16px' }}>
                          <div style={{ color: '#555', fontSize: '0.62rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '10px' }}>📦 Деталі та Брак</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '6px' }}>
                            <span style={{ color: '#888' }}>План:</span>
                            <strong style={{ color: '#fff' }}>{totalPlannedParts || '—'}{totalPlannedParts ? ' шт' : ''}</strong>
                          </div>
                          <div onClick={() => setNariadDetailModal('accepted')} title="Відкрити деталізацію прийнятих деталей" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '6px', cursor: 'pointer' }}>
                            <span style={{ color: '#888' }}>Прийнято:</span>
                            <strong style={{ color: '#10b981', borderBottom: '1px dashed #10b981' }}>{acceptedQty} шт</strong>
                          </div>
                          <div onClick={() => setNariadDetailModal('scrap')} title="Відкрити деталізацію браку" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', cursor: 'pointer' }}>
                            <span style={{ color: '#888' }}>Брак:</span>
                            <strong style={{ color: totalScrap > 0 ? '#ef4444' : '#555', borderBottom: `1px dashed ${totalScrap > 0 ? '#ef4444' : '#555'}` }}>{totalScrap} шт</strong>
                          </div>
                        </div>

                      </div>

                      {renderTimeAnalytics('Аналітика перебування деталей у Цеху №1', shop1Time, '#10b981', 'Від першої операції до передачі у Цех №2')}
                      {renderTimeAnalytics('Аналітика перебування деталей у Цеху №2', shop2Time, '#8b5cf6', 'Від приймання у Цех №2 до завершення останньої операції')}

                      {/* Chronological log */}
                      <div style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '20px', padding: '20px 22px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
                          <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 900, color: '#fff', textTransform: 'uppercase' }}>Хронологічний лог етапів</h4>
                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {/* Stage filter */}
                            <div style={{ display: 'flex', gap: '3px', background: '#080808', padding: '4px', borderRadius: '10px', border: '1px solid #1a1a1a' }}>
                              {availableStageFilters.map(stage => {
                                const sel = nariadStageFilter === stage
                                const clr = { All: '#777', 'Цех №1': '#10b981', 'Цех №2': '#8b5cf6', Розкрій: '#3b82f6', Галтовка: '#eab308', Прийомка: '#10b981', Сортування: '#14b8a6' }
                                const stageColor = clr[stage] || '#8b5cf6'
                                return (
                                  <button key={stage} onClick={() => setNariadStageFilter(stage)} style={{
                                    border: 'none', background: sel ? (stage === 'All' ? '#222' : stageColor) : 'transparent',
                                    color: sel ? (stage === 'All' ? '#fff' : '#000') : '#555',
                                    padding: '4px 10px', borderRadius: '7px', fontSize: '0.6rem', fontWeight: 900, cursor: 'pointer', transition: 'all 0.15s',
                                    textTransform: 'uppercase'
                                  }}>
                                    {stage === 'All' ? 'Всі етапи' : stage}
                                  </button>
                                )
                              })}
                            </div>
                            {/* Sort */}
                            <select value={nariadSortBy} onChange={e => setNariadSortBy(e.target.value)}
                              style={{ background: '#111', border: '1px solid #222', color: '#aaa', padding: '5px 10px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}>
                              <option value="date">По даті</option>
                              <option value="shop">Спочатку Цех №1, потім Цех №2</option>
                              <option value="min-time">Мін. час</option>
                              <option value="max-time">Макс. час</option>
                              <option value="scrap">По браку</option>
                            </select>
                            {/* Nom filter */}
                            <select value={nariadNomFilter} onChange={e => setNariadNomFilter(e.target.value)}
                              style={{ background: '#111', border: '1px solid #222', color: '#aaa', padding: '5px 10px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', maxWidth: '180px' }}>
                              <option value="All">Всі деталі</option>
                              {[...new Set(rd.historyRows.map(r => r.nomenclature_id).filter(Boolean))].map(nomId => {
                                const nom = nomenclatures?.find(n => String(n.id) === String(nomId))
                                return <option key={nomId} value={nomId}>{nom?.name || nomId}</option>
                              })}
                            </select>
                          </div>
                        </div>

                        {/* Log table */}
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid #1a1a1a' }}>
                                {['Деталь / Картка','Час (початок / завершення)','План. час','Факт. час','Етап','Оператор / Зміна','Робоче місце','Готово / Брак'].map(col => (
                                  <th key={col} style={{ padding: '8px 10px', textAlign: 'left', color: '#444', fontWeight: 900, textTransform: 'uppercase', fontSize: '0.58rem', whiteSpace: 'nowrap' }}>{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {logRows.map((row, idx) => {
                                const nom = nomenclatures?.find(n => String(n.id) === String(row.nomenclature_id))
                                const rowCard = (rd.taskCards || []).find(card => String(card.id) === String(row.card_id))
                                const sequenceMatch = String(row.card_info || rowCard?.card_info || '').match(/(?:^|\D)(\d+)\s*\/\s*(\d+)(?:\D|$)/)
                                const sequenceLabel = sequenceMatch ? `${sequenceMatch[1]}/${sequenceMatch[2]}` : `ID ${String(row.card_id || '').slice(-8).toUpperCase()}`
                                const dur = row.started_at && row.completed_at
                                  ? Math.max(0, Math.round((new Date(row.completed_at) - new Date(row.started_at)) / 1000))
                                  : null
                                const plannedSec = nom?.time_per_unit ? Math.round(Number(nom.time_per_unit) * (Number(row.qty_completed) || 0)) : null
                                const isGalt = row.stage_name?.startsWith('Галтовка')
                                const stageClr = isShop2History(row) ? '#8b5cf6' : isGalt ? '#eab308' : row.stage_name === 'Прийомка' ? '#10b981' : row.stage_name === 'Сортування' ? '#14b8a6' : '#3b82f6'
                                const hasScrap = Number(row.scrap_qty) > 0
                                const fmt = (iso) => iso ? new Date(iso).toLocaleString('uk-UA', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—'
                                return (
                                  <tr key={row.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.005)' }}>
                                    <td style={{ padding: '8px 10px', color: '#bbb', fontWeight: 700, maxWidth: '220px' }}>
                                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nom?.name || '—'}</div>
                                      <div style={{ color: '#666', fontSize: '0.58rem', marginTop: '2px' }}>Картка {sequenceLabel}</div>
                                    </td>
                                    <td style={{ padding: '8px 10px', color: '#555', whiteSpace: 'nowrap' }}><div>{fmt(row.started_at)}</div><div style={{ marginTop: '2px' }}>{fmt(row.completed_at)}</div></td>
                                    <td style={{ padding: '8px 10px', color: '#777', fontWeight: 800, whiteSpace: 'nowrap' }}>{plannedSec ? formatDurHMS(plannedSec) : '—'}</td>
                                    <td style={{ padding: '8px 10px', color: dur !== null ? '#3b82f6' : '#333', fontWeight: 800, whiteSpace: 'nowrap' }}>{dur !== null ? formatDurHMS(dur) : '—'}</td>
                                    <td style={{ padding: '8px 10px' }}>
                                      <span style={{ background: `${stageClr}15`, color: stageClr, padding: '2px 7px', borderRadius: '5px', fontSize: '0.6rem', fontWeight: 900 }}>
                                        {row.stage_name || '—'}
                                      </span>
                                    </td>
                                    <td style={{ padding: '8px 10px', color: '#666', fontWeight: 700 }}>
                                      <div>{row.operator_name || '—'}</div>
                                      <div style={{ color: '#444', fontSize: '0.6rem' }}>{row.shift_name || ''}</div>
                                    </td>
                                    <td style={{ padding: '8px 10px', color: '#666', fontWeight: 700 }}>{row.machine_name || '—'}</td>
                                    <td style={{ padding: '8px 10px', fontWeight: 900, textAlign: 'right' }}><div style={{ color: '#10b981' }}>{Number(row.qty_completed) || 0} шт</div><div style={{ color: hasScrap ? '#ef4444' : '#333', marginTop: '3px' }}>{Number(row.scrap_qty) || 0} брак</div></td>
                                  </tr>
                                )
                              })}
                              {logRows.length === 0 && (
                                <tr><td colSpan={8} style={{ padding: '30px', textAlign: 'center', color: '#444', fontWeight: 700 }}>Немає записів для відображення</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                    </div>
                  )
                })()}
              </div>
            </div>
          )
        })()}

        {/* 2. CALENDAR TAB */}
        {activeTab === 'calendar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button onClick={() => handleMonthChange('prev')} style={{ background: '#111', border: '1px solid #222', color: '#fff', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontWeight: 700 }}>←</button>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 950, margin: 0, minWidth: '150px', textAlign: 'center' }}>
                  {monthNames[currentMonth]} {currentYear}
                </h2>
                <button onClick={() => handleMonthChange('next')} style={{ background: '#111', border: '1px solid #222', color: '#fff', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontWeight: 700 }}>→</button>
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '0.68rem', fontWeight: 800 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 14, height: 14, borderRadius: '4px', background: '#22c55e', display: 'inline-block' }} /> Робочий (Р)</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 14, height: 14, borderRadius: '4px', background: '#3b82f6', display: 'inline-block' }} /> Вихідний (В)</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 14, height: 14, borderRadius: '4px', background: '#ef4444', display: 'inline-block' }} /> Лікарняний (Л)</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: 14, height: 14, borderRadius: '4px', background: 'rgba(34, 197, 94, 0.15)', border: '1px dashed #22c55e', display: 'inline-block' }} /> Працював по факту (✓)</span>
              </div>
            </div>

            {/* Calendar Grid organized by Shifts */}
            <div style={{ overflowX: 'auto', background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: '24px', maxHeight: '75vh' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.75rem', textAlign: 'left', minWidth: '800px' }}>
                <thead>
                  <tr style={{ background: '#070707', borderBottom: '2px solid #1a1a1a', position: 'sticky', top: 0, zIndex: 12 }}>
                    <th style={{ padding: '16px', fontWeight: 900, color: '#eab308', width: '220px', position: 'sticky', left: 0, background: '#070707', zIndex: 13, borderBottom: '2px solid #1a1a1a' }}>Співробітник / Категорія</th>
                    {Array.from({ length: daysInMonth }).map((_, idx) => (
                      <th key={idx} style={{ padding: '12px 6px', fontWeight: 900, color: '#555', textAlign: 'center', minWidth: '30px', background: '#070707', borderBottom: '2px solid #1a1a1a' }}>
                        {idx + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categorizedCalendarUsers.length === 0 ? (
                    <tr>
                      <td colSpan={daysInMonth + 1} style={{ padding: '30px', textAlign: 'center', color: '#555', fontStyle: 'italic' }}>
                        Немає робітників у Цеху №1
                      </td>
                    </tr>
                  ) : (
                    categorizedCalendarUsers.map(category => {
                      const isOpen = !!openAccordions[category.title];
                      return (
                        <React.Fragment key={category.title}>
                          {/* Section Header Row */}
                          <tr 
                            onClick={() => toggleAccordion(category.title)}
                            style={{ background: 'rgba(234,179,8,0.04)', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.02)' }}
                          >
                            <td colSpan={daysInMonth + 1} style={{ padding: '10px 16px', fontWeight: 900, color: '#eab308', fontSize: '0.72rem', letterSpacing: '0.05em', position: 'sticky', left: 0, zIndex: 2, userSelect: 'none' }}>
                              <span style={{ marginRight: '8px', fontSize: '0.6rem' }}>{isOpen ? '▼' : '►'}</span>
                              {category.title} ({category.users.length})
                            </td>
                          </tr>
                          {/* User Rows under this section (conditionally rendered) */}
                          {isOpen && category.users.map(user => renderCalendarRow(user))}
                        </React.Fragment>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. STAFF MANAGEMENT TAB */}
        {activeTab === 'staff' && (
          <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '30px', alignItems: 'start' }}>
            
            {/* Left Column: Create / Edit Form */}
            <div style={{ background: '#0d0d0d', padding: '25px', borderRadius: '24px', border: '1px solid #1a1a1a', position: 'sticky', top: '20px' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 950, color: '#eab308', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={18} /> {userForm.id ? 'РЕДАГУВАТИ РОБІТНИКА' : 'НОВИЙ СПІВРОБІТНИК'}
              </h2>

              <form onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.62rem', color: '#555', fontWeight: 900, textTransform: 'uppercase' }}>Логін (англ)</label>
                    <input style={formInputStyle} value={userForm.login} onChange={e => setUserForm({ ...userForm, login: e.target.value })} placeholder="ivanov_op" required disabled={!!userForm.id} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.62rem', color: '#555', fontWeight: 900, textTransform: 'uppercase' }}>Пароль</label>
                    <input style={formInputStyle} value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} placeholder={userForm.id ? "опціонально..." : "пароль..."} required={!userForm.id} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.62rem', color: '#555', fontWeight: 900, textTransform: 'uppercase' }}>Ім'я</label>
                    <input style={formInputStyle} value={userForm.first_name} onChange={e => setUserForm({ ...userForm, first_name: e.target.value })} placeholder="Іван" />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.62rem', color: '#555', fontWeight: 900, textTransform: 'uppercase' }}>Прізвище</label>
                    <input style={formInputStyle} value={userForm.last_name} onChange={e => setUserForm({ ...userForm, last_name: e.target.value })} placeholder="Іванов" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.62rem', color: '#555', fontWeight: 900, textTransform: 'uppercase' }}>Штатна посада</label>
                    <select style={formInputStyle} value={userForm.position} onChange={e => setUserForm({ ...userForm, position: e.target.value })}>
                      {resolvedShop1Positions.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.62rem', color: '#555', fontWeight: 900, textTransform: 'uppercase' }}>Базова зміна</label>
                    <select style={formInputStyle} value={userForm.shift} onChange={e => setUserForm({ ...userForm, shift: e.target.value })}>
                      <option value="Зміна 1">Зміна 1</option>
                      <option value="Зміна 2">Зміна 2</option>
                      <option value="Зміна 3">Зміна 3</option>
                      <option value="Зміна 4">Зміна 4</option>
                      <option value="Без зміни">Без зміни</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                  <button type="submit" disabled={isProcessing} style={{
                    background: '#eab308',
                    color: '#000',
                    border: 'none',
                    padding: '14px',
                    borderRadius: '12px',
                    fontWeight: 950,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(234,179,8,0.1)'
                  }}>
                    <Save size={16} /> {userForm.id ? 'ЗБЕРЕГТИ ЗМІНИ' : 'СТВОРИТИ РОБІТНИКА'}
                  </button>
                  {userForm.id && (
                    <button type="button" onClick={() => setUserForm({
                      id: null,
                      login: '',
                      password: '',
                      first_name: '',
                      last_name: '',
                      position: 'Оператор розкрою',
                      department: 'Цех №1',
                      shift: 'Зміна 1',
                      access_rights: {
                        operator: true,
                        shop1: true,
                        tumbling_terminal: true,
                        reception_terminal: true,
                        sorting_terminal: true
                      }
                    })} style={{
                      background: 'rgba(255,255,255,0.03)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.05)',
                      padding: '10px',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      marginTop: '6px'
                    }}>
                      СКАСУВАТИ
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Right Column: Staff Registry List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#555', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  👥 РОБІТНИКИ ЦЕХУ №1 ({filteredUsers.length})
                </h3>
                <div style={{ position: 'relative', width: '250px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#555' }} />
                  <input
                    style={{ background: '#000', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '8px 12px 8px 36px', color: '#fff', fontSize: '0.78rem', width: '100%', outline: 'none', boxSizing: 'border-box' }}
                    placeholder="Пошук робітника..."
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                {filteredUsers.map(user => {
                  const initials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || '?'
                  const isOnline = user.last_seen && (Date.now() - new Date(user.last_seen).getTime() < 120000)

                  return (
                    <div key={user.id} style={{
                      background: '#0d0d0d',
                      border: userForm.id === user.id ? '1px solid #eab308' : '1px solid rgba(255,255,255,0.03)',
                      borderRadius: '20px',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '15px',
                      transition: 'all 0.2s',
                      boxShadow: userForm.id === user.id ? '0 4px 20px rgba(234,179,8,0.05)' : 'none'
                    }}>
                      <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                        <div style={{ position: 'relative' }}>
                          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #eab308, #ca8a04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 900, fontSize: '0.85rem' }}>
                            {initials}
                          </div>
                          <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '10px', height: '10px', borderRadius: '50%', background: isOnline ? '#10b981' : '#6b7280', border: '2px solid #0d0d0d' }} />
                        </div>
                        <div style={{ overflow: 'hidden', flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                            <span style={{ fontSize: '0.62rem', color: '#555', fontWeight: 700 }}>@{user.login}</span>
                            <span style={{ fontSize: '0.62rem', color: isOnline ? '#10b981' : '#444', fontWeight: 700 }}>{isOnline ? 'Online' : 'Offline'}</span>
                          </div>
                          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#fff', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {formatUserName(user)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: 'rgba(234,179,8,0.08)', color: '#eab308', border: '1px solid rgba(234,179,8,0.2)' }}>
                          {user.position || 'Робітник'}
                        </span>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', color: '#aaa', border: '1px solid rgba(255,255,255,0.05)' }}>
                          {user.shift || 'Без зміни'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '10px', marginTop: '5px' }}>
                        <button onClick={() => editUser(user)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          ✍️ Редагувати
                        </button>
                        <button onClick={() => handleResetPassword(user)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          🔑 Новий пароль
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
        )}

        {nariadDetailModal && nariadReportData && (() => {
          const historyRows = nariadReportData.historyRows || []
          const cardsById = new Map((nariadReportData.taskCards || []).map(card => [String(card.id), card]))
          const getCardSequence = row => {
            const card = cardsById.get(String(row.card_id))
            const match = String(row.card_info || card?.card_info || '').match(/(?:^|\D)(\d+)\s*\/\s*(\d+)(?:\D|$)/)
            return match ? `${match[1]}/${match[2]}` : `ID ${String(row.card_id || '').slice(-8).toUpperCase()}`
          }
          const isAccepted = nariadDetailModal === 'accepted'
          const rows = historyRows
            .filter(row => isAccepted ? (row.stage_name === 'Прийомка' || row.stage_name === 'completed') && Number(row.qty_completed) > 0 : Number(row.scrap_qty) > 0)
            .map(row => {
              const nom = nomenclatures?.find(item => String(item.id) === String(row.nomenclature_id))
              return {
                ...row,
                detailName: nom?.name || 'Невідома деталь',
                detailCode: nom?.nomenclature_code || 'БЕЗ КОДУ',
                sequence: getCardSequence(row),
                qty: isAccepted ? Number(row.qty_completed) || 0 : Number(row.scrap_qty) || 0
              }
            })
            .sort((a, b) => b.qty - a.qty)

          return (
            <div onClick={() => setNariadDetailModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)', zIndex: 45000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <div onClick={event => event.stopPropagation()} style={{ width: '100%', maxWidth: '620px', maxHeight: '85vh', overflowY: 'auto', background: '#0d0d0d', border: '1px solid #252525', borderRadius: '20px', padding: '24px', boxShadow: '0 24px 60px rgba(0,0,0,.65)', position: 'relative' }}>
                <button onClick={() => setNariadDetailModal(null)} style={{ position: 'absolute', right: '15px', top: '15px', width: '30px', height: '30px', borderRadius: '50%', border: 'none', background: '#222', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><XCircle size={16} /></button>
                <h3 style={{ margin: '0 40px 18px 0', color: isAccepted ? '#10b981' : '#ef4444', fontSize: '1.08rem', fontWeight: 950, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isAccepted ? <CheckCircle size={19} /> : <AlertTriangle size={19} />}
                  {isAccepted ? 'Деталізація прийнятих деталей' : 'Деталізація браку за етапами'}
                </h3>
                {rows.length === 0 ? <div style={{ color: '#555', textAlign: 'center', padding: '30px' }}>Записів немає</div> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                    {rows.map((row, index) => (
                      <div key={row.id || `${row.card_id}-${index}`} style={{ background: '#111', border: '1px solid #242424', borderRadius: '12px', padding: '12px 13px', display: 'flex', justifyContent: 'space-between', gap: '15px', alignItems: 'center' }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', gap: '7px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ color: '#fff', fontWeight: 850, fontSize: '0.8rem' }}>{row.detailName}</span>
                            <span style={{ color: '#eab308', background: 'rgba(234,179,8,.1)', border: '1px solid rgba(234,179,8,.2)', borderRadius: '5px', padding: '2px 6px', fontSize: '0.6rem', fontWeight: 900 }}>Картка {row.sequence}</span>
                          </div>
                          <div style={{ color: '#4b4b4b', fontSize: '0.6rem', marginTop: '3px' }}>{row.detailCode} · ID {String(row.card_id || '').slice(-8).toUpperCase()}</div>
                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', color: '#777', fontSize: '0.63rem', marginTop: '7px' }}>
                            <span>Етап: <strong style={{ color: '#aaa' }}>{row.stage_name === 'completed' ? 'Прийомка' : row.stage_name || '—'}</strong></span>
                            {row.machine_name && <span>Верстат: <strong style={{ color: '#aaa' }}>{row.machine_name}</strong></span>}
                            <span>Оператор: <strong style={{ color: '#aaa' }}>{row.operator_name || '—'}</strong></span>
                          </div>
                        </div>
                        <div style={{ color: isAccepted ? '#10b981' : '#ef4444', fontWeight: 1000, fontSize: '0.95rem', whiteSpace: 'nowrap' }}>{row.qty} шт</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })()}

      </div>
    </div>
  )
}
