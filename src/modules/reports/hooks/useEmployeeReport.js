import { useMemo } from 'react'

/**
 * Token-based operator matching allowing for variations in name ordering
 * (e.g., "Когут Назар" vs "Назар Когут", "Копитко О." vs "Копитко Олег").
 */
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

/**
 * Robust matcher to find an employee profile in systemUsers.
 */
export function findSystemUser(operatorName, systemUsers = []) {
  if (!operatorName || !systemUsers?.length) return null
  const clean = String(operatorName).toLowerCase().replace(/\s+/g, ' ').trim()

  // 1. Direct login match
  let user = systemUsers.find(u => String(u.login || '').toLowerCase().trim() === clean)
  if (user) return user

  // 2. Exact full name match in either "Прізвище Ім'я" or "Ім'я Прізвище" order
  user = systemUsers.find(u => {
    const fn = String(u.first_name || '').toLowerCase().trim()
    const ln = String(u.last_name || '').toLowerCase().trim()
    const lastFirst = `${ln} ${fn}`.trim()
    const firstLast = `${fn} ${ln}`.trim()
    return lastFirst === clean || firstLast === clean
  })
  if (user) return user

  // 3. Match with initials (e.g. "Копитко О." matching "Копитко Олег", "Парпацак І." matching "Парпацак Ігор")
  const parts = clean.split(' ').filter(Boolean)
  if (parts.length >= 2) {
    user = systemUsers.find(u => {
      const fn = String(u.first_name || '').toLowerCase().trim()
      const ln = String(u.last_name || '').toLowerCase().trim()
      if (!ln || !fn) return false

      // Case: "Копитко О." -> parts[0]="копитко", parts[1]="о."
      if (ln === parts[0]) {
        const init = parts[1].replace(/[^a-zа-яіїєґ]/gi, '')
        if (init && fn.startsWith(init)) return true
      }
      // Case: "О. Копитко" -> parts[0]="о.", parts[1]="копитко"
      if (ln === parts[1]) {
        const init = parts[0].replace(/[^a-zа-яіїєґ]/gi, '')
        if (init && fn.startsWith(init)) return true
      }
      return false
    })
    if (user) return user
  }

  // 4. Token-level partial matching
  user = systemUsers.find(u => {
    const fn = String(u.first_name || '').toLowerCase().trim()
    const ln = String(u.last_name || '').toLowerCase().trim()
    const validTokens = [ln, fn].filter(t => t.length >= 3)
    if (!validTokens.length) return false
    return validTokens.every(t => clean.includes(t))
  })

  return user || null
}

/**
 * Infer department & position for team/brigade names when not a single systemUser.
 */
function inferTeamProfile(operatorName) {
  const clean = String(operatorName || '').toLowerCase()

  if (clean.includes('галтовк')) {
    return { department: 'Цех №1 (Галтовка)', position: 'Бригада галтовки' }
  }
  if (clean.includes('пресув')) {
    return { department: 'Цех №2', position: 'Пресування' }
  }
  if (clean.includes('команда')) {
    return { department: 'Цех №1', position: 'Виробнича бригада' }
  }
  if (clean.includes('шліф')) {
    return { department: 'Цех №1', position: 'Шліфування' }
  }
  if (clean.includes('фрез')) {
    return { department: 'Цех №1', position: 'Фрезерувальник' }
  }
  if (clean.includes('лазер')) {
    return { department: 'Цех №1', position: 'Оператор лазера' }
  }
  if (clean.includes('склад')) {
    return { department: 'Склад', position: 'Комірник' }
  }
  if (clean.includes('вкя') || clean.includes('втк')) {
    return { department: 'ВКЯ', position: 'Контролер якості' }
  }

  return { department: 'Виробництво', position: 'Оператор' }
}

