// ─── Pure helpers ───────────────────────────────────────────────────

export const MACHINE_TYPES = [
  'CNC 1200x800 - 4 листи (Малий)',
  'CNC 3050(16)х16 - 3-12 листів (швидкісний)',
  'CNC 3060х1600 - 3-36 листів (Три Головий)',
  'CNC 6000x2000 - 4 - 96 листів (Дракон)',
  'CNC KE XIN - 4 - 16 листів (ФЕЯ)'
]

export const SHORTAGE_CACHE_KEY = 'foreman_shortage_map_v1'

export const getRequestQty = (r) => {
  if (r.quantity !== null && r.quantity !== undefined) return Number(r.quantity)
  const match = (r.details || '').match(/—\s*(\d+)/)
  return match ? Number(match[1]) : 0
}

export const getDisplayMaterial = (partNom, snapshot) => {
  const baseMat = partNom?.material_type || '—'
  if (!snapshot) return baseMat
  const s300 = snapshot.sheets_t300 !== undefined ? Number(snapshot.sheets_t300) : 0
  const s700 = snapshot.sheets_t700 !== undefined ? Number(snapshot.sheets_t700) : 0
  
  const hasT300 = (baseMat || '').toLowerCase().includes('т300') || (baseMat || '').toLowerCase().includes('t300')
  const hasT700 = (baseMat || '').toLowerCase().includes('т700') || (baseMat || '').toLowerCase().includes('t700')
  const isDefaultT700 = hasT700

  if (snapshot.sheets_t300 !== undefined || snapshot.sheets_t700 !== undefined) {
    if (s700 > 0 && s300 === 0) {
      if (hasT300) return baseMat.replace(/т300/gi, 'Т700').replace(/t300/gi, 'Т700')
      if (!hasT700) return 'Т700 ' + baseMat
      return baseMat
    }
    if (s300 > 0 && s700 > 0) {
      if (hasT300) return baseMat.replace(/т300/gi, 'Т300+Т700').replace(/t300/gi, 'Т300+Т700')
      if (hasT700) return baseMat.replace(/т700/gi, 'Т300+Т700').replace(/t700/gi, 'Т300+Т700')
      return 'Т300+Т700 ' + baseMat
    }
    if (s300 > 0 && s700 === 0) {
      if (hasT700) return baseMat.replace(/т700/gi, 'Т300').replace(/t700/gi, 'Т300')
      if (!hasT300) return 'Т300 ' + baseMat
      return baseMat
    }
  } else if (isDefaultT700) {
    return baseMat.replace(/т300/gi, 'Т700').replace(/t300/gi, 'Т700')
  }
  return baseMat
}

export const countAsProduced = (card) => {
  if (card.status === 'completed') return true
  if (card.status === 'at-shop2-buffer') return true
  return false
}

export const getStandardMachineType = (name) => {
  if (!name || name === 'Не вказано') return ''
  const normName = name.toLowerCase()
  const directMatch = MACHINE_TYPES.find(t => t.toLowerCase() === normName)
  if (directMatch) return directMatch
  if (normName.includes('12x8') || normName.includes('1200x800') || normName.includes('малий')) return 'CNC 1200x800 - 4 листи (Малий)'
  if (normName.includes('16x16') || normName.includes('3050(16)') || normName.includes('швидкісний') || normName.includes('3050x1600') || normName.includes('3050х1600') || normName.includes('3050')) return 'CNC 3050(16)х16 - 3-12 листів (швидкісний)'
  if (normName.includes('30x16') || normName.includes('3060x1600') || normName.includes('3060х1600') || normName.includes('три головий') || normName.includes('триголовий')) return 'CNC 3060х1600 - 3-36 листів (Три Головий)'
  if (normName.includes('60x20') || normName.includes('6000x2000') || normName.includes('дракон')) return 'CNC 6000x2000 - 4 - 96 листів (Дракон)'
  if (normName.includes('ke xin') || normName.includes('фея')) return 'CNC KE XIN - 4 - 16 листів (ФЕЯ)'
  const partial = MACHINE_TYPES.find(t => t.toLowerCase().includes(normName) || normName.includes(t.toLowerCase()))
  if (partial) return partial
  return ''
}

