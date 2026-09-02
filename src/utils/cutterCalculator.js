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

  // 1. Find machineOperations for partNom & targetMachine
  const allOpsForPart = (machineOperations || []).filter(o => String(o.nomenclature_id) === String(partNom.id))

  let opData = null
  if (targetMachine) {
    opData = allOpsForPart.find(o =>
      isMachineMatch(o.machine_type, targetMachine) ||
      isMachineMatch(o.machine_id, targetMachine)
    )
  } else if (allOpsForPart.length > 0) {
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
        const cutterNom = nomenclatures.find(n => String(n.id) === String(cutterNomId))
        if (cutterNom && cutterNom.name.trim().toLowerCase() !== 'фреза') {
          const cleanName = cutterNom.name.trim()
          let resolvedCutterNom = cutterNom
          const partSelectedCutters = task?.plan_snapshot?.[String(partNom.id)]?.selected_cutters || task?.plan_snapshot?.selectedCutters
          if (partSelectedCutters && typeof partSelectedCutters === 'object') {
            const invId = partSelectedCutters[cleanName]
              || partSelectedCutters[cleanName.toLowerCase()]
              || partSelectedCutters[String(cutterNomId)]
              || partSelectedCutters[String(cutterNom.id)]
            if (invId) {
              const inv = (inventory || []).find(i => String(i.id) === String(invId))
              if (inv) {
                const specNom = nomenclatures.find(n => String(n.id) === String(inv.nomenclature_id))
                if (specNom) resolvedCutterNom = specNom
              } else {
                const specNom = nomenclatures.find(n => String(n.id) === String(invId))
                if (specNom) resolvedCutterNom = specNom
              }
            }

            if (resolvedCutterNom.type === 'cutter_type') {
              for (const [k, v] of Object.entries(partSelectedCutters)) {
                const candidate = nomenclatures.find(n =>
                  (String(n.id) === String(v) || String(n.id) === String(k) || n.name.trim().toLowerCase() === String(k).trim().toLowerCase()) &&
                  n.type === 'consumable' &&
                  String(n.characteristic) === String(cutterNom.id)
                )
                if (candidate) {
                  resolvedCutterNom = candidate
                  break
                }
              }
            }
          }

          if (resolvedCutterNom.type === 'cutter_type') {
            const matchingConsumables = (nomenclatures || []).filter(n =>
              n.type === 'consumable' && String(n.characteristic) === String(cutterNom.id)
            )
            if (matchingConsumables.length > 0) {
              const sorted = [...matchingConsumables].sort((a, b) => {
                const invA = (inventory || []).find(i => String(i.nomenclature_id) === String(a.id) && (i.warehouse === 'operational' || !i.warehouse))
                const invB = (inventory || []).find(i => String(i.nomenclature_id) === String(b.id) && (i.warehouse === 'operational' || !i.warehouse))
                return (Number(invB?.total_qty) || 0) - (Number(invA?.total_qty) || 0)
              })
              resolvedCutterNom = sorted[0]
            }
          }

          const resolvedName = resolvedCutterNom.name.trim()
          const key = resolvedCutterNom.id.toString()
          if (!machineSpecificCutters[key]) {
            machineSpecificCutters[key] = {
              name: resolvedName,
              qty: 0,
              nomenclature_id: resolvedCutterNom.id
            }
          }
          machineSpecificCutters[key].qty += totalQty
        }
      }
    })
  }

  // 2. Fallback to plan_snapshot consumables / selectedCutters ONLY IF no machineOperations exist for this part at all
  if (Object.keys(machineSpecificCutters).length === 0 && allOpsForPart.length === 0 && task?.plan_snapshot) {
    if (task.plan_snapshot.selectedCutters && typeof task.plan_snapshot.selectedCutters === 'object') {
      Object.values(task.plan_snapshot.selectedCutters).forEach(invId => {
        if (invId) {
          const inv = (inventory || []).find(i => String(i.id) === String(invId))
          if (inv) {
            const nom = nomenclatures.find(n => String(n.id) === String(inv.nomenclature_id))
            const name = nom ? nom.name : inv.name
            if (name && name.toLowerCase().includes('фреза') && name.toLowerCase() !== 'фреза') {
              const cleanName = name.trim()
              const key = cleanName.toLowerCase()
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
            const consNom = nomenclatures.find(n => n.name.trim().toLowerCase() === key)
            if (consNom) {
              const qtyPerSheet = Number(consNom.consumption_per_sheet) || 1
              machineSpecificCutters[key] = {
                name: cleanName,
                qty: Math.ceil(sheets * qtyPerSheet),
                nomenclature_id: consNom.id
              }
            }
          }
        }
      })
    }
  }

  return Object.values(machineSpecificCutters)
}
