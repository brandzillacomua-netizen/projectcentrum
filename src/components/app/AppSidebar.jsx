import React, { useState, useMemo, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  MessageCircle,
  Bell,
  Sun,
  Moon,
  Search,
  X,
  LayoutDashboard,
  Briefcase,
  Settings,
  LogOut
} from 'lucide-react'
import { IconSO } from '../WarehouseIcons'
import { getAvailableModules } from '../../config/moduleRegistry'
import { useMES } from '../../MESContext'

export const AppSidebar = ({ isCollapsed, setIsCollapsed, chatUnreadCount, isMobileOpen, setIsMobileOpen, onOpenProfile, onOpenNotifications, unreadNotifCount = 0 }) => {
  const { currentUser, logout: logoutUser, theme, toggleTheme } = useMES()
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsedGroups, setCollapsedGroups] = useState({ crm: false, erp: false, mes: false })
  const [sidebarFilter, setSidebarFilter] = useState('')

  const modules = useMemo(() => {
    return getAvailableModules(currentUser, 0, chatUnreadCount)
  }, [currentUser, chatUnreadCount])

  // Collapse sidebar ONLY when clicking on empty space (ignoring buttons, links, cards & inputs)
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isCollapsed) return
      const sidebarEl = document.querySelector('.app-sidebar')
      if (!sidebarEl) return
      
      // If click is inside sidebar, do nothing
      if (sidebarEl.contains(e.target)) return

      // If click is on ANY button, link, input, card, or interactive element on the page, DO NOT collapse (let the button click work directly on 1st click!)
      const isInteractive = e.target.closest(
        'button, a, input, select, textarea, [role="button"], .portal-card-v2, .glass-panel, .glass-modal, [role="dialog"], .mobile-menu-toggle-btn, .sidebar-toggle-edge-btn, .card, .btn'
      );
      if (isInteractive) return

      // Only collapse when clicking on plain empty space / page background
      setIsCollapsed(true)
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [isCollapsed, setIsCollapsed])

  const toggleGroup = (pillar) => {
    setCollapsedGroups(prev => ({ ...prev, [pillar]: !prev[pillar] }))
  }

  const filteredModules = useMemo(() => {
    if (!sidebarFilter.trim()) return modules;
    const query = sidebarFilter.toLowerCase();
    return modules.filter(m => m.title.toLowerCase().includes(query) || m.desc.toLowerCase().includes(query));
  }, [modules, sidebarFilter]);

  const crmModules = filteredModules.filter(m => m.pillar === 'crm')
  const erpModules = filteredModules.filter(m => m.pillar === 'erp')
  const mesModules = filteredModules.filter(m => m.pillar === 'mes')

  return (
    <>
      {/* Mobile Sticky Website Header Bar */}
      <header className="mobile-app-topbar no-print">
        {/* Left: Logo 🦊 + Brand + Menu Toggle Arrow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="mobile-menu-toggle-btn"
            title={isCollapsed ? "Відкрити меню" : "Згорнути меню"}
          >
            <img src="/kulytsya.png" alt="Logo" style={{ height: '26px', filter: 'drop-shadow(0 0 6px rgba(255,144,0,0.5))' }} />
            {isCollapsed ? <ChevronRight size={16} color="#ff9000" /> : <ChevronLeft size={16} color="#ff9000" />}
          </button>
          
          <Link to="/" className="sidebar-brand-link" onClick={() => setIsCollapsed(true)} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 950, color: 'var(--text)', letterSpacing: '-0.3px' }}>
              CENTRUM <span style={{ color: '#ff9000' }}>3-IN-1</span>
            </span>
          </Link>
        </div>

        {/* Right: Quick Action Icons (Chat 💬, Notifications 🔔, Theme 🌙/☀️) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Chat Button */}
          {(currentUser?.access_rights?.chat === true || currentUser?.access_rights?.chat === 'true' || currentUser?.access_rights?.chat === 1) && (
            <Link
              to="/chat"
              onClick={() => setIsCollapsed(true)}
              className="mobile-topbar-icon-btn"
              title="Чат & Комунікація"
              style={{ position: 'relative' }}
            >
              <MessageCircle size={18} color="#ff9000" />
              {chatUnreadCount > 0 && (
                <span className="mobile-unread-badge">
                  {chatUnreadCount}
                </span>
              )}
            </Link>
          )}

          {/* Notifications Button */}
          <Link
            to="/notifications"
            onClick={() => setIsCollapsed(true)}
            className="mobile-topbar-icon-btn"
            title="Центр сповіщень"
            style={{ position: 'relative' }}
          >
            <Bell size={18} color={unreadNotifCount > 0 ? "#ff9000" : "var(--text-muted)"} />
            {unreadNotifCount > 0 && (
              <span className="mobile-unread-badge" style={{ background: '#ef4444' }}>
                {unreadNotifCount}
              </span>
            )}
          </Link>

          {/* Theme Switcher */}
          <button
            onClick={toggleTheme}
            className="mobile-topbar-icon-btn"
            title="Змінити тему"
          >
            {theme === 'light' ? <Sun size={18} color="#eab308" /> : <Moon size={18} color="#a78bfa" />}
          </button>
        </div>
      </header>

      {!isCollapsed && (
        <div
          className="mobile-backdrop-overlay"
          onClick={() => setIsCollapsed(true)}
        />
      )}

      <aside
        className={`app-sidebar no-print ${isCollapsed ? 'collapsed' : ''}`}
        onClick={() => {
          if (isCollapsed) setIsCollapsed(false);
        }}
        style={{
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 99999,
          overflow: 'visible',
          cursor: isCollapsed ? 'pointer' : 'default'
        }}
      >
        {/* Brand Header */}
        <div className="sidebar-header" style={{ position: 'relative', zIndex: 10000, overflow: 'visible', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 12px 18px', minHeight: '60px', width: '100%', boxSizing: 'border-box', flexShrink: 0 }}>
          <Link to="/" className="sidebar-brand-link" onClick={() => setIsMobileOpen(false)} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text)', opacity: 1, visibility: 'visible' }}>
            <img src="/kulytsya.png" alt="Logo" style={{ width: '34px', height: '34px', objectFit: 'contain', filter: 'drop-shadow(0 0 10px rgba(255,144,0,0.4))', flexShrink: 0, display: 'block' }} />
            {!isCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: '1.05rem', fontWeight: 950, color: 'var(--text)', letterSpacing: '-0.5px', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                  CENTRUM <span style={{ color: '#ff9000' }}>3-IN-1</span>
                </div>
                <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', fontWeight: 800, marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                  Enterprise Suite v2.4
                </div>
              </div>
            )}
          </Link>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="sidebar-toggle-edge-btn"
            title={isCollapsed ? "Розгорнути меню" : "Згорнути меню"}
          >
            {isCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* Quick Action Toolbar Below Logo */}
        {!isCollapsed && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px 12px 14px',
            borderBottom: '1px solid var(--glass-border, rgba(255, 255, 255, 0.05))',
            flexShrink: 0
          }}>
            {(currentUser?.access_rights?.chat === true || currentUser?.access_rights?.chat === 'true' || currentUser?.access_rights?.chat === 1) && (
              <Link
                to="/chat"
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: '12px',
                  background: chatUnreadCount > 0 ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                  border: chatUnreadCount > 0 ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid var(--glass-border, rgba(255, 255, 255, 0.08))',
                  color: chatUnreadCount > 0 ? '#6366f1' : 'var(--text)',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
                title="Чат & Комунікація"
              >
                <MessageCircle size={15} color={chatUnreadCount > 0 ? "#6366f1" : "var(--text-muted)"} />
                <span>Чат</span>
                {chatUnreadCount > 0 && (
                  <span style={{
                    background: '#6366f1',
                    color: '#ffffff',
                    fontSize: '0.68rem',
                    fontWeight: 900,
                    padding: '2px 7px',
                    borderRadius: '10px',
                    lineHeight: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(99, 102, 241, 0.4)'
                  }}>
                    {chatUnreadCount}
                  </span>
                )}
              </Link>
            )}

            <Link
              to="/notifications"
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: '12px',
                background: unreadNotifCount > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                border: unreadNotifCount > 0 ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--glass-border, rgba(255, 255, 255, 0.08))',
                color: unreadNotifCount > 0 ? '#ef4444' : 'var(--text)',
                fontSize: '0.82rem',
                fontWeight: 800,
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
              title="Центр сповіщень"
            >
              <Bell size={15} color={unreadNotifCount > 0 ? "#ef4444" : "var(--text-muted)"} />
              <span>Сповіщення</span>
              {unreadNotifCount > 0 && (
                <span style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  fontSize: '0.68rem',
                  fontWeight: 900,
                  padding: '2px 7px',
                  borderRadius: '10px',
                  lineHeight: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)'
                }}>
                  {unreadNotifCount}
                </span>
              )}
            </Link>
          </div>
        )}

        {/* Quick Filter Search in Sidebar */}
        {!isCollapsed && (
          <div className="sidebar-search-box">
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', color: '#64748b' }} />
              <input
                type="text"
                placeholder="Швидкий фільтр..."
                value={sidebarFilter}
                onChange={(e) => setSidebarFilter(e.target.value)}
                className="sidebar-search-input"
              />
              {sidebarFilter && (
                <button
                  onClick={() => setSidebarFilter('')}
                  style={{ position: 'absolute', right: '8px', background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex' }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <div className="sidebar-nav-container">
          {/* Main Dashboard Link */}
          {(currentUser?.access_rights?.dashboard === true || currentUser?.access_rights?.dashboard === 'true' || currentUser?.access_rights?.dashboard === 1) && (
            <Link
              to="/"
              onClick={() => {
                setIsMobileOpen(false)
                if (isCollapsed) setIsCollapsed(false)
              }}
              className={`sidebar-link-item ${location.pathname === '/' ? 'active' : ''}`}
            >
              <LayoutDashboard size={18} color="#ff9000" />
              {!isCollapsed && <span>Головний Дашборд</span>}
            </Link>
          )}

          {/* 🟣 CRM Pillar Group */}
          {crmModules.length > 0 && (
            <div>
              {!isCollapsed && (
                <div className="sidebar-group-header" onClick={() => toggleGroup('crm')}>
                  <span className="sidebar-group-title">
                    <Briefcase size={12} color="#6366f1" /> CRM Продажі ({crmModules.length})
                  </span>
                  {collapsedGroups.crm ? <ChevronRight size={12} color="#64748b" /> : <ChevronDown size={12} color="#64748b" />}
                </div>
              )}
              {(!collapsedGroups.crm || isCollapsed) && crmModules.map(mod => {
                const isActive = location.pathname === mod.path
                return (
                  <Link
                    key={mod.id}
                    to={mod.path}
                    onClick={() => {
                      setIsMobileOpen(false)
                      if (isCollapsed) setIsCollapsed(false)
                    }}
                    className={`sidebar-link-item crm-active ${isActive ? 'active' : ''}`}
                    title={isCollapsed ? mod.title : ''}
                  >
                    <span style={{ color: mod.color, display: 'flex', alignItems: 'center' }}>{mod.icon}</span>
                    {!isCollapsed && (
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mod.title}</span>
                        {mod.badge > 0 && <span className="badge-count" style={{ fontSize: '0.65rem' }}>{mod.badge}</span>}
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          )}

          {/* 🟢 ERP Pillar Group */}
          {erpModules.length > 0 && (
            <div>
              {!isCollapsed && (
                <div className="sidebar-group-header" onClick={() => toggleGroup('erp')}>
                  <span className="sidebar-group-title">
                    <IconSO size={14} color="#10b981" /> ERP Ресурси ({erpModules.length})
                  </span>
                  {collapsedGroups.erp ? <ChevronRight size={12} color="#64748b" /> : <ChevronDown size={12} color="#64748b" />}
                </div>
              )}
              {(!collapsedGroups.erp || isCollapsed) && erpModules.map(mod => {
                const isActive = location.pathname === mod.path
                return (
                  <Link
                    key={mod.id}
                    to={mod.path}
                    onClick={() => {
                      setIsMobileOpen(false)
                      if (isCollapsed) setIsCollapsed(false)
                    }}
                    className={`sidebar-link-item erp-active ${isActive ? 'active' : ''}`}
                    title={isCollapsed ? mod.title : ''}
                  >
                    <span style={{ color: mod.color, display: 'flex', alignItems: 'center' }}>{mod.icon}</span>
                    {!isCollapsed && (
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mod.title}</span>
                        {mod.badge > 0 && <span className="badge-count" style={{ fontSize: '0.65rem' }}>{mod.badge}</span>}
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          )}

          {/* 🟠 MES Pillar Group */}
          {mesModules.length > 0 && (
            <div>
              {!isCollapsed && (
                <div className="sidebar-group-header" onClick={() => toggleGroup('mes')}>
                  <span className="sidebar-group-title">
                    <Settings size={12} color="#ff9000" /> MES Виробництво ({mesModules.length})
                  </span>
                  {collapsedGroups.mes ? <ChevronRight size={12} color="#64748b" /> : <ChevronDown size={12} color="#64748b" />}
                </div>
              )}
              {(!collapsedGroups.mes || isCollapsed) && mesModules.map(mod => {
                const isActive = location.pathname === mod.path
                return (
                  <Link
                    key={mod.id}
                    to={mod.path}
                    onClick={() => {
                      setIsMobileOpen(false)
                      if (isCollapsed) setIsCollapsed(false)
                    }}
                    className={`sidebar-link-item mes-active ${isActive ? 'active' : ''}`}
                    title={isCollapsed ? mod.title : ''}
                  >
                    <span style={{ color: mod.color, display: 'flex', alignItems: 'center' }}>{mod.icon}</span>
                    {!isCollapsed && (
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mod.title}</span>
                        {mod.badge > 0 && <span className="badge-count" style={{ fontSize: '0.65rem' }}>{mod.badge}</span>}
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* User Profile Footer at Sidebar Bottom */}
        <div className="sidebar-footer">
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, cursor: 'pointer' }}
            onClick={() => navigate('/user-settings?tab=profile')}
            title="Налаштування профілю"
          >
            {(() => {
              let userAvatar = currentUser?.avatar || '';
              const cacheKey = currentUser?.id ? `MES_AVATAR_CACHE_${currentUser.id}` : null;
              if (userAvatar && cacheKey) {
                try { localStorage.setItem(cacheKey, userAvatar); } catch(e) {}
              } else if (!userAvatar && cacheKey) {
                userAvatar = localStorage.getItem(cacheKey) || '';
              }
              const isImage = userAvatar.startsWith('data:image/') || userAvatar.startsWith('http');
              const avatarBg = isImage ? 'transparent' : userAvatar.startsWith('#') ? `linear-gradient(135deg, ${userAvatar}, rgba(0,0,0,0.4))` : 'linear-gradient(135deg, #ff9000, #e65100)';
              return (
                <div style={{
                  width: '34px', height: '34px', borderRadius: '10px',
                  background: avatarBg,
                  color: '#fff', fontWeight: 950, fontSize: '0.85rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  overflow: 'hidden',
                  border: userAvatar.startsWith('#') ? `1px solid ${userAvatar}` : 'none'
                }}>
                  {isImage ? (
                    <img src={userAvatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    (currentUser?.first_name || currentUser?.login || 'U').charAt(0).toUpperCase()
                  )}
                </div>
              );
            })()}
            {!isCollapsed && (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentUser?.first_name ? `${currentUser.first_name} ${currentUser.last_name || ''}` : currentUser?.login}
                </div>
                <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentUser?.position || 'Спеціаліст'}
                </div>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
              <button
                onClick={() => navigate('/user-settings')}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Налаштування"
              >
                <Settings size={17} />
              </button>
              <button
                onClick={toggleTheme}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Переключити тему"
              >
                {theme === 'light' ? <Moon size={17} color="#6366f1" /> : <Sun size={17} color="#eab308" />}
              </button>
              <button
                onClick={logoutUser}
                style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Вийти з системи"
              >
                <LogOut size={17} />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
