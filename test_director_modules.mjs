import fs from 'fs'

const currentUser = {
  id: 46,
  login: 'director',
  first_name: 'Роман',
  last_name: 'Пілецький',
  position: 'Директор виробництва',
  access_rights: {
    crm: true,
    brak: true,
    chat: true,
    shop1: true,
    shop2: true,
    access: true,
    kanban: true,
    master: true,
    supply: true,
    economy: true,
    foreman: true,
    manager: true,
    reports: true,
    director: true,
    engineer: true,
    foreman2: true,
    machines: true,
    operator: false,
    settings: true,
    shipping: true,
    analytics: true,
    dashboard: false,
    packaging: true,
    warehouse: true,
    crm_clients: true,
    engineer_v2: true,
    procurement: true,
    nomenclature: true,
    prep_terminal: true,
    shop1_foreman: true,
    warehouse_fgp: true,
    shop2_card_gen: true,
    shop2_terminal: true,
    nomenclature_v2: true,
    warehouse_boxes: true,
    sorting_terminal: true,
    foreman_dashboard: true,
    painting_terminal: true,
    pressing_terminal: true,
    tumbling_terminal: true,
    cutter_restoration: true,
    reception_terminal: true,
    tumbling_dashboard: true,
    preparation_dashboard: true
  }
}

// Read App.jsx and evaluate getAllModules & getAvailableModules
const appJsx = fs.readFileSync('a:/centrum/src/App.jsx', 'utf8')
console.log('App.jsx read successfully.')

