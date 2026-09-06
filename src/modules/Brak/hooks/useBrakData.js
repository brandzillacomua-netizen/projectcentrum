import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMES } from '../../../MESContext.jsx'
import { useScrapReasons } from '../../../hooks/useScrapReasons.js'
import { useRestorationStages } from '../../../hooks/useRestorationStages.js'
import { getIndexedCache, setIndexedCache } from '../../../services/indexedDbCache.js'

import { createRestorationFromQualityHold, createRestorationFromScrapLot, createReworkFromScrapLot, fetchRecoverableScrapLots, returnQualityHoldToRoute } from '../../VKYA/quality-hold/qualityHoldService.js'
import { buildLegacyRecoverableInventoryItems, buildQualityStatusTotals, buildRecoverableScrapLotItems } from '../../VKYA/quality-hold/qualityHoldModel.js'


import { reportDateBoundaryIso, normalizeScrapReasonName, isScrapReadyForQc, matchesOperator } from '../utils/brakHelpers'
import { executeAtomicQcScrap } from '../../../services/atomicQcScrapService.js'
import { incrementInventoryStock } from '../../../services/inventoryStockService.js'
import { triggerHapticAudioFeedback } from '../../../services/scannerDebounceGuard.js'

const VKYA_QUEUE_CACHE_KEY = 'VKYA_CLASSIFICATION_QUEUE_V1'
const VKYA_REPORT_CACHE_TTL_MS = 30 * 1000

