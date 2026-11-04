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
  generalStats,
  machineReport,
  efficiencyReport
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
      'Цех': e.department || '—',
      'Посада': e.position || '—',
      'Карти': e.cards || 0,
      'Операцій': e.operations,
      'Виготовлено (од)': e.produced,
      'Загальний брак (од)': e.scrap,
      'Відновлюваний (Кат. 1–2)': e.rework,
      'Карантин (Кат. 3 / ВКЯ)': e.quarantine,
      'Утиль (Кат. 4)': e.util,
      'Ефективність (%)': `${e.efficiency}%`
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
  } else if (activeTab === 'machines') {
    const formatDur = (sec) => {
      const h = Math.floor((sec || 0) / 3600)
      const m = Math.floor(((sec || 0) % 3600) / 60)
      return `${h}г ${m}хв`
    }

    const summaryRows = (machineReport?.machineAnalytics || []).map(m => ({
      'Верстат': m.name + (m.sequence_number ? ` (№${m.sequence_number})` : ''),
      'Тип': m.type || '—',
      'Час різки': formatDur(m.totalWorkSec),
      'Час пауз': formatDur(m.totalPauseSec),
      'К-сть пауз': m.pauseCount,
      'Проведено ТО': m.maintenanceLogs.length,
      'Карт порізано': m.cardsCount,
      'Деталей випущено': m.producedQty,
      'Брак (шт)': m.scrapQty,
      'Листів порізано': m.sheetsCount,
      'Оператори': (m.operatorsList || []).join(', ')
    }))

    const cardsRows = []
    ;(machineReport?.machineAnalytics || []).forEach(m => {
      ;(m.cards || []).forEach(c => {
        cardsRows.push({
          'Верстат': m.name,
          'Картка': `#${String(c.card_id || c.id).slice(0, 8)}`,
          'Оператор': c.operator_name || '—',
          'Початок': c.started_at ? new Date(c.started_at).toLocaleString('uk-UA') : '—',
          'Кінець': c.completed_at ? new Date(c.completed_at).toLocaleString('uk-UA') : (c.is_active ? 'В процесі' : '—'),
          'Час різки': formatDur(c.workSec),
          'Час паузи': formatDur(c.pauseSec),
          'Причини пауз': (c.pauseReasons || []).map(r => r.reason).join(', ') || '—',
          'Деталей (шт)': c.qty_completed || 0,
          'Брак (шт)': c.scrap_qty || 0,
          'Листів': c.sheets || 0
        })
      })
    })

    const maintRows = (machineReport?.maintenanceLogs || []).map(l => ({
      'Дата': l.triggered_at ? new Date(l.triggered_at).toLocaleString('uk-UA') : '—',
      'Верстат ID': l.machine_id,
      'Вид ТО': l.maintenance_type || '—',
      'Голова / Вузол': l.machine_head || l.spare_part || '—',
      'Хто виконував': l.performed_by || '—',
      'Примітки': l.notes || '—'
    }))

    workbookData = {
      'Огляд верстатів': summaryRows,
      'Журнал карт': cardsRows,
      'Обслуговування ТО': maintRows
    }
  } else if (activeTab === 'efficiency') {
    const totals = efficiencyReport?.totals || {}
    const operatorsList = efficiencyReport?.operatorsList || []
    const partsComparison = efficiencyReport?.partsComparison || []
    const shiftChangesLog = efficiencyReport?.shiftChangesLog || []

    const summaryRows = [
      { 'Показник': 'Період звіту', 'Значення': periodStr },
      { 'Показник': 'Середня ефективність розкрою цеху', 'Значення': `${totals.overallShopEfficiency || 0}%` },
      { 'Показник': 'Вироблено нормо-годин (План)', 'Значення': `${totals.totalPlanHours || 0} год (${totals.totalPlanMinutes || 0} хв)` },
      { 'Показник': 'Відпрацьовано фактично (Факт)', 'Значення': `${totals.totalFactHours || 0} год (${totals.totalFactMinutes || 0} хв)` },
      { 'Показник': 'Баланс часу (+/- год)', 'Значення': `${(totals.totalDeltaHours || 0) >= 0 ? '+' : ''}${totals.totalDeltaHours || 0} год` },
      { 'Показник': 'Кількість задіяних операторів', 'Значення': totals.activeOperatorsCount || 0 },
      { 'Показник': 'Оброблено унікальних карт', 'Значення': totals.totalCardsCut || 0 },
      { 'Показник': 'Всього робочих сесій розкрою', 'Значення': totals.totalSessionsCount || 0 },
      { 'Показник': 'Зафіксовано перезмінок на ЧПК', 'Значення': totals.handoverCount || 0 },
      { 'Показник': 'Лідер ефективності', 'Значення': totals.topOperator ? `${totals.topOperator.operatorName} (${totals.topOperator.avgEfficiencyPercent}%)` : '—' }
    ]

    const operatorsRows = operatorsList.map((op, idx) => ({
      'Ранг': idx + 1,
      'Оператор': op.operatorName,
      'Зміна': op.shiftName,
      'Унікальних карт': op.cardsCount,
      'Кількість сесій': op.sessionsCount,
      'План (год)': op.totalPlanHours,
      'Факт (год)': op.totalFactHours,
      'Баланс (+/- год)': op.deltaHours,
      'Ефективність (%)': `${op.avgEfficiencyPercent}%`
    }))

    const partsRows = []
    partsComparison.forEach(p => {
      p.operators.forEach(op => {
        partsRows.push({
          'Деталь': p.nomenclatureName,
          'Артикул': p.nomenclatureCode,
          'Всього запусків деталі': p.totalRuns,
          'Оператор': op.operatorName,
          'Зміна': op.shiftName,
          'Запусків оператором': op.runsCount,
          'Сер. факт час (хв)': op.avgFactMinutes,
          'Сер. план час (хв)': op.avgPlanMinutes,
          'Ефективність на деталі (%)': `${op.efficiencyPercent}%`,
          'Статус': op.operatorName === p.fastestOperator?.operatorName && p.operators.length > 1 ? 'Найшвидший' : '—'
        })
      })
    })

    const handoversRows = shiftChangesLog.map(h => ({
      'Дата': h.date ? new Date(h.date).toLocaleString('uk-UA') : '—',
      'Картка': h.cardCode,
      'Деталь': h.nomenclatureName,
      'Верстат': h.machineName,
      'Листів': h.sheetCount,
      'Здав зміну': h.operatorName,
      'Зміна того хто здав': h.shiftName,
      'Прийняв зміну': h.replacedBy,
      'Відмітка зупинки ([LAST_OP])': h.rawHandoverText,
      'Виконано операцій': h.operationsCount,
      'План відрізку (хв)': h.planMinutes,
      'Факт відрізку (хв)': h.factMinutes,
      'Ефективність (%)': `${h.efficiencyPercent}%`
    }))

    workbookData = {
      'Зведення ефективності': summaryRows,
      'Рейтинг операторів': operatorsRows,
      'Порівняння по деталях': partsRows,
      'Журнал перезмінок ЧПК': handoversRows
    }
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
