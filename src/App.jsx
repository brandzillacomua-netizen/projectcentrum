import React, { useState, useMemo, useEffect, Suspense, lazy, useRef } from 'react'
import { Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  Menu,
  LayoutDashboard,
  LayoutGrid,
  Box,
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
  ChevronLeft,
  ClipboardList,
  BellOff,
  ArrowLeft,
  Sun,
  Moon,
  MessageCircle,
  MessagesSquare,
  Wrench,
  Briefcase,
  LogOut,
  User,
  Volume2,
  Archive,
  DollarSign,
  Zap,
  Plus
} from 'lucide-react'
import { IconSO, IconSV, IconSGP } from './components/WarehouseIcons'

// ── Lazy-loaded modules (loaded on demand, not at startup) ─────────────────────
const CrmModule = lazy(() => import('./modules/CrmModule'))
const CrmClientsModule = lazy(() => import('./modules/CRM/ClientsModule'))
const EconomyModule = lazy(() => import('./modules/Economy/EconomyModule'))
const ManagerModule = lazy(() => import('./modules/ManagerModule'))
const WarehouseModule = lazy(() => import('./modules/WarehouseModuleV2'))
const MasterModule = lazy(() => import('./modules/MasterModule_v3'))
const NomenclatureModule = lazy(() => import('./modules/NomenclatureModule'))
const EngineerModule = lazy(() => import('./modules/EngineerModule'))
const EngineerV2Module = lazy(() => import('./modules/EngineerV2Module'))
const DirectorModule = lazy(() => import('./modules/DirectorModule'))
const OperatorTerminal = lazy(() => import('./modules/OperatorTerminalV2'))
const ShippingModule = lazy(() => import('./modules/ShippingModule'))
const SupplyModule = lazy(() => import('./modules/SupplyModuleV2'))
const PreparationTerminal = lazy(() => import('./modules/PreparationTerminal'))
const Foreman2Module = lazy(() => import('./modules/Foreman2/Foreman2Module'))
const PackagingModule = lazy(() => import('./modules/PackagingModule'))
const MachinesModule = lazy(() => import('./modules/MachinesModule'))
const SettingsModule = lazy(() => import('./modules/SettingsModule'))
const UserSettingsPage = lazy(() => import('./modules/UserSettingsPage'))
const NotificationsPage = lazy(() => import('./modules/NotificationsPage'))
const LoginPage = lazy(() => import('./modules/LoginPage'))
const Shop1Terminal = lazy(() => import('./modules/Shop1Terminal'))
const Shop1ForemanModule = lazy(() => import('./modules/Shop1ForemanModule'))
const Shop2Module = lazy(() => import('./modules/Shop2Module'))
const Shop2Terminal = lazy(() => import('./modules/Shop2Terminal'))
const NomenclatureV2 = lazy(() => import('./modules/NomenclatureV2'))
const AnalyticsModule = lazy(() => import('./modules/AnalyticsModule'))
const BrakModule = lazy(() => import('./modules/BrakModule'))
const VKYARestorationTerminal = lazy(() => import('./modules/VKYARestorationTerminal'))
const VKYASettings = lazy(() => import('./modules/VKYASettings'))
const KanbanModule = lazy(() => import('./modules/KanbanModule'))
const TaskProjectsModule = lazy(() => import('./modules/TaskProjectsModule'))
const AccessModule = lazy(() => import('./modules/AccessModule'))
const ReportsModule = lazy(() => import('./modules/ReportsModule'))
const ForemanDashboardModule = lazy(() => import('./modules/ForemanDashboardModule'))
const MachineCallModule = lazy(() => import('./modules/MachineCallModule'))
const TumblingTerminal = lazy(() => import('./modules/TumblingTerminal'))
const TumblingDashboard = lazy(() => import('./modules/TumblingDashboard'))
const ReceptionTerminal = lazy(() => import('./modules/ReceptionTerminal'))
const SortingTerminal = lazy(() => import('./modules/SortingTerminal'))
const SimulatorModule = lazy(() => import('./modules/SimulatorModule'))
const PaintingTerminal = lazy(() => import('./modules/PaintingTerminal'))
const PressingTerminal = lazy(() => import('./modules/PressingTerminal'))
const WarehouseBoxesModule = lazy(() => import('./modules/WarehouseBoxesModule'))
const PreparationDashboard = lazy(() => import('./modules/PreparationDashboard'))
const ChatModule = lazy(() => import('./modules/ChatModule'))
const CutterRestorationModule = lazy(() => import('./modules/CutterRestorationModule'))
const WarehouseFGPModule = lazy(() => import('./modules/WarehouseFGPModule'))
const Shop2CardGenModule = lazy(() => import('./modules/Shop2CardGen/Shop2CardGenModule'))

import { MESProvider, useMES } from './MESContext'
import { subscribeToPush } from './services/pushService'

