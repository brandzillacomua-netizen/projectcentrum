const getXLSX = async () => {
  try {
    const xlsxMod = await import('xlsx')
    return xlsxMod.default || xlsxMod
  } catch (e) {
    console.warn('[NomenclatureIO] xlsx module load failed:', e)
    return null
  }
}

const HEADER_ALIASES = {
  code: ['код v2', 'код v2.0', 'код', 'артикул', 'code', 'v2_code', 'catalog_code'],
  name: ['стандартизована назва', 'назва', 'название', 'назва позиції', 'name', 'display_name', 'item_name'],
  group_id: ['id категорії', 'група', 'категорія (група)', 'категорія', 'group_id', 'category_id', 'group', 'category'],
  unit: ['одиниця виміру', 'од. вим.', 'од.вим.', 'одиниця', 'unit', 'uom', 'base_unit'],
  rule_type: ['правило (rule type)', 'правило', 'тип правила', 'rule_type', 'type'],
  status: ['статус', 'status', 'state'],
  rule_params: ['параметри правила (json)', 'параметри (json)', 'параметри', 'rule_params', 'params']
}

export const autoMapHeader = (headerName) => {
  if (!headerName) return null
  const clean = String(headerName).trim().toLowerCase()

  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.some(alias => clean === alias || clean.includes(alias))) {
      return key
    }
  }
  return null
}

export const parseImportFile = async (file) => {
  if (!file) throw new Error('Файл не надано')

  const fileName = file.name.toLowerCase()
  const XLSX = await getXLSX()

  let rawObjects = []

  if ((fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) && XLSX) {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]
    rawObjects = XLSX.utils.sheet_to_json(worksheet, { defval: '' })
  } else {
    // Parse CSV
    const text = await file.text()
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0)
    if (lines.length === 0) throw new Error('Порожній файл CSV')

    const delimiter = lines[0].includes(';') ? ';' : ','
    const headers = lines[0].split(delimiter).map(h => h.replace(/^["']|["']$/g, '').trim())

    rawObjects = lines.slice(1).map(line => {
      const values = line.split(delimiter).map(v => v.replace(/^["']|["']$/g, '').trim())
      const obj = {}
      headers.forEach((h, i) => {
        obj[h] = values[i] !== undefined ? values[i] : ''
      })
      return obj
    })
  }

  if (!rawObjects || rawObjects.length === 0) {
    throw new Error('У файлі не знайдено даних для імпорту')
  }

  // Detect Headers and map to standardized fields
  const sampleHeaderKeys = Object.keys(rawObjects[0] || {})
  const detectedMapping = {}
  
  sampleHeaderKeys.forEach(originalHeader => {
    const mappedField = autoMapHeader(originalHeader)
    if (mappedField && !detectedMapping[mappedField]) {
      detectedMapping[mappedField] = originalHeader
    }
  })

  // Standardize objects
  const parsedRows = rawObjects.map((row, index) => {
    const code = String(row[detectedMapping.code] || '').trim()
    const name = String(row[detectedMapping.name] || '').trim()
    const groupVal = String(row[detectedMapping.group_id] || '').trim()
    const unit = String(row[detectedMapping.unit] || 'шт').trim()
    const rule_type = String(row[detectedMapping.rule_type] || 'generic').trim()
    const statusVal = String(row[detectedMapping.status] || 'active').trim()
    
    let rule_params = null
    const rawParams = row[detectedMapping.rule_params]
    if (rawParams) {
      if (typeof rawParams === 'object') {
        rule_params = rawParams
      } else {
        try {
          rule_params = JSON.parse(String(rawParams))
        } catch (e) {
          rule_params = null
        }
      }
    }

    return {
      rowIndex: index + 2, // 1-indexed, line 1 is header
      code,
      name,
      group_id: groupVal,
      unit: unit || 'шт',
      rule_type: rule_type || 'generic',
      status: statusVal.toLowerCase().includes('актив') ? 'active' : (statusVal || 'active'),
      rule_params,
      rawRow: row
    }
  })

  return {
    parsedRows,
    detectedMapping,
    totalRowsCount: parsedRows.length
  }
}
