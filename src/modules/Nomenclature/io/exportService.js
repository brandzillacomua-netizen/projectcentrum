import { generateStandardName } from '../utils/nomenclatureHelpers'

const getXLSX = async () => {
  try {
    const xlsxMod = await import('xlsx')
    return xlsxMod.default || xlsxMod
  } catch (e) {
    console.warn('[NomenclatureIO] xlsx module load failed:', e)
    return null
  }
}

export const formatNomenclatureRowsForExport = (items = [], groups = []) => {
  const groupMap = new Map()
  ;(groups || []).forEach(g => {
    groupMap.set(g.id, g.name || g.code || g.id)
  })

  return items.map(item => {
    const groupName = groupMap.get(item.group_id) || item.group_id || '—'
    const ruleParamsStr = item.rule_params ? JSON.stringify(item.rule_params) : ''
    
    return {
      'Код V2': item.code || '',
      'Штрихкод': item.barcode || item.code || '',
      'QR-код': item.qr_code || item.code || '',
      'Стандартизована назва': item.name || '',
      'Категорія (Група)': groupName,
      'ID Категорії': item.group_id || '',
      'Одиниця виміру': item.unit || 'шт',
      'Правило (Rule Type)': item.rule_type || 'generic',
      'Статус': item.status === 'active' ? 'Активний' : (item.status || 'Активний'),
      'Параметри правила (JSON)': ruleParamsStr,
      'Дата створення': item.created_at ? new Date(item.created_at).toLocaleString() : ''
    }
  })
}

export const exportNomenclatureToXLSX = async ({ items = [], groups = [], filename = 'nomenclatures_v2_export.xlsx' }) => {
  const XLSX = await getXLSX()
  const rows = formatNomenclatureRowsForExport(items, groups)

  if (XLSX) {
    const worksheet = XLSX.utils.json_to_sheet(rows)
    
    // Set auto column widths
    const colWidths = Object.keys(rows[0] || {}).map(key => {
      const maxLen = Math.max(
        key.length,
        ...rows.map(r => String(r[key] || '').length)
      )
      return { wch: Math.min(Math.max(maxLen + 2, 10), 60) }
    })
    worksheet['!cols'] = colWidths

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Номенклатура V2')
    XLSX.writeFile(workbook, filename)
    return true
  } else {
    // Fallback to CSV if XLSX fails
    return exportNomenclatureToCSV({ items, groups, filename: filename.replace(/\.xlsx$/, '.csv') })
  }
}

export const exportNomenclatureToCSV = ({ items = [], groups = [], filename = 'nomenclatures_v2_export.csv' }) => {
  const rows = formatNomenclatureRowsForExport(items, groups)
  if (!rows || rows.length === 0) return false

  const headers = Object.keys(rows[0])
  const csvContent = [
    headers.join(';'),
    ...rows.map(row => 
      headers.map(h => {
        const val = String(row[h] || '').replace(/"/g, '""')
        return `"${val}"`
      }).join(';')
    )
  ].join('\r\n')

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  return true
}
