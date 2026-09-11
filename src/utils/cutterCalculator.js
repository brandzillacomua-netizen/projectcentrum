export const STANDARD_CUTTER_TYPES = [
  { id: 'type_f15', name: 'Тип Ф1.5', diameter: 1.5 },
  { id: 'type_f2', name: 'Тип Ф2', diameter: 2.0 },
  { id: 'type_f3', name: 'Тип Ф3', diameter: 3.0 },
  { id: 'type_f4', name: 'Тип Ф4', diameter: 4.0 },
  { id: 'type_f6', name: 'Тип Ф6', diameter: 6.0 },
  { id: 'type_f6_90', name: 'Тип Ф6 (90°)', diameter: 6.0 }
]

export const KNOWN_CUTTER_TYPES = {
  '1ba4c09f-2fcf-4fc8-957d-80fca75d371a': { name: 'Тип Ф3', code: 'CUT-F3', type: 'cutter_type', diameter: 3 },
  '2e2f45ea-e2d8-480b-9b08-f6d6519149fb': { name: 'Тип Ф2', code: 'CUT-F2', type: 'cutter_type', diameter: 2 },
  'e5b209f9-4a1e-4c39-a88d-45b0fbced448': { name: 'Тип Ф6 (90°)', code: 'CUT-F6-90', type: 'cutter_type', diameter: 6, angle: 90 },
  '8fe39a64-9668-47de-950d-f10a15a3906e': { name: 'Тип Ф3.175', code: 'CUT-2F-3.175', type: 'cutter_type', diameter: 3.175 },
  '23a5c254-1993-4775-a748-acf80d12fb81': { name: 'Тип Ф3', code: 'CUT-4F-3MM', type: 'cutter_type', diameter: 3 },
  'c4ba659c-d7f1-4d18-b590-dfad96c90b19': { name: 'Тип Ф6 (120°)', code: 'CUT-CHAMF-6', type: 'cutter_type', diameter: 6, angle: 120 },
  'type_f15': { name: 'Тип Ф1.5', code: 'CUT-F1.5', type: 'cutter_type', diameter: 1.5 },
  'type_f2': { name: 'Тип Ф2', code: 'CUT-F2', type: 'cutter_type', diameter: 2 },
  'type_f3': { name: 'Тип Ф3', code: 'CUT-F3', type: 'cutter_type', diameter: 3 },
  'type_f4': { name: 'Тип Ф4', code: 'CUT-F4', type: 'cutter_type', diameter: 4 },
  'type_f6': { name: 'Тип Ф6', code: 'CUT-F6', type: 'cutter_type', diameter: 6 },
  'type_f6_90': { name: 'Тип Ф6 (90°)', code: 'CUT-F6-90', type: 'cutter_type', diameter: 6, angle: 90 }
}

export const resolveCutterOrVirtualType = (cutterNomId, nomenclatures = []) => {
  if (!cutterNomId) return null
  const idStr = String(cutterNomId).trim()

  const known = KNOWN_CUTTER_TYPES[idStr] || KNOWN_CUTTER_TYPES[idStr.toLowerCase()]
  if (known) {
    return {
      id: idStr,
      name: known.name,
      type: 'cutter_type',
      material_type: String(known.diameter),
      diameter: known.diameter
    }
  }

  const directNom = (nomenclatures || []).find(n => 
    String(n.id) === idStr ||
    (Array.isArray(n.legacy_ids) && n.legacy_ids.map(String).includes(idStr))
  )
  if (directNom) return directNom

  const stdType = STANDARD_CUTTER_TYPES.find(s => 
    String(s.id).toLowerCase() === idStr.toLowerCase() ||
    s.name.toLowerCase() === idStr.toLowerCase() ||
    s.id.replace('type_', '').toLowerCase() === idStr.replace('type_', '').toLowerCase()
  )
  if (stdType) {
    return {
      id: stdType.id,
      name: stdType.name,
      type: 'cutter_type',
      material_type: String(stdType.diameter),
      diameter: stdType.diameter
    }
  }

  const cleanId = idStr.toLowerCase()
  if (cleanId.startsWith('type_') || cleanId.startsWith('тип ') || cleanId.startsWith('ф')) {
    const diaMatch = cleanId.match(/([0-9]+(?:[.,][0-9]+)?)/)
    const dia = diaMatch ? diaMatch[1].replace(',', '.') : null
    return {
      id: idStr,
      name: dia ? `Тип Ф${dia}` : idStr.replace('type_', 'Тип ').toUpperCase(),
      type: 'cutter_type',
      material_type: dia,
      diameter: dia ? parseFloat(dia) : null
    }
  }

  return null
}

