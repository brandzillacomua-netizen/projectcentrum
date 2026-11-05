import React, { useState, useMemo } from 'react'
import { X, PauseCircle, PlayCircle, AlertTriangle, CheckSquare, Square, Filter, Layers, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../../../supabase'
import { isCardAssignedToMachine } from '../../../Machines/utils/machineDashboardUtils.js'

export const MACHINE_CATEGORIES = [
  { id: 'cnc_small', label: 'Фрезерні ЧПК: Малі (1200х800)', matcher: (m) => {
    const text = `${m.name || ''} ${m.type || ''}`.toLowerCase()
    return text.includes('1200') || text.includes('12x8') || text.includes('малий')
  }},
  { id: 'cnc_kexin', label: 'Фрезерні ЧПК: ФЕЯ (Ke Xin)', matcher: (m) => {
    const text = `${m.name || ''} ${m.type || ''}`.toLowerCase()
    return text.includes('ke xin') || text.includes('kexin') || text.includes('фея')
  }},
  { id: 'cnc_3050', label: 'Фрезерні ЧПК: Швидкісні (3050)', matcher: (m) => {
    const text = `${m.name || ''} ${m.type || ''}`.toLowerCase()
    return text.includes('3050') || text.includes('16x16') || text.includes('швидкісн')
  }},
  { id: 'cnc_3060', label: 'Фрезерні ЧПК: Триголові (3060)', matcher: (m) => {
    const text = `${m.name || ''} ${m.type || ''}`.toLowerCase()
    return text.includes('3060') || text.includes('30x16') || text.includes('три голов')
  }},
  { id: 'cnc_dragon', label: 'Фрезерні ЧПК: Дракон (6000)', matcher: (m) => {
    const text = `${m.name || ''} ${m.type || ''}`.toLowerCase()
    return text.includes('6000') || text.includes('60x20') || text.includes('дракон')
  }}
]

// Helper: Extract sequence number from machine.sequence_number OR from machine.name (e.g. "№1.9", "№Ф7", "Ф27", "1.21")
export function extractMachineSequenceNumber(machine) {
  if (!machine) return null
  const rawSeq = machine.sequence_number != null ? String(machine.sequence_number).trim() : ''
  if (rawSeq && rawSeq !== '—' && rawSeq !== '-') {
    return rawSeq.replace(/^[№#Nn]\s*/, '').trim()
  }

  const name = String(machine.name || '').trim()
  // Match "№1.9", "№ 1.9", "№Ф7", "№ D1", "#12", "N3", etc.
  const matchNo = name.match(/[№#Nn]\s*([A-Za-zА-Яа-яІіЇїЄєҐґ0-9]+(?:\.[0-9]+)?)/i)
  if (matchNo) {
    return matchNo[1].trim()
  }

  return null
}

// Helper: Clean machine display name by removing duplicate sequence number prefix/suffix
export function getCleanMachineName(rawName, seq) {
  let name = String(rawName || '').trim()
  if (!name) return 'Фрезерний ЧПК'

  // If the whole name was just "№Ф6" or "№1.9", use standard cutting CNC label
  if (name.match(/^[№#Nn]\s*[A-Za-zА-Яа-яІіЇїЄєҐґ0-9]+(?:\.[0-9]+)?$/i)) {
    return 'Фрезерний ЧПК'
  }

  // Remove "№1.9" or "№Ф7" from the name if seq exists
  if (seq) {
    name = name.replace(new RegExp(`[№#Nn]\\s*${seq}`, 'gi'), '').trim()
    name = name.replace(/[-–—\s]+$/, '').trim()
    name = name.replace(/^[-–—\s]+/, '').trim()
  }

  return name || 'Фрезерний ЧПК'
}

// Helper: Sort machines naturally (e.g. 1.1, 1.2 ... 1.9, 1.21; then Ф1 ... Ф27; then D1)
export function compareMachineSequence(seqA, seqB, nameA = '', nameB = '') {
  if (!seqA && !seqB) return nameA.localeCompare(nameB, 'uk', { numeric: true })
  if (!seqA) return 1
  if (!seqB) return -1

  const parseSeq = (s) => {
    const str = String(s).trim().toUpperCase()
    const match = str.match(/^([A-ZА-ЯІЇЄҐ]*)\s*(\d+)(?:\.(\d+))?/)
    if (match) {
      return {
        prefix: match[1] || '',
        main: parseInt(match[2], 10),
        sub: match[3] !== undefined ? parseInt(match[3], 10) : -1,
        raw: str
      }
    }
    return { prefix: str, main: 0, sub: -1, raw: str }
  }

  const pA = parseSeq(seqA)
  const pB = parseSeq(seqB)

  if (pA.prefix !== pB.prefix) {
    return pA.prefix.localeCompare(pB.prefix, 'uk')
  }
  if (pA.main !== pB.main) {
    return pA.main - pB.main
  }
  if (pA.sub !== pB.sub) {
    return pA.sub - pB.sub
  }
  return pA.raw.localeCompare(pB.raw)
}

export function Shop1BulkPauseModal({
  isOpen,
  onClose,
  machines = [],
  workCards = [],
  nomenclatures = [],
  fetchData,
  currentUser,
  theme
}) {
  const isLight = theme === 'light' || (typeof document !== 'undefined' && document.body.classList.contains('light-theme'))

  const [mode, setMode] = useState('all') // 'all' | 'by_type' | 'custom'
  const [selectedCategoryIds, setSelectedCategoryIds] = useState(() => ['cnc_small', 'cnc_kexin', 'cnc_3050', 'cnc_3060', 'cnc_dragon'])
  const [selectedMachineKeys, setSelectedMachineKeys] = useState({})
  const [pauseReason, setPauseReason] = useState('Повітряна тривога')
  const [customPauseReason, setCustomPauseReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Helper: ONLY cutting operations are counted in Shop 1 bulk pause
  const isCuttingCard = (c) => {
    if (!c) return false
    const op = String(c.operation || '').trim().toLowerCase()
    return op === 'розкрій' || op.includes('розкрій')
  }

  // 1. Unified list of Shop 1 cutting CNC machines with active cutting card status
  const machineList = useMemo(() => {
    // Exactly the CNC cutting machines from the equipment fleet (Park obladnannya - 61 machines)
    const s1Machines = (machines || []).filter(m => {
      // Must strictly match one of the 5 official CNC cutting categories
      return MACHINE_CATEGORIES.some(cat => cat.matcher(m))
    })

    // Active cutting cards strictly on the cutting stage ("Розкрій")
    const activeCuttingCards = (workCards || []).filter(c => {
      if (!isCuttingCard(c)) return false
      if (c.status !== 'in-progress' && c.status !== 'paused') return false
      const info = String(c.card_info || '')
      if (info.includes('[ЦЕХ №2]') || info.includes('[ЦЕХ 2]')) return false
      const nom = nomenclatures.find(n => n.id === c.nomenclature_id)
      if (nom?.type && nom.type !== 'part') return false
      return true
    })

    const result = s1Machines.map(m => {
      const seq = extractMachineSequenceNumber(m)
      const inv = m.inventory_no != null ? String(m.inventory_no).trim() : null
      const displayName = getCleanMachineName(m.name, seq)

      // Match card to machine using sequence number and official MES machine matcher
      const activeCard = activeCuttingCards.find(c => {
        const rawCardMachine = String(c.machine_name || c.machine || '').trim()
        if (!rawCardMachine || rawCardMachine.toLowerCase() === 'не призначено' || rawCardMachine.toLowerCase() === 'не вказано') {
          return false
        }

        // 1. Sequence number match (e.g. card has "№Ф2" or "Ф2" and machine seq is "Ф2")
        const cardSeq = rawCardMachine.match(/[№#Nn]?\s*([A-Za-zА-Яа-яІіЇїЄєҐґ0-9]+(?:\.[0-9]+)?)/i)?.[1]
        if (seq && cardSeq && seq.toUpperCase() === cardSeq.toUpperCase()) {
          return true
        }

        // 2. Official MES machine matching logic
        return isCardAssignedToMachine(c, m)
      })

      const nom = activeCard ? nomenclatures.find(n => n.id === activeCard.nomenclature_id) : null
      const cat = MACHINE_CATEGORIES.find(c => c.matcher(m))

      return {
        key: `db-${m.id}`,
        machine: m,
        sequenceNumber: seq,
        inventoryNo: inv,
        name: displayName,
        category: cat ? cat.id : 'other',
        categoryLabel: cat ? cat.label : 'Інші верстати',
        activeCard: activeCard || null,
        isWorking: activeCard?.status === 'in-progress',
        isPaused: activeCard?.status === 'paused',
        isIdle: !activeCard,
        nomenclature: nom
      }
    })

    // Sort machines by sequence number naturally (1.1, 1.2... 1.9, 1.21, then Ф1... Ф27)
    result.sort((a, b) => compareMachineSequence(a.sequenceNumber, b.sequenceNumber, a.name, b.name))

    return result
  }, [machines, workCards, nomenclatures])

  // Count summaries
  const stats = useMemo(() => {
    let working = 0
    let paused = 0
    let idle = 0
    machineList.forEach(m => {
      if (m.isWorking) working++
      else if (m.isPaused) paused++
      else idle++
    })
    return { working, paused, idle, total: machineList.length }
  }, [machineList])

  // In custom mode, show ONLY active cutting machines (working or paused)
  const filteredMachines = useMemo(() => {
    const activeCutting = machineList.filter(m => m.isWorking || m.isPaused)
    if (!searchQuery.trim()) return activeCutting
    const q = searchQuery.toLowerCase()
    return activeCutting.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.categoryLabel.toLowerCase().includes(q) ||
      (m.sequenceNumber && String(m.sequenceNumber).toLowerCase().includes(q)) ||
      (m.inventoryNo && String(m.inventoryNo).toLowerCase().includes(q)) ||
      m.nomenclature?.name?.toLowerCase().includes(q) ||
      m.activeCard?.operator_name?.toLowerCase().includes(q)
    )
  }, [machineList, searchQuery])

  // Determine target machines depending on current mode
  const targetMachines = useMemo(() => {
    if (mode === 'all') {
      return machineList
    }
    if (mode === 'by_type') {
      return machineList.filter(m => selectedCategoryIds.includes(m.category))
    }
    if (mode === 'custom') {
      return machineList.filter(m => selectedMachineKeys[m.key])
    }
    return []
  }, [mode, machineList, selectedCategoryIds, selectedMachineKeys])

  // Target counts for current selection
  const targetWorkingCount = targetMachines.filter(m => m.isWorking).length
  const targetPausedCount = targetMachines.filter(m => m.isPaused).length

  // List of machines currently on pause
  const pausedMachines = useMemo(() => {
    return machineList.filter(m => m.isPaused && m.activeCard)
  }, [machineList])

  // Quick select helpers for custom mode (select active machines)
  const handleSelectAllActive = () => {
    const next = {}
    filteredMachines.forEach(m => {
      next[m.key] = true
    })
    setSelectedMachineKeys(next)
  }

  const handleSelectAllPaused = () => {
    const next = {}
    pausedMachines.forEach(m => {
      next[m.key] = true
    })
    setSelectedMachineKeys(next)
  }

  const handleClearSelection = () => {
    setSelectedMachineKeys({})
  }

  const toggleCategory = (catId) => {
    setSelectedCategoryIds(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    )
  }

  const toggleMachineKey = (key) => {
    setSelectedMachineKeys(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  // Restore single paused machine directly
  const handleResumeSingleMachine = async (machineItem) => {
    if (!machineItem?.activeCard || isSubmitting) return
    setIsSubmitting(true)
    setFeedbackMsg(null)

    try {
      const now = new Date().toISOString()
      const card = machineItem.activeCard
      const pausedAtStr = card.card_info?.match(/\[PAUSED_AT:([^\]]+)\]/)?.[1]
      const reasonText = card.card_info?.match(/\[PAUSED:([^\]]+)\]/)?.[1] || 'Без причини'
      const pausedAt = pausedAtStr ? new Date(pausedAtStr).toISOString() : now

      await supabase.from('work_card_history').insert([{
        card_id: card.id,
        nomenclature_id: card.nomenclature_id,
        stage_name: `${card.operation || 'Розкрій'} (зупинка)`,
        operator_name: card.operator_name || currentUser?.name || 'Не вказано',
        qty_at_start: card.quantity || 0,
        qty_completed: 0,
        scrap_qty: 0,
        started_at: pausedAt,
        completed_at: now,
        shift_name: card.shift_name || 'Без зміни',
        manager_name: card.manager_name || 'Не вказано',
        machine_name: card.machine || machineItem.name,
        card_info: `Причина зупинки: ${reasonText}`
      }])

      const cleanInfo = (card.card_info || '')
        .replace(/\[PAUSED:[^\]]+\]/g, '')
        .replace(/\[PAUSED_AT:[^\]]+\]/g, '')
        .trim()

      await supabase.from('work_cards').update({
        status: 'in-progress',
        started_at: now,
        card_info: cleanInfo
      }).eq('id', card.id)

      if (typeof fetchData === 'function') {
        await fetchData(['work_cards', 'work_card_history'])
      }

      setFeedbackMsg({
        type: 'success',
        text: `▶️ Відновлено роботу: ${machineItem.sequenceNumber ? '№' + machineItem.sequenceNumber + ' ' : ''}${machineItem.name}`
      })
    } catch (err) {
      console.error('Single resume error:', err)
      setFeedbackMsg({ type: 'error', text: 'Помилка відновлення: ' + err.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  // --- ACTIONS ---
  // 1. Put selected machines on PAUSE
  const handleBulkPause = async () => {
    const workingTargets = targetMachines.filter(m => m.isWorking && m.activeCard)
    if (workingTargets.length === 0) {
      setFeedbackMsg({ type: 'warning', text: 'Серед обраних верстатів немає таких, що зараз виконують роботу.' })
      return
    }

    const finalReason = (pauseReason === 'Інша причина' ? customPauseReason.trim() : pauseReason) || 'Без причини'
    if (pauseReason === 'Інша причина' && !customPauseReason.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Будь ласка, вкажіть причину зупинки.' })
      return
    }

    setIsSubmitting(true)
    setFeedbackMsg(null)

    try {
      const now = new Date().toISOString()
      const historyRows = []
      const cardUpdates = []

      workingTargets.forEach(({ activeCard, name }) => {
        const card = activeCard
        historyRows.push({
          card_id: card.id,
          nomenclature_id: card.nomenclature_id,
          stage_name: card.operation || 'Розкрій',
          operator_name: card.operator_name || currentUser?.name || 'Не вказано',
          qty_at_start: card.quantity || 0,
          qty_completed: 0,
          scrap_qty: 0,
          started_at: card.started_at || now,
          completed_at: now,
          shift_name: card.shift_name || 'Без зміни',
          manager_name: card.manager_name || 'Не вказано',
          machine_name: card.machine || name,
          card_info: `[PAUSED_WORK_LOG][REASON:${finalReason}]`
        })

        const originalStart = card.card_info?.match(/\[ORIGINAL_START:([^\]]+)\]/)?.[1] || card.started_at || now
        let cleanInfo = (card.card_info || '')
          .replace(/\[ORIGINAL_START:[^\]]+\]/g, '')
          .replace(/\[PAUSED:[^\]]+\]/g, '')
          .replace(/\[PAUSED_AT:[^\]]+\]/g, '')
          .trim()

        const updatedCardInfo = `[PAUSED:${finalReason}][PAUSED_AT:${now}][ORIGINAL_START:${originalStart}] ${cleanInfo}`.trim()

        cardUpdates.push(
          supabase.from('work_cards').update({
            status: 'paused',
            card_info: updatedCardInfo
          }).eq('id', card.id)
        )
      })

      if (historyRows.length > 0) {
        await supabase.from('work_card_history').insert(historyRows)
      }
      await Promise.all(cardUpdates)

      if (typeof fetchData === 'function') {
        await fetchData(['work_cards', 'work_card_history'])
      }

      setFeedbackMsg({
        type: 'success',
        text: `🛑 Успішно поставлено на паузу: ${workingTargets.length} верстатів (Причина: ${finalReason})`
      })
      setTimeout(() => {
        onClose()
      }, 1400)
    } catch (err) {
      console.error('Bulk pause error:', err)
      setFeedbackMsg({ type: 'error', text: 'Помилка призупинення: ' + err.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  // 2. Resume / Unpause selected machines
  const handleBulkResume = async () => {
    const pausedTargets = targetMachines.filter(m => m.isPaused && m.activeCard)
    if (pausedTargets.length === 0) {
      setFeedbackMsg({ type: 'warning', text: 'Серед обраних верстатів немає таких, що зараз на паузі.' })
      return
    }

    setIsSubmitting(true)
    setFeedbackMsg(null)

    try {
      const now = new Date().toISOString()
      const historyRows = []
      const cardUpdates = []

      pausedTargets.forEach(({ activeCard, name }) => {
        const card = activeCard
        const pausedAtStr = card.card_info?.match(/\[PAUSED_AT:([^\]]+)\]/)?.[1]
        const reasonText = card.card_info?.match(/\[PAUSED:([^\]]+)\]/)?.[1] || 'Без причини'
        const pausedAt = pausedAtStr ? new Date(pausedAtStr).toISOString() : now

        historyRows.push({
          card_id: card.id,
          nomenclature_id: card.nomenclature_id,
          stage_name: `${card.operation || 'Розкрій'} (зупинка)`,
          operator_name: card.operator_name || currentUser?.name || 'Не вказано',
          qty_at_start: card.quantity || 0,
          qty_completed: 0,
          scrap_qty: 0,
          started_at: pausedAt,
          completed_at: now,
          shift_name: card.shift_name || 'Без зміни',
          manager_name: card.manager_name || 'Не вказано',
          machine_name: card.machine || name,
          card_info: `Причина зупинки: ${reasonText}`
        })

        const cleanInfo = (card.card_info || '')
          .replace(/\[PAUSED:[^\]]+\]/g, '')
          .replace(/\[PAUSED_AT:[^\]]+\]/g, '')
          .trim()

        cardUpdates.push(
          supabase.from('work_cards').update({
            status: 'in-progress',
            started_at: now,
            card_info: cleanInfo
          }).eq('id', card.id)
        )
      })

      if (historyRows.length > 0) {
        await supabase.from('work_card_history').insert(historyRows)
      }
      await Promise.all(cardUpdates)

      if (typeof fetchData === 'function') {
        await fetchData(['work_cards', 'work_card_history'])
      }

      setFeedbackMsg({
        type: 'success',
        text: `▶️ Успішно відновлено роботу: ${pausedTargets.length} верстатів`
      })
      setTimeout(() => {
        onClose()
      }, 1400)
    } catch (err) {
      console.error('Bulk resume error:', err)
      setFeedbackMsg({ type: 'error', text: 'Помилка відновлення: ' + err.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <style>{`
        .shop1-pause-modal-overlay {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10050;
          padding: 16px;
          backdrop-filter: blur(8px);
        }
        .shop1-pause-modal-card {
          width: 100%;
          max-width: 820px;
          max-height: 92vh;
          border-radius: 24px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .shop1-pause-modal-header {
          padding: 18px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
        .shop1-pause-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          flex: 1;
        }
        .shop1-pause-modal-title {
          margin: 0;
          font-size: 1.15rem;
          font-weight: 900;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .shop1-pause-counters-row {
          padding: 12px 24px;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
        }
        .shop1-pause-counter-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-radius: 10px;
        }
        .shop1-pause-selected-count {
          margin-left: auto;
          display: flex;
          align-items: center;
          font-size: 0.8rem;
        }
        .shop1-pause-modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          -webkit-overflow-scrolling: touch;
        }
        .shop1-pause-mode-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .shop1-pause-mode-btn {
          padding: 12px 10px;
          border-radius: 12px;
          font-weight: 900;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }
        .shop1-pause-mode-label-short {
          display: none;
        }
        .shop1-pause-modal-footer {
          padding: 16px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }
        .shop1-pause-mobile-footer-row {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        @media (max-width: 640px) {
          .shop1-pause-modal-overlay {
            padding: 0 !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            position: fixed !important;
            display: flex !important;
            align-items: stretch !important;
            justify-content: stretch !important;
          }
          .shop1-pause-modal-card {
            width: 100% !important;
            max-width: 100% !important;
            height: 100% !important;
            max-height: 100dvh !important;
            border-radius: 0 !important;
            border: none !important;
            box-shadow: none !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
          }
          .shop1-pause-modal-header {
            padding: 10px 14px !important;
            gap: 8px !important;
            flex-shrink: 0 !important;
          }
          .shop1-pause-header-icon {
            padding: 5px !important;
            border-radius: 8px !important;
          }
          .shop1-pause-header-icon svg {
            width: 18px !important;
            height: 18px !important;
          }
          .shop1-pause-modal-title {
            font-size: 0.92rem !important;
            gap: 6px !important;
            line-height: 1.2 !important;
          }
          .shop1-pause-modal-subtitle {
            font-size: 0.65rem !important;
            line-height: 1.15 !important;
            margin-top: 2px !important;
          }
          .shop1-pause-counters-row {
            padding: 6px 12px !important;
            gap: 5px !important;
            flex-shrink: 0 !important;
          }
          .shop1-pause-counter-pill {
            padding: 3px 7px !important;
            font-size: 0.7rem !important;
            gap: 4px !important;
          }
          .shop1-pause-counter-pill strong {
            font-size: 0.78rem !important;
          }
          .shop1-pause-selected-count {
            width: 100% !important;
            margin-left: 0 !important;
            margin-top: 2px !important;
            font-size: 0.72rem !important;
          }
          .shop1-pause-modal-body {
            flex: 1 1 0 !important;
            min-height: 0 !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch !important;
            padding: 10px 12px 14px !important;
            gap: 12px !important;
          }
          .shop1-pause-mode-grid {
            gap: 6px !important;
          }
          .shop1-pause-mode-btn {
            padding: 6px 4px !important;
            font-size: 0.72rem !important;
            flex-direction: column !important;
            gap: 3px !important;
            min-height: 48px !important;
          }
          .shop1-pause-mode-btn svg {
            width: 16px !important;
            height: 16px !important;
          }
          .shop1-pause-mode-label-full {
            display: none !important;
          }
          .shop1-pause-mode-label-short {
            display: inline !important;
            white-space: nowrap !important;
            font-size: 0.72rem !important;
          }
          .shop1-pause-reasons-wrap button {
            font-size: 0.74rem !important;
            padding: 6px 9px !important;
          }
          .shop1-pause-cat-grid {
            grid-template-columns: 1fr !important;
            gap: 6px !important;
          }
          .shop1-pause-custom-search {
            width: 100% !important;
            max-width: 100% !important;
            margin-top: 4px !important;
          }
          .shop1-pause-modal-footer {
            padding: 8px 12px 10px !important;
            flex-shrink: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 6px !important;
          }
          .shop1-pause-btn-pause {
            width: 100% !important;
            padding: 10px 14px !important;
            font-size: 0.88rem !important;
            order: 1 !important;
          }
          .shop1-pause-mobile-footer-row {
            display: flex !important;
            gap: 8px !important;
            width: 100% !important;
            order: 2 !important;
          }
          .shop1-pause-btn-resume {
            flex: 1 !important;
            padding: 9px 8px !important;
            font-size: 0.78rem !important;
            justify-content: center !important;
          }
          .shop1-pause-btn-close {
            flex: 1 !important;
            padding: 9px 8px !important;
            font-size: 0.78rem !important;
            text-align: center !important;
          }
        }
      `}</style>

      <div className="shop1-pause-modal-overlay" style={{
        background: isLight ? 'rgba(15, 23, 42, 0.55)' : 'rgba(0,0,0,0.85)'
      }}>
        <div className="shop1-pause-modal-card" style={{
          background: isLight ? '#ffffff' : '#0d1117',
          border: isLight ? '1px solid #e2e8f0' : '1px solid #30363d',
          boxShadow: isLight ? '0 25px 60px -15px rgba(0,0,0,0.25)' : '0 25px 60px rgba(0,0,0,0.8)'
        }}>
          {/* Header */}
          <div className="shop1-pause-modal-header" style={{
            background: isLight ? '#f8fafc' : '#161b22',
            borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid #30363d'
          }}>
            <div className="shop1-pause-header-left">
              <div className="shop1-pause-header-icon" style={{
                background: stats.paused > 0
                  ? (isLight ? '#fef2f2' : 'rgba(239, 68, 68, 0.2)')
                  : (isLight ? '#fefce8' : 'rgba(234, 179, 8, 0.2)'),
                border: stats.paused > 0
                  ? (isLight ? '1.5px solid #ef4444' : '1px solid #ef4444')
                  : (isLight ? '1.5px solid #eab308' : '1px solid #eab308'),
                borderRadius: '12px',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <PauseCircle size={24} color={stats.paused > 0 ? '#ef4444' : '#d97706'} />
              </div>
              <div style={{ minWidth: 0 }}>
                <h2 className="shop1-pause-modal-title" style={{ color: isLight ? '#0f172a' : '#f0f6fc' }}>
                  <span>КЕРУВАННЯ ПАУЗОЮ ВЕРСТАТІВ</span>
                  <span style={{ fontSize: '0.7rem', background: isLight ? '#fef3c7' : '#eab30820', color: isLight ? '#b45309' : '#eab308', border: isLight ? '1px solid #fde68a' : '1px solid #eab30840', padding: '2px 8px', borderRadius: '6px' }}>ЦЕХ №1</span>
                </h2>
                <div className="shop1-pause-modal-subtitle" style={{ color: isLight ? '#64748b' : '#8b949e' }}>
                  Швидка масова зупинка / відновлення роботи верстатів (тривога, обід, перезмінка)
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: isLight ? '#f1f5f9' : '#21262d',
                border: isLight ? '1px solid #e2e8f0' : '1px solid #30363d',
                color: isLight ? '#64748b' : '#8b949e',
                cursor: 'pointer',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Live Counters Banner */}
          <div className="shop1-pause-counters-row" style={{
            background: isLight ? '#f8fafc' : '#0d1117',
            borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid #21262d'
          }}>
            <div className="shop1-pause-counter-pill" style={{
              background: isLight ? '#ecfdf5' : '#161b22',
              border: isLight ? '1px solid #a7f3d0' : '1px solid #238636'
            }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
              <span style={{ color: isLight ? '#047857' : '#8b949e' }}>В роботі:</span>
              <strong style={{ color: isLight ? '#047857' : '#2ea043' }}>{stats.working}</strong>
            </div>

            <div className="shop1-pause-counter-pill" style={{
              background: isLight ? (stats.paused > 0 ? '#fef2f2' : '#f8fafc') : '#161b22',
              border: isLight ? (stats.paused > 0 ? '1px solid #fecaca' : '1px solid #e2e8f0') : (stats.paused > 0 ? '1px solid #da3633' : '1px solid #30363d')
            }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
              <span style={{ color: isLight ? (stats.paused > 0 ? '#b91c1c' : '#64748b') : '#8b949e' }}>На паузі:</span>
              <strong style={{ color: isLight ? '#dc2626' : (stats.paused > 0 ? '#f85149' : '#8b949e') }}>{stats.paused}</strong>
            </div>

            <div className="shop1-pause-counter-pill" style={{
              background: isLight ? '#ffffff' : '#161b22',
              border: isLight ? '1px solid #e2e8f0' : '1px solid #30363d'
            }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isLight ? '#94a3b8' : '#8b949e' }} />
              <span style={{ color: isLight ? '#64748b' : '#8b949e' }}>Вільні:</span>
              <strong style={{ color: isLight ? '#334155' : '#8b949e' }}>{stats.idle}</strong>
            </div>

            <div className="shop1-pause-selected-count" style={{ color: isLight ? '#475569' : '#8b949e' }}>
              Обрано: <strong style={{ color: isLight ? '#2563eb' : '#58a6ff', marginLeft: '6px' }}>{targetMachines.length}</strong>
              <span style={{ marginLeft: '4px', fontSize: '0.75rem', color: isLight ? '#64748b' : '#6e7681' }}>
                ({targetWorkingCount} в роботі, {targetPausedCount} на паузі)
              </span>
            </div>
          </div>

        {/* Modal Body */}
        <div className="shop1-pause-modal-body">

          {/* Блок верстатів, які зараз на паузі */}
          {pausedMachines.length > 0 && (
            <div style={{
              background: isLight ? '#fff5f5' : 'rgba(218, 54, 51, 0.08)',
              border: isLight ? '1.5px solid #fecaca' : '1.5px solid rgba(218, 54, 51, 0.4)',
              borderRadius: '16px',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 950, color: isLight ? '#b91c1c' : '#f85149', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  <PauseCircle size={17} />
                  <span>ВЕРСТАТИ ЗАРАЗ НА ПАУЗІ ({pausedMachines.length}):</span>
                </div>
                <span style={{ fontSize: '0.72rem', color: isLight ? '#991b1b' : '#ff7b72', fontWeight: 700 }}>
                  Ви можете відновити кожен верстат окремо або всі разом кнопкою внизу
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {pausedMachines.map(pm => {
                  const pReason = pm.activeCard?.card_info?.match(/\[PAUSED:([^\]]+)\]/)?.[1] || 'Без причини'
                  const pAt = pm.activeCard?.card_info?.match(/\[PAUSED_AT:([^\]]+)\]/)?.[1]
                  const pTimeFormatted = pAt ? new Date(pAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) : null
                  const cardSeq = (pm.activeCard?.card_info || '').match(/(\d+\/\d+)/)?.[1]

                  return (
                    <div
                      key={pm.key}
                      style={{
                        background: isLight ? '#ffffff' : '#161b22',
                        border: isLight ? '1px solid #fca5a5' : '1px solid rgba(218, 54, 51, 0.35)',
                        borderRadius: '12px',
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        flexWrap: 'wrap'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '220px', flex: 1 }}>
                        {pm.sequenceNumber && (
                          <span style={{
                            background: isLight ? '#fef3c7' : '#eab30825',
                            color: isLight ? '#b45309' : '#eab308',
                            border: isLight ? '1px solid #fde68a' : '1px solid #eab30850',
                            padding: '3px 8px',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            fontWeight: 950,
                            whiteSpace: 'nowrap'
                          }}>
                            №{pm.sequenceNumber}
                          </span>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '0.9rem', color: isLight ? '#0f172a' : '#f0f6fc' }}>
                              {pm.name}
                            </strong>
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 900,
                              background: isLight ? '#fee2e2' : 'rgba(239, 68, 68, 0.2)',
                              color: '#ef4444',
                              border: isLight ? '1px solid #fecaca' : '1px solid rgba(239, 68, 68, 0.4)',
                              padding: '2px 8px',
                              borderRadius: '6px'
                            }}>
                              🚨 {pReason} {pTimeFormatted ? `(з ${pTimeFormatted})` : ''}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.72rem', color: isLight ? '#64748b' : '#8b949e', marginTop: '3px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            {cardSeq && <span style={{ color: '#eab308', fontWeight: 800 }}>Картка {cardSeq}</span>}
                            <span>Деталь: <strong style={{ color: isLight ? '#334155' : '#c9d1d9' }}>{pm.nomenclature?.name || '—'}</strong></span>
                            <span>Оператор: <strong style={{ color: isLight ? '#334155' : '#c9d1d9' }}>{pm.activeCard?.operator_name || '—'}</strong></span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleResumeSingleMachine(pm)}
                        disabled={isSubmitting}
                        style={{
                          background: isLight ? '#16a34a' : '#238636',
                          border: 'none',
                          color: '#ffffff',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          fontSize: '0.78rem',
                          fontWeight: 900,
                          cursor: isSubmitting ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: isLight ? '0 2px 6px rgba(22, 163, 74, 0.25)' : '0 2px 6px rgba(35, 134, 54, 0.35)',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <PlayCircle size={15} />
                        <span>Відновити верстат</span>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Mode Switcher Tabs */}
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 900, color: isLight ? '#475569' : '#8b949e', textTransform: 'uppercase', marginBottom: '8px' }}>
              1. ОБЕРІТЬ ВАРІАНТ ВИБОРУ ВЕРСТАТІВ:
            </label>
            <div className="shop1-pause-mode-grid">
              <button
                type="button"
                onClick={() => setMode('all')}
                className="shop1-pause-mode-btn"
                style={{
                  background: mode === 'all'
                    ? (isLight ? '#eff6ff' : '#1f6feb20')
                    : (isLight ? '#f8fafc' : '#161b22'),
                  border: mode === 'all'
                    ? (isLight ? '2px solid #3b82f6' : '2px solid #58a6ff')
                    : (isLight ? '1px solid #cbd5e1' : '1px solid #30363d'),
                  color: mode === 'all'
                    ? (isLight ? '#1d4ed8' : '#58a6ff')
                    : (isLight ? '#475569' : '#8b949e'),
                  boxShadow: mode === 'all' && isLight ? '0 2px 8px rgba(59, 130, 246, 0.15)' : 'none'
                }}
              >
                <Layers size={18} />
                <span className="shop1-pause-mode-label-full">🌐 ВСІ ВЕРСТАТИ</span>
                <span className="shop1-pause-mode-label-short">🌐 Всі</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('by_type')}
                className="shop1-pause-mode-btn"
                style={{
                  background: mode === 'by_type'
                    ? (isLight ? '#eff6ff' : '#1f6feb20')
                    : (isLight ? '#f8fafc' : '#161b22'),
                  border: mode === 'by_type'
                    ? (isLight ? '2px solid #3b82f6' : '2px solid #58a6ff')
                    : (isLight ? '1px solid #cbd5e1' : '1px solid #30363d'),
                  color: mode === 'by_type'
                    ? (isLight ? '#1d4ed8' : '#58a6ff')
                    : (isLight ? '#475569' : '#8b949e'),
                  boxShadow: mode === 'by_type' && isLight ? '0 2px 8px rgba(59, 130, 246, 0.15)' : 'none'
                }}
              >
                <Filter size={18} />
                <span className="shop1-pause-mode-label-full">📑 ЗА ТИПАМИ ВЕРСТАТА</span>
                <span className="shop1-pause-mode-label-short">📑 За типами</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('custom')}
                className="shop1-pause-mode-btn"
                style={{
                  background: mode === 'custom'
                    ? (isLight ? '#eff6ff' : '#1f6feb20')
                    : (isLight ? '#f8fafc' : '#161b22'),
                  border: mode === 'custom'
                    ? (isLight ? '2px solid #3b82f6' : '2px solid #58a6ff')
                    : (isLight ? '1px solid #cbd5e1' : '1px solid #30363d'),
                  color: mode === 'custom'
                    ? (isLight ? '#1d4ed8' : '#58a6ff')
                    : (isLight ? '#475569' : '#8b949e'),
                  boxShadow: mode === 'custom' && isLight ? '0 2px 8px rgba(59, 130, 246, 0.15)' : 'none'
                }}
              >
                <CheckSquare size={18} />
                <span className="shop1-pause-mode-label-full">☑️ ВИБІРКОВО (ГАЛОЧКАМИ)</span>
                <span className="shop1-pause-mode-label-short">☑️ Вибірково</span>
              </button>
            </div>
          </div>

          {/* Sub-view for "by_type" */}
          {mode === 'by_type' && (
            <div style={{
              background: isLight ? '#f8fafc' : '#161b22',
              border: isLight ? '1px solid #e2e8f0' : '1px solid #30363d',
              borderRadius: '16px',
              padding: '16px'
            }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: isLight ? '#0f172a' : '#f0f6fc', marginBottom: '10px' }}>
                Оберіть категорії верстатів, які потрібно зупинити або відновити:
              </div>
              <div className="shop1-pause-cat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                {MACHINE_CATEGORIES.map(cat => {
                  const isChecked = selectedCategoryIds.includes(cat.id)
                  const catMachines = machineList.filter(m => m.category === cat.id)
                  const workingInCat = catMachines.filter(m => m.isWorking).length
                  const pausedInCat = catMachines.filter(m => m.isPaused).length

                  return (
                    <div
                      key={cat.id}
                      onClick={() => toggleCategory(cat.id)}
                      style={{
                        background: isChecked
                          ? (isLight ? '#eff6ff' : 'rgba(88, 166, 255, 0.1)')
                          : (isLight ? '#ffffff' : '#0d1117'),
                        border: isChecked
                          ? (isLight ? '1.5px solid #3b82f6' : '1.5px solid #58a6ff')
                          : (isLight ? '1px solid #cbd5e1' : '1px solid #30363d'),
                        borderRadius: '12px',
                        padding: '12px 14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        transition: 'all 0.2s',
                        boxShadow: isChecked && isLight ? '0 2px 6px rgba(59, 130, 246, 0.1)' : 'none'
                      }}
                    >
                      <div style={{ marginTop: '2px', color: isChecked ? (isLight ? '#2563eb' : '#58a6ff') : (isLight ? '#94a3b8' : '#484f58') }}>
                        {isChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: isChecked ? (isLight ? '#0f172a' : '#f0f6fc') : (isLight ? '#334155' : '#8b949e') }}>
                          {cat.label}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: isLight ? '#64748b' : '#6e7681', marginTop: '4px' }}>
                          Всього: {catMachines.length} • 🟢 В роботі: {workingInCat} • 🛑 Пауза: {pausedInCat}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Sub-view for "custom" (Checkboxes list) */}
          {mode === 'custom' && (
            <div style={{
              background: isLight ? '#f8fafc' : '#161b22',
              border: isLight ? '1px solid #e2e8f0' : '1px solid #30363d',
              borderRadius: '16px',
              padding: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleSelectAllActive}
                    style={{
                      background: isLight ? '#ffffff' : '#21262d',
                      border: isLight ? '1px solid #cbd5e1' : '1px solid #30363d',
                      color: isLight ? '#2563eb' : '#58a6ff',
                      padding: '5px 12px',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    ✓ Обрати всі ({filteredMachines.length})
                  </button>
                  {stats.paused > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectAllPaused}
                      style={{
                        background: isLight ? '#fef2f2' : 'rgba(218, 54, 51, 0.15)',
                        border: isLight ? '1px solid #fecaca' : '1px solid #da3633',
                        color: isLight ? '#dc2626' : '#f85149',
                        padding: '5px 12px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      ⏸ Тільки на паузі ({stats.paused})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    style={{
                      background: isLight ? '#ffffff' : '#21262d',
                      border: isLight ? '1px solid #cbd5e1' : '1px solid #30363d',
                      color: isLight ? '#475569' : '#8b949e',
                      padding: '5px 12px',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    Зняти вибір
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Пошук верстата..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="shop1-pause-custom-search"
                  style={{
                    background: isLight ? '#ffffff' : '#0d1117',
                    border: isLight ? '1px solid #cbd5e1' : '1px solid #30363d',
                    color: isLight ? '#0f172a' : '#f0f6fc',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    outline: 'none',
                    width: '180px'
                  }}
                />
              </div>

              <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
                {filteredMachines.length === 0 ? (
                  <div style={{
                    padding: '24px 16px',
                    textAlign: 'center',
                    color: isLight ? '#64748b' : '#8b949e',
                    fontSize: '0.85rem',
                    fontWeight: 600
                  }}>
                    Немає верстатів у роботі
                  </div>
                ) : (
                  filteredMachines.map(m => {
                  const isChecked = Boolean(selectedMachineKeys[m.key])
                  return (
                    <div
                      key={m.key}
                      onClick={() => toggleMachineKey(m.key)}
                      style={{
                        background: isChecked
                          ? (isLight ? '#eff6ff' : 'rgba(88, 166, 255, 0.08)')
                          : (isLight ? '#ffffff' : '#0d1117'),
                        border: isChecked
                          ? (isLight ? '1px solid #3b82f6' : '1px solid #58a6ff')
                          : (isLight ? '1px solid #e2e8f0' : '1px solid #21262d'),
                        borderRadius: '10px',
                        padding: '10px 14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ color: isChecked ? (isLight ? '#2563eb' : '#58a6ff') : (isLight ? '#94a3b8' : '#484f58') }}>
                          {isChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            {m.sequenceNumber && (
                              <span style={{
                                background: isLight ? '#fef3c7' : '#eab30820',
                                color: isLight ? '#b45309' : '#eab308',
                                border: isLight ? '1px solid #fde68a' : '1px solid #eab30840',
                                padding: '1px 6px',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: 950
                              }}>
                                №{m.sequenceNumber}
                              </span>
                            )}
                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: isChecked ? (isLight ? '#0f172a' : '#f0f6fc') : (isLight ? '#334155' : '#c9d1d9') }}>
                              {m.name}
                            </span>
                            {m.inventoryNo && (
                              <span style={{ fontSize: '0.65rem', color: isLight ? '#94a3b8' : '#6e7681' }}>
                                (інв. {m.inventoryNo})
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.65rem', color: isLight ? '#64748b' : '#8b949e', marginTop: '2px' }}>
                            {m.categoryLabel}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {m.activeCard && (
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: isLight ? '#0f172a' : '#f0f6fc' }}>
                              {m.nomenclature?.name || 'Деталь в роботі'}
                            </div>
                            <div style={{ fontSize: '0.65rem', color: isLight ? '#64748b' : '#8b949e' }}>
                              Опер: {m.activeCard.operator_name || '—'}
                            </div>
                          </div>
                        )}
                        {(() => {
                          const mPauseReason = m.isPaused ? (m.activeCard?.card_info?.match(/\[PAUSED:([^\]]+)\]/)?.[1] || 'На паузі') : null
                          return (
                            <span style={{
                              fontSize: '0.7rem',
                              fontWeight: 900,
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: m.isWorking
                                ? (isLight ? '#ecfdf5' : '#23863620')
                                : m.isPaused
                                ? (isLight ? '#fef2f2' : '#da363320')
                                : (isLight ? '#f1f5f9' : '#21262d'),
                              border: m.isWorking
                                ? (isLight ? '1px solid #a7f3d0' : '1px solid #238636')
                                : m.isPaused
                                ? (isLight ? '1px solid #fecaca' : '1px solid #da3633')
                                : (isLight ? '1px solid #e2e8f0' : '1px solid #30363d'),
                              color: m.isWorking
                                ? (isLight ? '#047857' : '#3fb950')
                                : m.isPaused
                                ? (isLight ? '#dc2626' : '#f85149')
                                : (isLight ? '#64748b' : '#8b949e'),
                              whiteSpace: 'nowrap'
                            }}>
                              {m.isWorking ? '● В роботі' : m.isPaused ? `🛑 ${mPauseReason}` : '⚪ Вільний'}
                            </span>
                          )
                        })()}
                      </div>
                    </div>
                  )
                }))}
              </div>
            </div>
          )}

          {/* Pause Reason Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 900, color: isLight ? '#475569' : '#8b949e', textTransform: 'uppercase', marginBottom: '8px' }}>
              2. ПРИЧИНА ЗУПИНКИ ВЕРСТАТІВ (ДЛЯ ВСТАНОВЛЕННЯ ПАУЗИ):
            </label>
            <div className="shop1-pause-reasons-wrap" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
              {[
                { label: '🚨 Повітряна тривога', val: 'Повітряна тривога' },
                { label: '🥪 Обід / Перерва', val: 'Обідня перерва' },
                { label: '🔄 Перезмінка', val: 'Перезмінка' },
                { label: '🛠️ Технічне обслуговування', val: 'Технічне обслуговування' },
                { label: '⚠️ Аварійна зупинка / Наладка', val: 'Аварійна зупинка' },
                { label: '✍️ Інша причина', val: 'Інша причина' }
              ].map(item => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => setPauseReason(item.val)}
                  style={{
                    background: pauseReason === item.val
                      ? (isLight ? '#fef2f2' : 'rgba(239, 68, 68, 0.2)')
                      : (isLight ? '#ffffff' : '#161b22'),
                    border: pauseReason === item.val
                      ? '1.5px solid #ef4444'
                      : (isLight ? '1px solid #cbd5e1' : '1px solid #30363d'),
                    color: pauseReason === item.val
                      ? (isLight ? '#dc2626' : '#f85149')
                      : (isLight ? '#334155' : '#c9d1d9'),
                    padding: '8px 14px',
                    borderRadius: '10px',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    boxShadow: pauseReason === item.val && isLight ? '0 2px 6px rgba(239, 68, 68, 0.15)' : 'none'
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {pauseReason === 'Інша причина' && (
              <input
                type="text"
                placeholder="Введіть власну причину зупинки..."
                value={customPauseReason}
                onChange={e => setCustomPauseReason(e.target.value)}
                style={{
                  width: '100%',
                  background: isLight ? '#ffffff' : '#0d1117',
                  border: isLight ? '1px solid #cbd5e1' : '1px solid #30363d',
                  color: isLight ? '#0f172a' : '#f0f6fc',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            )}
          </div>

          {/* Feedback messages */}
          {feedbackMsg && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '12px',
              fontSize: '0.85rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: feedbackMsg.type === 'success'
                ? (isLight ? '#ecfdf5' : '#23863625')
                : feedbackMsg.type === 'error'
                ? (isLight ? '#fef2f2' : '#da363325')
                : (isLight ? '#fffbeb' : '#d2992225'),
              border: `1px solid ${
                feedbackMsg.type === 'success'
                  ? (isLight ? '#10b981' : '#238636')
                  : feedbackMsg.type === 'error'
                  ? (isLight ? '#ef4444' : '#da3633')
                  : (isLight ? '#f59e0b' : '#d29922')
              }`,
              color: feedbackMsg.type === 'success'
                ? (isLight ? '#047857' : '#3fb950')
                : feedbackMsg.type === 'error'
                ? (isLight ? '#dc2626' : '#f85149')
                : (isLight ? '#b45309' : '#d29922')
            }}>
              {feedbackMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
              <span>{feedbackMsg.text}</span>
            </div>
          )}

        </div>

        {/* Modal Footer / Action Buttons */}
        <div className="shop1-pause-modal-footer" style={{
          background: isLight ? '#f8fafc' : '#161b22',
          borderTop: isLight ? '1px solid #e2e8f0' : '1px solid #30363d'
        }}>
          {/* Button: Put on Pause */}
          <button
            type="button"
            onClick={handleBulkPause}
            disabled={isSubmitting || targetWorkingCount === 0}
            className="shop1-pause-btn-pause"
            style={{
              background: targetWorkingCount > 0 ? (isLight ? '#dc2626' : '#da3633') : (isLight ? '#e2e8f0' : '#21262d'),
              border: 'none',
              color: targetWorkingCount > 0 ? '#ffffff' : (isLight ? '#94a3b8' : '#484f58'),
              padding: '12px 22px',
              borderRadius: '12px',
              fontSize: '0.92rem',
              fontWeight: 900,
              cursor: targetWorkingCount > 0 && !isSubmitting ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              boxShadow: targetWorkingCount > 0
                ? (isLight ? '0 4px 14px rgba(220, 38, 38, 0.35)' : '0 4px 14px rgba(218,54,51,0.35)')
                : 'none',
              opacity: targetWorkingCount > 0 ? 1 : 0.6
            }}
          >
            <PauseCircle size={20} />
            <span>ПОСТАВИТИ НА ПАУЗУ ({targetWorkingCount})</span>
          </button>

          <div className="shop1-pause-mobile-footer-row">
            {/* Button: Resume / Unpause */}
            <button
              type="button"
              onClick={handleBulkResume}
              disabled={isSubmitting || targetPausedCount === 0}
              className="shop1-pause-btn-resume"
              style={{
                background: targetPausedCount > 0 ? (isLight ? '#16a34a' : '#238636') : (isLight ? '#e2e8f0' : '#21262d'),
                border: 'none',
                color: targetPausedCount > 0 ? '#ffffff' : (isLight ? '#94a3b8' : '#484f58'),
                padding: '12px 20px',
                borderRadius: '12px',
                fontSize: '0.9rem',
                fontWeight: 900,
                cursor: targetPausedCount > 0 && !isSubmitting ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                opacity: targetPausedCount > 0 ? 1 : 0.6
              }}
            >
              <PlayCircle size={18} />
              <span>ВІДНОВИТИ ({targetPausedCount})</span>
            </button>

            {/* Button: Close */}
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="shop1-pause-btn-close"
              style={{
                background: isLight ? '#ffffff' : '#21262d',
                border: isLight ? '1px solid #cbd5e1' : '1px solid #30363d',
                color: isLight ? '#334155' : '#c9d1d9',
                padding: '12px 20px',
                borderRadius: '12px',
                fontSize: '0.9rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Закрити
            </button>
          </div>
        </div>
      </div>
    </div>
  </>
  )
}
