import React, { useState, useEffect, useMemo } from 'react'
import { X, Stamp, CheckCircle2, ShieldCheck, CheckSquare, Square, FileCheck2, Clock, Layers } from 'lucide-react'
import { useStore } from '../../../../store/index.js'
import { supabase } from '../../../../supabase'
import { parseQcOpsStamps, stripQcOpsStamps } from '../../utils/shop1Helpers'

const STAMP_OPTIONS = ['ВКЯ 1', 'ВКЯ 2', 'ВКЯ 3', 'ВКЯ 4', 'ВКЯ 5', 'ВКЯ 6', 'ВКЯ 7', 'ВКЯ 8']

function resolveInspectorName(user, sysUsers = []) {
  if (!user) return ''
  const sysUser = (sysUsers || []).find(u =>
    (user.id && u.id === user.id) ||
    (user.login && u.login === user.login)
  )
  if (sysUser) {
    const formatted = [sysUser.last_name, sysUser.first_name].filter(Boolean).join(' ').trim()
    if (formatted) return formatted
    if (sysUser.name) return sysUser.name
  }
  const direct = [user.last_name, user.first_name].filter(Boolean).join(' ').trim()
  if (direct) return direct
  return user.name || user.username || user.login || ''
}

export function Shop1QCOpsModal({
  showQCOpsModal,
  onClose,
  currentCard,
  nomenclature,
  tasks = [],
  currentUser,
  systemUsers = [],
  workCards = [],
  setWorkCards,
  setSelectedCardHistory,
  fetchData,
  showAlert,
  isProcessing: externalProcessing,
  setIsProcessing: externalSetProcessing,
  onSaved
}) {
  const machineOperations = useStore(state => state.machineOperations) || []
  const machines = useStore(state => state.machines) || []
  const [localProcessing, setLocalProcessing] = useState(false)
  const isProcessing = externalProcessing ?? localProcessing
  const setIsProcessing = externalSetProcessing ?? setLocalProcessing

  const [localOpConfig, setLocalOpConfig] = useState(null)
  const [selectedStamp, setSelectedStamp] = useState(() => {
    try { return localStorage.getItem('centrum_vkya_stamp') || 'ВКЯ 1' } catch { return 'ВКЯ 1' }
  })
  const defaultInspector = useMemo(() => {
    return resolveInspectorName(currentUser, systemUsers)
  }, [currentUser, systemUsers])

  const [inspectorName, setInspectorName] = useState(() => {
    const autoResolved = resolveInspectorName(currentUser, systemUsers)
    if (autoResolved) return autoResolved
    try {
      const saved = localStorage.getItem('centrum_vkya_inspector')
      if (saved && saved.trim()) return saved.trim()
    } catch {}
    return ''
  })

  // Auto-fill or sync when currentUser/systemUsers becomes available
  useEffect(() => {
    if (defaultInspector && (!inspectorName || inspectorName === '—')) {
      setInspectorName(defaultInspector)
    }
  }, [defaultInspector])

  // Sync when logged in user changes
  useEffect(() => {
    if (defaultInspector) {
      setInspectorName(defaultInspector)
    }
  }, [currentUser?.id, currentUser?.login])

  // Persist valid inspector name
  useEffect(() => {
    if (inspectorName && inspectorName.trim().length >= 2) {
      try {
        localStorage.setItem('centrum_vkya_inspector', inspectorName.trim())
      } catch {}
    }
  }, [inspectorName])

  const [sheetsVerified, setSheetsVerified] = useState(false)
  const [sheetsStampInfo, setSheetsStampInfo] = useState(null)
  const [stampedOps, setStampedOps] = useState({})
  const [selectedSheet, setSelectedSheet] = useState('Лист 1, 2')
  const [activeSideTab, setActiveSideTab] = useState('all') // 'all', 'side1', 'side2', 'side2_cut'
  const [isHourlyConfirmed, setIsHourlyConfirmed] = useState(false)
  const [hourlyChecks, setHourlyChecks] = useState([])
  const [initialState, setInitialState] = useState(null)

  const totalSheetsCount = useMemo(() => {
    const matchSheets = String(currentCard?.card_info || '').match(/\[SHEETS:(\d+)\]/)
    return matchSheets ? Math.max(1, Number(matchSheets[1])) : Math.max(1, currentCard?.sheets_count || 1)
  }, [currentCard?.card_info, currentCard?.sheets_count])

  // Check if current machine is a small CNC (12x8 / 1200x800 / Малий / 1.)
  const isSmallMachine = useMemo(() => {
    const machineName = currentCard?.machine || ''
    const norm = machineName.toLowerCase().replace(/х/g, 'x')
    return (
      norm.includes('12x8') ||
      norm.includes('12*8') ||
      norm.includes('1200x800') ||
      norm.includes('1200') ||
      norm.includes('малий') ||
      norm.includes('1.')
    )
  }, [currentCard?.machine])

  // Опції листів для малого станка: Лист 1, 2; Лист 3, 4; Листи 1-N (всі)
  const smallMachineSheetOptions = useMemo(() => {
    if (totalSheetsCount <= 2) {
      return ['Лист 1, 2', 'Всі листи']
    }
    const opts = []
    for (let i = 1; i <= totalSheetsCount; i += 2) {
      if (i + 1 <= totalSheetsCount) {
        opts.push(`Лист ${i}, ${i + 1}`)
      } else {
        opts.push(`Лист ${i}`)
      }
    }
    opts.push(`Листи 1-${totalSheetsCount} (всі)`)
    return opts
  }, [totalSheetsCount])

  const isAllSheetsSelected = Boolean(
    !isSmallMachine ||
    selectedSheet.includes('(всі)') ||
    selectedSheet.includes('Всі') ||
    selectedSheet === 'all-cut'
  )

  // Auto-switch tabs when switching sheet options on small machine:
  // - Лист 1, 2 або Лист 3, 4 -> тільки 1 та 2 сторона (не вирізка)
  // - Листи 1-N (всі) -> тільки 2 сторона вирізка
  useEffect(() => {
    if (!isSmallMachine) return
    if (isAllSheetsSelected) {
      setActiveSideTab('side2_cut')
    } else {
      if (activeSideTab === 'side2_cut') {
        setActiveSideTab('all')
      }
    }
  }, [selectedSheet, isSmallMachine, isAllSheetsSelected])

  // Lock body scroll and prevent background scroll bleeding on mobile touch
  useEffect(() => {
    if (!showQCOpsModal) return
    const prevOverflow = document.body.style.overflow
    const prevOverscroll = document.body.style.overscrollBehavior
    const prevTouchAction = document.body.style.touchAction
    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'none'
    document.body.style.touchAction = 'pan-y'
    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.overscrollBehavior = prevOverscroll
      document.body.style.touchAction = prevTouchAction
    }
  }, [showQCOpsModal])

  const parentTask = useMemo(
    () => (tasks || []).find(t => String(t.id) === String(currentCard?.task_id)),
    [tasks, currentCard?.task_id]
  )

  const snapshotPart = useMemo(
    () => parentTask?.plan_snapshot?.[String(currentCard?.nomenclature_id)] || null,
    [parentTask, currentCard?.nomenclature_id]
  )

  const isCutter1_5 = snapshotPart?.cutter_override === '1.5'

  // Resolve operation configuration for this card and machine
  const opConfig = useMemo(() => {
    if (!currentCard?.nomenclature_id) return null
    const nomId = String(currentCard.nomenclature_id)
    const macName = currentCard.machine || ''
    const macId = currentCard.machine_id
    const macObj = machines.find(m => m.name === macName || (macId && String(m.id) === String(macId)))

    const exact = machineOperations.find(o =>
      String(o.nomenclature_id) === nomId &&
      (
        (macId && String(o.machine_id) === String(macId)) ||
        (macObj && String(o.machine_id) === String(macObj.id)) ||
        (macName && o.machine_type === macName)
      )
    )
    if (exact) return exact

    const normMac = macName.toLowerCase().replace(/х/g, 'x')
    const matchType = machineOperations.find(o => {
      if (String(o.nomenclature_id) !== nomId) return false
      const typeLower = (o.machine_type || '').toLowerCase().replace(/х/g, 'x')
      if (isSmallMachine && (typeLower.includes('1200') || typeLower.includes('12x8') || typeLower.includes('малий'))) return true
      if (normMac.includes('3050') && typeLower.includes('3050')) return true
      if (normMac.includes('3060') && typeLower.includes('3060')) return true
      if (normMac.includes('6000') && (typeLower.includes('6000') || typeLower.includes('дракон'))) return true
      if (normMac.includes('ke xin') && (typeLower.includes('ke xin') || typeLower.includes('фея'))) return true
      return false
    })
    if (matchType) return matchType

    return machineOperations.find(o => String(o.nomenclature_id) === nomId) || null
  }, [currentCard?.nomenclature_id, currentCard?.machine, currentCard?.machine_id, machineOperations, machines, isSmallMachine])

  useEffect(() => {
    if (showQCOpsModal && currentCard?.nomenclature_id && (!opConfig || machineOperations.length === 0)) {
      supabase
        .from('machine_operations')
        .select('*')
        .eq('nomenclature_id', currentCard.nomenclature_id)
        .then(({ data }) => {
          if (data && data.length > 0) {
            const found = data.find(d => {
              const t = (d.machine_type || '').toLowerCase().replace(/х/g, 'x')
              return isSmallMachine ? (t.includes('1200') || t.includes('12x8') || t.includes('малий')) : true
            }) || data[0]
            setLocalOpConfig(found)
          }
        })
        .catch(console.error)
    }
  }, [showQCOpsModal, currentCard?.nomenclature_id, opConfig, machineOperations.length, isSmallMachine])

  const activeConfig = opConfig || localOpConfig

  // Build formatted operations lists matching printed card
  const { s1Ops, s2Ops, s2CutOps, allItems } = useMemo(() => {
    const rawS1 = (activeConfig?.side1_ops || []).filter(op => !op.startsWith('__CUTTER__:') && !op.startsWith('__CUTTER__Reference:'))
    const rawS2 = (activeConfig?.side2_ops || []).filter(op => !op.startsWith('__CUTTER__:') && !op.startsWith('__CUTTER__Reference:'))
    const rawS2Cut = (activeConfig?.side2_cut_ops || []).filter(op => !op.startsWith('__CUTTER__:') && !op.startsWith('__CUTTER__Reference:'))

    const formatSideOp = (op) => {
      if (!op) return ''
      if (isCutter1_5) {
        if (op.includes('|')) return op.split('|')[1].trim()
        return op.replace(/[фФ]2(?![0-9.])/g, m => m[0] === 'ф' ? 'ф1.5' : 'Ф1.5').trim()
      }
      if (op.includes('|')) return op.split('|')[0].trim()
      return op.trim()
    }

    const formatCutOp = (op) => {
      if (!op) return ''
      if (isCutter1_5) {
        if (op.includes('|')) return op.split('|')[1].trim()
        return op.replace(/[фФ]2(?![0-9.])/g, m => m[0] === 'ф' ? 'ф1.5' : 'Ф1.5').trim()
      }
      if (op.includes('|')) return op.split('|')[0].trim()
      return op.replace(/[фФ]1\.5(?![0-9.])/g, m => m[0] === 'ф' ? 'ф2' : 'Ф2').trim()
    }

    const s1 = rawS1.map(formatSideOp).filter(Boolean)
    const s2 = rawS2.map(formatSideOp).filter(Boolean)
    const s2c = rawS2Cut.map(formatCutOp).filter(Boolean)

    const items = [
      ...s1.map((name, idx) => ({ key: `s1:${idx}`, side: '1 сторона', name, idx })),
      ...s2.map((name, idx) => ({ key: `s2:${idx}`, side: '2 сторона', name, idx })),
      ...s2c.map((name, idx) => ({ key: `s2c:${idx}`, side: `2 сторона вирізка (${isCutter1_5 ? 'Ф1.5мм' : 'Ф2мм'})`, name, idx }))
    ]

    return { s1Ops: s1, s2Ops: s2, s2CutOps: s2c, allItems: items }
  }, [activeConfig, isCutter1_5])

  // Filter visible items based on selected sheet for small machine:
  // - Лист 1, 2 або Лист 3, 4: ТІЛЬКИ 1 та 2 сторона (вирізка недоступна!)
  // - Листи 1-N (всі): ТІЛЬКИ 2 сторона вирізка!
  const availableItems = useMemo(() => {
    if (!isSmallMachine) return allItems
    if (isAllSheetsSelected) {
      return allItems.filter(i => i.key.startsWith('s2c:'))
    }
    return allItems.filter(i => i.key.startsWith('s1:') || i.key.startsWith('s2:'))
  }, [allItems, isSmallMachine, isAllSheetsSelected])

  const qcStaffList = useMemo(() => {
    const list = (systemUsers || []).filter(u =>
      u?.access_rights?.brak ||
      (u?.position && (u.position.toLowerCase().includes('вкя') || u.position.toLowerCase().includes('якост') || u.position.toLowerCase().includes('контрол')))
    ).map(u => [u.last_name, u.first_name].filter(Boolean).join(' ').trim() || u.login).filter(Boolean)
    return Array.from(new Set(list))
  }, [systemUsers])

  // Hydrate existing stamps when modal opens
  useEffect(() => {
    if (!showQCOpsModal || !currentCard) return
    const parsed = parseQcOpsStamps(currentCard.card_info)
    const existingOps = parsed?.ops || {}
    const existingSheetsVerified = Boolean(parsed?.sheets?.verified)
    const existingSheetsStampInfo = parsed?.sheets || null
    const existingChecks = Array.isArray(parsed?.checks) ? parsed.checks : []

    setSheetsVerified(existingSheetsVerified)
    setSheetsStampInfo(existingSheetsStampInfo)
    setStampedOps(existingOps)
    setHourlyChecks(existingChecks)
    setIsHourlyConfirmed(false)
    setActiveSideTab('all')

    if (parsed) {
      if (parsed.lastStamp) setSelectedStamp(parsed.lastStamp)
      if (parsed.lastInspector) setInspectorName(parsed.lastInspector)
      if (parsed.lastHourlyCheck?.sheetText && isSmallMachine) {
        setSelectedSheet(parsed.lastHourlyCheck.sheetText)
      } else {
        setSelectedSheet(smallMachineSheetOptions[0] || 'Лист 1, 2')
      }
    } else {
      setSheetsVerified(false)
      setSheetsStampInfo(null)
      setStampedOps({})
      setSelectedSheet(smallMachineSheetOptions[0] || 'Лист 1, 2')
    }

    setInitialState({
      ops: existingOps,
      sheetsVerified: existingSheetsVerified,
      checksCount: existingChecks.length,
      updatedAt: parsed?.updatedAt || null
    })

    if (!parsed?.lastInspector) {
      const savedInspector = (() => {
        try { return localStorage.getItem('centrum_vkya_inspector') || '' } catch { return '' }
      })()
      const isGenericAdmin = currentUser?.login === 'admin' || /system\s*admin/i.test(`${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`)
      const currentFullName = isGenericAdmin
        ? ''
        : ([currentUser?.last_name, currentUser?.first_name].filter(Boolean).join(' ').trim() || '')
      setInspectorName(savedInspector || currentFullName)
    }
  }, [showQCOpsModal, currentCard?.id, isSmallMachine, smallMachineSheetOptions])

  // Current sheet key on small machine: '1-2' or '3-4' or 'all'
  const currentSheetKey = useMemo(() => {
    if (!isSmallMachine || isAllSheetsSelected) return 'all'
    if (selectedSheet && selectedSheet.includes('1') && selectedSheet.includes('2')) return '1-2'
    if (selectedSheet && selectedSheet.includes('3') && selectedSheet.includes('4')) return '3-4'
    return selectedSheet
  }, [isSmallMachine, isAllSheetsSelected, selectedSheet])

  // Guard: check if any stamps, sheets status or hourly confirm changed
  const hasChanges = useMemo(() => {
    if (!initialState) return false
    if (JSON.stringify(stampedOps) !== JSON.stringify(initialState.ops)) return true
    if (sheetsVerified !== initialState.sheetsVerified) return true
    if (isHourlyConfirmed) return true
    return false
  }, [stampedOps, sheetsVerified, isHourlyConfirmed, initialState])

  if (!showQCOpsModal || !currentCard) return null

  const nowTimeShort = () => {
    const d = new Date()
    return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) + ' ' +
      d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })
  }

  const isInspectorValid = Boolean(inspectorName && inspectorName.trim().length >= 2)

  const toggleOpStamp = (item) => {
    if (!isInspectorValid) return
    const stampTime = nowTimeShort()
    const cleanStamp = selectedStamp || 'ВКЯ 1'
    const cleanInspector = inspectorName.trim()

    setStampedOps(prev => {
      const next = { ...prev }
      const prevOp = prev[item.key] || { name: item.name, side: item.side }

      // 1. On small machine for side 1 or side 2: specific sheet pair (1-2 or 3-4)
      if (isSmallMachine && (item.key.startsWith('s1:') || item.key.startsWith('s2:')) && !isAllSheetsSelected) {
        const isSheet1_2 = currentSheetKey === '1-2'
        const hasThisSheet = isSheet1_2 ? Boolean(prevOp.sheet1_2) : Boolean(prevOp.sheet3_4)

        if (hasThisSheet) {
          // Uncheck this specific sheet pair
          const updated = { ...prevOp }
          if (isSheet1_2) delete updated.sheet1_2
          else delete updated.sheet3_4

          if (!updated.sheet1_2 && !updated.sheet3_4 && !updated.allSheets) {
            delete next[item.key]
            return next
          }
          next[item.key] = updated
          return next
        }

        // Check this specific sheet pair
        const sheetStampData = { stamp: cleanStamp, inspector: cleanInspector, at: stampTime }
        next[item.key] = {
          ...prevOp,
          stamp: cleanStamp,
          inspector: cleanInspector,
          name: item.name,
          side: item.side,
          at: stampTime,
          ...(isSheet1_2 ? { sheet1_2: sheetStampData } : { sheet3_4: sheetStampData })
        }
        return next
      }

      // 2. Cut-out operation (2 ст. вирізка) or non-small machines: single common stamp
      if (prev[item.key]) {
        delete next[item.key]
      } else {
        next[item.key] = {
          stamp: cleanStamp,
          inspector: cleanInspector,
          name: item.name,
          side: item.side,
          at: stampTime,
          allSheets: true
        }
      }
      return next
    })
  }

  const toggleSheetsVerified = () => {
    if (!isInspectorValid) return
    setSheetsVerified(prev => {
      const next = !prev
      if (next) {
        setSheetsStampInfo({
          verified: true,
          stamp: selectedStamp || 'ВКЯ 1',
          inspector: inspectorName.trim(),
          at: nowTimeShort()
        })
      } else {
        setSheetsStampInfo(null)
      }
      return next
    })
  }

  const handleStampAll = () => {
    if (!isInspectorValid) return
    const stampTime = nowTimeShort()
    const cleanStamp = selectedStamp || 'ВКЯ 1'
    const cleanInspector = inspectorName.trim()
    const nextOps = { ...stampedOps }

    const itemsToStamp = activeSideTab === 'all'
      ? availableItems
      : availableItems.filter(i => {
          if (activeSideTab === 'side1') return i.key.startsWith('s1:')
          if (activeSideTab === 'side2') return i.key.startsWith('s2:')
          if (activeSideTab === 'side2_cut') return i.key.startsWith('s2c:')
          return true
        })

    const isSheet1_2 = currentSheetKey === '1-2'
    const isSheet3_4 = currentSheetKey === '3-4'
    const sheetStampData = { stamp: cleanStamp, inspector: cleanInspector, at: stampTime }

    itemsToStamp.forEach(item => {
      const prevOp = nextOps[item.key] || { name: item.name, side: item.side }
      if (isSmallMachine && (item.key.startsWith('s1:') || item.key.startsWith('s2:')) && !isAllSheetsSelected) {
        nextOps[item.key] = {
          ...prevOp,
          stamp: cleanStamp,
          inspector: cleanInspector,
          name: item.name,
          side: item.side,
          at: stampTime,
          ...(isSheet1_2 ? { sheet1_2: sheetStampData } : isSheet3_4 ? { sheet3_4: sheetStampData } : {})
        }
      } else {
        nextOps[item.key] = {
          ...prevOp,
          stamp: cleanStamp,
          inspector: cleanInspector,
          name: item.name,
          side: item.side,
          at: stampTime,
          allSheets: true
        }
      }
    })

    setStampedOps(nextOps)
    if (!sheetsVerified) {
      setSheetsVerified(true)
      setSheetsStampInfo({
        verified: true,
        stamp: cleanStamp,
        inspector: cleanInspector,
        at: stampTime
      })
    }
  }

  const handleClearAll = () => {
    setStampedOps({})
    setSheetsVerified(false)
    setSheetsStampInfo(null)
    setIsHourlyConfirmed(false)
  }

  const handleSaveStamps = async () => {
    if (isProcessing) return
    if (!isInspectorValid) {
      alert('Будь ласка, спочатку оберіть або введіть ПІБ контролера ВКЯ, який ставить печатки!')
      return
    }
    if (!hasChanges) {
      alert('Змін не виявлено! Для оновлення перевірки погодьте нову операцію або відповідність листів.')
      return
    }
    setIsProcessing(true)
    try {
      const cleanInspector = inspectorName.trim()
      const cleanStamp = selectedStamp || 'ВКЯ 1'
      try {
        localStorage.setItem('centrum_vkya_stamp', cleanStamp)
        localStorage.setItem('centrum_vkya_inspector', cleanInspector)
      } catch { /* ignore */ }

      const stampTime = nowTimeShort()
      const currentSheetText = isSmallMachine ? selectedSheet : `Листи 1-${totalSheetsCount}`
      const totalOpsStamped = Object.keys(stampedOps).length

      const latestCheck = {
        id: Date.now(),
        time: stampTime,
        inspector: cleanInspector,
        stamp: cleanStamp,
        sheetText: currentSheetText,
        statusText: `погоджено (${currentSheetText})`
      }

      const allChecksList = [latestCheck, ...hourlyChecks.filter(c => c.time !== stampTime)].slice(0, 30)

      const qcPayload = {
        lastStamp: cleanStamp,
        lastInspector: cleanInspector,
        updatedAt: new Date().toISOString(),
        sheets: (sheetsVerified || sheetsStampInfo) ? {
          verified: sheetsVerified,
          stamp: cleanStamp,
          inspector: cleanInspector,
          at: sheetsStampInfo?.at || stampTime
        } : null,
        ops: stampedOps,
        checks: allChecksList,
        lastHourlyCheck: latestCheck
      }

      const baseInfo = stripQcOpsStamps(currentCard.card_info || '')
      const hasAnyVerification = sheetsVerified || totalOpsStamped > 0
      const updatedCardInfo = hasAnyVerification
        ? `${baseInfo} [QC_OPS:${JSON.stringify(qcPayload)}]`.trim()
        : baseInfo

      const summaryParts = []
      if (sheetsVerified) summaryParts.push('Листи відповідають ✓')
      if (isSmallMachine) summaryParts.push(currentSheetText)

      // Count operations per sheet category
      let s1_2Count = 0
      let s3_4Count = 0
      let cutCount = 0
      Object.values(stampedOps).forEach(op => {
        if (op.sheet1_2) s1_2Count++
        if (op.sheet3_4) s3_4Count++
        if (op.allSheets || op.side?.includes('вирізка')) cutCount++
      })
      if (isSmallMachine) {
        if (s1_2Count > 0) summaryParts.push(`Лист 1,2 (${s1_2Count} оп.)`)
        if (s3_4Count > 0) summaryParts.push(`Лист 3,4 (${s3_4Count} оп.)`)
        if (cutCount > 0) summaryParts.push(`Вирізка (${cutCount} оп.)`)
      } else if (totalOpsStamped > 0) {
        summaryParts.push(`Погоджено: ${totalOpsStamped}/${allItems.length}`)
      }
      const summaryComment = summaryParts.join(' | ') || 'Відмітки ВКЯ оновлено'

      const nowIso = new Date().toISOString()

      const { error: cardErr } = await supabase
        .from('work_cards')
        .update({ card_info: updatedCardInfo })
        .eq('id', currentCard.id)

      if (cardErr) throw cardErr

      const historyEntry = {
        card_id: currentCard.id,
        nomenclature_id: currentCard.nomenclature_id,
        stage_name: 'Печатка ВКЯ (Операції)',
        operator_name: `${cleanStamp} · ${cleanInspector}`,
        qty_at_start: currentCard.quantity || 0,
        qty_completed: currentCard.quantity || 0,
        scrap_qty: 0,
        started_at: nowIso,
        completed_at: nowIso,
        shift_name: currentCard.shift_name || null,
        manager_name: currentCard.manager_name || null,
        machine_name: currentCard.machine || null,
        qc_scrap_comment: summaryComment,
        card_info: updatedCardInfo
      }

      const { data: insertedHistory } = await supabase
        .from('work_card_history')
        .insert([historyEntry])
        .select('*')

      if (typeof setWorkCards === 'function') {
        setWorkCards(prev => (prev || []).map(c => c.id === currentCard.id ? { ...c, card_info: updatedCardInfo } : c))
      }
      if (typeof setSelectedCardHistory === 'function' && insertedHistory?.[0]) {
        setSelectedCardHistory(prev => [...(prev || []), insertedHistory[0]])
      }
      if (typeof fetchData === 'function') {
        fetchData(['work_cards', 'work_card_history']).catch(() => {})
      }
      if (typeof onSaved === 'function') {
        onSaved({ ...currentCard, card_info: updatedCardInfo })
      }

      onClose()
      if (typeof showAlert === 'function') {
        showAlert(
          `Печатку ${cleanStamp} (${cleanInspector}) збережено!\n${isSmallMachine ? `${currentSheetText} · ` : ''}Погоджено операцій: ${totalOpsStamped}`,
          '💮 Перевірка ВКЯ збережена'
        )
      }
    } catch (err) {
      alert('Помилка збереження печатки ВКЯ: ' + (err?.message || err))
    } finally {
      setIsProcessing(false)
    }
  }

  const materialLabel = snapshotPart?.raw_material_name || nomenclature?.rule_params?.rawSheet || nomenclature?.material_type || 'Лист за техпроцесом'

  // Determine if an operation is stamped for the current sheet context
  const isItemCheckedForCurrentSheet = (item) => {
    const stampData = stampedOps[item.key]
    if (!stampData) return false
    if (!isSmallMachine || isAllSheetsSelected || item.key.startsWith('s2c:')) {
      return Boolean(stampData.allSheets || stampData.stamp)
    }
    if (currentSheetKey === '1-2') {
      return Boolean(stampData.sheet1_2 || stampData.allSheets)
    }
    if (currentSheetKey === '3-4') {
      return Boolean(stampData.sheet3_4 || stampData.allSheets)
    }
    return Boolean(stampData)
  }

  const currentSheetStampedCount = availableItems.filter(isItemCheckedForCurrentSheet).length
  const totalAvailableCount = availableItems.length

  const renderSection = (title, items) => {
    if (!items || items.length === 0) return null
    const sectionApprovedCount = items.filter(isItemCheckedForCurrentSheet).length
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{
          fontSize: '0.72rem',
          fontWeight: 950,
          color: '#10b981',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          padding: '7px 12px',
          background: 'rgba(16, 185, 129, 0.08)',
          borderRadius: '10px',
          borderLeft: '3.5px solid #10b981',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{title}</span>
          <span style={{ fontSize: '0.68rem', fontWeight: 900, color: sectionApprovedCount === items.length ? '#10b981' : 'var(--text-dim)' }}>
            {sectionApprovedCount} / {items.length}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map(item => {
            const stampData = stampedOps[item.key]
            const isChecked = isItemCheckedForCurrentSheet(item)
            const isSheet1_2 = Boolean(stampData?.sheet1_2)
            const isSheet3_4 = Boolean(stampData?.sheet3_4)
            const activeStampObj = currentSheetKey === '1-2' ? stampData?.sheet1_2 : currentSheetKey === '3-4' ? stampData?.sheet3_4 : stampData

            return (
              <div
                key={item.key}
                onClick={() => toggleOpStamp(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '14px',
                  cursor: isInspectorValid ? 'pointer' : 'not-allowed',
                  opacity: isInspectorValid ? 1 : 0.55,
                  background: isChecked ? 'rgba(16, 185, 129, 0.12)' : 'var(--surface-inset)',
                  border: isChecked ? '1.5px solid rgba(16, 185, 129, 0.5)' : '1px solid var(--border-subtle)',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                  {isChecked ? (
                    <CheckSquare size={22} color="#10b981" style={{ flexShrink: 0 }} />
                  ) : (
                    <Square size={22} color="#64748b" style={{ flexShrink: 0 }} />
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontSize: '0.92rem',
                      fontWeight: 900,
                      color: isChecked ? 'var(--text-strong)' : 'var(--text-muted, #94a3b8)',
                      lineHeight: 1.3,
                      wordBreak: 'break-word'
                    }}>
                      {item.name}
                    </div>

                    {/* Позначки для малого станка: окремо статус для Лист 1, 2 та Лист 3, 4 як у карті */}
                    {isSmallMachine && (item.key.startsWith('s1:') || item.key.startsWith('s2:')) ? (
                      <div style={{ display: 'flex', gap: '6px', marginTop: '5px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '0.64rem',
                          fontWeight: 900,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: isSheet1_2 ? 'rgba(16, 185, 129, 0.2)' : 'var(--surface-2)',
                          color: isSheet1_2 ? '#10b981' : 'var(--text-dim)',
                          border: isSheet1_2 ? '1px solid #10b981' : '1px solid var(--border-subtle)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          Лист 1, 2: <strong>{isSheet1_2 ? `☑ ${stampData?.sheet1_2?.stamp || ''}` : '☐'}</strong>
                        </span>
                        <span style={{
                          fontSize: '0.64rem',
                          fontWeight: 900,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: isSheet3_4 ? 'rgba(16, 185, 129, 0.2)' : 'var(--surface-2)',
                          color: isSheet3_4 ? '#10b981' : 'var(--text-dim)',
                          border: isSheet3_4 ? '1px solid #10b981' : '1px solid var(--border-subtle)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          Лист 3, 4: <strong>{isSheet3_4 ? `☑ ${stampData?.sheet3_4?.stamp || ''}` : '☐'}</strong>
                        </span>
                      </div>
                    ) : (
                      isChecked && activeStampObj && (
                        <div style={{ fontSize: '0.66rem', color: '#10b981', fontWeight: 800, marginTop: '3px' }}>
                          ✓ {activeStampObj.inspector} · {activeStampObj.at}
                        </div>
                      )
                    )}
                  </div>
                </div>

                {isChecked ? (
                  <div style={{
                    flexShrink: 0,
                    border: '2px double #10b981',
                    color: '#10b981',
                    background: 'rgba(16, 185, 129, 0.15)',
                    borderRadius: '999px',
                    padding: '4px 12px',
                    fontSize: '0.74rem',
                    fontWeight: 1000,
                    letterSpacing: '0.06em',
                    transform: 'rotate(-4deg)',
                    boxShadow: '0 0 0 1px rgba(16,185,129,0.2)',
                    textTransform: 'uppercase'
                  }}>
                    💮 {activeStampObj?.stamp || stampData?.stamp || selectedStamp}
                  </div>
                ) : (
                  <div style={{
                    flexShrink: 0,
                    border: '1px dashed var(--border-subtle, #475569)',
                    color: 'var(--text-dim, #64748b)',
                    borderRadius: '999px',
                    padding: '4px 10px',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    whiteSpace: 'nowrap'
                  }}>
                    + {selectedStamp}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100dvh',
        background: 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100100,
        padding: '12px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        overscrollBehavior: 'contain',
        touchAction: 'pan-y'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) {
          onClose()
        }
      }}
    >
      <div
        style={{
          background: 'var(--surface-1)',
          width: '100%',
          maxWidth: '700px',
          maxHeight: 'calc(100dvh - 24px)',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '24px',
          border: '1.5px solid rgba(16, 185, 129, 0.4)',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.65), 0 0 32px rgba(16, 185, 129, 0.15)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '14px 18px',
          background: 'var(--surface-2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(16, 185, 129, 0.25)',
          gap: '10px',
          flexShrink: 0
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 950, color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px', lineHeight: 1.2 }}>
              <Stamp size={20} style={{ flexShrink: 0 }} />
              <span style={{ wordBreak: 'break-word' }}>ПЕЧАТКА ВКЯ · ПОГОДЖЕННЯ ОПЕРАЦІЙ</span>
            </h3>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '4px', fontWeight: 700, wordBreak: 'break-word' }}>
              Картка #{String(currentCard.id).slice(-8).toUpperCase()} · {nomenclature?.name || 'Деталь'} · {currentCard.machine || 'Верстат'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '6px', flexShrink: 0, borderRadius: '8px' }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Modal Body - Single clean smooth scrollable view without tiny nested sub-scrolls */}
        <div style={{
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          overflowY: 'auto',
          flex: 1,
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch'
        }}>
          {/* Вибір номера печатки ВКЯ та ПІБ інспектора */}
          <div style={{
            background: 'var(--surface-inset)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '16px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div>
              <label style={{ fontSize: '0.62rem', fontWeight: 900, color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '7px' }}>
                Номер печатки ВКЯ
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {STAMP_OPTIONS.map(stamp => {
                  const active = selectedStamp === stamp
                  return (
                    <button
                      key={stamp}
                      type="button"
                      onClick={() => setSelectedStamp(stamp)}
                      style={{
                        background: active ? '#10b981' : 'var(--surface-2)',
                        color: active ? '#000' : 'var(--text-strong)',
                        border: active ? '1.5px solid #10b981' : '1px solid var(--border-subtle)',
                        borderRadius: '999px',
                        padding: '6px 12px',
                        fontSize: '0.74rem',
                        fontWeight: 950,
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      💮 {stamp}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.62rem', fontWeight: 900, color: !isInspectorValid ? '#ef4444' : 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                ПІБ контролера ВКЯ <span style={{ color: '#ef4444' }}>* (обов'язково)</span>
              </label>
              <input
                type="text"
                list="qc-inspectors-datalist"
                placeholder="Спочатку оберіть або введіть ПІБ інспектора ВКЯ..."
                value={inspectorName}
                onChange={e => setInspectorName(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--surface-2)',
                  border: !isInspectorValid ? '1.5px solid #ef4444' : '1px solid var(--border-subtle)',
                  color: 'var(--text-strong)',
                  padding: '11px 13px',
                  borderRadius: '11px',
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  boxSizing: 'border-box'
                }}
              />
              {!isInspectorValid && (
                <div style={{ fontSize: '0.68rem', color: '#ef4444', fontWeight: 800, marginTop: '5px' }}>
                  ⚠️ Спочатку вкажіть ПІБ працівника ВКЯ, щоб розблокувати проставлення печаток
                </div>
              )}
              <datalist id="qc-inspectors-datalist">
                {qcStaffList.map(name => <option key={name} value={name} />)}
              </datalist>
            </div>
          </div>

          {/* Блок «Листи відповідають» як у шапці друкованої картки */}
          <div
            onClick={toggleSheetsVerified}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '12px 16px',
              borderRadius: '14px',
              cursor: isInspectorValid ? 'pointer' : 'not-allowed',
              opacity: isInspectorValid ? 1 : 0.55,
              background: sheetsVerified ? 'rgba(16, 185, 129, 0.12)' : 'var(--surface-inset)',
              border: sheetsVerified ? '1.5px solid #10b981' : '1.5px dashed var(--border-subtle)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {sheetsVerified ? <CheckSquare size={21} color="#10b981" /> : <Square size={21} color="#64748b" />}
              <div>
                <div style={{ fontSize: '0.84rem', fontWeight: 950, color: 'var(--text-strong)' }}>
                  Листи відповідають: <span style={{ color: '#10b981' }}>{materialLabel}</span>
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontWeight: 700, marginTop: '2px' }}>
                  {sheetsVerified && sheetsStampInfo
                    ? `Підтверджено: ${sheetsStampInfo.stamp} · ${sheetsStampInfo.inspector} (${sheetsStampInfo.at})`
                    : 'Натисніть для підтвердження відповідності товщини та марки листа'}
                </div>
              </div>
            </div>
            {sheetsVerified && (
              <div style={{
                border: '2px double #10b981',
                color: '#10b981',
                borderRadius: '999px',
                padding: '3px 10px',
                fontSize: '0.7rem',
                fontWeight: 1000,
                transform: 'rotate(-4deg)'
              }}>
                {sheetsStampInfo?.stamp || selectedStamp}
              </div>
            )}
          </div>

          {/* Вибір листів для малого станка (ТІЛЬКИ для малого станка, інші станки зразу всі листи) */}
          {isSmallMachine && (
            <div style={{
              background: 'rgba(245, 158, 11, 0.05)',
              border: '1.5px solid rgba(245, 158, 11, 0.25)',
              borderRadius: '16px',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.85rem' }}>📍</span>
                  <span style={{ fontSize: '0.68rem', color: '#f59e0b', fontWeight: 950, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Листи розкрою (малий станок 12×8)
                  </span>
                </div>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', fontWeight: 800 }}>
                  Всього в наряді: {totalSheetsCount} лист.
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {smallMachineSheetOptions.map(sheet => {
                  const isSel = selectedSheet === sheet
                  const isAllCut = sheet.includes('(всі)') || sheet.includes('Всі')
                  return (
                    <button
                      key={sheet}
                      type="button"
                      onClick={() => setSelectedSheet(sheet)}
                      style={{
                        padding: '9px 16px',
                        borderRadius: '12px',
                        fontSize: '0.84rem',
                        fontWeight: 950,
                        cursor: 'pointer',
                        background: isSel ? '#f59e0b' : 'var(--surface-2)',
                        color: isSel ? '#000' : 'var(--text-strong)',
                        border: isSel ? '1.5px solid #f59e0b' : '1px solid var(--border-subtle)',
                        transition: 'all 0.15s ease',
                        boxShadow: isSel ? '0 2px 8px rgba(245, 158, 11, 0.3)' : 'none'
                      }}
                    >
                      {sheet} {isAllCut ? '✂️' : ''}
                    </button>
                  )
                })}
              </div>
              <div style={{ fontSize: '0.64rem', color: '#f59e0b', fontWeight: 700 }}>
                {isAllSheetsSelected
                  ? '✂️ Для всіх листів доступна операція «2 сторона вирізка»'
                  : `Для ${selectedSheet} доступні операції 1-ї та 2-ї сторони`}
              </div>
            </div>
          )}

          {/* Таби сторін: адаптуються під вибрані листи */}
          {availableItems.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
              {!isAllSheetsSelected && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveSideTab('all')}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '10px',
                      fontSize: '0.74rem',
                      fontWeight: 900,
                      cursor: 'pointer',
                      background: activeSideTab === 'all' ? '#10b981' : 'var(--surface-2)',
                      color: activeSideTab === 'all' ? '#000' : 'var(--text-strong)',
                      border: activeSideTab === 'all' ? '1px solid #10b981' : '1px solid var(--border-subtle)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Усі ({availableItems.length})
                  </button>
                  {s1Ops.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveSideTab('side1')}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '10px',
                        fontSize: '0.74rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        background: activeSideTab === 'side1' ? '#10b981' : 'var(--surface-2)',
                        color: activeSideTab === 'side1' ? '#000' : 'var(--text-strong)',
                        border: activeSideTab === 'side1' ? '1px solid #10b981' : '1px solid var(--border-subtle)',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      1 сторона ({s1Ops.length})
                    </button>
                  )}
                  {s2Ops.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveSideTab('side2')}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '10px',
                        fontSize: '0.74rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        background: activeSideTab === 'side2' ? '#10b981' : 'var(--surface-2)',
                        color: activeSideTab === 'side2' ? '#000' : 'var(--text-strong)',
                        border: activeSideTab === 'side2' ? '1px solid #10b981' : '1px solid var(--border-subtle)',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      2 сторона ({s2Ops.length})
                    </button>
                  )}
                </>
              )}
              {isAllSheetsSelected && s2CutOps.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveSideTab('side2_cut')}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '10px',
                    fontSize: '0.74rem',
                    fontWeight: 900,
                    cursor: 'pointer',
                    background: '#10b981',
                    color: '#000',
                    border: '1px solid #10b981',
                    whiteSpace: 'nowrap'
                  }}
                >
                  2 ст. вирізка (всі листи: {s2CutOps.length})
                </button>
              )}
            </div>
          )}

          {/* Швидкі дії */}
          {availableItems.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 900, color: 'var(--text-dim)' }}>
                Погоджено ({isSmallMachine ? selectedSheet : 'Всі'}):{' '}
                <strong style={{ color: '#10b981' }}>{currentSheetStampedCount}</strong> з <strong>{totalAvailableCount}</strong>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleStampAll}
                  disabled={!isInspectorValid}
                  style={{
                    background: 'rgba(16, 185, 129, 0.14)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    color: '#10b981',
                    padding: '6px 12px',
                    borderRadius: '9px',
                    fontSize: '0.74rem',
                    fontWeight: 900,
                    cursor: isInspectorValid ? 'pointer' : 'not-allowed',
                    opacity: isInspectorValid ? 1 : 0.45
                  }}
                >
                  ✓ Погодити для {isSmallMachine ? selectedSheet : 'всіх листів'}
                </button>
                {currentSheetStampedCount > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#ef4444',
                      padding: '6px 10px',
                      borderRadius: '9px',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    Очистити
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Таблиця доступних операцій */}
          {availableItems.length === 0 ? (
            <div style={{
              padding: '24px',
              textAlign: 'center',
              background: 'var(--surface-inset)',
              borderRadius: '14px',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-dim)',
              fontSize: '0.84rem',
              fontWeight: 700
            }}>
              Для обраного етапу немає запланованих операцій у карті.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {!isAllSheetsSelected && (activeSideTab === 'all' || activeSideTab === 'side1') &&
                renderSection('Операція (1 сторона)', availableItems.filter(i => i.key.startsWith('s1:')))}
              {!isAllSheetsSelected && (activeSideTab === 'all' || activeSideTab === 'side2') &&
                renderSection('Операція (2 сторона)', availableItems.filter(i => i.key.startsWith('s2:')))}
              {isAllSheetsSelected && (activeSideTab === 'all' || activeSideTab === 'side2_cut') &&
                renderSection(`Операція (2 сторона вирізка) ${isCutter1_5 ? 'Ф1.5мм' : 'Ф2мм'}`, availableItems.filter(i => i.key.startsWith('s2c:')))}
            </div>
          )}

          {/* Чергова щогодинна перевірка якщо всі операції вже погоджені */}
          {availableItems.length > 0 && currentSheetStampedCount === totalAvailableCount && (
            <div
              style={{
                padding: '12px 14px',
                background: isHourlyConfirmed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.08)',
                border: isHourlyConfirmed ? '1.5px solid #10b981' : '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                cursor: isInspectorValid ? 'pointer' : 'not-allowed'
              }}
              onClick={() => {
                if (!isInspectorValid) return
                setIsHourlyConfirmed(prev => !prev)
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Clock size={20} color={isHourlyConfirmed ? '#10b981' : '#38bdf8'} />
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 950, color: 'var(--text-strong)' }}>
                    {isHourlyConfirmed
                      ? '✓ Черговий огляд підтверджено (таймер оновиться)'
                      : `Фіксація чергового огляду (${isSmallMachine ? selectedSheet : 'Всі листи'})`}
                  </div>
                  <div style={{ fontSize: '0.66rem', color: 'var(--text-dim)', fontWeight: 700, marginTop: '2px' }}>
                    Всі операції для цього етапу вже погоджено. Натисніть тут для оновлення 1-годинного таймера перевірки.
                  </div>
                </div>
              </div>
              {isHourlyConfirmed ? <CheckSquare size={20} color="#10b981" /> : <Square size={20} color="#64748b" />}
            </div>
          )}

          {/* Action Buttons: Save or Close */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={handleSaveStamps}
              disabled={isProcessing || !isInspectorValid || !hasChanges}
              style={{
                width: '100%',
                background: !hasChanges
                  ? 'var(--surface-2, rgba(255,255,255,0.06))'
                  : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: !hasChanges ? 'var(--text-muted, #94a3b8)' : '#fff',
                border: !hasChanges ? '1.5px solid var(--border-subtle, rgba(255,255,255,0.12))' : 'none',
                padding: '16px 20px',
                borderRadius: '16px',
                fontSize: '0.96rem',
                fontWeight: 950,
                cursor: (isProcessing || !isInspectorValid || !hasChanges) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                boxShadow: hasChanges ? '0 8px 24px rgba(16, 185, 129, 0.3)' : 'none',
                opacity: (isProcessing || !isInspectorValid) ? 0.45 : 1,
                transition: 'all 0.2s ease'
              }}
            >
              {isProcessing ? (
                <span>ЗБЕРЕЖЕННЯ ПЕЧАТКИ...</span>
              ) : !isInspectorValid ? (
                <span>ВКАЖІТЬ ПІБ КОНТРОЛЕРА ВКЯ</span>
              ) : !hasChanges ? (
                <>
                  <FileCheck2 size={18} />
                  <span>✓ ЗМІН НЕ ВНЕСЕНО (ТАЙМЕР НЕ СКИДАЄТЬСЯ)</span>
                </>
              ) : (
                <>
                  <Stamp size={18} />
                  <span>ЗБЕРЕГТИ ПЕРЕВІРКУ ВКЯ ({selectedStamp})</span>
                </>
              )}
            </button>

            {!hasChanges && (
              <div style={{
                textAlign: 'center',
                fontSize: '0.68rem',
                color: 'var(--text-dim, #64748b)',
                fontWeight: 700,
                lineHeight: 1.35
              }}>
                ℹ️ Захист від пустого кліку: таймер оновлюється лише коли погоджено нову операцію, змінено статус листів або підтверджено черговий огляд.
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              style={{
                width: '100%',
                background: 'none',
                border: '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
                color: 'var(--text-muted, #94a3b8)',
                padding: '12px',
                borderRadius: '14px',
                fontSize: '0.84rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Закрити картку без змін
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