export function useBrakData() {
  const navigate = useNavigate()
  const { inventory, nomenclatures, fetchData, currentUser, disposeScrapItem, createReworkNaryad, workCards, orders, machineCalls, machines, supabase, systemUsers } = useMES()
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [distribution, setDistribution] = useState({ 1: 0, 4: 0 })
  const [reasonAllocations, setReasonAllocations] = useState([{ reason: '', qty: 0 }])
  const [viewingCategory, setViewingCategory] = useState(null)
  const [restorationDraft, setRestorationDraft] = useState(null)
  const [restorationQuantity, setRestorationQuantity] = useState('')
  const [restorationStageId, setRestorationStageId] = useState('')
  const [routeReturnDraft, setRouteReturnDraft] = useState(null)
  const [reworkDraft, setReworkDraft] = useState(null)
  const [reworkQuantity, setReworkQuantity] = useState('')
  const [recoverableScrapLots, setRecoverableScrapLots] = useState([])
  const [recoverableLotsAvailable, setRecoverableLotsAvailable] = useState(true)
  const { rows: scrapReasonRows, names: scrapReasons } = useScrapReasons()
  const { rows: restorationStages } = useRestorationStages()

  const loadRecoverableScrapLots = useCallback(async () => {
    try {
      setRecoverableScrapLots(await fetchRecoverableScrapLots(supabase))
      setRecoverableLotsAvailable(true)
    } catch (error) {
      const missingProjection = error?.code === '42P01' || error?.code === 'PGRST205'
      if (!missingProjection) console.error('Failed to load recoverable scrap lots:', error)
      setRecoverableScrapLots([])
      setRecoverableLotsAvailable(false)
    }
  }, [supabase])

  useEffect(() => {
    const initialLoadTimer = setTimeout(loadRecoverableScrapLots, 0)
    const channel = supabase.channel('vkya-recoverable-scrap-lots-ui')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vkya_scrap_lot_allocations' }, loadRecoverableScrapLots)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scrap_classification_categories' }, loadRecoverableScrapLots)
      .subscribe()
    return () => {
      clearTimeout(initialLoadTimer)
      supabase.removeChannel(channel)
    }
  }, [supabase, loadRecoverableScrapLots])

  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState(null)
  const [manualCardNumber, setManualCardNumber] = useState('')
  const [scannedCard, setScannedCard] = useState(null)
  const [qcInspector, setQcInspector] = useState('')
  const [qcScrapCount, setQcScrapCount] = useState(0)
  const [qcReason, setQcReason] = useState('Биття цанги')
  const [qcCustomReason, setQcCustomReason] = useState('')
  const [qcCardOperators, setQcCardOperators] = useState([])
  const [qcResponsibleOperator, setQcResponsibleOperator] = useState('')

  // QC Reports Modal States
  const [showReportPage, setShowReportPage] = useState(false)
  const [scrapReportSubTab, setScrapReportSubTab] = useState('cases')
  const todayStr = new Date().toISOString().split('T')[0]
  const [reportStartDate, setReportStartDate] = useState(todayStr)
  const [reportEndDate, setReportEndDate] = useState(todayStr)
  const [reportWorkCardHistory, setReportWorkCardHistory] = useState([])
  const [reportScrapReasonsDb, setReportScrapReasonsDb] = useState([])
  const [reportClassifiedHistoryIds, setReportClassifiedHistoryIds] = useState(new Set())
  const [reportIsSyncing, setReportIsSyncing] = useState(false)
  const [reportLoadError, setReportLoadError] = useState('')
  const [reportSelectedShiftFilter, setReportSelectedShiftFilter] = useState('all')
  const [reportSelectedEmployeeFilter, setReportSelectedEmployeeFilter] = useState('all')
  const [reportSearchQuery, setReportSearchQuery] = useState('')
  const [reportQuickPeriod, setReportQuickPeriod] = useState('')
  const reportRangeCacheRef = useRef(new Map())
  const reportAnalyticsCacheRef = useRef(new Map())
  const reportRequestSeqRef = useRef(0)

  const reportFilterByDate = (dateString) => {
    if (!reportStartDate && !reportEndDate) return true
    if (!dateString) return false
    const d = new Date(dateString)
    
    if (reportStartDate) {
      const s = new Date(reportStartDate)
      s.setHours(0,0,0,0)
      if (d < s) return false
    }
    if (reportEndDate) {
      const e = new Date(reportEndDate)
      e.setHours(23,59,59,999)
      if (d > e) return false
    }
    return true
  }

  const fetchReportHistoryRange = async (startIso, endExclusiveIso) => {
    const cacheKey = `${startIso || 'all'}|${endExclusiveIso || 'open'}`
    const cached = reportRangeCacheRef.current.get(cacheKey)
    if (cached && Date.now() - cached.savedAt < VKYA_REPORT_CACHE_TTL_MS) return cached.rows

    const columns = 'id,nomenclature_id,operator_name,shift_name,stage_name,scrap_qty,qc_scrap_comment,completed_at'
    const applyRange = (query) => {
      let ranged = query.gt('scrap_qty', 0)
      if (startIso) ranged = ranged.gte('completed_at', startIso)
      if (endExclusiveIso) ranged = ranged.lt('completed_at', endExclusiveIso)
      return ranged
    }

    const pageSize = 1000
    const rows = []
    for (let from = 0; ; from += pageSize) {
      const result = await applyRange(
        supabase
          .from('work_card_history')
          .select(columns)
          .order('completed_at', { ascending: false })
          .order('id', { ascending: false })
          .range(from, from + pageSize - 1)
      )
      if (result.error) throw result.error
      const page = result.data || []
      rows.push(...page)
      if (page.length < pageSize) break
    }
    reportRangeCacheRef.current.set(cacheKey, { rows, savedAt: Date.now() })
    return rows
  }

  const fetchReportReasonAnalytics = async (startIso, endExclusiveIso) => {
    const cacheKey = `${startIso || 'all'}|${endExclusiveIso || 'open'}`
    const cached = reportAnalyticsCacheRef.current.get(cacheKey)
    if (cached && Date.now() - cached.savedAt < VKYA_REPORT_CACHE_TTL_MS) return cached

    const fetchAllPages = async (buildQuery) => {
      const rows = []
      const pageSize = 1000
      for (let from = 0; ; from += pageSize) {
        const result = await buildQuery().range(from, from + pageSize - 1)
        if (result.error) throw result.error
        const page = result.data || []
        rows.push(...page)
        if (page.length < pageSize) break
      }
      return rows
    }

    const reasonRows = await fetchAllPages(() => {
      let query = supabase
        .from('scrap_report_by_reason')
        .select('*')
        .order('report_day', { ascending: false })
        .order('reason_name', { ascending: true })
      if (startIso) query = query.gte('report_day', startIso)
      if (endExclusiveIso) query = query.lt('report_day', endExclusiveIso)
      return query
    })

    const classificationRows = await fetchAllPages(() => {
      let query = supabase
        .from('scrap_classifications')
        .select('id,source_history_id')
        .order('classified_at', { ascending: false })
        .order('id', { ascending: false })
      if (startIso) query = query.gte('classified_at', startIso)
      if (endExclusiveIso) query = query.lt('classified_at', endExclusiveIso)
      return query
    })

    const result = { reasonRows, classificationRows, savedAt: Date.now() }
    reportAnalyticsCacheRef.current.set(cacheKey, result)
    return result
  }

  const syncReportHistory = async (startStr, endStr) => {
    const requestSeq = ++reportRequestSeqRef.current
    setReportIsSyncing(true)
    setReportLoadError('')
    const startIso = reportDateBoundaryIso(startStr)
    const endExclusiveIso = reportDateBoundaryIso(endStr, true)

    try {
      const completeHistory = await fetchReportHistoryRange(startIso, endExclusiveIso)
      if (requestSeq === reportRequestSeqRef.current) setReportWorkCardHistory(completeHistory)

      if (scrapReportSubTab === 'reasons') {
        const { reasonRows, classificationRows } = await fetchReportReasonAnalytics(startIso, endExclusiveIso)
        if (requestSeq === reportRequestSeqRef.current) {
          setReportScrapReasonsDb(reasonRows)
          setReportClassifiedHistoryIds(new Set(classificationRows.map(r => r.source_history_id)))
        }
      }
    } catch (err) {
      console.error("Failed to sync report history range:", err)
      if (requestSeq === reportRequestSeqRef.current) {
        setReportLoadError(err?.message || 'Не вдалося завантажити дані за обраний період')
      }
    } finally {
      if (requestSeq === reportRequestSeqRef.current) setReportIsSyncing(false)
    }
  }

  useEffect(() => {
    if (showReportPage) {
      syncReportHistory(reportStartDate, reportEndDate)
    }
  }, [reportStartDate, reportEndDate, showReportPage, scrapReportSubTab])

  const handleReportQuickDateSelect = (e) => {
    const val = e.target.value
    if (!val) return
    
    const today = new Date()
    const toISO = (d) => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    const todayStr = toISO(today)
    let startStr = ''
    let endStr = todayStr

    if (val === 'today') {
      startStr = todayStr
    } else if (val === 'yesterday') {
      const yest = new Date()
      yest.setDate(yest.getDate() - 1)
      startStr = toISO(yest)
      endStr = startStr
    } else if (val === '3days') {
      const d = new Date()
      d.setDate(d.getDate() - 2)
      startStr = toISO(d)
    } else if (val === 'week') {
      const d = new Date()
      d.setDate(d.getDate() - 6)
      startStr = toISO(d)
    } else if (val === 'month') {
      const d = new Date(today.getFullYear(), today.getMonth(), 1)
      startStr = toISO(d)
    } else if (val === 'previous_month') {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const to = new Date(today.getFullYear(), today.getMonth(), 0)
      startStr = toISO(from)
      endStr = toISO(to)
    } else if (val === 'quarter') {
      const d = new Date()
      d.setMonth(d.getMonth() - 3)
      startStr = toISO(d)
    } else if (val === 'halfyear') {
      const d = new Date()
      d.setMonth(d.getMonth() - 6)
      startStr = toISO(d)
    } else if (val === 'year') {
      const d = new Date()
      d.setFullYear(d.getFullYear() - 1)
      startStr = toISO(d)
    } else if (val === 'all') {
      startStr = ''
    }

    setReportStartDate(startStr)
    setReportEndDate(endStr)
    setReportQuickPeriod(val)
  }

  const reportUniqueOperators = useMemo(() => {
    const ops = new Set()
    ;(systemUsers || []).forEach(u => {
      const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim()
      if (fullName) ops.add(fullName)
    })
    reportWorkCardHistory.forEach(h => {
      if (h.operator_name) ops.add(h.operator_name)
    })
    return Array.from(ops).filter(Boolean).sort()
  }, [systemUsers, reportWorkCardHistory])

  const reportScrapStats = useMemo(() => {
    const list = reportWorkCardHistory
      .filter(h => Number(h.scrap_qty) > 0 && reportFilterByDate(h.completed_at) && (reportSelectedShiftFilter === 'all' || h.shift_name === reportSelectedShiftFilter) && matchesOperator(h.operator_name, reportSelectedEmployeeFilter))
      .map(h => {
        const nom = nomenclatures.find(n => n.id === h.nomenclature_id)
        
        let cat1 = 0, cat2 = 0, cat3 = 0, cat4 = 0
        if (h.qc_scrap_comment && h.qc_scrap_comment.includes('SCRAP_CAT:')) {
          try {
            const match = h.qc_scrap_comment.match(/\[SCRAP_CAT:([^\]]+)\]/)
            if (match) {
              const cats = JSON.parse(match[1])
              cat1 = Number(cats.cat1 || 0)
              cat2 = Number(cats.cat2 || 0)
              cat3 = Number(cats.cat3 || 0)
              cat4 = Number(cats.cat4 || 0)
            }
          } catch (e) {}
        }
        
        const totalClassified = cat1 + cat2 + cat3 + cat4
        const unclassified = Math.max(0, Number(h.scrap_qty) - totalClassified)

        return {
          ...h,
          nom_name: nom ? nom.name : 'Невідома деталь',
          cat1,
          cat2,
          cat3,
          cat4,
          unclassified
        }
      })
      .filter(h => !reportSearchQuery || h.nom_name.toLowerCase().includes(reportSearchQuery.toLowerCase()) || h.operator_name.toLowerCase().includes(reportSearchQuery.toLowerCase()))
      .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))

    const totalScrap = list.reduce((acc, curr) => acc + Number(curr.scrap_qty), 0)
    
    const byStage = list.reduce((acc, curr) => {
      acc[curr.stage_name] = (acc[curr.stage_name] || 0) + Number(curr.scrap_qty)
      return acc
    }, {})

    return { list, totalScrap, byStage }
  }, [reportWorkCardHistory, nomenclatures, reportStartDate, reportEndDate, reportSearchQuery, reportSelectedShiftFilter, reportSelectedEmployeeFilter])

  const reportScrapReasonsStats = useMemo(() => {
    const reasonsMap = {}
    let totalScrapQty = 0

    reportScrapReasonsDb.forEach(row => {
      if (reportSelectedEmployeeFilter !== 'all' && !matchesOperator(row.source_operator_name, reportSelectedEmployeeFilter)) return

      const reason = normalizeScrapReasonName(row.reason_name || 'Причина не вказана')
      const qty = Number(row.quantity) || 0
      if (qty <= 0) return

      const nom = nomenclatures.find(n => n.id === row.nomenclature_id)
      const nomName = nom ? nom.name : 'Невідома деталь'
      totalScrapQty += qty

      if (!reasonsMap[reason]) {
        reasonsMap[reason] = {
          name: reason,
          quantity: 0,
          items: {},
          operators: {}
        }
      }
      reasonsMap[reason].quantity += qty
      reasonsMap[reason].items[nomName] = (reasonsMap[reason].items[nomName] || 0) + qty
      reasonsMap[reason].operators[row.source_operator_name || 'Невідомий'] = (reasonsMap[reason].operators[row.source_operator_name || 'Невідомий'] || 0) + qty
    })

    reportWorkCardHistory
      .filter(h => !reportClassifiedHistoryIds.has(h.id) && Number(h.scrap_qty) > 0 && reportFilterByDate(h.completed_at) && (reportSelectedShiftFilter === 'all' || h.shift_name === reportSelectedShiftFilter) && matchesOperator(h.operator_name, reportSelectedEmployeeFilter))
      .forEach(h => {
        let reasons = {}
        if (h.qc_scrap_comment && h.qc_scrap_comment.includes('SCRAP_REASONS:')) {
          try {
            const match = h.qc_scrap_comment.match(/\[SCRAP_REASONS:([^\]]+)\]/)
            if (match) {
              reasons = JSON.parse(match[1])
            }
          } catch (e) {}
        } else {
          let reasonName = h.qc_scrap_comment || 'Причина не вказана'
          if (reasonName.includes('Причина:')) {
            reasonName = reasonName.split('Причина:')[1].trim()
          }
          reasonName = reasonName.replace(/\[SCRAP_CAT:[^\]]+\]/g, '').replace(/\[SCRAP_REASONS:[^\]]+\]/g, '').trim()
          if (!reasonName) {
            reasonName = 'Причина не вказана'
          }
          reasons[reasonName] = Number(h.scrap_qty) || 0
        }

        const nom = nomenclatures.find(n => n.id === h.nomenclature_id)
        const nomName = nom ? nom.name : 'Невідома деталь'

        Object.entries(reasons).forEach(([rawReason, qty]) => {
          const reason = normalizeScrapReasonName(rawReason)
          const numQty = Number(qty)
          if (numQty <= 0) return

          totalScrapQty += numQty

          if (!reasonsMap[reason]) {
            reasonsMap[reason] = {
              name: reason,
              quantity: 0,
              items: {},
              operators: {}
            }
          }

          reasonsMap[reason].quantity += numQty
          reasonsMap[reason].items[nomName] = (reasonsMap[reason].items[nomName] || 0) + numQty
          reasonsMap[reason].operators[h.operator_name || 'Невідомий'] = (reasonsMap[reason].operators[h.operator_name || 'Невідомий'] || 0) + numQty
        })
      })

    return Object.values(reasonsMap)
      .map(r => {
        const topItem = Object.entries(r.items).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
        const topOperator = Object.entries(r.operators).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
        return {
          ...r,
          percentage: totalScrapQty > 0 ? ((r.quantity / totalScrapQty) * 100).toFixed(1) : '0.0',
          topItem,
          topOperator
        }
      })
      .sort((a, b) => b.quantity - a.quantity)
  }, [reportWorkCardHistory, reportScrapReasonsDb, reportClassifiedHistoryIds, nomenclatures, reportStartDate, reportEndDate, reportSelectedShiftFilter, reportSelectedEmployeeFilter])

  const activeCalls = (machineCalls || []).filter(c => 
    c.status === 'pending' && 
    (c.called_role === 'quality' || c.called_role === 'qc') && 
    (!c.called_employee_id || c.called_employee_id === currentUser?.id)
  )

  const handleResolveCall = async (callId) => {
    const resolverName = currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() : 'Фахівець ВКЯ'
    const { error } = await supabase
      .from('machine_calls')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: resolverName
      })
      .eq('id', callId)
    if (error) {
      alert('Помилка при вирішенні виклику: ' + error.message)
    }
  }

  const openQcCardByNumber = async () => {
    const cardNumber = String(manualCardNumber || '')
      .replace(/^CENTRUM_CARD_/i, '')
      .replace(/^#/, '')
      .trim()

    if (!cardNumber) {
      setScanError('Введіть системний номер картки.')
      return
    }

    try {
      const normalizedNumber = cardNumber.toLowerCase()
      let foundCard = (workCards || []).find(card => {
        const id = String(card.id || '').trim().toLowerCase()
        const info = String(card.card_info || '').toLowerCase()
        return id.includes(normalizedNumber) || info.includes(normalizedNumber)
      })

      if (!foundCard) {
        const { data, error } = await supabase
          .from('work_cards')
          .select('*')
          .ilike('id', `%${cardNumber}%`)
          .limit(1)
          .maybeSingle()
        if (error && error.code !== 'PGRST116') throw error
        foundCard = data
      }

      if (!foundCard) {
        setScanError(`Картку №${cardNumber} не знайдено. Можна вводити повний UUID або короткий системний номер.`)
        return
      }

      const { data: operatorHistory, error: operatorHistoryError } = await supabase
        .from('work_card_history')
        .select('operator_name,stage_name')
        .eq('card_id', foundCard.id)
        .order('created_at', { ascending: true })
      if (operatorHistoryError) throw operatorHistoryError

      const operators = [...new Set([
        foundCard.operator_name,
        ...(operatorHistory || [])
          .filter(row => row.stage_name !== 'Контроль ВКЯ')
          .map(row => row.operator_name)
      ]
        .map(name => String(name || '').trim())
        .filter(name => name && !name.toLowerCase().startsWith('вкя') && name !== 'Не вказано'))]

      setScannedCard(foundCard)
      setQcCardOperators(operators)
      setQcResponsibleOperator(operators.length === 1 ? operators[0] : '')
      setQcScrapCount(0)
      setManualCardNumber('')
      setScanError(null)
    } catch (error) {
      console.error('QC manual card lookup error:', error)
      setScanError(`Не вдалося відкрити картку: ${error?.message || 'помилка пошуку'}`)
    }
  }

  // QR Scanner Handler Effect
  useEffect(() => {
    let html5QrCode = null
    if (isScanning && window.Html5Qrcode) {
      html5QrCode = new window.Html5Qrcode("qc-reader")
      const config = { fps: 15, qrbox: { width: 260, height: 260 } }
      const stopAndClose = async () => {
        if (html5QrCode && html5QrCode.isScanning) await html5QrCode.stop().catch(() => { })
        setIsScanning(false)
      }
      html5QrCode.start({ facingMode: "environment" }, config, async (decodedText) => {
        try {
          let cardIdStr = String(decodedText || '').trim()
          try {
            const qrData = JSON.parse(decodedText)
            cardIdStr = String(qrData.id || qrData.card_id || qrData.cardId || cardIdStr).trim()
          } catch (e) { }

          cardIdStr = cardIdStr.replace(/^CENTRUM_CARD_/i, '').replace(/^#/, '').trim()

          if (!cardIdStr) {
            await stopAndClose()
            triggerHapticAudioFeedback(false)
            setScanError('QR-код картки порожній або має невірний формат.')
            return
          }

          await stopAndClose()
          let foundCard = (workCards || []).find(c => {
            const currentId = String(c.id || '').trim().toLowerCase()
            const scannedId = cardIdStr.toLowerCase()
            return currentId === scannedId || currentId.endsWith(scannedId)
          })

          if (!foundCard) {
            const { data: dbCard, error: dbError } = await supabase
              .from('work_cards')
              .select('*')
              .eq('id', cardIdStr)
              .maybeSingle()

            if (dbError) throw dbError
            foundCard = dbCard
          }

          if (!foundCard) {
            triggerHapticAudioFeedback(false)
            setScanError(`Картку №${cardIdStr} не знайдено в базі.`)
          } else {
            triggerHapticAudioFeedback(true)
            const { data: operatorHistory, error: operatorHistoryError } = await supabase
              .from('work_card_history')
              .select('operator_name,stage_name')
              .eq('card_id', foundCard.id)
              .order('created_at', { ascending: true })
            if (operatorHistoryError) throw operatorHistoryError

            const operators = [...new Set([
              foundCard.operator_name,
              ...(operatorHistory || [])
                .filter(row => row.stage_name !== 'Контроль ВКЯ')
                .map(row => row.operator_name)
            ]
              .map(name => String(name || '').trim())
              .filter(name => name && !name.toLowerCase().startsWith('вкя') && name !== 'Не вказано'))]

            setScannedCard(foundCard)
            setQcCardOperators(operators)
            setQcResponsibleOperator(operators.length === 1 ? operators[0] : '')
            setQcScrapCount(0)
            setScanError(null)
          }
        } catch (e) {
          console.error('QC card scan error:', e)
          setScanError(`Не вдалося відкрити картку: ${e?.message || 'помилка зчитування QR'}`)
        }
      }).catch(err => { setScanError("Помилка камери: " + err); setIsScanning(false) })
    }
    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(() => {})
      }
    }
  }, [isScanning, workCards, supabase])

  const updateInventoryStock = async (nomId, qty, type = 'scrap_ready') => {
    if (!nomId || qty <= 0) return
    try {
      await incrementInventoryStock({
        nomenclatureId: nomId,
        qty,
        type,
        nomenclatures
      })
    } catch (e) {
      console.warn(`Stock update failed for type ${type}:`, e)
      throw e
    }
  }

  const handleQCScrapOverride = async () => {
    if (!scannedCard || qcScrapCount <= 0) return
    if (!qcResponsibleOperator) {
      alert(qcCardOperators.length > 1
        ? 'Оберіть оператора, якому потрібно присвоїти цей брак.'
        : 'У картці не знайдено виробничого оператора. Спочатку вкажіть відповідального оператора.')
      return
    }
    if (qcScrapCount > scannedCard.quantity) {
      alert('Кількість браку не може перевищувати поточну кількість деталей у картці!')
      return
    }
    setIsProcessing(true)
    try {
      const { data: freshCard, error: freshCardError } = await supabase
        .from('work_cards')
        .select('*')
        .eq('id', scannedCard.id)
        .maybeSingle()
      if (freshCardError) throw freshCardError
      if (!freshCard) throw new Error('Картку не знайдено в базі')
      if (Number(freshCard.quantity) !== Number(scannedCard.quantity)) {
        setScannedCard(freshCard)
        setQcScrapCount(0)
        alert('Кількість у картці вже змінилася. Дані оновлено, введення браку скинуто — перевірте картку та введіть актуальну кількість.')
        return
      }

      const inspectorName = qcInspector || 'відповідальний ВКЯ'
      const newQty = Math.max(0, scannedCard.quantity - qcScrapCount)

      const historyData = {
        nomenclature_id: scannedCard.nomenclature_id,
        stage_name: 'Контроль ВКЯ',
        operator_name: qcResponsibleOperator,
        shift_name: scannedCard.shift_name,
        manager_name: scannedCard.manager_name,
        machine_name: scannedCard.machine,
        qc_scrap_reason: qcReason,
        qc_scrap_comment: qcReason === 'Інше (коментар)' ? qcCustomReason : null,
        card_info: `${scannedCard.card_info || ''} [QC_INSPECTOR:${inspectorName}] [VKYA_SOURCE_STATUS:${freshCard.status || ''}] [VKYA_SOURCE_OPERATION:${freshCard.operation || ''}]`.trim(),
        started_at: new Date().toISOString()
      }

      const updatePayload = { quantity: newQty }
      if (newQty === 0) {
        updatePayload.status = 'completed'
      }

      const idempotencyKey = `qc_scrap_brak_${scannedCard.id}_${Date.now()}`

      const res = await executeAtomicQcScrap({
        cardId: scannedCard.id,
        scrapQty: qcScrapCount,
        historyData,
        idempotencyKey,
        fallbackFn: async () => {
          const { error: historyError } = await supabase.from('work_card_history').insert([{
            card_id: scannedCard.id,
            ...historyData,
            qty_at_start: scannedCard.quantity,
            qty_completed: newQty,
            scrap_qty: qcScrapCount,
            completed_at: new Date().toISOString(),
            is_archived_scrap: true
          }])
          if (historyError) throw historyError

          const { error: cardUpdateError } = await supabase.from('work_cards').update(updatePayload).eq('id', scannedCard.id)
          if (cardUpdateError) throw cardUpdateError

          await updateInventoryStock(scannedCard.nomenclature_id, qcScrapCount, 'scrap_ready')
        }
      })

      if (!res.success) {
        throw new Error(res.error || res.message || 'Не вдалося списати брак через сервер')
      }

      const recordedScrap = qcScrapCount
      setScannedCard(null)
      setQcScrapCount(0)
      setQcInspector('')
      setQcReason('Биття цанги')
      setQcCustomReason('')
      setQcCardOperators([])
      setQcResponsibleOperator('')
      await fetchData(['work_cards', 'work_card_history', 'inventory', 'tasks'])
      alert(`✅ ${recordedScrap} шт передано в очікування класифікації ВКЯ.`)
    } catch (e) {
      console.error('QC error:', e)
      alert('Помилка фіксації браку ВКЯ: ' + e.message)
    } finally { setIsProcessing(false) }
  }

  const [localScrapHistory, setLocalScrapHistory] = useState([])
  const [queuePage, setQueuePage] = useState(1)
  const [scrapSourceMeta, setScrapSourceMeta] = useState({ cards: {}, tasks: {}, orders: {}, sequences: {} })
  const queueCursorRef = useRef(null)
  const queueProjectionRef = useRef(new Map())
  const queueSyncPromiseRef = useRef(null)
  const queueResyncRequestedRef = useRef(false)
  const scrapSourceMetaRef = useRef({ cards: {}, tasks: {}, orders: {}, sequences: {}, taskSequences: {} })

  const loadScrapHistory = async ({ restoreCache = false } = {}) => {
    if (queueSyncPromiseRef.current) {
      queueResyncRequestedRef.current = true
      return queueSyncPromiseRef.current
    }
    const syncPromise = (async () => {
    try {
      let cachedQueue = null
      if (restoreCache) {
        try {
          cachedQueue = await getIndexedCache(VKYA_QUEUE_CACHE_KEY)
          if (cachedQueue?.version === 1) {
            queueCursorRef.current = Number(cachedQueue.cursor) || 0
            queueProjectionRef.current = new Map(
              (cachedQueue.projection || []).map(row => [`${row.source_type}:${row.source_id}`, row])
            )
            if (Array.isArray(cachedQueue.activeScrap)) setLocalScrapHistory(cachedQueue.activeScrap)
            if (cachedQueue.sourceMeta) {
              scrapSourceMetaRef.current = cachedQueue.sourceMeta
              setScrapSourceMeta(cachedQueue.sourceMeta)
            }
          }
        } catch (cacheError) {
          console.warn('Failed to restore VKYA queue cache:', cacheError)
        }
      }

      const { data: projectionResult, error: projectionError } = await supabase.rpc(
        'vkya_classification_queue_changes',
        { p_after_seq: queueCursorRef.current }
      )

      let historyResult
      let restorationReturnsResult
      let projectionChanged = false

      if (!projectionError && projectionResult) {
        const changes = Array.isArray(projectionResult.changes) ? projectionResult.changes : []
        const projection = new Map(queueProjectionRef.current)
        changes.forEach(change => {
          const key = `${change.source_type}:${change.source_id}`
          if (change.is_active) projection.set(key, change)
          else projection.delete(key)
        })
        projectionChanged = changes.length > 0 || !cachedQueue
        queueProjectionRef.current = projection
        queueCursorRef.current = Number(projectionResult.cursor) || queueCursorRef.current || 0

        if (!projectionChanged && cachedQueue) return

        const projectionRows = [...projection.values()]
        historyResult = {
          data: projectionRows
            .filter(row => row.source_type === 'history')
            .map(row => row.payload),
          error: null
        }
        restorationReturnsResult = {
          data: projectionRows
            .filter(row => row.source_type === 'restoration_return')
            .map(row => row.payload),
          error: null
        }
      } else {
        ;[historyResult, restorationReturnsResult] = await Promise.all([
          supabase.from('work_card_history').select('*').gt('scrap_qty', 0)
            .or('is_archived_scrap.eq.true,card_info.ilike.%[ЦЕХ №2]%')
            .order('created_at', { ascending: false }),
          supabase.from('vkya_reclassification_queue').select('*').eq('status', 'pending').order('created_at', { ascending: false })
        ])
      }
      if (restorationReturnsResult.error && restorationReturnsResult.error.code !== '42P01') {
        console.warn('Failed to load VKYA restoration returns:', restorationReturnsResult.error.message)
      }
      const restorationReturns = (restorationReturnsResult.data || []).map(row => ({
        id: row.id,
        card_id: row.source_card_id || null,
        task_id: row.source_task_id || null,
        order_id: row.source_order_id || null,
        nomenclature_id: row.nomenclature_id,
        operator_name: 'Термінал відновлення ВКЯ',
        stage_name: row.source_stage,
        scrap_qty: row.quantity,
        qc_scrap_comment: row.classified_quantity > 0
          ? `[SCRAP_CAT:${JSON.stringify({ classified: row.classified_quantity })}]`
          : null,
        is_archived_scrap: true,
        is_vkya_return: true,
        restoration_return_row: row,
        created_at: row.created_at,
        completed_at: row.created_at
      }))
      const data = [...(historyResult.data || []), ...restorationReturns]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      if (!historyResult.error) {
        const activeScrap = data.filter(h => {
          let sum = 0
          if (h.qc_scrap_comment && h.qc_scrap_comment.includes('SCRAP_CAT:')) {
            try {
              const match = h.qc_scrap_comment.match(/\[SCRAP_CAT:([^\]]+)\]/)
              if (match) {
                const cats = JSON.parse(match[1])
                sum = Object.values(cats).reduce((a, b) => a + Number(b), 0)
              }
            } catch(e) {}
          }
          const ledgerClassified = Number(h.classified_quantity)
          if (Number.isFinite(ledgerClassified)) sum = Math.max(sum, ledgerClassified)
          return Math.max(0, Number(h.scrap_qty) - sum) > 0
        })

        const cardIds = [...new Set(activeScrap.map(row => row.card_id).filter(Boolean))]
        const existingMeta = scrapSourceMetaRef.current
        const missingCardIds = cardIds.filter(id => !existingMeta.cards[String(id)])
        const { data: sourceCardsData } = missingCardIds.length
          ? await supabase.from('work_cards').select('id,task_id,order_id,created_at').in('id', missingCardIds)
          : { data: [] }
        const sourceCards = [
          ...cardIds.map(id => existingMeta.cards[String(id)]).filter(Boolean),
          ...(sourceCardsData || [])
        ]
        const taskIds = [...new Set(sourceCards.map(card => card.task_id).filter(Boolean))]
        const missingTaskIds = taskIds.filter(id => !existingMeta.tasks[String(id)])
        const { data: sourceTasksData } = missingTaskIds.length
          ? await supabase.from('tasks').select('id,order_id,batch_index,step,plan_snapshot').in('id', missingTaskIds)
          : { data: [] }
        const sourceTasks = [
          ...taskIds.map(id => existingMeta.tasks[String(id)]).filter(Boolean),
          ...(sourceTasksData || [])
        ]
        const orderIds = [...new Set([
          ...sourceCards.map(card => card.order_id),
          ...sourceTasks.map(task => task.order_id)
        ].filter(Boolean))]
        const missingOrderIds = orderIds.filter(id => !existingMeta.orders[String(id)])
        const { data: sourceOrdersData } = missingOrderIds.length
          ? await supabase.from('orders').select('id,order_num').in('id', missingOrderIds)
          : { data: [] }
        const sourceOrders = [
          ...orderIds.map(id => existingMeta.orders[String(id)]).filter(Boolean),
          ...(sourceOrdersData || [])
        ]

        const taskCards = []
        const sequenceTaskIds = [...new Set(sourceCards
          .filter(card => !existingMeta.sequences[String(card.id)])
          .map(card => card.task_id)
          .filter(Boolean))]
        if (sequenceTaskIds.length) {
          const pageSize = 1000
          for (let from = 0; ; from += pageSize) {
            const { data: page, error: pageError } = await supabase.from('work_cards')
              .select('id,task_id,nomenclature_id,created_at').in('task_id', sequenceTaskIds)
              .order('created_at', { ascending: true }).order('id', { ascending: true })
              .range(from, from + pageSize - 1)
            if (pageError || !page?.length) break
            taskCards.push(...page)
            if (page.length < pageSize) break
          }
        }
        const cardsByTask = taskCards.reduce((result, card) => {
          const key = String(card.task_id)
          if (!result[key]) result[key] = []
          result[key].push(card)
          return result
        }, {})
        const sequences = { ...(existingMeta.sequences || {}) }
        const taskSequences = { ...(existingMeta.taskSequences || {}) }
        Object.values(cardsByTask).forEach(cards => {
          cards.forEach((card, index) => { taskSequences[String(card.id)] = index + 1 })
          const cardsByNom = cards.reduce((result, card) => {
            const key = String(card.nomenclature_id || '')
            if (!result[key]) result[key] = []
            result[key].push(card)
            return result
          }, {})
          Object.values(cardsByNom).forEach(nomCards => {
            nomCards.forEach((card, index) => { sequences[String(card.id)] = index + 1 })
          })
        })

        const nextSourceMeta = {
          cards: { ...existingMeta.cards, ...Object.fromEntries(sourceCards.map(card => [String(card.id), card])) },
          tasks: { ...existingMeta.tasks, ...Object.fromEntries(sourceTasks.map(task => [String(task.id), task])) },
          orders: { ...existingMeta.orders, ...Object.fromEntries(sourceOrders.map(order => [String(order.id), order])) },
          sequences,
          taskSequences
        }
        scrapSourceMetaRef.current = nextSourceMeta
        setScrapSourceMeta(nextSourceMeta)
        setLocalScrapHistory(activeScrap)

        if (!projectionError && projectionResult) {
          setIndexedCache(VKYA_QUEUE_CACHE_KEY, {
            version: 1,
            cursor: queueCursorRef.current,
            projection: [...queueProjectionRef.current.values()],
            activeScrap,
            sourceMeta: nextSourceMeta,
            cachedAt: new Date().toISOString()
          }).catch(cacheError => console.warn('Failed to persist VKYA queue cache:', cacheError))
        }
      }
    } catch (e) {
      console.error('Failed to fetch local scrap history:', e)
    } finally {
      queueSyncPromiseRef.current = null
      if (queueResyncRequestedRef.current) {
        queueResyncRequestedRef.current = false
        setTimeout(() => loadScrapHistory(), 0)
      }
    }
    })()
    queueSyncPromiseRef.current = syncPromise
    return syncPromise
  }

  useEffect(() => {
    loadScrapHistory({ restoreCache: true })

    let reconcileTimer = null
    const scheduleReconcile = () => {
      if (reconcileTimer) clearTimeout(reconcileTimer)
      reconcileTimer = setTimeout(() => loadScrapHistory(), 350)
    }
    const channel = supabase
      .channel(`vkya-classification-queue-${currentUser?.id || 'session'}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'vkya_classification_queue_projection'
      }, scheduleReconcile)
      .subscribe(status => {
        if (status === 'SUBSCRIBED') scheduleReconcile()
      })

    const reconcileInterval = setInterval(() => {
      if (document.visibilityState === 'visible') loadScrapHistory()
    }, 5 * 60 * 1000)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') scheduleReconcile()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      if (reconcileTimer) clearTimeout(reconcileTimer)
      clearInterval(reconcileInterval)
      document.removeEventListener('visibilitychange', handleVisibility)
      supabase.removeChannel(channel)
    }
  }, [currentUser?.id])

  useEffect(() => {
    setDistribution({ 1: 0, 4: 0 })
    setReasonAllocations([{ reason: '', qty: 0 }])
  }, [selectedItem])

  const totalDistributed = Object.values(distribution).reduce((a, b) => a + b, 0)
  const totalReasonAllocated = reasonAllocations.reduce((sum, item) => sum + (Number(item.qty) || 0), 0)
  const hasMissingScrapReason = reasonAllocations.some(item => Number(item.qty) > 0 && !item.reason?.trim())
  const isReasonDistributionValid = totalDistributed > 0
    && totalReasonAllocated === totalDistributed
    && !hasMissingScrapReason
  const remainingInBatch = selectedItem ? Number(selectedItem.total_qty) - totalDistributed : 0
  const activeScrapReasons = scrapReasons.filter(reason => scrapReasonRows.find(row => row.name === reason)?.is_active !== false)

  const updateCategoryQty = (category, requestedQty) => {
    const otherQty = Object.entries(distribution)
      .filter(([key]) => String(key) !== String(category))
      .reduce((sum, [, qty]) => sum + (Number(qty) || 0), 0)
    const maxQty = Math.max(0, Number(selectedItem?.total_qty || 0) - otherQty)
    setDistribution(previous => ({
      ...previous,
      [category]: Math.min(maxQty, Math.max(0, Number(requestedQty) || 0))
    }))
  }

  const updateReasonQty = (index, requestedQty) => {
    setReasonAllocations(items => {
      const otherQty = items.reduce((sum, item, itemIndex) => itemIndex === index ? sum : sum + (Number(item.qty) || 0), 0)
      const maxQty = Math.max(0, totalDistributed - otherQty)
      return items.map((item, itemIndex) => itemIndex === index
        ? { ...item, qty: Math.min(maxQty, Math.max(0, Number(requestedQty) || 0)) }
        : item)
    })
  }

  useEffect(() => {
    setReasonAllocations(items => {
      let available = totalDistributed
      let changed = false
      const clamped = items.map(item => {
        const qty = Math.min(Math.max(0, Number(item.qty) || 0), available)
        available -= qty
        if (qty !== Number(item.qty || 0)) changed = true
        return changed ? { ...item, qty } : item
      })
      return changed ? clamped : items
    })
  }, [totalDistributed])

  const readyItems = useMemo(() => {
    return (localScrapHistory || [])
      .filter(h => isScrapReadyForQc(h) && Number(h.scrap_qty) > 0)
      .map(h => {
        let sum = 0
        if (h.qc_scrap_comment && h.qc_scrap_comment.includes('SCRAP_CAT:')) {
          try {
            const match = h.qc_scrap_comment.match(/\[SCRAP_CAT:([^\]]+)\]/)
            if (match) {
              const cats = JSON.parse(match[1])
              sum = Object.values(cats).reduce((a, b) => a + Number(b), 0)
            }
          } catch(e) {}
        }
        const ledgerClassified = Number(h.classified_quantity)
        if (Number.isFinite(ledgerClassified)) sum = Math.max(sum, ledgerClassified)
        const remaining = Math.max(0, Number(h.scrap_qty) - sum)
        if (remaining <= 0) return null
        
        const nom = nomenclatures?.find(n => n.id === h.nomenclature_id)
        const sourceCard = scrapSourceMeta.cards[String(h.card_id)]
          || workCards?.find(card => String(card.id) === String(h.card_id))
        const sourceTask = sourceCard?.task_id
          ? scrapSourceMeta.tasks[String(sourceCard.task_id)]
          : null
        const sourceOrderId = sourceTask?.order_id || sourceCard?.order_id
        const sourceOrder = sourceOrderId
          ? scrapSourceMeta.orders[String(sourceOrderId)] || orders?.find(order => String(order.id) === String(sourceOrderId))
          : null
        const taskNumber = sourceTask?.step === 'Підготовка' && sourceTask?.plan_snapshot?._prep_num
          ? sourceTask.plan_snapshot._prep_num
          : sourceOrder?.order_num
            ? `${sourceOrder.order_num}${sourceTask?.batch_index ? `/${sourceTask.batch_index}` : ''}`
            : sourceTask?.plan_snapshot?._prep_num || '—'
        return {
          id: h.id,
          is_history_row: !h.is_vkya_return,
          is_vkya_return: Boolean(h.is_vkya_return),
          history_row: h,
          nomenclature_id: h.nomenclature_id,
          name: h.restoration_return_row?.nomenclature_name || nom?.name || 'Деталь',
          unit: nom?.unit || 'шт',
          total_qty: remaining,
          operator: h.operator_name,
          stage: h.stage_name,
          updated_at: h.created_at,
          card_number: h.card_id ? String(h.card_id).slice(-8).toUpperCase() : '—',
          card_sequence: h.card_id ? scrapSourceMeta.sequences[String(h.card_id)] || null : null,
          task_card_sequence: h.card_id ? scrapSourceMeta.taskSequences?.[String(h.card_id)] || null : null,
          card_id: h.card_id,
          task_id: h.task_id || h.restoration_return_row?.source_task_id || sourceCard?.task_id || null,
          order_id: h.order_id || h.restoration_return_row?.source_order_id || sourceOrderId || null,
          naryad_number: taskNumber
        }
      })
      .filter(Boolean)
  }, [localScrapHistory, nomenclatures, scrapSourceMeta, workCards, orders])

  const filteredReadyItems = useMemo(() => {
    const q = manualCardNumber.trim().toLowerCase()
    if (!q) return readyItems

    return readyItems.filter(item => {
      const nomName = String(item.name || '').toLowerCase()
      const naryadNum = String(item.naryad_number || '').toLowerCase()
      const cardSeq = String(item.card_sequence || '').toLowerCase()
      const taskCardSeq = String(item.task_card_sequence || '').toLowerCase()
      const sysCardNum = String(item.card_number || '').toLowerCase()
      const fullCardId = String(item.card_id || '').toLowerCase()
      const operatorName = String(item.operator || '').toLowerCase()
      const stageName = String(item.stage || '').toLowerCase()

      return (
        nomName.includes(q) ||
        naryadNum.includes(q) ||
        cardSeq === q ||
        taskCardSeq === q ||
        sysCardNum.includes(q) ||
        fullCardId === q ||
        operatorName.includes(q) ||
        stageName.includes(q)
      )
    })
  }, [readyItems, manualCardNumber])

  const queuePageSize = 10
  const totalPages = Math.ceil(filteredReadyItems.length / queuePageSize)

  useEffect(() => {
    setQueuePage(1)
  }, [manualCardNumber])

  useEffect(() => {
    if (queuePage > 1 && queuePage > totalPages) {
      setQueuePage(Math.max(1, totalPages))
    }
  }, [totalPages, queuePage])

  const paginatedReadyItems = filteredReadyItems.slice((queuePage - 1) * queuePageSize, queuePage * queuePageSize)

  const [categoryPage, setCategoryPage] = useState(1)
  const categoryPageSize = 10

  const qualityStatusTotals = buildQualityStatusTotals(inventory || [], readyItems)

  const recoverableLotItems = buildRecoverableScrapLotItems(recoverableScrapLots)
  const legacyRecoverableItems = buildLegacyRecoverableInventoryItems(
    inventory || [],
    recoverableLotsAvailable ? recoverableScrapLots : []
  )
  const recoverableScrapItems = recoverableLotsAvailable
    ? [...recoverableLotItems, ...legacyRecoverableItems]
    : legacyRecoverableItems

  const itemsInCat = viewingCategory 
    ? (viewingCategory === 'restoration'
        ? (inventory || []).filter(i => i.type === 'scrap_restoration' && (Number(i.total_qty) > 0))
        : viewingCategory === 'brak'
          ? recoverableScrapItems
          : (inventory || []).filter(i => i.type === `scrap_cat_${viewingCategory}` && (Number(i.total_qty) > 0)))
    : []

  const categoryTotalPages = Math.ceil(itemsInCat.length / categoryPageSize)

  useEffect(() => {
    setCategoryPage(1)
  }, [viewingCategory])

  useEffect(() => {
    if (categoryPage > 1 && categoryPage > categoryTotalPages) {
      setCategoryPage(Math.max(1, categoryTotalPages))
    }
  }, [categoryTotalPages, categoryPage])

  const paginatedCategoryItems = itemsInCat.slice((categoryPage - 1) * categoryPageSize, categoryPage * categoryPageSize)
  const categoryTotalQuantity = useMemo(() => itemsInCat.reduce((sum, item) => sum + Number(item.total_qty || 0), 0), [itemsInCat])

  const viewingCategoryLabel = viewingCategory === 'brak'
    ? 'Брак'
    : viewingCategory === 4
        ? 'Утиль'
        : viewingCategory === 'restoration'
          ? 'Відновлення'
          : ''

  const handleBulkClassify = async () => {
    if (!selectedItem || totalDistributed <= 0) return
    if (totalDistributed > Number(selectedItem.total_qty)) {
      alert('Розподілено більше ніж є в наявності!')
      return
    }
    if (!isReasonDistributionValid) {
      alert('Розподіліть за причинами рівно ту саму кількість, що й за категоріями.')
      return
    }

    setIsProcessing(true)
    try {
      const categoriesToProcess = Object.entries(distribution).filter(([_, qty]) => Number(qty) > 0)
      
      for (const [cat, qty] of categoriesToProcess) {
        const type = `scrap_cat_${cat}`
        const numQty = Number(qty)
        
        const { data: existing } = await supabase.from('inventory')
          .select('*')
          .eq('nomenclature_id', selectedItem.nomenclature_id)
          .eq('type', type)
          .limit(1).maybeSingle()
          
        if (existing) {
          await supabase.from('inventory').update({
            total_qty: (Number(existing.total_qty) || 0) + numQty,
            updated_at: new Date().toISOString()
          }).eq('id', existing.id)
        } else {
          await supabase.from('inventory').insert([{
            nomenclature_id: selectedItem.nomenclature_id,
            name: selectedItem.name,
            unit: selectedItem.unit || 'шт',
            total_qty: numQty,
            type: type,
            updated_at: new Date().toISOString()
          }])
        }
      }
      
      const absoluteRemaining = Number(selectedItem.total_qty) - totalDistributed

      try {
        const sourceCard = scrapSourceMeta.cards[String(selectedItem.card_id)]
          || workCards?.find(card => String(card.id) === String(selectedItem.card_id))
        const sourceTask = sourceCard?.task_id
          ? scrapSourceMeta.tasks[String(sourceCard.task_id)]
          : null
        const sourceOrderId = sourceTask?.order_id || sourceCard?.order_id || selectedItem.order_id || null

        const categoriesParam = categoriesToProcess.map(([cat, qty]) => ({
          category: parseInt(cat),
          quantity: Number(qty)
        }))

        const reasonsParam = reasonAllocations
          .filter(r => r.reason && Number(r.qty) > 0)
          .map(r => {
            const reasonRow = scrapReasonRows.find(row => row.name === r.reason)
            return {
              reason_id: reasonRow?.id,
              quantity: Number(r.qty)
            }
          })

        const userName = currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() : 'Інспектор ВКЯ'

        let targetOperator = selectedItem.history_row.operator_name || null
        const sourceStage = String(selectedItem.stage || '').trim().toLowerCase()
        const assignToCuttingOperator = sourceStage === 'сортування'
          || sourceStage === 'прийомка'
          || sourceStage.startsWith('галтовка')
        if (assignToCuttingOperator && selectedItem.card_id) {
          const { data: cuttingHistory } = await supabase
            .from('work_card_history')
            .select('operator_name')
            .eq('card_id', selectedItem.card_id)
            .eq('stage_name', 'Розкрій')
            .order('completed_at', { ascending: false })
            .limit(1)

          if (String(cuttingHistory?.[0]?.operator_name || '').trim()) {
            targetOperator = String(cuttingHistory[0].operator_name).trim()
          }
        }

        const restorationOriginHistoryId = selectedItem.history_row.restoration_return_row?.source_history_id
        const classificationNotes = [
          selectedItem.history_row.qc_scrap_comment || null,
          restorationOriginHistoryId ? `[VKYA_ORIGIN_HISTORY:${restorationOriginHistoryId}]` : null
        ].filter(Boolean).join(' ')

        const { error: rpcErr } = await supabase.rpc('record_scrap_classification', {
          p_source_history_id: selectedItem.is_vkya_return ? null : selectedItem.id,
          p_card_id: selectedItem.card_id || null,
          p_task_id: sourceCard?.task_id || selectedItem.task_id || null,
          p_order_id: sourceOrderId || null,
          p_nomenclature_id: selectedItem.nomenclature_id,
          p_order_number: selectedItem.naryad_number || null,
          p_card_sequence: selectedItem.card_sequence ? parseInt(selectedItem.card_sequence) : null,
          p_source_operator_name: targetOperator,
          p_source_stage_name: selectedItem.history_row.stage_name || null,
          p_source_machine_name: selectedItem.history_row.machine_name || null,
          p_quantity: totalDistributed,
          p_classified_by_user_id: currentUser?.id || null,
          p_classified_by_name: userName,
          p_categories: categoriesParam,
          p_reasons: reasonsParam,
          p_notes: classificationNotes || null
        })

        if (rpcErr) throw rpcErr
      } catch (rpcEx) {
        console.error('Failed to execute scrap classification RPC:', rpcEx)
        throw rpcEx
      }
      
      if (selectedItem.is_history_row) {
        const row = selectedItem.history_row
        let existingCats = { cat1: 0, cat2: 0, cat3: 0, cat4: 0, restoration: 0 }
        if (row.qc_scrap_comment && row.qc_scrap_comment.includes('SCRAP_CAT:')) {
          try {
            const match = row.qc_scrap_comment.match(/\[SCRAP_CAT:([^\]]+)\]/)
            if (match) existingCats = JSON.parse(match[1])
          } catch(e) {}
        }
        
        const newCats = { ...existingCats }
        for (const [cat, qty] of categoriesToProcess) {
           const key = cat === 'restoration' ? 'restoration' : `cat${cat}`
           newCats[key] = (newCats[key] || 0) + Number(qty)
        }
        
        const jsonStr = `[SCRAP_CAT:${JSON.stringify(newCats)}]`
        let existingReasons = {}
        if (row.qc_scrap_comment?.includes('SCRAP_REASONS:')) {
          try {
            const reasonMatch = row.qc_scrap_comment.match(/\[SCRAP_REASONS:([^\]]+)\]/)
            if (reasonMatch) existingReasons = JSON.parse(reasonMatch[1])
          } catch (e) { console.warn('Invalid scrap reason allocation:', e) }
        }
        const newReasons = { ...existingReasons }
        reasonAllocations.forEach(allocation => {
          if (!allocation.reason || Number(allocation.qty) <= 0) return
          newReasons[allocation.reason] = (Number(newReasons[allocation.reason]) || 0) + Number(allocation.qty)
        })
        const reasonsJson = `[SCRAP_REASONS:${JSON.stringify(newReasons)}]`
        const baseComment = row.qc_scrap_comment
          ? row.qc_scrap_comment.replace(/\[SCRAP_CAT:[^\]]+\]/g, '').replace(/\[SCRAP_REASONS:[^\]]+\]/g, '').trim()
          : ''
        const newComment = [baseComment, jsonStr, reasonsJson].filter(Boolean).join(' ')
        
        await supabase.from('work_card_history').update({ qc_scrap_comment: newComment }).eq('id', selectedItem.id)
      } else if (selectedItem.is_vkya_return) {
        const returnRow = selectedItem.history_row.restoration_return_row
        const classifiedQuantity = Number(returnRow.classified_quantity || 0) + totalDistributed
        const { error: returnUpdateError } = await supabase.from('vkya_reclassification_queue').update({
          classified_quantity: classifiedQuantity,
          status: classifiedQuantity >= Number(returnRow.quantity) ? 'classified' : 'pending',
          updated_at: new Date().toISOString()
        }).eq('id', returnRow.id)
        if (returnUpdateError) throw returnUpdateError
      }
      
      if (absoluteRemaining > 0) {
        setSelectedItem({ ...selectedItem, total_qty: absoluteRemaining })
      } else {
        setSelectedItem(null)
      }
      
      await Promise.all([
        fetchData(['inventory', 'work_card_history']),
        loadRecoverableScrapLots()
      ])
    } catch (e) {
      alert('Помилка при класифікації: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDispose = async (item) => {
    if (!window.confirm(`Ви дійсно хочете списати ${item.total_qty} шт ${item.name}?`)) return
    setIsProcessing(true)
    await disposeScrapItem(item.id, item.total_qty)
    setIsProcessing(false)
  }

  const handleRework = async (item, stage) => {
    setIsProcessing(true)
    await createReworkNaryad(item.id, item.total_qty, stage)
    setIsProcessing(false)
    alert(`Створено незалежний наряд на ${stage} для ${item.total_qty} шт.`)
  }

  const openReworkModal = (item) => {
    setReworkDraft(item)
    setReworkQuantity('')
  }

  const handleSendToRework = async () => {
    const item = reworkDraft
    const quantity = Number(reworkQuantity)
    if (!item || !Number.isInteger(quantity) || quantity <= 0 || quantity > Number(item.total_qty)) return

    setIsProcessing(true)
    try {
      const creatorName = currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || currentUser.name || currentUser.login : null
      if (item.is_classified_lot) {
        await createReworkFromScrapLot(supabase, {
          classificationCategoryId: item.classification_category_id,
          quantity,
          userId: currentUser?.id || null,
          userName: creatorName
        })
      } else {
        await createReworkNaryad(item.inventory_id || item.id, quantity, 'Доопрацювання')
      }
      await Promise.all([
        fetchData(['inventory', 'orders', 'tasks', 'work_cards']),
        loadRecoverableScrapLots()
      ])
      setReworkDraft(null)
      setReworkQuantity('')
      alert(`Створено незалежний наряд на доопрацювання для ${quantity} шт. У категорії залишилося ${Number(item.total_qty) - quantity} шт.`)
    } catch (error) {
      alert('Помилка відправки на доопрацювання: ' + error.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const openRestorationModal = (item) => {
    setRestorationDraft(item)
    setRestorationQuantity('')
    setRestorationStageId('')
  }

  const handleSendToRestoration = async () => {
    const item = restorationDraft
    const quantity = Number(restorationQuantity)
    if (!item || !Number.isInteger(quantity) || quantity <= 0 || quantity > Number(item.total_qty) || !restorationStageId) return
    setIsProcessing(true)
    try {
      const creatorName = currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || currentUser.name || currentUser.login : null
      if (item.is_classified_lot) {
        await createRestorationFromScrapLot(supabase, {
          classificationCategoryId: item.classification_category_id,
          quantity,
          restorationStageId,
          userId: currentUser?.id || null,
          userName: creatorName
        })
      } else if (item.is_history_row && !item.is_vkya_return) {
        await createRestorationFromQualityHold(supabase, {
          sourceHistoryId: item.id,
          quantity,
          restorationStageId,
          userId: currentUser?.id || null,
          userName: creatorName
        })
        await loadScrapHistory()
      } else {
        const { error } = await supabase.rpc('create_vkya_restoration_card', {
          p_inventory_id: item.inventory_id || item.id,
          p_quantity: quantity,
          p_restoration_stage_id: restorationStageId,
          p_created_by_user_id: currentUser?.id || null,
          p_created_by_name: creatorName
        })
        if (error) throw error
      }
      await Promise.all([
        fetchData('inventory'),
        loadRecoverableScrapLots()
      ])
      setRestorationDraft(null)
      const stageName = restorationStages.find(stage => stage.id === restorationStageId)?.name || 'не вказано'
      alert(`Створено карту відновлення на ${quantity} шт. Етап: ${stageName}.`)
    } catch (e) {
      alert('Помилка відправки на відновлення: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReturnToRoute = async (quantity) => {
    const item = routeReturnDraft
    if (!item?.is_history_row || item.is_vkya_return) return
    setIsProcessing(true)
    try {
      const resolverName = currentUser
        ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || currentUser.name || currentUser.login
        : 'Інспектор ВКЯ'
      await returnQualityHoldToRoute(supabase, {
        sourceHistoryId: item.id,
        quantity,
        userId: currentUser?.id || null,
        userName: resolverName,
        notes: 'Підтверджено придатність ВКЯ'
      })
      setRouteReturnDraft(null)
      setSelectedItem(null)
      await Promise.all([
        fetchData(['work_cards', 'work_card_history', 'inventory', 'tasks']),
        loadScrapHistory()
      ])
      alert(`✅ ${quantity} шт. повернено у виробничий маршрут початкового наряду.`)
    } catch (error) {
      alert('Помилка повернення в наряд: ' + error.message)
    } finally {
      setIsProcessing(false)
    }
  }

  return {
    navigate,
    currentUser,
    machines,
    orders,
    nomenclatures,
    isProcessing,
    selectedItem,
    setSelectedItem,
    distribution,
    setDistribution,
    reasonAllocations,
    setReasonAllocations,
    viewingCategory,
    setViewingCategory,
    restorationDraft,
    setRestorationDraft,
    restorationQuantity,
    setRestorationQuantity,
    restorationStageId,
    setRestorationStageId,
    restorationStages,
    routeReturnDraft,
    setRouteReturnDraft,
    reworkDraft,
    setReworkDraft,
    reworkQuantity,
    setReworkQuantity,
    isScanning,
    setIsScanning,
    scanError,
    setScanError,
    manualCardNumber,
    setManualCardNumber,
    scannedCard,
    setScannedCard,
    qcInspector,
    setQcInspector,
    qcScrapCount,
    setQcScrapCount,
    qcReason,
    setQcReason,
    scrapReasons,
    scrapReasonRows,
    qcCustomReason,
    setQcCustomReason,
    qcCardOperators,
    qcResponsibleOperator,
    setQcResponsibleOperator,
    showReportPage,
    setShowReportPage,
    scrapReportSubTab,
    setScrapReportSubTab,
    reportStartDate,
    setReportStartDate,
    reportEndDate,
    setReportEndDate,
    reportIsSyncing,
    reportLoadError,
    reportSelectedShiftFilter,
    setReportSelectedShiftFilter,
    reportSelectedEmployeeFilter,
    setReportSelectedEmployeeFilter,
    reportSearchQuery,
    setReportSearchQuery,
    reportQuickPeriod,
    handleReportQuickDateSelect,
    reportUniqueOperators,
    reportScrapStats,
    reportScrapReasonsStats,
    activeCalls,
    handleResolveCall,
    openQcCardByNumber,
    handleQCScrapOverride,
    updateCategoryQty,
    updateReasonQty,
    totalDistributed,
    totalReasonAllocated,
    isReasonDistributionValid,
    remainingInBatch,
    activeScrapReasons,
    readyItems,
    filteredReadyItems,
    paginatedReadyItems,
    queuePage,
    setQueuePage,
    totalPages,
    categoryPage,
    setCategoryPage,
    categoryTotalPages,
    qualityStatusTotals,
    itemsInCat,
    paginatedCategoryItems,
    categoryTotalQuantity,
    viewingCategoryLabel,
    handleBulkClassify,
    handleDispose,
    handleRework,
    openReworkModal,
    handleSendToRework,
    openRestorationModal,
    handleSendToRestoration,
    handleReturnToRoute
  }
}
