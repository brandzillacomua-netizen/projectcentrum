import React from 'react'
import {
  Briefcase,
  Users,
  LayoutDashboard,
  MessageCircle,
  KanbanSquare,
  ShoppingBag,
  DollarSign,
  Package,
  Truck,
  ShieldCheck,
  TrendingUp,
  BarChart2,
  Cpu,
  Wrench,
  Settings,
  Menu,
  Sliders,
  Monitor,
  Tablet,
  AlertTriangle
} from 'lucide-react'
import { IconSO, IconSV, IconSGP } from '../components/WarehouseIcons'

const FileCodeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><path d="m10 13-2 2 2 2" /><path d="m14 17 2-2-2-2" /></svg>
)

export const getAllModules = (badgeCount = 0, chatBadgeCount = 0) => [
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
  { id: 'engineer', title: 'Інженер ЧПК & BOM', icon: <FileCodeIcon />, path: '/engineer', desc: 'Специфікації та ЧПК операції', color: '#10b981', pillar: 'erp' },
  { id: 'engineer_v2', title: 'Інженер ЧПК & BOM 2.0', icon: <FileCodeIcon />, path: '/engineer-v2', desc: 'Специфікації та ЧПК операції для Номенклатури v2.0', color: '#10b981', pillar: 'erp' },
  { id: 'nomenclature', title: 'База Номенклатури 2.0', icon: <Settings />, path: '/nomenclature', desc: 'Офіційний каталог товарів & Специфікацій v2.0', color: '#10b981', pillar: 'erp' },
  { id: 'nomenclature_v2', title: 'Номенклатура 2.0 (Лабораторія)', icon: <Menu />, path: '/nomenclature-v2', desc: 'Експериментальний каталог v2.0', color: '#10b981', pillar: 'erp' },
  { id: 'settings', title: 'Системні Налаштування', icon: <Settings />, path: '/settings', desc: 'Конфігурація користувачів та прав', color: '#10b981', pillar: 'erp' },

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
  { id: 'shop2_card_gen', title: 'Цех №2 – Створення РК (Буфер)', icon: <Monitor />, path: '/shop2-card-gen', desc: 'Формування РК Цеху №2 з буфера заготовок', color: '#ff9000', pillar: 'mes' },
  { id: 'shop2_terminal', title: 'Цех №2 · Термінал', icon: <Tablet />, path: '/shop2-terminal', desc: 'Пресування → Фарбування → Доопрацювання', color: '#ff9000', pillar: 'mes' },
  { id: 'pressing_terminal', title: 'Термінал Пресування', icon: <Tablet />, path: '/pressing-terminal', desc: 'Дільниця пресування', color: '#ff9000', pillar: 'mes' },
  { id: 'painting_terminal', title: 'Термінал Фарбування', icon: <Tablet />, path: '/painting-terminal', desc: 'Дільниця фарбування', color: '#ff9000', pillar: 'mes' },
  { id: 'foreman_dashboard', title: 'Дашборд 2.0 (TV)', icon: <LayoutDashboard />, path: '/foreman-dashboard', desc: 'Загальний монітор Цеху №1', color: '#ff9000', pillar: 'mes' },
  { id: 'brak', title: 'ВКЯ & Контроль Якості', icon: <AlertTriangle />, path: '/brak', desc: 'Облік браку та карантин деталей', color: '#ef4444', pillar: 'mes' }
]

export const getAvailableModules = (currentUser, badgeCount, chatBadgeCount = 0) => {
  if (!currentUser) return [];
  const allModules = getAllModules(badgeCount, chatBadgeCount);
  const rights = currentUser?.access_rights || {};
  const posLower = (currentUser?.position || '').toLowerCase();
  const roleLower = (currentUser?.role || '').toLowerCase();
  const isAdmin = posLower.includes('адмін') || roleLower === 'admin' || currentUser?.login === 'admin@workshop.local';

  const checkRight = (id) => {
    if (!id) return false;
    const val = rights[id];
    return val === true || val === 'true' || val === 1;
  };

  return allModules.filter(m => {
    if (m.id === 'settings') {
      if (isAdmin) return rights.settings !== false;
      return checkRight('settings');
    }
    if (m.id === 'foreman') {
      return checkRight('foreman') || checkRight('foreman2');
    }
    return checkRight(m.id);
  });
}

export const CATEGORY_MAP = {
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
  shop2_card_gen: 'mes',
  shop2_terminal: 'mes',
  pressing_terminal: 'mes',
  painting_terminal: 'mes',
  foreman_dashboard: 'mes',
  brak: 'mes'
}

export const CATEGORIES = [
  { id: 'crm', title: 'CRM (Клієнти, Угоди та Продажі)', color: '#6366f1' },
  { id: 'erp', title: 'ERP (Склад, Ресурси та Керування)', color: '#10b981' },
  { id: 'mes', title: 'MES (Цехи, Наряди та Термінали)', color: '#ff9000' }
]
