import { matchesOperator } from './useEmployeeReport'

const qty = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0
const emptyCategories = () => ({ cat1: 0, cat2: 0, cat3: 0, cat4: 0 })

// Classifications describe an existing defect event; they are not extra defects.
export function buildScrapStats({ workCardHistory = [], scrapClassificationsList = [], nomenclatures = [], filterByDate,
  selectedShiftFilter = 'all', selectedEmployeeFilter = 'all', searchQuery = '' }) {
  const events = new Map()
  const allHistory = new Map(workCardHistory.map(h => [String(h.id), h]))
  for (const h of workCardHistory) {
    if (qty(h.scrap_qty) <= 0 || !filterByDate(h.completed_at, h.created_at) ||
      (selectedShiftFilter !== 'all' && h.shift_name !== selectedShiftFilter) || !matchesOperator(h.operator_name, selectedEmployeeFilter)) continue
    let categories = emptyCategories()
    try {
      const raw = h.qc_scrap_comment?.match(/\[SCRAP_CAT:([^\]]+)\]/)?.[1]
      if (raw) { const parsed = JSON.parse(raw); for (const key of Object.keys(categories)) categories[key] = qty(parsed[key]) }
    } catch { /* Old comments without a category record remain unclassified. */ }
    events.set(String(h.id), { id: h.id, dateForSort: h.completed_at || h.created_at, nomenclature_id: h.nomenclature_id,
      operator_name: h.operator_name || 'Не вказано', stage_name: h.stage_name || 'Невказаний етап',
      scrap_qty: qty(h.scrap_qty), ...categories, classificationQty: 0, linkedCategories: null })
  }
  const seen = new Set()
  for (const c of scrapClassificationsList) {
    if (c.id && seen.has(c.id)) continue
    if (c.id) seen.add(c.id)
    const sourceId = c.source_history_id ? String(c.source_history_id) : null
    let event = sourceId ? events.get(sourceId) : null
    // A filtered-out history event must not reappear through its classification.
    if (!event && sourceId && allHistory.has(sourceId)) continue
    if (!event) {
      if (!filterByDate(c.classified_at, c.created_at) || !matchesOperator(c.source_operator_name, selectedEmployeeFilter)) continue
      // The classification schema has no shift: never attribute it to an arbitrary selected shift.
      if (selectedShiftFilter !== 'all') continue
      const key = sourceId || `classification-${c.id}`
      event = events.get(key)
      if (!event) {
        event = { id: key, dateForSort: c.classified_at || c.created_at, nomenclature_id: c.nomenclature_id,
          operator_name: c.source_operator_name || 'Не вказано', stage_name: c.source_stage_name || 'Контроль ВКЯ',
          scrap_qty: 0, ...emptyCategories(), classificationQty: 0, linkedCategories: null }
        events.set(key, event)
      }
    }
    event.classificationQty += qty(c.quantity)
    if (Array.isArray(c.scrap_classification_categories) && c.scrap_classification_categories.length) {
      event.linkedCategories ||= emptyCategories()
      for (const category of c.scrap_classification_categories) {
        const key = `cat${category.category}`
        if (key in event.linkedCategories) event.linkedCategories[key] += qty(category.quantity)
      }
    }
  }
  const query = searchQuery.toLocaleLowerCase('uk-UA')
  const list = [...events.values()].map(event => {
    const categories = event.linkedCategories || Object.fromEntries(Object.keys(emptyCategories()).map(k => [k, event[k]]))
    const classified = Object.values(categories).reduce((a, b) => a + b, 0)
    const total = Math.max(event.scrap_qty, event.classificationQty, classified)
    return { ...event, ...categories, scrap_qty: total, unclassified: Math.max(0, total - classified),
      nom_name: nomenclatures.find(n => String(n.id) === String(event.nomenclature_id))?.name || 'Невідома деталь' }
  }).filter(row => !query || row.nom_name.toLocaleLowerCase('uk-UA').includes(query) || row.operator_name.toLocaleLowerCase('uk-UA').includes(query))
    .sort((a, b) => new Date(b.dateForSort || 0) - new Date(a.dateForSort || 0))
  return list.reduce((totals, row) => {
    totals.totalScrap += row.scrap_qty
    totals.totalCat123 += row.cat1 + row.cat2
    totals.totalQuarantine += row.cat3
    totals.totalCat4 += row.cat4
    totals.totalUnclassified += row.unclassified
    totals.byStage[row.stage_name] = (totals.byStage[row.stage_name] || 0) + row.scrap_qty
    return totals
  }, { list, totalScrap: 0, totalCat123: 0, totalQuarantine: 0, totalCat4: 0, totalUnclassified: 0, byStage: {} })
}
