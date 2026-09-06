import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  ChevronRight,
  X,
  Bell,
  ChevronDown,
  Sun,
  Moon,
  MessagesSquare,
  Settings
} from 'lucide-react';
import { getAvailableModules, CATEGORY_MAP, CATEGORIES } from '../../config/moduleRegistry';
import { useMES } from '../../MESContext';
import { useNetworkResilience } from '../../hooks/useNetworkResilience';
import { processOfflineMutation } from '../../services/offlineProcessor';
import { renderAvatar } from './GlobalUserNav/NavAvatar.jsx';
import { useNavNotifications } from './GlobalUserNav/useNavNotifications.jsx';
import { NavNotificationFeed } from './GlobalUserNav/NavNotificationFeed.jsx';
import { NavSettingsPanel } from './GlobalUserNav/NavSettingsPanel.jsx';

function OfflineResilienceBadge() {
  const { isOnline, queueCount, isSyncing } = useNetworkResilience(processOfflineMutation);

  if (isOnline && queueCount === 0 && !isSyncing) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      background: !isOnline ? 'rgba(239, 68, 68, 0.9)' : 'rgba(245, 158, 11, 0.9)',
      color: '#ffffff',
      padding: '4px 10px',
      borderRadius: '20px',
      fontSize: '0.65rem',
      fontWeight: 900,
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      backdropFilter: 'blur(8px)'
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />
      {!isOnline
        ? 'Слабкий зв\'язок (Офлайн)'
        : isSyncing
        ? `Синхронізація... (${queueCount})`
        : `Збережено очікує (${queueCount})`}
    </div>
  );
}

