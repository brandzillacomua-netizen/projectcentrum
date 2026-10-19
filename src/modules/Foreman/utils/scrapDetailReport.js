const qty = value => Math.max(0, Number(value) || 0)
const asId = value => String(value || '')

const uniqueText = values => [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))]

const getLegacyCat4Quantity = row => {
  const text = `${row?.qc_scrap_comment || ''} ${row?.card_info || ''}`
  const match = text.match(/\[SCRAP_CAT:([^\]]+)\]/)
  if (!match) return 0
  try {
    return qty(JSON.parse(match[1])?.cat4)
  } catch {
    return 0
  }
}

const getCardSequence = (...sources) => {
  for (const source of sources) {
    const match = String(source || '').match(/(?:^|\D)(\d+)\s*\/\s*(\d+)(?:\D|$)/)
    if (match) return `${match[1]}/${match[2]}`
  }
  return null
}

const resolveCard = (row, cards) => {
  const cardId = asId(row?.card_id || row?.source_card_id)
  return cards.find(card => asId(card.id) === cardId) || null
}

const resolveNomenclature = (row, card, nomenclatures) => {
  const nomenclatureId = asId(row?.nomenclature_id || row?.nomId || card?.nomenclature_id)
  return {
    nomenclatureId,
    nomenclature: nomenclatures.find(item => asId(item.id) === nomenclatureId) || null
  }
}

const buildCardLabel = (row, card) => {
  const sequence = getCardSequence(row?.card_info, card?.card_info)
  if (sequence) return `Картка ${sequence}`
  const cardId = asId(row?.card_id || row?.source_card_id || card?.id)
  return cardId ? `Картка #${cardId.slice(-8).toUpperCase()}` : 'Архівний запис без номера картки'
}

const groupEntries = entries => {
  const groups = new Map()
  entries.forEach(entry => {
    if (entry.qty <= 0) return
    const key = entry.nomenclatureId || `unknown:${entry.name}`
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        nomenclatureId: entry.nomenclatureId,
        name: entry.name,
        code: entry.code,
        qty: 0,
        entries: []
      })
    }
    const group = groups.get(key)
    group.qty += entry.qty
    group.entries.push(entry)
  })

  return [...groups.values()]
    .map(group => ({
      ...group,
      entries: [...group.entries.reduce((cardsMap, entry) => {
        const key = entry.cardId ? `card:${entry.cardId}` : `source:${entry.id}`
        if (!cardsMap.has(key)) {
          cardsMap.set(key, { ...entry })
          return cardsMap
        }
        const current = cardsMap.get(key)
        current.qty += entry.qty
        current.stage = uniqueText([current.stage, entry.stage]).join(', ') || 'Не вказано'
        current.operator = uniqueText([current.operator, entry.operator]).filter(value => value !== '—').join(', ') || '—'
        current.shift = uniqueText([current.shift, entry.shift]).filter(value => value !== '—').join(', ') || '—'
        current.machine = uniqueText([current.machine, entry.machine]).filter(value => value !== '—').join(', ') || '—'
        if (String(entry.completedAt || '') > String(current.completedAt || '')) current.completedAt = entry.completedAt
        return cardsMap
      }, new Map()).values()]
        .sort((a, b) => b.qty - a.qty || String(b.completedAt || '').localeCompare(String(a.completedAt || '')))
    }))
    .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name, 'uk'))
}

export function buildScrapDetailGroups({ rows = [], cards = [], nomenclatures = [] } = {}) {
  const entries = rows.map((row, index) => {
    const card = resolveCard(row, cards)
    const { nomenclatureId, nomenclature } = resolveNomenclature(row, card, nomenclatures)
    return {
      id: asId(row.id) || `scrap:${asId(row.card_id)}:${index}`,
      nomenclatureId,
      name: nomenclature?.name || row.name || 'Невідома деталь',
      code: nomenclature?.nomenclature_code || row.code || 'БЕЗ КОДУ',
      cardId: asId(row.card_id || row.source_card_id),
      cardLabel: buildCardLabel(row, card),
      qty: qty(row.scrap_qty ?? row.scrapQty),
      stage: row.stage_name === 'completed' ? 'Прийомка' : (String(row.stage_name || '').trim() || 'Не вказано'),
      operator: row.operator_name || '—',
      shift: row.shift_name || '—',
      machine: row.machine_name || row.machine || card?.machine || '—',
      completedAt: row.completed_at || row.created_at || null,
      source: row.source || null
    }
  })
  return groupEntries(entries)
}

