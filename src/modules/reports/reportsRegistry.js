import {
  Archive,
  Calendar,
  Cpu,
  Layers,
  Scissors,
  TrendingUp,
  Truck,
  Users,
  Warehouse,
  AlertTriangle,
  Zap
} from 'lucide-react'

export const REPORT_CATEGORIES = [
  { id: 'materials', label: 'Склад і матеріали' },
  { id: 'production', label: 'Виробництво' },
  { id: 'analytics', label: 'Аналітика' }
]

export const REPORTS_REGISTRY = [
  {
    id: 'warehouse',
    category: 'materials',
    title: 'Склад',
    subtitle: 'Залишки та резерви',
    icon: Warehouse
  },
  {
    id: 'sheets',
    category: 'materials',
    title: 'Листи (1С)',
    subtitle: 'Ієрархія по нарядах і ручних видачах',
    icon: Layers,
    badge: 'БД'
  },
  {
    id: 'cutters',
    category: 'materials',
    title: 'Фрези (1С)',
    subtitle: 'Фактичне списання після розкрою',
    icon: Scissors,
    badge: 'БД'
  },
  {
    id: 'supplies',
    category: 'materials',
    title: 'Поставки',
    subtitle: 'Прихід по документах прийомки',
    icon: Truck
  },
  {
    id: 'monthly',
    category: 'production',
    title: 'Місячний звіт',
    subtitle: 'План / факт по місяцю',
    icon: Calendar
  },
  {
    id: 'employees',
    category: 'production',
    title: 'Працівники',
    subtitle: 'Виробіток, зміни, брак',
    icon: Users
  },
  {
    id: 'machines',
    category: 'production',
    title: 'Верстати',
    subtitle: 'Завантаження та випуск',
    icon: Cpu
  },
  {
    id: 'efficiency',
    category: 'production',
    title: 'Ефективність',
    subtitle: 'Швидкість та норми',
    icon: Zap
  },
  {
    id: 'scrap',
    category: 'production',
    title: 'Брак',
    subtitle: 'Причини та класифікації ВКЯ',
    icon: AlertTriangle
  },
  {
    id: 'archive',
    category: 'production',
    title: 'Архів нарядів',
    subtitle: 'Завершені наряди посторінково',
    icon: Archive
  },
  {
    id: 'analytics',
    category: 'analytics',
    title: 'Загальна аналітика',
    subtitle: 'Динаміка випуску та тренди',
    icon: TrendingUp
  }
]

export const REPORT_IDS = new Set(REPORTS_REGISTRY.map(r => r.id))
