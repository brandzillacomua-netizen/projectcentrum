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
  const latestByCard = {}
  
  rows.forEach(row => {
    const stage = normalizeStage(row.stage_name)
    // Ignore buffer stages so they don't corrupt the latest actual production event
    if (stage.includes('буфер') || stage.includes('buffer')) return
    
    const cardId = String(row.card_id || 'unknown')
    const currentLatest = latestByCard[cardId]
    
    const rowTime = new Date(row.last_event_at || row.updated_at || 0).getTime()
    const latestTime = currentLatest ? new Date(currentLatest.last_event_at || currentLatest.updated_at || 0).getTime() : -1
    
    if (!currentLatest || rowTime > latestTime) {
      latestByCard[cardId] = row
    }
  })
  
  let totalProduced = 0
  Object.values(latestByCard).forEach(row => {
    totalProduced += (Number(row.total_good) || 0) + (Number(row.total_bz) || 0)
  })
  
  return totalProduced
}
