export const normalizeName = (s) => {
  if (!s) return '';
  const mapper = {
    'а': 'a', 'в': 'b', 'с': 'c', 'е': 'e', 'н': 'h', 'h': 'h',
    'к': 'k', 'м': 'm', 'о': 'o', 'р': 'p', 'т': 't', 'х': 'x',
    'у': 'y', 'і': 'i', 'ї': 'i', 'и': 'y', 'п': 'p'
  };
  return s.toLowerCase()
    .trim()
    .split('')
    .map(c => mapper[c] || c)
    .join('')
    .replace(/[^a-z0-9]/g, '');
};

export const getCleanNormalized = (name) => {
  if (!name) return '';
  let clean = name.toLowerCase()
    .replace(/\[\s*підготовлений\s*\]/gi, '')
    .replace(/\[\s*непідготовлений\s*\]/gi, '')
    .replace(/\s*підготовлений\s*/gi, '')
    .replace(/\s*непідготовлений\s*/gi, '')
    .trim();
  return normalizeName(clean);
};

export const MACHINE_TYPES = [
  'CNC 1200x800 - 4 листи (Малий)',
  'CNC 3050(16)х16 - 3-12 листів (швидкісний)',
  'CNC 3060х1600 - 3-36 листів (Три Головий)',
  'CNC 6000x2000 - 4 - 96 листів (Дракон)',
  'CNC KE XIN - 4 - 16 листів (ФЕЯ)'
];

export const extractThicknessNumber = (str) => {
  if (!str) return null
  const s = String(str).replace(/,/g, '.')
  const mmMatch = s.match(/(\d+(?:\.\d+)?)\s*мм/i)
  if (mmMatch) return mmMatch[1]
  const dashMatch = s.match(/[-_\s](?:Т300|Т700|T300|T700)[-_\s](\d+(?:\.\d+)?)/i) || s.match(/[-_](\d+(?:\.\d+)?)$/i)
  if (dashMatch) return dashMatch[1]
  const parenMatch = s.match(/\((\d+(?:\.\d+)?)\)/)
  if (parenMatch) return parenMatch[1]
  if (/лист|sheet|т300|т700|t300|t700/i.test(s)) {
    const numMatch = s.match(/(\d+(?:\.\d+)?)/)
    if (numMatch) return numMatch[1]
  }
  return null
};

export const isShop1Task = (t) => {
  if (!t || !t.step) return true;
  const step = t.step.toLowerCase();
  return !step.includes('№2') && !step.includes('пресув') && !step.includes('присув') && !step.includes('фарбув');
};
