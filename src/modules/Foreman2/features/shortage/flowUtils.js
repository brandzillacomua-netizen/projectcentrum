export const normalizeStage = (value) => String(value || '').toLowerCase().replace(/\s+/g, '')

export const FLOW_STAGE = {
  cut: ['розкрій'],
  tumbling: ['галтовка'],
  reception: ['прийом', 'прийм'],
  sorting: ['сортування'],
  painting: ['фарбування', 'малярка'],
  pressing: ['пресування'],
  finishing: ['доопрацювання'],
  sgp: ['сгп', 'пакування'],
  bz: ['бз', 'bz']
}

export const flowStageMatches = (stageName, keys) => {
  const stage = normalizeStage(stageName)
  // Ignore buffer stages so they don't get double-counted alongside actual stages
  if (stage.includes('буфер') || stage.includes('buffer')) return false
  return keys.some(key => (FLOW_STAGE[key] || [key]).some(needle => stage.includes(needle)))
}

export const sumFlowField = (rows, field, stageKeys = null) => {
  const cardMax = {}
  rows.forEach(row => {
    if (stageKeys && !flowStageMatches(row.stage_name, stageKeys)) return
    const cardId = String(row.card_id || 'unknown')
    const val = Number(row[field]) || 0
    cardMax[cardId] = Math.max(cardMax[cardId] || 0, val)
  })
  return Object.values(cardMax).reduce((sum, val) => sum + val, 0)
}

export const getBestKnownProducedFromFlow = (rows) => {
  const finalGood = sumFlowField(rows, 'total_good', ['sgp'])
  const bzGood = sumFlowField(rows, 'total_bz')
  if (finalGood + bzGood > 0) return finalGood + bzGood

  const priority = ['finishing', 'pressing', 'painting', 'sorting', 'reception', 'tumbling', 'cut']
  return Math.max(0, ...priority.map(key => sumFlowField(rows, 'total_good', [key])), bzGood)
}
