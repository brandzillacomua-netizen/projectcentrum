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

const userCache = new Map()
const entityExcludedCache = new Map()

/**
 * Robust matcher to find an employee profile in systemUsers.
 */
export function findSystemUser(operatorName, systemUsers = []) {
  if (!operatorName || !systemUsers?.length) return null
  const clean = String(operatorName).toLowerCase().replace(/\s+/g, ' ').trim()
  if (userCache.has(clean)) return userCache.get(clean)

  // 1. Direct login match
  let user = systemUsers.find(u => String(u.login || '').toLowerCase().trim() === clean)
  if (user) {
    userCache.set(clean, user)
    return user
  }

  // 2. Exact full name match in either "Прізвище Ім'я" or "Ім'я Прізвище" order
  user = systemUsers.find(u => {
    const fn = String(u.first_name || '').toLowerCase().trim()
    const ln = String(u.last_name || '').toLowerCase().trim()
    const lastFirst = `${ln} ${fn}`.trim()
    const firstLast = `${fn} ${ln}`.trim()
    return lastFirst === clean || firstLast === clean
  })
  if (user) {
    userCache.set(clean, user)
    return user
  }

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
    if (user) {
      userCache.set(clean, user)
      return user
    }
  }

  // 4. Token-level partial matching
  user = systemUsers.find(u => {
    const fn = String(u.first_name || '').toLowerCase().trim()
    const ln = String(u.last_name || '').toLowerCase().trim()
    const validTokens = [ln, fn].filter(t => t.length >= 3)
    if (!validTokens.length) return false
    return validTokens.every(t => clean.includes(t))
  })

  userCache.set(clean, user || null)
  return user || null
}

/**
 * Check if stage represents non-manufacturing technical movements,
 * warehouse transfers, buffer delays, or quality checks.
 */
export function isTechnicalHistoryStage(stageName) {
  if (!stageName) return false
  const clean = String(stageName).toLowerCase().trim()
  const technicalStages = [
    'completed',
    'переміщення',
    'склад',
    'бронь',
    'склад (бронь)',
    'склад бз',
    'склад сгп',
    'контроль вкя',
    'вкя',
    'термінал відновлення вкя',
    'термінал відновлення деталей'
  ]
  if (
    technicalStages.some(t => clean === t || clean.startsWith('склад') || clean.startsWith('контроль вкя') || clean.startsWith('буфер'))
  ) {
    return true
  }
  return false
}

/**
 * Checks if a name or user represents a non-production entity
 * (quality inspector, warehouse reservation/account, system account,
 * foreman/master supervisor, or defect reason comment).
 */