export const isVirtualCutterType = (n) => {
  if (!n) return false
  if (n.type === 'cutter_type' || n.rule_type === 'cutter_type' || n.group_id === 'grp_cutter_types') return true
  const name = String(n.name || '').trim().toLowerCase()
  if (name.includes('кукурудз') || name.includes('двопер') || name.includes('двохпер') || name.includes('однопер') || name.includes('компресій')) {
    return false
  }
  if (name.match(/[0-9]+[хx][0-9]+/)) {
    return false
  }
  if (name.startsWith('тип ф') || name.startsWith('тип f') || name.match(/^фреза\s+ф[0-9]/) || name.match(/^ф[0-9.]+(\s|$)/)) {
    return true
  }
  return false
}

export const extractCutterDiameter = (nameStr) => {
  if (!nameStr) return null
  const s = String(nameStr).toLowerCase()

  const fMatch = s.match(/ф\s*(\d+(?:[.,]\d+)?)/)
  if (fMatch) return fMatch[1].replace(',', '.')

  const mmMatch = s.match(/(\d+(?:[.,]\d+)?)\s*мм/)
  if (mmMatch) return mmMatch[1].replace(',', '.')

  const dimMatch = s.match(/(\d+(?:[.,]\d+)?)\s*[хx]/)
  if (dimMatch) return dimMatch[1].replace(',', '.')

  return null
}

export const resolveCutterTypeName = (cutterNom, nomenclatures = []) => {
  if (!cutterNom) return 'Фреза'
  const name = String(cutterNom.name || '').trim()

  if (cutterNom.type === 'cutter_type' || isVirtualCutterType(cutterNom)) {
    if (name.startsWith('Тип ') || name.startsWith('тип ')) return name
    const dia = extractCutterDiameter(name)
    const angleMatch = name.match(/(\d+)\s*°/)
    if (dia) {
      if (angleMatch) return `Тип Ф${dia} (${angleMatch[1]}°)`
      return `Тип Ф${dia}`
    }
    return name
  }

  if (cutterNom.characteristic) {
    const parentNom = (nomenclatures || []).find(n => String(n.id) === String(cutterNom.characteristic))
    if (parentNom) {
      return resolveCutterTypeName(parentNom, nomenclatures)
    }
    const std = STANDARD_CUTTER_TYPES.find(s => s.id === String(cutterNom.characteristic))
    if (std) return std.name
    const known = KNOWN_CUTTER_TYPES[String(cutterNom.characteristic)]
    if (known) return known.name
  }

  const dia = extractCutterDiameter(name)
  const angleMatch = name.match(/(\d+)\s*°/)
  if (dia) {
    if (angleMatch) {
      return `Тип Ф${dia} (${angleMatch[1]}°)`
    }
    return `Тип Ф${dia}`
  }

  return name
}

export const isMachineMatch = (opMachine, targetMachine) => {
  if (!opMachine || !targetMachine) return false
  const opStr = String(opMachine).toLowerCase().trim()
  const targetStr = String(targetMachine).toLowerCase().trim()

  if (opStr === targetStr) return true
  if (opStr.includes(targetStr) || targetStr.includes(opStr)) return true

  // Group equivalent keywords/nicknames for each machine category
  const machineGroups = [
    ['1200', '12x8', '12х8', 'мал'],
    ['3050', '16x16', '16х16'],
    ['3060', '30x16', '30х16', 'три головий'],
    ['6000', '60x20', '60х20', 'дракон'],
    ['ke xin', 'kexin', 'фея']
  ]

  for (const group of machineGroups) {
    const opHasGroup = group.some(kw => opStr.includes(kw))
    const targetHasGroup = group.some(kw => targetStr.includes(kw))
    if (opHasGroup && targetHasGroup) return true
  }

  const opBase = opStr.split(' - ')[0].trim()
  const targetBase = targetStr.split(' - ')[0].trim()
  if (opBase && targetBase && (opBase === targetBase || opBase.includes(targetBase) || targetBase.includes(opBase))) {
    return true
  }

  return false
}