// ── Shared loading fallback ─────────────────────────────────────────────────────
const ModuleLoader = () => (
  <div style={{ background: '#050505', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
    <div style={{ width: '40px', height: '40px', border: '3px solid #1a1a1a', borderTop: '3px solid #ff9000', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <div style={{ color: '#333', fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase' }}>Завантаження модуля...</div>
    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
  </div>
)


const FileCodeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><path d="m10 13-2 2 2 2" /><path d="m14 17 2-2-2-2" /></svg>
)

const getAllModules = (badgeCount = 0, chatBadgeCount = 0) => [
  // ── CRM Pillar (Клієнти, Продажі та Комунікація) ──────────────────────────
  { id: 'crm', title: 'CRM Воронка Лідів & Угод', icon: <Briefcase />, path: '/crm', desc: 'Воронка лідів, запитів та угод', color: '#6366f1', pillar: 'crm' },
  { id: 'crm_clients', title: 'База Клієнтів & Картки CRM', icon: <Users />, path: '/crm/clients', desc: 'Картки клієнтів, LTV, середній чек та комунікація', color: '#6366f1', pillar: 'crm' },
  { id: 'manager', title: 'Менеджер Замовлень', icon: <LayoutDashboard />, path: '/manager', desc: 'Вхідні замовлення та реєстрація', color: '#6366f1', pillar: 'crm' },
  { id: 'chat', title: 'Чат & Комунікація', icon: <MessageCircle />, path: '/chat', desc: 'Внутрішні та клієнтські канали', color: '#6366f1', badge: chatBadgeCount, pillar: 'crm' },
  { id: 'kanban', title: 'Задачі (Канбан)', icon: <KanbanSquare />, path: '/tasks', desc: 'Доручення та проекти', color: '#8b5cf6', badge: badgeCount, pillar: 'crm' },

  // ── ERP Pillar (Ресурси, Склад, Аналітика та Управління) ───────────────────
  { id: 'warehouse', title: 'Склад Оперативний (WMS)', icon: <IconSO />, path: '/warehouse', desc: 'Матеріали, залишки та комплектація', color: '#10b981', pillar: 'erp' },
  { id: 'warehouse_fgp', title: 'Склад Готової Продукції (СГП)', icon: <IconSGP />, path: '/warehouse-fgp', desc: 'Готова продукція, напівфабрикати, брак та БЗ', color: '#10b981', pillar: 'erp' },
  { id: 'supply', title: 'Склад Виробництва', icon: <IconSV />, path: '/supply', desc: 'Управління запасами та запити', color: '#10b981', pillar: 'erp' },
  { id: 'procurement', title: 'Постачання (Procurement)', icon: <ShoppingBag />, path: '/procurement', desc: 'Закупівля ТМЦ у постачальників', color: '#10b981', pillar: 'erp' },
  { id: 'economy', title: 'Економіка & Ціноутворення', icon: <DollarSign />, path: '/economy', desc: 'Прайс-листи, калькуляція собівартості, націнки та маржа', color: '#10b981', pillar: 'erp' },
  { id: 'packaging', title: 'Пакування & Комплектація', icon: <Package />, path: '/packaging', desc: 'Збирання готової продукції', color: '#10b981', pillar: 'erp' },
  { id: 'shipping', title: 'Логістика & Відвантаження', icon: <Truck />, path: '/shipping', desc: 'Відвантаження замовнику', color: '#10b981', pillar: 'erp' },
  { id: 'director', title: 'Кабінет Директора', icon: <ShieldCheck size={24} />, path: '/director', desc: 'Фінальні погодження та моніторинг', color: '#10b981', pillar: 'erp' },
  { id: 'analytics', title: 'Аналітика & KPI', icon: <TrendingUp />, path: '/analytics', desc: 'Статистика продуктивності та випуску', color: '#10b981', pillar: 'erp' },
  { id: 'reports', title: 'Звіти (1С / Леджер)', icon: <BarChart2 />, path: '/reports', desc: 'Зведена аналітика та експорт', color: '#10b981', pillar: 'erp' },
  { id: 'access', title: 'Система Доступу (СКУД)', icon: <ShieldCheck />, path: '/access', desc: 'Контроль проходів Fortnet', color: '#10b981', pillar: 'erp' },
  { id: 'machines', title: 'Обладнання & Верстати', icon: <Cpu />, path: '/machines', desc: 'Моніторинг верстатів та викликів', color: '#10b981', pillar: 'erp' },
  { id: 'cutter_restoration', title: 'Відновлення Фрез', icon: <Wrench />, path: '/cutter-restoration', desc: 'Заточування фасочних фрез', color: '#10b981', pillar: 'erp' },
  { id: 'engineer', title: 'Інженер ЧПК & BOM (v1.0)', icon: <FileCodeIcon />, path: '/engineer', desc: 'CNC програми та специфікації (Old)', color: '#10b981', pillar: 'erp' },
  { id: 'engineer_v2', title: 'Інженер ЧПК & BOM 2.0', icon: <FileCodeIcon />, path: '/engineer-v2', desc: 'Специфікації та ЧПК операції для Номенклатури v2.0', color: '#10b981', pillar: 'erp' },
  { id: 'nomenclature', title: 'База Номенклатури', icon: <Settings />, path: '/nomenclature', desc: 'Основний каталог товарів', color: '#10b981', pillar: 'erp' },
  { id: 'nomenclature_v2', title: 'Номенклатура LAB', icon: <Menu />, path: '/nomenclature-v2', desc: 'Експериментальний каталог v2', color: '#10b981', pillar: 'erp' },
  { id: 'settings', title: 'Системні Налаштування', icon: <Settings />, path: '/settings', desc: 'Конфігурація користувачів та прав', color: '#10b981', pillar: 'erp' },
  { id: 'simulator', title: 'Симулятор Навантаження', icon: <Sliders />, path: '/simulator', desc: 'Тестування живих замовлень', color: '#ef4444', pillar: 'erp' },

  // ── MES Pillar (Виробниче Виконання & Цехи) ────────────────────────────────
  { id: 'master', title: 'ЦЕХ №1 – Створення нарядів', icon: <Monitor />, path: '/master', desc: 'Управління зміною та БЗ', color: '#ff9000', pillar: 'mes' },
  { id: 'foreman', title: 'ЦЕХ №1 – Створення РК (Foreman 2.0)', icon: <Users />, path: '/foreman', desc: 'Розподіл нарядів та робочі карти 2.0', color: '#ff9000', pillar: 'mes' },
  { id: 'shop1', title: 'Цех №1 · Термінал', icon: <Tablet />, path: '/shop1', desc: 'Розкрій → Галтовка → Прийомка', color: '#ff9000', pillar: 'mes' },
  { id: 'shop1_foreman', title: 'Кабінет Нач. Цеху №1', icon: <Users />, path: '/shop1-foreman', desc: 'Управління персоналом та верстатами', color: '#ff9000', pillar: 'mes' },
  { id: 'prep_terminal', title: 'Термінал Підготовки', icon: <Tablet />, path: '/prep-terminal', desc: 'Дільниця підготовки металу', color: '#ff9000', pillar: 'mes' },
  { id: 'preparation_dashboard', title: 'Дашборд Підготовки (TV)', icon: <LayoutDashboard />, path: '/preparation-dashboard', desc: 'TV монітор підготовки', color: '#ff9000', pillar: 'mes' },
  { id: 'tumbling_terminal', title: 'Термінал Галтовки', icon: <Tablet />, path: '/tumbling-terminal', desc: 'Дільниця галтовки', color: '#ff9000', pillar: 'mes' },
  { id: 'tumbling_dashboard', title: 'Дашборд Галтовки (TV)', icon: <LayoutDashboard />, path: '/tumbling-dashboard', desc: 'TV монітор галтовки', color: '#ff9000', pillar: 'mes' },
  { id: 'reception_terminal', title: 'Термінал Прийомки', icon: <Tablet />, path: '/reception-terminal', desc: 'Дільниця прийомки', color: '#ff9000', pillar: 'mes' },
  { id: 'sorting_terminal', title: 'Термінал Сортування', icon: <Tablet />, path: '/sorting-terminal', desc: 'Дільниця сортування', color: '#ff9000', pillar: 'mes' },
  { id: 'operator', title: 'Термінал Оператора', icon: <Tablet />, path: '/operator', desc: 'Спрощене робоче місце', color: '#ff9000', pillar: 'mes' },
  { id: 'warehouse_boxes', title: 'Бокси Фрез (СО)', icon: <Package />, path: '/warehouse-boxes', desc: 'Підготовка боксів інструменту', color: '#ff9000', pillar: 'mes' },
  { id: 'shop2', title: 'Цех №2 – Створення РК', icon: <Monitor />, path: '/shop2', desc: 'Черга нарядів Другого цеху', color: '#ff9000', pillar: 'mes' },
  { id: 'shop2_card_gen', title: 'Цех №2 – Створення РК (Буфер)', icon: <Monitor />, path: '/shop2-card-gen', desc: 'Формування РК Цеху №2 з буфера заготовок', color: '#ff9000', pillar: 'mes' },
  { id: 'shop2_terminal', title: 'Цех №2 · Термінал', icon: <Tablet />, path: '/shop2-terminal', desc: 'Пресування → Фарбування → Доопрацювання', color: '#ff9000', pillar: 'mes' },
  { id: 'pressing_terminal', title: 'Термінал Пресування', icon: <Tablet />, path: '/pressing-terminal', desc: 'Дільниця пресування', color: '#ff9000', pillar: 'mes' },
  { id: 'painting_terminal', title: 'Термінал Фарбування', icon: <Tablet />, path: '/painting-terminal', desc: 'Дільниця фарбування', color: '#ff9000', pillar: 'mes' },
  { id: 'foreman_dashboard', title: 'Дашборд 2.0 (TV)', icon: <LayoutDashboard />, path: '/foreman-dashboard', desc: 'Загальний монітор Цеху №1', color: '#ff9000', pillar: 'mes' },
  { id: 'brak', title: 'ВКЯ & Контроль Якості', icon: <AlertTriangle />, path: '/brak', desc: 'Облік браку та карантин деталей', color: '#ef4444', pillar: 'mes' }
]

const getAvailableModules = (currentUser, badgeCount, chatBadgeCount = 0) => {
  if (!currentUser) return [];
  const allModules = getAllModules(badgeCount, chatBadgeCount);
  const posLower = (currentUser?.position || '').toLowerCase();
  const roleLower = (currentUser?.role || '').toLowerCase();

  const isFullAccessUser = posLower.includes('адмін') || roleLower === 'admin';
  if (isFullAccessUser) return allModules;

  const rights = currentUser?.access_rights || {};

  const checkRight = (id) => {
    if (!id) return false;
    const val = rights[id];
    return val === true || val === 'true' || val === 1;
  };

  return allModules.filter(m => {
    if (m.id === 'simulator') return false;

    // Explicit exceptions that should bypass pillar hiding if explicitly checked
    if ((m.id === 'kanban' && checkRight('kanban')) || (m.id === 'chat' && checkRight('chat'))) {
      return true;
    }

    // Direct check
    if (checkRight(m.id)) return true;

    // CRM Pillar modules — enabled by default unless explicitly disabled
    if (m.pillar === 'crm') {
      if (rights.crm === false && rights.crm_clients === false && rights.manager === false) return false;
      return true;
    }

    // Aliases & fallbacks
    if (m.id === 'warehouse_fgp' && (checkRight('warehouse_fgp') || checkRight('warehouse'))) return true;
    if (m.id === 'warehouse_boxes' && (checkRight('warehouse_boxes') || checkRight('warehouse'))) return true;
    if (m.id === 'economy' && (checkRight('economy') || checkRight('director'))) return true;
    if (m.id === 'engineer_v2' && (checkRight('engineer_v2') || checkRight('engineer'))) return true;
    if (m.id === 'engineer' && (checkRight('engineer') || checkRight('engineer_v2'))) return true;
    if (m.id === 'foreman' && (checkRight('foreman') || checkRight('foreman2') || checkRight('master'))) return true;
    if (m.id === 'shop2_card_gen' && (checkRight('shop2_card_gen') || checkRight('shop2'))) return true;
    if (m.id === 'shop1_foreman' && (checkRight('shop1_foreman') || checkRight('master') || checkRight('foreman'))) return true;

    return false;
  });
}

const CATEGORY_MAP = {
  // CRM
  crm: 'crm',
  crm_clients: 'crm',
  manager: 'crm',
  chat: 'crm',
  kanban: 'crm',

  // ERP
  warehouse: 'erp',
  warehouse_fgp: 'erp',
  supply: 'erp',
  procurement: 'erp',
  economy: 'erp',
  packaging: 'erp',
  shipping: 'erp',
  director: 'erp',
  dashboard: 'erp',
  analytics: 'erp',
  reports: 'erp',
  access: 'erp',
  machines: 'erp',
  engineer: 'erp',
  engineer_v2: 'erp',
  cutter_restoration: 'erp',
  nomenclature: 'erp',
  nomenclature_v2: 'erp',
  settings: 'erp',
  simulator: 'erp',

  // MES
  master: 'mes',
  foreman: 'mes',
  foreman2: 'mes',
  shop1: 'mes',
  shop1_foreman: 'mes',
  prep_terminal: 'mes',
  preparation_dashboard: 'mes',
  tumbling_terminal: 'mes',
  tumbling_dashboard: 'mes',
  reception_terminal: 'mes',
  sorting_terminal: 'mes',
  operator: 'mes',
  warehouse_boxes: 'mes',
  shop2: 'mes',
  shop2_card_gen: 'mes',
  shop2_terminal: 'mes',
  pressing_terminal: 'mes',
  painting_terminal: 'mes',
  foreman_dashboard: 'mes',
  brak: 'mes'
};

const CATEGORIES = [
  { id: 'crm', title: 'CRM (Клієнти, Угоди та Продажі)', color: '#6366f1' },
  { id: 'erp', title: 'ERP (Склад, Ресурси та Керування)', color: '#10b981' },
  { id: 'mes', title: 'MES (Цехи, Наряди та Термінали)', color: '#ff9000' }
];

const useChatUnreadCount = (currentUser, supabase) => {
  const [chatUnreadCount, setChatUnreadCount] = useState(0)

  useEffect(() => {
    if (!currentUser?.id || !supabase || currentUser?.access_rights?.chat !== true) {
      setChatUnreadCount(0)
      return undefined
    }

    let cancelled = false
    let refreshTimer = null
    let refreshInFlight = null
    let rerunAfterFlight = false
    let hasLoaded = false
    let lastRefreshAt = 0
    let subscribedOnce = false
    let participantsByThread = new Map()
    let unreadByThread = new Map()
    const seenMessageIds = new Set()
    const rememberMessageId = (messageId) => {
      if (!messageId) return false
      const key = String(messageId)
      if (seenMessageIds.has(key)) return true
      seenMessageIds.add(key)
      if (seenMessageIds.size > 5000) {
        seenMessageIds.delete(seenMessageIds.values().next().value)
      }
      return false
    }

    const performRefresh = async () => {
      try {
        const { data: participantRows, error: participantError } = await supabase
          .from('chat_participants')
          .select('thread_id, last_read_at')
          .eq('user_id', currentUser.id)

        if (participantError) throw participantError
        if (!participantRows?.length) {
          participantsByThread = new Map()
          unreadByThread = new Map()
          seenMessageIds.clear()
          hasLoaded = true
          lastRefreshAt = Date.now()
          if (!cancelled) setChatUnreadCount(0)
          return
        }

        const nextParticipantsByThread = new Map(
          participantRows.map(row => [String(row.thread_id), row.last_read_at || null])
        )
        const threadIds = Array.from(nextParticipantsByThread.keys())

        const rpcUserId = Number(currentUser.id) || currentUser.id
        const { data: unreadRows, error: unreadRpcError } = await supabase
          .rpc('chat_unread_counts', { p_user_id: rpcUserId })

        if (!unreadRpcError) {
          const nextUnreadByThread = new Map(threadIds.map(threadId => [threadId, 0]))
          ;(unreadRows || []).forEach(row => {
            nextUnreadByThread.set(String(row.thread_id), Number(row.unread_count) || 0)
          })
          if (cancelled) return
          participantsByThread = nextParticipantsByThread
          unreadByThread = nextUnreadByThread
          hasLoaded = true
          lastRefreshAt = Date.now()
          setChatUnreadCount(Array.from(nextUnreadByThread.values()).reduce((sum, value) => sum + value, 0))
          return
        }

        const rpcErrorCode = String(unreadRpcError.code || '')
        const rpcErrorMessage = String(unreadRpcError.message || '').toLowerCase()
        const rpcIsUnavailable = ['PGRST202', '42883'].includes(rpcErrorCode) ||
          (rpcErrorMessage.includes('chat_unread_counts') && (
            rpcErrorMessage.includes('not find') ||
            rpcErrorMessage.includes('does not exist') ||
            rpcErrorMessage.includes('schema cache')
          ))
        if (!rpcIsUnavailable) throw unreadRpcError

        const validReadTimes = participantRows
          .map(row => row.last_read_at ? new Date(row.last_read_at).getTime() : 0)
          .filter(value => Number.isFinite(value) && value > 0)
        const canBoundByOldestRead = validReadTimes.length === participantRows.length
        const oldestReadAt = canBoundByOldestRead ? Math.min(...validReadTimes) : 0
        const messageRows = []
        const pageSize = 1000
        const maxUnreadRows = 5000

        for (let offset = 0; !cancelled && offset < maxUnreadRows; offset += pageSize) {
          const currentPageSize = Math.min(pageSize, maxUnreadRows - offset)
          let query = supabase
            .from('chat_messages')
            .select('id, thread_id, sender_id, created_at')
            .in('thread_id', threadIds)
            .is('deleted_at', null)
            .neq('sender_id', currentUser.id)
            .order('created_at', { ascending: true })
            .order('id', { ascending: true })
            .range(offset, offset + currentPageSize - 1)

          if (oldestReadAt) query = query.gt('created_at', new Date(oldestReadAt).toISOString())

          const { data: rows, error } = await query
          if (error) throw error
          messageRows.push(...(rows || []))
          if (!rows || rows.length < currentPageSize) break
        }

        if (cancelled) return

        const nextUnreadByThread = new Map(threadIds.map(threadId => [threadId, 0]))
        messageRows.forEach(message => {
          const threadId = String(message.thread_id)
          const lastReadAt = nextParticipantsByThread.get(threadId)
          const lastReadTime = lastReadAt ? new Date(lastReadAt).getTime() : 0
          const messageTime = new Date(message.created_at).getTime()
          if (!lastReadTime || messageTime > lastReadTime) {
            nextUnreadByThread.set(threadId, (nextUnreadByThread.get(threadId) || 0) + 1)
          }
          rememberMessageId(message.id)
        })

        participantsByThread = nextParticipantsByThread
        unreadByThread = nextUnreadByThread
        hasLoaded = true
        lastRefreshAt = Date.now()
        setChatUnreadCount(Array.from(nextUnreadByThread.values()).reduce((sum, value) => sum + value, 0))
      } catch (err) {
        const message = err?.message || ''
        if (!message.includes('chat_')) console.warn('Chat unread count failed:', err)
        if (!cancelled && !hasLoaded) setChatUnreadCount(0)
      }
    }

    const refreshUnread = () => {
      if (cancelled) return Promise.resolve()
      if (refreshInFlight) {
        rerunAfterFlight = true
        return refreshInFlight
      }

      refreshInFlight = performRefresh().finally(() => {
        refreshInFlight = null
        if (rerunAfterFlight && !cancelled) {
          rerunAfterFlight = false
          if (refreshTimer) clearTimeout(refreshTimer)
          refreshTimer = setTimeout(refreshUnread, 100)
        }
      })
      return refreshInFlight
    }

    const scheduleRefresh = (delay = 300, respectCooldown = false) => {
      if (cancelled) return
      const cooldownDelay = respectCooldown ? Math.max(0, 5000 - (Date.now() - lastRefreshAt)) : 0
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(refreshUnread, Math.max(delay, cooldownDelay))
    }

    const handleMessageChange = (payload) => {
      const row = payload.new || payload.old
      const messageId = row?.id ? String(row.id) : ''
      const threadId = row?.thread_id ? String(row.thread_id) : ''

      if (payload.eventType !== 'INSERT' || !row || !participantsByThread.has(threadId)) {
        if (payload.eventType !== 'INSERT' || !hasLoaded) scheduleRefresh(350)
        return
      }

      if (refreshInFlight) rerunAfterFlight = true
      if (rememberMessageId(messageId)) return
      if (row.deleted_at || String(row.sender_id) === String(currentUser.id)) return

      const lastReadAt = participantsByThread.get(threadId)
      const lastReadTime = lastReadAt ? new Date(lastReadAt).getTime() : 0
      const messageTime = new Date(row.created_at).getTime()
      if (lastReadTime && messageTime <= lastReadTime) return

      unreadByThread.set(threadId, (unreadByThread.get(threadId) || 0) + 1)
      setChatUnreadCount(value => value + 1)
    }

    refreshUnread()
    const channel = supabase
      .channel(`chat-unread-${currentUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, handleMessageChange)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_participants',
        filter: `user_id=eq.${currentUser.id}`
      }, () => scheduleRefresh(300))
      .subscribe(status => {
        if (status !== 'SUBSCRIBED') return
        if (subscribedOnce) scheduleRefresh(100)
        subscribedOnce = true
      })

    const handleVisibleRefresh = () => {
      if (document.visibilityState === 'visible') scheduleRefresh(100, true)
    }

    const handleFocusRefresh = () => scheduleRefresh(100, true)

    document.addEventListener('visibilitychange', handleVisibleRefresh)
    window.addEventListener('focus', handleFocusRefresh)

    return () => {
      cancelled = true
      if (refreshTimer) clearTimeout(refreshTimer)
      document.removeEventListener('visibilitychange', handleVisibleRefresh)
      window.removeEventListener('focus', handleFocusRefresh)
      supabase.removeChannel(channel)
    }
  }, [currentUser?.id, currentUser?.access_rights?.chat, supabase])

  return chatUnreadCount
}

const renderAvatar = (avatar, initials, size = '38px', fontSize = '0.85rem') => {
  const getGradient = (name) => {
    switch (name) {
      case 'purple': return 'linear-gradient(135deg, #a855f7, #6366f1)';
      case 'blue': return 'linear-gradient(135deg, #3b82f6, #06b6d4)';
      case 'emerald': return 'linear-gradient(135deg, #10b981, #059669)';
      case 'ruby': return 'linear-gradient(135deg, #f43f5e, #be123c)';
      case 'orange':
      default: return 'linear-gradient(135deg, #ff9000, #ff5500)';
    }
  };

  if (avatar && avatar.startsWith('data:image/')) {
    return (
      <img
        src={avatar}
        alt="Avatar"
        style={{
          width: size,
          height: size,
          borderRadius: '10px',
          objectFit: 'cover',
          border: '1px solid rgba(255,255,255,0.1)'
        }}
      />
    );
  }

  const grad = getGradient(avatar);
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '10px',
      background: grad,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontWeight: 1000,
      fontSize: fontSize,
      border: '1px solid rgba(255,255,255,0.1)',
      textShadow: '0 1px 2px rgba(0,0,0,0.2)'
    }}>
      {initials}
    </div>
  );
};

const GlobalUserNav = ({ chatUnreadCount = 0 }) => {
  const { currentUser, managementTasks, requests, workCards, purchaseRequests, receptionDocs, nomenclatures, machineCalls, machines, tasks, orders, bomItems, workCardHistory, fetchData, supabase, upsertUser, theme, toggleTheme } = useMES();
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

  // Profile management states
  const [settingsTab, setSettingsTab] = useState('notif'); // 'notif' or 'profile'
  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileLastName, setProfileLastName] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);


  // Open notification panel via mobile topbar bell (centrum:openNotifications event)
  useEffect(() => {
    const handler = () => { setMenuOpen(true); setActiveSubPanel('notifications'); };
    window.addEventListener('centrum:openNotifications', handler);
    return () => window.removeEventListener('centrum:openNotifications', handler);
  }, []);

  // Sync profile form states when panel is opened
  const wasOpenedRef = useRef(false);
  useEffect(() => {
    if (activeSubPanel === 'notif_settings') {
      if (!wasOpenedRef.current && currentUser) {
        setProfileFirstName(currentUser.first_name || '');
        setProfileLastName(currentUser.last_name || '');
        setProfilePassword(currentUser.password || '');
        setProfileAvatar(currentUser.avatar || currentUser.notification_settings?.avatar || '');
        setSettingsTab('notif');
        wasOpenedRef.current = true;
      }
    } else {
      wasOpenedRef.current = false;
    }
  }, [activeSubPanel, currentUser]);

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 128;
        canvas.height = 128;

        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 128, 128);

        const base64 = canvas.toDataURL('image/jpeg', 0.85);
        setProfileAvatar(base64);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    if (!profileFirstName.trim() || !profileLastName.trim()) {
      alert("Ім'я та Прізвище не можуть бути порожніми!");
      return;
    }
    setIsSavingProfile(true);
    try {
      const updatedSettings = {
        ...currentUser?.notification_settings,
        ...notifSettings,
        avatar: profileAvatar
      };

      const payload = {
        ...currentUser,
        first_name: profileFirstName.trim(),
        last_name: profileLastName.trim(),
        password: profilePassword,
        avatar: profileAvatar,
        notification_settings: updatedSettings
      };
      delete payload.token; // Clear token to prevent schema cache error in Supabase

      const { data, error } = await upsertUser(payload);
      if (error) {
        alert(`Помилка збереження: ${error.message}`);
      } else {
        localStorage.setItem('MES_SESSION_USER', JSON.stringify(data || payload));
        alert('Профіль успішно оновлено!');
      }
    } catch (err) {
      console.error(err);
      alert('Не вдалося зберегти зміни профілю.');
    } finally {
      setIsSavingProfile(false);
    }
  };

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
      } else {
        setNotifSettings({
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
      }
    }
  }, [currentUser]);

  const updateNotifSetting = async (key, val) => {
    const updated = { ...currentUser?.notification_settings, ...notifSettings, [key]: val };
    setNotifSettings(updated);
    localStorage.setItem(`notification_settings_${currentUser?.id}`, JSON.stringify(updated));

    if (currentUser?.id) {
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
  const prevNotificationsRef = useRef([]);
  const shownNotifsRef = useRef(new Set());
  const pageLoadTimeRef = useRef(Date.now());
  const [openCategories, setOpenCategories] = useState({
    crm: true,
    erp: true,
    mes: true
  });

  const [completedCards, setCompletedCards] = useState([]);
  const [completedHistory, setCompletedHistory] = useState([]);

  const isManager = useMemo(() => {
    if (!currentUser) return false;
    return (
      currentUser?.access_rights?.director ||
      currentUser?.access_rights?.master ||
      currentUser?.access_rights?.foreman ||
      (currentUser?.position && (
        currentUser.position.toLowerCase().includes('директор') ||
        currentUser.position.toLowerCase().includes('нач') ||
        currentUser.position.toLowerCase().includes('начальник') ||
        currentUser.position.toLowerCase().includes('майстер')
      ))
    );
  }, [currentUser]);

  const activeTasks = useMemo(() => {
    return (tasks || []).filter(t => t.status !== 'completed');
  }, [tasks]);
  const activeTaskIds = useMemo(() => [...new Set(activeTasks.map(task => task.id).filter(Boolean))], [activeTasks]);
  const activeTaskIdsKey = useMemo(() => activeTaskIds.map(String).sort().join('|'), [activeTaskIds]);
  const activeTaskIdSet = useMemo(() => new Set(activeTaskIds.map(String)), [activeTaskIdsKey]);
  const activeWorkCardIdsKey = useMemo(() => (workCards || [])
    .filter(card => activeTaskIdSet.has(String(card.task_id)))
    .map(card => String(card.id))
    .sort()
    .join('|'), [workCards, activeTaskIdSet]);

  // The global bell used to force every screen (including the portal) to load
  // production, warehouse and management datasets. Load only the sources the
  // current user may see, and only after they explicitly open notifications.
  useEffect(() => {
    if (activeSubPanel !== 'notifications' || !currentUser?.id) return;

    const moduleIds = new Set(getAvailableModules(currentUser, 0).map(module => module.id));
    const hasAnyModule = (...ids) => ids.some(id => moduleIds.has(id));
    const targets = new Set();

    if (moduleIds.has('kanban')) targets.add('management_tasks');

    if (hasAnyModule('director', 'master', 'foreman', 'shop1', 'shop2', 'shop2_terminal', 'packaging')) {
      ['orders', 'tasks', 'work_cards', 'nomenclatures', 'bom_items']
        .forEach(tableName => targets.add(tableName));
    }

    if (hasAnyModule('warehouse', 'supply', 'master', 'foreman', 'director')) {
      ['material_requests', 'orders', 'tasks'].forEach(tableName => targets.add(tableName));
    }

    if (hasAnyModule('warehouse', 'supply', 'procurement')) {
      ['purchase_requests', 'reception_docs'].forEach(tableName => targets.add(tableName));
    }

    if (hasAnyModule('master', 'foreman', 'engineer', 'brak', 'machines')) {
      ['machine_calls', 'machines'].forEach(tableName => targets.add(tableName));
    }

    if (targets.size > 0) {
      fetchData([...targets]).catch(error => console.warn('Notification data refresh failed:', error));
    }
  }, [activeSubPanel, currentUser?.id]);

  useEffect(() => {
    if (activeSubPanel !== 'notifications' || !currentUser?.id || !isManager || activeTaskIds.length === 0) {
      setCompletedCards([]);
      setCompletedHistory([]);
      return;
    }

    let cancelled = false;
    const loadCompletedNotificationData = async () => {
      try {
        const chunkSize = 40;
        const cardsData = [];
        for (let offset = 0; offset < activeTaskIds.length; offset += chunkSize) {
          const { data, error } = await supabase
            .from('work_cards')
            .select('*')
            .in('task_id', activeTaskIds.slice(offset, offset + chunkSize))
            .eq('status', 'completed');
          if (error) throw error;
          cardsData.push(...(data || []));
        }

        if (cancelled) return;
        setCompletedCards(cardsData);

        const activeCardIds = (workCards || [])
          .filter(card => activeTaskIdSet.has(String(card.task_id)))
          .map(card => card.id)
        const cardIds = [...new Set([...cardsData.map(card => card.id), ...activeCardIds].filter(Boolean))];
        const historyData = [];
        for (let offset = 0; offset < cardIds.length; offset += chunkSize) {
          const { data, error } = await supabase
            .from('work_card_history')
            .select('card_id, nomenclature_id, scrap_qty')
            .in('card_id', cardIds.slice(offset, offset + chunkSize));
          if (error) throw error;
          historyData.push(...(data || []));
        }

        if (!cancelled) setCompletedHistory(historyData);
      } catch (error) {
        if (!cancelled) console.error('Error fetching completed cards for notifications:', error);
      }
    };

    loadCompletedNotificationData();
    return () => { cancelled = true; };
  }, [activeSubPanel, currentUser?.id, isManager, activeTaskIdsKey, activeWorkCardIdsKey, supabase]);

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

    // 0. New Orders awaiting Batch/Task Creation
    const hasOrderCreationAccess = hasModule('director') || hasModule('master') || hasModule('foreman');
    if (hasOrderCreationAccess && orders) {
      orders.forEach(order => {
        if (order.order_num && (order.order_num.startsWith('ВБ') || order.order_num.startsWith('VB'))) return;

        const orderTasks = (tasks || []).filter(t => t.order_id === order.id);
        if (orderTasks.length === 0 && order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'shipped') {
          let path = '/';
          if (hasModule('master')) path = '/master';
          else if (hasModule('foreman')) path = '/foreman';
          else if (hasModule('director')) path = '/director';

          const productNames = (order.order_items || [])
            .map(it => nomenclatures?.find(n => n.id === it.nomenclature_id)?.name)
            .filter(Boolean)
            .join(', ') || '—';

          list.push({
            id: `order-new-${order.id}`,
            type: 'order_new',
            title: `Нове замовлення № ${order.order_num}`,
            description: `Очікує на створення наряду. Виріб: ${productNames}`,
            createdAt: order.created_at,
            path,
            color: '#3b82f6',
            icon: <Monitor size={14} />
          });
        }
      });
    }

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
      const groups = {};
      requests.forEach(r => {
        if (r.status === 'pending') {
          const order = orders?.find(o => o.id === r.order_id);
          const orderNum = order?.order_num || '';

          let batchIndex = '';
          if (r.details) {
            // Extract batch index (e.g. 02062026-01/1)
            const batchMatch = r.details.match(/\(([^)]+\/\d+)\)/);
            if (batchMatch) {
              const parts = batchMatch[1].split('/');
              batchIndex = parts[parts.length - 1]; // Get '1' from '02062026-01/1'
            }
          }
          if (!batchIndex && r.task_id && tasks) {
            const task = tasks.find(t => t.id === r.task_id);
            if (task?.batch_index) batchIndex = task.batch_index;
          }

          const groupKey = `${r.order_id}_${r.task_id || 'null'}_${batchIndex || 'no-batch'}`;

          if (!groups[groupKey]) {
            groups[groupKey] = {
              orderId: r.order_id,
              orderNum: orderNum,
              batchIndex: batchIndex,
              taskId: r.task_id,
              count: 0,
              items: [],
              latestCreatedAt: r.created_at
            };
          }

          groups[groupKey].count += 1;
          if (r.created_at > groups[groupKey].latestCreatedAt) {
            groups[groupKey].latestCreatedAt = r.created_at;
          }

          let itemName = '';
          if (r.details) {
            const splitCol = r.details.split(': ');
            if (splitCol.length > 1) {
              itemName = splitCol[1].split(' — ')[0];
            } else {
              itemName = r.details;
            }
          }
          if (itemName) {
            groups[groupKey].items.push(itemName);
          }
        }
      });

      Object.entries(groups).forEach(([key, g]) => {
        let path = '/';
        if (hasModule('supply')) path = '/supply';
        else if (hasModule('warehouse')) path = '/warehouse';
        else if (hasModule('foreman')) path = '/foreman';
        else if (hasModule('master')) path = '/master';
        else if (hasModule('director')) path = '/director';

        const batchStr = g.batchIndex ? `/${g.batchIndex}` : '';
        const orderPart = g.orderNum ? ` (№ ${g.orderNum}${batchStr})` : '';

        let desc = '';
        if (g.count === 1) {
          desc = g.items[0] || 'Новий запит матеріалу';
        } else {
          desc = `Запит на ${g.count} позицій: ${g.items.slice(0, 3).join(', ')}${g.items.length > 3 ? '...' : ''}`;
        }

        list.push({
          id: `req-group-${key}`,
          type: 'request',
          title: `Запит матеріалів${orderPart}`,
          description: desc,
          createdAt: g.latestCreatedAt,
          path,
          color: '#10b981',
          icon: <ClipboardList size={14} />,
          state: { highlightTaskId: g.taskId }
        });
      });
    }

    // 3. Work Cards (Shop 1 or Shop 2)
    if (workCards) {
      workCards.forEach(w => {
        if (w.status === 'new') {
          const op = (w.operation || '').toLowerCase();
          const isShop1 = ['розкрій', 'галтовка', 'прийомка'].some(o => op.includes(o));
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
          if (rec.target_warehouse === 'operational' && hasModule('warehouse')) {
            path = '/warehouse';
          } else if (rec.target_warehouse === 'production' && hasModule('supply')) {
            path = '/supply';
          } else {
            if (hasModule('procurement')) path = '/procurement';
            else if (hasModule('supply')) path = '/supply';
            else if (hasModule('warehouse')) path = '/warehouse';
          }

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

    // 7. Shortage / Dovyпуск notifications for Managers
    if (isManager && tasks) {
      const prodCache = {};
      const sCache = {};
      const rCache = {};

      const activeTaskIds = new Set(activeTasks.map(t => t.id));
      const activeCards = workCards.filter(c => activeTaskIds.has(c.task_id));
      const allCards = [...activeCards, ...completedCards];

      const countAsProduced = (card) => {
        if (card.status === 'completed') return true;
        if (card.status === 'at-shop2-buffer') return true;
        return false;
      };

      allCards.forEach(card => {
        const tid = card.task_id;
        const nid = String(card.nomenclature_id);

        if (!prodCache[tid]) prodCache[tid] = {};
        if (!sCache[tid]) sCache[tid] = {};
        if (!rCache[tid]) rCache[tid] = {};

        if (countAsProduced(card)) {
          prodCache[tid][nid] = (prodCache[tid][nid] || 0) + (Number(card.quantity) || 0);
        }

        const isRedo = (card.card_info || '').includes('[REDO]');
        const isActive = !countAsProduced(card);
        if (isRedo && isActive) {
          rCache[tid][nid] = true;
        }
      });

      const activeCardIds = new Set(activeCards.map(c => c.id));
      const activeHistory = (workCardHistory || []).filter(h => h.card_id && activeCardIds.has(h.card_id));
      const allHistory = [...completedHistory, ...activeHistory];

      const cardScrapCache = {};
      allHistory.forEach(h => {
        if (h.card_id) {
          cardScrapCache[h.card_id] = (cardScrapCache[h.card_id] || 0) + (Number(h.scrap_qty) || 0);
        }
        const card = allCards.find(c => c.id === h.card_id);
        if (card) {
          const tid = card.task_id;
          const nid = String(card.nomenclature_id);
          if (!sCache[tid]) sCache[tid] = {};
          sCache[tid][nid] = (sCache[tid][nid] || 0) + (Number(h.scrap_qty) || 0);
        }
      });

      activeTasks.forEach(task => {
        const snapshot = task.plan_snapshot || {};
        const taskScrap = sCache[task.id] || {};
        const taskRedo = rCache[task.id] || {};
        const taskCards = allCards.filter(c => c.task_id === task.id);

        let hasShortage = false;
        let shortageDetails = '';

        Object.keys(snapshot).forEach(nomIdStr => {
          if (hasShortage) return;
          const nom = nomenclatures.find(n => String(n.id) === String(nomIdStr));
          if (nom?.type !== 'part') return;
          const snap = snapshot[nomIdStr];
          if (!snap) return;

          const need = snap.need || 0;
          const stockBZ = snap.stock || 0;
          const unitsPerSheet = snap.units_per_sheet || 1;

          const activeCardsForNom = taskCards.filter(c => String(c.nomenclature_id) === String(nomIdStr));
          const activeProductionCards = activeCardsForNom.filter(c => c.operation !== 'Склад БЗ');
          if (activeProductionCards.length === 0) return;

          const totalSheets = activeCardsForNom.reduce((sum, c) => {
            if (c.operation === 'Склад БЗ') return sum;
            const cardScrap = cardScrapCache[c.id] || 0;
            const originalQty = (Number(c.quantity) || 0) + cardScrap;
            return sum + (c.actualSheets ? Number(c.actualSheets) : Math.ceil(originalQty / unitsPerSheet));
          }, 0);

          const totalBZ = (totalSheets * unitsPerSheet) + stockBZ - need;
          const groupScrap = taskScrap[nomIdStr] || 0;
          const shortage = (totalBZ - groupScrap) < 0 ? Math.abs(totalBZ - groupScrap) : 0;

          if (shortage > 0) {
            hasShortage = true;
            shortageDetails = `${nom.name || 'деталь'} (нестача: ${shortage} шт.)`;
          }
        });

        if (hasShortage) {
          const order = orders?.find(o => o.id === task.order_id);
          const orderNum = order ? order.order_num : '???';
          const customer = order ? order.customer : '???';

          list.push({
            id: `shortage-${task.id}`,
            type: 'shortage',
            title: `⚠️ Потрібен довипуск: Наряд №${orderNum}`,
            description: `Нестача по: ${shortageDetails}. Замовник: ${customer}`,
            createdAt: task.created_at || new Date().toISOString(),
            path: '/foreman',
            state: { taskId: task.id },
            color: '#ef4444',
            icon: <AlertTriangle size={14} />
          });
        }
      });
    }

    // 8. Notifications for Shop 1 Manager / Director of Production about tasks ready to close
    const isShop1ManagerOrDirector = currentUser && (
      currentUser.access_rights?.director ||
      currentUser.access_rights?.master ||
      currentUser.access_rights?.foreman ||
      (currentUser.position && (
        currentUser.position.toLowerCase().includes('директор') ||
        (currentUser.position.toLowerCase().includes('начальник') && currentUser.position.toLowerCase().includes('цех')) ||
        currentUser.position.toLowerCase().includes('майстер') ||
        currentUser.position.toLowerCase().includes('бригадир')
      ))
    );

    if (isShop1ManagerOrDirector && tasks && orders) {
      // Find active tasks that belong to Shop 1 (not Shop 2 / Tumbling / etc steps, or step is specifically Shop 1)
      const shop1Tasks = tasks.filter(t =>
        t.status !== 'completed' &&
        !(t.step?.includes('Пресування') || t.step?.includes('ЦЕХ №2') || t.step?.includes('Доопрацювання'))
      );

      shop1Tasks.forEach(task => {
        const orderObj = orders.find(o => o.id === task.order_id);
        if (!orderObj) return;

        // Check if all display parts are completed
        const snapshot = task.plan_snapshot || {};
        const snapshotValues = Object.values(snapshot).filter(v => v && typeof v === 'object' && v.id && v.is_rework);

        let itemsToCheck = [];
        if (snapshotValues.length > 0) {
          itemsToCheck = snapshotValues.map(s => ({
            nom: (nomenclatures || []).find(n => String(n.id) === String(s.id)) || { id: s.id, name: s.name, type: 'part' }
          }));
        } else {
          itemsToCheck = (orderObj.order_items || []).flatMap(item => {
            const parentId = item?.nomenclature_id;
            const parts = bomItems.filter(b => b.parent_id === parentId).map(b => ({
              ...b,
              nom: nomenclatures.find(n => n.id === b.child_id)
            }));
            if (parts.length > 0) {
              return parts.map(p => ({ nom: p.nom }));
            }
            return [{ nom: (nomenclatures || []).find(n => String(n?.id) === String(item?.nomenclature_id)) }];
          });
        }

        const filteredParts = itemsToCheck.filter(item => item.nom?.type === 'part');
        if (filteredParts.length === 0) return;

        // Check if task is ready to be closed in Shop 1 (all cards generated are completed, and totalQty matched)
        const taskCards = (workCards || []).filter(c => String(c.task_id) === String(task.id));
        const allCards = [
          ...taskCards,
          ...(completedCards || []).filter(sc => String(sc.task_id) === String(task.id))
        ];

        // Has to have at least one card created, and all created cards must be completed
        const hasCards = allCards.length > 0;
        const allCompleted = hasCards && allCards.every(c => c.status === 'completed' || c.status === 'at-shop2-buffer');

        if (allCompleted) {
          const orderNum = orderObj.order_num || '???';
          list.push({
            id: `ready-close-s1-${task.id}`,
            type: 'ready_close_s1',
            title: `✅ Наряд №${orderNum} виконано в Цеху 1!`,
            description: `Всі карти розкрою завершені. Потрібно закрити наряд у Цеху №1 для передачі в Цех №2.`,
            createdAt: task.updated_at || task.created_at || new Date().toISOString(),
            path: '/foreman',
            state: { highlightTaskId: task.id },
            color: '#10b981',
            icon: <ClipboardList size={14} />
          });
        }
      });
    }

    // 9. Notifications for Shop 2 Manager / Director of Production about tasks ready to close
    const isShop2ManagerOrDirector = currentUser && (
      currentUser.access_rights?.director ||
      (currentUser.position && (
        currentUser.position.toLowerCase().includes('директор') ||
        (currentUser.position.toLowerCase().includes('начальник') && currentUser.position.toLowerCase().includes('цех'))
      )) ||
      hasModule('shop2')
    );

    if (isShop2ManagerOrDirector && tasks && orders) {
      // Find tasks that are in status !== 'completed' and are ready to close in Shop 2
      // Step contains 'Пресування', 'ЦЕХ №2', or 'Доопрацювання'
      const shop2Tasks = tasks.filter(t =>
        t.status !== 'completed' &&
        (t.step?.includes('Пресування') || t.step?.includes('ЦЕХ №2') || t.step?.includes('Доопрацювання'))
      );

      shop2Tasks.forEach(task => {
        const orderObj = orders.find(o => o.id === task.order_id);
        if (!orderObj) return;

        // Check if all display items for the task are completed
        // We replicate checkIfTaskIsAllDone logic here using nomenclatures, tasks, workCards, etc.
        const snapshot = task.plan_snapshot || {};
        const arrivals = snapshot.arrivals || [];

        // Determine BOM display items
        let itemsToCheck = [];
        const snapshotValues = Object.values(snapshot).filter(v => v && typeof v === 'object' && v.id && v.is_rework);
        if (snapshotValues.length > 0) {
          itemsToCheck = snapshotValues.map(s => ({
            nom: (nomenclatures || []).find(n => String(n.id) === String(s.id)) || { id: s.id, name: s.name, type: 'part' },
            need: Number(s.need) || 0
          }));
        } else if (arrivals.length > 0) {
          itemsToCheck = arrivals.map(a => ({
            nom: (nomenclatures || []).find(n => String(n?.id) === String(a?.id)),
            need: Number(snapshot[String(a?.id)]?.plan ?? snapshot[String(a?.id)]?.need ?? a?.semi ?? 0)
          }));
        } else {
          itemsToCheck = (orderObj.order_items || []).flatMap(item => {
            const parentId = item?.nomenclature_id;
            const parts = bomItems.filter(b => b.parent_id === parentId).map(b => ({
              ...b,
              nom: nomenclatures.find(n => n.id === b.child_id)
            }));
            if (parts.length > 0) {
              return parts.map(p => ({
                nom: p.nom,
                need: Number(snapshot[String(p.nom?.id)]?.plan ?? snapshot[String(p.nom?.id)]?.need ?? (Number(item?.quantity) || 0) * (Number(p.quantity_per_parent) || 1))
              }));
            }
            return [{
              nom: (nomenclatures || []).find(n => String(n?.id) === String(item?.nomenclature_id)),
              need: Number(snapshot[String(item?.nomenclature_id)]?.plan ?? snapshot[String(item?.nomenclature_id)]?.need ?? item?.quantity ?? 0)
            }];
          });
        }

        const filteredParts = itemsToCheck.filter(item => item.nom?.type === 'part');
        if (filteredParts.length === 0) return;

        const s1Task = tasks.find(t =>
          String(t.order_id) === String(task.order_id) &&
          t.batch_index === task.batch_index &&
          !(t.step?.includes('Пресування') || t.step?.includes('ЦЕХ №2') || t.step?.includes('Доопрацювання'))
        );

        const isReworkOrDirectTask = !s1Task || 
          task.step?.includes('Доопрацювання') || 
          orderObj?.order_num?.startsWith('ВБ') || 
          Boolean(task.plan_snapshot && Object.values(task.plan_snapshot).some(v => v && typeof v === 'object' && v.is_rework));

        let isAllDone = false;
        if (isReworkOrDirectTask || (s1Task && s1Task.status === 'completed')) {
          // Check if there are any uncompleted work cards in Shop 2 for this task
          const taskCards = (workCards || []).filter(wc => String(wc.task_id) === String(task.id));
          const hasUncompleted = taskCards.some(wc => wc.status !== 'completed');

          if (!hasUncompleted) {
            isAllDone = filteredParts.every(item => {
              const nomId = item.nom?.id;
              if (!nomId) return true;

              // Calculate remaining buffer in Shop 2
              const bufSrcCards = (workCards || []).filter(c =>
                (s1Task ? String(c.task_id) === String(s1Task.id) : String(c.order_id) === String(task.order_id)) &&
                String(c.nomenclature_id) === String(nomId) &&
                c.status === 'at-shop2-buffer'
              );
              const bufTotal = bufSrcCards.reduce((s, c) => s + (Number(c.quantity) || 0), 0);
              const bufUsed = bufSrcCards.reduce((s, c) => s + (Number(c.used_in_shop2_qty) || 0), 0);
              const total2 = bufTotal - bufUsed;

              if (total2 > 0) {
                return false;
              }
              return true;
            });
          }
        }

        if (isAllDone) {
          const orderNum = orderObj.order_num || '???';
          list.push({
            id: `ready-close-${task.id}`,
            type: 'ready_close',
            title: `✅ Наряд №${orderNum} виконано!`,
            description: `Всі деталі виготовлено. Потрібно закрити наряд у Цеху №2 для передачі на Пакування.`,
            createdAt: task.updated_at || task.created_at || new Date().toISOString(),
            path: '/shop2',
            state: { highlightTaskId: task.id },
            color: '#10b981',
            icon: <ClipboardList size={14} />
          });
        }
      });
    }

    // 10. Notifications for Packers and Director of Production when a Shop 2 task is closed (completed)
    const isPackerOrDirector = currentUser && (
      currentUser.access_rights?.director ||
      currentUser.access_rights?.packaging ||
      (currentUser.position && (
        currentUser.position.toLowerCase().includes('пакув') ||
        currentUser.position.toLowerCase().includes('директор')
      ))
    );

    if (isPackerOrDirector && tasks && orders) {
      // Completed tasks from Shop 2 that are not yet marked as fully packaged
      const completedShop2Tasks = tasks.filter(t =>
        t.status === 'completed' &&
        (t.step?.includes('Пресування') || t.step?.includes('ЦЕХ №2') || t.step?.includes('Доопрацювання')) &&
        t.plan_snapshot?._metadata?.is_packaged !== true
      );

      completedShop2Tasks.forEach(task => {
        const orderObj = orders.find(o => o.id === task.order_id);
        if (!orderObj) return;

        const orderNum = orderObj.order_num || '???';
        const bIdx = task.batch_index || '1';

        list.push({
          id: `ready-package-${task.id}`,
          type: 'ready_package',
          title: `📦 Наряд №${orderNum}/${bIdx} готовий до Пакування!`,
          description: `Наряд закрито в Цеху №2. Можна починати комплектування та пакування замовлення.`,
          createdAt: task.updated_at || task.created_at || new Date().toISOString(),
          path: '/packaging',
          state: { highlightTaskId: task.id },
          color: '#f43f5e',
          icon: <Package size={14} />
        });
      });
    }

    const filteredList = list.filter(n => {
      if (n.type === 'order_new') return notifSettings.new_order !== false;
      if (n.type === 'task') return notifSettings.kanban !== false;
      if (n.type === 'request') {
        const isPackaging = n.title?.toLowerCase().includes('комплектування') || n.description?.toLowerCase().includes('комплектування');
        return isPackaging ? notifSettings.packaging_request !== false : notifSettings.material_request !== false;
      }
      if (n.type === 'purchase_request') return notifSettings.supply_request !== false;
      if (n.type === 'machine_call') return notifSettings.machine_call !== false;
      if (n.type === 'shortage') return notifSettings.shortage !== false;
      if (n.type === 'ready_close_s1' || n.type === 'ready_close') return notifSettings.task_completed !== false;
      if (n.type === 'ready_package') return notifSettings.packaging_request !== false;
      return true;
    });

    const uniqueFilteredList = [];
    const seenIds = new Set();
    filteredList.forEach(n => {
      if (!seenIds.has(n.id)) {
        seenIds.add(n.id);
        uniqueFilteredList.push(n);
      }
    });

    return uniqueFilteredList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [currentUser, managementTasks, requests, workCards, purchaseRequests, receptionDocs, machineCalls, machines, isManager, activeTasks, completedCards, completedHistory, tasks, orders, bomItems, workCardHistory, notifSettings]);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !readIds.includes(n.id)).length;
  }, [notifications, readIds]);

  // Підписуємо пристрій на Web Push кожного разу при вході з нового пристрою
  useEffect(() => {
    if (!currentUser?.id) return;
    // Невелика затримка щоб SW встиг зареєструватись
    const timer = setTimeout(() => {
      subscribeToPush(currentUser.id).then(ok => {
        if (ok) console.log('[Push] ✅ Пристрій підписано для юзера', currentUser.id);
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [currentUser?.id]);

  // Listen to SW navigation messages
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'NAVIGATE') {
        navigate(event.data.path, event.data.state ? { state: event.data.state } : undefined);
      }
      if (event.data && event.data.type === 'SUBSCRIPTION_CHANGED' && currentUser?.id) {
        // Браузер сам оновив підписку — зберігаємо нову
        subscribeToPush(currentUser.id);
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, [navigate, currentUser?.id]);

  // Monitor notifications and trigger HTML5 Push when a new unread notification arrives
  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    // Find new notifications that were not present in previous render and are unread
    const prevIds = new Set((prevNotificationsRef.current || []).map(n => n.id));

    // We only trigger pushes for notifications created after page load (minus a 5s buffer to account for clock skew)
    // and that have not been shown in the current browser session.
    const cutoffTime = pageLoadTimeRef.current - 5000;
    const newUnread = notifications.filter(n => {
      const created = new Date(n.createdAt).getTime();

      // Skip local browser notifications for types already sent via Web Push to avoid duplicates
      const webPushTypes = ['order_new', 'request', 'reception_doc', 'purchase_request', 'machine_call'];
      if (webPushTypes.includes(n.type)) return false;

      // Coordinate between multiple open tabs using localStorage
      const storageKey = `centrum_shown_notif_${n.id}`;
      const lastShown = localStorage.getItem(storageKey);
      if (lastShown && Date.now() - Number(lastShown) < 30000) {
        return false;
      }

      return created > cutoffTime &&
        !prevIds.has(n.id) &&
        !readIds.includes(n.id) &&
        !shownNotifsRef.current.has(n.id);
    });

    newUnread.forEach(n => {
      try {
        shownNotifsRef.current.add(n.id);
        localStorage.setItem(`centrum_shown_notif_${n.id}`, String(Date.now()));
        const options = {
          body: n.description,
          icon: '/kulytsya.png', // Fallback to logo
          tag: n.id, // Prevent duplicates
          data: {
            id: n.id,
            title: n.title,
            description: n.description,
            path: n.path,
            state: n.state,
            link: n.link
          }
        };

        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(n.title, options);
          }).catch(err => {
            const notif = new Notification(n.title, options);
            notif.onclick = () => {
              window.focus();
              handleNotificationClick(n);
              notif.close();
            };
          });
        } else {
          const notif = new Notification(n.title, options);
          notif.onclick = () => {
            window.focus();
            handleNotificationClick(n);
            notif.close();
          };
        }
      } catch (err) {
        console.warn('Failed to trigger native notification:', err);
      }
    });

    // Update ref for next render comparison
    prevNotificationsRef.current = notifications;
  }, [notifications, readIds]);

  const handleNotificationClick = (n) => {
    if (!readIds.includes(n.id)) {
      setReadIds(prev => [...prev, n.id]);
    }
    handleCloseMenu();
    navigate(n.path, n.state ? { state: n.state } : undefined);
  };

  const handleMarkAllAsRead = () => {
    const allIds = notifications.map(n => n.id);
    setReadIds(prev => {
      const unique = new Set([...prev, ...allIds]);
      return Array.from(unique);
    });
  };

  // Auto-close menu on route navigation
  useEffect(() => {
    setMenuOpen(false);
    setActiveSubPanel(null);
  }, [location.pathname]);

  if (location.pathname === '/login') return null;
  if (!currentUser) return null;

  const isAdmin = currentUser.position === 'Адмін' || currentUser.role === 'admin';
  if (isAdmin) return null;

  // Kanban task count badge remains on the menu item itself
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
          /* Header: full width */
          .sidebar-drawer > div > div:nth-child(1) {
            width: 100% !important;
            padding: 12px 20px !important;
          }
          /* Profile and Notification row: full width or hidden profile, let's stack them nicely */
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
          /* Scrollable Links container: left column */
          .sidebar-links-container {
            width: 55% !important;
            flex: none !important;
            height: calc(100vh - 120px) !important;
            padding: 10px !important;
            border-right: 1px solid rgba(255,255,255,0.04) !important;
          }
          /* Footer with support and logout: right column */
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
      <div className="no-print floating-hamburger-wrapper" style={{ position: 'fixed', top: '15px', left: '20px', zIndex: 99998 }}>
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

        {/* Sliding Notifications Settings Sub-Panel */}
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
          transform: activeSubPanel === 'notif_settings' ? 'translateX(0)' : 'translateX(100%)',
          pointerEvents: activeSubPanel === 'notif_settings' ? 'auto' : 'none'
        }}>
          {/* Header section with Back */}
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
              Налаштування
            </span>
          </div>

          {/* Tab Selector */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '0 20px' }}>
            <button
              onClick={() => setSettingsTab('notif')}
              style={{
                flex: 1,
                padding: '12px 0',
                background: 'transparent',
                border: 'none',
                borderBottom: settingsTab === 'notif' ? '2.5px solid #ff9000' : '2.5px solid transparent',
                color: settingsTab === 'notif' ? '#fff' : '#555',
                fontWeight: 850,
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                outline: 'none'
              }}
            >
              Сповіщення
            </button>
            <button
              onClick={() => setSettingsTab('profile')}
              style={{
                flex: 1,
                padding: '12px 0',
                background: 'transparent',
                border: 'none',
                borderBottom: settingsTab === 'profile' ? '2.5px solid #ff9000' : '2.5px solid transparent',
                color: settingsTab === 'profile' ? '#fff' : '#555',
                fontWeight: 850,
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                outline: 'none'
              }}
            >
              Профіль
            </button>
          </div>

          {/* Settings List */}
          <div className="sidebar-links-container" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            {settingsTab === 'notif' ? (
              <>
                <div style={{ fontSize: '0.65rem', color: '#555', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '15px' }}>
                  Керування типами сповіщень
                </div>

                {(() => {
                  const notifConfig = [
                    { key: 'new_order', title: '📦 Нові замовлення', desc: 'Надсилати при створенні менеджером нового замовлення (очікує на створення наряду)' },
                    { key: 'material_request', title: '📋 Запити матеріалів (ТМЦ)', desc: 'Надсилати при створенні майстром запиту на сировину чи матеріали зі складу' },
                    { key: 'packaging_request', title: '📦 Комплектування та Пакування', desc: 'Надсилати при появі нових запитів на комплектування деталей для пакування замовлень' },
                    { key: 'ready_to_ship', title: '🚚 Готовність до відвантаження', desc: 'Надсилати, коли партія повністю запакована і очікує логістичного відвантаження' },
                    { key: 'supply_request', title: '🛒 Запити на закупівлю (Постачання)', desc: 'Надсилати при потребі закупівлі відсутніх матеріалів постачальниками' },
                    { key: 'machine_call', title: '⚠️ Виклики персоналу', desc: 'Надсилати при терміновому виклику оператором допомоги (майстра, інженера, ВКЯ) до верстату' },
                    { key: 'shortage', title: '🚨 Нестачі та довипуски', desc: 'Надсилати при виявленні браку та необхідності довипуску деталей для замовлення' },
                    { key: 'kanban', title: '📋 Задачі Kanban', desc: 'Надсилати при призначенні вам нових завдань або оновленні задач на дошці Kanban' },
                    { key: 'task_completed', title: '✅ Виконання нарядів та етапів', desc: 'Надсилати, коли всі карти розкрою завершені та наряд готовий до закриття у цеху' },
                  ];
                  return notifConfig.map(cfg => (
                    <div key={cfg.key} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.01)',
                      border: '1px solid rgba(255, 255, 255, 0.03)',
                      marginBottom: '12px'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, paddingRight: '12px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fff' }}>{cfg.title}</span>
                        <span style={{ fontSize: '0.68rem', color: '#555', lineHeight: '1.2' }}>
                          {cfg.desc}
                        </span>
                      </div>
                      <div
                        onClick={() => updateNotifSetting(cfg.key, !notifSettings[cfg.key])}
                        style={{
                          width: '40px',
                          height: '22px',
                          borderRadius: '11px',
                          background: notifSettings[cfg.key] ? '#ff9000' : '#222',
                          position: 'relative',
                          cursor: 'pointer',
                          transition: 'background 0.2s ease',
                          flexShrink: 0
                        }}
                      >
                        <div style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          background: '#fff',
                          position: 'absolute',
                          top: '2px',
                          left: notifSettings[cfg.key] ? '20px' : '2px',
                          transition: 'left 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                        }} />
                      </div>
                    </div>
                  ));
                })()}
              </>
            ) : (
              /* Profile tab content */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* Avatar section */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '10px 0' }}>
                  <div style={{ position: 'relative' }}>
                    {renderAvatar(
                      profileAvatar,
                      (profileFirstName?.[0] || '') + (profileLastName?.[0] || ''),
                      '80px',
                      '1.8rem'
                    )}
                    <label
                      htmlFor="avatar-upload-input"
                      style={{
                        position: 'absolute',
                        bottom: '-4px',
                        right: '-4px',
                        background: '#ff9000',
                        color: '#000',
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                        border: '2px solid #080808'
                      }}
                      title="Завантажити фото"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                    </label>
                    <input
                      type="file"
                      id="avatar-upload-input"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      style={{ display: 'none' }}
                    />
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#666' }}>Натисніть на іконку для завантаження фото</span>

                  {/* Preset Gradients Selection */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    {['orange', 'purple', 'blue', 'emerald', 'ruby'].map(g => (
                      <button
                        key={g}
                        onClick={() => setProfileAvatar(g)}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          border: profileAvatar === g ? '2px solid #fff' : '2.5px solid transparent',
                          cursor: 'pointer',
                          padding: 0,
                          background: g === 'orange' ? 'linear-gradient(135deg, #ff9000, #ff5500)' :
                            g === 'purple' ? 'linear-gradient(135deg, #a855f7, #6366f1)' :
                              g === 'blue' ? 'linear-gradient(135deg, #3b82f6, #06b6d4)' :
                                g === 'emerald' ? 'linear-gradient(135deg, #10b981, #059669)' :
                                  'linear-gradient(135deg, #f43f5e, #be123c)',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                          transition: 'all 0.1s ease'
                        }}
                        title={`Пресет: ${g}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Form fields */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800, textTransform: 'uppercase' }}>Ім'я</label>
                    <input
                      type="text"
                      value={profileFirstName}
                      onChange={e => setProfileFirstName(e.target.value)}
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        color: '#fff',
                        fontSize: '0.85rem',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                        width: '100%'
                      }}
                      onFocus={e => e.target.style.borderColor = '#ff9000'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.06)'}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800, textTransform: 'uppercase' }}>Прізвище</label>
                    <input
                      type="text"
                      value={profileLastName}
                      onChange={e => setProfileLastName(e.target.value)}
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        color: '#fff',
                        fontSize: '0.85rem',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                        width: '100%'
                      }}
                      onFocus={e => e.target.style.borderColor = '#ff9000'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.06)'}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800, textTransform: 'uppercase' }}>Новий пароль</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={profilePassword}
                        onChange={e => setProfilePassword(e.target.value)}
                        style={{
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '10px',
                          padding: '10px 40px 10px 14px',
                          color: '#fff',
                          fontSize: '0.85rem',
                          outline: 'none',
                          width: '100%',
                          transition: 'border-color 0.2s',
                        }}
                        onFocus={e => e.target.style.borderColor = '#ff9000'}
                        onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.06)'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          background: 'transparent',
                          border: 'none',
                          color: '#555',
                          cursor: 'pointer',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {showPassword ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Save button */}
                <button
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile}
                  style={{
                    background: '#ff9000',
                    color: '#000',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '12px',
                    fontWeight: 900,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    marginTop: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s',
                    opacity: isSavingProfile ? 0.6 : 1,
                    width: '100%'
                  }}
                  onMouseEnter={e => { if (!isSavingProfile) e.currentTarget.style.background = '#e07e00'; }}
                  onMouseLeave={e => { if (!isSavingProfile) e.currentTarget.style.background = '#ff9000'; }}
                >
                  {isSavingProfile ? (
                    <div style={{ width: '16px', height: '16px', border: '2.5px solid #000', borderTop: '2.5px solid transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                  {isSavingProfile ? 'Збереження...' : 'Зберегти зміни'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

    </>
  );
};

// ── 3-in-1 Executive Portal Dashboard ──────────────────────────────────────────
const Portal = ({ chatUnreadCount }) => {
  const { currentUser, orders = [], workCards = [], requests = [], machines = [], machineCalls = [], tasks = [], companyPositions = [] } = useMES()
  const location = useLocation()
  const navigate = useNavigate()
  const [selectedPillar, setSelectedPillar] = useState('all') // 'all', 'crm', 'erp', 'mes'
  const [portalSearch, setPortalSearch] = useState('')

  const isAdmin = currentUser?.position === 'Адмін' || currentUser?.role === 'admin'
  const modules = useMemo(() => {
    return getAvailableModules(currentUser, 0, chatUnreadCount)
  }, [currentUser, chatUnreadCount])

  // REDIRECT NON-ADMIN TO START PAGE ONLY ON INITIAL APP LOAD / LOGIN
  useEffect(() => {
    if (!isAdmin && modules.length > 0 && location.pathname === '/') {
      const redirectedAlready = sessionStorage.getItem('start_page_redirected')
      if (!redirectedAlready) {
        const userPosition = (companyPositions || []).find(p => p.name === currentUser?.position)
        const targetPath = userPosition?.start_page
        if (targetPath && modules.some(m => m.path === targetPath)) {
          sessionStorage.setItem('start_page_redirected', 'true')
          navigate(targetPath, { replace: true })
        }
      }
    }
  }, [isAdmin, modules, location.pathname, companyPositions, currentUser?.position, navigate])

  const filteredModules = modules.filter(m => {
    const matchesSearch = m.title.toLowerCase().includes(portalSearch.toLowerCase()) ||
                          m.desc.toLowerCase().includes(portalSearch.toLowerCase());
    const matchesPillar = selectedPillar === 'all' || m.pillar === selectedPillar;
    return matchesSearch && matchesPillar;
  });

  const crmCount = modules.filter(m => m.pillar === 'crm').length;
  const erpCount = modules.filter(m => m.pillar === 'erp').length;
  const mesCount = modules.filter(m => m.pillar === 'mes').length;

  // Real Enterprise Live Analytics Metrics
  const activeOrders = orders.filter(o => o.status !== 'completed' && o.status !== 'shipped' && o.status !== 'cancelled');
  const activeOrdersCount = activeOrders.length;
  
  const activeOrdersSum = activeOrders.reduce((acc, o) => {
    let val = Number(o.total_price || o.price || o.total_amount || 0);
    if (!val && Array.isArray(o.order_items) && o.order_items.length > 0) {
      val = o.order_items.reduce((iSum, item) => {
        const q = Number(item.quantity || item.qty || item.count || 0);
        const p = Number(item.price_per_unit || item.price || item.cost || 0);
        return iSum + (Number(item.total_price) || (q * p));
      }, 0);
    }
    return acc + val;
  }, 0);

  const pendingRequestsCount = requests.filter(r => r.status === 'pending' || r.status === 'new' || r.status === 'created' || r.status === 'in_progress').length;
  
  const activeWorkCardsCount = workCards.filter(w => w.status === 'in-progress' || w.status === 'at-buffer' || w.status === 'new' || w.status === 'in_progress' || w.status === 'active').length
    || tasks.filter(t => t.status !== 'completed' && t.status !== 'done' && t.status !== 'cancelled').length;

  const activeCallsCount = machineCalls.filter(c => c.status === 'pending' || c.status === 'active' || c.status === 'new').length;
  const workingMachinesCount = machines.filter(m => m.status === 'working' || m.status === 'active' || m.status === 'online').length;

  // User position & role detection
  const userPos = (currentUser?.position || '').toLowerCase();
  const userRole = (currentUser?.role || '').toLowerCase();

  const isManagerRole = userPos.includes('менеджер') || userPos.includes('продаж') || userRole.includes('manager');
  const isForemanRole = userPos.includes('майстер') || userPos.includes('нач') || userPos.includes('цех') || userPos.includes('бригад') || userRole.includes('foreman') || userRole.includes('master');
  const isWarehouseRole = userPos.includes('склад') || userPos.includes('комір') || userPos.includes('постач') || userRole.includes('warehouse');
  const isDirectorRole = userPos.includes('директор') || userPos.includes('керівник') || userRole.includes('director');
  const isEngineerRole = userPos.includes('інженер') || userPos.includes('чпк') || userPos.includes('вкя') || userRole.includes('engineer');

  const positionTitle = currentUser?.position || (isDirectorRole ? 'Директор' : isManagerRole ? 'Менеджер' : isForemanRole ? 'Начальник Цеху' : isWarehouseRole ? 'Завскладу' : isEngineerRole ? 'Інженер' : isAdmin ? 'Адмін' : 'Спеціаліст');

  const hasModule = (id) => modules.some(m => m.id === id);

  // Quick Action availability based on permissions
  const canCreateOrder = hasModule('crm') || hasModule('manager') || hasModule('director') || isAdmin;
  const canCreateBatch = hasModule('master') || hasModule('foreman') || hasModule('director') || isAdmin;
  const canRequestMaterial = hasModule('warehouse') || hasModule('supply') || hasModule('master') || hasModule('foreman') || hasModule('director') || isAdmin;
  const canCallMaster = hasModule('operator') || hasModule('shop1') || hasModule('shop2_terminal') || hasModule('master') || isAdmin;

  return (
    <div className="portal-container-v2" style={{ background: 'var(--bg)', minHeight: 'calc(100vh - 64px)', color: 'var(--text)', padding: '24px 28px 40px' }}>
      <div style={{ maxWidth: '1380px', margin: '0 auto' }}>
        
        {/* Executive Command Header & Pulse Status */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(255, 144, 0, 0.08) 100%)',
          border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
          borderRadius: '24px',
          padding: '24px 28px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.85rem', fontWeight: 950, margin: 0, letterSpacing: '-0.5px', color: 'var(--text)' }}>
                Вітаємо, {currentUser?.first_name || currentUser?.login || 'Користувач'}! 👋
              </h1>
              <span style={{
                background: 'linear-gradient(135deg, #ff9000, #ea580c)',
                color: '#fff',
                padding: '4px 14px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 900,
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
                boxShadow: '0 4px 12px rgba(255,144,0,0.3)'
              }}>
                {positionTitle}
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '8px', marginBottom: 0, fontWeight: 600 }}>
              Операційний центр підприємства • Моніторинг CRM, ERP та виробничого виконання (MES) у реальному часі
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--card-bg, rgba(22, 24, 34, 0.75))',
              border: '1px solid var(--glass-border)',
              padding: '8px 16px',
              borderRadius: '16px',
              fontSize: '0.8rem',
              fontWeight: 800,
              color: '#10b981'
            }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }} />
              Пульс системи: Всі цехи в нормі
            </div>
          </div>
        </div>

        {/* ⚡ Enterprise Quick Actions Bar (Швидкі Операційні Дії) */}
        <div style={{
          background: 'var(--card-bg, rgba(22, 24, 34, 0.75))',
          border: '1px solid var(--glass-border)',
          borderRadius: '20px',
          padding: '16px 20px',
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: 'rgba(255, 144, 0, 0.15)', color: '#ff9000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--text)' }}>Швидкі Дії Підприємства</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Оперативне створення запитів, замовлень та зв'язок</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {canCreateOrder && (
              <Link to="/manager" style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#fff', textDecoration: 'none', padding: '9px 18px', borderRadius: '14px', fontSize: '0.82rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)', transition: '0.2s' }}>
                <Plus size={16} /> Створити Замовлення
              </Link>
            )}

            {canCreateBatch && (
              <Link to="/master" style={{ background: 'linear-gradient(135deg, #ff9000, #ea580c)', color: '#fff', textDecoration: 'none', padding: '9px 18px', borderRadius: '14px', fontSize: '0.82rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(255, 144, 0, 0.3)', transition: '0.2s' }}>
                <Plus size={16} /> Створити Наряд
              </Link>
            )}

            {canRequestMaterial && (
              <Link to="/warehouse" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', textDecoration: 'none', padding: '9px 18px', borderRadius: '14px', fontSize: '0.82rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px', transition: '0.2s' }}>
                <Package size={16} /> Запит Матеріалів
              </Link>
            )}

            {canCallMaster && (
              <Link to="/machines" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', textDecoration: 'none', padding: '9px 18px', borderRadius: '14px', fontSize: '0.82rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px', transition: '0.2s' }}>
                <AlertTriangle size={16} /> Викликати Майстра
              </Link>
            )}

            <Link to="/chat" style={{ background: 'var(--secondary, rgba(255,255,255,0.06))', color: 'var(--text)', border: '1px solid var(--glass-border)', textDecoration: 'none', padding: '9px 18px', borderRadius: '14px', fontSize: '0.82rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', transition: '0.2s' }}>
              <MessageCircle size={16} color="#6366f1" /> Чат
            </Link>
          </div>
        </div>

        {/* 4 Core Vital Executive Metric Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '20px',
          marginBottom: '32px'
        }}>
          {/* Tile 1: CRM & Orders */}
          <div className="glass-panel" style={{
            background: 'var(--card-bg, rgba(22, 24, 34, 0.75))',
            border: '1px solid var(--glass-border)',
            padding: '22px 24px',
            borderRadius: '22px',
            display: 'flex',
            alignItems: 'center',
            gap: '18px',
            transition: 'all 0.3s ease'
          }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '16px',
              background: 'rgba(99, 102, 241, 0.14)',
              color: '#6366f1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              flexShrink: 0
            }}>
              <Briefcase size={26} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Активні Замовлення & Оборот
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 950, color: 'var(--text)', marginTop: '2px' }}>
                {activeOrdersCount} <span style={{ fontSize: '0.85rem', color: '#6366f1', fontWeight: 800 }}>замовлень</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700, marginTop: '2px' }}>
                ₴ {activeOrdersSum > 0 ? activeOrdersSum.toLocaleString('uk-UA') : '0'} у роботі
              </div>
            </div>
          </div>

          {/* Tile 2: MES Manufacturing Stream */}
          <div className="glass-panel" style={{
            background: 'var(--card-bg, rgba(22, 24, 34, 0.75))',
            border: '1px solid var(--glass-border)',
            padding: '22px 24px',
            borderRadius: '22px',
            display: 'flex',
            alignItems: 'center',
            gap: '18px',
            transition: 'all 0.3s ease'
          }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '16px',
              background: 'rgba(255, 144, 0, 0.14)',
              color: '#ff9000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255, 144, 0, 0.3)',
              flexShrink: 0
            }}>
              <Tablet size={26} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Цеховий Потік & Наряди
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 950, color: 'var(--text)', marginTop: '2px' }}>
                {activeWorkCardsCount} <span style={{ fontSize: '0.85rem', color: '#ff9000', fontWeight: 800 }}>карт у процесі</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, marginTop: '2px' }}>
                Цех №1 & Цех №2 активні
              </div>
            </div>
          </div>

          {/* Tile 3: ERP Warehouse & Supplies */}
          <div className="glass-panel" style={{
            background: 'var(--card-bg, rgba(22, 24, 34, 0.75))',
            border: '1px solid var(--glass-border)',
            padding: '22px 24px',
            borderRadius: '22px',
            display: 'flex',
            alignItems: 'center',
            gap: '18px',
            transition: 'all 0.3s ease'
          }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '16px',
              background: 'rgba(16, 185, 129, 0.14)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              flexShrink: 0
            }}>
              <Warehouse size={26} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Склад WMS & Запити
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 950, color: 'var(--text)', marginTop: '2px' }}>
                {pendingRequestsCount} <span style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 800 }}>активних запитів</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, marginTop: '2px' }}>
                Склад готовності & ТМЦ
              </div>
            </div>
          </div>

          {/* Tile 4: Equipment & Quality */}
          <div className="glass-panel" style={{
            background: 'var(--card-bg, rgba(22, 24, 34, 0.75))',
            border: '1px solid var(--glass-border)',
            padding: '22px 24px',
            borderRadius: '22px',
            display: 'flex',
            alignItems: 'center',
            gap: '18px',
            transition: 'all 0.3s ease'
          }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '16px',
              background: activeCallsCount > 0 ? 'rgba(239, 68, 68, 0.14)' : 'rgba(14, 165, 233, 0.14)',
              color: activeCallsCount > 0 ? '#ef4444' : '#0ea5e9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: activeCallsCount > 0 ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(14, 165, 233, 0.3)',
              flexShrink: 0
            }}>
              <Cpu size={26} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Верстати & Контроль Якості
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 950, color: 'var(--text)', marginTop: '2px' }}>
                {workingMachinesCount > 0 ? workingMachinesCount : (machines.length || 'Всі')} <span style={{ fontSize: '0.85rem', color: '#0ea5e9', fontWeight: 800 }}>обладнання</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: activeCallsCount > 0 ? '#ef4444' : '#10b981', fontWeight: 800, marginTop: '2px' }}>
                {activeCallsCount > 0 ? `🚨 ${activeCallsCount} термінових викликів!` : '✓ Аварійні виклики відсутні'}
              </div>
            </div>
          </div>
        </div>

        {/* 3-in-1 Pillars Fast Access Row (Filtered strictly by Permissions) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '20px',
          marginBottom: '32px'
        }}>
          {/* CRM Pillar Bar */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(99, 102, 241, 0.03) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: '20px',
            padding: '22px 24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 900, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  🟣 CRM ПРОДАЖІ & ВОРОНКА
                </span>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.15rem', fontWeight: 900, color: 'var(--text)' }}>
                  Клієнтські Угоди та Замовлення
                </h3>
              </div>
              <span style={{ background: '#6366f1', color: '#fff', fontSize: '0.75rem', fontWeight: 900, padding: '4px 10px', borderRadius: '12px' }}>
                {crmCount} Модулів
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {hasModule('crm') && (
                <Link to="/crm" style={{ background: '#6366f1', color: '#fff', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800, transition: '0.2s' }}>
                  Воронка Угод →
                </Link>
              )}
              {(hasModule('crm') || hasModule('crm_clients')) && (
                <Link to="/crm/clients" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.3)', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800, transition: '0.2s' }}>
                  База Клієнтів
                </Link>
              )}
              {hasModule('manager') && (
                <Link to="/manager" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.3)', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800, transition: '0.2s' }}>
                  Менеджер Замовлень
                </Link>
              )}
              {hasModule('kanban') && (
                <Link to="/tasks" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.3)', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800, transition: '0.2s' }}>
                  Задачі Канбан
                </Link>
              )}
            </div>
          </div>

          {/* ERP Pillar Bar */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(16, 185, 129, 0.03) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '20px',
            padding: '22px 24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 900, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  🟢 ERP РЕСУРСИ & ЛОГІСТИКА
                </span>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.15rem', fontWeight: 900, color: 'var(--text)' }}>
                  Склади WMS, Постачання та Економіка
                </h3>
              </div>
              <span style={{ background: '#10b981', color: '#fff', fontSize: '0.75rem', fontWeight: 900, padding: '4px 10px', borderRadius: '12px' }}>
                {erpCount} Модулів
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {hasModule('warehouse') && (
                <Link to="/warehouse" style={{ background: '#10b981', color: '#fff', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800, transition: '0.2s' }}>
                  Склад Оперативний →
                </Link>
              )}
              {(hasModule('prep_terminal') || hasModule('preparation_dashboard') || hasModule('warehouse') || isAdmin) && (
                <Link to="/preparation-dashboard" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800, transition: '0.2s' }}>
                  Склад Виробництва
                </Link>
              )}
              {(hasModule('warehouse_fgp') || isAdmin) && (
                <Link to="/warehouse-fgp" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800, transition: '0.2s' }}>
                  Склад СГП
                </Link>
              )}
              {(hasModule('warehouse_boxes') || isAdmin) && (
                <Link to="/warehouse-boxes" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800, transition: '0.2s' }}>
                  Бокси фрез
                </Link>
              )}
              {(hasModule('supply') || isAdmin) && (
                <Link to="/supply" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800, transition: '0.2s' }}>
                  Постачання (Procurement)
                </Link>
              )}
              {(hasModule('economy') || isAdmin) && (
                <Link to="/economy" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800, transition: '0.2s' }}>
                  Економіка & Ціни
                </Link>
              )}
            </div>
          </div>

          {/* MES Pillar Bar */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(255, 144, 0, 0.12) 0%, rgba(255, 144, 0, 0.03) 100%)',
            border: '1px solid rgba(255, 144, 0, 0.25)',
            borderRadius: '20px',
            padding: '22px 24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 900, color: '#ff9000', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  🟠 MES ВИРОБНИЧІ ЦЕХИ
                </span>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.15rem', fontWeight: 900, color: 'var(--text)' }}>
                  Наряди, Термінали та Кабінет Директора
                </h3>
              </div>
              <span style={{ background: '#ff9000', color: '#fff', fontSize: '0.75rem', fontWeight: 900, padding: '4px 10px', borderRadius: '12px' }}>
                {mesCount} Модулів
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {hasModule('director') && (
                <Link to="/director" style={{ background: '#ff9000', color: '#000', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 900, transition: '0.2s' }}>
                  Кабінет Директора →
                </Link>
              )}
              {hasModule('master') && (
                <Link to="/master" style={{ background: 'rgba(255, 144, 0, 0.15)', color: '#ff9000', border: '1px solid rgba(255, 144, 0, 0.3)', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800, transition: '0.2s' }}>
                  Кабінет Майстра
                </Link>
              )}
              {hasModule('foreman') && (
                <Link to="/foreman" style={{ background: 'rgba(255, 144, 0, 0.15)', color: '#ff9000', border: '1px solid rgba(255, 144, 0, 0.3)', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800, transition: '0.2s' }}>
                  Начальник Цеху
                </Link>
              )}
              {hasModule('shop1_foreman') && (
                <Link to="/shop1-foreman" style={{ background: 'rgba(255, 144, 0, 0.15)', color: '#ff9000', border: '1px solid rgba(255, 144, 0, 0.3)', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800, transition: '0.2s' }}>
                  Диспетчер Цех №1
                </Link>
              )}
              {(hasModule('operator') || hasModule('shop1')) && (
                <Link to="/operator" style={{ background: 'rgba(255, 144, 0, 0.15)', color: '#ff9000', border: '1px solid rgba(255, 144, 0, 0.3)', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800, transition: '0.2s' }}>
                  Робочий Термінал
                </Link>
              )}
              {hasModule('machines') && (
                <Link to="/machines" style={{ background: 'rgba(255, 144, 0, 0.15)', color: '#ff9000', border: '1px solid rgba(255, 144, 0, 0.3)', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800, transition: '0.2s' }}>
                  Верстати & ЧПК
                </Link>
              )}
              {hasModule('brak') && (
                <Link to="/brak" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', textDecoration: 'none', padding: '8px 15px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 800, transition: '0.2s' }}>
                  Контроль Браку (QC)
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Filter Toolbar & Module Catalog Grid */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '24px',
          flexWrap: 'wrap'
        }}>
          {/* Pillar Selector Buttons */}
          <div style={{
            background: 'var(--card-bg, rgba(22, 24, 34, 0.75))',
            border: '1px solid var(--glass-border)',
            padding: '6px',
            borderRadius: '18px',
            display: 'flex',
            gap: '6px',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => setSelectedPillar('all')}
              style={{
                padding: '9px 18px',
                borderRadius: '14px',
                border: selectedPillar === 'all' ? '1px solid #ff9000' : '1px solid transparent',
                background: selectedPillar === 'all' ? 'rgba(255, 144, 0, 0.15)' : 'transparent',
                color: selectedPillar === 'all' ? '#ff9000' : 'var(--text-muted)',
                fontWeight: 900,
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Усі Модулі Системи ({modules.length})
            </button>

            <button
              onClick={() => setSelectedPillar('crm')}
              style={{
                padding: '9px 18px',
                borderRadius: '14px',
                border: selectedPillar === 'crm' ? '1px solid #6366f1' : '1px solid transparent',
                background: selectedPillar === 'crm' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                color: selectedPillar === 'crm' ? '#6366f1' : 'var(--text-muted)',
                fontWeight: 900,
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1' }} />
              CRM Продажі ({crmCount})
            </button>

            <button
              onClick={() => setSelectedPillar('erp')}
              style={{
                padding: '9px 18px',
                borderRadius: '14px',
                border: selectedPillar === 'erp' ? '1px solid #10b981' : '1px solid transparent',
                background: selectedPillar === 'erp' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                color: selectedPillar === 'erp' ? '#10b981' : 'var(--text-muted)',
                fontWeight: 900,
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
              ERP Ресурси ({erpCount})
            </button>

            <button
              onClick={() => setSelectedPillar('mes')}
              style={{
                padding: '9px 18px',
                borderRadius: '14px',
                border: selectedPillar === 'mes' ? '1px solid #ff9000' : '1px solid transparent',
                background: selectedPillar === 'mes' ? 'rgba(255, 144, 0, 0.15)' : 'transparent',
                color: selectedPillar === 'mes' ? '#ff9000' : 'var(--text-muted)',
                fontWeight: 900,
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff9000' }} />
              MES Цехи ({mesCount})
            </button>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={16} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Пошук модуля..."
              value={portalSearch}
              onChange={(e) => setPortalSearch(e.target.value)}
              style={{
                padding: '11px 16px 11px 40px',
                borderRadius: '16px',
                border: '1px solid var(--glass-border)',
                background: 'var(--card-bg, rgba(22, 24, 34, 0.75))',
                color: 'var(--text)',
                fontSize: '0.88rem',
                width: '280px',
                outline: 'none',
                fontWeight: 600
              }}
            />
            {portalSearch && (
              <button
                onClick={() => setPortalSearch('')}
                style={{ position: 'absolute', right: '12px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Modules Grid */}
        <div className="portal-grid-v2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '20px' }}>
          {filteredModules.map(mod => (
            <Link
              key={mod.id}
              to={mod.path}
              className="portal-card-v2 glass-panel"
              style={{
                textDecoration: 'none',
                background: 'var(--card-bg, rgba(22, 24, 34, 0.75))',
                border: '1px solid var(--glass-border)',
                borderRadius: '22px',
                padding: '22px',
                display: 'flex',
                alignItems: 'center',
                gap: '18px',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div className="card-icon-v2" style={{
                background: `rgba(${mod.color === '#6366f1' ? '99, 102, 241' : mod.color === '#10b981' ? '16, 185, 129' : '255, 144, 0'}, 0.12)`,
                width: '54px',
                height: '54px',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: mod.color,
                position: 'relative',
                border: `1px solid ${mod.color}33`,
                flexShrink: 0
              }}>
                {mod.icon}
                {mod.badge > 0 && <span className="badge-count anim-pulse" style={{ position: 'absolute', top: -5, right: -5 }}>{mod.badge}</span>}
              </div>

              <div className="card-info-v2" style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.02rem', color: 'var(--text)', fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {mod.title}
                  </h3>
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {mod.desc}
                </p>
              </div>

              <ChevronRight className="arrow-v2" size={18} style={{ color: 'var(--text-muted)', transition: '0.2s', flexShrink: 0 }} />
              <div className="hover-line" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: mod.color, opacity: 0, transition: '0.2s' }} />
            </Link>
          ))}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .portal-card-v2:hover { transform: translateY(-4px); background: var(--card-hover-bg, rgba(30, 30, 42, 0.95)); border-color: rgba(255, 144, 0, 0.4) !important; box-shadow: 0 12px 30px rgba(0,0,0,0.15); }
        .portal-card-v2:hover .arrow-v2 { color: #ff9000; transform: translateX(4px); }
        .portal-card-v2:hover .hover-line { opacity: 1; }
        @media (max-width: 768px) { .portal-grid-v2 { grid-template-columns: 1fr; } }
      `}} />
    </div>
  )
}


// ── Permission Guard for Routes ────────────────────────────────────────────────
const PermissionGuard = ({ id, children }) => {
  const { currentUser, managementTasks } = useMES()
  const location = useLocation()

  if (!currentUser) return children

  const posLower = (currentUser?.position || '').toLowerCase()
  const roleLower = (currentUser?.role || '').toLowerCase()
  const isFullAccessUser = posLower.includes('адмін') || roleLower === 'admin'
  if (isFullAccessUser) return children

  // Allow public call route
  if (id === 'public_call') return children

  const availableModules = getAvailableModules(currentUser, 0)
  const hasAccess = availableModules.some(m => m.id === id)

  if (!hasAccess) {
    return (
      <div style={{ background: '#050505', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px', padding: '20px', color: '#fff', textAlign: 'center' }}>
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
          <AlertTriangle size={40} />
        </div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 950, margin: 0 }}>У вас немає прав доступу</h1>
        <p style={{ color: '#888', fontSize: '0.9rem', maxWidth: '400px', margin: '0 0 20px' }}>
          Доступ до цього модуля обмежено налаштуваннями вашого облікового запису. Зверніться до адміністратора для отримання дозволу.
        </p>
        <Link to="/" style={{ background: '#ff9000', color: '#000', textDecoration: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 900, fontSize: '0.85rem', textTransform: 'uppercase', transition: '0.2s' }}>
          Повернутися на головну
        </Link>
      </div>
    )
  }

  return children
}

const ScrollToTop = () => {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

const SystemAlertHost = () => {
  const [message, setMessage] = useState(null)

  useEffect(() => {
    const originalAlert = window.alert
    window.alert = (value) => {
      setMessage(value === undefined || value === null ? '' : String(value))
    }
    return () => {
      window.alert = originalAlert
    }
  }, [])

  if (message === null) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50000,
        background: 'rgba(0,0,0,.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={() => setMessage(null)}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          width: 'min(520px, 100%)',
          background: '#111',
          border: '1px solid rgba(59,130,246,.45)',
          borderRadius: '14px',
          boxShadow: '0 24px 80px rgba(0,0,0,.55)',
          overflow: 'hidden'
        }}
        onClick={event => event.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '18px 20px', borderBottom: '1px solid #222' }}>
          <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(59,130,246,.14)', border: '1px solid rgba(59,130,246,.45)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#fff', fontWeight: 950, fontSize: '.95rem', letterSpacing: '.02em' }}>Повідомлення системи</div>
            <div style={{ color: '#666', fontWeight: 800, fontSize: '.72rem', marginTop: '3px', textTransform: 'uppercase' }}>Centrum MES</div>
          </div>
          <button
            type="button"
            onClick={() => setMessage(null)}
            style={{
              width: 34,
              height: 34,
              borderRadius: '9px',
              border: '1px solid #2a2a2a',
              background: '#171717',
              color: '#aaa',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={17} />
          </button>
        </div>

        <div style={{ padding: '18px 20px 6px', color: '#cbd5e1', fontSize: '.88rem', lineHeight: 1.55, fontWeight: 750, whiteSpace: 'pre-wrap' }}>
          {message}
        </div>

        <div style={{ padding: '16px 20px 20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => setMessage(null)}
            style={{
              background: '#3b82f6',
              border: 'none',
              color: '#fff',
              borderRadius: '9px',
              padding: '10px 18px',
              fontWeight: 950,
              cursor: 'pointer',
              minWidth: 90
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}

// ── App Sidebar (Enterprise 3-in-1 Side Menu) ──────────────────────────────────
const AppSidebar = ({ isCollapsed, setIsCollapsed, chatUnreadCount, isMobileOpen, setIsMobileOpen, onOpenProfile, onOpenNotifications, unreadNotifCount = 0 }) => {
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
          {(currentUser?.position === 'Адмін' || currentUser?.role === 'admin' || currentUser?.access_rights?.dashboard === true || currentUser?.access_rights?.dashboard === 'true' || currentUser?.access_rights?.dashboard === 1) && (
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

// ── User Profile Settings Modal ────────────────────────────────────────────────
const ProfileModal = ({ isOpen, onClose }) => {
  const { currentUser, upsertUser } = useMES()
  const [firstName, setFirstName] = useState(currentUser?.first_name || '')
  const [lastName, setLastName] = useState(currentUser?.last_name || '')
  const [password, setPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (currentUser) {
      setFirstName(currentUser.first_name || '')
      setLastName(currentUser.last_name || '')
    }
  }, [currentUser])

  if (!isOpen || !currentUser) return null

  const handleSave = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const payload = {
        ...currentUser,
        first_name: firstName.trim(),
        last_name: lastName.trim()
      }
      if (password.trim()) {
        payload.password = password.trim()
      }
      await upsertUser(payload)
      alert('Профіль успішно оновлено!')
      onClose()
    } catch (err) {
      alert('Помилка оновлення профілю: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', borderRadius: '24px', background: 'var(--card-bg)', border: '1px solid var(--glass-border)', padding: '28px', color: 'var(--text)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #ff9000, #e65100)', color: '#000', fontWeight: 950, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 950 }}>Налаштування Профілю</h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{currentUser.login} · {currentUser.position || 'Спеціаліст'}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Ім'я</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Введіть ім'я..."
              style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Прізвище</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Введіть прізвище..."
              style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Змінити Пароль (залиште порожнім, щоб не змінювати)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Новий пароль..."
              style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text)', fontWeight: 800, cursor: 'pointer' }}>
              Скасувати
            </button>
            <button type="submit" disabled={isSaving} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #ff9000, #e65100)', color: '#000', fontWeight: 950, cursor: 'pointer' }}>
              {isSaving ? 'Збереження...' : 'Зберегти Профіль'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Notification Center Modal Component ───────────────────────────────────────
const NotificationCenterModal = ({ isOpen, onClose, notifications = [], unreadCount = 0, readIds = [], markAsRead, markAllAsRead }) => {
  const navigate = useNavigate()
  if (!isOpen) return null

  const handleNotificationClick = (item) => {
    if (markAsRead) markAsRead(item.id)
    onClose()
    if (item.path) {
      navigate(item.path, { state: item.state })
    }
  }

  const formatTime = (dateStr) => {
    if (!dateStr) return ''
    try {
      const date = new Date(dateStr)
      const now = new Date()
      const diffSec = Math.floor((now - date) / 1000)
      if (diffSec < 60) return 'щойно'
      const diffMin = Math.floor(diffSec / 60)
      if (diffMin < 60) return `${diffMin} хв. тому`
      const diffHours = Math.floor(diffMin / 60)
      if (diffHours < 24) return `${diffHours} год. тому`
      const diffDays = Math.floor(diffHours / 24)
      if (diffDays === 1) return 'вчора'
      return `${diffDays} дн. тому`
    } catch {
      return ''
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(540px, 95vw)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '24px',
          background: 'var(--card-bg, #0c0d12)',
          border: '1px solid var(--glass-border, rgba(255,255,255,0.12))',
          boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
          overflow: 'hidden',
          color: 'var(--text, #fff)'
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--glass-border, rgba(255,255,255,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 42, height: 42, borderRadius: '12px', background: 'rgba(255,144,0,0.14)', border: '1px solid rgba(255,144,0,0.3)', color: '#ff9000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 950, letterSpacing: '-0.3px' }}>Центр Сповіщень</h2>
                {unreadCount > 0 && (
                  <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.7rem', fontWeight: 950, padding: '2px 8px', borderRadius: '12px' }}>
                    {unreadCount} нових
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.73rem', color: 'var(--text-muted, #94a3b8)', marginTop: '2px' }}>
                Активні сповіщення та завдання системи
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{ background: 'rgba(255,144,0,0.12)', border: '1px solid rgba(255,144,0,0.3)', color: '#ff9000', padding: '6px 12px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}
              >
                Прочитати все
              </button>
            )}
            <button
              onClick={onClose}
              style={{ width: 34, height: 34, borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {notifications.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                <BellOff size={26} />
              </div>
              <div>
                <div style={{ fontWeight: 900, fontSize: '0.95rem' }}>Сповіщень немає</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Усі події прочитані та оброблені</div>
              </div>
            </div>
          ) : (
            notifications.map(item => {
              const isUnread = !readIds.includes(item.id)
              return (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '16px',
                    background: isUnread ? 'rgba(255,144,0,0.06)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isUnread ? 'rgba(255,144,0,0.3)' : 'var(--glass-border, rgba(255,255,255,0.06))'}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '14px',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                >
                  <div style={{ width: 38, height: 38, borderRadius: '11px', background: `${item.color}20`, border: `1px solid ${item.color}40`, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {item.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ fontWeight: isUnread ? 900 : 700, fontSize: '0.88rem', color: isUnread ? 'var(--text, #fff)' : 'var(--text-muted, #cbd5e1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title}
                      </div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted, #64748b)', flexShrink: 0, fontWeight: 700 }}>
                        {formatTime(item.createdAt)}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', marginTop: '4px', lineHeight: 1.4 }}>
                      {item.description}
                    </div>
                  </div>
                  {isUnread && (
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff9000', boxShadow: '0 0 8px #ff9000', marginTop: '6px', flexShrink: 0 }} />
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ── App Layout Wrapper ────────────────────────────────────────────────────────
const AppLayout = ({ children, chatUnreadCount }) => {
  const { currentUser, managementTasks, requests, workCards, purchaseRequests, receptionDocs, nomenclatures, machineCalls, machines, tasks, orders } = useMES()
  const location = useLocation()
  const [isCollapsed, setIsCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 900)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)

  // Track read notification IDs in localStorage per user
  const [readNotifIds, setReadNotifIds] = useState(() => {
    if (!currentUser) return []
    try {
      const saved = localStorage.getItem(`MES_READ_NOTIF_${currentUser.id}`)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`MES_READ_NOTIF_${currentUser.id}`, JSON.stringify(readNotifIds))
    }
  }, [readNotifIds, currentUser])

  // Build active notifications list across all 6 system sources
  const notifications = useMemo(() => {
    const list = []
    if (!currentUser) return list
    const availableModules = getAvailableModules(currentUser, 0)
    const hasModule = (id) => availableModules.some(m => m.id === id)

    // 0. New Orders awaiting Batch/Task
    const hasOrderCreationAccess = hasModule('director') || hasModule('master') || hasModule('foreman')
    if (hasOrderCreationAccess && orders) {
      orders.forEach(order => {
        if (order.order_num && (order.order_num.startsWith('ВБ') || order.order_num.startsWith('VB'))) return
        const orderTasks = (tasks || []).filter(t => t.order_id === order.id)
        if (orderTasks.length === 0 && order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'shipped') {
          let path = '/'
          if (hasModule('master')) path = '/master'
          else if (hasModule('foreman')) path = '/foreman'
          else if (hasModule('director')) path = '/director'

          const productNames = (order.order_items || [])
            .map(it => nomenclatures?.find(n => n.id === it.nomenclature_id)?.name)
            .filter(Boolean)
            .join(', ') || '—'

          list.push({
            id: `order-new-${order.id}`,
            type: 'order_new',
            title: `Нове замовлення № ${order.order_num}`,
            description: `Очікує на створення наряду. Виріб: ${productNames}`,
            createdAt: order.created_at,
            path,
            color: '#3b82f6',
            icon: <Monitor size={16} />
          })
        }
      })
    }

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
            icon: <KanbanSquare size={16} />
          })
        }
      })
    }

    // 2. Material Requests
    const hasWarehouseAccess = hasModule('warehouse') || hasModule('supply') || hasModule('master') || hasModule('foreman') || hasModule('director')
    if (hasWarehouseAccess && requests) {
      const groups = {}
      requests.forEach(r => {
        if (r.status === 'pending') {
          const order = orders?.find(o => o.id === r.order_id)
          const orderNum = order?.order_num || ''
          let batchIndex = ''
          if (r.details) {
            const batchMatch = r.details.match(/\(([^)]+\/\d+)\)/)
            if (batchMatch) {
              const parts = batchMatch[1].split('/')
              batchIndex = parts[parts.length - 1]
            }
          }
          if (!batchIndex && r.task_id && tasks) {
            const task = tasks.find(t => t.id === r.task_id)
            if (task?.batch_index) batchIndex = task.batch_index
          }

          const groupKey = `${r.order_id}_${r.task_id || 'null'}_${batchIndex || 'no-batch'}`
          if (!groups[groupKey]) {
            groups[groupKey] = { orderId: r.order_id, orderNum, batchIndex, taskId: r.task_id, count: 0, items: [], latestCreatedAt: r.created_at }
          }
          groups[groupKey].count += 1
          if (r.created_at > groups[groupKey].latestCreatedAt) groups[groupKey].latestCreatedAt = r.created_at
          let itemName = ''
          if (r.details) {
            const splitCol = r.details.split(': ')
            itemName = splitCol.length > 1 ? splitCol[1].split(' — ')[0] : r.details
          }
          if (itemName) groups[groupKey].items.push(itemName)
        }
      })

      Object.entries(groups).forEach(([key, g]) => {
        let path = '/'
        if (hasModule('supply')) path = '/supply'
        else if (hasModule('warehouse')) path = '/warehouse'
        else if (hasModule('foreman')) path = '/foreman'
        else if (hasModule('master')) path = '/master'
        else if (hasModule('director')) path = '/director'

        const batchStr = g.batchIndex ? `/${g.batchIndex}` : ''
        const orderPart = g.orderNum ? ` (№ ${g.orderNum}${batchStr})` : ''
        const desc = g.count === 1 ? (g.items[0] || 'Новий запит матеріалу') : `Запит на ${g.count} позицій: ${g.items.slice(0, 3).join(', ')}${g.items.length > 3 ? '...' : ''}`

        list.push({
          id: `req-group-${key}`,
          type: 'request',
          title: `Запит матеріалів${orderPart}`,
          description: desc,
          createdAt: g.latestCreatedAt,
          path,
          color: '#10b981',
          icon: <ClipboardList size={16} />,
          state: { highlightTaskId: g.taskId }
        })
      })
    }

    // 3. Work Cards
    if (workCards) {
      workCards.forEach(w => {
        if (w.status === 'new') {
          const op = (w.operation || '').toLowerCase()
          const isShop1 = ['розкрій', 'галтовка', 'прийомка'].some(o => op.includes(o))
          const isShop2 = ['пресування', 'фарбування', 'малярка', 'доопрацювання'].some(o => op.includes(o))
          let isRelevant = false
          let path = '/'

          if (isShop1) {
            isRelevant = hasModule('shop1') || hasModule('master') || hasModule('foreman') || hasModule('director')
            if (isRelevant) {
              if (hasModule('shop1')) path = '/shop1'
              else if (hasModule('master')) path = '/master'
              else if (hasModule('foreman')) path = '/foreman'
              else if (hasModule('director')) path = '/director'
            }
          } else if (isShop2) {
            isRelevant = hasModule('shop2_terminal') || hasModule('shop2') || hasModule('master') || hasModule('foreman') || hasModule('director')
            if (isRelevant) {
              if (hasModule('shop2_terminal')) path = '/shop2-terminal'
              else if (hasModule('shop2')) path = '/shop2'
              else if (hasModule('foreman')) path = '/foreman'
              else if (hasModule('master')) path = '/master'
              else if (hasModule('director')) path = '/director'
            }
          } else {
            isRelevant = hasModule('master') || hasModule('foreman') || hasModule('director')
            if (isRelevant) {
              if (hasModule('foreman')) path = '/foreman'
              else if (hasModule('master')) path = '/master'
              else if (hasModule('director')) path = '/director'
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
              icon: <Tablet size={16} />
            })
          }
        }
      })
    }

    // 4. Machine Calls
    if (machineCalls) {
      machineCalls.forEach(c => {
        if (c.status === 'pending') {
          const mach = machines?.find(m => m.id === c.machine_id)
          const machName = mach ? mach.name : 'Верстат'
          let isRelevant = false
          if (c.called_employee_id) {
            isRelevant = currentUser?.id === c.called_employee_id
          } else {
            if (c.called_role === 'master') isRelevant = currentUser?.access_rights?.master || currentUser?.access_rights?.foreman
            else if (c.called_role === 'engineer') isRelevant = currentUser?.access_rights?.engineer
            else if (c.called_role === 'quality' || c.called_role === 'qc') isRelevant = currentUser?.access_rights?.brak || currentUser?.position?.toLowerCase().includes('вкя')
          }

          if (isRelevant) {
            list.push({
              id: `call-${c.id}`,
              type: 'machine_call',
              title: `Виклик до ${machName}`,
              description: c.reason || 'Аварійна зупинка / Наналагодження',
              createdAt: c.created_at,
              path: '/machines',
              color: '#ef4444',
              icon: <AlertTriangle size={16} />
            })
          }
        }
      })
    }

    return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  }, [currentUser, managementTasks, requests, workCards, purchaseRequests, receptionDocs, nomenclatures, machineCalls, machines, tasks, orders])

  const unreadNotifCount = useMemo(() => {
    return notifications.filter(n => !readNotifIds.includes(n.id)).length
  }, [notifications, readNotifIds])

  const markNotifAsRead = (id) => {
    setReadNotifIds(prev => prev.includes(id) ? prev : [...prev, id])
  }

  const markAllNotifsAsRead = () => {
    setReadNotifIds(notifications.map(n => n.id))
  }

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 900) {
      setIsCollapsed(true)
    }
  }, [location.pathname])

  const isPublicCall = /^\/machines\/[^/]+\/call$/.test(location.pathname)
  if (location.pathname === '/login' || isPublicCall || !currentUser) {
    return <>{children}</>
  }

  const isTvDashboard = ['/preparation-dashboard', '/tumbling-dashboard', '/foreman-dashboard'].includes(location.pathname)

  return (
    <div className="app-shell">
      {!isTvDashboard && (
        <AppSidebar
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          chatUnreadCount={chatUnreadCount}
          unreadNotifCount={unreadNotifCount}
          isMobileOpen={isMobileOpen}
          setIsMobileOpen={setIsMobileOpen}
          onOpenProfile={() => setIsProfileOpen(true)}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
        />
      )}
      <div className="app-main-content">
        {children}
      </div>
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      <NotificationCenterModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        unreadCount={unreadNotifCount}
        readIds={readNotifIds}
        markAsRead={markNotifAsRead}
        markAllAsRead={markAllNotifsAsRead}
      />
    </div>
  )
}

const AppContent = () => {
  const { currentUser, sessionLoading, supabase } = useMES()
  const location = useLocation()
  // Own unread tracking once for the lifetime of the authenticated app. This
  // avoids overlapping REST/RPC reads while Portal redirects to a role module.
  const chatUnreadCount = useChatUnreadCount(currentUser, supabase)

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
    if (location.pathname && location.pathname !== '/' && location.pathname !== '/login') {
      sessionStorage.setItem('redirect_to', location.pathname + location.search);
    }
    return <Navigate to="/login" replace />
  }

  // РЕДИРЕКТ З /login НА ГОЛОВНУ ЯКЩО ВЖЕ АВТОРИЗОВАНИЙ (збереження початкового шляху переходу)
  if (currentUser && location.pathname === '/login') {
    const redirectTo = sessionStorage.getItem('redirect_to') || '/';
    sessionStorage.removeItem('redirect_to');
    return <Navigate to={redirectTo} replace />
  }

  return (
    <AppLayout chatUnreadCount={chatUnreadCount}>
      <ScrollToTop />
      <SystemAlertHost />
      <Suspense fallback={<ModuleLoader />}>
        {currentUser && location.pathname !== '/login' && (
          <GlobalUserNav key={currentUser.id} chatUnreadCount={chatUnreadCount} />
        )}
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Portal chatUnreadCount={chatUnreadCount} />} />
          <Route path="/crm" element={<PermissionGuard id="crm"><CrmModule /></PermissionGuard>} />
          <Route path="/crm/clients" element={<PermissionGuard id="crm_clients"><CrmClientsModule /></PermissionGuard>} />
          <Route path="/foreman-dashboard" element={<PermissionGuard id="foreman_dashboard"><ForemanDashboardModule /></PermissionGuard>} />
          <Route path="/manager" element={<PermissionGuard id="manager"><ManagerModule /></PermissionGuard>} />
          <Route path="/warehouse" element={<PermissionGuard id="warehouse"><WarehouseModule /></PermissionGuard>} />
          <Route path="/warehouse-fgp" element={<PermissionGuard id="warehouse_fgp"><WarehouseFGPModule /></PermissionGuard>} />
          <Route path="/warehouse-boxes" element={<PermissionGuard id="warehouse_boxes"><WarehouseBoxesModule /></PermissionGuard>} />
          <Route path="/cutter-restoration" element={<PermissionGuard id="cutter_restoration"><CutterRestorationModule /></PermissionGuard>} />
          <Route path="/master" element={<PermissionGuard id="master"><MasterModule /></PermissionGuard>} />
          <Route path="/foreman" element={<PermissionGuard id="foreman"><Foreman2Module /></PermissionGuard>} />
          <Route path="/foreman2" element={<PermissionGuard id="foreman"><Foreman2Module /></PermissionGuard>} />
          <Route path="/operator" element={<PermissionGuard id="operator"><OperatorTerminal /></PermissionGuard>} />
          <Route path="/prep-terminal" element={<PermissionGuard id="prep_terminal"><PreparationTerminal /></PermissionGuard>} />
          <Route path="/preparation-dashboard" element={<PermissionGuard id="preparation_dashboard"><PreparationDashboard /></PermissionGuard>} />
          <Route path="/shop1" element={<PermissionGuard id="shop1"><Shop1Terminal /></PermissionGuard>} />
          <Route path="/shop1-foreman" element={<PermissionGuard id="shop1_foreman"><Shop1ForemanModule /></PermissionGuard>} />
          <Route path="/tumbling-terminal" element={<PermissionGuard id="tumbling_terminal"><TumblingTerminal /></PermissionGuard>} />
          <Route path="/tumbling-dashboard" element={<PermissionGuard id="tumbling_dashboard"><TumblingDashboard /></PermissionGuard>} />
          <Route path="/reception-terminal" element={<PermissionGuard id="reception_terminal"><ReceptionTerminal /></PermissionGuard>} />
          <Route path="/sorting-terminal" element={<PermissionGuard id="sorting_terminal"><SortingTerminal /></PermissionGuard>} />
          <Route path="/shop2" element={<PermissionGuard id="shop2"><Shop2Module /></PermissionGuard>} />
          <Route path="/shop2-card-gen" element={<PermissionGuard id="shop2_card_gen"><Shop2CardGenModule /></PermissionGuard>} />
          <Route path="/shop2-terminal" element={<PermissionGuard id="shop2_terminal"><Shop2Terminal /></PermissionGuard>} />
          <Route path="/pressing-terminal" element={<PermissionGuard id="pressing_terminal"><PressingTerminal /></PermissionGuard>} />
          <Route path="/painting-terminal" element={<PermissionGuard id="painting_terminal"><PaintingTerminal /></PermissionGuard>} />
          <Route path="/packaging" element={<PermissionGuard id="packaging"><PackagingModule /></PermissionGuard>} />
          <Route path="/engineer" element={<PermissionGuard id="engineer"><EngineerModule /></PermissionGuard>} />
          <Route path="/engineer-v2" element={<PermissionGuard id="engineer_v2"><EngineerV2Module /></PermissionGuard>} />
          <Route path="/director" element={<PermissionGuard id="director"><DirectorModule /></PermissionGuard>} />
          <Route path="/shipping" element={<PermissionGuard id="shipping"><ShippingModule /></PermissionGuard>} />
          <Route path="/supply" element={<PermissionGuard id="supply"><SupplyModule /></PermissionGuard>} />
          <Route path="/nomenclature" element={<PermissionGuard id="nomenclature"><NomenclatureModule /></PermissionGuard>} />
          <Route path="/nomenclature-v2" element={<PermissionGuard id="nomenclature_v2"><NomenclatureV2 /></PermissionGuard>} />
          <Route path="/economy" element={<PermissionGuard id="economy"><EconomyModule /></PermissionGuard>} />
          <Route path="/machines" element={<PermissionGuard id="machines"><MachinesModule /></PermissionGuard>} />
          <Route path="/machines/:id/call" element={<PermissionGuard id="public_call"><MachineCallModule /></PermissionGuard>} />
          <Route path="/analytics" element={<PermissionGuard id="analytics"><AnalyticsModule /></PermissionGuard>} />
          <Route path="/brak" element={<PermissionGuard id="brak"><BrakModule /></PermissionGuard>} />
          <Route path="/brak/restoration" element={<PermissionGuard id="brak"><VKYARestorationTerminal /></PermissionGuard>} />
          <Route path="/brak/settings" element={<PermissionGuard id="brak"><VKYASettings /></PermissionGuard>} />
          <Route path="/tasks" element={<PermissionGuard id="kanban"><KanbanModule /></PermissionGuard>} />
          <Route path="/tasks/projects" element={<PermissionGuard id="kanban"><TaskProjectsModule /></PermissionGuard>} />
          <Route path="/chat" element={<PermissionGuard id="chat"><ChatModule /></PermissionGuard>} />
          <Route path="/access" element={<PermissionGuard id="access"><AccessModule /></PermissionGuard>} />
          <Route path="/procurement" element={<PermissionGuard id="procurement"><SupplyModule isProcurementOnly={true} /></PermissionGuard>} />
          <Route path="/reports" element={<PermissionGuard id="reports"><ReportsModule /></PermissionGuard>} />
          <Route path="/settings" element={<PermissionGuard id="settings"><SettingsModule /></PermissionGuard>} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/user-settings" element={<UserSettingsPage />} />
          <Route path="/profile-settings" element={<UserSettingsPage />} />
          <Route path="/simulator" element={<PermissionGuard id="simulator"><SimulatorModule /></PermissionGuard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppLayout>
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
