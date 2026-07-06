import React, { useState, useEffect, useMemo } from 'react'
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
    companyStructure
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
    const stats = {
      'Зміна 1': { 
        active: 0, completed: 0, activeCards: [], completedCards: [],
        cuttingActive: 0, cuttingCompleted: 0,
        tumblingActive: 0, tumblingCompleted: 0,
        totalTuningTimeMins: 0, totalWorkingTimeMins: 0,
        completedWorkingTimeMins: 0
      },
      'Зміна 2': { 
        active: 0, completed: 0, activeCards: [], completedCards: [],
        cuttingActive: 0, cuttingCompleted: 0,
        tumblingActive: 0, tumblingCompleted: 0,
        totalTuningTimeMins: 0, totalWorkingTimeMins: 0,
        completedWorkingTimeMins: 0
      },
      'Зміна 3': { 
        active: 0, completed: 0, activeCards: [], completedCards: [],
        cuttingActive: 0, cuttingCompleted: 0,
        tumblingActive: 0, tumblingCompleted: 0,
        totalTuningTimeMins: 0, totalWorkingTimeMins: 0,
        completedWorkingTimeMins: 0
      },
      'Зміна 4': { 
        active: 0, completed: 0, activeCards: [], completedCards: [],
        cuttingActive: 0, cuttingCompleted: 0,
        tumblingActive: 0, tumblingCompleted: 0,
        totalTuningTimeMins: 0, totalWorkingTimeMins: 0,
        completedWorkingTimeMins: 0
      },
      'Без зміни': { 
        active: 0, completed: 0, activeCards: [], completedCards: [],
        cuttingActive: 0, cuttingCompleted: 0,
        tumblingActive: 0, tumblingCompleted: 0,
        totalTuningTimeMins: 0, totalWorkingTimeMins: 0,
        completedWorkingTimeMins: 0
      }
    }

    const start = new Date(reportStartDate + 'T00:00:00')
    const end = new Date(reportEndDate + 'T23:59:59')

    // Active Cards (running / paused)
    ;(workCards || []).forEach(c => {
      const startedDate = c.started_at || c.created_at
      if (startedDate) {
        const d = new Date(startedDate)
        if (d < start || d > end) return
      }

      const user = (systemUsers || []).find(u => formatUserName(u) === c.operator_name)
      const shift = c.shift_name || user?.shift || 'Без зміни'
      const targetGroup = stats[shift] || stats['Без зміни']
      targetGroup.active += 1
      targetGroup.activeCards.push(c)

      // Sub-divide by operation step: cutting (розкрій/лазер) vs tumbling (галтовка/галтування)
      const step = String(c.step_name || c.step || '').toLowerCase()
      if (step.includes('галтовка') || step.includes('галтування') || step.includes('галтов')) {
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
    ;(workCardHistory || []).forEach(h => {
      const compDate = h.completed_at || h.started_at || h.created_at
      if (compDate) {
        const d = new Date(compDate)
        if (d < start || d > end) return
      }

      const user = (systemUsers || []).find(u => formatUserName(u) === h.operator_name)
      const shift = h.shift_name || user?.shift || 'Без зміни'
      const targetGroup = stats[shift] || stats['Без зміни']
      targetGroup.completed += 1
      targetGroup.completedCards.push(h)

      const step = String(h.step_name || h.step || '').toLowerCase()
      if (step.includes('галтовка') || step.includes('галтування') || step.includes('галтов')) {
        targetGroup.tumblingCompleted += 1
      } else {
        targetGroup.cuttingCompleted += 1
      }

      // Truthful Timing logic based on database timestamps (completed_at - started_at)
      if (h.completed_at && h.started_at) {
        const actualDiffMins = Math.max(0, Math.floor((new Date(h.completed_at) - new Date(h.started_at)) / 60000))
        // Protect against extreme anomalies (e.g. card left active for weeks) by ignoring values over 48 hours for averages
        if (actualDiffMins < 2880) {
          targetGroup.completedWorkingTimeMins += actualDiffMins
          targetGroup.totalWorkingTimeMins += actualDiffMins
        }
      } else {
        // Fallback to written columns if dates are missing
        const workTime = Number(h.working_time_mins || h.duration_mins || 0)
        targetGroup.completedWorkingTimeMins += workTime
        targetGroup.totalWorkingTimeMins += workTime
      }
      
      const setupTime = Number(h.setup_time_mins || h.tuning_time_mins || h.setup_duration || 0)
      targetGroup.totalTuningTimeMins += setupTime
    })

    return stats
  }, [workCards, workCardHistory, systemUsers, reportStartDate, reportEndDate])

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
          <div style={{ display: 'flex', gap: '10px', background: '#0d0d0d', padding: '6px', borderRadius: '16px', border: '1px solid #1a1a1a' }}>
            <button onClick={() => setActiveTab('dashboard')} style={tabBtnStyle('dashboard')}>
              <LayoutDashboard size={16} /> Моніторинг
            </button>
            <button onClick={() => setActiveTab('calendar')} style={tabBtnStyle('calendar')}>
              <Calendar size={16} /> Календар змін
            </button>
            <button onClick={() => setActiveTab('shifts_report')} style={tabBtnStyle('shifts_report')}>
              <RefreshCw size={16} /> Звіт по змінах
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

            {/* Shift cards widgets grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {Object.entries(shiftStats).map(([shiftName, counts]) => {
                const total = counts.active + counts.completed
                // Calculate buffers/queue size (cards waiting to start)
                const queueCount = counts.activeCards.filter(c => c.status === 'paused' || !c.started_at).length;
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
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '15px' }}>
                      <div 
                        onClick={() => counts.active > 0 && setSelectedReportDetails({ shift: shiftName, type: 'active', cards: counts.activeCards })}
                        style={{ cursor: counts.active > 0 ? 'pointer' : 'default', padding: '8px', borderRadius: '12px', background: counts.active > 0 ? 'rgba(34, 197, 94, 0.03)' : 'transparent', border: counts.active > 0 ? '1px solid rgba(34, 197, 94, 0.08)' : '1px solid transparent', transition: '0.2s' }}
                        className={counts.active > 0 ? "hover-scale" : ""}
                      >
                        <div style={{ fontSize: '0.58rem', color: '#555', fontWeight: 900, textTransform: 'uppercase' }}>В роботі ➔</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 950, color: '#22c55e', marginTop: '4px' }}>{counts.active} <span style={{ fontSize: '0.75rem', color: '#444', fontWeight: 700 }}>карт</span></div>
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
                          <span style={{ color: '#aaa' }}>Активних: <strong style={{ color: '#22c55e' }}>{counts.cuttingActive}</strong></span>
                          <span style={{ color: '#aaa' }}>Здано: <strong style={{ color: '#3b82f6' }}>{counts.cuttingCompleted}</strong></span>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.58rem', color: '#888', fontWeight: 900, marginBottom: '6px', letterSpacing: '0.05em' }}>🌀 ГАЛТОВКА</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ color: '#aaa' }}>Активних: <strong style={{ color: '#22c55e' }}>{counts.tumblingActive}</strong></span>
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
                        {selectedReportDetails.shift} — {selectedReportDetails.type === 'active' ? 'Картки в роботі' : 'Завершені картки'}
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
                      return (
                        <div key={card.id || idx} style={{
                          background: 'rgba(255,255,255,0.01)',
                          border: '1px solid rgba(255,255,255,0.03)',
                          borderRadius: '16px',
                          padding: '16px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '15px'
                        }}>
                          <div>
                            <div style={{ fontWeight: 800, color: '#fff', fontSize: '0.85rem' }}>{nom?.name || 'Н Nomenclature'}</div>
                            <div style={{ fontSize: '0.65rem', color: '#666', marginTop: '4px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span>Номер: #{card.id?.slice(-8).toUpperCase()}</span>
                              <span>•</span>
                              <span>Оператор: <strong>{card.operator_name || 'Не вказано'}</strong></span>
                              {card.machine && card.machine !== 'Не вказано' && (
                                <>
                                  <span>•</span>
                                  <span>Верстат: {card.machine}</span>
                                </>
                              )}
                            </div>
                          </div>
                          
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontWeight: 950, fontSize: '0.9rem', color: '#eab308' }}>{card.quantity || 0} шт</div>
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

      </div>
    </div>
  )
}
