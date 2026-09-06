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
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = text[i + 1]
    
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
  const firstLine = text.split(/\r?\n/)[0] || text
  const commaCount = (firstLine.match(/,/g) || []).length
  const semicolonCount = (firstLine.match(/;/g) || []).length
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

export const computeBzRemnants = (parsedCsv, nomenclatures) => {
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
  const matchedItems = []
  const unrecognized = []

  const dbNomMap = {}
  ;(nomenclatures || []).forEach(n => {
    dbNomMap[normalizeHomoglyphs(n.name)] = n
  })

  parsedRows.forEach((row, idx) => {
    const nameVal = row[nameColIdx]
    const qtyVal = parseInt(row[qtyColIdx]) || 0

    if (!nameVal || qtyVal <= 0) return

    const normName = normalizeHomoglyphs(nameVal)
    const matchedNom = dbNomMap[normName]

    if (matchedNom) {
      matchedItems.push({
        name: matchedNom.name,
        qty: qtyVal,
        nomenclature_id: matchedNom.id,
        type: matchedNom.type
      })
    } else {
      unrecognized.push({
        name: nameVal,
        qty: qtyVal,
        rowNum: idx + 2
      })
    }
  })

  const initialStock = {}
  matchedItems.forEach(item => {
    initialStock[item.nomenclature_id] = (initialStock[item.nomenclature_id] || 0) + item.qty
  })

  const assembledKits = []
  const componentsLeft = { ...initialStock }

  const leftovers = []
  Object.entries(componentsLeft).forEach(([nomId, qty]) => {
    if (qty <= 0) return
    const nomObj = (nomenclatures || []).find(n => n.id === nomId)
    if (nomObj) {
      leftovers.push({
        nomenclature_id: nomId,
        name: nomObj.name,
        qty,
        type: nomObj.type
      })
    }
  })

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

export const computeCuttersList = (parsedCsv) => {
  const headers = parsedCsv[0] || []
  const nameColIdx = headers.findIndex(h => {
    const n = (h || '').toLowerCase().trim()
    return n.includes('номенклатура') || n.includes('назва') || n === 'name'
  })
  const diamColIdx = headers.findIndex(h => {
    const n = (h || '').toLowerCase().trim()
    return n.includes('діаметр') || n.includes('diameter')
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
    if (!name || !name.toLowerCase().startsWith('фреза')) return
    const rawDiam = diamColIdx !== -1 ? (row[diamColIdx] || '').replace(',', '.').trim() : ''
    const diameter = parseFloat(rawDiam) || parseDiameterFromName(name) || 0
    const rawQty = qtyColIdx !== -1 ? (row[qtyColIdx] || '').trim() : ''
    const qty = parseInt(rawQty) || 0
    if (qty <= 0) return
    items.push({ name, diameter, qty, rowNum: idx + 2 })
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
    const rawQty = qtyColIdx !== -1 ? (row[qtyColIdx] || '').trim() : ''
    const qty = parseInt(rawQty) || 0
    if (qty <= 0) return
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
  supabase,
  companyStructure,
  companyPositions,
  systemUsers
}) {
  // BZ remnants upload states
  const [bzFile, setBzFile] = useState(null)
  const [bzDelimiter, setBzDelimiter] = useState(';')
  const [bzRecordMode, setBzRecordMode] = useState('add')
  const [bzUploadStatus, setBzUploadStatus] = useState('idle')
  const [bzUploadLog, setBzUploadLog] = useState('')
  const [bzActivePreviewTab, setBzActivePreviewTab] = useState('leftovers')
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
          alert('Помилка обробки вмісту файлу залишків БЗ: ' + innerErr.message)
        }
        e.target.value = ''
      }
      reader.readAsText(file, 'UTF-8')
    } catch (err) {
      console.error(err)
      alert('Помилка завантаження файлу залишків БЗ: ' + err.message)
      if (e?.target) e.target.value = ''
    }
  }

  const processBzRemnants = (parsedCsv) => {
    try {
      const { assembledKits, leftovers, unrecognized } = computeBzRemnants(parsedCsv, nomenclatures)
      setBzAssembledKits(assembledKits)
      setBzLeftovers(leftovers)
      setBzUnrecognized(unrecognized)
      setBzUploadStatus('preview')
    } catch (err) {
      alert(err.message)
    }
  }

  const executeBzUpload = async () => {
    setBzUploadStatus('uploading')
    setBzUploadLog('Початок обробки залишків...\n')
    
    const existingInventory = inventory || []
    const updates = []
    const inserts = []
    const findOperationalInventory = (nomenclatureId, name, type) =>
      existingInventory.find(i =>
        i.warehouse === 'operational'
        && i.type === type
        && i.pocket_owner == null
        && (
          String(i.nomenclature_id) === String(nomenclatureId)
          || i.name === name
        )
      )

    try {
      setBzUploadLog(prev => prev + `Обробка зібраних комплектів (всього позицій: ${bzAssembledKits.length})...\n`)
      for (const kit of bzAssembledKits) {
        const product = kit.product
        const qtyToSet = kit.qty

        const existing = findOperationalInventory(product.id, product.name, 'finished')

        if (existing) {
          const newTotal = bzRecordMode === 'add' ? (Number(existing.total_qty) || 0) + qtyToSet : qtyToSet
          updates.push({
            id: existing.id,
            nomenclature_id: product.id,
            name: product.name,
            type: 'finished',
            warehouse: 'operational',
            unit: product.unit || 'шт',
            total_qty: newTotal,
            reserved_qty: existing.reserved_qty || 0,
            updated_at: new Date().toISOString()
          })
          setBzUploadLog(prev => prev + `[ОНОВИТИ СГП] ${product.name}: ${newTotal} шт (було ${existing.total_qty})\n`)
        } else {
          inserts.push({
            nomenclature_id: product.id,
            name: product.name,
            type: 'finished',
            warehouse: 'operational',
            unit: product.unit || 'шт',
            total_qty: qtyToSet,
            reserved_qty: 0,
            updated_at: new Date().toISOString()
          })
          setBzUploadLog(prev => prev + `[НОВИЙ СГП] ${product.name}: ${qtyToSet} шт\n`)
        }
      }

      setBzUploadLog(prev => prev + `Обробка залишків напівфабрикатів (всього позицій: ${bzLeftovers.length})...\n`)
      for (const left of bzLeftovers) {
        const existing = findOperationalInventory(left.nomenclature_id, left.name, 'bz')

        if (existing) {
          const newTotal = bzRecordMode === 'add' ? (Number(existing.total_qty) || 0) + left.qty : left.qty
          updates.push({
            id: existing.id,
            nomenclature_id: left.nomenclature_id,
            name: left.name,
            type: 'bz',
            warehouse: 'operational',
            unit: 'шт',
            total_qty: newTotal,
            reserved_qty: existing.reserved_qty || 0,
            updated_at: new Date().toISOString()
          })
          setBzUploadLog(prev => prev + `[ОНОВИТИ БЗ] ${left.name}: ${newTotal} шт (було ${existing.total_qty})\n`)
        } else {
          inserts.push({
            nomenclature_id: left.nomenclature_id,
            name: left.name,
            type: 'bz',
            warehouse: 'operational',
            unit: 'шт',
            total_qty: left.qty,
            reserved_qty: 0,
            updated_at: new Date().toISOString()
          })
          setBzUploadLog(prev => prev + `[НОВИЙ БЗ] ${left.name}: ${left.qty} шт\n`)
        }
      }

      if (bzUnrecognized.length > 0) {
        setBzUploadLog(prev => prev + `\nСтворення нових позицій в номенклатурі (${bzUnrecognized.length} шт)...\n`)
        for (const unr of bzUnrecognized) {
          if (!unr.qty || unr.qty <= 0) continue

          const { data: newNom, error: nomErr } = await supabase
            .from('nomenclatures')
            .insert([{ name: unr.name, type: 'part' }])
            .select()
            .single()

          if (nomErr) {
            setBzUploadLog(prev => prev + `  ⚠️ [НОМ ПОМИЛКА] ${unr.name}: ${nomErr.message}\n`)
            continue
          }

          setBzUploadLog(prev => prev + `  ✅ [НОМ СТВОРЕНО] ${newNom.name} (ID: ${newNom.id})\n`)

          const existingInv = findOperationalInventory(newNom.id, newNom.name, 'bz')

          if (existingInv) {
            const newTotal = bzRecordMode === 'add' ? (Number(existingInv.total_qty) || 0) + unr.qty : unr.qty
            updates.push({
              id: existingInv.id,
              nomenclature_id: newNom.id,
              name: newNom.name,
              type: 'bz',
              warehouse: 'operational',
              unit: 'шт',
              total_qty: newTotal,
              reserved_qty: existingInv.reserved_qty || 0,
              updated_at: new Date().toISOString()
            })
            setBzUploadLog(prev => prev + `  [ОНОВИТИ БЗ] ${newNom.name}: ${newTotal} шт\n`)
          } else {
            inserts.push({
              nomenclature_id: newNom.id,
              name: newNom.name,
              type: 'bz',
              warehouse: 'operational',
              unit: 'шт',
              total_qty: unr.qty,
              reserved_qty: 0,
              updated_at: new Date().toISOString()
            })
            setBzUploadLog(prev => prev + `  [НОВИЙ БЗ] ${newNom.name}: ${unr.qty} шт\n`)
          }
        }
      }

      setBzUploadLog(prev => prev + `\nНадсилання змін до Supabase...\n`)
      
      const batchOps = []
      if (updates.length > 0) {
        batchOps.push(supabase.from('inventory').upsert(updates))
      }
      if (inserts.length > 0) {
        batchOps.push(supabase.from('inventory').insert(inserts))
      }

      const results = await Promise.all(batchOps)
      for (const res of results) {
        if (res.error) throw res.error
      }

      setBzUploadLog(prev => prev + `✅ Успішно оновлено базу даних!\n`)
      setBzUploadStatus('success')
      refreshTable('inventory')
      refreshTable('nomenclatures')
    } catch (err) {
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
        batchOps.push(supabase.from('inventory').upsert(updates))
      }
      if (inserts.length > 0) {
        batchOps.push(supabase.from('inventory').insert(inserts))
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
    setCuttersUploadLog('Початок завантаження залишків фрез...\n')
    const existingInventory = inventory || []
    const updates = []
    const inserts = []
    
    const aggregatedCutters = {}
    cuttersPreviewList.forEach(item => {
      const key = item.name
      if (!aggregatedCutters[key]) {
        aggregatedCutters[key] = { ...item }
      } else {
        aggregatedCutters[key].qty += item.qty
      }
    })
    const groupedList = Object.values(aggregatedCutters)

    try {
      const dbNomMap = {}
      ;(nomenclatures || []).forEach(n => { dbNomMap[normalizeHomoglyphs(n.name)] = n })
      setCuttersUploadLog(prev => prev + `Обробка ${groupedList.length} унікальних позицій фрез...\n`)
      
      for (const item of groupedList) {
        const normName = normalizeHomoglyphs(item.name)
        let nomRecord = dbNomMap[normName]
        if (!nomRecord) {
          const { data: newNom, error: nomErr } = await supabase
            .from('nomenclatures')
            .insert([{ name: item.name, type: 'consumable' }])
            .select().single()
          if (nomErr) {
            setCuttersUploadLog(prev => prev + `  ⚠️ [НОМ ПОМИЛКА] ${item.name}: ${nomErr.message}\n`)
            continue
          }
          setCuttersUploadLog(prev => prev + `  ✅ [НОМ СТВОРЕНО] ${newNom.name} (ID: ${newNom.id})\n`)
          nomRecord = newNom
          dbNomMap[normName] = newNom
        }
        
        const existingInv = existingInventory.find(i =>
          i.warehouse === 'operational' &&
          String(i.nomenclature_id) === String(nomRecord.id) &&
          i.type === 'consumable'
        )
        
        if (existingInv) {
          const newTotal = cuttersRecordMode === 'add'
            ? (Number(existingInv.total_qty) || 0) + item.qty
            : item.qty
          updates.push({
            id: existingInv.id,
            nomenclature_id: nomRecord.id,
            name: item.name,
            type: 'consumable',
            warehouse: 'operational',
            unit: 'шт',
            total_qty: newTotal,
            reserved_qty: existingInv.reserved_qty || 0,
            updated_at: new Date().toISOString()
          })
          setCuttersUploadLog(prev => prev + `[ОНОВИТИ СО] ${item.name}: ${newTotal} шт (Ø${item.diameter})\n`)
        } else {
          inserts.push({
            nomenclature_id: nomRecord.id,
            name: item.name,
            type: 'consumable',
            warehouse: 'operational',
            unit: 'шт',
            total_qty: item.qty,
            reserved_qty: 0,
            updated_at: new Date().toISOString()
          })
          setCuttersUploadLog(prev => prev + `[НОВИЙ СО] ${item.name}: ${item.qty} шт (Ø${item.diameter})\n`)
        }
      }
      
      setCuttersUploadLog(prev => prev + `\nНадсилання змін до Supabase...\n`)
      const batchOps = []
      if (updates.length > 0) batchOps.push(supabase.from('inventory').upsert(updates))
      if (inserts.length > 0) batchOps.push(supabase.from('inventory').insert(inserts))
      const results = await Promise.all(batchOps)
      for (const res of results) { if (res.error) throw res.error }
      setCuttersUploadLog(prev => prev + `✅ Успішно оновлено базу даних!\n`)
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
    const existingInventory = inventory || []
    const updates = []
    const inserts = []

    const aggregatedFasteners = {}
    fastenersPreviewList.forEach(item => {
      const key = item.name
      if (!aggregatedFasteners[key]) {
        aggregatedFasteners[key] = { ...item }
      } else {
        aggregatedFasteners[key].qty += item.qty
      }
    })
    const groupedList = Object.values(aggregatedFasteners)

    try {
      const dbNomMap = {}
      ;(nomenclatures || []).forEach(n => { dbNomMap[normalizeHomoglyphs(n.name)] = n })
      setFastenersUploadLog(prev => prev + `Обробка ${groupedList.length} унікальних позицій метизів...\n`)

      for (const item of groupedList) {
        const normName = normalizeHomoglyphs(item.name)
        let nomRecord = dbNomMap[normName]
        if (!nomRecord) {
          const { data: newNom, error: nomErr } = await supabase
            .from('nomenclatures')
            .insert([{ name: item.name, type: 'hardware' }])
            .select().single()
          if (nomErr) {
            setFastenersUploadLog(prev => prev + `  ⚠️ [НОМ ПОМИЛКА] ${item.name}: ${nomErr.message}\n`)
            continue
          }
          setFastenersUploadLog(prev => prev + `  ✅ [НОМ СТВОРЕНО] ${newNom.name} (ID: ${newNom.id})\n`)
          nomRecord = newNom
          dbNomMap[normName] = newNom
        }

        const existingInv = existingInventory.find(i =>
          i.warehouse === 'production' &&
          String(i.nomenclature_id) === String(nomRecord.id)
        )

        if (existingInv) {
          const newTotal = fastenersRecordMode === 'add'
            ? (Number(existingInv.total_qty) || 0) + item.qty
            : item.qty
          updates.push({
            id: existingInv.id,
            nomenclature_id: nomRecord.id,
            name: item.name,
            type: existingInv.type || 'hardware',
            warehouse: 'production',
            unit: existingInv.unit || 'шт',
            total_qty: newTotal,
            reserved_qty: existingInv.reserved_qty || 0,
            updated_at: new Date().toISOString()
          })
          setFastenersUploadLog(prev => prev + `[ОНОВИТИ СВ] ${item.name}: ${newTotal} шт\n`)
        } else {
          inserts.push({
            nomenclature_id: nomRecord.id,
            name: item.name,
            type: 'hardware',
            warehouse: 'production',
            unit: 'шт',
            total_qty: item.qty,
            reserved_qty: 0,
            updated_at: new Date().toISOString()
          })
          setFastenersUploadLog(prev => prev + `[НОВИЙ СВ] ${item.name}: ${item.qty} шт\n`)
        }
      }

      setFastenersUploadLog(prev => prev + `\nНадсилання змін до Supabase...\n`)
      const batchOps = []
      if (updates.length > 0) batchOps.push(supabase.from('inventory').upsert(updates))
      if (inserts.length > 0) batchOps.push(supabase.from('inventory').insert(inserts))
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
