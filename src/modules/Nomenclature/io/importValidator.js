export const validateImportRows = (parsedRows = [], existingItems = [], availableGroups = []) => {
  const groupMap = new Map()
  const groupNameMap = new Map()
  
  ;(availableGroups || []).forEach(g => {
    groupMap.set(String(g.id).toLowerCase(), g.id)
    if (g.name) groupNameMap.set(String(g.name).trim().toLowerCase(), g.id)
    if (g.code) groupNameMap.set(String(g.code).trim().toLowerCase(), g.id)
  })

  const defaultGroupId = availableGroups[0]?.id || 'cat_fg'

  const existingCodeMap = new Map()
  const existingNameMap = new Map()

  ;(existingItems || []).forEach(it => {
    if (it.code) existingCodeMap.set(String(it.code).trim().toUpperCase(), it)
    if (it.name) existingNameMap.set(String(it.name).trim().toLowerCase().replace(/\s+/g, ''), it)
  })

  const validRows = []
  const invalidRows = []
  const warningRows = []
  const duplicateRows = []

  const seenInFileCodes = new Set()
  const seenInFileNames = new Set()

  parsedRows.forEach(row => {
    const errors = []
    const warnings = []

    // Critical Check: Name is mandatory
    if (!row.name || !row.name.trim()) {
      errors.push('Відсутня назва позиції (обовязкове поле)')
    }

    // Resolve group_id
    let resolvedGroupId = null
    if (row.group_id) {
      const gLower = String(row.group_id).trim().toLowerCase()
      resolvedGroupId = groupMap.get(gLower) || groupNameMap.get(gLower) || null
    }

    if (!resolvedGroupId) {
      resolvedGroupId = defaultGroupId
      if (row.group_id) {
        warnings.push(`Категорію «${row.group_id}» не знайдено в системі. Призначено дефолтну категорію.`)
      }
    }

    // Duplicate check within file
    const normName = row.name ? String(row.name).trim().toLowerCase().replace(/\s+/g, '') : ''
    const normCode = row.code ? String(row.code).trim().toUpperCase() : ''

    if (normCode && seenInFileCodes.has(normCode)) {
      warnings.push(`Код «${row.code}» дублюється в цьому ж файлі.`)
    }
    if (normName && seenInFileNames.has(normName)) {
      warnings.push(`Назва «${row.name}» дублюється в цьому ж файлі.`)
    }

    if (normCode) seenInFileCodes.add(normCode)
    if (normName) seenInFileNames.add(normName)

    // DB Collision Check
    const dbCodeMatch = normCode ? existingCodeMap.get(normCode) : null
    const dbNameMatch = normName ? existingNameMap.get(normName) : null
    const isDbDuplicate = !!(dbCodeMatch || dbNameMatch)

    const validatedRow = {
      ...row,
      resolved_group_id: resolvedGroupId,
      errors,
      warnings,
      isDbDuplicate,
      existingMatch: dbCodeMatch || dbNameMatch || null
    }

    if (errors.length > 0) {
      invalidRows.push(validatedRow)
    } else {
      validRows.push(validatedRow)
      if (isDbDuplicate) duplicateRows.push(validatedRow)
      if (warnings.length > 0) warningRows.push(validatedRow)
    }
  })

  return {
    validRows,
    invalidRows,
    warningRows,
    duplicateRows,
    totalCount: parsedRows.length,
    validCount: validRows.length,
    invalidCount: invalidRows.length,
    duplicateCount: duplicateRows.length
  }
}
