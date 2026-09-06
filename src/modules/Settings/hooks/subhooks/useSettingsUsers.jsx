import React, { useState, useMemo, useEffect } from 'react'

export const moduleList = [
  { id: 'crm', label: 'CRM Воронка Лідів & Угод' },
  { id: 'crm_clients', label: 'База Клієнтів & Картки CRM' },
  { id: 'dashboard', label: 'Дашборд WIP' },
  { id: 'foreman_dashboard', label: 'ДАШБОРД 2.0' },
  { id: 'kanban', label: 'Задачі (Внутрішні)' },
  { id: 'chat', label: 'Чат (Внутрішній)' },
  { id: 'manager', label: 'Менеджер' },
  { id: 'master', label: 'Мастер (Цех)' },
  { id: 'warehouse', label: 'Склад Оперативний' },
  { id: 'warehouse_fgp', label: 'Склад Готової Продукції (СГП)' },
  { id: 'warehouse_boxes', label: 'Бокси фрез (СО)' },
  { id: 'cutter_restoration', label: 'Відновлення фрез' },
  { id: 'preparation_dashboard', label: 'Дашборд підготовки (TV)' },
  { id: 'engineer', label: 'Інженер' },
  { id: 'engineer_v2', label: 'Інженер ЧПК & BOM 2.0' },
  { id: 'director', label: 'Директор' },
  { id: 'foreman', label: 'Майстер дільниці' },
  { id: 'foreman2', label: 'Foreman 2.0' },
  { id: 'operator', label: 'Термінал оператора' },
  { id: 'prep_terminal', label: 'Термінал Підготовки' },
  { id: 'shop1', label: 'Цех №1 (Розкрій→Прийомка)' },
  { id: 'tumbling_terminal', label: 'Екран Галтовки' },
  { id: 'tumbling_dashboard', label: 'Дашборд Галтовки (TV)' },
  { id: 'reception_terminal', label: 'Екран Прийомки' },
  { id: 'sorting_terminal', label: 'Екран Сортування' },
  { id: 'pressing_terminal', label: 'Екран Пресування' },
  { id: 'painting_terminal', label: 'Екран Фарбування' },
  { id: 'shop1_foreman', label: 'Кабінет Нач. Цеху №1' },
  { id: 'shop2_card_gen', label: 'Цех №2 – Створення РК (Буфер)' },
  { id: 'shop2_terminal', label: 'Цех №2 · Термінал' },
  { id: 'packaging', label: 'Пакування' },
  { id: 'shipping', label: 'Логістика' },
  { id: 'supply', label: 'Склад Виробництва' },
  { id: 'procurement', label: 'Постачання (Закупівля)' },
  { id: 'economy', label: 'Економіка & Ціноутворення' },
  { id: 'nomenclature_v2', label: 'Номенклатура (Нова)' },
  { id: 'nomenclature', label: 'База номенклатур (Old)' },
  { id: 'machines', label: 'Налаштування станків' },
  { id: 'analytics', label: 'Аналітика' },
  { id: 'brak', label: 'ВКЯ (Контроль якості)' },
  { id: 'access', label: 'Система Доступу' },
  { id: 'reports', label: 'Звіти та Аналітика (1C)' },
  { id: 'settings', label: 'Система (Адмін)' }
]