export function isNonProductionEntity(name, user = null, systemUsers = []) {
  if (!name) return true
  const clean = String(name).toLowerCase().replace(/\s+/g, ' ').trim()
  if (
    !clean ||
    clean === '—' ||
    clean === '-' ||
    clean === 'null' ||
    clean === 'undefined' ||
    clean === 'невідомий'
  ) {
    return true
  }

  if (entityExcludedCache.has(clean)) return entityExcludedCache.get(clean)

  const compute = () => {
    // 1. Defect comments or reason notes mistakenly saved into operator name
    if (
      clean.includes('причина:') ||
      clean.includes('причина :') ||
      clean.includes('відповідальн') ||
      clean.includes('бракований лист') ||
      clean.includes('scrap_cat:') ||
      clean.includes('scrap_reason')
    ) {
      return true
    }

    // 2. Quality Control (ВКЯ / ВТК) entities and roles
    if (
      clean.startsWith('вкя') ||
      clean.startsWith('втк') ||
      clean.includes('інспектор вкя') ||
      clean.includes('відділ контролю якості') ||
      clean.includes('контролер якості') ||
      clean.includes('контроль браку') ||
      clean.includes('термінал відновлення')
    ) {
      return true
    }

    // 3. Warehouse bookings, reservations, and storage accounts
    if (
      clean.includes('склад (бронь)') ||
      clean.includes('склад бз') ||
      clean.includes('склад сгп') ||
      clean === 'склад' ||
      clean === 'бронь' ||
      clean.startsWith('склад (') ||
      clean.startsWith('склад ')
    ) {
      return true
    }

    // 4. System, terminal, automated actions
    if (
      clean.includes('система (термінал)') ||
      clean.includes('система') ||
      clean === 'термінал' ||
      clean === 'оператор терміналу' ||
      clean.includes('system')
    ) {
      return true
    }

    // 5. Foremen / Masters / Admins (supervisors who do not fabricate parts)
    if (
      /майстер\s+цеху/i.test(clean) ||
      clean === 'майстер' ||
      clean.includes('адміністратор') ||
      clean === 'admin' ||
      clean.includes('керівник') ||
      clean.includes('начальник')
    ) {
      return true
    }

    // 6. Matched user profile in systemUsers
    const resolvedUser = user || (systemUsers?.length ? findSystemUser(name, systemUsers) : null)
    if (resolvedUser) {
      const dept = String(resolvedUser.department || '').toLowerCase().trim()
      const pos = String(resolvedUser.position || '').toLowerCase().trim()
      const login = String(resolvedUser.login || '').toLowerCase().trim()

      // Quality Control (ВКЯ / ВТК)
      if (dept.includes('вкя') || dept.includes('втк') || dept.includes('якост') || dept.includes('контрол')) return true
      if (pos.includes('вкя') || pos.includes('втк') || pos.includes('контрол') || pos.includes('якост') || pos.includes('інспектор')) return true
      if (login.includes('vkya') || login.endsWith('.vkya')) return true

      // Warehouse
      if (dept === 'склад' || pos.includes('комірник')) return true

      // Management / Supervision / Admin
      if (pos.includes('майстер') || pos.includes('начальник') || pos.includes('директор') || pos.includes('адміністратор')) return true
      if (dept.includes('адміністрація') || dept.includes('керівництво') || dept.includes('it') || dept.includes('бухгалтерія')) return true
    }

    return false
  }

  const res = compute()
  entityExcludedCache.set(clean, res)
  return res
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
  if (clean.includes('фарбув') || clean.includes('маляр')) {
    return { department: 'Цех №2', position: 'Фарбування' }
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
  if (clean.includes('розкрій')) {
    return { department: 'Цех №1', position: 'Оператор розкрою' }
  }

  return { department: 'Виробництво', position: 'Оператор' }
}

/**
 * Resolves the real manufacturing operator responsible for a defect,
 * tracing from the card's history, predecessor stages, or stage context.
 */
export function resolveResponsibleOperator(item, cardOperatorsMap = new Map(), workCardsMap = new Map(), systemUsers = []) {
  if (!item) return 'Команда'

  const rawOp = item.operator_name || item.source_operator_name || ''
  const directUser = findSystemUser(rawOp, systemUsers)

  // If the item already has a legitimate manufacturing operator, use it
  if (rawOp && !isNonProductionEntity(rawOp, directUser, systemUsers)) {
    return rawOp.trim()
  }

  const cardId = item.card_id ? String(item.card_id) : null
  const stage = String(item.stage_name || item.source_stage_name || '').toLowerCase().trim()
  const comment = String(item.qc_scrap_comment || item.reason || item.notes || rawOp || '').toLowerCase()

  if (cardId && cardOperatorsMap && cardOperatorsMap.has(cardId)) {
    const info = cardOperatorsMap.get(cardId)
    if (stage.includes('розкрій') || stage.includes('сортування') || stage.includes('прийомка') || stage.includes('контроль вкя') || comment.includes('лист')) {
      if (info.cuttingOp) return info.cuttingOp
    }
    if (stage.includes('галтовк')) {
      if (info.tumblingOp) return info.tumblingOp
    }
    if (stage.includes('прес') || stage.includes('кондуктор')) {
      if (info.pressingOp) return info.pressingOp
    }
    if (stage.includes('фарбув') || stage.includes('маляр')) {
      if (info.paintingOp) return info.paintingOp
    }
    if (info.lastProductionOp) return info.lastProductionOp
  }

  // 2. Try to find operator from the work card entity itself
  if (cardId && workCardsMap && workCardsMap.has(cardId)) {
    const card = workCardsMap.get(cardId)
    if (card?.operator_name) {
      const cardUser = findSystemUser(card.operator_name, systemUsers)
      if (!isNonProductionEntity(card.operator_name, cardUser, systemUsers)) {
        return card.operator_name.trim()
      }
    }
  }

  // 3. Fallback based on stage or shop context
  if (stage.includes('кондуктор') || stage.includes('прес')) {
    return 'Пресувальник Зміна 1'
  }
  if (stage.includes('фарбув') || stage.includes('маляр')) {
    return 'Фарбувальник Зміна 1'
  }
  if (stage.includes('галтовк')) {
    return 'Команда галтовки'
  }

  return 'Команда'
}

export function buildClassificationOnlyEvents({
  classifications = [],
  historyRows = [],
  processedClassificationIds = new Set(),
  filterByDate = () => true,
  selectedShiftFilter = 'all'
} = {}) {
  if (selectedShiftFilter !== 'all') return []

  const historyIds = new Set(historyRows.map(row => String(row.id)))
  const events = new Map()

  classifications.forEach(classification => {
    if (classification.id && processedClassificationIds.has(String(classification.id))) return

    const sourceId = classification.source_history_id ? String(classification.source_history_id) : null
    // If the source row is present, its filters decide whether it belongs in the report.
    if (sourceId && historyIds.has(sourceId)) return
    if (!filterByDate(classification.classified_at, classification.created_at)) return

    const key = sourceId || `classification-${classification.id}`
    if (!events.has(key)) {
      events.set(key, {
        key,
        sample: classification,
        classificationQty: 0,
        cat1: 0,
        cat2: 0,
        cat3: 0,
        cat4: 0
      })
    }

    const event = events.get(key)
    event.classificationQty += Math.max(0, Number(classification.quantity) || 0)
    ;(classification.scrap_classification_categories || []).forEach(category => {
      const categoryKey = `cat${Number(category.category)}`
      if (categoryKey in event) {
        event[categoryKey] += Math.max(0, Number(category.quantity) || 0)
      }
    })
  })

  return [...events.values()].map(event => {
    const classifiedQty = event.cat1 + event.cat2 + event.cat3 + event.cat4
    return {
      ...event,
      total: Math.max(event.classificationQty, classifiedQty),
      unclassified: Math.max(0, event.classificationQty - classifiedQty)
    }
  })
}

export function useEmployeeReport({
  systemUsers = [],
  workCardHistory = [],
  scrapClassificationsList = [],
  scrapReasonsDb = [],
  nomenclatures = [],
  tasks = [],
  orders = [],
  workCards = [],
  filterByDate,
  selectedShiftFilter = 'all',
  selectedEmployeeFilter = 'all',
  searchQuery = ''
}) {
  const employeeStats = useMemo(() => {
    // Pre-index classifications by source_history_id
    const classificationsByHistoryId = new Map()

    scrapClassificationsList.forEach(c => {
      if (c.source_history_id) {
        const hid = String(c.source_history_id)
        if (!classificationsByHistoryId.has(hid)) {
          classificationsByHistoryId.set(hid, [])
        }
        classificationsByHistoryId.get(hid).push(c)
      }
    })

    // Pre-index tasks & orders for quick history enrichment
    const tasksMap = new Map((tasks || []).map(t => [String(t.id), t]))
    const ordersMap = new Map((orders || []).map(o => [String(o.id), o]))
    const nomMap = new Map((nomenclatures || []).map(n => [String(n.id), n]))
    const workCardsMap = new Map((workCards || []).map(c => [String(c.id), c]))

    // Pre-index history by card_id to resolve responsible operators for QC/unassigned defects
    const historyByCardId = new Map()
    workCardHistory.forEach(h => {
      if (!h.card_id) return
      const cid = String(h.card_id)
      if (!historyByCardId.has(cid)) {
        historyByCardId.set(cid, [])
      }
      historyByCardId.get(cid).push(h)
    })
    historyByCardId.forEach(list => {
      list.sort((a, b) => new Date(a.completed_at || a.created_at || 0) - new Date(b.completed_at || b.created_at || 0))
    })

    // Pre-calculate operators per card once: O(N) total instead of O(N * M * K) inside the loop
    const cardOperatorsMap = new Map()
    historyByCardId.forEach((cardHistory, cardId) => {
      let cuttingOp = null
      let tumblingOp = null
      let pressingOp = null
      let paintingOp = null
      let lastProductionOp = null

      for (let i = 0; i < cardHistory.length; i++) {
        const h = cardHistory[i]
        if (isTechnicalHistoryStage(h.stage_name)) continue
        const user = findSystemUser(h.operator_name, systemUsers)
        if (isNonProductionEntity(h.operator_name, user, systemUsers)) continue

        const hStage = String(h.stage_name || '').toLowerCase()
        const op = String(h.operator_name || '').trim()
        if (!op) continue

        lastProductionOp = op
        if (hStage.includes('розкрій')) cuttingOp = op
        else if (hStage.includes('галтовк')) tumblingOp = op
        else if (hStage.includes('прес') || hStage.includes('кондуктор')) pressingOp = op
        else if (hStage.includes('фарбув') || hStage.includes('маляр')) paintingOp = op
      }

      cardOperatorsMap.set(cardId, {
        cuttingOp,
        tumblingOp,
        pressingOp,
        paintingOp,
        lastProductionOp
      })
    })

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
    const processedClassificationIds = new Set()
    workCardHistory.forEach(h => {
      // Date and shift filter
      if (!filterByDate(h.completed_at, h.created_at)) return
      if (selectedShiftFilter !== 'all' && h.shift_name !== selectedShiftFilter) return

      const isTechStage = isTechnicalHistoryStage(h.stage_name)
      const rawOp = h.operator_name || 'Невідомий'
      const user = findSystemUser(rawOp, systemUsers)
      const isNonProd = isNonProductionEntity(rawOp, user, systemUsers)

      const qtyProduced = Number(h.qty_completed) || 0
      const qtyScrap = Number(h.scrap_qty) || 0

      // Skip non-manufacturing operations without scrap (warehouse bookings, completed markers, buffers, admin moves)
      if (qtyScrap <= 0 && (isTechStage || isNonProd)) return

      // Determine target operator:
      // If the row was an actual manufacturing operation by a production worker:
      // then targetOperator is rawOp.
      // If the row was recorded by QC / system / reason comment (e.g. 'ВКЯ...', 'Карпінець Тарас', 'Контроль ВКЯ'):
      // then we attribute the defect to the real manufacturing operator on that card.
      let targetOperator = rawOp
      let isAttributedQCScrap = false

      if (isNonProd || isTechStage) {
        targetOperator = resolveResponsibleOperator(h, cardOperatorsMap, workCardsMap, systemUsers)
        isAttributedQCScrap = true
      }

      const empStat = getOrCreateStat(targetOperator)

      // Only count produced quantity and operation count if this was an actual manufacturing operation
      if (!isAttributedQCScrap && !isTechStage && !isNonProd) {
        empStat.produced += qtyProduced
        empStat.operations += 1
      }

      empStat.scrap += qtyScrap

      // Determine scrap categories for this specific history entry
      let hCat1 = 0
      let hCat2 = 0
      let hCat3 = 0
      let hCat4 = 0

      const hid = String(h.id)
      const linkedClasses = classificationsByHistoryId.get(hid)

      if (linkedClasses && linkedClasses.length > 0) {
        linkedClasses.forEach(c => {
          if (c.id) processedClassificationIds.add(String(c.id))
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
        } else if (h.qc_scrap_reason) {
          scrapReason = h.qc_scrap_reason
        } else if (isAttributedQCScrap && rawOp.includes('Причина:')) {
          scrapReason = rawOp.split('Причина:')[1].trim()
        }
      }

      // Append detailed operation item
      empStat.history.push({
        id: h.id,
        date: h.completed_at || h.created_at,
        stage: isAttributedQCScrap ? `${h.stage_name || 'ВКЯ'} (виявлено)` : (h.stage_name || 'Операція'),
        shift: h.shift_name || empStat.shift,
        nomenclatureName: nom?.name || 'Невідома деталь',
        nomenclatureCode: nom?.code || null,
        orderNum,
        machine: h.machine_name || h.machine || '—',
        produced: isAttributedQCScrap ? 0 : qtyProduced,
        scrap: qtyScrap,
        rework: hRework,
        quarantine: hQuarantine,
        util: hUtil,
        reason: scrapReason
      })
    })

    // Include classifications whose original history row is outside the loaded range
    // or no longer available. The scrap tab already counts these events, so the
    // employee report must attribute the same quantity instead of silently losing it.
    const classificationOnlyEvents = buildClassificationOnlyEvents({
      classifications: scrapClassificationsList,
      historyRows: workCardHistory,
      processedClassificationIds,
      filterByDate,
      selectedShiftFilter
    })

    classificationOnlyEvents.forEach(event => {
      const c = event.sample
      const sourceOperator = String(c.source_operator_name || '').trim()
      let targetOperator = sourceOperator || 'Команда'
      const user = findSystemUser(sourceOperator, systemUsers)
      if (!sourceOperator || isNonProductionEntity(sourceOperator, user, systemUsers)) {
        targetOperator = resolveResponsibleOperator(c, cardOperatorsMap, workCardsMap, systemUsers)
      }

      const empStat = getOrCreateStat(targetOperator)
      const cRework = event.cat1 + event.cat2
      const cQuarantine = event.cat3 + event.unclassified
      const cUtil = event.cat4

      empStat.scrap += event.total
      empStat.cat1 += event.cat1
      empStat.cat2 += event.cat2
      empStat.cat3 += event.cat3
      empStat.cat4 += event.cat4
      empStat.unclassified += event.unclassified
      empStat.rework += cRework
      empStat.quarantine += cQuarantine
      empStat.util += cUtil

      const nom = c.nomenclature_id ? nomMap.get(String(c.nomenclature_id)) : null
      empStat.history.push({
        id: event.key,
        date: c.classified_at || c.created_at,
        stage: c.source_stage_name || 'Контроль ВКЯ (виявлено)',
        shift: '—',
        nomenclatureName: nom?.name || 'Невідома деталь',
        nomenclatureCode: nom?.code || null,
        orderNum: c.order_number || 'Класифікація ВКЯ без історії',
        machine: '—',
        produced: 0,
        scrap: event.total,
        rework: cRework,
        quarantine: cQuarantine,
        util: cUtil,
        reason: c.reason || c.comment || 'Класифікація ВКЯ'
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
    workCards,
    filterByDate,
    selectedShiftFilter,
    selectedEmployeeFilter,
    searchQuery
  ])

  return { employeeStats }
}
