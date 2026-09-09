import { useState, useMemo } from 'react'

const getXLSX = async () => {
  if (typeof window !== 'undefined' && window.XLSX) return window.XLSX
  const xlsxMod = await import('xlsx')
  return xlsxMod.default || xlsxMod
}

// ─── 1. PURE STRING & HOMOGLYPH PARSERS ───

export const normalizeHomoglyphs = (str) => {
  if (!str) return ''
  const mapper = {
    'а': 'a', 'в': 'v', 'с': 'c', 'е': 'e', 'н': 'h', 'к': 'k', 'м': 'm', 'о': 'o', 'р': 'p', 'т': 't', 'х': 'x', 'у': 'y', 'і': 'i', 'ї': 'i', 'є': 'e',
    'А': 'a', 'В': 'v', 'С': 'c', 'Е': 'e', 'Н': 'h', 'К': 'k', 'М': 'm', 'О': 'o', 'Р': 'p', 'Т': 't', 'Х': 'x', 'У': 'y', 'І': 'i', 'Ї': 'i', 'Є': 'e'
  }
  return str.toLowerCase().trim().split('').map(c => mapper[c] || c).join('').replace(/[^a-z0-9]/g, '')
}

export const parseCSV = (text, delimiter = ';') => {
  const lines = []
  let row = [""]
  let inQuotes = false
  const cleanText = (text || '').replace(/^\uFEFF/, '')
  
  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i]
    const nextChar = cleanText[i + 1]
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        row[row.length - 1] += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === delimiter && !inQuotes) {
      row.push("")
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++
      }
      lines.push(row.map(cell => cell.trim()))
      row = [""]
    } else {
      row[row.length - 1] += char
    }
  }
  if (row.length > 1 || row[0] !== "") {
    lines.push(row.map(cell => cell.trim()))
  }
  return lines.filter(line => line.length > 0 && line.some(cell => cell !== ""))
}

export const detectDelimiter = (text) => {
  const firstLine = (text || '').replace(/^\uFEFF/, '').split(/\r?\n/)[0] || text
  const commaCount = (firstLine.match(/,/g) || []).length
  const semicolonCount = (firstLine.match(/;/g) || []).length
  const tabCount = (firstLine.match(/\t/g) || []).length
  if (tabCount > semicolonCount && tabCount > commaCount) return '\t'
  return semicolonCount >= commaCount ? ';' : ','
}

export const parseDiameterFromName = (name) => {
  if (!name) return 0
  const match = name.match(/(?:^|\s|ø)(\d+(?:[.,]\d+)?)\s*(?:[хxХX*×]|\s*мм|\s*mm)/i)
  if (match && match[1]) {
    const val = parseFloat(match[1].replace(',', '.'))
    if (!isNaN(val) && val > 0) return val
  }
  const genericMatch = name.match(/(\d+(?:[.,]\d+)?)/)
  if (genericMatch && genericMatch[1]) {
    const val = parseFloat(genericMatch[1].replace(',', '.'))
    if (!isNaN(val) && val > 0) return val
  }
  return 0
}

export const autoDetectMapping = (headers) => {
  const mapping = {
    login: -1,
    password: -1,
    first_name: -1,
    last_name: -1,
    department: -1,
    position: -1,
    shift: -1
  }
  
  const normalize = (s) => (s || '').toLowerCase().replace(/[^a-zа-яєіїґ0-9]/g, '')
  
  headers.forEach((h, index) => {
    const norm = normalize(h)
    if (norm === 'login' || norm === 'логин' || norm === 'логін' || norm === 'юзернейм' || norm === 'username') {
      mapping.login = index
    } else if (norm === 'password' || norm === 'пароль' || norm === 'pass' || norm === 'pwd') {
      mapping.password = index
    } else if (norm === 'firstname' || norm === 'имя' || norm === 'імя' || norm === 'ім’я' || norm === 'first_name' || norm === 'name') {
      mapping.first_name = index
    } else if (norm === 'lastname' || norm === 'фамилия' || norm === 'прізвище' || norm === 'last_name' || norm === 'surname') {
      mapping.last_name = index
    } else if (norm === 'department' || norm === 'цех' || norm === 'відділ' || norm === 'подразделение' || norm === 'департамент') {
      mapping.department = index
    } else if (norm === 'position' || norm === 'посада' || norm === 'роль' || norm === 'должность' || norm === 'фах') {
      mapping.position = index
    } else if (norm === 'shift' || norm === 'зміна' || norm === 'смена' || norm === 'бригада') {
      mapping.shift = index
    }
  })
  return mapping
}

export const matchDepartment = (rawVal, compStructure, defaultVal) => {
  if (!rawVal) return defaultVal
  const clean = rawVal.trim().toLowerCase()
  
  let found = (compStructure || []).find(s => s.name.toLowerCase() === clean)
  if (found) return found.name
  
  const rawNum = clean.replace(/[^0-9]/g, '')
  if (rawNum) {
    found = (compStructure || []).find(s => s.name.replace(/[^0-9]/g, '') === rawNum)
    if (found) return found.name
  }
  
  found = (compStructure || []).find(s => s.name.toLowerCase().includes(clean) || clean.includes(s.name.toLowerCase()))
  if (found) return found.name

  return defaultVal
}

export const matchPosition = (rawVal, compPositions, defaultVal) => {
  if (!rawVal) return defaultVal
  const clean = rawVal.trim().toLowerCase()
  
  let found = (compPositions || []).find(p => p.name.toLowerCase() === clean)
  if (found) return found.name
  
  found = (compPositions || []).find(p => p.name.toLowerCase().includes(clean) || clean.includes(p.name.toLowerCase()))
  if (found) return found.name

  return defaultVal
}

// ─── 2. PURE DOMAIN COMPUTATIONS ───

export const computeBzRemnants = (parsedCsv, nomenclatures, inventory = []) => {
  if (!parsedCsv || parsedCsv.length === 0) {
    throw new Error('Помилка: файл порожній або має невірний формат.')
  }

  const headers = parsedCsv[0] || []
  
  let nameColIdx = headers.findIndex(h => {
    const norm = (h || '').toLowerCase().trim()
    return norm.includes('номенклатура') || norm.includes('назва') || norm.includes('найменування') || norm.includes('деталь') || norm.includes('виріб') || norm.includes('товар') || norm === 'name' || norm === 'item'
  })
  
  let qtyColIdx = headers.findIndex(h => {
    const norm = (h || '').toLowerCase().trim()
    return norm.includes('склад') || norm.includes('кількість') || norm.includes('залишок') || norm.includes('к-сть') || norm.includes('всього') || norm === 'qty' || norm === 'quantity' || norm === 'count'
  })

  let startRowIdx = 1
  if (nameColIdx === -1 || qtyColIdx === -1) {
    if (parsedCsv[0]?.length >= 2 && isNaN(parseFloat((parsedCsv[0][1] || '').replace(/\s+/g, '')))) {
      nameColIdx = 0
      qtyColIdx = 1
      startRowIdx = 1
    } else if (parsedCsv[0]?.length >= 2 && !isNaN(parseFloat((parsedCsv[0][1] || '').replace(/\s+/g, '')))) {
      nameColIdx = 0
      qtyColIdx = 1
      startRowIdx = 0
    } else {
      throw new Error('Помилка: не знайдено обов\'язкові колонки ("Номенклатура" та "Склад") у CSV файлі.')
    }
  }

  const parsedRows = parsedCsv.slice(startRowIdx)
  const itemsMap = new Map()

  const dbNomMap = {}
  ;(nomenclatures || []).forEach(n => {
    dbNomMap[normalizeHomoglyphs(n.name)] = n
  })

  const existingSgpMap = {}
  ;(inventory || []).forEach(i => {
    if (i.warehouse === 'sgp' && i.pocket_owner == null) {
      existingSgpMap[normalizeHomoglyphs(i.name)] = i
    }
  })

  parsedRows.forEach((row, idx) => {
    const nameVal = row[nameColIdx] ? row[nameColIdx].trim() : ''
    if (!nameVal) return
    const lower = nameVal.toLowerCase()
    if (lower.includes('разом') || lower.includes('всього') || lower === 'total' || lower.startsWith('підсумок')) return

    const rawQty = (row[qtyColIdx] || '').toString().replace(/\s+/g, '').replace(',', '.')
    const parsedQty = parseFloat(rawQty)
    const qtyVal = isNaN(parsedQty) ? 0 : Math.max(0, Math.round(parsedQty))

    const normName = normalizeHomoglyphs(nameVal)
    if (!normName) return

    const matchedNom = dbNomMap[normName]
    const existingSgp = existingSgpMap[normName]
    const isNew = !matchedNom && !existingSgp
    const canonicalName = matchedNom?.name || existingSgp?.name || nameVal
    const currentQty = existingSgp ? Number(existingSgp.total_qty || 0) : 0
    const reservedQty = existingSgp ? Number(existingSgp.reserved_qty || 0) : 0

    const key = matchedNom ? `nom_${matchedNom.id}` : normName

    if (!itemsMap.has(key)) {
      itemsMap.set(key, {
        nomenclature_id: matchedNom?.id || existingSgp?.nomenclature_id || null,
        name: canonicalName,
        qty: 0,
        currentQty,
        reservedQty,
        unit: matchedNom?.unit || existingSgp?.unit || 'шт',
        type: 'finished',
        isNew,
        rowNum: idx + startRowIdx + 1
      })
    }
    itemsMap.get(key).qty += qtyVal
  })

  const allItems = Array.from(itemsMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'uk'))
  const leftovers = allItems
  const unrecognized = allItems.filter(it => it.isNew)
  const assembledKits = []

  return { assembledKits, leftovers, unrecognized }
}

