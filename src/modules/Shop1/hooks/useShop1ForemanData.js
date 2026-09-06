import { useState, useEffect, useMemo, useRef } from 'react'
import { useMES } from '../../../MESContext'
import { getIndexedCache, setIndexedCache } from '../../../services/indexedDbCache'

export const useShop1ForemanData = () => {
  const {
    systemUsers,
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
    inventory,
    machineOperations
  } = useMES()

  const [activeTab, setActiveTab] = useState('calendar')
  const [userSearch, setUserSearch] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Dynamically resolve Shop 1 Positions from database companyPositions
  const resolvedShop1Positions = useMemo(() => {
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

    const dbPositions = (companyPositions || []).filter(p => {
      if (!p.department_id) return true
      return s1DeptIds.includes(p.department_id)
    }).map(p => p.name)

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
      crm: true,
      crm_clients: true,
      operator: true,
      shop1: true,
      tumbling_terminal: true,
      reception_terminal: true,
      sorting_terminal: true
    }
  })

  // Calendar States
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [calendarSaving, setCalendarSaving] = useState(false)
  const [calendarWorkHistory, setCalendarWorkHistory] = useState([])
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

  // Shift Report States
  const [reportStartDate, setReportStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString().split('T')[0]
  })
  const [reportEndDate, setReportEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [quickPeriod, setQuickPeriod] = useState('week')
  const [selectedReportDetails, setSelectedReportDetails] = useState(null)
  const [shiftReportHistory, setShiftReportHistory] = useState([])
  const [shiftReportLoading, setShiftReportLoading] = useState(false)

  // Nariad Reports States
  const [nariadSearch, setNariadSearch] = useState('')
  const [selectedNariadTaskId, setSelectedNariadTaskId] = useState(null)
  const [nariadReportLoading, setNariadReportLoading] = useState(false)
  const [nariadReportData, setNariadReportData] = useState(null)
  const [nariadStageFilter, setNariadStageFilter] = useState('All')
  const [nariadNomFilter, setNariadNomFilter] = useState('All')
  const [nariadSortBy, setNariadSortBy] = useState('date')
  const [nariadDetailModal, setNariadDetailModal] = useState(null)
  const [nariadCatalog, setNariadCatalog] = useState([])
  const [nariadCatalogLoading, setNariadCatalogLoading] = useState(false)
  const [nariadCatalogTotal, setNariadCatalogTotal] = useState(0)
  const [nariadCatalogPage, setNariadCatalogPage] = useState(0)
  const nariadReportCache = useRef(new Map())

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
        console.warn('Naryad catalog RPC unavailable, using local window', error)
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

  useEffect(() => {
    if (activeTab !== 'calendar') return
    let cancelled = false
    const cacheKey = `calendar-history-v4-${currentYear}-${currentMonth}`

    const loadCalendarHistory = async () => {
      try {
        const cached = await getIndexedCache(cacheKey)
        if (cached && !cancelled) {
          setCalendarWorkHistory(cached)
        }
      } catch (err) {
        console.warn('Failed to load calendar history from IndexedDB:', err)
      }

      const monthStart = new Date(currentYear, currentMonth, 1)
      const monthEnd = new Date(currentYear, currentMonth + 1, 1)
      const startIso = monthStart.toISOString()
      const endIso = monthEnd.toISOString()
      const pageSize = 1000

      const loadByDateColumn = async (column) => {
        const rows = []
        for (let offset = 0; !cancelled; offset += pageSize) {
          const { data, error } = await supabase
            .from('work_card_history')
            .select('id,card_id,operator_name,manager_name,stage_name,started_at,completed_at,created_at')
            .gte(column, startIso)
            .lt(column, endIso)
            .order(column, { ascending: true })
            .range(offset, offset + pageSize - 1)
          if (error) throw error
          const page = data || []
          rows.push(...page)
          if (page.length < pageSize) break
        }
        return rows
      }

      try {
        const [startedRows, completedRows] = await Promise.all([
          loadByDateColumn('started_at'),
          loadByDateColumn('completed_at')
        ])
        const merged = Array.from(new Map(
          [...startedRows, ...completedRows].map(row => [String(row.id), row])
        ).values())
        if (!cancelled) {
          setCalendarWorkHistory(merged)
          setIndexedCache(cacheKey, merged).catch(err => console.warn('Failed to save calendar history:', err))
        }
      } catch (error) {
        console.error('Failed to load calendar work history:', error)
        if (!cancelled) setCalendarWorkHistory([])
      }
    }

    loadCalendarHistory()
    return () => { cancelled = true }
  }, [activeTab, currentYear, currentMonth, supabase])

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

  const daysInMonth = useMemo(() => {
    return new Date(currentYear, currentMonth + 1, 0).getDate()
  }, [currentYear, currentMonth])

  const monthNames = [
    'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
    'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
  ]
  const weekDayNames = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

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

      const op = String(c.operation || '')
      if (op.startsWith('Галтовка')) {
        targetGroup.tumblingActive += 1
      } else {
        targetGroup.cuttingActive += 1
      }

      if (c.started_at) {
        const diffMins = Math.max(0, Math.floor((new Date() - new Date(c.started_at)) / 60000))
        targetGroup.totalWorkingTimeMins += diffMins
      }
    })

    ;(shiftReportHistory || []).forEach(h => {
      const compDate = h.completed_at || h.started_at || h.created_at
      if (compDate) {
        const d = new Date(compDate)
        if (d < start || d > end) return
      }

      const user = (systemUsers || []).find(u => formatUserName(u) === h.operator_name)
      const shift = h.shift_name || user?.shift || 'Без зміни'
      const targetGroup = stats[shift] || stats['Без зміни']

      const hop = String(h.stage_name || h.operation || '')
      const isShiftHandover = hop === 'Розкрій (перезмінка)'
      const isPausedWorkSession = String(h.card_info || '').includes('[PAUSED_WORK_LOG]')
      const isPauseInterval = hop === 'Розкрій (зупинка)'
      const isServiceSession = isShiftHandover || isPausedWorkSession || isPauseInterval
      const isCuttingCompletion = hop === 'Розкрій'
      const isTumblingCompletion = hop === 'Галтовка' || hop.startsWith('Галтовка ')
      const isTrackedCompletion = isCuttingCompletion || isTumblingCompletion

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

      if (!isPauseInterval && h.completed_at && h.started_at) {
        const actualDiffMins = Math.max(0, Math.floor((new Date(h.completed_at) - new Date(h.started_at)) / 60000))
        if (actualDiffMins < 2880) {
          targetGroup.completedWorkingTimeMins += actualDiffMins
          targetGroup.totalWorkingTimeMins += actualDiffMins
        }
      } else if (!isPauseInterval) {
        const workTime = Number(h.working_time_mins || h.duration_mins || 0)
        targetGroup.completedWorkingTimeMins += workTime
        targetGroup.totalWorkingTimeMins += workTime
      }

      const setupTime = Number(h.setup_time_mins || h.tuning_time_mins || h.setup_duration || 0)
      targetGroup.totalTuningTimeMins += setupTime
    })

    Object.values(stats).forEach(group => { delete group.completedOperationKeys })
    return stats
  }, [workCards, shiftReportHistory, systemUsers, reportStartDate, reportEndDate, formatUserName])

  const { operatorCheckins, masterCheckins } = useMemo(() => {
    const ops = {}
    const masters = {}

    const mark = (map, name, dateStr) => {
      if (!name || name === 'Не вказано') return
      if (!map[name]) map[name] = {}
      map[name][dateStr] = true
    }

    if (calendarWorkHistory && calendarWorkHistory.length > 0) {
      calendarWorkHistory.forEach(h => {
        const opDate = h.started_at || h.completed_at || h.created_at
        if (opDate) {
          try {
            const dateStr = new Date(opDate).toLocaleDateString('en-CA', { timeZone: 'Europe/Kyiv' })
            mark(ops, h.operator_name, dateStr)
          } catch (e) {}
        }

        const isLaunchStage = String(h.stage_name || '').trim().toLowerCase() === 'розкрій'
        if (isLaunchStage && h.started_at) {
          try {
            const dateStr = new Date(h.started_at).toLocaleDateString('en-CA', { timeZone: 'Europe/Kyiv' })
            mark(masters, h.manager_name, dateStr)
          } catch (e) {}
        }
      })
    }

    if (workCards && workCards.length > 0) {
      workCards.forEach(c => {
        const startedDate = c.started_at || c.created_at
        if (!startedDate) return
        try {
          const dateStr = new Date(startedDate).toLocaleDateString('en-CA', { timeZone: 'Europe/Kyiv' })
          mark(ops, c.operator_name, dateStr)
          const isRozkriiCard = String(c.operation || '').trim().toLowerCase() === 'розкрій'
          if (isRozkriiCard && c.started_at) {
            const masterDateStr = new Date(c.started_at).toLocaleDateString('en-CA', { timeZone: 'Europe/Kyiv' })
            mark(masters, c.manager_name, masterDateStr)
          }
        } catch (e) {}
      })
    }

    return { operatorCheckins: ops, masterCheckins: masters }
  }, [calendarWorkHistory, workCards])

  const allOrdersMap = useMemo(() => {
    const map = {}
    ;(orders || []).forEach(o => { map[o.id] = o })
    return map
  }, [orders])

  const filteredTasks = useMemo(() => {
    const localFilteredTasks = (tasks || [])
      .filter(t => {
        const order = allOrdersMap[t.order_id]
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

    return nariadCatalog.length > 0
      ? nariadCatalog.filter(row => row.order_num).map(row => ({
          ...row,
          id: row.task_id,
          plan_snapshot: row.plan_snapshot || null,
          _catalogOrder: { id: row.order_id, order_num: row.order_num, customer: row.customer, order_items: [] }
        }))
      : localFilteredTasks
  }, [nariadCatalog, tasks, allOrdersMap, nariadSearch])

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

      // Fast path: direct lookup by task_id using index idx_work_card_history_task_id
      const { data: directHistory } = await supabase
        .from('work_card_history')
        .select('*')
        .eq('task_id', task.id)
        .limit(10000)

      if (directHistory && directHistory.length > 0) {
        historyRows = directHistory
      } else if (allCardIds.length > 0) {
        // Fallback for legacy records: parallel chunk queries via card_id
        const chunkSize = 60
        const chunks = []
        for (let i = 0; i < allCardIds.length; i += chunkSize) {
          chunks.push(allCardIds.slice(i, i + chunkSize))
        }
        const histResults = await Promise.all(
          chunks.map(chunk =>
            supabase.from('work_card_history').select('*').in('card_id', chunk).limit(10000).then(r => r.data || [])
          )
        )
        historyRows = histResults.flat()
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
      alert('Помилка завантаження звіту: ' + e.message)
    } finally {
      setNariadReportLoading(false)
    }
  }

  return {
    activeTab,
    setActiveTab,
    userSearch,
    setUserSearch,
    isProcessing,
    resolvedShop1Positions,
    userForm,
    setUserForm,
    currentYear,
    currentMonth,
    calendarSaving,
    calendarWorkHistory,
    openAccordions,
    toggleAccordion,
    reportStartDate,
    setReportStartDate,
    reportEndDate,
    setReportEndDate,
    quickPeriod,
    setQuickPeriod,
    selectedReportDetails,
    setSelectedReportDetails,
    shiftReportLoading,
    nariadSearch,
    setNariadSearch,
    selectedNariadTaskId,
    setSelectedNariadTaskId,
    nariadReportLoading,
    nariadReportData,
    nariadStageFilter,
    setNariadStageFilter,
    nariadNomFilter,
    setNariadNomFilter,
    nariadSortBy,
    setNariadSortBy,
    nariadDetailModal,
    setNariadDetailModal,
    nariadCatalogLoading,
    nariadCatalogTotal,
    nariadCatalogPage,
    setNariadCatalogPage,
    handleQuickDateSelect,
    shop1Users,
    filteredUsers,
    machineMonitorList,
    handleSaveUser,
    editUser,
    handleResetPassword,
    daysInMonth,
    monthNames,
    weekDayNames,
    handleMonthChange,
    handleToggleDayShift,
    categorizedCalendarUsers,
    shiftStats,
    operatorCheckins,
    masterCheckins,
    allOrdersMap,
    filteredTasks,
    handleOpenNariadReport,
    nomenclatures,
    inventory,
    machineOperations,
    formatUserName
  }
}
