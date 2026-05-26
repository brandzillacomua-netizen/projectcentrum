import React, { useState, useMemo, useEffect, Suspense, lazy, useRef } from 'react'
import { Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { 
  Menu,
  LayoutDashboard,
  Warehouse,
  Users,
  Tablet,
  Truck,
  Settings,
  Cpu,
  ChevronRight,
  Monitor,
  ShieldCheck,
  Package,
  TrendingUp,
  AlertTriangle,
  KanbanSquare,
  ShoppingBag,
  BarChart2,
  Search,
  RefreshCw,
  Sliders,
  X,
  Bell,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  BellOff,
  ArrowLeft
} from 'lucide-react'

// ── Lazy-loaded modules (loaded on demand, not at startup) ─────────────────────
const ManagerModule        = lazy(() => import('./modules/ManagerModule'))
const WarehouseModule      = lazy(() => import('./modules/WarehouseModuleV2'))
const MasterModule         = lazy(() => import('./modules/MasterModule_v3'))
const NomenclatureModule   = lazy(() => import('./modules/NomenclatureModule'))
const EngineerModule       = lazy(() => import('./modules/EngineerModule'))
const DirectorModule       = lazy(() => import('./modules/DirectorModule'))
const OperatorTerminal     = lazy(() => import('./modules/OperatorTerminalV2'))
const ShippingModule       = lazy(() => import('./modules/ShippingModule'))
const SupplyModule         = lazy(() => import('./modules/SupplyModuleV2'))
const PreparationTerminal  = lazy(() => import('./modules/PreparationTerminal'))
const ForemanWorkplace     = lazy(() => import('./modules/ForemanWorkplace'))
const PackagingModule      = lazy(() => import('./modules/PackagingModule'))
const MachinesModule       = lazy(() => import('./modules/MachinesModule'))
const SettingsModule       = lazy(() => import('./modules/SettingsModule'))
const LoginPage            = lazy(() => import('./modules/LoginPage'))
const Shop1Terminal        = lazy(() => import('./modules/Shop1Terminal'))
const Shop2Module          = lazy(() => import('./modules/Shop2Module'))
const Shop2Terminal        = lazy(() => import('./modules/Shop2Terminal'))
const NomenclatureV2       = lazy(() => import('./modules/NomenclatureV2'))
const AnalyticsModule      = lazy(() => import('./modules/AnalyticsModule'))
const BrakModule           = lazy(() => import('./modules/BrakModule'))
const KanbanModule         = lazy(() => import('./modules/KanbanModule'))
const AccessModule         = lazy(() => import('./modules/AccessModule'))
const ReportsModule        = lazy(() => import('./modules/ReportsModule'))
const DashboardModule      = lazy(() => import('./modules/DashboardModule'))
const MachineCallModule    = lazy(() => import('./modules/MachineCallModule'))

import { MESProvider, useMES } from './MESContext'

// ── Shared loading fallback ─────────────────────────────────────────────────────
const ModuleLoader = () => (
  <div style={{ background: '#050505', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
    <div style={{ width: '40px', height: '40px', border: '3px solid #1a1a1a', borderTop: '3px solid #ff9000', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <div style={{ color: '#333', fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase' }}>Завантаження модуля...</div>
    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
  </div>
)


const FileCodeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="m10 13-2 2 2 2"/><path d="m14 17 2-2-2-2"/></svg>
)

const getAllModules = (badgeCount = 0) => [
  { id: 'dashboard', title: 'Дашборд WIP', icon: <LayoutDashboard />, path: '/dashboard', desc: 'Моніторинг незавершеного виробництва', color: '#ff9000' },
  { id: 'manager', title: 'Менеджер', icon: <LayoutDashboard />, path: '/manager', desc: 'Замовлення та планування', color: '#ff9000' },
  { id: 'kanban', title: 'Задачі', icon: <KanbanSquare />, path: '/tasks', desc: 'Внутрішні доручення', color: '#8b5cf6', badge: badgeCount },
  { id: 'master', title: 'ЦЕХ №1 – Створення нарядів', icon: <Monitor />, path: '/master', desc: 'Управління зміною', color: '#3b82f6' },
  { id: 'warehouse', title: 'Склад Оперативний', icon: <Warehouse />, path: '/warehouse', desc: 'Матеріали та залишки', color: '#10b981' },
  { id: 'engineer', title: 'Інженер', icon: <FileCodeIcon />, path: '/engineer', desc: 'CNC та специфікації', color: '#8b5cf6' },
  { id: 'director', title: 'Директор Виробництва', icon: <ShieldCheck size={24} />, path: '/director', desc: 'Фінальне підтвердження', color: '#10b981' },
  { id: 'foreman', title: 'ЦЕХ №1 – Створення РК', icon: <Users />, path: '/foreman', desc: 'Розподіл нарядів', color: '#f59e0b' },
  { id: 'operator', title: 'Термінал', icon: <Tablet />, path: '/operator', desc: 'Робоче місце', color: '#ef4444' },
  { id: 'prep_terminal', title: 'Підготовка', icon: <Tablet />, path: '/prep-terminal', desc: 'Відділ Підготовки', color: '#10b981' },
  { id: 'shop1', title: 'Цех №1 · Термінал', icon: <Tablet />, path: '/shop1', desc: 'Розкрій → Галтовка → Прийомка', color: '#eab308' },
  { id: 'shop2', title: 'Цех №2', icon: <Monitor />, path: '/shop2', desc: 'Черга нарядів', color: '#8b5cf6' },
  { id: 'shop2_terminal', title: 'Цех №2 · Термінал', icon: <Tablet />, path: '/shop2-terminal', desc: 'Пресування → Фарбування → Доопрацювання', color: '#8b5cf6' },
  { id: 'packaging', title: 'Пакування', icon: <Package />, path: '/packaging', desc: 'Комплектування', color: '#f43f5e' },
  { id: 'shipping', title: 'Логістика', icon: <Truck />, path: '/shipping', desc: 'Відвантаження', color: '#ec4899' },
  { id: 'supply', title: 'Склад Виробництва', icon: <Warehouse />, path: '/supply', desc: 'Управління запасами та запити', color: '#06b6d4' },
  { id: 'procurement', title: 'Постачання', icon: <ShoppingBag />, path: '/procurement', desc: 'Закупівля ТМЦ у постачальників', color: '#ec4899' },
  { id: 'nomenclature_v2', title: 'Номенклатура', icon: <Menu />, path: '/nomenclature-v2', desc: 'Управління каталогом', color: '#8b5cf6' },
  { id: 'nomenclature', title: 'База', icon: <Settings />, path: '/nomenclature', desc: 'Номенклатура', color: '#6366f1' },
  { id: 'machines', title: 'Станки', icon: <Cpu />, path: '/machines', desc: 'Обладнання', color: '#f97316' },
  { id: 'analytics', title: 'Аналітика', icon: <TrendingUp />, path: '/analytics', desc: 'Статистика та KPI', color: '#8b5cf6' },
  { id: 'access', title: 'Система Доступу', icon: <ShieldCheck />, path: '/access', desc: 'Контроль проходів (Fortnet)', color: '#ff9000' },
  { id: 'brak', title: 'ВКЯ', icon: <AlertTriangle />, path: '/brak', desc: 'Контроль якості та облік браку', color: '#ef4444' },
  { id: 'reports', title: 'Звіти (1С)', icon: <BarChart2 />, path: '/reports', desc: 'Зведена аналітика та звіти', color: '#10b981' },
  { id: 'settings', title: 'Система', icon: <Settings />, path: '/settings', desc: 'Конфігурація', color: '#444' }
]

const getAvailableModules = (currentUser, badgeCount) => {
  if (!currentUser) return [];
  const allModules = getAllModules(badgeCount);
  return allModules.filter(m => {
    if (m.id === 'shop2' || m.id === 'shop2_terminal') return currentUser?.access_rights?.master || currentUser?.access_rights?.foreman || currentUser?.access_rights?.shop2;
    if (m.id === 'analytics') return currentUser?.access_rights?.director || currentUser?.access_rights?.master || currentUser?.access_rights?.analytics;
    if (m.id === 'brak') return currentUser?.access_rights?.master || currentUser?.access_rights?.foreman || currentUser?.access_rights?.director || currentUser?.access_rights?.brak;
    if (m.id === 'reports') return currentUser?.access_rights?.director || currentUser?.access_rights?.reports || currentUser?.position === 'Адмін';
    if (m.id === 'prep_terminal') return currentUser?.access_rights?.master || currentUser?.access_rights?.foreman || currentUser?.position?.toLowerCase().includes('вп') || currentUser?.position?.toLowerCase().includes('підготов');
    return currentUser?.access_rights?.[m.id] === true;
  });
}

const CATEGORY_MAP = {
  dashboard: 'admin_analytics',
  manager: 'admin_analytics',
  kanban: 'admin_analytics',
  director: 'admin_analytics',
  analytics: 'admin_analytics',
  reports: 'admin_analytics',
  machines: 'admin_analytics',
  access: 'admin_analytics',
  settings: 'admin_analytics',

  master: 'production',
  shop2: 'production',
  foreman: 'production',
  engineer: 'production',

  operator: 'terminals',
  prep_terminal: 'terminals',
  shop1: 'terminals',
  shop2_terminal: 'terminals',

  warehouse: 'logistics',
  supply: 'logistics',
  procurement: 'logistics',
  packaging: 'logistics',
  shipping: 'logistics',
  nomenclature_v2: 'logistics',
  nomenclature: 'logistics'
};

const CATEGORIES = [
  { id: 'admin_analytics', title: 'Керування та Аналітика', color: '#ff9000' },
  { id: 'production', title: 'Виробництво', color: '#3b82f6' },
  { id: 'terminals', title: 'Термінали дільниць', color: '#ef4444' },
  { id: 'logistics', title: 'Склад та Логістика', color: '#10b981' },
  { id: 'other', title: 'Інші розділи', color: '#888' }
];

const GlobalUserNav = () => {
  const { currentUser, managementTasks, requests, workCards, purchaseRequests, receptionDocs, nomenclatures, machineCalls, machines } = useMES();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSubPanel, setActiveSubPanel] = useState(null); // 'notifications' or null
  const [openCategories, setOpenCategories] = useState({
    admin_analytics: true,
    production: true,
    terminals: true,
    logistics: true,
    other: true
  });

  const handleCloseMenu = () => {
    setMenuOpen(false);
    setActiveSubPanel(null);
  };

  // Persistence of read notification IDs
  const [readIds, setReadIds] = useState(() => {
    if (!currentUser) return [];
    try {
      const saved = localStorage.getItem(`MES_READ_NOTIF_${currentUser.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`MES_READ_NOTIF_${currentUser.id}`, JSON.stringify(readIds));
    }
  }, [readIds, currentUser]);

  // Ukrainian relative time helper
  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now - date;
      if (isNaN(diffMs) || diffMs < 0) return 'щойно';
      
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return 'щойно';
      
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin} хв. тому`;
      
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours} год. тому`;
      
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'вчора';
      if (diffDays < 7) return `${diffDays} дн. тому`;
      
      return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
    } catch (e) {
      return '';
    }
  };

  // Compile notification feed from 5 sources matching role access
  const notifications = useMemo(() => {
    const list = [];
    if (!currentUser) return list;
    const availableModules = getAvailableModules(currentUser, 0);
    const hasModule = (id) => availableModules.some(m => m.id === id);

    // 1. Kanban Tasks
    if (hasModule('kanban') && managementTasks) {
      managementTasks.forEach(t => {
        if (t.status !== 'done' && (t.assigned_to === currentUser.login || t.created_by === currentUser.login)) {
          list.push({
            id: `task-${t.id}`,
            type: 'task',
            title: `Задача: ${t.title || 'Без назви'}`,
            description: t.description || 'Немає опису',
            createdAt: t.created_at,
            path: '/tasks',
            color: '#8b5cf6',
            icon: <KanbanSquare size={14} />
          });
        }
      });
    }

    // 2. Material Requests
    const hasWarehouseAccess = hasModule('warehouse') || hasModule('supply') || hasModule('master') || hasModule('foreman') || hasModule('director');
    if (hasWarehouseAccess && requests) {
      requests.forEach(r => {
        if (r.status === 'pending') {
          let path = '/';
          if (hasModule('supply')) path = '/supply';
          else if (hasModule('warehouse')) path = '/warehouse';
          else if (hasModule('foreman')) path = '/foreman';
          else if (hasModule('master')) path = '/master';
          else if (hasModule('director')) path = '/director';

          list.push({
            id: `req-${r.id}`,
            type: 'request',
            title: 'Запит матеріалу',
            description: r.details || `Кількість: ${r.quantity}`,
            createdAt: r.created_at,
            path,
            color: '#10b981',
            icon: <ClipboardList size={14} />
          });
        }
      });
    }

    // 3. Work Cards (Shop 1 or Shop 2)
    if (workCards) {
      workCards.forEach(w => {
        if (w.status === 'new') {
          const op = (w.operation || '').toLowerCase();
          const isShop1 = ['розкрій', 'лазерний розкрій', 'галтовка', 'прийомка'].some(o => op.includes(o));
          const isShop2 = ['пресування', 'фарбування', 'малярка', 'доопрацювання'].some(o => op.includes(o));

          let isRelevant = false;
          let path = '/';

          if (isShop1) {
            isRelevant = hasModule('shop1') || hasModule('master') || hasModule('foreman') || hasModule('director');
            if (isRelevant) {
              if (hasModule('shop1')) path = '/shop1';
              else if (hasModule('master')) path = '/master';
              else if (hasModule('foreman')) path = '/foreman';
              else if (hasModule('director')) path = '/director';
            }
          } else if (isShop2) {
            isRelevant = hasModule('shop2_terminal') || hasModule('shop2') || hasModule('master') || hasModule('foreman') || hasModule('director');
            if (isRelevant) {
              if (hasModule('shop2_terminal')) path = '/shop2-terminal';
              else if (hasModule('shop2')) path = '/shop2';
              else if (hasModule('foreman')) path = '/foreman';
              else if (hasModule('master')) path = '/master';
              else if (hasModule('director')) path = '/director';
            }
          } else {
            isRelevant = hasModule('master') || hasModule('foreman') || hasModule('director');
            if (isRelevant) {
              if (hasModule('foreman')) path = '/foreman';
              else if (hasModule('master')) path = '/master';
              else if (hasModule('director')) path = '/director';
            }
          }

          if (isRelevant) {
            list.push({
              id: `wc-${w.id}`,
              type: 'work_card',
              title: `Нова картка: ${w.operation || 'Операція'}`,
              description: w.card_info || `Кількість: ${w.quantity}`,
              createdAt: w.created_at,
              path,
              color: '#eab308',
              icon: <Tablet size={14} />
            });
          }
        }
      });
    }

    // 4. Purchase Requests
    const hasSupplyProcurementAccess = hasModule('supply') || hasModule('procurement') || hasModule('warehouse');
    if (hasSupplyProcurementAccess && purchaseRequests) {
      purchaseRequests.forEach(pr => {
        if (pr.status === 'pending') {
          let path = '/';
          if (hasModule('procurement')) path = '/procurement';
          else if (hasModule('supply')) path = '/supply';
          else if (hasModule('warehouse')) path = '/warehouse';

          list.push({
            id: `pr-${pr.id}`,
            type: 'purchase_request',
            title: `Запит закупівлі ${pr.order_num ? `(№${pr.order_num})` : ''}`,
            description: pr.nomenclature_name || pr.details || (pr.items && pr.items.length > 0 ? pr.items.map(it => `${it.name || 'ТМЦ'} (к-ть: ${it.qty || it.quantity})`).join(', ') : 'Очікує розгляду'),
            createdAt: pr.created_at,
            path,
            color: '#ec4899',
            icon: <ShoppingBag size={14} />
          });
        }
      });
    }

    // 5. Reception Docs
    if (hasSupplyProcurementAccess && receptionDocs) {
      receptionDocs.forEach(rec => {
        if (rec.status === 'ordered' || rec.status === 'shipped') {
          let path = '/';
          if (hasModule('procurement')) path = '/procurement';
          else if (hasModule('supply')) path = '/supply';
          else if (hasModule('warehouse')) path = '/warehouse';

          const docId = rec.order_id === null && rec.task_id === null 
            ? `№РП-${String(rec.id).substring(0, 6).toUpperCase()}` 
            : `#${String(rec.id).substring(0, 6)}`;

          list.push({
            id: `rec-${rec.id}`,
            type: 'reception_doc',
            title: `Прийомка ${docId} (${rec.status === 'shipped' ? 'Відправлено' : 'Замовлено'})`,
            description: rec.items && rec.items.length > 0 ? rec.items.map(it => `${it.name || 'ТМЦ'} (к-ть: ${it.qty || it.quantity})`).join(', ') : 'Очікує надходження',
            createdAt: rec.created_at,
            path,
            color: '#06b6d4',
            icon: <Warehouse size={14} />
          });
        }
      });
    }

    // 6. Machine Calls
    if (machineCalls) {
      machineCalls.forEach(c => {
        if (c.status === 'pending') {
          const mach = machines?.find(m => m.id === c.machine_id);
          const machName = mach ? mach.name : 'Верстат';
          
          let isRelevant = false;
          let roleLabel = '';
          
          // Check if targeted to a specific user
          if (c.called_employee_id) {
            isRelevant = currentUser?.id === c.called_employee_id;
          } else {
            // General call (role-based)
            if (c.called_role === 'master') {
              isRelevant = currentUser?.access_rights?.master || currentUser?.access_rights?.foreman;
            } else if (c.called_role === 'engineer') {
              isRelevant = currentUser?.access_rights?.engineer;
            } else if (c.called_role === 'quality' || c.called_role === 'qc') {
              isRelevant = currentUser?.access_rights?.brak || currentUser?.position?.toLowerCase().includes('вкя') || currentUser?.position?.toLowerCase().includes('якост');
            }
          }

          if (c.called_role === 'master') {
            roleLabel = 'Майстра';
          } else if (c.called_role === 'engineer') {
            roleLabel = 'Інженера';
          } else if (c.called_role === 'quality' || c.called_role === 'qc') {
            roleLabel = 'ВКЯ';
          }
          
          if (isRelevant) {
            list.push({
              id: `call-${c.id}`,
              type: 'machine_call',
              title: `⚠️ Виклик ${roleLabel}`,
              description: `Верстат: ${machName}. Локація: ${mach?.floor || 'Не вказано'}. ${c.operator_name ? `Викликав: ${c.operator_name}` : ''}${c.called_employee_name ? ` (Для: ${c.called_employee_name})` : ''}`,
              createdAt: c.created_at,
              path: '/machines',
              color: '#ef4444',
              icon: <AlertTriangle size={14} />
            });
          }
        }
      });
    }

    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [currentUser, managementTasks, requests, workCards, purchaseRequests, receptionDocs, machineCalls, machines]);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !readIds.includes(n.id)).length;
  }, [notifications, readIds]);

  const handleNotificationClick = (n) => {
    if (!readIds.includes(n.id)) {
      setReadIds(prev => [...prev, n.id]);
    }
    handleCloseMenu();
    navigate(n.path);
  };

  const handleMarkAllAsRead = () => {
    const allIds = notifications.map(n => n.id);
    setReadIds(prev => {
      const unique = new Set([...prev, ...allIds]);
      return Array.from(unique);
    });
  };

  if (location.pathname === '/login' || location.pathname === '/') return null;
  if (!currentUser) return null;

  const isAdmin = currentUser.position === 'Адмін' || currentUser.role === 'admin';
  if (isAdmin) return null;

  // Kanban task count badge remains on the menu item itself
  const myPendingTasksCount = (managementTasks || []).filter(t => 
    t.status !== 'done' && 
    (t.assigned_to === currentUser.login || t.created_by === currentUser.login)
  ).length;

  const modules = getAvailableModules(currentUser, myPendingTasksCount);

  return (
    <>
      <style>{`
        /* Hide all navigation back buttons for non-admins */
        a[href="/"],
        .back-link,
        .back-btn-modern,
        .nav-back-link,
        .nav-back-btn,
        .btn-back,
        .btn-back-director {
          display: none !important;
        }

        /* Hide adjacent vertical dividers (separators) next to back buttons */
        a[href="/"] + div {
          display: none !important;
        }

        /* Expand left padding of top headers to make space for the fixed hamburger menu */
        nav:has(a[href="/"]),
        header:has(a[href="/"]),
        .module-nav:has(a[href="/"]),
        .terminal-nav:has(a[href="/"]),
        .glass-nav:has(a[href="/"]) {
          padding-left: 75px !important;
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
          transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .sidebar-backdrop.open {
          opacity: 1;
          pointer-events: auto;
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
          transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .sidebar-drawer.open {
          transform: translateX(0);
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
      `}</style>

      {/* Floating Menu Toggle Button */}
      <div className="no-print" style={{ position: 'fixed', top: '15px', left: '20px', zIndex: 99998 }}>
        <button 
          onClick={() => setMenuOpen(true)}
          style={{ 
            position: 'relative',
            background: '#0a0a0a', 
            border: '1px solid rgba(255, 255, 255, 0.08)', 
            color: '#fff', 
            borderRadius: '12px', 
            width: '40px', 
            height: '40px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            cursor: 'pointer', 
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'rgba(255, 144, 0, 0.3)';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <Menu size={20} />
          {unreadCount > 0 && (
            <span 
              className="notif-badge-pulse"
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                background: '#ef4444',
                color: '#fff',
                borderRadius: '50%',
                minWidth: '16px',
                height: '16px',
                fontSize: '0.55rem',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
                border: '2px solid #0a0a0a',
                boxShadow: '0 0 8px rgba(239, 68, 68, 0.8)'
              }}
            >
              {unreadCount}
            </span>
          )}
        </button>
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
          <div style={{ padding: '24px 20px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src="/kulytsya.png" alt="Logo" style={{ height: '36px', filter: 'drop-shadow(0 0 10px rgba(255,144,0,0.3))' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '1.05rem', fontWeight: 950, color: '#fff', letterSpacing: '-0.5px' }}>
                  CRM <span style={{ color: '#ff9000' }}>КУЛИЦЯ</span>
                </span>
                <span style={{ fontSize: '0.55rem', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', marginTop: '1px' }}>
                  MES SYSTEM v2.0
                </span>
              </div>
            </div>
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

          {/* User Mini Profile */}
          <div style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              width: '38px', 
              height: '38px', 
              borderRadius: '10px', 
              background: 'rgba(255,144,0,0.1)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: '#ff9000', 
              fontWeight: 1000, 
              fontSize: '0.85rem' 
            }}>
              {(currentUser?.first_name?.[0] || '') + (currentUser?.last_name?.[0] || '')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fff' }}>
                {currentUser?.first_name} {currentUser?.last_name}
              </span>
              <span style={{ fontSize: '0.62rem', color: '#555', fontWeight: 900, textTransform: 'uppercase', marginTop: '2px' }}>
                {currentUser?.position || 'Співробітник'}
              </span>
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

              const isOpen = openCategories[cat.id];

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
              <a 
                href="tel:0960116699" 
                style={{ 
                  fontSize: '1.05rem', 
                  fontWeight: 950, 
                  color: '#fff', 
                  textDecoration: 'none', 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  transition: 'color 0.2s' 
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#ff9000'}
                onMouseLeave={e => e.currentTarget.style.color = '#fff'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', opacity: 0.7 }}>
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                096 011 66 99
              </a>
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
        <div style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          background: 'rgba(8, 8, 8, 0.98)',
          backdropFilter: 'blur(25px)',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          transform: activeSubPanel === 'notifications' ? 'translateX(0)' : 'translateX(100%)',
          pointerEvents: activeSubPanel === 'notifications' ? 'auto' : 'none'
        }}>
          {/* Header section with Back and Close button */}
          <div style={{ padding: '24px 20px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button 
              onClick={() => setActiveSubPanel(null)}
              style={{ 
                background: 'transparent', 
                border: 'none', 
                color: '#ff9000', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                fontSize: '0.85rem',
                fontWeight: 800,
                padding: '6px 0'
              }}
            >
              <ArrowLeft size={16} /> Назад
            </button>
            <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#fff' }}>
              Сповіщення {unreadCount > 0 && `(${unreadCount})`}
            </span>
          </div>

          {/* Mark all as read bar */}
          {notifications.length > 0 && unreadCount > 0 && (
            <div style={{ 
              padding: '12px 20px', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              borderBottom: '1px solid rgba(255,255,255,0.02)'
            }}>
              <span style={{ fontSize: '0.65rem', color: '#444', fontWeight: 800 }}>
                НЕПРОЧИТАНИХ: {unreadCount}
              </span>
              <button 
                onClick={handleMarkAllAsRead}
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: '#ff9000', 
                  fontSize: '0.65rem', 
                  fontWeight: 800, 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 6px',
                  borderRadius: '6px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,144,0,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Check size={12} /> Позначити всі
              </button>
            </div>
          )}

          {/* Notifications List */}
          <div className="sidebar-links-container" style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
            {notifications.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '12px' }}>
                <BellOff size={32} color="#222" />
                <span style={{ fontSize: '0.75rem', color: '#444', fontWeight: 800, textAlign: 'center' }}>
                  Немає нових сповіщень
                </span>
              </div>
            ) : (
              notifications.map(n => {
                const isUnread = !readIds.includes(n.id);
                return (
                  <div 
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '12px',
                      borderRadius: '12px',
                      background: isUnread ? 'rgba(255, 144, 0, 0.04)' : 'rgba(255, 255, 255, 0.01)',
                      border: '1px solid',
                      borderColor: isUnread ? 'rgba(255, 144, 0, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      marginBottom: '8px',
                      position: 'relative'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = isUnread ? 'rgba(255, 144, 0, 0.08)' : 'rgba(255, 255, 255, 0.04)';
                      e.currentTarget.style.transform = 'translateX(2px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = isUnread ? 'rgba(255, 144, 0, 0.04)' : 'rgba(255, 255, 255, 0.01)';
                      e.currentTarget.style.transform = 'none';
                    }}
                  >
                    <div style={{ 
                      width: '32px', 
                      height: '32px', 
                      borderRadius: '50%', 
                      background: `${n.color}15`, 
                      color: n.color, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {n.icon}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {n.title}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: '#888', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', lineHeight: '1.25' }}>
                        {n.description}
                      </span>
                      <span style={{ fontSize: '0.58rem', color: '#444', marginTop: '6px', fontWeight: 800 }}>
                        {formatRelativeTime(n.createdAt)}
                      </span>
                    </div>
                    {isUnread && (
                      <div style={{ 
                        width: '6px', 
                        height: '6px', 
                        borderRadius: '50%', 
                        background: '#ef4444', 
                        boxShadow: '0 0 6px #ef4444',
                        alignSelf: 'center',
                        flexShrink: 0
                      }} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </>
  );
};

const Portal = () => {
  const { currentUser, managementTasks, companyPositions } = useMES()
  const location = useLocation()

  // Badge logic for Kanban Module
  const myPendingTasksCount = (managementTasks || []).filter(t => 
    t.status !== 'done' && 
    (t.assigned_to === currentUser?.login || t.created_by === currentUser?.login)
  ).length

  const modules = getAvailableModules(currentUser, myPendingTasksCount)
  const isAdmin = currentUser?.position === 'Адмін' || currentUser?.role === 'admin';

  // REDIRECT NON-ADMIN TO START PAGE OR FIRST AVAILABLE MODULE
  if (!isAdmin && modules.length > 0 && location.pathname === '/') {
    const userPosition = (companyPositions || []).find(p => p.name === currentUser?.position)
    const targetPath = userPosition?.start_page
    if (targetPath && modules.some(m => m.path === targetPath)) {
      return <Navigate to={targetPath} replace />
    }
    return <Navigate to={modules[0].path} replace />
  }

  return (
    <div className="portal-container-v2" style={{ background: '#050505', minHeight: '100vh', color: '#fff', padding: '40px 20px' }}>
      <header className="portal-header-v2" style={{ maxWidth: '1200px', margin: '0 auto 50px', textAlign: 'center' }}>
        <div className="logo-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
           <img src="/kulytsya.png" alt="Logo" style={{ height: '70px', filter: 'drop-shadow(0 0 15px rgba(255,144,0,0.4))' }} />
           <h1 style={{ fontSize: '2.4rem', fontWeight: 950, margin: 0, letterSpacing: '-1px' }}>CRM <span style={{ color: '#ff9000' }}>КУЛИЦЯ</span></h1>
           <p style={{ color: '#333', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.4em' }}>Industrial Control v2.0</p>
        </div>
      </header>
      <div className="portal-grid-v2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        {modules.map(mod => (
          <Link key={mod.id} to={mod.path} className="portal-card-v2 glass-panel" style={{ textDecoration: 'none', background: '#111', border: '1px solid #1a1a1a', borderRadius: '24px', padding: '25px', display: 'flex', alignItems: 'center', gap: '20px', transition: '0.3s cubic-bezier(0.4, 0, 0.2, 1)', position: 'relative', overflow: 'hidden' }}>
             <div className="card-icon-v2" style={{ background: '#000', width: '56px', height: '56px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: mod.color, position: 'relative' }}>
                 {mod.icon}
                 {mod.badge > 0 && <span className="badge-count anim-pulse" style={{ position: 'absolute', top: -5, right: -5 }}>{mod.badge}</span>}
             </div>
             <div className="card-info-v2" style={{ flex: 1 }}>
                 <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', color: '#fff', fontWeight: 900 }}>{mod.title}</h3>
                 <p style={{ margin: 0, fontSize: '0.75rem', color: '#555', fontWeight: 500 }}>{mod.desc}</p>
             </div>
             <ChevronRight className="arrow-v2" size={18} style={{ color: '#222', transition: '0.3s' }} />
             <div className="hover-line" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: mod.color, opacity: 0, transition: '0.3s' }}></div>
          </Link>
        ))}
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .portal-card-v2:hover { transform: translateY(-5px) scale(1.02); background: #181818; border-color: #333; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
        .portal-card-v2:hover .arrow-v2 { color: #ff9000; transform: translateX(5px); }
        .portal-card-v2:hover .hover-line { opacity: 1; }
        @media (max-width: 768px) { .portal-grid-v2 { grid-template-columns: 1fr; } }
      `}} />
    </div>
  )
}


const AppContent = () => {
  const { currentUser, sessionLoading } = useMES()
  const location = useLocation()

  // Поки перевіряємо сесію з Supabase — показуємо спіннер (не редіректимо)
  if (sessionLoading) {
    return (
      <div style={{ background: '#050505', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px' }}>
        <img src="/kulytsya.png" alt="Logo" style={{ height: '60px', filter: 'drop-shadow(0 0 15px rgba(255,144,0,0.4))', animation: 'spin 2s linear infinite' }} />
        <div style={{ color: '#333', fontSize: '0.7rem', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase' }}>Завантаження...</div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // РЕДИРЕКТ НА /login ЯКЩО НЕ АВТОРИЗОВАНИЙ (крім публічної сторінки виклику)
  const isPublicCall = /^\/machines\/[^/]+\/call$/.test(location.pathname)
  if (!currentUser && location.pathname !== '/login' && !isPublicCall) {
    return <Navigate to="/login" replace />
  }

  // РЕДИРЕКТ З /login НА ГОЛОВНУ ЯКЩО ВЖЕ АВТОРИЗОВАНИЙ
  if (currentUser && location.pathname === '/login') {
    return <Navigate to="/" replace />
  }

  return (
    <Suspense fallback={<ModuleLoader />}>
      {currentUser && 
       currentUser.position !== 'Адмін' && 
       currentUser.role !== 'admin' && 
       location.pathname !== '/login' && 
       location.pathname !== '/' && (
         <GlobalUserNav key={currentUser.id} />
       )}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Portal />} />
        <Route path="/dashboard" element={<DashboardModule />} />
        <Route path="/manager" element={<ManagerModule />} />
        <Route path="/warehouse" element={<WarehouseModule />} />
        <Route path="/master" element={<MasterModule />} />
        <Route path="/foreman" element={<ForemanWorkplace />} />
        <Route path="/operator" element={<OperatorTerminal />} />
        <Route path="/prep-terminal" element={<PreparationTerminal />} />
        <Route path="/shop1" element={<Shop1Terminal />} />
        <Route path="/shop2" element={<Shop2Module />} />
        <Route path="/shop2-terminal" element={<Shop2Terminal />} />
        <Route path="/packaging" element={<PackagingModule />} />
        <Route path="/engineer" element={<EngineerModule />} />
        <Route path="/director" element={<DirectorModule />} />
        <Route path="/shipping" element={<ShippingModule />} />
        <Route path="/supply" element={<SupplyModule />} />
        <Route path="/nomenclature" element={<NomenclatureModule />} />
        <Route path="/nomenclature-v2" element={<NomenclatureV2 />} />
        <Route path="/machines" element={<MachinesModule />} />
        <Route path="/machines/:id/call" element={<MachineCallModule />} />
        <Route path="/analytics" element={<AnalyticsModule />} />
        <Route path="/brak" element={<BrakModule />} />
        <Route path="/tasks" element={<KanbanModule />} />
        <Route path="/access" element={<AccessModule />} />
        <Route path="/procurement" element={<SupplyModule isProcurementOnly={true} />} />
        <Route path="/reports" element={<ReportsModule />} />
        <Route path="/settings" element={<SettingsModule />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

function App() {
  return (
    <MESProvider>
      <AppContent />
    </MESProvider>
  )
}

export default App