export const GlobalUserNav = ({ chatUnreadCount = 0 }) => {
  const {
    currentUser,
    managementTasks,
    requests,
    workCards,
    purchaseRequests,
    receptionDocs,
    nomenclatures,
    machineCalls,
    machines,
    tasks,
    orders,
    bomItems,
    workCardHistory,
    fetchData,
    supabase,
    upsertUser,
    theme,
    toggleTheme
  } = useMES();

  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSubPanel, setActiveSubPanel] = useState(null); // 'notifications', 'notif_settings' or null

  const [notifSettings, setNotifSettings] = useState({
    new_order: true,
    material_request: true,
    packaging_request: true,
    ready_to_ship: true,
    supply_request: true,
    machine_call: true,
    shortage: true,
    kanban: true,
    task_completed: true
  });

  const [openCategories, setOpenCategories] = useState({
    crm: true,
    erp: true,
    mes: true
  });

  // Sync settings when currentUser loads
  useEffect(() => {
    if (currentUser?.id) {
      const local = localStorage.getItem(`notification_settings_${currentUser.id}`);
      let parsed = null;
      if (local) {
        try { parsed = JSON.parse(local); } catch (e) { }
      }

      const dbSettings = currentUser.notification_settings;
      if (dbSettings) {
        setNotifSettings(dbSettings);
      } else if (parsed) {
        setNotifSettings(parsed);
      }
    }
  }, [currentUser]);

  const updateNotifSetting = async (key, val) => {
    const updated = { ...currentUser?.notification_settings, ...notifSettings, [key]: val };
    setNotifSettings(updated);
    if (currentUser?.id) {
      localStorage.setItem(`notification_settings_${currentUser.id}`, JSON.stringify(updated));
      try {
        const { error } = await supabase
          .from('system_users')
          .update({ notification_settings: updated })
          .eq('id', currentUser.id);
        if (error) {
          console.warn('DB update for notification_settings failed:', error.message);
        }
      } catch (e) {
        console.warn('DB update error:', e);
      }
    }
  };

  const handleCloseMenu = () => {
    setMenuOpen(false);
    setActiveSubPanel(null);
  };

  // Open notification panel via mobile topbar bell (centrum:openNotifications event)
  useEffect(() => {
    const handler = () => { setMenuOpen(true); setActiveSubPanel('notifications'); };
    window.addEventListener('centrum:openNotifications', handler);
    return () => window.removeEventListener('centrum:openNotifications', handler);
  }, []);

  // Auto-close menu on route navigation
  useEffect(() => {
    setMenuOpen(false);
    setActiveSubPanel(null);
  }, [location.pathname]);

  // Notifications custom hook
  const {
    notifications,
    unreadCount,
    readIds,
    handleNotificationClick,
    handleMarkAllAsRead,
    formatRelativeTime
  } = useNavNotifications({
    currentUser,
    isNotificationPanelOpen: activeSubPanel === 'notifications',
    notifSettings,
    contextData: {
      managementTasks,
      requests,
      workCards,
      purchaseRequests,
      receptionDocs,
      nomenclatures,
      machineCalls,
      machines,
      tasks,
      orders,
      bomItems,
      workCardHistory,
      fetchData
    },
    supabase,
    onCloseMenu: handleCloseMenu
  });

  if (location.pathname === '/login') return null;
  if (!currentUser) return null;

  const isAdmin = currentUser.position === 'Адмін' || currentUser.role === 'admin';
  if (isAdmin) return null;

  const myPendingTasksCount = (managementTasks || []).filter(t =>
    t.status !== 'done' &&
    (t.assigned_to === currentUser.login || t.created_by === currentUser.login)
  ).length;

  const modules = getAvailableModules(currentUser, myPendingTasksCount, chatUnreadCount);
  const menuBadgeCount = unreadCount + chatUnreadCount;

  return (
    <>
      <style>{`
        /* Hide all navigation back buttons for non-admins (except main sidebar logo) */
        a[href="/"]:not(.sidebar-brand-link),
        .back-link,
        .back-btn-modern,
        .nav-back-link,
        .nav-back-btn,
        .btn-back,
        .btn-back-director,
        .cr-icon-button {
          display: none !important;
        }

        /* Hide adjacent vertical dividers (separators) next to back buttons */
        a[href="/"]:not(.sidebar-brand-link) + div {
          display: none !important;
        }

        /* Expand left padding of all top headers, nav bars, and back bars to make space for the fixed hamburger menu */
        nav,
        header,
        .module-nav,
        .terminal-nav,
        .glass-nav,
        .cr-header,
        .tp-header,
        .crm-header,
        .client-detail-top-bar,
        .page-top-bar,
        .page-header,
        .dashboard-header,
        .shipping-header,
        .packaging-header,
        .main-header,
        .top-bar-nav {
          padding-left: 75px !important;
        }

        @media (max-width: 640px) {
          nav,
          header,
          .module-nav,
          .terminal-nav,
          .glass-nav,
          .tp-header,
          .crm-header,
          .client-detail-top-bar,
          .page-top-bar,
          .page-header,
          .dashboard-header,
          .shipping-header,
          .packaging-header,
          .main-header,
          .top-bar-nav {
            padding-left: 70px !important;
          }
        }

        /* Sidebar backdrop overlay */
        .sidebar-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(8px);
          z-index: 99999;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s ease-out;
        }
        .sidebar-backdrop.open {
          opacity: 1;
          pointer-events: auto;
          transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* Sidebar drawer */
        .sidebar-drawer {
          position: fixed;
          top: 0;
          bottom: 0;
          left: 0;
          width: 320px;
          background: rgba(8, 8, 8, 0.95);
          backdrop-filter: blur(25px);
          border-right: 1px solid rgba(255, 255, 255, 0.06);
          box-shadow: 25px 0 80px rgba(0, 0, 0, 0.9);
          z-index: 100000;
          display: flex;
          flex-direction: column;
          transform: translateX(-100%);
          transition: transform 0.12s ease-out;
        }
        .sidebar-drawer.open {
          transform: translateX(0);
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* Sidebar scrollable links container */
        .sidebar-links-container {
          flex: 1;
          overflow-y: auto;
          padding: 15px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .sidebar-links-container::-webkit-scrollbar {
          width: 4px;
        }
        .sidebar-links-container::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
        }

        /* Sidebar navigation link styling */
        .sidebar-link {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 16px;
          color: #94a3b8;
          text-decoration: none;
          border-radius: 14px;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid transparent;
        }
        .sidebar-link:hover {
          background: rgba(255, 255, 255, 0.03);
          color: #fff;
          border-color: rgba(255, 255, 255, 0.02);
          transform: translateX(3px);
        }
        .sidebar-link.active {
          background: rgba(255, 144, 0, 0.08);
          color: #ff9000;
          border-color: rgba(255, 144, 0, 0.18);
        }

        /* Technical support banner */
        .support-banner {
          background: linear-gradient(135deg, rgba(20, 20, 20, 0.5) 0%, rgba(10, 10, 10, 0.7) 100%);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 14px;
          margin: 15px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .support-banner::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(255, 144, 0, 0.03) 0%, transparent 70%);
          pointer-events: none;
        }
        @keyframes badgePulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); box-shadow: 0 0 10px rgba(239, 68, 68, 0.8); }
          100% { transform: scale(1); }
        }
        .notif-badge-pulse {
          animation: badgePulse 2s infinite ease-in-out;
        }

        /* Landscape orientation / small height responsiveness */
        @media (max-height: 480px) and (orientation: landscape) {
          .sidebar-drawer {
            width: 520px !important;
            max-width: 90vw !important;
          }
          .sidebar-drawer > div {
            flex-direction: row !important;
            flex-wrap: wrap !important;
          }
          .sidebar-drawer > div > div:nth-child(1) {
            width: 100% !important;
            padding: 12px 20px !important;
          }
          .sidebar-drawer > div > div:nth-child(2) {
            width: 50% !important;
            padding: 8px 20px !important;
            border-bottom: 1px solid rgba(255,255,255,0.04) !important;
          }
          .sidebar-drawer > div > div:nth-child(3) {
            width: 50% !important;
            border-bottom: 1px solid rgba(255,255,255,0.04) !important;
          }
          .sidebar-drawer > div > div:nth-child(3) > div {
            padding: 8px 20px !important;
          }
          .sidebar-links-container {
            width: 55% !important;
            flex: none !important;
            height: calc(100vh - 120px) !important;
            padding: 10px !important;
            border-right: 1px solid rgba(255,255,255,0.04) !important;
          }
          .sidebar-drawer > div > div:nth-child(5) {
            width: 45% !important;
            height: calc(100vh - 120px) !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            padding: 15px !important;
            border-top: none !important;
          }
          .sidebar-drawer .support-banner {
            margin: 0 0 10px 0 !important;
            padding: 10px !important;
          }
          .sidebar-drawer .support-banner a {
            font-size: 0.9rem !important;
          }
        }
      `}</style>

      {/* Floating Menu Toggle Button */}
      <div className="no-print floating-hamburger-wrapper" style={{ position: 'fixed', top: '15px', left: '20px', zIndex: 99998, display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          className="floating-hamburger-btn"
          onClick={() => setMenuOpen(true)}
          aria-label="Всі розділи та меню"
          title="Відкрити меню навігації"
        >
          <Menu size={22} strokeWidth={2.5} />
          {menuBadgeCount > 0 && (
            <span className="notif-badge-pulse floating-hamburger-badge">
              {menuBadgeCount}
            </span>
          )}
        </button>
        <OfflineResilienceBadge />
      </div>

      {/* Slide-out Sidebar Overlay */}
      <div className={`sidebar-backdrop ${menuOpen ? 'open' : ''}`} onClick={handleCloseMenu} />

      {/* Drawer Panel */}
      <div className={`sidebar-drawer ${menuOpen ? 'open' : ''}`} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'fixed' }}>

        {/* Main Content Pane */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          width: '100%',
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease',
          transform: activeSubPanel ? 'translateX(-15%)' : 'translateX(0)',
          opacity: activeSubPanel ? 0.3 : 1,
          pointerEvents: activeSubPanel ? 'none' : 'auto'
        }}>
          {/* Header section with Logo and Close button */}
          <div className="sidebar-header-bar" style={{ padding: '24px 20px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src="/kulytsya.png" alt="Logo" style={{ height: '36px', filter: 'drop-shadow(0 0 10px rgba(255,144,0,0.3))' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '1.05rem', fontWeight: 950, color: '#fff', letterSpacing: '-0.5px' }}>
                  CRM <span style={{ color: '#ff9000' }}>КУЛИЦЯ</span>
                </span>
                <span style={{ fontSize: '0.55rem', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', marginTop: '1px' }}>
                  MES SYSTEM v1.0
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={toggleTheme}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: theme === 'light' ? '#eab308' : '#a78bfa',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px',
                  borderRadius: '8px',
                  transition: 'all 0.2s ease'
                }}
                title="Перемикання теми"
              >
                {theme === 'light' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button
                onClick={handleCloseMenu}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#555',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px',
                  borderRadius: '8px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = '#555'}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* User Mini Profile */}
          <div className="user-profile-bar" style={{
            padding: '16px 20px',
            background: 'rgba(255,255,255,0.01)',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {renderAvatar(
                currentUser?.avatar || currentUser?.notification_settings?.avatar,
                (currentUser?.first_name?.[0] || '') + (currentUser?.last_name?.[0] || ''),
                '38px',
                '0.85rem'
              )}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fff' }}>
                  {currentUser?.first_name} {currentUser?.last_name}
                </span>
                <span style={{ fontSize: '0.62rem', color: '#555', fontWeight: 900, textTransform: 'uppercase', marginTop: '2px' }}>
                  {currentUser?.position || 'Співробітник'}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <button
                onClick={() => setActiveSubPanel('notif_settings')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#555',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px',
                  borderRadius: '8px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#ff9000'}
                onMouseLeave={e => e.currentTarget.style.color = '#555'}
                title="Налаштування профілю"
              >
                <Settings size={18} />
              </button>
              <button
                onClick={() => { handleCloseMenu(); navigate('/chat'); }}
                style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  color: '#60a5fa',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  justifyContent: 'center',
                  padding: '6px 12px',
                  borderRadius: '10px',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                  e.currentTarget.style.color = '#93c5fd';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                  e.currentTarget.style.color = '#60a5fa';
                }}
                title="Відкрити чат"
              >
                <MessagesSquare size={18} />
                <span style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.05em' }}>ЧАТ</span>
                {chatUnreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    background: '#ef4444',
                    color: '#fff',
                    borderRadius: '50%',
                    minWidth: '18px',
                    height: '18px',
                    fontSize: '0.6rem',
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 5px',
                    border: '2px solid rgba(8, 8, 8, 0.95)',
                    boxShadow: '0 2px 5px rgba(239, 68, 68, 0.5)'
                  }}>
                    {chatUnreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Notification Center Trigger Row */}
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div
              onClick={() => setActiveSubPanel('notifications')}
              style={{
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.005)',
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.015)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.005)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Bell size={16} color={unreadCount > 0 ? '#ff9000' : '#555'} />
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>Сповіщення</span>
                {unreadCount > 0 && (
                  <span style={{
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: '0.6rem',
                    fontWeight: 900,
                    borderRadius: '10px',
                    padding: '1px 6px',
                    boxShadow: '0 0 8px rgba(239,68,68,0.4)'
                  }}>
                    {unreadCount}
                  </span>
                )}
              </div>
              <ChevronRight size={16} color="#555" />
            </div>
          </div>

          {/* Scrollable Navigation links list */}
          <div className="sidebar-links-container">
            <div style={{ fontSize: '0.65rem', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '5px 10px 10px 10px' }}>
              Доступні розділи
            </div>
            {CATEGORIES.map(cat => {
              const catModules = modules.filter(m => (CATEGORY_MAP[m.id] || 'other') === cat.id);
              if (catModules.length === 0) return null;

              const isOpen = openCategories[cat.id] !== false;

              return (
                <div key={cat.id} style={{ display: 'flex', flexDirection: 'column' }}>
                  {/* Category Header (Accordion toggle) */}
                  <div
                    onClick={() => setOpenCategories(prev => ({ ...prev, [cat.id]: !prev[cat.id] }))}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      cursor: 'pointer',
                      borderRadius: '10px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      marginTop: '8px',
                      marginBottom: '4px',
                      transition: 'all 0.2s ease',
                      userSelect: 'none'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: cat.color }} />
                      <span style={{ fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#aaa' }}>
                        {cat.title}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: '#555', fontWeight: 800 }}>
                        ({catModules.length})
                      </span>
                    </div>
                    <ChevronDown
                      size={14}
                      color="#555"
                      style={{
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease'
                      }}
                    />
                  </div>

                  {/* Modules under this Category */}
                  {isOpen && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '8px' }}>
                      {catModules.map(m => {
                        const isActive = location.pathname === m.path;
                        return (
                          <Link
                            key={m.id}
                            to={m.path}
                            className={`sidebar-link ${isActive ? 'active' : ''}`}
                            onClick={handleCloseMenu}
                          >
                            <div style={{
                              color: isActive ? '#ff9000' : m.color,
                              background: isActive ? 'rgba(255,144,0,0.1)' : 'rgba(0,0,0,0.2)',
                              width: '32px',
                              height: '32px',
                              borderRadius: '10px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: '0.2s',
                              flexShrink: 0
                            }}>
                              {React.cloneElement(m.icon, { size: 16 })}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                              <span style={{ fontSize: '0.82rem', fontWeight: 800 }}>{m.title}</span>
                              <span style={{ fontSize: '0.62rem', color: '#444', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontWeight: 500, marginTop: '2px' }}>
                                {m.desc}
                              </span>
                            </div>
                            {m.badge > 0 && (
                              <span style={{
                                background: m.color,
                                color: '#fff',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontSize: '0.6rem',
                                fontWeight: 900,
                                boxShadow: `0 2px 8px ${m.color}40`
                              }}>
                                {m.badge}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Support section and Logout button */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', padding: '10px' }}>
            <div className="support-banner">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginBottom: '4px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }}></div>
                <span style={{ fontSize: '0.65rem', color: '#666', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Технічна підтримка
                </span>
              </div>
              <button
                onClick={() => { navigate('/chat?support=true'); setMenuOpen(false); }}
                style={{
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  color: '#fff',
                  background: 'rgba(255, 144, 0, 0.15)',
                  border: '1px solid rgba(255, 144, 0, 0.3)',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                  width: '100%',
                  justifyContent: 'center',
                  marginTop: '6px'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 144, 0, 0.25)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 144, 0, 0.15)'; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff9000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                </svg>
                Написати в підтримку
              </button>
            </div>

            <button
              onClick={() => {
                localStorage.removeItem('MES_SESSION_LOGIN');
                localStorage.removeItem('MES_SESSION_USER');
                window.location.href = '/login';
              }}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: '#ef4444',
                textAlign: 'center',
                padding: '12px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 800,
                borderRadius: '12px',
                transition: 'background 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              Вийти з системи
            </button>
          </div>
        </div>

        {/* Sliding Notifications Sub-Panel */}
        <NavNotificationFeed
          isOpen={activeSubPanel === 'notifications'}
          onBack={() => setActiveSubPanel(null)}
          notifications={notifications}
          unreadCount={unreadCount}
          readIds={readIds}
          onNotificationClick={handleNotificationClick}
          onMarkAllAsRead={handleMarkAllAsRead}
          formatRelativeTime={formatRelativeTime}
        />

        {/* Sliding Notifications Settings Sub-Panel */}
        <NavSettingsPanel
          isOpen={activeSubPanel === 'notif_settings'}
          onBack={() => setActiveSubPanel(null)}
          currentUser={currentUser}
          notifSettings={notifSettings}
          onUpdateNotifSetting={updateNotifSetting}
          upsertUser={upsertUser}
        />
      </div>
    </>
  );
};