export function useEmployeeReport({
  systemUsers = [],
  workCardHistory = [],
  scrapClassificationsList = [],
  scrapReasonsDb = [],
  nomenclatures = [],
  tasks = [],
  orders = [],
  filterByDate,
  selectedShiftFilter = 'all',
  selectedEmployeeFilter = 'all',
  searchQuery = ''
}) {
  const employeeStats = useMemo(() => {
    // Pre-index classifications by source_history_id
    const classificationsByHistoryId = new Map()
    const directClassificationsByOperator = new Map()

    scrapClassificationsList.forEach(c => {
      if (c.source_history_id) {
        const hid = String(c.source_history_id)
        if (!classificationsByHistoryId.has(hid)) {
          classificationsByHistoryId.set(hid, [])
        }
        classificationsByHistoryId.get(hid).push(c)
      } else if (c.source_operator_name) {
        const opKey = String(c.source_operator_name).trim()
        if (!directClassificationsByOperator.has(opKey)) {
          directClassificationsByOperator.set(opKey, [])
        }
        directClassificationsByOperator.get(opKey).push(c)
      }
    })

    // Pre-index tasks & orders for quick history enrichment
    const tasksMap = new Map((tasks || []).map(t => [String(t.id), t]))
    const ordersMap = new Map((orders || []).map(o => [String(o.id), o]))
    const nomMap = new Map((nomenclatures || []).map(n => [String(n.id), n]))

    // Accumulators per employee key
    const stats = new Map()

    const getOrCreateStat = (operatorName) => {
      const cleanName = String(operatorName || 'Невідомий').trim()
      const user = findSystemUser(cleanName, systemUsers)
      const key = user ? user.login : cleanName

      if (!stats.has(key)) {
        let name = cleanName
        let position = 'Оператор'
        let department = 'Виробництво'
        let shift = user?.shift || '—'
        let avatar = user?.avatar || null

        if (user) {
          const fn = String(user.first_name || '').trim()
          const ln = String(user.last_name || '').trim()
          name = [ln, fn].filter(Boolean).join(' ') || user.login
          position = user.position || 'Оператор'
          department = user.department || 'Виробництво'
        } else {
          const inferred = inferTeamProfile(cleanName)
          department = inferred.department
          position = inferred.position
        }

        stats.set(key, {
          key,
          login: user ? user.login : null,
          name,
          rawName: cleanName,
          position,
          department,
          shift,
          avatar,
          produced: 0,
          scrap: 0,
          rework: 0,        // Відновлюваний (Кат. 1 та Кат. 2)
          quarantine: 0,    // Карантин (Кат. 3 + некласифікований брак)
          util: 0,          // Утиль / безповоротний брак (Кат. 4)
          cat1: 0,
          cat2: 0,
          cat3: 0,
          cat4: 0,
          unclassified: 0,
          operations: 0,
          history: []       // Full detailed list of work card operations for this operator
        })
      }

      return stats.get(key)
    }

    // Process Work Card History
    workCardHistory.forEach(h => {
      // Date and shift filter
      if (!filterByDate(h.completed_at, h.created_at)) return
      if (selectedShiftFilter !== 'all' && h.shift_name !== selectedShiftFilter) return

      const operatorName = h.operator_name || 'Невідомий'
      const empStat = getOrCreateStat(operatorName)

      const qtyProduced = Number(h.qty_completed) || 0
      const qtyScrap = Number(h.scrap_qty) || 0

      empStat.produced += qtyProduced
      empStat.scrap += qtyScrap
      empStat.operations += 1

      // Determine scrap categories for this specific history entry
      let hCat1 = 0
      let hCat2 = 0
      let hCat3 = 0
      let hCat4 = 0

      const hid = String(h.id)
      const linkedClasses = classificationsByHistoryId.get(hid)

      if (linkedClasses && linkedClasses.length > 0) {
        linkedClasses.forEach(c => {
          if (Array.isArray(c.scrap_classification_categories)) {
            c.scrap_classification_categories.forEach(catItem => {
              const catNum = Number(catItem.category)
              const catQty = Number(catItem.quantity) || 0
              if (catNum === 1) hCat1 += catQty
              else if (catNum === 2) hCat2 += catQty
              else if (catNum === 3) hCat3 += catQty
              else if (catNum === 4) hCat4 += catQty
            })
          }
        })
      } else if (h.qc_scrap_comment && h.qc_scrap_comment.includes('SCRAP_CAT:')) {
        // Legacy tag in comment
        try {
          const match = h.qc_scrap_comment.match(/\[SCRAP_CAT:([^\]]+)\]/)
          if (match) {
            const parsed = JSON.parse(match[1])
            hCat1 += Number(parsed.cat1 || 0)
            hCat2 += Number(parsed.cat2 || 0)
            hCat3 += Number(parsed.cat3 || 0)
            hCat4 += Number(parsed.cat4 || 0)
          }
        } catch {}
      }

      const totalClassified = hCat1 + hCat2 + hCat3 + hCat4
      // Any recorded defect not yet classified by QC is quarantined pending inspection
      const hUnclassified = Math.max(0, qtyScrap - totalClassified)
      const hRework = hCat1 + hCat2
      const hQuarantine = hCat3 + hUnclassified
      const hUtil = hCat4

      empStat.cat1 += hCat1
      empStat.cat2 += hCat2
      empStat.cat3 += hCat3
      empStat.cat4 += hCat4
      empStat.unclassified += hUnclassified
      empStat.rework += hRework
      empStat.quarantine += hQuarantine
      empStat.util += hUtil

      // Resolve Order / Naryad and Nomenclature details for drill-down
      const task = h.task_id ? tasksMap.get(String(h.task_id)) : null
      const order = task?.order_id ? ordersMap.get(String(task.order_id)) : null
      const nom = h.nomenclature_id ? nomMap.get(String(h.nomenclature_id)) : null

      let orderNum = order?.order_num || null
      if (!orderNum && task) {
        orderNum = task.plan_snapshot?._prep_num || (task.batch_index ? `План #${String(task.id).slice(-6)}` : null)
      }
      if (!orderNum) {
        orderNum = h.card_info || 'Без наряду'
      }

      // Extract defect reason if present
      let scrapReason = '—'
      if (qtyScrap > 0) {
        if (h.qc_scrap_comment) {
          let cleanReason = h.qc_scrap_comment
            .replace(/\[SCRAP_CAT:[^\]]+\]/g, '')
            .replace(/\[SCRAP_REASONS:[^\]]+\]/g, '')
            .trim()
          if (cleanReason.includes('Причина:')) {
            cleanReason = cleanReason.split('Причина:')[1].trim()
          }
          if (cleanReason) scrapReason = cleanReason
        }
      }

      // Append detailed operation item
      empStat.history.push({
        id: h.id,
        date: h.completed_at || h.created_at,
        stage: h.stage_name || 'Операція',
        shift: h.shift_name || empStat.shift,
        nomenclatureName: nom?.name || 'Невідома деталь',
        nomenclatureCode: nom?.code || null,
        orderNum,
        machine: h.machine_name || h.machine || '—',
        produced: qtyProduced,
        scrap: qtyScrap,
        rework: hRework,
        quarantine: hQuarantine,
        util: hUtil,
        reason: scrapReason
      })
    })

    // Process Direct Classifications that were not tied to a work_card_history row
    directClassificationsByOperator.forEach((classes, opName) => {
      classes.forEach(c => {
        if (!filterByDate(c.classified_at, c.created_at)) return

        const empStat = getOrCreateStat(opName)
        let cCat1 = 0
        let cCat2 = 0
        let cCat3 = 0
        let cCat4 = 0

        if (Array.isArray(c.scrap_classification_categories)) {
          c.scrap_classification_categories.forEach(catItem => {
            const catNum = Number(catItem.category)
            const catQty = Number(catItem.quantity) || 0
            if (catNum === 1) cCat1 += catQty
            else if (catNum === 2) cCat2 += catQty
            else if (catNum === 3) cCat3 += catQty
            else if (catNum === 4) cCat4 += catQty
          })
        }

        const cTotal = cCat1 + cCat2 + cCat3 + cCat4 || Number(c.quantity) || 0
        const cRework = cCat1 + cCat2
        const cQuarantine = cCat3
        const cUtil = cCat4

        empStat.scrap += cTotal
        empStat.cat1 += cCat1
        empStat.cat2 += cCat2
        empStat.cat3 += cCat3
        empStat.cat4 += cCat4
        empStat.rework += cRework
        empStat.quarantine += cQuarantine
        empStat.util += cUtil

        const nom = c.nomenclature_id ? nomMap.get(String(c.nomenclature_id)) : null

        empStat.history.push({
          id: `class-${c.id}`,
          date: c.classified_at || c.created_at,
          stage: c.source_stage_name || 'Контроль ВКЯ',
          shift: '—',
          nomenclatureName: nom?.name || 'Невідома деталь',
          nomenclatureCode: nom?.code || null,
          orderNum: c.order_number || 'Пряма рекламація ВКЯ',
          machine: '—',
          produced: 0,
          scrap: cTotal,
          rework: cRework,
          quarantine: cQuarantine,
          util: cUtil,
          reason: c.reason || c.comment || 'Класифікація ВКЯ'
        })
      })
    })

    // Calculate final metrics for each employee
    const results = Array.from(stats.values()).map(s => {
      const totalProcessed = s.produced + s.scrap
      const efficiency = totalProcessed > 0
        ? Number(((s.produced / totalProcessed) * 100).toFixed(1))
        : 100.0
      const scrapPercent = totalProcessed > 0
        ? Number(((s.scrap / totalProcessed) * 100).toFixed(1))
        : 0.0

      // Sort employee history by date descending
      s.history.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))

      return {
        ...s,
        efficiency,
        scrapPercent
      }
    })

    // Filter by query and selectedEmployeeFilter
    return results
      .filter(s => {
        // Exclude completely inactive employees unless matching a search
        if (s.operations === 0 && s.scrap === 0 && !searchQuery) return false

        if (selectedEmployeeFilter && selectedEmployeeFilter !== 'all') {
          if (!matchesOperator(s.name, selectedEmployeeFilter) && !matchesOperator(s.rawName, selectedEmployeeFilter)) {
            return false
          }
        }

        if (searchQuery) {
          const q = searchQuery.toLowerCase().trim()
          const matchName = s.name.toLowerCase().includes(q)
          const matchDept = s.department.toLowerCase().includes(q)
          const matchPos = s.position.toLowerCase().includes(q)
          if (!matchName && !matchDept && !matchPos) return false
        }

        return true
      })
      .sort((a, b) => b.produced - a.produced || b.operations - a.operations)
  }, [
    systemUsers,
    workCardHistory,
    scrapClassificationsList,
    scrapReasonsDb,
    nomenclatures,
    tasks,
    orders,
    filterByDate,
    selectedShiftFilter,
    selectedEmployeeFilter,
    searchQuery
  ])

  return { employeeStats }
}