export function useSettingsUsers({
  systemUsers,
  currentUser,
  upsertUser,
  deleteUser: _deleteUser,
  companyStructure,
  companyPositions,
  setActiveTab,
  AvatarImage
}) {
  // User Form State
  const [userForm, setUserForm] = useState({
    id: null,
    login: '',
    password: '',
    first_name: '',
    last_name: '',
    position: companyPositions?.[0]?.name || 'Оператор',
    department: companyStructure?.[0]?.name || 'Цех №1',
    shift: 'Без зміни',
    access_rights: {
      crm: true, crm_clients: true, dashboard: false, foreman_dashboard: false, manager: false, chat: false, master: false, warehouse: false, warehouse_fgp: false, warehouse_boxes: false, cutter_restoration: false, preparation_dashboard: false, engineer: false,
      director: false, foreman: false, foreman2: false, operator: true, shipping: false, 
      supply: false, procurement: false, nomenclature: false, nomenclature_v2: false, shop2: false, machines: false, settings: false, packaging: false, kanban: false, reports: false, tumbling_terminal: false, tumbling_dashboard: false, reception_terminal: false, sorting_terminal: false, painting_terminal: false, pressing_terminal: false
    }
  })

  // Filters for Dossier
  const [userSearch, setUserSearch] = useState('')
  const [filterDepartment, setFilterDepartment] = useState('all')
  const [filterPosition, setFilterPosition] = useState('all')
  const [filterShift, setFilterShift] = useState('all')
  const [filterOnlyOnline, setFilterOnlyOnline] = useState(false)
  const [showMobileUserForm, setShowMobileUserForm] = useState(false)

  const handleSaveUser = async (e) => {
    e.preventDefault()
    if (!userForm.login || (!userForm.id && !userForm.password)) return

    const cleanLogin = userForm.login.trim()
    const cleanPassword = userForm.password.trim()

    if (!userForm.id) {
      const loginExists = (systemUsers || []).some(u => u.login.toLowerCase().trim() === cleanLogin.toLowerCase())
      if (loginExists) {
        alert(`⚠️ Помилка: Користувач з логіном "${cleanLogin}" вже існує в системі!\nБудь ласка, вкажіть інший унікальний логін.`)
        return
      }
    } else {
      const loginConflict = (systemUsers || []).some(u => u.id !== userForm.id && u.login.toLowerCase().trim() === cleanLogin.toLowerCase())
      if (loginConflict) {
        alert(`⚠️ Помилка: Логін "${cleanLogin}" вже зайнятий іншим користувачем!\nБудь ласка, вкажіть інший унікальний логін.`)
        return
      }
    }

    const payload = {
      login: cleanLogin,
      password: cleanPassword,
      first_name: userForm.first_name || '',
      last_name: userForm.last_name || '',
      position: userForm.position,
      department: userForm.department,
      shift: userForm.shift || 'Без зміни',
      access_rights: userForm.access_rights,
      avatar: userForm.avatar || null
    }

    if (userForm.id) {
      payload.id = userForm.id
    }
    
    const { error } = await upsertUser(payload)
    
    if (error) {
      alert(`❌ Помилка збереження: ${error.message || 'Конфлікт даних в базі'}`)
      return
    }

    setUserForm({
      id: null, login: '', password: '', first_name: '', last_name: '', 
      position: companyPositions?.[0]?.name || 'Оператор', department: companyStructure?.[0]?.name || 'Цех №1', shift: 'Без зміни',
      access_rights: { crm: true, crm_clients: true, dashboard: true, foreman_dashboard: false, manager: false, chat: false, master: false, warehouse: false, warehouse_boxes: false, cutter_restoration: false, preparation_dashboard: false, engineer: false, director: false, foreman: false, foreman2: false, operator: true, prep_terminal: false, shipping: false, supply: false, procurement: false, nomenclature: false, nomenclature_v2: false, shop2: false, machines: false, settings: false, kanban: false, reports: false, tumbling_terminal: false, tumbling_dashboard: false, reception_terminal: false, sorting_terminal: false, painting_terminal: false, pressing_terminal: false }
    })
    setShowMobileUserForm(false)
  }

  const editUser = (user) => {
    const rights = user.access_rights || {}
    const filledRights = {}
    const isAdminUser = (user.position || '').toLowerCase().includes('адмін') || user.role === 'admin' || user.login === 'admin@workshop.local'
    moduleList.forEach(m => {
      const val = rights[m.id]
      if (m.id === 'settings' && isAdminUser) {
        filledRights[m.id] = rights[m.id] !== false
      } else {
        filledRights[m.id] = val === true || val === 'true' || val === 1
      }
    })
    setUserForm({ 
      ...user, 
      password: '••••••••',
      access_rights: filledRights
    })
    if (setActiveTab) setActiveTab('users')
    setShowMobileUserForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleRight = (key) => {
    setUserForm(prev => ({
      ...prev,
      access_rights: {
        ...prev.access_rights,
        [key]: !prev.access_rights[key]
      }
    }))
  }

  // Live ticker for online presence & relative time (updates every 15 seconds)
  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        setNowTick(Date.now())
      }
    }, 15000)
    return () => clearInterval(interval)
  }, [])

  const filteredUsers = useMemo(() => {
    const list = (systemUsers || []).filter(u => {
      const matchSearch = 
        u.login.toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.first_name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.last_name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.position || '').toLowerCase().includes(userSearch.toLowerCase())

      const matchDept = filterDepartment === 'all' || u.department === filterDepartment
      const matchPos = filterPosition === 'all' || u.position === filterPosition
      const matchShift = filterShift === 'all' || u.shift === filterShift

      const isOnline = u.last_seen && (nowTick - new Date(u.last_seen).getTime() < 120000)
      const matchOnline = !filterOnlyOnline || isOnline

      return matchSearch && matchDept && matchPos && matchShift && matchOnline
    })

    return [...list].sort((a, b) => {
      const aOnline = a.last_seen && (nowTick - new Date(a.last_seen).getTime() < 120000)
      const bOnline = b.last_seen && (nowTick - new Date(b.last_seen).getTime() < 120000)
      
      if (aOnline && !bOnline) return -1
      if (!aOnline && bOnline) return 1
      
      const aName = `${a.last_name || ''} ${a.first_name || ''} ${a.login || ''}`.trim()
      const bName = `${b.last_name || ''} ${b.first_name || ''} ${b.login || ''}`.trim()
      return aName.localeCompare(bName, 'uk')
    })
  }, [systemUsers, userSearch, filterDepartment, filterPosition, filterShift, filterOnlyOnline, nowTick])

  const distinctPositions = useMemo(() => {
    const roles = (systemUsers || []).map(u => u.position).filter(Boolean)
    return Array.from(new Set(roles))
  }, [systemUsers])

  const availableFilterPositions = useMemo(() => {
    if (filterDepartment === 'all') return companyPositions || []
    const deptNode = (companyStructure || []).find(d => d.name === filterDepartment)
    if (!deptNode) return companyPositions || []
    return (companyPositions || []).filter(p => !p.department_id || p.department_id === deptNode.id)
  }, [companyPositions, companyStructure, filterDepartment])

  const availableFormPositions = useMemo(() => {
    if (!userForm.department) return companyPositions || []
    const deptNode = (companyStructure || []).find(d => d.name === userForm.department)
    if (!deptNode) return companyPositions || []
    return (companyPositions || []).filter(p => !p.department_id || p.department_id === deptNode.id)
  }, [companyPositions, companyStructure, userForm.department])

  // Get Initials for Avatar
  const getInitials = (user) => {
    const f = (user.first_name || '').charAt(0).toUpperCase()
    const l = (user.last_name || '').charAt(0).toUpperCase()
    return f || l ? `${f}${l}` : (user.login || '??').substring(0, 2).toUpperCase()
  }

  const renderUserAvatar = (user) => {
    const initials = getInitials(user)
    
    // Check if avatar is a valid image source (data URI, HTTP(S) URL, or relative image path)
    const isImageSrc = user?.avatar && typeof user.avatar === 'string' && (
      user.avatar.startsWith('data:image/') || 
      user.avatar.startsWith('http://') || 
      user.avatar.startsWith('https://') || 
      user.avatar.startsWith('blob:') ||
      user.avatar.startsWith('/') ||
      /\.(png|jpg|jpeg|svg|webp|gif)$/i.test(user.avatar)
    ) && !user.avatar.includes('@') // exclude emails/logins like admin@workshop.loc

    if (isImageSrc && AvatarImage) {
      return (
        <AvatarImage 
          src={user.avatar} 
          initials={initials} 
          position={user.position} 
        />
      )
    }

    const getGradient = (name) => {
      switch (name) {
        case 'purple': return 'linear-gradient(135deg, #a855f7, #6366f1)';
        case 'blue': return 'linear-gradient(135deg, #3b82f6, #06b6d4)';
        case 'emerald': return 'linear-gradient(135deg, #10b981, #059669)';
        case 'ruby': return 'linear-gradient(135deg, #f43f5e, #be123c)';
        case 'orange': return 'linear-gradient(135deg, #ff9000, #ff5500)';
        default: return null;
      }
    }
    const getDefaultGradient = (position) => {
      const posLower = (position || '').toLowerCase()
      if (posLower.includes('адмін') || posLower.includes('admin')) return 'linear-gradient(135deg, #ff9000, #ea580c)'
      if (posLower.includes('директор') || posLower.includes('керівник') || posLower.includes('начальник') || posLower.includes('майстер')) return 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
      return 'linear-gradient(135deg, #64748b, #334155)'
    }
    const grad = getGradient(user.avatar) || getDefaultGradient(user.position)
    return (
      <div 
        className="user-avatar-badge"
        style={{ 
          width: '46px', 
          height: '46px', 
          borderRadius: '14px', 
          background: grad, 
          border: user.position === 'Адмін' ? '1px solid rgba(255,144,0,0.3)' : '1px solid rgba(255,255,255,0.08)',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          fontWeight: 900,
          fontSize: '0.9rem',
          color: '#ffffff',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          flexShrink: 0
        }}
      >
        {initials}
      </div>
    )
  }

  // Role pill background and text color
  const getRoleStyle = (position) => {
    switch (position) {
      case 'Адмін': return { background: 'rgba(255,144,0,0.15)', border: '1px solid #ff9000', color: '#ff9000' }
      case 'Директор виробництва':
      case 'Начальник цеху': return { background: 'rgba(168,85,247,0.15)', border: '1px solid #a855f7', color: '#c084fc' }
      case 'Майстер цеху':
      case 'Майстер дільниці': return { background: 'rgba(59,130,246,0.15)', border: '1px solid #3b82f6', color: '#60a5fa' }
      case 'Працівник складу': return { background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981', color: '#34d399' }
      case 'Контроль браку': return { background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#f87171' }
      default: return { background: 'rgba(255,255,255,0.05)', border: '1px solid #222', color: '#aaa' }
    }
  }

  const isAdmin = currentUser?.position === 'Адмін'

  return {
    userForm,
    setUserForm,
    userSearch,
    setUserSearch,
    filterDepartment,
    setFilterDepartment,
    filterPosition,
    setFilterPosition,
    filterShift,
    setFilterShift,
    filterOnlyOnline,
    setFilterOnlyOnline,
    showMobileUserForm,
    setShowMobileUserForm,
    handleSaveUser,
    editUser,
    toggleRight,
    filteredUsers,
    distinctPositions,
    availableFilterPositions,
    availableFormPositions,
    moduleList,
    renderUserAvatar,
    getRoleStyle,
    isAdmin,
    nowTick
  }
}