export function buildUtilDetailGroups({ finalScrapRows = [], historyRows = [], cards = [], nomenclatures = [], expectedTotal = 0 } = {}) {
  const explicitRows = finalScrapRows.filter(row => qty(row.total_scrap ?? row.scrap_qty) > 0)
  const explicitKeys = new Set(explicitRows.map(row => `${asId(row.card_id || row.source_card_id)}:${asId(row.nomenclature_id || row.nomId)}`))
  const legacyRows = historyRows.flatMap(row => {
    const cat4 = getLegacyCat4Quantity(row)
    const key = `${asId(row.card_id || row.source_card_id)}:${asId(row.nomenclature_id || row.nomId)}`
    return cat4 > 0 && !explicitKeys.has(key)
      ? [{ ...row, total_scrap: cat4, last_scrap_at: row.completed_at || row.created_at }]
      : []
  })
  const sourceRows = [...explicitRows, ...legacyRows]

  let entries = sourceRows.map((row, index) => {
    const card = resolveCard(row, cards)
    const { nomenclatureId, nomenclature } = resolveNomenclature(row, card, nomenclatures)
    const cardId = asId(row.card_id || row.source_card_id)
    const sources = historyRows.filter(history => (
      asId(history.card_id) === cardId &&
      qty(history.scrap_qty ?? history.scrapQty) > 0
    ))
    const stages = uniqueText(sources.map(source => source.stage_name === 'completed' ? 'Прийомка' : source.stage_name))
    const operators = uniqueText(sources.map(source => source.operator_name))
    const shifts = uniqueText(sources.map(source => source.shift_name))
    const machines = uniqueText(sources.map(source => source.machine_name || source.machine))

    return {
      id: asId(row.id) || `util:${cardId}:${nomenclatureId}:${index}`,
      nomenclatureId,
      name: nomenclature?.name || row.name || 'Невідома деталь',
      code: nomenclature?.nomenclature_code || row.code || 'БЕЗ КОДУ',
      cardId,
      cardLabel: buildCardLabel(row, card),
      qty: qty(row.total_scrap ?? row.scrap_qty),
      stage: stages.join(', ') || 'Класифікація ВКЯ',
      operator: operators.join(', ') || 'ВКЯ',
      shift: shifts.join(', ') || '—',
      machine: machines.join(', ') || card?.machine || '—',
      completedAt: row.last_scrap_at || row.updated_at || row.created_at || null,
      source: 'util'
    }
  })

  const targetTotal = qty(expectedTotal)
  if (targetTotal > 0) {
    let remaining = targetTotal
    entries = entries.flatMap(entry => {
      const entryQuantity = Math.min(entry.qty, remaining)
      remaining -= entryQuantity
      return entryQuantity > 0 ? [{ ...entry, qty: entryQuantity }] : []
    })
  }

  const detailedTotal = entries.reduce((sum, entry) => sum + entry.qty, 0)
  const missingLegacyQuantity = Math.max(0, targetTotal - detailedTotal)
  if (missingLegacyQuantity > 0) {
    entries.push({
      id: 'legacy-unallocated-util',
      nomenclatureId: 'legacy-unallocated-util',
      name: 'Утиль старого обліку без прив’язки',
      code: 'Картка не була зафіксована в старих даних',
      cardId: '',
      cardLabel: 'Джерело не зафіксоване',
      qty: missingLegacyQuantity,
      stage: 'Старий облік ВКЯ',
      operator: '—',
      shift: '—',
      machine: '—',
      completedAt: null,
      source: 'legacy_unallocated_util'
    })
  }
  return groupEntries(entries)
}

