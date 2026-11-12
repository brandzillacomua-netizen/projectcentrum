import { useState, useMemo, useEffect } from 'react'
import { useMES } from '../../../MESContext'
import { useStore } from '../../../store/index.js'
import { isShop2CardTag, resolveShop2CardDisplayInfo } from '../../../utils/shop2RoutingUtils.js'
import { isPackagingOperation } from '../../Shop2CardGen/constants/shop2Stages'
import {
  buildShop2TodayShiftSummary,
  getTodayCalendarKey,
  isShop2Department,
  isShop2User
} from '../utils/shop2ForemanUtils.js'

const DEFAULT_SHOP2_POSITIONS = [
  'Фарбувальник',
  'Маляр',
  'Пресувальник',
  'Доопрацювання',
  'Слюсар з доопрацювання',
  'Майстер Цеху №2',
  'Начальник Цеху №2'
]

const DEFAULT_SHOP2_ACCESS_RIGHTS = {
  shop2_terminal: true,
  pressing_terminal: true,
  painting_terminal: true,
  rework_terminal: false,
  shop2_foreman: false
}

export const useShop2ForemanData = () => {
  const { upsertUser, formatUserName, fetchData } = useMES()

  const systemUsers = useStore(state => state.systemUsers)
  const workCards = useStore(state => state.workCards)
  const tasks = useStore(state => state.tasks)
  const nomenclatures = useStore(state => state.nomenclatures)
  const orders = useStore(state => state.orders)
  const companyPositions = useStore(state => state.companyPositions)
  const companyStructure = useStore(state => state.companyStructure)

  const [activeTab, setActiveTab] = useState('calendar')
  const [userSearch, setUserSearch] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [calendarSaving, setCalendarSaving] = useState(false)

  useEffect(() => {
    if (typeof fetchData === 'function') {
      fetchData(['system_users', 'work_cards', 'tasks', 'nomenclatures', 'orders']).catch(() => {})
    }
  }, [activeTab])

  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [openAccordions, setOpenAccordions] = useState({
    '👥 ЗМІНА 1': true,
    '👥 ЗМІНА 2': true,
    '👥 ЗМІНА 3': true,
    '👥 ЗМІНА 4': true,
    '👥 БЕЗ ЗМІНИ': true
  })

  const [userForm, setUserForm] = useState({
    id: null,
    login: '',
    password: '',
    first_name: '',
    last_name: '',
    position: 'Фарбувальник',
    department: 'Цех №2',
    shift: 'Зміна 1',
    access_rights: { ...DEFAULT_SHOP2_ACCESS_RIGHTS }
  })

  const resolvedShop2Positions = useMemo(() => {
    const s2Depts = (companyStructure || []).filter(d => isShop2Department(d.name))
    const s2DeptIds = s2Depts.map(d => d.id)
    const dbPositions = (companyPositions || [])
      .filter(p => !p.department_id || s2DeptIds.includes(p.department_id))
      .map(p => p.name)
      .filter(Boolean)

    return Array.from(new Set([...dbPositions, ...DEFAULT_SHOP2_POSITIONS]))
  }, [companyPositions, companyStructure])

  const shop2Users = useMemo(() => {
    return (systemUsers || []).filter(isShop2User)
  }, [systemUsers])

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase().trim()
    if (!q) return shop2Users
    return shop2Users.filter(u => {
      const fullName = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase()
      return (
        fullName.includes(q) ||
        String(u.login || '').toLowerCase().includes(q) ||
        String(u.position || '').toLowerCase().includes(q)
      )
    })
  }, [shop2Users, userSearch])

  const categorizedCalendarUsers = useMemo(() => {
    const shiftGroups = {
      'Зміна 1': [],
      'Зміна 2': [],
      'Зміна 3': [],
      'Зміна 4': [],
      'Без зміни': []
    }

    shop2Users.forEach(u => {
      const shift = String(u.shift || 'Без зміни')
      if (!shiftGroups[shift]) shiftGroups[shift] = []
      shiftGroups[shift].push(u)
    })

    const sortByPosition = (a, b) => {
      const isMaster = u => ['начальник', 'майстер', 'мастер', 'керівник'].some(kw => String(u.position || '').toLowerCase().includes(kw))
      const aM = isMaster(a)
      const bM = isMaster(b)
      if (aM && !bM) return -1
      if (!aM && bM) return 1
      return String(a.last_name || '').localeCompare(String(b.last_name || ''), 'uk')
    }

    return Object.entries(shiftGroups)
      .map(([shiftName, users]) => ({
        title: `👥 ${shiftName.toUpperCase()}`,
        users: [...users].sort(sortByPosition)
      }))
      .filter(group => group.users.length > 0)
  }, [shop2Users])

  const todayKey = getTodayCalendarKey()
  const todayShiftSummary = useMemo(() => {
    return buildShop2TodayShiftSummary(shop2Users, todayKey, formatUserName)
  }, [shop2Users, todayKey, formatUserName])

  const shop2TaskIdsSet = useMemo(() => {
    const set = new Set()
    ;(tasks || []).forEach(t => {
      const step = String(t.step || '').toLowerCase()
      const name = String(t.name || '').toLowerCase()
      if (
        step.includes('цех №2') || step.includes('цех 2') ||
        step.includes('пресування') || step.includes('фарбування') || step.includes('маляр') ||
        name.includes('цех №2') || name.includes('цех 2') ||
        name.includes('пресування') || name.includes('фарбування') || name.includes('маляр')
      ) {
        set.add(String(t.id))
      }
    })
    return set
  }, [tasks])

  const shop2Cards = useMemo(() => {
    return (workCards || [])
      .filter(card => {
        if (!card || card.status === 'completed' || card.status === 'cancelled') return false
        const op = String(card.operation || '')
        const opLower = op.toLowerCase()
        const info = String(card.card_info || '')
        // Exclude Rework cards (they belong to ReworkTerminal / Sorting) and Packaging cards, matching Shop2Terminal
        if (op === 'Доопрацювання' || info.includes('Автоматично з Сортування')) return false
        if (isPackagingOperation(op)) return false
        return (
          isShop2CardTag(card) ||
          shop2TaskIdsSet.has(String(card.task_id)) ||
          info.includes('[SHOP:2]') ||
          info.includes('[ЦЕХ №2]') ||
          info.includes('[ЦЕХ 2]') ||
          opLower.includes('пресув') ||
          opLower.includes('фарбув') ||
          opLower.includes('маляр')
        )
      })
      .map(card => ({
        card,
        displayInfo: resolveShop2CardDisplayInfo(card, nomenclatures, orders)
      }))
  }, [workCards, shop2TaskIdsSet, nomenclatures, orders])

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

  const toggleAccordion = (title) => {
    setOpenAccordions(prev => ({ ...prev, [title]: !prev[title] }))
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

    const updatedCal = { ...currentCal, [calendarKey]: newVal }
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

  const handleSaveUser = async (e) => {
    e.preventDefault()
    const cleanLogin = String(userForm.login || '').trim()
    const cleanPassword = String(userForm.password || '').trim()

    if (!cleanLogin) {
      alert('Введіть логін!')
      return
    }

    if (!userForm.id && !cleanPassword) {
      alert('Введіть пароль для нового співробітника!')
      return
    }

    setIsProcessing(true)
    const payload = {
      login: cleanLogin,
      password: cleanPassword,
      first_name: userForm.first_name || '',
      last_name: userForm.last_name || '',
      position: userForm.position || 'Фарбувальник',
      department: userForm.department || 'Цех №2',
      shift: userForm.shift || 'Без зміни',
      access_rights: userForm.access_rights
    }
    if (userForm.id) payload.id = userForm.id

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
        position: 'Фарбувальник',
        department: 'Цех №2',
        shift: 'Зміна 1',
        access_rights: { ...DEFAULT_SHOP2_ACCESS_RIGHTS }
      })
    }
  }

  const editUser = (user) => {
    setUserForm({
      ...user,
      password: '••••••••',
      department: user.department || 'Цех №2',
      access_rights: {
        ...DEFAULT_SHOP2_ACCESS_RIGHTS,
        ...(user.access_rights || {})
      }
    })
  }

  const handleResetPassword = async (user) => {
    const newPass = window.prompt(`Введіть новий пароль для @${user.login}:`, '123456')
    if (!newPass) return
    setIsProcessing(true)
    const { error } = await upsertUser({ ...user, password: newPass })
    setIsProcessing(false)
    if (error) {
      alert('Помилка оновлення пароля: ' + error.message)
    } else {
      alert('Пароль успішно змінено!')
    }
  }

  return {
    activeTab,
    setActiveTab,
    userSearch,
    setUserSearch,
    isProcessing,
    calendarSaving,
    currentYear,
    currentMonth,
    daysInMonth,
    monthNames,
    weekDayNames,
    handleMonthChange,
    openAccordions,
    toggleAccordion,
    handleToggleDayShift,
    categorizedCalendarUsers,
    todayShiftSummary,
    shop2Cards,
    shop2Users,
    filteredUsers,
    resolvedShop2Positions,
    userForm,
    setUserForm,
    handleSaveUser,
    editUser,
    handleResetPassword,
    formatUserName
  }
}

