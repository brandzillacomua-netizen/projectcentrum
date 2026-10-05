import { isHardware, normalizeKey } from '../warehouseFgpInventory.js'

const getXLSX = async () => {
  try {
    const xlsxMod = await import('xlsx')
    return xlsxMod.default || xlsxMod
  } catch (e) {
    console.warn('[SgpExport] xlsx module load failed:', e)
    return null
  }
}

export const exportSgpStockToExcel = async ({
  inventory = [],
  nomenclatures = [],
  shop2BufferCards = [],
  shop2BufferConsolidatedItems = [],
  activeTab = 'finished',
  searchQuery = ''
}) => {
  const XLSX = await getXLSX()
  const fileDateStr = new Date().toISOString().split('T')[0]
  const filename = `sgp_zalyashky_${fileDateStr}.xlsx`

  // Map nomenclature ID & code
  const nomMap = new Map()
  const nomNameToId = new Map()
  ;(nomenclatures || []).forEach(n => {
    nomMap.set(String(n.id), n)
    if (Array.isArray(n.legacy_ids)) {
      n.legacy_ids.forEach(lid => nomMap.set(String(lid), n))
    }
    const norm = normalizeKey(n.name)
    if (norm && !nomNameToId.has(norm)) nomNameToId.set(norm, String(n.id))
  })

  const getNomCode = (item) => {
    if (item.nomenclature_id) {
      const n = nomMap.get(String(item.nomenclature_id))
      if (n?.code) return n.code
    }
    const cleanName = (item.name || '').trim()
    const norm = normalizeKey(cleanName)
    const nomId = nomNameToId.get(norm)
    if (nomId) {
      const n = nomMap.get(nomId)
      if (n?.code) return n.code
    }
    return '—'
  }

  const getItemCategory = (item) => {
    const nameLower = (item.name || '').toLowerCase()
    if (isHardware(item)) {
      if (nameLower.includes('гвинт') || nameLower.includes('болт')) return 'Метизи — Гвинти'
      if (nameLower.includes('гайка')) return 'Метизи — Гайки'
      if (nameLower.includes('стійка') || nameLower.includes('втулка') || nameLower.includes('шайба')) return 'Метизи — Стійки та втулки'
      return 'Метизи та Комплектуючі'
    }
    if (nameLower.includes('3д') || nameLower.includes('3d') || nameLower.includes('друк') || nameLower.includes('лиття')) {
      return '3D Друк & Пластик'
    }
    if (nameLower.includes('комплект') || nameLower.includes('рама') || nameLower.includes('біта') || nameLower.includes('іп-') || nameLower.includes('ip-') || nameLower.includes('кр-')) {
      return 'Готова продукція / Комплекти'
    }
    if (nameLower.includes('деталь') || nameLower.includes('луч') || nameLower.includes('пластина') || nameLower.includes('панель') || nameLower.includes('опора') || nameLower.includes('кронштейн') || nameLower.includes('демфер')) {
      return 'Деталі рам'
    }
    return 'Готова продукція та Деталі'
  }

  const isRawSheet = (item) => {
    const nameLower = String(item?.name || '').toLowerCase().trim()
    return (nameLower.startsWith('лист') || nameLower.includes('карбонова пластина')) && !nameLower.includes('накладка')
  }

  const isSgpItem = (item) => {
    if (!item || !item.name) return false
    if (isRawSheet(item)) return false

    const type = item.type || ''
    const nameLower = String(item.name || '').toLowerCase()

    if (item.warehouse === 'sgp') return true
    if (isHardware(item)) return true

    if (
      type === 'finished' || type === 'part' || type === 'product' ||
      type === 'bz' || type === 'bz_shop2' || type === 'wip_bz' ||
      type === 'semi' || type === 'semi_shop2' || type === 'hardware' ||
      type === 'scrap' || type === 'scrap_ready' || type.startsWith('scrap_cat_') ||
      nameLower.includes('бз') || nameLower.includes('буфер')
    ) {
      return true
    }

    return false
  }

  // Helper to group inventory items and exclude zero-quantity ghost items
  const buildGroupedRows = (itemsFilter, excludeZeroStock = true) => {
    const map = new Map()
    inventory.filter(itemsFilter).forEach(item => {
      const tQty = Number(item.total_qty) || 0
      const rQty = Number(item.reserved_qty) || 0

      // Exclude empty 0 total and 0 reserved ghost rows
      if (excludeZeroStock && tQty <= 0 && rQty <= 0) {
        return
      }

      const cleanName = (item.name || '').trim()
      const normName = normalizeKey(cleanName)
      const canonicalNomId = nomNameToId.get(normName) || (item.nomenclature_id ? String(item.nomenclature_id) : null)
      const key = canonicalNomId ? `nom_${canonicalNomId}` : `name_${normName}`

      if (!map.has(key)) {
        map.set(key, {
          nomenclature_id: canonicalNomId || item.nomenclature_id,
          name: cleanName,
          unit: item.unit || 'шт',
          total_qty: 0,
          reserved_qty: 0,
          rawItem: item
        })
      }

      const grp = map.get(key)
      grp.total_qty += tQty
      grp.reserved_qty += rQty
    })

    let list = Array.from(map.values())

    // Sort by Category then Name
    list.sort((a, b) => {
      const catA = getItemCategory(a)
      const catB = getItemCategory(b)
      if (catA !== catB) return catA.localeCompare(catB, 'uk')
      return a.name.localeCompare(b.name, 'uk')
    })

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(i => i.name.toLowerCase().includes(q) || getNomCode(i).toLowerCase().includes(q))
    }

    return list.map(item => ({
      'Категорія': getItemCategory(item),
      'Артикул / Код': getNomCode(item),
      'Найменування позиції': item.name,
      'Наявність (всього)': item.total_qty,
      'Вільний залишок': Math.max(0, item.total_qty - item.reserved_qty),
      'Зарезервовано': item.reserved_qty,
      'Од. вим.': item.unit
    }))
  }

  // 1. Finished Goods & Parts
  const finishedRows = buildGroupedRows(item => {
    if (!isSgpItem(item)) return false
    if (isHardware(item)) return false
    const type = item.type || ''
    const nameLower = (item.name || '').toLowerCase()
    return (
      type === 'finished' || type === 'part' || type === 'product' ||
      type === 'bz' || type === 'bz_shop2' || type === 'wip_bz' ||
      type === 'semi' || type === 'semi_shop2' ||
      nameLower.includes('бз') || nameLower.includes('буфер') ||
      item.warehouse === 'sgp'
    )
  }, true)

  // 2. Hardware
  const hardwareRows = buildGroupedRows(item => {
    if (!isSgpItem(item)) return false
    return isHardware(item)
  }, true)

  // 3. All Combined (non-zero SGP items sorted by Category)
  const allRows = buildGroupedRows(item => isSgpItem(item), true)

  // 4. Shop2 Buffer
  let shop2Rows = (shop2BufferConsolidatedItems || [])
    .filter(i => (Number(i.availableQty) || Number(i.total_qty) || 0) > 0 || (Number(i.inProgressQty) || 0) > 0)
    .map(item => ({
      'Категорія': 'Буфер заготовок Цеху №2',
      'Артикул / Код': item.nomCode || getNomCode(item),
      'Найменування заготовки': item.nomName || item.name,
      'Наявність в буфері (шт)': item.availableQty || item.total_qty || 0,
      'В роботі в Цеху 2 (шт)': item.inProgressQty || 0,
      'Отримано з Цеху 1 (шт)': item.totalReceived || 0,
      'Од. вим.': 'шт'
    }))

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim()
    shop2Rows = shop2Rows.filter(i => (i['Найменування заготовки'] || '').toLowerCase().includes(q) || (i['Артикул / Код'] || '').toLowerCase().includes(q))
  }

  // 5. Scrap & Quarantine
  const scrapRows = buildGroupedRows(item => {
    if (!isSgpItem(item)) return false
    const type = item.type || ''
    const nameLower = (item.name || '').toLowerCase()
    return type === 'scrap' || type === 'scrap_ready' || type.startsWith('scrap_cat_') || nameLower.includes('брак') || nameLower.includes('карантин')
  }, false)

  const workbookData = {
    'Готова продукція та Деталі': finishedRows,
    'Метизи та Комплектуючі': hardwareRows,
    'Зведений баланс СГП': allRows,
    'Буфер Цеху 2': shop2Rows,
    'Брак та Карантин': scrapRows
  }

  if (XLSX) {
    const workbook = XLSX.utils.book_new()
    Object.entries(workbookData).forEach(([sheetName, rows]) => {
      const worksheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'Повідомлення': 'Немає наявних залишків у даній категорії' }])
      
      if (rows.length > 0) {
        const colWidths = Object.keys(rows[0]).map(key => {
          const maxLen = Math.max(
            key.length,
            ...rows.map(r => String(r[key] || '').length)
          )
          return { wch: Math.min(Math.max(maxLen + 4, 14), 65) }
        })
        worksheet['!cols'] = colWidths
      }

      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
    })

    XLSX.writeFile(workbook, filename)
    return true
  } else {
    // Fallback to UTF-8 CSV
    const rows = allRows.length > 0 ? allRows : finishedRows
    if (rows.length === 0) return false
    const headers = Object.keys(rows[0])
    const csvContent = [
      headers.join(';'),
      ...rows.map(row => 
        headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(';')
      )
    ].join('\r\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', filename.replace(/\.xlsx$/, '.csv'))
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    return true
  }
}