const getAllModules = (badgeCount = 0, chatBadgeCount = 0) => [
  { id: 'crm', title: 'CRM Воронка Лідів & Угод', path: '/crm', desc: 'Воронка лідів, запитів та угод', color: '#6366f1', pillar: 'crm' },
  { id: 'crm_clients', title: 'База Клієнтів & Картки CRM', path: '/crm/clients', desc: 'Картки клієнтів, LTV, середній чек та комунікація', color: '#6366f1', pillar: 'crm' },
  { id: 'manager', title: 'Менеджер Замовлень', path: '/manager', desc: 'Вхідні замовлення та реєстрація', color: '#6366f1', pillar: 'crm' },
  { id: 'chat', title: 'Чат & Комунікація', path: '/chat', desc: 'Внутрішні та клієнтські канали', color: '#6366f1', badge: chatBadgeCount, pillar: 'crm' },
  { id: 'kanban', title: 'Задачі (Канбан)', path: '/tasks', desc: 'Доручення та проекти', color: '#8b5cf6', badge: badgeCount, pillar: 'crm' },
  { id: 'warehouse', title: 'Склад Оперативний (WMS)', path: '/warehouse', desc: 'Матеріали, залишки та комплектація', color: '#10b981', pillar: 'erp' },
  { id: 'warehouse_fgp', title: 'Склад Готової Продукції (СГП)', path: '/warehouse-fgp', desc: 'Готова продукція, напівфабрикати, брак та БЗ', color: '#10b981', pillar: 'erp' },
  { id: 'supply', title: 'Склад Виробництва', path: '/supply', desc: 'Управління запасами та запити', color: '#10b981', pillar: 'erp' },
  { id: 'procurement', title: 'Постачання (Procurement)', path: '/procurement', desc: 'Закупівля ТМЦ у постачальників', color: '#10b981', pillar: 'erp' },
  { id: 'economy', title: 'Економіка & Ціноутворення', path: '/economy', desc: 'Прайс-листи, калькуляція собівартості, націнки та маржа', color: '#10b981', pillar: 'erp' },
  { id: 'packaging', title: 'Пакування & Комплектація', path: '/packaging', desc: 'Збирання готової продукції', color: '#10b981', pillar: 'erp' },
  { id: 'shipping', title: 'Логістика & Відвантаження', path: '/shipping', desc: 'Відвантаження замовнику', color: '#10b981', pillar: 'erp' },
  { id: 'director', title: 'Кабінет Директора', path: '/director', desc: 'Фінальні погодження та моніторинг', color: '#10b981', pillar: 'erp' },
  { id: 'analytics', title: 'Аналітика & KPI', path: '/analytics', desc: 'Статистика продуктивності та випуску', color: '#10b981', pillar: 'erp' },
  { id: 'reports', title: 'Звіти (1С / Леджер)', path: '/reports', desc: 'Зведена аналітика та експорт', color: '#10b981', pillar: 'erp' },
  { id: 'access', title: 'Система Доступу (СКУД)', path: '/access', desc: 'Контроль проходів Fortnet', color: '#10b981', pillar: 'erp' },
  { id: 'machines', title: 'Обладнання & Верстати', path: '/machines', desc: 'Моніторинг верстатів та викликів', color: '#10b981', pillar: 'erp' },
  { id: 'cutter_restoration', title: 'Відновлення Фрез', path: '/cutter-restoration', desc: 'Заточування фасочних фрез', color: '#10b981', pillar: 'erp' },
  { id: 'engineer', title: 'Інженер ЧПК & BOM (v1.0)', path: '/engineer', desc: 'CNC програми та специфікації (Old)', color: '#10b981', pillar: 'erp' },
  { id: 'engineer_v2', title: 'Інженер ЧПК & BOM 2.0', path: '/engineer-v2', desc: 'Специфікації та ЧПК операції для Номенклатури v2.0', color: '#10b981', pillar: 'erp' },
  { id: 'nomenclature', title: 'База Номенклатури', path: '/nomenclature', desc: 'Основний каталог товарів', color: '#10b981', pillar: 'erp' },
  { id: 'nomenclature_v2', title: 'Номенклатура LAB', path: '/nomenclature-v2', desc: 'Експериментальний каталог v2', color: '#10b981', pillar: 'erp' },
  { id: 'settings', title: 'Системні Налаштування', path: '/settings', desc: 'Конфігурація користувачів та прав', color: '#10b981', pillar: 'erp' },
  { id: 'simulator', title: 'Симулятор Навантаження', path: '/simulator', desc: 'Тестування живих замовлень', color: '#ef4444', pillar: 'erp' },
  { id: 'master', title: 'ЦЕХ №1 – Створення нарядів', path: '/master', desc: 'Управління зміною та БЗ', color: '#ff9000', pillar: 'mes' },
  { id: 'foreman', title: 'ЦЕХ №1 – Створення РК (Foreman 2.0)', path: '/foreman', desc: 'Розподіл нарядів та робочі карти 2.0', color: '#ff9000', pillar: 'mes' },
  { id: 'shop1', title: 'Цех №1 · Термінал', path: '/shop1', desc: 'Розкрій → Галтовка → Прийомка', color: '#ff9000', pillar: 'mes' },
  { id: 'shop1_foreman', title: 'Кабінет Нач. Цеху №1', path: '/shop1-foreman', desc: 'Управління персоналом та верстатами', color: '#ff9000', pillar: 'mes' },
  { id: 'prep_terminal', title: 'Термінал Підготовки', path: '/prep-terminal', desc: 'Дільниця підготовки металу', color: '#ff9000', pillar: 'mes' },
  { id: 'preparation_dashboard', title: 'Дашборд Підготовки (TV)', path: '/preparation-dashboard', desc: 'TV монітор підготовки', color: '#ff9000', pillar: 'mes' },
  { id: 'tumbling_terminal', title: 'Термінал Галтовки', path: '/tumbling-terminal', desc: 'Дільниця галтовки', color: '#ff9000', pillar: 'mes' },
  { id: 'tumbling_dashboard', title: 'Дашборд Галтовки (TV)', path: '/tumbling-dashboard', desc: 'TV монітор галтовки', color: '#ff9000', pillar: 'mes' },
  { id: 'reception_terminal', title: 'Термінал Прийомки', path: '/reception-terminal', desc: 'Дільниця прийомки', color: '#ff9000', pillar: 'mes' },
  { id: 'sorting_terminal', title: 'Термінал Сортування', path: '/sorting-terminal', desc: 'Дільниця сортування', color: '#ff9000', pillar: 'mes' },
  { id: 'operator', title: 'Термінал Оператора', path: '/operator', desc: 'Спрощене робоче місце', color: '#ff9000', pillar: 'mes' },
  { id: 'warehouse_boxes', title: 'Бокси Фрез (СО)', path: '/warehouse-boxes', desc: 'Підготовка боксів інструменту', color: '#ff9000', pillar: 'mes' },
  { id: 'shop2', title: 'Цех №2 – Створення РК', path: '/shop2', desc: 'Черга нарядів Другого цеху', color: '#ff9000', pillar: 'mes' },
  { id: 'shop2_card_gen', title: 'Цех №2 – Створення РК (Буфер)', path: '/shop2-card-gen', desc: 'Формування РК Цеху №2 з буфера заготовок', color: '#ff9000', pillar: 'mes' },
  { id: 'shop2_terminal', title: 'Цех №2 · Термінал', path: '/shop2-terminal', desc: 'Пресування → Фарбування → Доопрацювання', color: '#ff9000', pillar: 'mes' },
  { id: 'pressing_terminal', title: 'Термінал Пресування', path: '/pressing-terminal', desc: 'Дільниця пресування', color: '#ff9000', pillar: 'mes' },
  { id: 'painting_terminal', title: 'Термінал Фарбування', path: '/painting-terminal', desc: 'Дільниця фарбування', color: '#ff9000', pillar: 'mes' },
  { id: 'foreman_dashboard', title: 'Дашборд 2.0 (TV)', path: '/foreman-dashboard', desc: 'Загальний монітор Цеху №1', color: '#ff9000', pillar: 'mes' },
  { id: 'brak', title: 'ВКЯ & Контроль Якості', path: '/brak', desc: 'Облік браку та карантин деталей', color: '#ef4444', pillar: 'mes' }
]

const getAvailableModules = (currentUser, badgeCount, chatBadgeCount = 0) => {
  if (!currentUser) return [];
  const allModules = getAllModules(badgeCount, chatBadgeCount);
  const rights = currentUser?.access_rights || {};
  const posLower = (currentUser?.position || '').toLowerCase();
  const roleLower = (currentUser?.role || '').toLowerCase();
  const isAdmin = posLower.includes('адмін') || roleLower === 'admin' || currentUser?.login === 'admin@workshop.local';
  const isDirector = posLower.includes('директор') || roleLower.includes('director') || rights.director === true || rights.director === 'true' || rights.director === 1;

  const checkRight = (id) => {
    if (!id) return false;
    const val = rights[id];
    return val === true || val === 'true' || val === 1;
  };

  return allModules.filter(m => {
    if (m.id === 'simulator') return false;
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

const mods = getAvailableModules(currentUser)
console.log('Available modules count:', mods.length)
console.log('CRM:', mods.filter(m => m.pillar === 'crm').map(m => m.id))
console.log('ERP:', mods.filter(m => m.pillar === 'erp').map(m => m.id))
console.log('MES:', mods.filter(m => m.pillar === 'mes').map(m => m.id))
