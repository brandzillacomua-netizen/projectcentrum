/**
 * Constants and specifications for Rubber Cutting Terminal (Цех №2)
 */

export const ACCENT_RUBBER = '#ff9000';
export const ACCENT_RUBBER_RGB = '255,144,0';
export const SECONDARY_COLOR = '#38bdf8';

export const RAW_SHEETS = [
  {
    code: 'V2-90030',
    thickness: 2,
    name: 'Гума еластична листова 500*500*2мм',
    dimensions: '500*500*2',
    defaultId: '1750f935-ef90-42f1-b4be-6d7cff8ac25c'
  },
  {
    code: 'V2-90031',
    thickness: 4,
    name: 'Гума еластична листова 500*500*4мм',
    dimensions: '500*500*4',
    defaultId: 'fa29e490-cc05-4ca0-9ab3-2f9897e402e1'
  }
];

export const SCRAP_REASONS = [
  'Зсув листа на столі',
  'Дефект вихідного листа гуми',
  'Помилка програми / контуру',
  'Недоріз / знос леза / фрези',
  'Геометричне відхилення розміру',
  'Інше (пояснити в коментарі)'
];

export const DEFAULT_SHIFTS = [
  'Зміна 1',
  'Зміна 2',
  'Зміна 3',
  'Зміна 4',
  'Без зміни'
];

export const formatDurationSec = (totalSeconds) => {
  const secs = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