export const computeSheetsRemnants = (parsedCsv, nomenclatures) => {
  const headers = parsedCsv[0] || []
  
  const nameColIdx = headers.findIndex(h => {
    const norm = (h || '').toLowerCase().trim()
    return norm.includes('номенклатура') || norm.includes('назва') || norm === 'name'
  })
  
  const qtyColIdx = headers.findIndex(h => {
    const norm = (h || '').toLowerCase().trim()
    return norm.includes('склад') || norm.includes('кількість') || norm === 'qty' || norm === 'quantity'
  })

  if (nameColIdx === -1 || qtyColIdx === -1) {
    throw new Error('Помилка: не знайдено обов\'язкові колонки ("Номенклатура" та "Склад") у CSV файлі.')
  }

  const parsedRows = parsedCsv.slice(1)
  const previewList = []

  const dbNomMap = {}
  ;(nomenclatures || []).forEach(n => {
    dbNomMap[normalizeHomoglyphs(n.name)] = n
  })

  parsedRows.forEach((row, idx) => {
    const nameVal = row[nameColIdx] ? row[nameColIdx].trim() : ''
    const qtyVal = parseInt(row[qtyColIdx]) || 0

    if (!nameVal || qtyVal <= 0) return

    const normName = normalizeHomoglyphs(nameVal)
    const matchedNom = dbNomMap[normName]

    if (matchedNom) {
      previewList.push({
        name: nameVal,
        qty: qtyVal,
        nomenclature_id: matchedNom.id,
        isNew: false,
        rowNum: idx + 2
      })
    } else {
      previewList.push({
        name: nameVal,
        qty: qtyVal,
        nomenclature_id: null,
        isNew: true,
        rowNum: idx + 2
      })
    }
  })

  return previewList
}

export const normalizeCutterKey = (name) => {
  if (!name) return ''
  return name.trim().toLowerCase().replace(/[\u0445\u0425]/g, 'x').replace(/\s+/g, ' ')
}

export const computeCuttersList = (parsedCsv) => {
  if (!parsedCsv || parsedCsv.length === 0) {
    throw new Error('Помилка: файл порожній.')
  }

  let headerRowIdx = -1
  let nameColIdx = -1
  let diamColIdx = -1
  let qtyColIdx = -1

  // Scan first up to 6 rows to locate the header row
  for (let r = 0; r < Math.min(6, parsedCsv.length); r++) {
    const row = parsedCsv[r] || []
    const nIdx = row.findIndex(h => {
      const n = String(h || '').toLowerCase().trim()
      return n.includes('номенклатура') || n.includes('найменування') || n.includes('назва') || n === 'name' || n.includes('позиція') || n.includes('фреза')
    })
    if (nIdx !== -1) {
      headerRowIdx = r
      nameColIdx = nIdx
      diamColIdx = row.findIndex(h => {
        const n = String(h || '').toLowerCase().trim()
        return n.includes('діаметр') || n.includes('диаметр') || n.includes('diameter') || n.includes('діам') || n.includes('диам') || n === 'd' || n === 'ø'
      })
      qtyColIdx = row.findIndex(h => {
        const n = String(h || '').toLowerCase().trim()
        return n.includes('залишок') || n.includes('остаток') || n.includes('склад') || n.includes('кількість') || n.includes('к-сть') || n.includes('кол-во') || n === 'qty' || n === 'quantity'
      })
      break
    }
  }

  if (nameColIdx === -1) {
    throw new Error('Помилка: не знайдено колонку «Номенклатура» (або «Назва» / «Найменування»).')
  }

  const rows = parsedCsv.slice(headerRowIdx + 1)
  const items = []
  rows.forEach((row, idx) => {
    const name = row[nameColIdx] ? String(row[nameColIdx]).trim() : ''
    if (!name) return
    const lower = name.toLowerCase()
    if (lower.includes('разом') || lower.includes('всього') || lower === 'total' || lower.startsWith('підсумок')) return

    const rawDiam = diamColIdx !== -1 ? String(row[diamColIdx] || '').replace(',', '.').trim() : ''
    const diameter = parseFloat(rawDiam) || parseDiameterFromName(name) || 0
    const rawQty = qtyColIdx !== -1 ? String(row[qtyColIdx] || '').trim() : ''
    const cleanedQty = String(rawQty).replace(/\s+/g, '').replace(',', '.')
    const parsedQty = parseInt(cleanedQty, 10)
    const qty = isNaN(parsedQty) ? 0 : Math.max(0, parsedQty)

    // Allow qty === 0 so all cutters from the inventory file are imported
    items.push({ name, diameter, qty, rowNum: headerRowIdx + idx + 2 })
  })

  items.sort((a, b) => {
    if (a.diameter !== b.diameter) return a.diameter - b.diameter
    return a.name.localeCompare(b.name, 'uk')
  })
  return items
}

export const computeFastenersList = (parsedCsv) => {
  const headers = parsedCsv[0] || []
  const nameColIdx = headers.findIndex(h => {
    const n = (h || '').toLowerCase().trim()
    return n.includes('номенклатура') || n.includes('назва') || n === 'name'
  })
  let qtyColIdx = headers.findIndex(h => (h || '').toLowerCase().includes('залишок'))
  if (qtyColIdx === -1) qtyColIdx = headers.findIndex(h => {
    const n = (h || '').toLowerCase().trim()
    return n.includes('склад') || n.includes('кількість') || n === 'qty'
  })
  if (nameColIdx === -1) {
    throw new Error('Помилка: не знайдено колонку «Номенклатура».')
  }
  const rows = parsedCsv.slice(1)
  const items = []
  rows.forEach((row, idx) => {
    const name = row[nameColIdx] ? row[nameColIdx].trim() : ''
    if (!name) return
    const lower = name.toLowerCase()
    if (lower.includes('разом') || lower.includes('всього') || lower === 'total') return
    const rawQty = qtyColIdx !== -1 ? (row[qtyColIdx] || '').trim() : ''
    const cleanedQty = String(rawQty).replace(/\s+/g, '').replace(',', '.')
    const parsedQty = parseInt(cleanedQty, 10)
    const qty = isNaN(parsedQty) ? 0 : Math.max(0, parsedQty)
    items.push({ name, qty, rowNum: idx + 2 })
  })
  items.sort((a, b) => a.name.localeCompare(b.name, 'uk'))
  return items
}

