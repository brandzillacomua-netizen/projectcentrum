export const reportDateBoundaryIso = (value, nextDay = false) => {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day + (nextDay ? 1 : 0), 0, 0, 0, 0).toISOString()
}

export const normalizeScrapReasonName = (reason) => {
  const name = reason || 'Причина не вказана'
  if (name.trim().toLowerCase() === 'легенькі сколи -потребує косметичного ремонту') {
    return 'Легкі сколи-потребує косметичного ремонту'
  }
  return name
}

export const isScrapReadyForQc = (historyRow) => Boolean(
  historyRow?.is_archived_scrap || String(historyRow?.card_info || '').includes('[ЦЕХ №2]')
)

export const matchesOperator = (opName, filterVal) => {
  if (!filterVal || filterVal === 'all') return true
  if (!opName) return false
  
  const clean = (str) => str.toLowerCase().replace(/\s+/g, ' ').trim()
  const oClean = clean(opName)
  const fClean = clean(filterVal)
  
  if (oClean === fClean) return true
  
  const oParts = oClean.split(' ')
  const fParts = fClean.split(' ')
  
  const match1 = fParts.every(p => oParts.includes(p) || oParts.some(op => op.includes(p) || p.includes(op)))
  const match2 = oParts.every(p => fParts.includes(p) || fParts.some(fp => fp.includes(p) || p.includes(fp)))
  
  return match1 || match2
}