export const findMachineByName = (name, machines) => {
  if (!name || name === 'Не вказано') return null
  const baseName = name.split(' №')[0].trim()
  let found = machines.find(m => m.name === baseName)
    || machines.find(m => m.name === name)
    || machines.find(m => m.type === baseName)
    || machines.find(m => m.type === name)
  if (!found) {
    const baseNameLower = baseName.toLowerCase()
    if (baseNameLower.includes('12x8') || baseNameLower.includes('1200x800') || baseNameLower.includes('малий')) {
      found = { sheet_capacity: 4, name: 'CNC 1200x800 - 4 листи (Малий)' }
    } else if (baseNameLower.includes('16x16') || baseNameLower.includes('3050(16)') || baseNameLower.includes('швидкісний') || baseNameLower.includes('3050x1600') || baseNameLower.includes('3050х1600') || baseNameLower.includes('3050')) {
      found = { sheet_capacity: 12, name: 'CNC 3050(16)х16 - 3-12 листів (швидкісний)' }
    } else if (baseNameLower.includes('30x16') || baseNameLower.includes('3060x1600') || baseNameLower.includes('3060х1600') || baseNameLower.includes('три головий') || baseNameLower.includes('триголовий')) {
      found = { sheet_capacity: 36, name: 'CNC 3060х1600 - 3-36 листів (Три Головий)' }
    } else if (baseNameLower.includes('60x20') || baseNameLower.includes('6000x2000') || baseNameLower.includes('дракон')) {
      found = { sheet_capacity: 96, name: 'CNC 6000x2000 - 4 - 96 листів (Дракон)' }
    } else if (baseNameLower.includes('ke xin') || baseNameLower.includes('фея')) {
      found = { sheet_capacity: 16, name: 'CNC KE XIN - 4 - 16 листів (ФЕЯ)' }
    }
  }
  if (found) {
    const result = { ...found }
    const searchName = ((result.name || '') + ' ' + (name || '')).replace(/\d+\s*[xх\*×]\s*\d+/gi, '')
    const match = searchName.match(/(\d+)\s*-\s*(\d+)\s*лист/i)
    if (match) {
      result.min_capacity = parseInt(match[1])
      result.max_capacity = parseInt(match[2])
    } else {
      const matchSingle = searchName.match(/(\d+)\s*лист/i)
      if (matchSingle) {
        result.min_capacity = parseInt(matchSingle[1])
        result.max_capacity = parseInt(matchSingle[1])
      } else {
        const bnl = searchName.toLowerCase()
        if (bnl.includes('12x8') || bnl.includes('1200x800') || bnl.includes('малий')) {
          result.min_capacity = 1; result.max_capacity = 4
        } else if (bnl.includes('16x16') || bnl.includes('3050(16)') || bnl.includes('швидкісний') || bnl.includes('3050x1600') || bnl.includes('3050х1600') || bnl.includes('3050')) {
          result.min_capacity = 3; result.max_capacity = 12
        } else if (bnl.includes('30x16') || bnl.includes('3060x1600') || bnl.includes('3060х1600') || bnl.includes('три головий') || bnl.includes('триголовий')) {
          result.min_capacity = 3; result.max_capacity = 36
        } else if (bnl.includes('60x20') || bnl.includes('6000x2000') || bnl.includes('дракон')) {
          result.min_capacity = 4; result.max_capacity = 96
        } else if (bnl.includes('ke xin') || bnl.includes('фея')) {
          result.min_capacity = 4; result.max_capacity = 16
        } else {
          result.min_capacity = result.sheet_capacity || 1
          result.max_capacity = result.sheet_capacity || 1
        }
      }
    }
    if (result.min_capacity > result.max_capacity || result.min_capacity >= 100) {
      const bnl = searchName.toLowerCase()
      if (bnl.includes('1200x800') || bnl.includes('малий') || bnl.includes('12x8')) {
        result.min_capacity = 1
        result.max_capacity = 4
      }
    }
    return result
  }
  return null
}

export const getBOMPartsFromItems = (nomenclatureId, bomItems, nomenclatures) => {
  return bomItems
    .filter(b => b.parent_id === nomenclatureId)
    .map(b => ({ ...b, nom: nomenclatures.find(n => n.id === b.child_id) }))
}

export const getDisplayPartsForOrderItem = (task, it, bomItems, nomenclatures) => {
  if (task?.plan_snapshot) {
    const partsFromSnapshot = Object.values(task.plan_snapshot)
      .filter(p => p && String(p.order_item_id) === String(it.id))
      .map(p => {
        const nom = nomenclatures.find(n => String(n.id) === String(p.id))
        return {
          nom: nom || { id: p.id, name: p.name, nomenclature_code: p.code, material_type: p.material, type: 'part' },
          quantity_per_parent: p.need / (Number(it.quantity) || 1)
        }
      })
    if (partsFromSnapshot.length > 0) return partsFromSnapshot
  }
  const parts = getBOMPartsFromItems(it.nomenclature_id, bomItems, nomenclatures)
  return parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === it.nomenclature_id), quantity_per_parent: 1 }]
}

export const formatDurationHMS = (seconds) => {
  if (!seconds || seconds <= 0) return '0хв'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}г ${m}хв`
  if (m > 0) return `${m}хв ${s}с`
  return `${s}с`
}