export const computeUserPreviewData = ({
  csvRows,
  columnMapping,
  defaultValues,
  duplicatePolicy,
  systemUsers,
  companyStructure,
  companyPositions
}) => {
  if (!csvRows || csvRows.length === 0) return []
  
  return csvRows.map((row, rowIndex) => {
    const getVal = (fieldIndex) => {
      if (fieldIndex === undefined || fieldIndex === -1 || fieldIndex >= row.length) return ''
      return (row[fieldIndex] || '').trim()
    }
    
    const rawLogin = getVal(columnMapping.login)
    const cleanLogin = rawLogin.replace(/@/g, '').toLowerCase().replace(/[^a-z0-9_.-]/g, '')
    
    const rawPassword = getVal(columnMapping.password)
    const password = rawPassword || defaultValues.password
    
    const first_name = getVal(columnMapping.first_name)
    const last_name = getVal(columnMapping.last_name)
    
    const rawDept = getVal(columnMapping.department)
    const department = matchDepartment(rawDept, companyStructure, defaultValues.department)
    
    const rawPos = getVal(columnMapping.position)
    const position = matchPosition(rawPos, companyPositions, defaultValues.position)
    
    const rawShift = getVal(columnMapping.shift)
    let shift = 'Без зміни'
    if (rawShift) {
      const match = ['Зміна 1', 'Зміна 2', 'Зміна 3', 'Зміна 4', 'Без зміни'].find(
        s => s.toLowerCase() === rawShift.toLowerCase() || s.replace(/[^0-9]/g, '') === rawShift.replace(/[^0-9]/g, '')
      )
      if (match) shift = match
    } else {
      shift = defaultValues.shift
    }
    
    let status = 'insert'
    let message = 'Буде створено'
    
    if (!cleanLogin) {
      status = 'error'
      message = 'Помилка: відсутній логін'
    } else {
      const existing = (systemUsers || []).find(u => u.login.toLowerCase() === cleanLogin)
      if (existing) {
        if (duplicatePolicy === 'skip') {
          status = 'skip'
          message = 'Пропустити (дублікат)'
        } else {
          status = 'update'
          message = `Оновити (ID: ${existing.id})`
        }
      }
    }
    
    return {
      key: rowIndex,
      rawRow: row,
      login: cleanLogin || rawLogin,
      password,
      first_name,
      last_name,
      department,
      position,
      shift,
      status,
      message
    }
  })
}

// ─── 3. SUBHOOK IMPLEMENTATION ───

