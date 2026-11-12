const getXLSX = async () => {
  try {
    const xlsxMod = await import('xlsx')
    return xlsxMod.default || xlsxMod
  } catch (e) {
    console.warn('[ShiftCalendarExport] xlsx module load failed:', e)
    return null
  }
}

/**
 * Export the employee attendance schedule (табель / графік виходу) to an Excel file (.xlsx)
 * with graceful fallback to UTF-8 CSV.
 */
export const exportShiftCalendarToExcel = async ({
  categorizedCalendarUsers = [],
  currentYear,
  currentMonth,
  monthNames = [],
  weekDayNames = [],
  daysInMonth = 30,
  masterCheckins = {},
  operatorCheckins = {},
  formatUserName = u => `${u.last_name || ''} ${u.first_name || ''}`.trim()
}) => {
  const XLSX = await getXLSX()
  const monthName = monthNames[currentMonth] || `Місяць_${currentMonth + 1}`
  const filename = `grafik_vykhodu_${monthName}_${currentYear}.xlsx`.toLowerCase()

  const rows = []

  categorizedCalendarUsers.forEach(group => {
    (group.users || []).forEach(user => {
      const uName = formatUserName(user)
      const isMaster = ['начальник', 'майстер', 'мастер', 'керівник'].some(kw =>
        String(user.position || '').toLowerCase().includes(kw)
      )

      let countWork = 0
      let countOff = 0
      let countSick = 0
      let countUnpaid = 0
      let countFact = 0

      const row = {
        'Категорія': group.title || '',
        'Співробітник': uName,
        'Посада': user.position || 'Робітник',
        'Зміна': user.shift || 'Без зміни'
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const calendarKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const status = user.shift_calendar?.[calendarKey] || ''
        const hasCheckins = isMaster
          ? masterCheckins[uName]?.[calendarKey]
          : operatorCheckins[uName]?.[calendarKey]

        if (status === 'Р') countWork++
        else if (status === 'В') countOff++
        else if (status === 'Л') countSick++
        else if (status === 'БЗ') countUnpaid++

        if (hasCheckins) countFact++

        const dayDate = new Date(currentYear, currentMonth, day)
        const dayOfWeek = weekDayNames[dayDate.getDay()] || ''
        const colHeader = `${String(day).padStart(2, '0')} (${dayOfWeek})`

        let displayVal = status
        if (!displayVal && hasCheckins) {
          displayVal = '✓'
        } else if (displayVal && hasCheckins) {
          displayVal = `${displayVal} (✓)`
        }
        row[colHeader] = displayVal
      }

      row['Відпрацьовано (Р)'] = countWork
      row['Вихідних (В)'] = countOff
      row['Лікарняних (Л)'] = countSick
      row['Без збереж. ЗП (БЗ)'] = countUnpaid
      row['Факт виходів (✓)'] = countFact

      rows.push(row)
    })
  })

  if (XLSX) {
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(
      rows.length > 0 ? rows : [{ 'Повідомлення': 'Немає даних у табелі' }]
    )

    if (rows.length > 0) {
      const keys = Object.keys(rows[0])
      worksheet['!cols'] = keys.map(k => {
        if (k === 'Категорія') return { wch: 26 }
        if (k === 'Співробітник') return { wch: 26 }
        if (k === 'Посада') return { wch: 25 }
        if (k === 'Зміна') return { wch: 14 }
        if (k.includes('(') && k.length <= 10) return { wch: 8 }
        return { wch: Math.max(k.length + 3, 13) }
      })
    }

    const sheetName = `${monthName} ${currentYear}`.slice(0, 31)
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
    XLSX.writeFile(workbook, filename)
    return true
  }

  // Fallback to UTF-8 CSV with BOM
  if (rows.length === 0) return false
  const headers = Object.keys(rows[0])
  const csvContent = [
    headers.join(';'),
    ...rows.map(row =>
      headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(';')
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

