// Map Cyrillic keyboard characters to English QWERTY for barcode scanners under Ukrainian/Russian layout
export const cyrillicToLatinMap = {
  'й':'q', 'ц':'w', 'у':'e', 'к':'r', 'е':'t', 'н':'y', 'г':'u', 'ш':'i', 'щ':'o', 'з':'p', 'х':'[', 'ї':']',
  'ф':'a', 'ы':'s', 'і':'s', 'в':'d', 'а':'f', 'п':'g', 'р':'h', 'о':'j', 'л':'k', 'д':'l', 'ж':';', 'є':'\'',
  'я':'z', 'ч':'x', 'с':'c', 'м':'v', 'и':'b', 'т':'n', 'ь':'m', 'б':',', 'ю':'.', '.':'/',
  'Й':'Q', 'Ц':'W', 'У':'E', 'К':'R', 'Е':'T', 'Н':'Y', 'Г':'U', 'Ш':'I', 'Щ':'O', 'З':'P', 'Х':'{', 'Ї':'}',
  'Ф':'A', 'Ы':'S', 'І':'S', 'В':'D', 'А':'F', 'П':'G', 'Р':'H', 'О':'J', 'Л':'K', 'Д':'L', 'Ж':':', 'Є':'"',
  'Я':'Z', 'Ч':'X', 'С':'C', 'М':'V', 'И':'B', 'Т':'N', 'Ь':'M', 'Б':'<', 'Ю':'>', ',':'?',
  '?':'/', 'ё':'`', 'Ё':'~', '№':'#'
}

export const translateCyrillic = (str) => {
  return String(str || '').split('').map(char => cyrillicToLatinMap[char] || char).join('')
}

export const stripCuttersBreakdown = (value = '') => {
  let info = String(value || '')
  let markerIdx = info.indexOf('[CUTTERS_BREAKDOWN:')

  while (markerIdx !== -1) {
    const jsonStart = info.indexOf('{', markerIdx)
    if (jsonStart === -1) break

    let depth = 0
    let jsonEnd = -1
    for (let i = jsonStart; i < info.length; i++) {
      if (info[i] === '{') depth++
      else if (info[i] === '}') {
        depth--
        if (depth === 0) {
          jsonEnd = i
          break
        }
      }
    }

    if (jsonEnd === -1) break

    const markerEnd = info[jsonEnd + 1] === ']' ? jsonEnd + 2 : jsonEnd + 1
    info = `${info.slice(0, markerIdx)}${info.slice(markerEnd)}`.replace(/\s{2,}/g, ' ').trim()
    markerIdx = info.indexOf('[CUTTERS_BREAKDOWN:')
  }

  return info
}

export const parseCuttersBreakdown = (cardInfo = '') => {
  const info = String(cardInfo || '')
  const markerIdx = info.indexOf('[CUTTERS_BREAKDOWN:')
  if (markerIdx === -1) return null

  const jsonStart = info.indexOf('{', markerIdx)
  if (jsonStart === -1) return null

  let depth = 0
  let jsonEnd = -1
  for (let i = jsonStart; i < info.length; i++) {
    if (info[i] === '{') depth++
    else if (info[i] === '}') {
      depth--
      if (depth === 0) {
        jsonEnd = i
        break
      }
    }
  }

  if (jsonEnd === -1) return null

  try {
    return JSON.parse(info.slice(jsonStart, jsonEnd + 1))
  } catch {
    return null
  }
}

// Ланцюжок Цеху №1
export const CHAIN = [
  'Розкрій',
  'Галтовка (Вібростіл)',
  'Галтовка (Мийка)',
  'Галтовка (Галтовка)',
  'Галтовка (Сушка)',
  'Прийомка',
  'Сортування'
]

export const MACHINE_TYPES = [
  'CNC 1200x800 - 4 листи (Малий)',
  'CNC 3050(16)х16 - 3-12 листів (швидкісний)',
  'CNC 3060х1600 - 3-36 листів (Три Головий)',
  'CNC 6000x2000 - 4 - 96 листів (Дракон)',
  'CNC KE XIN - 4 - 16 листів (ФЕЯ)'
]

export const getMachineSequenceConfig = (machineName = '') => {
  const name = machineName.toLowerCase().replace(/х/g, 'x')
  if (name.includes('ke xin') || name.includes('kexin') || name.includes('фея')) return { prefix: 'Ф', min: 1, max: 20 }
  if (name.includes('1200x800') || name.includes('12x8') || name.includes('малий')) return { prefix: '1.', min: 1, max: 27 }
  if (name.includes('3050') || name.includes('16x16') || name.includes('швидкісний')) return { prefix: '2.', min: 1, max: 2 }
  if (name.includes('3060') || name.includes('30x16') || name.includes('три голов')) return { prefix: '3.', min: 1, max: 4 }
  if (name.includes('6000x2000') || name.includes('60x20') || name.includes('дракон')) return { prefix: 'D', min: 1, max: null }
  return { prefix: '', min: 1, max: null }
}

export const formatMachineSequence = (machineName, sequence) => {
  const value = String(sequence || '').trim()
  if (!value) return ''
  const { prefix } = getMachineSequenceConfig(machineName)
  return prefix && !value.toLowerCase().startsWith(prefix.toLowerCase()) ? `${prefix}${value}` : value
}

export const formatSec = (totalSec) => {
  const hrs = Math.floor(totalSec / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  const secs = totalSec % 60
  return [hrs, mins, secs].map(v => String(v).padStart(2, '0')).join(':')
}

export const parseDBTime = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d;
}

export const formatDateTimeParts = (date) => {
  if (!date) return { date: '—', time: '' };
  const d = new Date(date);
  if (isNaN(d.getTime())) return { date: '—', time: '' };
  const datePart = d.toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timePart = d.toLocaleString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  return { date: datePart, time: timePart };
}

export const formatPlanned = (mins) => {
  if (!mins || mins <= 0) return '—'
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  if (h > 0) return `${h}год ${m}хв`
  return `${m}хв`
}

export const formatMachine = (name) => {
  if (!name) return '—'
  const match = name.match(/№\s*(\S+)/)
  return match ? `№${match[1]}` : name
}