export function useSettingsImports({
  nomenclatures,
  inventory,
  refreshTable,
  fetchData,
  supabase,
  companyStructure,
  companyPositions,
  systemUsers
}) {
  // SGP remnants upload states
  const [bzFile, setBzFile] = useState(null)
  const [bzDelimiter, setBzDelimiter] = useState(';')
  const [bzRecordMode, setBzRecordMode] = useState('overwrite')
  const [bzUploadStatus, setBzUploadStatus] = useState('idle')
  const [bzUploadLog, setBzUploadLog] = useState('')
  const [bzActivePreviewTab, setBzActivePreviewTab] = useState('all')
  const [bzAssembledKits, setBzAssembledKits] = useState([])
  const [bzLeftovers, setBzLeftovers] = useState([])
  const [bzUnrecognized, setBzUnrecognized] = useState([])

  // Prepared sheets upload states
  const [sheetsFile, setSheetsFile] = useState(null)
  const [sheetsDelimiter, setSheetsDelimiter] = useState(';')
  const [sheetsRecordMode, setSheetsRecordMode] = useState('add')
  const [sheetsUploadStatus, setSheetsUploadStatus] = useState('idle')
  const [sheetsUploadLog, setSheetsUploadLog] = useState('')
  const [sheetsActivePreviewTab, setSheetsActivePreviewTab] = useState('all')
  const [sheetsPreviewList, setSheetsPreviewList] = useState([])

  // Cutter stock upload states
  const [cuttersFile, setCuttersFile] = useState(null)
  const [cuttersRecordMode, setCuttersRecordMode] = useState('overwrite')
  const [cuttersUploadStatus, setCuttersUploadStatus] = useState('idle')
  const [cuttersUploadLog, setCuttersUploadLog] = useState('')
  const [cuttersPreviewList, setCuttersPreviewList] = useState([])

  // Fasteners stock upload states
  const [fastenersFile, setFastenersFile] = useState(null)
  const [fastenersRecordMode, setFastenersRecordMode] = useState('overwrite')
  const [fastenersUploadStatus, setFastenersUploadStatus] = useState('idle')
  const [fastenersUploadLog, setFastenersUploadLog] = useState('')
  const [fastenersPreviewList, setFastenersPreviewList] = useState([])

  // CSV User Import States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [csvFile, setCsvFile] = useState(null)
  const [csvDelimiter, setCsvDelimiter] = useState(';')
  const [csvHeaders, setCsvHeaders] = useState([])
  const [csvRows, setCsvRows] = useState([])
  const [columnMapping, setColumnMapping] = useState({
    login: -1,
    password: -1,
    first_name: -1,
    last_name: -1,
    department: -1,
    position: -1,
    shift: -1
  })
  const [defaultValues, setDefaultValues] = useState({
    password: 'password123',
    department: companyStructure?.[0]?.name || 'Цех №1',
    position: companyPositions?.[0]?.name || 'Оператор',
    shift: 'Без зміни',
    access_rights: { operator: true }
  })
  const [duplicatePolicy, setDuplicatePolicy] = useState('skip')
  const [importStatus, setImportStatus] = useState('idle')
  const [importLog, setImportLog] = useState('')

  const handleBzFileChange = async (e) => {
    try {
      const file = e.target.files[0]
      if (!file) return
      
      setBzFile(file)
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const text = event.target.result
          const delim = detectDelimiter(text)
          setBzDelimiter(delim)
          
          const parsed = parseCSV(text, delim)
          if (parsed.length > 0) {
            processBzRemnants(parsed)
          } else {
            alert('Помилка: файл порожній або має невірний формат.')
          }
        } catch (innerErr) {
          console.error(innerErr)
          alert('Помилка обробки вмісту файлу залишків СГП: ' + innerErr.message)
        }
        e.target.value = ''
      }
      reader.readAsText(file, 'UTF-8')
    } catch (err) {
      console.error(err)
      alert('Помилка завантаження файлу залишків СГП: ' + err.message)
      if (e?.target) e.target.value = ''
    }
  }

  const processBzRemnants = (parsedCsv) => {
    try {
      const { assembledKits, leftovers, unrecognized } = computeBzRemnants(parsedCsv, nomenclatures, inventory)
      setBzAssembledKits(assembledKits)
      setBzLeftovers(leftovers)
      setBzUnrecognized(unrecognized)
      setBzActivePreviewTab('all')
      setBzUploadStatus('preview')
    } catch (err) {
      alert(err.message)
    }
  }

  const executeBzUpload = async () => {
    setBzUploadStatus('uploading')
    setBzUploadLog('Початок швидкої актуалізації залишків СГП...\n')

    try {
      // 1. Отримання найсвіжіших залишків СГП безпосередньо з бази даних
      setBzUploadLog(prev => prev + `Синхронізація поточних залишків СГП з базою даних...\n`)
      let freshSgpInventory = []
      try {
        const { data: dbInv, error: invErr } = await supabase
          .from('inventory')
          .select('id, nomenclature_id, name, type, warehouse, total_qty, reserved_qty, pocket_owner')
          .eq('warehouse', 'sgp')
          .eq('type', 'finished')
          .is('pocket_owner', null)
        if (!invErr && Array.isArray(dbInv)) {
          freshSgpInventory = dbInv
        }
      } catch (e) {
        console.warn('Direct SGP inventory fetch warning:', e)
      }

      // Об'єднуємо з кешем контексту на випадок затримки
      const combinedSgpInventory = [...freshSgpInventory]
      ;(inventory || []).forEach(i => {
        if (i.warehouse === 'sgp' && i.type === 'finished' && i.pocket_owner == null && !combinedSgpInventory.some(ci => ci.id === i.id)) {
          combinedSgpInventory.push(i)
        }
      })

      // Словники пошуку для СГП
      // ВАЖЛИВО: дедублікуємо combinedSgpInventory перш ніж будувати Map.
      // Якщо для одного nomenclature_id є кілька рядків — беремо той, у якого більший total_qty,
      // а всі зайві запам'ятовуємо для подальшого обнулення.
      const seenNomIds = new Map()   // nomId → canonical inventory row
      const seenNormNames = new Map() // normName → canonical inventory row
      const staleDuplicateIds = []   // зайві рядки для обнулення

      combinedSgpInventory.forEach(item => {
        const norm = normalizeHomoglyphs(item.name)
        const nomKey = item.nomenclature_id ? String(item.nomenclature_id) : null

        if (nomKey) {
          if (seenNomIds.has(nomKey)) {
            // Залишаємо той, у кого більший total_qty як canonical
            const existing = seenNomIds.get(nomKey)
            if ((Number(item.total_qty) || 0) > (Number(existing.total_qty) || 0)) {
              staleDuplicateIds.push(existing.id)
              seenNomIds.set(nomKey, item)
              seenNormNames.set(norm, item)
            } else {
              staleDuplicateIds.push(item.id)
            }
          } else {
            seenNomIds.set(nomKey, item)
            if (norm && !seenNormNames.has(norm)) seenNormNames.set(norm, item)
          }
        } else {
          if (norm) {
            if (seenNormNames.has(norm)) {
              staleDuplicateIds.push(item.id)
            } else {
              seenNormNames.set(norm, item)
            }
          }
        }
      })

      const sgpByNomId = seenNomIds
      const sgByNormName = seenNormNames

      // Обнулюємо зайві дублікати в БД (silent cleanup)
      if (staleDuplicateIds.length > 0) {
        setBzUploadLog(prev => prev + `⚠️ Виявлено ${staleDuplicateIds.length} дублікат(ів) у СГП — обнуляємо зайві рядки...\n`)
        const CLEAN_CHUNK = 50
        for (let i = 0; i < staleDuplicateIds.length; i += CLEAN_CHUNK) {
          const chunk = staleDuplicateIds.slice(i, i + CLEAN_CHUNK)
          await supabase.from('inventory').update({ total_qty: 0, reserved_qty: 0 }).in('id', chunk)
        }
      }

      // 2. Словник номенклатур
      const dbNomMap = new Map()
      ;(nomenclatures || []).forEach(n => {
        const norm = normalizeHomoglyphs(n.name)
        if (norm) dbNomMap.set(norm, n)
      })

      // 3. Пакетне створення нових номенклатур (якщо будь-яких деталей ще немає в системі)
      const missingNoms = []
      const seenNewNorms = new Set()
      bzLeftovers.forEach(item => {
        const norm = normalizeHomoglyphs(item.name)
        if (!item.nomenclature_id && !dbNomMap.has(norm) && !seenNewNorms.has(norm)) {
          missingNoms.push({ name: item.name, type: 'part' })
          seenNewNorms.add(norm)
        }
      })

      if (missingNoms.length > 0) {
        setBzUploadLog(prev => prev + `Створення нових позицій в довіднику номенклатур (${missingNoms.length} шт)...\n`)
        const { data: createdNoms, error: nomErr } = await supabase
          .from('nomenclatures')
          .insert(missingNoms)
          .select('id, name')

        if (createdNoms && Array.isArray(createdNoms)) {
          createdNoms.forEach(cn => {
            const nNorm = normalizeHomoglyphs(cn.name)
            dbNomMap.set(nNorm, cn)
            setBzUploadLog(prev => prev + `  ✅ [СТВОРЕНО НОМЕНКЛАТУРУ] ${cn.name}\n`)
          })
        } else if (nomErr) {
          setBzUploadLog(prev => prev + `  ⚠️ [ПОПЕРЕДЖЕННЯ] ${nomErr.message}\n`)
        }
      }

      // 4. Підготовка масивів оновлення та додавання
      const updates = []
      const insertsWithNomId = []    // записи з nomenclature_id → upsert по nomenclature_id
      const insertsNameOnly = []     // записи без nomenclature_id → update existing або insert

      bzLeftovers.forEach(item => {
        const norm = normalizeHomoglyphs(item.name)
        const nomRec = (item.nomenclature_id ? { id: item.nomenclature_id, name: item.name } : null) || dbNomMap.get(norm)
        const nomId = nomRec?.id || item.nomenclature_id || null
        const canonicalName = nomRec?.name || item.name

        const existing = (nomId && sgpByNomId.get(String(nomId))) || sgByNormName.get(norm)

        if (existing) {
          const curQty = Number(existing.total_qty) || 0
          const newTotal = bzRecordMode === 'add' ? curQty + item.qty : item.qty
          updates.push({
            id: existing.id,
            nomenclature_id: nomId || existing.nomenclature_id,
            name: canonicalName,
            type: 'finished',
            warehouse: 'sgp',
            unit: existing.unit || item.unit || 'шт',
            total_qty: newTotal,
            reserved_qty: existing.reserved_qty || 0,
            updated_at: new Date().toISOString()
          })
          setBzUploadLog(prev => prev + `[ОНОВИТИ СГП] ${canonicalName}: ${newTotal} шт (${bzRecordMode === 'add' ? `+${item.qty}` : 'перезапис'})\n`)
        } else if (nomId) {
          // Немає у БД, але є nomenclature_id → upsert (не insert!) щоб уникнути дублів
          insertsWithNomId.push({
            nomenclature_id: nomId,
            name: canonicalName,
            type: 'finished',
            warehouse: 'sgp',
            unit: item.unit || 'шт',
            total_qty: item.qty,
            reserved_qty: 0,
            updated_at: new Date().toISOString()
          })
          setBzUploadLog(prev => prev + `[НОВИЙ СГП] ${canonicalName}: ${item.qty} шт\n`)
        } else {
          // Немає nomenclature_id → звичайний insert тільки якщо ніяк не знайдено
          insertsNameOnly.push({
            name: canonicalName,
            type: 'finished',
            warehouse: 'sgp',
            unit: item.unit || 'шт',
            total_qty: item.qty,
            reserved_qty: 0,
            updated_at: new Date().toISOString()
          })
          setBzUploadLog(prev => prev + `[НОВИЙ СГП (без ном.)] ${canonicalName}: ${item.qty} шт\n`)
        }
      })

      setBzUploadLog(prev => prev + `\nЗапис змін у базі даних (оновлення: ${updates.length}, нових з ном.ID: ${insertsWithNomId.length}, нових без ном.ID: ${insertsNameOnly.length})...\n`)

      // 5. Швидкий пакетний запис (чанками по 50 записів)
      const CHUNK_SIZE = 50
      for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
        const chunk = updates.slice(i, i + CHUNK_SIZE)
        const { error: updErr } = await supabase.from('inventory').upsert(chunk)
        if (updErr) throw updErr
      }

      // insertsWithNomId → upsert on nomenclature_id conflict (запобігає дублям)
      for (let i = 0; i < insertsWithNomId.length; i += CHUNK_SIZE) {
        const chunk = insertsWithNomId.slice(i, i + CHUNK_SIZE)
        const { error: insErr } = await supabase
          .from('inventory')
          .upsert(chunk, { onConflict: 'nomenclature_id,warehouse' })
        if (insErr) {
          // Якщо немає unique constraint на nomenclature_id — fallback до звичайного insert
          const { error: insErr2 } = await supabase.from('inventory').insert(chunk)
          if (insErr2) throw insErr2
        }
      }

      // insertsNameOnly → звичайний insert (тільки якщо не знайдено жодного збігу)
      for (let i = 0; i < insertsNameOnly.length; i += CHUNK_SIZE) {
        const chunk = insertsNameOnly.slice(i, i + CHUNK_SIZE)
        const { error: insErr } = await supabase.from('inventory').insert(chunk)
        if (insErr) throw insErr
      }

      setBzUploadLog(prev => prev + `\n✅ Успішно оновлено залишки СГП по деталям!\n`)
      setBzUploadStatus('success')

      // 6. Миттєве оновлення всіх глобальних сховищ MES
      if (typeof refreshTable === 'function') {
        refreshTable('inventory')
        refreshTable('nomenclatures')
      }
      if (typeof fetchData === 'function') {
        fetchData(['inventory', 'nomenclatures'])
      }
    } catch (err) {
      console.error('[executeBzUpload] Error:', err)
      setBzUploadLog(prev => prev + `❌ Помилка запису в БД: ${err.message || err}\n`)
      setBzUploadStatus('error')
    }
  }

  const handleSheetsFileChange = async (e) => {
    try {
      const file = e.target.files[0]
      if (!file) return
      
      setSheetsFile(file)
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const text = event.target.result
          const delim = detectDelimiter(text)
          setSheetsDelimiter(delim)
          
          const parsed = parseCSV(text, delim)
          if (parsed.length > 0) {
            processSheetsRemnants(parsed)
          } else {
            alert('Помилка: файл порожній або має невірний формат.')
          }
        } catch (innerErr) {
          console.error(innerErr)
          alert('Помилка обробки вмісту файлу залишків СО: ' + innerErr.message)
        }
        e.target.value = ''
      }
      reader.readAsText(file, 'UTF-8')
    } catch (err) {
      console.error(err)
      alert('Помилка завантаження файлу залишків СО: ' + err.message)
      if (e?.target) e.target.value = ''
    }
  }

  const processSheetsRemnants = (parsedCsv) => {
    try {
      const previewList = computeSheetsRemnants(parsedCsv, nomenclatures)
      setSheetsPreviewList(previewList)
      setSheetsUploadStatus('preview')
    } catch (err) {
      alert(err.message)
    }
  }

  const executeSheetsUpload = async () => {
    setSheetsUploadStatus('uploading')
    setSheetsUploadLog('Початок обробки залишків СО (підготовлені листи)...\n')
    
    const existingInventory = inventory || []
    const updates = []
    const inserts = []

    try {
      const newItems = sheetsPreviewList.filter(item => item.isNew)
      const nomCache = {}
      
      if (newItems.length > 0) {
        setSheetsUploadLog(prev => prev + `Створення нових позицій в номенклатурі (${newItems.length} шт)...\n`)
        for (const item of newItems) {
          if (nomCache[item.name]) {
            item.nomenclature_id = nomCache[item.name]
            item.isNew = false
            continue
          }
          
          const normName = normalizeHomoglyphs(item.name)
          const dbNom = (nomenclatures || []).find(n => normalizeHomoglyphs(n.name) === normName)
          if (dbNom) {
            item.nomenclature_id = dbNom.id
            item.isNew = false
            nomCache[item.name] = dbNom.id
            setSheetsUploadLog(prev => prev + `  ℹ️ [ІСНУЄ В БД] ${item.name}\n`)
            continue
          }

          const { data: newNom, error: nomErr } = await supabase
            .from('nomenclatures')
            .insert([{ name: item.name, type: 'raw' }])
            .select()
            .single()

          if (nomErr) {
            setSheetsUploadLog(prev => prev + `  ⚠️ [НОМ ПОМИЛКА] ${item.name}: ${nomErr.message}\n`)
            throw new Error(`Не вдалося створити номенклатуру ${item.name}: ${nomErr.message}`)
          }

          setSheetsUploadLog(prev => prev + `  ✅ [НОМ СТВОРЕНО] ${newNom.name} (ID: ${newNom.id})\n`)
          item.nomenclature_id = newNom.id
          nomCache[item.name] = newNom.id

          if (item.name.toLowerCase().includes('підготовлений') && !item.name.toLowerCase().includes('непідготовлений')) {
            const unpreparedName = item.name
              .replace(/\[\s*підготовлений\s*\]/gi, '[Непідготовлений]')
              .replace(/\(\s*підготовлений\s*\)/gi, '(Непідготовлений)')
              .replace(/\bпідготовлений\b/gi, 'Непідготовлений')

            if (unpreparedName && unpreparedName !== item.name) {
              const normUnprepared = normalizeHomoglyphs(unpreparedName)
              const existingUnprepared = (nomenclatures || []).find(n => normalizeHomoglyphs(n.name) === normUnprepared)

              if (!existingUnprepared && !nomCache[unpreparedName]) {
                const { data: newUnprepared, error: unpErr } = await supabase
                  .from('nomenclatures')
                  .insert([{ name: unpreparedName, type: 'raw' }])
                  .select()
                  .single()

                if (unpErr) {
                  setSheetsUploadLog(prev => prev + `  ⚠️ [НОМ НЕПІДГОТОВЛЕНИЙ ПОМИЛКА] ${unpreparedName}: ${unpErr.message}\n`)
                } else {
                  setSheetsUploadLog(prev => prev + `  ✅ [НОМ НЕПІДГОТОВЛЕНИЙ СТВОРЕНО] ${newUnprepared.name} (ID: ${newUnprepared.id})\n`)
                  nomCache[unpreparedName] = newUnprepared.id
                }
              }
            }
          }
        }
      }

      setSheetsUploadLog(prev => prev + `Обробка залишків СО (всього позицій: ${sheetsPreviewList.length})...\n`)
      
      const groupedItems = {}
      sheetsPreviewList.forEach(item => {
        const id = item.nomenclature_id
        if (!id) return
        groupedItems[id] = (groupedItems[id] || 0) + item.qty
      })

      for (const [nomId, qtyVal] of Object.entries(groupedItems)) {
        const nomObj = (nomenclatures || []).find(n => n.id === nomId) || (sheetsPreviewList.find(i => i.nomenclature_id === nomId))
        const nameText = nomObj ? nomObj.name : 'Unknown'
        const unitText = nomObj?.unit || 'шт'
        
        const existing = existingInventory.find(i => 
          i.warehouse === 'operational' && 
          i.nomenclature_id === nomId && 
          i.type === 'raw'
        )

        if (existing) {
          const newTotal = sheetsRecordMode === 'add' ? (Number(existing.total_qty) || 0) + qtyVal : qtyVal
          updates.push({
            id: existing.id,
            nomenclature_id: nomId,
            name: nameText,
            type: 'raw',
            warehouse: 'operational',
            unit: unitText,
            total_qty: newTotal,
            reserved_qty: existing.reserved_qty || 0,
            updated_at: new Date().toISOString()
          })
          setSheetsUploadLog(prev => prev + `[ОНОВИТИ СО] ${nameText}: ${newTotal} шт (було ${existing.total_qty})\n`)
        } else {
          inserts.push({
            nomenclature_id: nomId,
            name: nameText,
            type: 'raw',
            warehouse: 'operational',
            unit: unitText,
            total_qty: qtyVal,
            reserved_qty: 0,
            updated_at: new Date().toISOString()
          })
          setSheetsUploadLog(prev => prev + `[НОВИЙ СО] ${nameText}: ${qtyVal} шт\n`)
        }
      }

      setSheetsUploadLog(prev => prev + `\nНадсилання змін до Supabase...\n`)
      
      const batchOps = []
      if (updates.length > 0) {
        batchOps.push(supabase.from('inventory').upsert(updates, { onConflict: 'id' }))
      }
      if (inserts.length > 0) {
        batchOps.push(supabase.from('inventory').upsert(inserts, { onConflict: 'name,type,warehouse,pocket_owner' }))
      }

      const results = await Promise.all(batchOps)
      for (const res of results) {
        if (res.error) throw res.error
      }

      setSheetsUploadLog(prev => prev + `✅ Успішно оновлено базу даних!\n`)
      setSheetsUploadStatus('success')
      refreshTable('inventory')
      refreshTable('nomenclatures')
    } catch (err) {
      setSheetsUploadLog(prev => prev + `❌ Помилка запису в БД: ${err.message || err}\n`)
      setSheetsUploadStatus('error')
    }
  }

  const handleCuttersFileChange = async (e) => {
    try {
      const file = e.target.files[0]
      if (!file) return
      setCuttersFile(file)

      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const XLSX = await getXLSX()
        const data = await file.arrayBuffer()
        const wb = XLSX.read(data)
        const ws = wb.Sheets[wb.SheetNames[0]]
        const parsed = XLSX.utils.sheet_to_json(ws, { header: 1 })
        const filtered = parsed.filter(row => row && row.length > 0 && row.some(cell => cell !== undefined && cell !== ''))
        if (filtered.length > 0) {
          processCuttersCSV(filtered.map(row => row.map(cell => String(cell ?? ''))))
        } else {
          alert('Помилка: файл порожній або має невірний формат.')
        }
        e.target.value = ''
        return
      }

      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const text = event.target.result
          const delim = detectDelimiter(text)
          const parsed = parseCSV(text, delim)
          if (parsed.length > 0) {
            processCuttersCSV(parsed)
          } else {
            alert('Помилка: файл порожній або має невірний формат.')
          }
        } catch (innerErr) {
          console.error(innerErr)
          alert('Помилка обробки вмісту файлу фрез: ' + innerErr.message)
        }
        e.target.value = ''
      }
      reader.readAsText(file, 'UTF-8')
    } catch (err) {
      console.error(err)
      alert('Помилка завантаження файлу фрез: ' + err.message)
      if (e?.target) e.target.value = ''
    }
  }

  const processCuttersCSV = (parsedCsv) => {
    try {
      const items = computeCuttersList(parsedCsv)
      setCuttersPreviewList(items)
      setCuttersUploadStatus('preview')
    } catch (err) {
      alert(err.message)
    }
  }

  const executeCuttersUpload = async () => {
    setCuttersUploadStatus('uploading')
    setCuttersUploadLog('Початок завантаження залишків фрез на Склад Оперативний (СО)...\n')
    const updates = []
    const inserts = []

    // 1. Group cutters using normalized cutter key (unifying Cyrillic/Latin 'x' and whitespace)
    const aggregatedCutters = {}
    cuttersPreviewList.forEach(item => {
      const trimmedName = (item.name || '').trim()
      const normKey = normalizeCutterKey(trimmedName)
      if (!normKey) return
      if (!aggregatedCutters[normKey]) {
        aggregatedCutters[normKey] = { ...item, name: trimmedName }
      } else {
        aggregatedCutters[normKey].qty += (Number(item.qty) || 0)
      }
    })
    const groupedList = Object.values(aggregatedCutters)

    try {
      // 2. Fetch fresh operational consumable inventory directly from DB to prevent out-of-sync collisions
      setCuttersUploadLog(prev => prev + `Синхронізація актуальних залишків СО з базою даних...\n`)
      let freshOperationalInv = []
      try {
        const { data: dbInv, error: invErr } = await supabase
          .from('inventory')
          .select('id, nomenclature_id, name, type, warehouse, total_qty, reserved_qty, pocket_owner')
          .eq('warehouse', 'operational')
          .is('pocket_owner', null)
        if (!invErr && Array.isArray(dbInv)) {
          freshOperationalInv = dbInv.filter(i => i.type === 'consumable' || String(i.name || '').toLowerCase().includes('фрез'))
        }
      } catch (e) {
        console.warn('Direct inventory fetch warning:', e)
      }

      // Combine fresh DB inventory with in-memory inventory
      const combinedInventory = [...freshOperationalInv]
      ;(inventory || []).forEach(i => {
        if (i.warehouse === 'operational' && (i.type === 'consumable' || String(i.name || '').toLowerCase().includes('фрез')) && !combinedInventory.some(ci => ci.id === i.id)) {
          combinedInventory.push(i)
        }
      })

      // 3. Map existing nomenclatures
      const dbNomMap = {}
      ;(nomenclatures || []).forEach(n => {
        dbNomMap[normalizeCutterKey(n.name)] = n
        dbNomMap[normalizeHomoglyphs(n.name)] = n
        dbNomMap[n.name.trim().toLowerCase()] = n
      })
      setCuttersUploadLog(prev => prev + `Обробка ${groupedList.length} унікальних позицій фрез (Режим: ${cuttersRecordMode === 'add' ? 'Додати до наявного' : 'Перезаписати'})...\n`)

      const seenInventoryKeys = new Set()

      for (const item of groupedList) {
        const normKey = normalizeCutterKey(item.name)
        let nomRecord = dbNomMap[normKey] || dbNomMap[item.name.toLowerCase()]
        if (!nomRecord) {
          const { data: foundNom } = await supabase
            .from('nomenclatures')
            .select('id, name, type')
            .ilike('name', item.name)
            .maybeSingle()

          if (foundNom) {
            nomRecord = foundNom
            dbNomMap[normKey] = foundNom
          } else {
            const { data: newNom, error: nomErr } = await supabase
              .from('nomenclatures')
              .insert([{ name: item.name, type: 'consumable', unit: 'шт' }])
              .select().single()
            if (nomErr) {
              const { data: retryNom } = await supabase
                .from('nomenclatures')
                .select('id, name, type')
                .ilike('name', item.name)
                .maybeSingle()

              if (retryNom) {
                nomRecord = retryNom
                dbNomMap[normKey] = retryNom
              } else {
                setCuttersUploadLog(prev => prev + `  ⚠️ [НОМ ПОМИЛКА] ${item.name}: ${nomErr.message}\n`)
                continue
              }
            } else {
              setCuttersUploadLog(prev => prev + `  ✅ [НОМ СТВОРЕНО] ${newNom.name} (ID: ${newNom.id})\n`)
              nomRecord = newNom
              dbNomMap[normKey] = newNom
            }
          }
        }

        // Match existing inventory by nomenclature_id OR exact name OR cutter key match
        const existingInv = combinedInventory.find(i =>
          i.warehouse === 'operational' &&
          i.pocket_owner == null &&
          (
            (nomRecord?.id && String(i.nomenclature_id) === String(nomRecord.id)) ||
            i.name?.trim().toLowerCase() === item.name.toLowerCase() ||
            normalizeCutterKey(i.name) === normKey
          )
        )

        const standardName = nomRecord?.name || item.name
        const itemKey = `${normalizeCutterKey(standardName)}|consumable|operational|null`
        if (seenInventoryKeys.has(itemKey)) {
          continue
        }
        seenInventoryKeys.add(itemKey)

        if (existingInv) {
          const newTotal = cuttersRecordMode === 'add'
            ? (Number(existingInv.total_qty) || 0) + item.qty
            : item.qty
          updates.push({
            id: existingInv.id,
            nomenclature_id: nomRecord?.id || existingInv.nomenclature_id,
            name: existingInv.name || standardName,
            type: 'consumable',
            warehouse: 'operational',
            pocket_owner: null,
            unit: 'шт',
            total_qty: newTotal,
            reserved_qty: existingInv.reserved_qty || 0,
            updated_at: new Date().toISOString()
          })
          setCuttersUploadLog(prev => prev + `  [ОНОВИТИ СО] ${existingInv.name || standardName}: ${newTotal} шт (було ${existingInv.total_qty || 0}, ${cuttersRecordMode === 'add' ? '+' + item.qty : 'перезапис'}, Ø${item.diameter})\n`)
        } else {
          inserts.push({
            nomenclature_id: nomRecord?.id || null,
            name: standardName,
            type: 'consumable',
            warehouse: 'operational',
            pocket_owner: null,
            unit: 'шт',
            total_qty: item.qty,
            reserved_qty: 0,
            updated_at: new Date().toISOString()
          })
          setCuttersUploadLog(prev => prev + `  [НОВИЙ СО] ${standardName}: ${item.qty} шт (Ø${item.diameter})\n`)
        }
      }

      setCuttersUploadLog(prev => prev + `\nНадсилання змін до бази даних (Оновлення: ${updates.length}, Нові: ${inserts.length})...\n`)
      
      const CHUNK_SIZE = 50
      if (updates.length > 0) {
        for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
          const chunk = updates.slice(i, i + CHUNK_SIZE)
          const { error: updErr } = await supabase.from('inventory').upsert(chunk, { onConflict: 'id' })
          if (updErr) throw updErr
        }
      }

      if (inserts.length > 0) {
        for (let i = 0; i < inserts.length; i += CHUNK_SIZE) {
          const chunk = inserts.slice(i, i + CHUNK_SIZE)
          const { error: insErr } = await supabase.from('inventory').insert(chunk)
          if (insErr) throw insErr
        }
      }

      setCuttersUploadLog(prev => prev + `✅ Успішно оновлено Склад Оперативний (СО)! Оновлено: ${updates.length}, додано нових: ${inserts.length}.\n`)
      setCuttersUploadStatus('success')
      refreshTable('inventory')
      refreshTable('nomenclatures')
    } catch (err) {
      setCuttersUploadLog(prev => prev + `❌ Помилка запису в БД: ${err.message || err}\n`)
      setCuttersUploadStatus('error')
    }
  }

  const handleFastenersFileChange = async (e) => {
    try {
      const file = e.target.files[0]
      if (!file) return
      setFastenersFile(file)
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const text = event.target.result
          const delim = detectDelimiter(text)
          const parsed = parseCSV(text, delim)
          if (parsed.length > 0) {
            processFastenersCSV(parsed)
          } else {
            alert('Помилка: файл порожній або має невірний формат.')
          }
        } catch (innerErr) {
          console.error(innerErr)
          alert('Помилка обробки вмісту файлу метизів: ' + innerErr.message)
        }
        e.target.value = ''
      }
      reader.readAsText(file, 'UTF-8')
    } catch (err) {
      console.error(err)
      alert('Помилка завантаження файлу метизів: ' + err.message)
      if (e?.target) e.target.value = ''
    }
  }

  const processFastenersCSV = (parsedCsv) => {
    try {
      const items = computeFastenersList(parsedCsv)
      setFastenersPreviewList(items)
      setFastenersUploadStatus('preview')
    } catch (err) {
      alert(err.message)
    }
  }

  const executeFastenersUpload = async () => {
    setFastenersUploadStatus('uploading')
    setFastenersUploadLog('Початок завантаження залишків метизів на СВ...\n')
    const updates = []
    const inserts = []

    const aggregatedFasteners = {}
    fastenersPreviewList.forEach(item => {
      const trimmedName = (item.name || '').trim()
      const normKey = normalizeHomoglyphs(trimmedName) || trimmedName.toLowerCase()
      if (!normKey) return
      if (!aggregatedFasteners[normKey]) {
        aggregatedFasteners[normKey] = { ...item, name: trimmedName }
      } else {
        aggregatedFasteners[normKey].qty += (Number(item.qty) || 0)
      }
    })
    const groupedList = Object.values(aggregatedFasteners)

    try {
      setFastenersUploadLog(prev => prev + `Синхронізація актуальних залишків з базою даних...\n`)
      let freshProdInv = []
      try {
        const { data: dbInv, error: invErr } = await supabase
          .from('inventory')
          .select('id, nomenclature_id, name, type, warehouse, total_qty, reserved_qty, pocket_owner')
          .eq('warehouse', 'production')
          .is('pocket_owner', null)
        if (!invErr && Array.isArray(dbInv)) {
          freshProdInv = dbInv
        }
      } catch (e) {
        console.warn('Direct fasteners inventory fetch warning:', e)
      }

      const combinedInventory = [...freshProdInv]
      ;(inventory || []).forEach(i => {
        if (i.warehouse === 'production' && !combinedInventory.some(ci => ci.id === i.id)) {
          combinedInventory.push(i)
        }
      })

      const dbNomMap = {}
      ;(nomenclatures || []).forEach(n => {
        dbNomMap[normalizeHomoglyphs(n.name)] = n
        dbNomMap[n.name.trim().toLowerCase()] = n
      })
      setFastenersUploadLog(prev => prev + `Обробка ${groupedList.length} унікальних позицій метизів...\n`)

      const seenInventoryKeys = new Set()

      for (const item of groupedList) {
        const normName = normalizeHomoglyphs(item.name)
        let nomRecord = dbNomMap[normName] || dbNomMap[item.name.toLowerCase()]
        if (!nomRecord) {
          const { data: foundNom } = await supabase
            .from('nomenclatures')
            .select('id, name, type')
            .ilike('name', item.name)
            .maybeSingle()

          if (foundNom) {
            nomRecord = foundNom
            dbNomMap[normName] = foundNom
          } else {
            const { data: newNom, error: nomErr } = await supabase
              .from('nomenclatures')
              .insert([{ name: item.name, type: 'hardware' }])
              .select().single()
            if (nomErr) {
              const { data: retryNom } = await supabase
                .from('nomenclatures')
                .select('id, name, type')
                .ilike('name', item.name)
                .maybeSingle()

              if (retryNom) {
                nomRecord = retryNom
                dbNomMap[normName] = retryNom
              } else {
                setFastenersUploadLog(prev => prev + `  ⚠️ [НОМ ПОМИЛКА] ${item.name}: ${nomErr.message}\n`)
                continue
              }
            } else {
              setFastenersUploadLog(prev => prev + `  ✅ [НОМ СТВОРЕНО] ${newNom.name} (ID: ${newNom.id})\n`)
              nomRecord = newNom
              dbNomMap[normName] = newNom
            }
          }
        }

        const existingInv = combinedInventory.find(i =>
          i.warehouse === 'production' &&
          i.pocket_owner == null &&
          (
            (nomRecord?.id && String(i.nomenclature_id) === String(nomRecord.id)) ||
            i.name?.trim().toLowerCase() === item.name.toLowerCase() ||
            normalizeHomoglyphs(i.name) === normName
          )
        )

        const standardName = nomRecord?.name || item.name
        const itemType = existingInv?.type || nomRecord?.type || 'hardware'
        const itemKey = `${standardName.trim().toLowerCase()}|${itemType}|production|null`
        if (seenInventoryKeys.has(itemKey)) {
          continue
        }
        seenInventoryKeys.add(itemKey)

        if (existingInv) {
          const newTotal = fastenersRecordMode === 'add'
            ? (Number(existingInv.total_qty) || 0) + item.qty
            : item.qty
          updates.push({
            id: existingInv.id,
            nomenclature_id: nomRecord?.id || existingInv.nomenclature_id,
            name: existingInv.name || standardName,
            type: existingInv.type || itemType,
            warehouse: 'production',
            pocket_owner: null,
            unit: existingInv.unit || 'шт',
            total_qty: newTotal,
            reserved_qty: existingInv.reserved_qty || 0,
            updated_at: new Date().toISOString()
          })
          setFastenersUploadLog(prev => prev + `[ОНОВИТИ СВ] ${existingInv.name || standardName}: ${newTotal} шт\n`)
        } else {
          inserts.push({
            nomenclature_id: nomRecord?.id || null,
            name: standardName,
            type: itemType,
            warehouse: 'production',
            pocket_owner: null,
            unit: 'шт',
            total_qty: item.qty,
            reserved_qty: 0,
            updated_at: new Date().toISOString()
          })
          setFastenersUploadLog(prev => prev + `[НОВИЙ СВ] ${standardName}: ${item.qty} шт\n`)
        }
      }

      setFastenersUploadLog(prev => prev + `\nНадсилання змін до Supabase...\n`)
      const batchOps = []
      if (updates.length > 0) {
        batchOps.push(supabase.from('inventory').upsert(updates, { onConflict: 'id' }))
      }
      if (inserts.length > 0) {
        batchOps.push(supabase.from('inventory').upsert(inserts, { onConflict: 'name,type,warehouse,pocket_owner' }))
      }
      const results = await Promise.all(batchOps)
      for (const res of results) { if (res.error) throw res.error }
      setFastenersUploadLog(prev => prev + `✅ Успішно оновлено базу даних!\n`)
      setFastenersUploadStatus('success')
      refreshTable('inventory')
      refreshTable('nomenclatures')
    } catch (err) {
      setFastenersUploadLog(prev => prev + `❌ Помилка запису в БД: ${err.message || err}\n`)
      setFastenersUploadStatus('error')
    }
  }

  const downloadTemplateExcel = async () => {
    const XLSX = await getXLSX()
    const headers = ['login', 'password', 'first_name', 'last_name', 'department', 'position', 'shift']
    const row = ['ivan_operator', 'pass123', 'Іван', 'Петренко', 'Цех №1', 'Оператор', 'Зміна 1']
    const ws = XLSX.utils.aoa_to_sheet([headers, row])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template')
    XLSX.writeFile(wb, 'employees_template.xlsx')
  }

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    setCsvFile(file)
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      const XLSX = await getXLSX()
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const parsed = XLSX.utils.sheet_to_json(ws, { header: 1 })
      
      const filtered = parsed.filter(row => row.length > 0 && row.some(cell => cell !== undefined && cell !== ''))
      if (filtered.length > 0) {
        const headers = filtered[0].map(h => String(h || ''))
        const rows = filtered.slice(1).map(row => row.map(cell => String(cell || '')))
        
        setCsvHeaders(headers)
        setCsvRows(rows)
        const initialMapping = autoDetectMapping(headers)
        setColumnMapping(initialMapping)
        setImportStatus('preview')
      } else {
        alert('Помилка: файл порожній або має невірний формат.')
      }
    } else {
      const reader = new FileReader()
      reader.onload = (event) => {
        const text = event.target.result
        const delim = detectDelimiter(text)
        setCsvDelimiter(delim)
        
        const parsed = parseCSV(text, delim)
        if (parsed.length > 0) {
          const headers = parsed[0]
          const rows = parsed.slice(1)
          
          setCsvHeaders(headers)
          setCsvRows(rows)
          
          const initialMapping = autoDetectMapping(headers)
          setColumnMapping(initialMapping)
          
          setImportStatus('preview')
        } else {
          alert('Помилка: файл порожній або має невірний формат.')
        }
      }
      reader.readAsText(file, 'UTF-8')
    }
  }

  const handleDelimiterChange = (newDelim) => {
    setCsvDelimiter(newDelim)
    if (csvFile) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const text = event.target.result
        const parsed = parseCSV(text, newDelim)
        if (parsed.length > 0) {
          const headers = parsed[0]
          const rows = parsed.slice(1)
          setCsvHeaders(headers)
          setCsvRows(rows)
          const initialMapping = autoDetectMapping(headers)
          setColumnMapping(initialMapping)
        }
      }
      reader.readAsText(csvFile, 'UTF-8')
    }
  }

  const previewData = useMemo(() => {
    if (importStatus !== 'preview') return []
    return computeUserPreviewData({
      csvRows,
      columnMapping,
      defaultValues,
      duplicatePolicy,
      systemUsers,
      companyStructure,
      companyPositions
    })
  }, [csvRows, columnMapping, defaultValues, duplicatePolicy, systemUsers, companyStructure, companyPositions, importStatus])

  const executeImport = async () => {
    const rowsToProcess = previewData.filter(r => r.status === 'insert' || r.status === 'update')
    if (rowsToProcess.length === 0) {
      alert('Немає записів для імпорту.')
      return
    }
    
    setImportStatus('importing')
    setImportLog('Початок імпорту...\n')
    
    const payloads = rowsToProcess.map(row => {
      const payload = {
        login: row.login,
        password: row.password,
        first_name: row.first_name,
        last_name: row.last_name,
        department: row.department,
        position: row.position,
        shift: row.shift,
      }
      
      if (row.status === 'update') {
        const existing = (systemUsers || []).find(u => u.login.toLowerCase() === row.login)
        payload.id = existing.id
        payload.access_rights = existing.access_rights || defaultValues.access_rights
      } else {
        payload.access_rights = defaultValues.access_rights
      }
      
      return payload
    })
    
    try {
      setImportLog(prev => prev + `Надсилання ${payloads.length} записів до Supabase...\n`)
      const { data: resultData, error } = await supabase.from('system_users').upsert(payloads).select()
      
      if (error) throw error
      
      setImportLog(prev => prev + `Успішно імпортовано/оновлено ${resultData?.length || payloads.length} користувачів.\n`)
      setImportStatus('success')
    } catch (err) {
      setImportLog(prev => prev + `Помилка запису в БД: ${err.message || err}\n`)
      setImportStatus('error')
    }
  }

  const toggleDefaultRight = (key) => {
    setDefaultValues(prev => ({
      ...prev,
      access_rights: {
        ...prev.access_rights,
        [key]: !prev.access_rights[key]
      }
    }))
  }

  return {
    bzFile, setBzFile, bzDelimiter, setBzDelimiter, bzRecordMode, setBzRecordMode,
    bzUploadStatus, setBzUploadStatus, bzUploadLog, setBzUploadLog, bzActivePreviewTab, setBzActivePreviewTab,
    bzAssembledKits, setBzAssembledKits, bzLeftovers, setBzLeftovers, bzUnrecognized, setBzUnrecognized,
    sheetsFile, setSheetsFile, sheetsDelimiter, setSheetsDelimiter, sheetsRecordMode, setSheetsRecordMode,
    sheetsUploadStatus, setSheetsUploadStatus, sheetsUploadLog, setSheetsUploadLog, sheetsActivePreviewTab, setSheetsActivePreviewTab,
    sheetsPreviewList, setSheetsPreviewList,
    cuttersFile, setCuttersFile, cuttersRecordMode, setCuttersRecordMode, cuttersUploadStatus, setCuttersUploadStatus,
    cuttersUploadLog, setCuttersUploadLog, cuttersPreviewList, setCuttersPreviewList,
    fastenersFile, setFastenersFile, fastenersRecordMode, setFastenersRecordMode, fastenersUploadStatus, setFastenersUploadStatus,
    fastenersUploadLog, setFastenersUploadLog, fastenersPreviewList, setFastenersPreviewList,
    isImportModalOpen, setIsImportModalOpen, csvFile, setCsvFile, csvDelimiter, setCsvDelimiter,
    csvHeaders, setCsvHeaders, csvRows, setCsvRows, columnMapping, setColumnMapping,
    defaultValues, setDefaultValues, duplicatePolicy, setDuplicatePolicy,
    importStatus, setImportStatus, importLog, setImportLog,
    handleBzFileChange, normalizeHomoglyphs, processBzRemnants, executeBzUpload,
    handleSheetsFileChange, processSheetsRemnants, executeSheetsUpload,
    parseDiameterFromName, handleCuttersFileChange, processCuttersCSV, executeCuttersUpload,
    handleFastenersFileChange, processFastenersCSV, executeFastenersUpload,
    parseCSV, detectDelimiter, autoDetectMapping, matchDepartment, matchPosition, downloadTemplateExcel,
    handleFileChange, handleDelimiterChange, previewData, executeImport, toggleDefaultRight
  }
}