export const calculateCuttersForBatch = ({
  partNom,
  machineName,
  sheets,
  task,
  machineOperations = [],
  nomenclatures = [],
  inventory = []
}) => {
  if (!partNom || !sheets || sheets <= 0) return []

  const machineSpecificCutters = {}
  const targetMachine = machineName || task?.machine_name || ''

  // 1. Find machineOperations for partNom & targetMachine (with legacy_ids support)
  const partId = String(partNom?.id || '')
  const legacyIds = (partNom?.legacy_ids || []).map(String)
  const allOpsForPart = (machineOperations || []).filter(o => {
    const opNomId = String(o.nomenclature_id || '')
    return opNomId === partId || legacyIds.includes(opNomId)
  })

  const isRealMachine = targetMachine &&
    targetMachine !== 'Не призначено' &&
    targetMachine !== 'Не вказано' &&
    targetMachine.toLowerCase() !== 'не призначено' &&
    targetMachine.toLowerCase() !== 'не вказано'

  let opData = null
  if (isRealMachine) {
    opData = allOpsForPart.find(o =>
      isMachineMatch(o.machine_type, targetMachine) ||
      isMachineMatch(o.machine_id, targetMachine)
    )
  }
  if (!opData && allOpsForPart.length > 0) {
    opData = allOpsForPart[0]
  }

  if (opData && opData.side2_cut_ops) {
    const cutterOps = opData.side2_cut_ops.filter(op => op.startsWith('__CUTTER__Reference:') || op.startsWith('__CUTTER__:'))
    cutterOps.forEach(op => {
      const parts = op.split(':')
      const cutterNomId = parts[1]
      const qtyPerSheet = parseFloat(parts[2]) || 0
      if (cutterNomId && qtyPerSheet > 0) {
        const totalQty = Math.ceil(sheets * qtyPerSheet)
        const cutterNom = resolveCutterOrVirtualType(cutterNomId, nomenclatures)
        if (cutterNom && cutterNom.name.trim().toLowerCase() !== 'фреза') {
          const typeName = resolveCutterTypeName(cutterNom, nomenclatures)
          const key = typeName.toLowerCase().trim()
          if (!machineSpecificCutters[key]) {
            machineSpecificCutters[key] = {
              name: typeName,
              typeName: typeName,
              qty: 0,
              nomenclature_id: cutterNom.characteristic || cutterNom.id,
              cutter_type_id: cutterNom.characteristic || cutterNom.id,
              isCutterType: true
            }
          }
          machineSpecificCutters[key].qty += totalQty
        }
      }
    })
  }

  // 2. Fallback to plan_snapshot consumables / selectedCutters IF no cutters were resolved from operations
  if (Object.keys(machineSpecificCutters).length === 0 && task?.plan_snapshot) {
    if (task.plan_snapshot.selectedCutters && typeof task.plan_snapshot.selectedCutters === 'object') {
      Object.values(task.plan_snapshot.selectedCutters).forEach(invId => {
        if (invId) {
          const inv = (inventory || []).find(i => String(i.id) === String(invId))
          if (inv) {
            const nom = nomenclatures.find(n => 
              String(n.id) === String(inv.nomenclature_id) ||
              (Array.isArray(n.legacy_ids) && n.legacy_ids.map(String).includes(String(inv.nomenclature_id)))
            )
            const isCutter = nom?.group_id === 'grp_mills' || nom?.type === 'consumable' || (name && name.toLowerCase().includes('фреза') && name.toLowerCase() !== 'фреза')
            if (isCutter) {
              const cleanName = (nom?.name || inv.name || name).trim()
              const key = String(nom?.id || inv.nomenclature_id || cleanName.toLowerCase())
              const qtyPerSheet = 1
              const totalQty = Math.ceil(sheets * qtyPerSheet)
              if (!machineSpecificCutters[key]) {
                machineSpecificCutters[key] = {
                  name: cleanName,
                  qty: totalQty,
                  nomenclature_id: nom ? nom.id : inv.nomenclature_id
                }
              }
            }
          }
        }
      })
    }

    if (Array.isArray(task.plan_snapshot.consumables)) {
      task.plan_snapshot.consumables.forEach(c => {
        if (c.name && c.name.toLowerCase().includes('фреза') && c.name.toLowerCase() !== 'фреза') {
          const cleanName = c.name.trim()
          const key = cleanName.toLowerCase()
          if (!machineSpecificCutters[key]) {
            const consNom = nomenclatures.find(n => 
              n.name.trim().toLowerCase() === key ||
              (Array.isArray(n.legacy_ids) && c.nomenclature_id && n.legacy_ids.map(String).includes(String(c.nomenclature_id))) ||
              (n.type === 'consumable' && (n.name.toLowerCase().includes(key) || key.includes(n.name.toLowerCase())))
            )
            const resolvedId = consNom?.id || c.nomenclature_id || null
            const qtyPerSheet = Number(consNom?.consumption_per_sheet) || 1
            machineSpecificCutters[key] = {
              name: consNom ? consNom.name : cleanName,
              qty: Math.ceil(sheets * qtyPerSheet),
              nomenclature_id: resolvedId
            }
          }
        }
      })
    }
  }

  // 3. Ultimate fallback: if still no cutters, search for any configured CNC cutter in nomenclatures
  if (Object.keys(machineSpecificCutters).length === 0) {
    const generalCutter = (nomenclatures || []).find(n =>
      (n.group_id === 'grp_mills' || (n.type === 'consumable' && n.name.toLowerCase().includes('фреза'))) &&
      (Number(n.consumption_per_sheet) || 0) > 0 &&
      n.name.trim().toLowerCase() !== 'фреза'
    )
    if (generalCutter) {
      const cleanName = generalCutter.name.trim()
      const key = cleanName.toLowerCase()
      const qtyPerSheet = Number(generalCutter.consumption_per_sheet) || 1
      machineSpecificCutters[key] = {
        name: cleanName,
        qty: Math.ceil(sheets * qtyPerSheet),
        nomenclature_id: generalCutter.id
      }
    }
  }

  return Object.values(machineSpecificCutters)
}
