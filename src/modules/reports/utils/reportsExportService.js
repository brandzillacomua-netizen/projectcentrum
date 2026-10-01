const getXLSX = async () => {
  try {
    const xlsxMod = await import('xlsx')
    return xlsxMod.default || xlsxMod
  } catch (e) {
    console.warn('[ReportsExport] xlsx module load failed:', e)
    return null
  }
}

export const exportReportToExcel = async ({
  activeTab,
  startDate,
  endDate,
  scrapStats,
  scrapReasonsStats,
  employeeStats,
  warehouseReport,
  supplyStats,
  cuttersStats,
  generalStats
}) => {
  const XLSX = await getXLSX()
  const periodStr = `${startDate || 'Всі дати'} — ${endDate || 'Всі дати'}`
  const fileDateStr = new Date().toISOString().split('T')[0]
  const filename = `zvit_${activeTab}_${fileDateStr}.xlsx`

  let workbookData = {}

  if (activeTab === 'scrap') {
    // 1. Summary sheet
    const summaryRows = [
      { 'Показник': 'Період звіту', 'Значення': periodStr },
      { 'Показник': 'Реальний Утиль (Кат. 4)', 'Значення': `${scrapStats?.totalCat4 || 0} од.` },
      { 'Показник': 'Брак на доопрацювання (Кат. 1-2)', 'Значення': `${scrapStats?.totalCat123 || 0} од.` },
      { 'Показник': 'Не класифіковано / Карантин', 'Значення': `${(scrapStats?.totalUnclassified || 0) + (scrapStats?.totalQuarantine || 0)} од.` },
      { 'Показник': 'Зафіксовано брак-подій всього', 'Значення': `${scrapStats?.totalScrap || 0} од.` }
    ]

    // 2. Cases detail sheet
    const casesRows = (scrapStats?.list || []).map(h => {
      const dateDisplay = h.completed_at || h.created_at ? new Date(h.completed_at || h.created_at).toLocaleDateString('uk-UA') : '—'
      return {
        'Дата': dateDisplay,
        'Деталь / Номенклатура': h.nom_name || 'Невідома деталь',
        'Оператор': h.operator_name || 'Не вказано',
        'Етап виникнення': h.stage_name || '—',
        'Брак (Кат. 1-2)': h.cat1 + h.cat2 || 0,
        'Карантин (Кат. 3)': h.cat3 || 0,
        'Утиль (Кат. 4)': h.cat4 || 0,
        'Не класифіковано': h.unclassified || 0,
        'Всього браку (шт)': Number(h.scrap_qty) || 0
      }
    })

    // 3. Reasons detail sheet
    const reasonsRows = (scrapReasonsStats || []).map(r => ({
      'Причина браку': r.name,
      'Кількість деталей (шт)': r.quantity,
      'Відсоток (%)': `${r.percentage}%`,
      'Найчастіша деталь': r.topItem || '—',
      'Найчастіший оператор': r.topOperator || '—'
    }))

    workbookData = {
      'Підсумки Браку': summaryRows,
      'Випадки Браку': casesRows,
      'Причини Браку': reasonsRows
    }
  } else if (activeTab === 'cutters') {
    const summaryRows = (cuttersStats || []).map(s => ({
      'Назва фрези': s.name,
      'Отримано за період (шт)': s.supplied,
      'Використано за період (шт)': s.used,
      'Доступний залишок на складі (шт)': Math.max(0, s.actual - s.reserved)
    }))

    const eventsRows = (cutterEventsList || []).map(ev => ({
      'Дата та час': ev.date ? new Date(ev.date).toLocaleString('uk-UA') : '—',
      'Назва фрези': ev.cutterName,
      'Кількість (шт)': ev.quantity,
      'Оператор / Хто використав': ev.operator,
      'Джерело / Дільниця': ev.machine || ev.source,
      'ID Картки': ev.cardId
    }))

    workbookData = {
      'Зведений баланс фрез': summaryRows,
      'Журнал використання фрез': eventsRows
    }
  } else if (activeTab === 'employees') {
    const rows = (employeeStats || []).map(e => ({
      'Працівник': e.name,
      'Виготовлено (од)': e.produced,
      'Брак (од)': e.scrap,
      'Відсоток браку (%)': `${e.scrapPercent}%`,
      'Відпрацьовано годин': e.hours || '—'
    }))
    workbookData = { 'Звіт Працівники': rows }
  } else if (activeTab === 'warehouse') {
    const rows = (warehouseReport?.items || []).map(i => ({
      'Номенклатура': i.name,
      'Код': i.code || '—',
      'Категорія': i.category || '—',
      'Поточний залишок': i.qty,
      'Одиниця виміру': i.unit || 'шт'
    }))
    workbookData = { 'Звіт Склад': rows }
  } else {
    // Default fallback summary sheet
    const rows = [
      { 'Параметр': 'Тип звіту', 'Значення': activeTab },
      { 'Параметр': 'Період', 'Значення': periodStr },
      { 'Параметр': 'Створено', 'Значення': new Date().toLocaleString('uk-UA') }
    ]
    workbookData = { 'Звіт': rows }
  }

  if (XLSX) {
    const workbook = XLSX.utils.book_new()
    Object.entries(workbookData).forEach(([sheetName, rows]) => {
      const worksheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'Повідомлення': 'Немає даних за обраний період' }])
      
      // Auto column widths
      if (rows.length > 0) {
        const colWidths = Object.keys(rows[0]).map(key => {
          const maxLen = Math.max(
            key.length,
            ...rows.map(r => String(r[key] || '').length)
          )
          return { wch: Math.min(Math.max(maxLen + 3, 12), 60) }
        })
        worksheet['!cols'] = colWidths
      }

      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
    })

    XLSX.writeFile(workbook, filename)
    return true
  } else {
    // CSV fallback
    const firstSheetName = Object.keys(workbookData)[0]
    const rows = workbookData[firstSheetName] || []
    if (rows.length === 0) return false

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
    link.setAttribute('download', filename.replace(/\.xlsx$/, '.csv'))
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    return true
  }
}
