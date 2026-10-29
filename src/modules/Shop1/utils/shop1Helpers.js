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

export const STANDARD_CUTTER_DIAMETERS = ['1,5мм', '2мм', '3мм', '4мм', '6мм']

export const detectCutterDiameter = (name = '') => {
  if (!name) return null
  const clean = String(name).trim().toLowerCase()

  if (clean === '1.5мм' || clean === '1,5мм' || clean === '1.5' || clean === '1,5') return '1,5мм'
  if (clean === '2мм' || clean === '2' || clean === '2.0' || clean === '2,0') return '2мм'
  if (clean === '3мм' || clean === '3' || clean === '3.0' || clean === '3,0') return '3мм'
  if (clean === '4мм' || clean === '4' || clean === '4.0' || clean === '4,0') return '4мм'
  if (clean === '6мм' || clean === '6' || clean === '6.0' || clean === '6,0') return '6мм'

  if (/(?:^|\D)1[.,]5(?:\s*мм|[xх*]|\b)/i.test(clean) || clean.includes('1.5') || clean.includes('1,5')) {
    return '1,5мм'
  }

  const matchX = clean.match(/(?:ф|\b)(\d+(?:[.,]\d+)?)\s*[xх*]/i)
  if (matchX && matchX[1]) {
    const num = parseFloat(matchX[1].replace(',', '.'))
    if (num === 1.5) return '1,5мм'
    if (num === 2) return '2мм'
    if (num === 3) return '3мм'
    if (num === 4) return '4мм'
    if (num === 6) return '6мм'
    return `${num}мм`
  }

  const matchPhi = clean.match(/ф\s*(\d+(?:[.,]\d+)?)/i)
  if (matchPhi && matchPhi[1]) {
    const num = parseFloat(matchPhi[1].replace(',', '.'))
    if (num === 1.5) return '1,5мм'
    if (num === 2) return '2мм'
    if (num === 3) return '3мм'
    if (num === 4) return '4мм'
    if (num === 6) return '6мм'
    return `${num}мм`
  }

  const matchMm = clean.match(/(\d+(?:[.,]\d+)?)\s*мм/i)
  if (matchMm && matchMm[1]) {
    const num = parseFloat(matchMm[1].replace(',', '.'))
    if (num === 1.5) return '1,5мм'
    if (num === 2) return '2мм'
    if (num === 3) return '3мм'
    if (num === 4) return '4мм'
    if (num === 6) return '6мм'
    return `${num}мм`
  }

  return null
}

export const extractCuttersByDiameter = (cardInfoOrBreakdown = null) => {
  const result = {
    '1,5мм': 0,
    '2мм': 0,
    '3мм': 0,
    '4мм': 0,
    '6мм': 0,
    other: {},
    total: 0,
    hasData: false
  }

  let breakdown = cardInfoOrBreakdown
  if (typeof cardInfoOrBreakdown === 'string') {
    breakdown = parseCuttersBreakdown(cardInfoOrBreakdown)
  }

  if (!breakdown || typeof breakdown !== 'object') return result

  Object.entries(breakdown).forEach(([name, count]) => {
    const qty = Number(count) || 0
    if (qty <= 0) return
    result.hasData = true
    result.total += qty

    const diam = detectCutterDiameter(name)
    if (diam && result[diam] !== undefined) {
      result[diam] += qty
    } else if (diam) {
      result.other[diam] = (result.other[diam] || 0) + qty
    } else {
      result.other[name] = (result.other[name] || 0) + qty
    }
  })

  return result
}

export const stripQcOpsStamps = (value = '') => {
  let info = String(value || '')
  let markerIdx = info.indexOf('[QC_OPS:')

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
    markerIdx = info.indexOf('[QC_OPS:')
  }

  return info
}

export const parseQcOpsStamps = (cardInfo = '') => {
  const info = String(cardInfo || '')
  const markerIdx = info.indexOf('[QC_OPS:')
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
  'Галтовка',
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
  if (h > 0 && m > 0) return `${h}год ${m}хв`
  if (h > 0) return `${h}год`
  return `${m}хв`
}

export const formatMachine = (name) => {
  if (!name) return '—'
  const match = name.match(/№\s*(\S+)/)
  return match ? `№${match[1]}` : name
}
