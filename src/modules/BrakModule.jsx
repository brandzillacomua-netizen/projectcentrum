import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { ArrowLeft, AlertTriangle, CheckCircle2, Package, Layers, ChevronRight, Info, Camera, X, Scan, BarChart2, Filter, Search, Calendar, Wrench, Settings } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useMES } from '../MESContext'
import { useScrapReasons } from '../hooks/useScrapReasons'
import { useRestorationStages } from '../hooks/useRestorationStages'
import { getIndexedCache, setIndexedCache } from '../services/indexedDbCache'
import ReturnToRouteModal from './VKYA/quality-hold/ReturnToRouteModal'
import { createRestorationFromQualityHold, createRestorationFromScrapLot, createReworkFromScrapLot, fetchRecoverableScrapLots, returnQualityHoldToRoute } from './VKYA/quality-hold/qualityHoldService'
import { buildLegacyRecoverableInventoryItems, buildQualityStatusTotals, buildRecoverableScrapLotItems, QUALITY_CLASSIFICATION_OPTIONS } from './VKYA/quality-hold/qualityHoldModel'

const VKYA_QUEUE_CACHE_KEY = 'VKYA_CLASSIFICATION_QUEUE_V1'
const VKYA_REPORT_CACHE_TTL_MS = 30 * 1000

const reportDateBoundaryIso = (value, nextDay = false) => {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day + (nextDay ? 1 : 0), 0, 0, 0, 0).toISOString()
}

const normalizeScrapReasonName = (reason) => {
  const name = reason || 'Причина не вказана'
  if (name.trim().toLowerCase() === 'легенькі сколи -потребує косметичного ремонту') {
    return 'Легкі сколи-потребує косметичного ремонту'
  }
  return name
}

const isScrapReadyForQc = (historyRow) => Boolean(
  historyRow?.is_archived_scrap || String(historyRow?.card_info || '').includes('[ЦЕХ №2]')
)

export default function BrakModule() {
  const navigate = useNavigate()
  const { inventory, nomenclatures, fetchData, currentUser, disposeScrapItem, createReworkNaryad, productionStages, workCards, orders, machineCalls, machines, supabase, systemUsers } = useMES()
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
  const showReasonCatalog = false
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
  const todayStr = new Date().toISOString().split('T')[0];
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
    if (!reportStartDate && !reportEndDate) return true;
    if (!dateString) return false;
    const d = new Date(dateString);
    
    if (reportStartDate) {
      const s = new Date(reportStartDate)
      s.setHours(0,0,0,0)
      if (d < s) return false;
    }
    if (reportEndDate) {
      const e = new Date(reportEndDate)
      e.setHours(23,59,59,999)
      if (d > e) return false;
    }
    return true;
  }

  const matchesOperator = (opName, filterVal) => {
    if (!filterVal || filterVal === 'all') return true;
    if (!opName) return false;
    
    const clean = (str) => str.toLowerCase().replace(/\s+/g, ' ').trim();
    const oClean = clean(opName);
    const fClean = clean(filterVal);
    
    if (oClean === fClean) return true;
    
    const oParts = oClean.split(' ');
    const fParts = fClean.split(' ');
    
    const match1 = fParts.every(p => oParts.includes(p) || oParts.some(op => op.includes(p) || p.includes(op)));
    const match2 = oParts.every(p => fParts.includes(p) || fParts.some(fp => fp.includes(p) || p.includes(fp)));
    
    return match1 || match2;
  };

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
    const val = e.target.value;
    if (!val) return;
    
    const today = new Date();
    const toISO = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const todayStr = toISO(today);
    let startStr = '';
    let endStr = todayStr;

    if (val === 'today') {
      startStr = todayStr;
    } else if (val === 'yesterday') {
      const yest = new Date();
      yest.setDate(yest.getDate() - 1);
      startStr = toISO(yest);
      endStr = startStr;
    } else if (val === '3days') {
      const d = new Date();
      d.setDate(d.getDate() - 2);
      startStr = toISO(d);
    } else if (val === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      startStr = toISO(d);
    } else if (val === 'month') {
      const d = new Date(today.getFullYear(), today.getMonth(), 1);
      startStr = toISO(d);
    } else if (val === 'previous_month') {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const to = new Date(today.getFullYear(), today.getMonth(), 0);
      startStr = toISO(from);
      endStr = toISO(to);
    } else if (val === 'quarter') {
      const d = new Date();
      d.setMonth(d.getMonth() - 3);
      startStr = toISO(d);
    } else if (val === 'halfyear') {
      const d = new Date();
      d.setMonth(d.getMonth() - 6);
      startStr = toISO(d);
    } else if (val === 'year') {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 1);
      startStr = toISO(d);
    } else if (val === 'all') {
      startStr = '';
    }

    setReportStartDate(startStr);
    setReportEndDate(endStr);
    setReportQuickPeriod(val);
  };

  const reportUniqueOperators = useMemo(() => {
    const ops = new Set();
    (systemUsers || []).forEach(u => {
      const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim();
      if (fullName) ops.add(fullName);
    });
    reportWorkCardHistory.forEach(h => {
      if (h.operator_name) ops.add(h.operator_name);
    });
    return Array.from(ops).filter(Boolean).sort();
  }, [systemUsers, reportWorkCardHistory]);

  const reportScrapStats = useMemo(() => {
    const list = reportWorkCardHistory
      .filter(h => Number(h.scrap_qty) > 0 && reportFilterByDate(h.completed_at) && (reportSelectedShiftFilter === 'all' || h.shift_name === reportSelectedShiftFilter) && matchesOperator(h.operator_name, reportSelectedEmployeeFilter))
      .map(h => {
        const nom = nomenclatures.find(n => n.id === h.nomenclature_id);
        
        let cat1 = 0, cat2 = 0, cat3 = 0, cat4 = 0;
        if (h.qc_scrap_comment && h.qc_scrap_comment.includes('SCRAP_CAT:')) {
          try {
            const match = h.qc_scrap_comment.match(/\[SCRAP_CAT:([^\]]+)\]/);
            if (match) {
              const cats = JSON.parse(match[1]);
              cat1 = Number(cats.cat1 || 0);
              cat2 = Number(cats.cat2 || 0);
              cat3 = Number(cats.cat3 || 0);
              cat4 = Number(cats.cat4 || 0);
            }
          } catch (e) {}
        }
        
        const totalClassified = cat1 + cat2 + cat3 + cat4;
        const unclassified = Math.max(0, Number(h.scrap_qty) - totalClassified);

        return {
          ...h,
          nom_name: nom ? nom.name : 'Невідома деталь',
          cat1,
          cat2,
          cat3,
          cat4,
          unclassified
        };
      })
      .filter(h => !reportSearchQuery || h.nom_name.toLowerCase().includes(reportSearchQuery.toLowerCase()) || h.operator_name.toLowerCase().includes(reportSearchQuery.toLowerCase()))
      .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));

    const totalScrap = list.reduce((acc, curr) => acc + Number(curr.scrap_qty), 0);
    
    const byStage = list.reduce((acc, curr) => {
      acc[curr.stage_name] = (acc[curr.stage_name] || 0) + Number(curr.scrap_qty);
      return acc;
    }, {});

    return { list, totalScrap, byStage };
  }, [reportWorkCardHistory, nomenclatures, reportStartDate, reportEndDate, reportSearchQuery, reportSelectedShiftFilter, reportSelectedEmployeeFilter])

  const reportScrapReasonsStats = useMemo(() => {
    const reasonsMap = {};
    let totalScrapQty = 0;

    reportScrapReasonsDb.forEach(row => {
      if (reportSelectedEmployeeFilter !== 'all' && !matchesOperator(row.source_operator_name, reportSelectedEmployeeFilter)) return;

      const reason = normalizeScrapReasonName(row.reason_name || 'Причина не вказана');
      const qty = Number(row.quantity) || 0;
      if (qty <= 0) return;

      const nom = nomenclatures.find(n => n.id === row.nomenclature_id);
      const nomName = nom ? nom.name : 'Невідома деталь';
      totalScrapQty += qty;

      if (!reasonsMap[reason]) {
        reasonsMap[reason] = {
          name: reason,
          quantity: 0,
          items: {},
          operators: {}
        };
      }
      reasonsMap[reason].quantity += qty;
      reasonsMap[reason].items[nomName] = (reasonsMap[reason].items[nomName] || 0) + qty;
      reasonsMap[reason].operators[row.source_operator_name || 'Невідомий'] = (reasonsMap[reason].operators[row.source_operator_name || 'Невідомий'] || 0) + qty;
    });

    reportWorkCardHistory
      .filter(h => !reportClassifiedHistoryIds.has(h.id) && Number(h.scrap_qty) > 0 && reportFilterByDate(h.completed_at) && (reportSelectedShiftFilter === 'all' || h.shift_name === reportSelectedShiftFilter) && matchesOperator(h.operator_name, reportSelectedEmployeeFilter))
      .forEach(h => {
        let reasons = {};
        if (h.qc_scrap_comment && h.qc_scrap_comment.includes('SCRAP_REASONS:')) {
          try {
            const match = h.qc_scrap_comment.match(/\[SCRAP_REASONS:([^\]]+)\]/);
            if (match) {
              reasons = JSON.parse(match[1]);
            }
          } catch (e) {}
        } else {
          let reasonName = h.qc_scrap_comment || 'Причина не вказана';
          if (reasonName.includes('Причина:')) {
            reasonName = reasonName.split('Причина:')[1].trim();
          }
          reasonName = reasonName.replace(/\[SCRAP_CAT:[^\]]+\]/g, '').replace(/\[SCRAP_REASONS:[^\]]+\]/g, '').trim();
          if (!reasonName) {
            reasonName = 'Причина не вказана';
          }
          reasons[reasonName] = Number(h.scrap_qty) || 0;
        }

        const nom = nomenclatures.find(n => n.id === h.nomenclature_id);
        const nomName = nom ? nom.name : 'Невідома деталь';

        Object.entries(reasons).forEach(([rawReason, qty]) => {
          const reason = normalizeScrapReasonName(rawReason);
          const numQty = Number(qty);
          if (numQty <= 0) return;

          totalScrapQty += numQty;

          if (!reasonsMap[reason]) {
            reasonsMap[reason] = {
              name: reason,
              quantity: 0,
              items: {},
              operators: {}
            };
          }

          reasonsMap[reason].quantity += numQty;
          reasonsMap[reason].items[nomName] = (reasonsMap[reason].items[nomName] || 0) + numQty;
          reasonsMap[reason].operators[h.operator_name || 'Невідомий'] = (reasonsMap[reason].operators[h.operator_name || 'Невідомий'] || 0) + numQty;
        });
      });

    return Object.values(reasonsMap)
      .map(r => {
        const topItem = Object.entries(r.items).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
        const topOperator = Object.entries(r.operators).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
        return {
          ...r,
          percentage: totalScrapQty > 0 ? ((r.quantity / totalScrapQty) * 100).toFixed(1) : '0.0',
          topItem,
          topOperator
        };
      })
      .sort((a, b) => b.quantity - a.quantity);
  }, [reportWorkCardHistory, reportScrapReasonsDb, reportClassifiedHistoryIds, nomenclatures, reportStartDate, reportEndDate, reportSelectedShiftFilter, reportSelectedEmployeeFilter]);

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

  // Обробка сканера QR
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

          // Робочі картки друкуються у форматі CENTRUM_CARD_<UUID>.
          cardIdStr = cardIdStr.replace(/^CENTRUM_CARD_/i, '').replace(/^#/, '').trim()

          if (!cardIdStr) {
            await stopAndClose()
            setScanError('QR-код картки порожній або має невірний формат.')
            return
          }

          await stopAndClose()
          let foundCard = (workCards || []).find(c => {
            const currentId = String(c.id || '').trim().toLowerCase()
            const scannedId = cardIdStr.toLowerCase()
            return currentId === scannedId || currentId.endsWith(scannedId)
          })

          // Завершені/архівні картки можуть бути відсутні у поточному списку
          // екрана ВКЯ, тому шукаємо повний UUID безпосередньо в БД.
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
            setScanError(`Картку №${cardIdStr} не знайдено в базі.`)
          } else {
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

  // Уніфікована функція запису в інвентар
  const updateInventoryStock = async (nomId, qty, type = 'scrap_ready') => {
    if (!nomId || qty <= 0) return
    try {
      const { data: existing, error: lookupError } = await supabase.from('inventory')
        .select('*')
        .eq('nomenclature_id', nomId)
        .eq('type', type)
        .limit(1).maybeSingle()
      if (lookupError) throw lookupError

      if (existing) {
        const { error } = await supabase.from('inventory').update({
          total_qty: (Number(existing.total_qty) || 0) + Number(qty),
          updated_at: new Date().toISOString()
        }).eq('id', existing.id)
        if (error) throw error
      } else {
        const nom = (nomenclatures || []).find(n => n.id === nomId)
        const { error } = await supabase.from('inventory').insert([{
          name: nom?.name || 'Деталь',
          unit: nom?.unit || 'шт',
          total_qty: Number(qty),
          type: type,
          nomenclature_id: nomId
        }])
        if (error) throw error
      }
    } catch (e) {
      console.warn(`Stock update failed for type ${type}:`, e)
      throw e
    }
  }

  // Обробник списання додаткового браку ВКЯ
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

      // 1. Запис у work_card_history
      const { error: historyError } = await supabase.from('work_card_history').insert([{
        card_id: scannedCard.id,
        nomenclature_id: scannedCard.nomenclature_id,
        stage_name: 'Контроль ВКЯ',
        operator_name: qcResponsibleOperator,
        qty_at_start: scannedCard.quantity,
        qty_completed: newQty,
        scrap_qty: qcScrapCount,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        is_archived_scrap: true,
        shift_name: scannedCard.shift_name,
        manager_name: scannedCard.manager_name,
        machine_name: scannedCard.machine,
        qc_scrap_reason: qcReason,
        qc_scrap_comment: qcReason === 'Інше (коментар)' ? qcCustomReason : null,
        card_info: `${scannedCard.card_info || ''} [QC_INSPECTOR:${inspectorName}] [VKYA_SOURCE_STATUS:${freshCard.status || ''}] [VKYA_SOURCE_OPERATION:${freshCard.operation || ''}]`.trim()
      }])
      if (historyError) throw historyError

      // 2. Оновлюємо кількість картки
      const updatePayload = { quantity: newQty }
      if (newQty === 0) {
        updatePayload.status = 'completed'
      }
      const { error: cardUpdateError } = await supabase.from('work_cards').update(updatePayload).eq('id', scannedCard.id)
      if (cardUpdateError) throw cardUpdateError

      // 3. Записуємо виявлений брак на склад
      await updateInventoryStock(scannedCard.nomenclature_id, qcScrapCount, 'scrap_ready')

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
        // Safe rollout fallback while the migration is not installed yet.
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
        // Filter first to only include items that actually have remaining unclassified scrap
        const activeScrap = data.filter(h => {
          let sum = 0;
          if (h.qc_scrap_comment && h.qc_scrap_comment.includes('SCRAP_CAT:')) {
            try {
              const match = h.qc_scrap_comment.match(/\[SCRAP_CAT:([^\]]+)\]/);
              if (match) {
                const cats = JSON.parse(match[1]);
                sum = Object.values(cats).reduce((a, b) => a + Number(b), 0);
              }
            } catch(e) {}
          }
          const ledgerClassified = Number(h.classified_quantity)
          if (Number.isFinite(ledgerClassified)) sum = Math.max(sum, ledgerClassified)
          return Math.max(0, Number(h.scrap_qty) - sum) > 0;
        })

        // Load exact source records for the queue. This must not depend on the
        // globally cached "latest N" cards/orders, otherwise old scrap loses
        // its work-order and card numbers.
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

        // A card's human number in production is its 1-based position inside
        // the same task and nomenclature. The old task-wide sequence could show
        // numbers like 437 for a detail that only has 178 cards.
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

  // Reset distribution when selected item changes
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

  // Filter for items ready for classification from work_card_history
  const readyItems = (localScrapHistory || [])
    .filter(h => isScrapReadyForQc(h) && Number(h.scrap_qty) > 0)
    .map(h => {
      let sum = 0;
      if (h.qc_scrap_comment && h.qc_scrap_comment.includes('SCRAP_CAT:')) {
        try {
          const match = h.qc_scrap_comment.match(/\[SCRAP_CAT:([^\]]+)\]/);
          if (match) {
            const cats = JSON.parse(match[1]);
            sum = Object.values(cats).reduce((a, b) => a + Number(b), 0);
          }
        } catch(e) {}
      }
      const ledgerClassified = Number(h.classified_quantity)
      if (Number.isFinite(ledgerClassified)) sum = Math.max(sum, ledgerClassified)
      const remaining = Math.max(0, Number(h.scrap_qty) - sum);
      if (remaining <= 0) return null;
      
      const nom = nomenclatures?.find(n => n.id === h.nomenclature_id);
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
        id: h.id, // we use history id as item id
        is_history_row: !h.is_vkya_return,
        is_vkya_return: Boolean(h.is_vkya_return),
        history_row: h,
        nomenclature_id: h.nomenclature_id,
        name: h.restoration_return_row?.nomenclature_name || nom?.name || 'Деталь',
        unit: nom?.unit || 'шт',
        total_qty: remaining, // Show remaining as total_qty for UI compatibility
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
      };
    })
    .filter(Boolean);

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

  const queuePageSize = 10;
  const totalPages = Math.ceil(filteredReadyItems.length / queuePageSize);

  useEffect(() => {
    setQueuePage(1);
  }, [manualCardNumber]);

  useEffect(() => {
    if (queuePage > 1 && queuePage > totalPages) {
      setQueuePage(Math.max(1, totalPages));
    }
  }, [totalPages, queuePage]);

  const paginatedReadyItems = filteredReadyItems.slice((queuePage - 1) * queuePageSize, queuePage * queuePageSize);

  // New defects remain in quarantine until VKYA chooses recoverable scrap or final scrap.
  // Category 3 is included only as a rolling-deployment fallback; the migration moves it to category 1.
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

      // Call analytical database function record_scrap_classification
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

        // Determine operator responsible for the scrap
        let targetOperator = selectedItem.history_row.operator_name || null;
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
            .limit(1);

          if (String(cuttingHistory?.[0]?.operator_name || '').trim()) {
            targetOperator = String(cuttingHistory[0].operator_name).trim();
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

        if (rpcErr) {
          throw rpcErr
        }
      } catch (rpcEx) {
        console.error('Failed to execute scrap classification RPC:', rpcEx)
        throw rpcEx
      }
      
      // We need to update the work_card_history with the new JSON distribution
      if (selectedItem.is_history_row) {
        const row = selectedItem.history_row;
        let existingCats = { cat1: 0, cat2: 0, cat3: 0, cat4: 0, restoration: 0 };
        if (row.qc_scrap_comment && row.qc_scrap_comment.includes('SCRAP_CAT:')) {
          try {
            const match = row.qc_scrap_comment.match(/\[SCRAP_CAT:([^\]]+)\]/);
            if (match) existingCats = JSON.parse(match[1]);
          } catch(e) {}
        }
        
        const newCats = { ...existingCats };
        for (const [cat, qty] of categoriesToProcess) {
           const key = cat === 'restoration' ? 'restoration' : `cat${cat}`;
           newCats[key] = (newCats[key] || 0) + Number(qty);
        }
        
        const jsonStr = `[SCRAP_CAT:${JSON.stringify(newCats)}]`;
        let existingReasons = {};
        if (row.qc_scrap_comment?.includes('SCRAP_REASONS:')) {
          try {
            const reasonMatch = row.qc_scrap_comment.match(/\[SCRAP_REASONS:([^\]]+)\]/);
            if (reasonMatch) existingReasons = JSON.parse(reasonMatch[1]);
          } catch (e) { console.warn('Invalid scrap reason allocation:', e) }
        }
        const newReasons = { ...existingReasons };
        reasonAllocations.forEach(allocation => {
          if (!allocation.reason || Number(allocation.qty) <= 0) return;
          newReasons[allocation.reason] = (Number(newReasons[allocation.reason]) || 0) + Number(allocation.qty);
        });
        const reasonsJson = `[SCRAP_REASONS:${JSON.stringify(newReasons)}]`;
        const baseComment = row.qc_scrap_comment
          ? row.qc_scrap_comment.replace(/\[SCRAP_CAT:[^\]]+\]/g, '').replace(/\[SCRAP_REASONS:[^\]]+\]/g, '').trim()
          : '';
        const newComment = [baseComment, jsonStr, reasonsJson].filter(Boolean).join(' ');
        
        await supabase.from('work_card_history').update({ qc_scrap_comment: newComment }).eq('id', selectedItem.id);
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

  if (showReportPage) {
    return (
      <div style={{ background: '#050505', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <nav style={{ 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
          padding: '0 25px', height: '75px', background: '#000', borderBottom: '1px solid #1a1a1a', flexShrink: 0 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button 
              onClick={() => setShowReportPage(false)} 
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.85rem', padding: 0 }}
            >
              <ArrowLeft size={18} /> <span>Черга ВКЯ</span>
            </button>
            <div style={{ width: '2px', height: '24px', background: '#1a1a1a' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <AlertTriangle color="#ef4444" size={22} />
              <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, letterSpacing: '-0.5px' }}>ВКЯ · Звіти 1С Брак</h1>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800 }}>{currentUser?.first_name} {currentUser?.last_name}</div>
              <div style={{ fontSize: '0.65rem', color: '#555', textTransform: 'uppercase', fontWeight: 900 }}>Інспектор ВКЯ</div>
            </div>
          </div>
        </nav>

        {/* Filter Bar */}
        <div className="report-filters-bar" style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap', background: '#000', padding: '15px 25px', borderBottom: '1px solid #111' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#111', border: '1px solid #222', padding: '8px 12px', borderRadius: '10px', width: '220px' }}>
            <Search size={16} color="#555" />
            <input 
              type="text" 
              placeholder="Фільтр по назві..." 
              value={reportSearchQuery}
              onChange={e => setReportSearchQuery(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '0.85rem', width: '100%' }}
            />
          </div>

          <select 
            value={reportSelectedShiftFilter} 
            onChange={e => setReportSelectedShiftFilter(e.target.value)}
            style={{ background: '#111', border: '1px solid #222', color: '#fff', padding: '10px 15px', borderRadius: '10px', fontSize: '0.85rem', outline: 'none' }}
          >
            <option value="all">— Всі зміни —</option>
            <option value="Зміна 1">Зміна 1</option>
            <option value="Зміна 2">Зміна 2</option>
            <option value="Зміна 3">Зміна 3</option>
            <option value="Зміна 4">Зміна 4</option>
            <option value="Без зміни">Без зміни</option>
          </select>

          <select 
            value={reportSelectedEmployeeFilter} 
            onChange={e => setReportSelectedEmployeeFilter(e.target.value)}
            style={{ background: '#111', border: '1px solid #222', color: '#fff', padding: '10px 15px', borderRadius: '10px', fontSize: '0.85rem', outline: 'none', maxWidth: '200px' }}
          >
            <option value="all">— Всі працівники —</option>
            {reportUniqueOperators.map(op => <option key={op} value={op}>{op}</option>)}
          </select>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#111', border: '1px solid #222', padding: '8px 15px', borderRadius: '10px', fontSize: '0.85rem' }}>
            <Calendar size={16} color="#555" />
            <span style={{ color: '#666', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800 }}>Період:</span>
            <input 
              type="date" 
              value={reportStartDate} 
              onChange={e => { setReportStartDate(e.target.value); setReportQuickPeriod(''); }}
              style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '0.85rem' }}
            />
            <span style={{ color: '#555' }}>—</span>
            <input 
              type="date" 
              value={reportEndDate} 
              onChange={e => { setReportEndDate(e.target.value); setReportQuickPeriod(''); }}
              style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '0.85rem' }}
            />
          </div>

          <select 
            value={reportQuickPeriod} 
            onChange={handleReportQuickDateSelect}
            style={{ background: '#111', border: '1px solid #222', color: '#ff9000', padding: '10px 15px', borderRadius: '10px', fontSize: '0.85rem', outline: 'none', fontWeight: 800 }}
          >
            <option value="">ОБРАТИ ПЕРІОД</option>
            <option value="today">Сьогодні</option>
            <option value="yesterday">Вчора</option>
            <option value="3days">Останні 3 дні</option>
            <option value="week">Цей тиждень</option>
            <option value="month">Цей місяць</option>
            <option value="previous_month">Минулий місяць</option>
            <option value="quarter">Останні 3 місяці</option>
            <option value="halfyear">Останні 6 місяців</option>
            <option value="year">Останній рік</option>
            <option value="all">За весь час</option>
          </select>
        </div>

        {/* Main Body */}
        <div style={{ flex: 1, padding: '30px', width: '100%', boxSizing: 'border-box' }}>
          {reportIsSyncing ? (
            <div style={{ textAlign: 'center', padding: '50px 0', color: '#a1a1aa' }}>Завантаження даних звіту...</div>
          ) : reportLoadError ? (
            <div style={{ background: '#111', border: '1px solid #7f1d1d', borderRadius: '14px', padding: '24px', color: '#fca5a5' }}>Не вдалося завантажити звіт: {reportLoadError}</div>
          ) : (
            <div className="report-main-columns" style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {/* Left Column: Totals & Stages */}
              <div className="report-left-column" style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ background: '#111', padding: '20px', borderRadius: '16px', border: '1px solid #222' }}>
                  <h4 style={{ margin: '0 0 15px', color: '#ef4444', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', fontWeight: 900 }}>
                    <AlertTriangle size={18} /> Загальний облік браку
                  </h4>
                  <div style={{ fontSize: '2.5rem', fontWeight: 1000, color: '#fff', lineHeight: 1 }}>
                    {reportScrapStats.totalScrap} <span style={{ fontSize: '1rem', color: '#71717a', fontWeight: 700 }}>од.</span>
                  </div>
                </div>

                <div style={{ background: '#111', padding: '20px', borderRadius: '16px', border: '1px solid #222' }}>
                  <h4 style={{ margin: '0 0 15px', fontSize: '0.78rem', color: '#a1a1aa', textTransform: 'uppercase', fontWeight: 900 }}>Брак по етапах</h4>
                  {Object.entries(reportScrapStats.byStage).map(([stage, count]) => (
                    <div key={stage} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', padding: '10px', background: '#09090b', borderRadius: '8px', border: '1px solid #222' }}>
                      <span style={{ color: '#d4d4d8', fontSize: '0.82rem', fontWeight: 700 }}>{stage}</span>
                      <strong style={{ color: '#ef4444', fontSize: '0.85rem' }}>{count} од.</strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Toggle Tabs & Tables */}
              <div className="report-right-column" style={{ flex: '2 2 600px', background: '#111', padding: '20px', borderRadius: '16px', border: '1px solid #222' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #222', paddingBottom: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.8rem', color: '#a1a1aa', textTransform: 'uppercase', fontWeight: 900 }}>
                    {scrapReportSubTab === 'cases' ? 'Деталізація випадків' : 'Аналітика причин браку'}
                  </h4>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                      onClick={() => setScrapReportSubTab('cases')}
                      style={{
                        background: scrapReportSubTab === 'cases' ? '#ef4444' : 'transparent',
                        color: '#fff', border: scrapReportSubTab === 'cases' ? 'none' : '1px solid #222',
                        padding: '6px 14px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer'
                      }}
                    >
                      Випадки
                    </button>
                    <button 
                      onClick={() => setScrapReportSubTab('reasons')}
                      style={{
                        background: scrapReportSubTab === 'reasons' ? '#ef4444' : 'transparent',
                        color: '#fff', border: scrapReportSubTab === 'reasons' ? 'none' : '1px solid #222',
                        padding: '6px 14px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer'
                      }}
                    >
                      Причини браку
                    </button>
                  </div>
                </div>

                {scrapReportSubTab === 'cases' ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: '550px' }}>
                      <thead>
                        <tr style={{ color: '#71717a', textAlign: 'left', borderBottom: '2px solid #222' }}>
                          <th style={{ padding: '10px 8px' }}>Дата</th>
                          <th style={{ padding: '10px 8px' }}>Деталь</th>
                          <th style={{ padding: '10px 8px' }}>Оператор</th>
                          <th style={{ padding: '10px 8px' }}>Етап</th>
                          <th style={{ padding: '10px 8px', textAlign: 'center', color: '#f97316' }}>Карантин</th>
                          <th style={{ padding: '10px 8px', textAlign: 'center', color: '#eab308' }}>Брак</th>
                          <th style={{ padding: '10px 8px', textAlign: 'center', color: '#ef4444' }}>Утиль</th>
                          <th style={{ padding: '10px 8px', textAlign: 'right' }}>Всього</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportScrapStats.list.map(h => (
                          <tr key={h.id} style={{ borderBottom: '1px solid #222' }}>
                            <td style={{ padding: '10px 8px', color: '#71717a' }}>{new Date(h.completed_at).toLocaleDateString()}</td>
                            <td style={{ padding: '10px 8px', color: '#fff', fontWeight: 700 }}>{h.nom_name}</td>
                            <td style={{ padding: '10px 8px', color: '#d4d4d8' }}>{h.operator_name}</td>
                            <td style={{ padding: '10px 8px', color: '#a1a1aa' }}>{h.stage_name}</td>
                            <td style={{ padding: '10px 8px', textAlign: 'center', color: h.unclassified > 0 ? '#f97316' : '#3f3f46', fontWeight: h.unclassified > 0 ? '900' : '400' }}>{h.unclassified || '—'}</td>
                            <td style={{ padding: '10px 8px', textAlign: 'center', color: h.cat1 + h.cat2 + h.cat3 > 0 ? '#eab308' : '#3f3f46', fontWeight: h.cat1 + h.cat2 + h.cat3 > 0 ? '900' : '400' }}>{h.cat1 + h.cat2 + h.cat3 || '—'}</td>
                            <td style={{ padding: '10px 8px', textAlign: 'center', color: h.cat4 > 0 ? '#ef4444' : '#3f3f46', fontWeight: h.cat4 > 0 ? '900' : '400' }}>{h.cat4 || '—'}</td>
                            <td style={{ padding: '10px 8px', textAlign: 'right', color: '#ef4444', fontWeight: 900 }}>{h.scrap_qty}</td>
                          </tr>
                        ))}
                        {reportScrapStats.list.length === 0 && (
                          <tr><td colSpan="8" style={{ padding: '20px', textAlign: 'center', color: '#71717a' }}>Брак відсутній за обраний період</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: '550px' }}>
                      <thead>
                        <tr style={{ color: '#71717a', textAlign: 'left', borderBottom: '2px solid #222' }}>
                          <th style={{ padding: '10px 8px' }}>Причина браку</th>
                          <th style={{ padding: '10px 8px', textAlign: 'center' }}>Кількість деталей (шт)</th>
                          <th style={{ padding: '10px 8px', textAlign: 'center' }}>Відсоток (%)</th>
                          <th style={{ padding: '10px 8px' }}>Найчастіша деталь</th>
                          <th style={{ padding: '10px 8px', textAlign: 'right' }}>Найчастіший оператор</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportScrapReasonsStats.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #222' }}>
                            <td style={{ padding: '12px 8px', color: '#fff', fontWeight: 700 }}>{item.name}</td>
                            <td style={{ padding: '12px 8px', textAlign: 'center', color: '#ef4444', fontWeight: 900 }}>{item.quantity}</td>
                            <td style={{ padding: '12px 8px', textAlign: 'center', color: '#71717a' }}>{item.percentage}%</td>
                            <td style={{ padding: '12px 8px', color: '#a1a1aa' }}>{item.topItem}</td>
                            <td style={{ padding: '12px 8px', textAlign: 'right', color: '#a1a1aa' }}>{item.topOperator}</td>
                          </tr>
                        ))}
                        {reportScrapReasonsStats.length === 0 && (
                          <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#71717a' }}>Немає класифікованого браку за обраний період</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#050505', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header */}
      <nav style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        padding: '0 25px', height: '75px', background: '#000', borderBottom: '1px solid #1a1a1a', flexShrink: 0 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {showReportPage ? (
            <button 
              onClick={() => setShowReportPage(false)} 
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.85rem', padding: 0 }}
            >
              <ArrowLeft size={18} /> <span>Черга ВКЯ</span>
            </button>
          ) : (
            <Link to="/" style={{ color: '#94a3b8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.85rem' }}>
              <ArrowLeft size={18} /> <span>Назад</span>
            </Link>
          )}
          <div style={{ width: '2px', height: '24px', background: '#1a1a1a' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle color="#ef4444" size={22} />
            <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, letterSpacing: '-0.5px' }}>
              {showReportPage ? 'ВКЯ · Звіти 1С Брак' : 'ВКЯ · Управління Якістю'}
            </h1>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 800 }}>{currentUser?.first_name} {currentUser?.last_name}</div>
            <div style={{ fontSize: '0.65rem', color: '#555', textTransform: 'uppercase', fontWeight: 900 }}>Інспектор ВКЯ</div>
          </div>
        </div>
      </nav>

      <div style={{ flex: 1, padding: '30px', maxWidth: '1400px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        
        {/* Active Machine Calls Widget */}
        {!showReasonCatalog && activeCalls.length > 0 && (
          <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '16px', padding: '15px 20px', marginBottom: '25px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '0.85rem', fontWeight: 900, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="pulse-indicator" style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444' }} />
              АКТИВНІ ВИКЛИКИ ДО ВЕРСТАТІВ ({activeCalls.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {activeCalls.map(c => {
                const mach = machines?.find(m => m.id === c.machine_id)
                return (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111', border: '1px solid #222', borderRadius: '12px', padding: '12px 15px', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff' }}>
                        {mach ? mach.name : 'Верстат'} (пор. №{mach?.sequence_number || '—'})
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>
                        Локація: {mach?.floor || '—'} поверх | Викликав: {c.operator_name || 'Оператор'}
                        {c.called_employee_name && <span style={{ color: '#8b5cf6', fontWeight: 800 }}> | Цільовий для: {c.called_employee_name}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#666', fontWeight: 700 }}>
                        {new Date(c.created_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button 
                        onClick={() => handleResolveCall(c.id)}
                        style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}
                      >
                        Я йду
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Action Bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '12px', marginBottom: '25px', flexWrap: 'wrap' }}>
          {!showReasonCatalog && <button
            onClick={() => setIsScanning(true)}
            style={{
              background: '#ef444420', border: '1px solid #ef444455', color: '#ef4444',
              padding: '12px 24px', borderRadius: '14px', fontSize: '0.85rem', fontWeight: 900,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
              transition: 'all 0.2s',
              boxShadow: '0 4px 15px rgba(239, 68, 68, 0.1)'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#ef444430';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#ef444420';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <Camera size={18} /> СКАНУВАТИ КАРТКУ
          </button>}
          {!showReasonCatalog && <div style={{ display: 'flex', alignItems: 'center', background: '#0a0a0a', border: '1px solid #333', borderRadius: '14px', overflow: 'hidden' }}>
            <input
              value={manualCardNumber}
              onChange={event => {
                setManualCardNumber(event.target.value)
                if (scanError) setScanError(null)
              }}
              onKeyDown={event => {
                if (event.key === 'Enter') openQcCardByNumber()
              }}
              placeholder="№ картки, наряд або деталь..."
              aria-label="Системний номер картки"
              style={{ width: '240px', minWidth: 0, padding: '0 14px', background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '0.82rem', fontWeight: 750 }}
            />
            {manualCardNumber && (
              <button
                onClick={() => setManualCardNumber('')}
                style={{ background: 'transparent', border: 0, color: '#666', cursor: 'pointer', padding: '0 8px', display: 'flex', alignItems: 'center' }}
                title="Очистити пошук"
              >
                <X size={15} />
              </button>
            )}
            <button
              onClick={openQcCardByNumber}
              style={{ padding: '12px 16px', background: '#ef444418', border: 'none', borderLeft: '1px solid #333', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 900 }}
            >
              <Search size={17} /> ЗНАЙТИ
            </button>
          </div>}
          {!showReasonCatalog && (
            <button
              onClick={() => setShowReportPage(true)}
              style={{
                background: '#a855f720', border: '1px solid #a855f755', color: '#a855f7',
                padding: '12px 24px', borderRadius: '14px', fontSize: '0.85rem', fontWeight: 900,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
                transition: 'all 0.2s',
                boxShadow: '0 4px 15px rgba(168, 85, 247, 0.1)'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#a855f730';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#a855f720';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <BarChart2 size={18} /> ЗВІТИ ВКЯ
            </button>
          )}
          {!showReasonCatalog && (
            <Link
              to="/brak/restoration"
              style={{ background: '#06b6d420', border: '1px solid #06b6d455', color: '#06b6d4', padding: '12px 24px', borderRadius: '14px', fontSize: '0.85rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}
            >
              <Wrench size={18} /> ТЕРМІНАЛ ВІДНОВЛЕННЯ
            </Link>
          )}
          <Link
            to="/brak/settings"
            style={{ background: '#f59e0b20', border: '1px solid #f59e0b55', color: '#f59e0b', padding: '12px 24px', borderRadius: '14px', fontSize: '0.85rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}
          >
            <Settings size={18}/> НАЛАШТУВАННЯ ВКЯ
          </Link>
        </div>

        {/* Довідник перенесено до окремого підмодуля /brak/settings.
        {showReasonCatalog && (
          <div className="qc-catalog-container" style={{ background: '#0d0d0d', border: '1px solid #f59e0b33', borderRadius: '24px', padding: '26px', marginBottom: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', alignItems: 'flex-start', marginBottom: '25px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '1.45rem', fontWeight: 1000, color: '#fff' }}>Довідник причин браку</div>
                <div style={{ color: '#666', fontSize: '0.78rem', marginTop: '6px' }}>Ці значення використовуються у випадаючих списках ВКЯ та виробничих терміналів.</div>
              </div>
              <div style={{ background: '#f59e0b18', color: '#f59e0b', borderRadius: '12px', padding: '9px 14px', fontSize: '0.75rem', fontWeight: 950 }}>
                {scrapReasonRows.filter(row => row.is_active).length} АКТИВНИХ
              </div>
            </div>

            <div style={{ background: '#080808', border: '1px solid #222', borderRadius: '16px', padding: '16px', marginBottom: '22px' }}>
              <div style={{ color: '#888', fontSize: '0.68rem', fontWeight: 950, marginBottom: '10px' }}>ДОДАТИ НОВУ ПРИЧИНУ</div>
              <div className="qc-catalog-add-row" style={{ display: 'flex', gap: '10px' }}>
              <input value={newScrapReason} onChange={event => setNewScrapReason(event.target.value)}
                onKeyDown={event => { if (event.key === 'Enter') handleAddScrapReason() }}
                placeholder="Наприклад: Невірний розмір деталі"
                style={{ flex: 1, minWidth: 0, background: '#000', border: '1px solid #333', borderRadius: '11px', color: '#fff', padding: '13px 15px', fontWeight: 700 }} />
              <button onClick={handleAddScrapReason} disabled={!newScrapReason.trim()}
                style={{ background: '#f59e0b', color: '#000', border: 0, borderRadius: '11px', padding: '0 22px', fontWeight: 950, cursor: 'pointer', opacity: newScrapReason.trim() ? 1 : 0.45 }}>
                ДОДАТИ
              </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              {scrapReasonRows.map(row => (
                <div key={row.id} className="qc-catalog-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#111', border: '1px solid #202020', borderRadius: '14px', padding: '13px 15px' }}>
                  <div style={{ width: '10px', height: '10px', flexShrink: 0, borderRadius: '50%', background: row.is_active ? '#10b981' : '#444', boxShadow: row.is_active ? '0 0 10px #10b98166' : 'none' }} />
                  {editingScrapReasonId === row.id ? (
                    <input autoFocus value={editingScrapReasonName} onChange={event => setEditingScrapReasonName(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter') handleUpdateScrapReason(row)
                        if (event.key === 'Escape') setEditingScrapReasonId(null)
                      }}
                      style={{ flex: 1, background: '#050505', border: '1px solid #f59e0b66', borderRadius: '9px', color: '#fff', padding: '9px 11px', fontWeight: 800 }} />
                  ) : (
                    <div className="row-name" style={{ flex: 1, color: row.is_active ? '#fff' : '#666', fontWeight: 850 }}>{row.name}</div>
                  )}
                  {editingScrapReasonId === row.id ? <>
                    <button onClick={() => handleUpdateScrapReason(row)} style={{ background: '#10b981', color: '#000', border: 0, borderRadius: '9px', padding: '9px 13px', fontWeight: 950, cursor: 'pointer' }}>
                      <span className="desktop-text">ЗБЕРЕГТИ</span>
                      <span className="mobile-text">💾</span>
                    </button>
                    <button onClick={() => setEditingScrapReasonId(null)} style={{ background: '#222', color: '#888', border: '1px solid #333', borderRadius: '9px', padding: '9px 13px', fontWeight: 850, cursor: 'pointer' }}>
                      <span className="desktop-text">СКАСУВАТИ</span>
                      <span className="mobile-text">❌</span>
                    </button>
                  </> : <>
                    <button onClick={() => { setEditingScrapReasonId(row.id); setEditingScrapReasonName(row.name) }} style={{ background: '#1d1d1d', color: '#f59e0b', border: '1px solid #333', borderRadius: '9px', padding: '9px 13px', fontWeight: 900, cursor: 'pointer' }}>
                      <span className="desktop-text">РЕДАГУВАТИ</span>
                      <span className="mobile-text">✏️</span>
                    </button>
                    <button onClick={() => handleToggleScrapReason(row)} style={{ minWidth: '105px', background: row.is_active ? '#10b98118' : '#222', color: row.is_active ? '#10b981' : '#888', border: `1px solid ${row.is_active ? '#10b98155' : '#333'}`, borderRadius: '9px', padding: '9px 13px', fontWeight: 900, cursor: 'pointer' }}>
                      <span className="desktop-text">{row.is_active ? 'АКТИВНА' : 'ВИМКНЕНА'}</span>
                      <span className="mobile-text">{row.is_active ? 'ВКЛ' : 'ВИКЛ'}</span>
                    </button>
                    <button onClick={() => handleDeleteScrapReason(row)} style={{ background: '#ef444418', color: '#ef4444', border: '1px solid #ef444455', borderRadius: '9px', padding: '9px 13px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }} title="Видалити причину">
                      <Trash2 size={14} />
                      <span className="desktop-text">ВИДАЛИТИ</span>
                    </button>
                  </>}
                </div>
              ))}
            </div>
          </div>
        )}
        */}

        {!showReasonCatalog && <>
        {/* Stats Dashboard */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', marginBottom: '40px' }}>
          {[
            { cat: 'quarantine', label: 'Карантин', val: qualityStatusTotals.quarantine, color: '#f97316', desc: 'Нові деталі, що очікують рішення ВКЯ' },
            { cat: 'brak', label: 'Брак', val: qualityStatusTotals.recoverableScrap, color: '#eab308', desc: 'Класифікований брак і деталі на доопрацювання' },
            { cat: 4, label: 'Утиль', val: qualityStatusTotals.finalScrap, color: '#ef4444', desc: 'Безнадійний брак для списання' },
            { cat: 'restoration', label: 'Відновлення', val: qualityStatusTotals.restoration, color: '#06b6d4', desc: 'Внутрішнє відновлення' },
          ].map(s => (
            <div key={s.label} 
              onClick={() => {
                if (s.cat === 'restoration') {
                  navigate('/brak/restoration')
                  return
                }
                if (s.cat === 'quarantine') {
                  setViewingCategory(null)
                  setSelectedItem(null)
                  return
                }
                setViewingCategory(s.cat === viewingCategory ? null : s.cat)
                setSelectedItem(null)
              }}
              className="glass-panel" 
              style={{ 
                background: viewingCategory === s.cat ? `${s.color}10` : 'rgba(20,20,20,0.6)', 
                borderRadius: '24px', padding: '24px', cursor: 'pointer',
                borderLeft: `1px solid ${viewingCategory === s.cat ? s.color : s.color + '15'}`, 
                borderRight: `1px solid ${viewingCategory === s.cat ? s.color : s.color + '15'}`, 
                borderBottom: `1px solid ${viewingCategory === s.cat ? s.color : s.color + '15'}`, 
                borderTop: `4px solid ${s.color}`,
                transition: 'all 0.3s ease'
              }}>
              <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{s.label}</div>
              <div style={{ fontSize: '2.4rem', fontWeight: 1000, color: '#fff', lineHeight: 1 }}>{s.val} <small style={{ fontSize: '0.9rem', opacity: 0.3 }}>шт</small></div>
              <div style={{ fontSize: '0.65rem', color: '#444', marginTop: '10px', fontWeight: 600 }}>{s.desc}</div>
              {viewingCategory === s.cat && <div style={{ marginTop: '15px', fontSize: '0.6rem', color: s.color, fontWeight: 900 }}>ВІДКРИТО ДЕТАЛЬНИЙ ПЕРЕГЛЯД ↓</div>}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '40px' }}>
          
          {/* List of Pending Items */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 950 }}>
                {viewingCategory ? `Деталі: ${viewingCategoryLabel}` : 'КАРАНТИН · ОЧІКУЮТЬ КЛАСИФІКАЦІЇ ВКЯ'}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ background: viewingCategory ? '#444' : '#ef444415', padding: '8px 14px', borderRadius: '10px', color: viewingCategory ? '#fff' : '#ef4444', fontSize: '0.75rem', fontWeight: 1000 }}>
                  {viewingCategory
                    ? `${itemsInCat.length} ПОЗИЦІЙ`
                    : manualCardNumber.trim()
                      ? `ЗНАЙДЕНО: ${filteredReadyItems.length} з ${readyItems.length}`
                      : `${readyItems.length} ПОЗИЦІЙ`
                  }
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(!viewingCategory && readyItems.length === 0) && (
                <div style={{ 
                  background: '#0a0a0a', border: '2px dashed #1a1a1a', borderRadius: '24px', 
                  padding: '60px 40px', textAlign: 'center', color: '#444' 
                }}>
                  <CheckCircle2 size={48} style={{ opacity: 0.1, marginBottom: '20px' }} />
                  <div style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.8rem' }}>Поки що браку немає</div>
                  <div style={{ fontSize: '0.7rem', marginTop: '5px' }}>Як тільки Майстер перенесе брак з прийомки, він з'явиться тут</div>
                </div>
              )}

              {viewingCategory && itemsInCat.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', color: '#444', background: '#0a0a0a', borderRadius: '20px' }}>
                  Ця категорія порожня
                </div>
              )}

              {/* RENDER LIST: Either classifications OR category details */}
              {viewingCategory ? (
                itemsInCat.map(item => (
                  <div key={item.id} style={{ 
                    background: '#111', borderRadius: '20px', padding: '20px', border: '1px solid #1a1a1a',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: '1.05rem', marginBottom: '2px' }}>{item.name}</div>
                      {item.is_classified_lot && (
                        <div style={{ fontSize: '0.68rem', lineHeight: 1.55, color: '#777', fontWeight: 800 }}>
                          <span style={{ color: '#eab308' }}>Наряд №{item.naryad_number}</span>
                          {item.card_sequence ? <> · <span style={{ color: '#06b6d4' }}>Картка №{item.card_sequence}</span></> : null}
                          {item.operator ? <> · Оператор: <span style={{ color: '#a78bfa' }}>{item.operator}</span></> : null}
                          {item.stage ? <> · Етап: {item.stage}</> : null}
                        </div>
                      )}
                      {item.is_legacy_aggregate && (
                        <div style={{ color: '#f97316', fontSize: '0.66rem', fontWeight: 950, marginTop: '3px' }}>
                          СТАРИЙ АГРЕГОВАНИЙ ЗАЛИШОК · ДЖЕРЕЛО НАРЯДУ НЕ ЗБЕРЕЖЕНЕ
                        </div>
                      )}
                      <div style={{ fontSize: '0.65rem', color: '#555', fontWeight: 800 }}>Обліковується як: {item.type === 'scrap_restoration' ? 'Відновлення (ВКЯ)' : item.type}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                       <div style={{ textAlign: 'right', marginRight: '10px' }}>
                          <div style={{ fontSize: '1.4rem', fontWeight: 1000 }}>{item.total_qty} <small style={{ fontSize: '0.7rem', opacity: 0.3 }}>шт</small></div>
                       </div>
                       {viewingCategory === 'restoration' ? (
                         <>
                           <button 
                             onClick={() => handleRework(item, 'Пресування [ЦЕХ №2]')}
                             style={{ background: '#8b5cf6', border: 'none', color: '#fff', padding: '10px 15px', borderRadius: '12px', fontWeight: 900, fontSize: '0.75rem', cursor: 'pointer' }}
                           >ПРЕСУВАННЯ</button>
                           <button 
                             onClick={() => handleRework(item, 'Фарбування')}
                             style={{ background: '#3b82f6', border: 'none', color: '#fff', padding: '10px 15px', borderRadius: '12px', fontWeight: 900, fontSize: '0.75rem', cursor: 'pointer' }}
                           >ФАРБУВАННЯ</button>
                         </>
                       ) : viewingCategory === 4 ? (
                         <button 
                           onClick={() => handleDispose(item)}
                           style={{ background: '#ef4444', border: 'none', color: '#fff', padding: '10px 15px', borderRadius: '12px', fontWeight: 900, fontSize: '0.75rem', cursor: 'pointer' }}
                         >СПИСАТИ</button>
                        ) : (
                          <>
                           <button 
                             onClick={() => openReworkModal(item)}
                             style={{ background: '#10b981', border: 'none', color: '#fff', padding: '10px 15px', borderRadius: '12px', fontWeight: 900, fontSize: '0.75rem', cursor: 'pointer' }}
                           >НА ДООПРАЦЮВАННЯ</button>
                           <button 
                             onClick={() => openRestorationModal(item)}
                             style={{ background: '#06b6d4', border: 'none', color: '#fff', padding: '10px 15px', borderRadius: '12px', fontWeight: 900, fontSize: '0.75rem', cursor: 'pointer' }}
                           >НА ВІДНОВЛЕННЯ</button>
                         </>
                        )}
                    </div>
                  </div>
                ))
              ) : (
                paginatedReadyItems.map(item => {
                  const nom = nomenclatures.find(n => n.id === item.nomenclature_id)
                  const isActive = selectedItem?.id === item.id
                  return (
                    <div key={item.id} 
                      onClick={() => setSelectedItem(item)}
                      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') setSelectedItem(item) }}
                      role="button"
                      tabIndex={0}
                      style={{ 
                        background: isActive ? 'rgba(239, 68, 68, 0.05)' : '#111', 
                        borderRadius: '20px', padding: '20px', cursor: 'pointer',
                        border: `1px solid ${isActive ? '#ef444450' : '#1a1a1a'}`,
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        transform: isActive ? 'scale(1.02)' : 'scale(1)',
                        boxShadow: isActive ? '0 10px 30px rgba(239, 68, 68, 0.1)' : 'none'
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ 
                          background: '#000', width: '50px', height: '50px', borderRadius: '14px', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' 
                         }}>
                          <Package size={22} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 900, fontSize: '1.05rem', marginBottom: '2px' }}>{nom?.name || item.name}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 12px', marginTop: '5px', fontSize: '0.67rem', fontWeight: 850 }}>
                            <span style={{ color: '#f59e0b' }}>Наряд №{item.naryad_number}</span>
                            <span style={{ color: '#38bdf8' }}>Картка №{item.card_sequence || '—'}</span>
                            {item.task_card_sequence && item.task_card_sequence !== item.card_sequence && (
                              <span style={{ color: '#64748b' }}>у наряді №{item.task_card_sequence}</span>
                            )}
                            <span style={{ color: '#64748b' }} title={item.card_id ? String(item.card_id) : ''}>Системна #{item.card_number}</span>
                            <span style={{ color: '#666' }}>Отримано: {new Date(item.updated_at).toLocaleDateString('uk-UA')}</span>
                          </div>
                          {item.operator && <div style={{ fontSize: '0.65rem', color: '#8b5cf6', fontWeight: 800, marginTop: '3px' }}>Оператор: {item.operator} · Етап: {item.stage || '—'}</div>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.6rem', fontWeight: 1000, color: '#fff' }}>{item.total_qty} <small style={{ fontSize: '0.7rem', opacity: 0.3 }}>шт</small></div>
                        {!isActive && <div style={{ fontSize: '0.55rem', color: '#ef4444', fontWeight: 1000, textTransform: 'uppercase', marginTop: '5px' }}>Натисніть для класифікації</div>}
                      </div>
                    </div>
                  )
                })
              )}

              {!viewingCategory && totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '25px', flexWrap: 'wrap' }}>
                  <button
                    disabled={queuePage === 1}
                    onClick={() => setQueuePage(p => Math.max(1, p - 1))}
                    style={{
                      background: '#111', border: '1px solid #222', color: '#fff',
                      padding: '8px 16px', borderRadius: '10px', fontWeight: 800, cursor: 'pointer'
                    }}
                  >
                    Назад
                  </button>
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pageNum = idx + 1
                    const isActive = pageNum === queuePage
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setQueuePage(pageNum)}
                        style={{
                          background: isActive ? '#ef4444' : '#111',
                          border: `1px solid ${isActive ? '#ef4444' : '#222'}`,
                          color: '#fff',
                          width: '36px', height: '36px', borderRadius: '10px',
                          fontWeight: 900, cursor: 'pointer',
                          boxShadow: isActive ? '0 0 10px rgba(239, 68, 68, 0.3)' : 'none'
                        }}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                  <button
                    disabled={queuePage === totalPages}
                    onClick={() => setQueuePage(p => Math.min(totalPages, p + 1))}
                    style={{
                      background: '#111', border: '1px solid #222', color: '#fff',
                      padding: '8px 16px', borderRadius: '10px', fontWeight: 800, cursor: 'pointer'
                    }}
                  >
                    Вперед
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Classification card: modal for queue items, inline info for category views */}
          {(selectedItem || viewingCategory) && (
          <div
            onClick={selectedItem ? () => setSelectedItem(null) : undefined}
            style={selectedItem ? {
              position: 'fixed', inset: 0, zIndex: 10040,
              background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(5px)',
              padding: '24px', overflowY: 'auto',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'center'
            } : {}}
          >
            <div
              onClick={event => event.stopPropagation()}
              style={selectedItem ? { width: '100%', maxWidth: '620px', margin: '20px auto' } : {}}
            >
              <h2 style={{ margin: '0 0 20px', fontSize: '1.4rem', fontWeight: 950 }}>{viewingCategory ? 'Довідка' : 'Обробка деталі'}</h2>
              
              <div style={{ 
                background: 'linear-gradient(145deg, #111 0%, #0a0a0a 100%)', 
                borderRadius: '30px', padding: '35px', border: '1px solid #1a1a1a', minHeight: selectedItem ? 'auto' : '400px',
                boxShadow: selectedItem ? '0 30px 90px rgba(0,0,0,0.65)' : 'none',
                display: 'flex', flexDirection: 'column', justifyContent: (selectedItem || viewingCategory) ? 'flex-start' : 'center',
                alignItems: (selectedItem || viewingCategory) ? 'stretch' : 'center', textAlign: (selectedItem || viewingCategory) ? 'left' : 'center'
              }}>
                {viewingCategory && !selectedItem && (
                   <div style={{ textAlign: 'center' }}>
                      <div style={{ width: '80px', height: '80px', background: '#111', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 25px', color: '#06b6d4' }}>
                        <Layers size={40} />
                      </div>
                      <div style={{ color: '#fff', fontWeight: 900, fontSize: '1.2rem', marginBottom: '10px' }}>
                        {viewingCategory === 'restoration' ? 'Внутрішнє Відновлення ВКЯ' : viewingCategoryLabel}
                      </div>
                      <p style={{ color: '#555', fontSize: '0.8rem', lineHeight: 1.5 }}>
                        {viewingCategory === 'restoration'
                          ? 'У цій вкладці знаходяться деталі, які потребують складного відновлення фахівцями ВКЯ. Звідси ви можете запустити їх у Цех №2 на операції Пресування чи Фарбування.'
                          : viewingCategory === 4 
                            ? 'У цій категорії знаходиться безнадійний брак. Ви можете списати ці деталі, і вони будуть назавжди враховані як збитки у відповідному документі.' 
                            : viewingCategory === 3
                              ? 'Деталі перебувають у карантині до окремого рішення відповідального працівника: доопрацювання, відновлення або подальше списання.'
                              : 'У цьому блоці об’єднані старі категорії 1 і 2. Деталі можна передати на доопрацювання або відновлення.'}
                      </p>
                      <button 
                        onClick={() => setViewingCategory(null)}
                        style={{ marginTop: '30px', background: 'transparent', border: '1px solid #222', color: '#94a3b8', padding: '12px 25px', borderRadius: '15px', fontWeight: 800, cursor: 'pointer' }}
                      >ПОВЕРНУТИСЬ ДО КЛАСИФІКАЦІЇ</button>
                   </div>
                )}

                {!selectedItem && !viewingCategory && (
                  <>
                    <div style={{ width: '80px', height: '80px', background: '#111', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '25px', color: '#222' }}>
                      <Info size={40} />
                    </div>
                    <div style={{ color: '#333', fontWeight: 900, textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.1em' }}>Оберіть деталь з черги</div>
                    <p style={{ color: '#222', fontSize: '0.75rem', marginTop: '10px', maxWidth: '240px' }}>Кожна деталь браку має бути присвоєна певній категорії для коректного обліку та аналітики</p>
                  </>
                )}

                {selectedItem && (
                  <>
                    <div style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
                       <div style={{ background: '#000', width: '64px', height: '64px', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                          <AlertTriangle size={32} />
                       </div>
                       <div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 1000, lineHeight: 1.1 }}>{selectedItem.name}</div>
                          <div style={{ fontSize: '1rem', color: '#ef4444', fontWeight: 1000, marginTop: '8px' }}>
                            На карантині: {selectedItem.total_qty} шт
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginTop: '10px', fontSize: '0.7rem', fontWeight: 900 }}>
                            <span style={{ color: '#f59e0b' }}>Наряд №{selectedItem.naryad_number}</span>
                            <span style={{ color: '#38bdf8' }}>Картка №{selectedItem.card_sequence || '—'}</span>
                            {selectedItem.task_card_sequence && selectedItem.task_card_sequence !== selectedItem.card_sequence && (
                              <span style={{ color: '#64748b' }}>у наряді №{selectedItem.task_card_sequence}</span>
                            )}
                            <span style={{ color: '#64748b' }} title={selectedItem.card_id ? String(selectedItem.card_id) : ''}>Системна #{selectedItem.card_number}</span>
                          </div>
                          <div style={{ marginTop: '8px', color: '#a78bfa', fontSize: '0.72rem', fontWeight: 900 }}>
                            Оператор: {selectedItem.operator || 'Не вказаний'}
                          </div>
                          <div style={{ marginTop: '5px', color: '#38bdf8', fontSize: '0.72rem', fontWeight: 900 }}>
                            Етап: {selectedItem.stage || 'Не вказаний'}
                          </div>
                       </div>
                    </div>

                    {selectedItem.is_history_row && !selectedItem.is_vkya_return && (
                      <div style={{ marginBottom: '20px' }}>
                        <button
                          onClick={() => setRouteReturnDraft(selectedItem)}
                          disabled={isProcessing}
                          style={{ width: '100%', background: '#10b98118', border: '1px solid #10b98155', color: '#10b981', borderRadius: '16px', padding: '16px', fontWeight: 1000, cursor: 'pointer' }}
                        >
                          ПРИДАТНІ · ПОВЕРНУТИ В НАРЯД
                          <div style={{ color: '#64748b', fontSize: '.62rem', fontWeight: 700, marginTop: 5 }}>Після натискання вкажіть кількість придатних деталей для повернення</div>
                        </button>
                      </div>
                    )}

                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '25px', marginBottom: '30px', border: '1px solid #1a1a1a' }}>
                        <div style={{ fontSize: '0.65rem', color: '#444', fontWeight: 900, textTransform: 'uppercase', marginBottom: '20px' }}>РІШЕННЯ ВКЯ:</div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                          {QUALITY_CLASSIFICATION_OPTIONS.map(option => ({
                            cat: option.category,
                            label: option.label,
                            color: option.color,
                            desc: option.description
                          })).map(c => (
                            <div key={c.cat} style={{ 
                              background: '#0a0a0a', 
                              borderLeft: '1px solid #1a1a1a', 
                              borderRight: '1px solid #1a1a1a', 
                              borderBottom: '1px solid #1a1a1a', 
                              borderRadius: '18px', padding: '15px 20px', 
                              display: 'flex', alignItems: 'center', gap: '15px', 
                              position: 'relative', overflow: 'hidden' 
                            }}>
                                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: c.color }}></div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: '0.9rem', fontWeight: 1000, color: c.color }}>{c.label}</div>
                                  <div style={{ fontSize: '0.6rem', color: '#444', fontWeight: 600 }}>{c.desc}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                   <button 
                                     onClick={() => updateCategoryQty(c.cat, Number(distribution[c.cat]) - 1)}
                                     style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#111', border: '1px solid #222', color: '#fff', cursor: 'pointer' }}
                                   >-</button>
                                   <input 
                                      type="number"
                                      value={distribution[c.cat] === 0 ? '' : distribution[c.cat]}
                                      onChange={(e) => {
                                        const val = e.target.value
                                        updateCategoryQty(c.cat, val === '' ? 0 : parseInt(val) || 0)
                                      }}
                                      placeholder="0"
                                      style={{ width: '50px', textAlign: 'center', background: 'transparent', border: 'none', color: '#fff', fontSize: '1.1rem', fontWeight: 1000, outline: 'none' }}
                                   />
                                   <button 
                                     onClick={() => updateCategoryQty(c.cat, Number(distribution[c.cat]) + 1)}
                                     style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#111', border: '1px solid #222', color: '#fff', cursor: 'pointer' }}
                                   >+</button>
                                </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ 
                          marginTop: '25px', padding: '15px', borderRadius: '15px', background: '#000', border: '1px solid #222',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                           <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#444' }}>ВИБРАНО: <span style={{ color: remainingInBatch < 0 ? '#ef4444' : '#fff' }}>{totalDistributed} / {selectedItem.total_qty}</span></div>
                           <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#444' }}>ЗАЛИШОК: <span style={{ color: remainingInBatch < 0 ? '#ef4444' : '#10b981' }}>{remainingInBatch} шт</span></div>
                        </div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '25px', marginBottom: '30px', border: '1px solid #1a1a1a' }}>
                      <div style={{ marginBottom: '18px' }}>
                        <div>
                          <div style={{ fontSize: '0.65rem', color: '#777', fontWeight: 950, textTransform: 'uppercase' }}>ПРИЧИНИ БРАКУ</div>
                          <div style={{ color: '#444', fontSize: '0.63rem', marginTop: '4px' }}>
                            {totalDistributed > 0 ? `Розподіліть за причинами ${totalDistributed} шт, вибраних вище` : 'Спочатку вкажіть кількість у категоріях вище'}
                          </div>
                        </div>
                      </div>
                      {totalDistributed === 0 ? (
                        <div style={{ padding: '22px', textAlign: 'center', background: '#090909', border: '1px dashed #292929', borderRadius: '13px', color: '#555', fontSize: '0.72rem', fontWeight: 800 }}>
                          Блок причин стане доступним після розподілу хоча б однієї деталі за категоріями
                        </div>
                      ) : <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {reasonAllocations.map((allocation, index) => (
                          <div key={index} style={{ background: '#090909', border: `1px solid ${Number(allocation.qty) > 0 && !allocation.reason ? '#ef444466' : '#1d1d1d'}`, borderRadius: '13px', padding: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#555', fontSize: '0.6rem', fontWeight: 900 }}>
                              <span>ПРИЧИНА {index + 1}</span><span>КІЛЬКІСТЬ</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', gap: '9px', alignItems: 'center' }}>
                            <select value={allocation.reason} onChange={event => setReasonAllocations(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, reason: event.target.value } : item))}
                              style={{ minWidth: 0, width: '100%', background: '#050505', border: '1px solid #292929', color: allocation.reason ? '#fff' : '#666', padding: '11px', borderRadius: '9px', fontWeight: 800 }}>
                              <option value="">Оберіть причину...</option>
                              {activeScrapReasons.filter(reason => reason === allocation.reason || !reasonAllocations.some((item, itemIndex) => itemIndex !== index && item.reason === reason)).map(reason => <option key={reason} value={reason}>{reason}</option>)}
                            </select>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <button onClick={() => updateReasonQty(index, Number(allocation.qty) - 1)} disabled={Number(allocation.qty) <= 0}
                                style={{ width: '32px', height: '32px', background: '#151515', border: '1px solid #292929', color: '#fff', borderRadius: '8px', cursor: 'pointer' }}>−</button>
                              <input type="number" min="0" max={totalDistributed} value={allocation.qty || ''} placeholder="0"
                                onChange={event => updateReasonQty(index, event.target.value)}
                                style={{ width: '54px', background: 'transparent', border: 0, color: '#fff', textAlign: 'center', fontSize: '1rem', fontWeight: 950, outline: 'none' }} />
                              <button onClick={() => updateReasonQty(index, Number(allocation.qty) + 1)} disabled={totalReasonAllocated >= totalDistributed}
                                style={{ width: '32px', height: '32px', background: '#151515', border: '1px solid #292929', color: '#fff', borderRadius: '8px', cursor: 'pointer' }}>+</button>
                            </div>
                            <button onClick={() => setReasonAllocations(items => items.length === 1 ? [{ reason: '', qty: 0 }] : items.filter((_, itemIndex) => itemIndex !== index))}
                              title="Прибрати причину" style={{ width: '32px', height: '32px', background: '#ef444412', border: '1px solid #ef444433', color: '#ef4444', borderRadius: '8px', cursor: 'pointer', fontWeight: 900 }}>×</button>
                            </div>
                            {Number(allocation.qty) > 0 && !allocation.reason && (
                              <div style={{ color: '#ef4444', fontSize: '0.62rem', fontWeight: 900, marginTop: '8px' }}>Оберіть причину для цієї кількості</div>
                            )}
                          </div>
                        ))}
                      </div>
                      <button onClick={() => setReasonAllocations(items => [...items, { reason: '', qty: 0 }])}
                        disabled={totalReasonAllocated >= totalDistributed || reasonAllocations.length >= activeScrapReasons.length}
                        style={{ width: '100%', marginTop: '11px', background: '#f59e0b12', color: '#f59e0b', border: '1px dashed #f59e0b55', borderRadius: '11px', padding: '11px', fontSize: '0.7rem', fontWeight: 950, cursor: 'pointer', opacity: totalReasonAllocated >= totalDistributed ? 0.35 : 1 }}>
                        + ДОДАТИ ЩЕ ОДНУ ПРИЧИНУ
                      </button>
                      <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: '#000', border: `1px solid ${totalReasonAllocated === totalDistributed && totalDistributed > 0 ? '#10b98144' : '#292929'}`, borderRadius: '11px', fontSize: '0.7rem', fontWeight: 900 }}>
                        <span style={{ color: '#555' }}>ЗА ПРИЧИНАМИ: <b style={{ color: totalReasonAllocated === totalDistributed && totalDistributed > 0 ? '#10b981' : '#fff' }}>{totalReasonAllocated}</b></span>
                        <span style={{ color: '#555' }}>ЗАЛИШИЛОСЬ: <b style={{ color: totalReasonAllocated === totalDistributed ? '#10b981' : '#f59e0b' }}>{Math.max(0, totalDistributed - totalReasonAllocated)}</b></span>
                      </div>
                      </>}
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button 
                        disabled={isProcessing || remainingInBatch < 0 || !isReasonDistributionValid}
                        onClick={handleBulkClassify}
                        style={{ flex: 2, background: '#8b5cf6', color: '#fff', border: 'none', padding: '20px', borderRadius: '18px', fontSize: '1.1rem', fontWeight: 1000, cursor: isReasonDistributionValid ? 'pointer' : 'not-allowed', opacity: (remainingInBatch < 0 || !isReasonDistributionValid) ? 0.3 : 1 }}
                      >
                        {isProcessing ? 'ОБРОБКА...' : 'ПІДТВЕРДИТИ РОЗПОДІЛ'}
                      </button>
                      <button 
                        onClick={() => setSelectedItem(null)}
                        style={{ flex: 1, background: 'transparent', border: '1px solid #222', color: '#444', padding: '15px', borderRadius: '18px', fontWeight: 800, cursor: 'pointer' }}
                      >
                        СКАСУВАТИ
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          )}
        </div>
        {scanError && !isScanning && <div style={{ margin: '-12px 0 22px', color: '#ef4444', fontSize: '0.76rem', fontWeight: 750 }}>{scanError}</div>}
        </>}
      </div>

      {/* ── МОДАЛКА СКАНЕРА QR ── */}
      {isScanning && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10050, padding: '20px' }}>
          <div style={{ background: '#111', width: '100%', maxWidth: '420px', borderRadius: '28px', border: '1px solid #333', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px', background: '#1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontWeight: 900, fontSize: '0.9rem' }}>
                <Scan size={18} /> СКАНУВАННЯ КАРТКИ
              </div>
              <button onClick={() => setIsScanning(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={22} /></button>
            </div>
            <div style={{ padding: 0, position: 'relative', background: '#000', minHeight: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div id="qc-reader" style={{ width: '100%', border: 'none' }} />
            </div>
            <div style={{ padding: '20px', textAlign: 'center', fontSize: '0.75rem', color: '#666' }}>
              Наведіть камеру на QR-код виробничої картки
            </div>
          </div>
        </div>
      )}

      {/* ── МОДАЛКА ОФОРМЛЕННЯ БРАКУ З КАРТКИ ── */}
      {scannedCard && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10060, padding: '20px' }}>
          <div style={{ background: '#111', width: '100%', maxWidth: '460px', borderRadius: '26px', border: '1px solid #ef444440', overflow: 'hidden', boxShadow: '0 20px 60px rgba(239,68,68,0.15)' }}>
            <div style={{ padding: '20px 22px', background: '#161616', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ef444420' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 950, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🛡️ ВІДДІЛ ВКЯ · ФІКСАЦІЯ БРАКУ
                </h3>
                <div style={{ fontSize: '0.6rem', color: '#888', marginTop: '2px' }}>
                  Замовлення №{orders?.find(o => o.id === scannedCard.order_id)?.order_num || '—'} · Картка #{scannedCard.id.slice(0, 8).toUpperCase()}
                </div>
              </div>
              <button onClick={() => setScannedCard(null)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}><X size={22} /></button>
            </div>
            <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900 }}>
                {(nomenclatures || []).find(n => n.id === scannedCard.nomenclature_id)?.name || 'Деталь'}
              </h3>

              {/* Інспектор ВКЯ */}
              <div>
                <label style={{ color: '#888', fontWeight: 800, fontSize: '0.7rem', display: 'block', marginBottom: '8px' }}>ПІБ Інспектора ВКЯ (або відповідального)</label>
                <input
                  type="text"
                  placeholder="Введіть ваше прізвище..."
                  value={qcInspector}
                  onChange={e => setQcInspector(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #333', background: '#000', color: '#fff', fontSize: '0.9rem', fontWeight: 800, boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              {/* Виробничий оператор, якому присвоюється брак */}
              <div style={{ background: '#ef444410', border: '1px solid #ef444435', borderRadius: '14px', padding: '14px' }}>
                <label style={{ color: '#fca5a5', fontWeight: 900, fontSize: '0.7rem', display: 'block', marginBottom: '8px' }}>КОМУ ПРИСВОЇТИ БРАК</label>
                {qcCardOperators.length === 1 ? (
                  <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 900 }}>
                    {qcResponsibleOperator}
                    <div style={{ color: '#777', fontSize: '0.64rem', fontWeight: 700, marginTop: '4px' }}>Єдиний оператор картки — обрано автоматично</div>
                  </div>
                ) : qcCardOperators.length > 1 ? (
                  <select
                    value={qcResponsibleOperator}
                    onChange={event => setQcResponsibleOperator(event.target.value)}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: `1px solid ${qcResponsibleOperator ? '#10b98155' : '#ef444455'}`, background: '#000', color: '#fff', fontSize: '0.9rem', fontWeight: 800, boxSizing: 'border-box', outline: 'none' }}
                  >
                    <option value="">— Оберіть оператора картки —</option>
                    {qcCardOperators.map(operator => <option key={operator} value={operator}>{operator}</option>)}
                  </select>
                ) : (
                  <div style={{ color: '#ef4444', fontSize: '0.72rem', fontWeight: 850 }}>У картці не знайдено виробничого оператора. Брак неможливо записати без відповідального.</div>
                )}
              </div>

              {/* Причина браку */}
              <div>
                <label style={{ color: '#888', fontWeight: 800, fontSize: '0.7rem', display: 'block', marginBottom: '8px' }}>Причина браку</label>
                <select
                  value={qcReason}
                  onChange={e => {
                    setQcReason(e.target.value)
                    if (e.target.value !== 'Інше (коментар)') {
                      setQcCustomReason('')
                    }
                  }}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #333', background: '#000', color: '#fff', fontSize: '0.9rem', fontWeight: 800, boxSizing: 'border-box', outline: 'none' }}
                >
                  {scrapReasons.filter(reason => scrapReasonRows.find(row => row.name === reason)?.is_active !== false).map(reason => <option key={reason} value={reason}>{reason}</option>)}
                </select>
              </div>

              {/* Коментар до причини браку */}
              {qcReason === 'Інше (коментар)' && (
                <div>
                  <label style={{ color: '#888', fontWeight: 800, fontSize: '0.7rem', display: 'block', marginBottom: '8px' }}>Опишіть іншу причину браку</label>
                  <input
                    type="text"
                    placeholder="Введіть коментар..."
                    value={qcCustomReason}
                    onChange={e => setQcCustomReason(e.target.value)}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #333', background: '#000', color: '#fff', fontSize: '0.9rem', fontWeight: 800, boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>
              )}

              {/* Лічильник додаткового браку */}
              <div style={{ background: '#0d0d0d', borderRadius: '14px', padding: '18px', textAlign: 'center', border: '1px solid #ef444422' }}>
                <label style={{ color: '#ef4444', fontWeight: 900, fontSize: '0.7rem', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
                  КІЛЬКІСТЬ ВИЯВЛЕНОГО БРАКУ
                </label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
                  <button onClick={() => setQcScrapCount(v => Math.max(0, v - 1))}
                    style={{ width: '46px', height: '46px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>−</button>
                  <input type="number" min={0} max={scannedCard.quantity} value={qcScrapCount === 0 ? '' : qcScrapCount} placeholder="0"
                    onChange={e => {
                      const val = e.target.value;
                      setQcScrapCount(val === '' ? 0 : Math.max(0, Math.min(scannedCard.quantity, parseInt(val) || 0)))
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '3.2rem', width: '90px', textAlign: 'center', fontWeight: 900, outline: 'none' }} />
                  <button onClick={() => setQcScrapCount(v => Math.min(scannedCard.quantity, v + 1))}
                    style={{ width: '46px', height: '46px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>+</button>
                </div>
                <div style={{ marginTop: '10px', fontSize: '0.72rem', color: '#555' }}>
                  Залишиться в картці: <strong style={{ color: '#10b981' }}>{Math.max(0, (scannedCard.quantity || 0) - qcScrapCount)} шт</strong>
                </div>
              </div>

              <button onClick={handleQCScrapOverride} disabled={isProcessing || qcScrapCount <= 0 || !qcResponsibleOperator}
                style={{
                  background: '#ef4444', color: '#fff', border: 'none', padding: '16px', borderRadius: '14px',
                  fontSize: '1.05rem', fontWeight: 1000, cursor: 'pointer',
                  boxShadow: '0 10px 30px rgba(239,68,68,0.3)',
                  opacity: (isProcessing || qcScrapCount <= 0 || !qcResponsibleOperator) ? 0.5 : 1
                }}>
                {isProcessing ? 'ЗБЕРЕЖЕННЯ...' : '⚠️ ПЕРЕДАТИ В КАРАНТИН ВКЯ'}
              </button>
            </div>
          </div>
        </div>
      )}


      {restorationDraft && (
        <div onClick={() => !isProcessing && setRestorationDraft(null)} style={{ position: 'fixed', inset: 0, zIndex: 10060, background: 'rgba(0,0,0,0.88)', display: 'grid', placeItems: 'center', padding: '20px' }}>
          <div onClick={event => event.stopPropagation()} style={{ width: '100%', maxWidth: '520px', background: '#0d0d0d', border: '1px solid #06b6d455', borderRadius: '24px', padding: '28px', boxShadow: '0 30px 90px rgba(0,0,0,.7)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '15px' }}>
              <div><div style={{ color: '#06b6d4', fontSize: '.7rem', fontWeight: 1000 }}>НОВА КАРТА ВІДНОВЛЕННЯ</div><h2 style={{ margin: '8px 0 5px', overflowWrap: 'anywhere' }}>{restorationDraft.name}</h2><div style={{ color: '#777', fontSize: '.8rem' }}>Доступно: {restorationDraft.total_qty} {restorationDraft.unit || 'шт'}</div></div>
              <button onClick={() => setRestorationDraft(null)} disabled={isProcessing} style={{ alignSelf: 'flex-start', background: 'transparent', border: 0, color: '#777', cursor: 'pointer' }}><X size={22}/></button>
            </div>
            <label style={{ display: 'block', margin: '24px 0 8px', color: '#888', fontSize: '.7rem', fontWeight: 950 }}>КІЛЬКІСТЬ НА ВІДНОВЛЕННЯ</label>
            <input autoFocus type="number" min="1" max={restorationDraft.total_qty} value={restorationQuantity} onChange={event => setRestorationQuantity(event.target.value)} placeholder={`Від 1 до ${restorationDraft.total_qty}`} style={{ boxSizing: 'border-box', width: '100%', background: '#050505', border: '1px solid #333', borderRadius: '12px', color: '#fff', padding: '14px', fontSize: '1.1rem', fontWeight: 900 }} />
            <label style={{ display: 'block', margin: '18px 0 8px', color: '#888', fontSize: '.7rem', fontWeight: 950 }}>ЕТАП ВІДНОВЛЕННЯ</label>
            <select value={restorationStageId} onChange={event => setRestorationStageId(event.target.value)} style={{ boxSizing: 'border-box', width: '100%', background: '#050505', border: '1px solid #333', borderRadius: '12px', color: '#fff', padding: '14px', fontWeight: 850 }}><option value="">Оберіть етап відновлення</option>{restorationStages.map(stage => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</select>
            <div style={{ color: '#555', fontSize: '.68rem', marginTop: '8px' }}>Список етапів редагується у підмодулі «Налаштування ВКЯ». У категорії залишиться невибрана кількість.</div>
            <button onClick={handleSendToRestoration} disabled={isProcessing || !restorationStageId || !Number.isInteger(Number(restorationQuantity)) || Number(restorationQuantity) <= 0 || Number(restorationQuantity) > Number(restorationDraft.total_qty)} style={{ width: '100%', marginTop: '24px', background: '#06b6d4', border: 0, color: '#001014', borderRadius: '13px', padding: '15px', fontWeight: 1000, cursor: 'pointer' }}>{isProcessing ? 'СТВОРЕННЯ...' : 'СТВОРИТИ КАРТУ ВІДНОВЛЕННЯ'}</button>
          </div>
        </div>
      )}

      <ReturnToRouteModal
        key={routeReturnDraft?.id || 'closed'}
        item={routeReturnDraft}
        saving={isProcessing}
        onClose={() => setRouteReturnDraft(null)}
        onConfirm={handleReturnToRoute}
      />

      {reworkDraft && (
        <div onClick={() => !isProcessing && setReworkDraft(null)} style={{ position: 'fixed', inset: 0, zIndex: 10060, background: 'rgba(0,0,0,0.88)', display: 'grid', placeItems: 'center', padding: '20px' }}>
          <div onClick={event => event.stopPropagation()} style={{ width: '100%', maxWidth: '520px', background: '#0d0d0d', border: '1px solid #10b98155', borderRadius: '24px', padding: '28px', boxShadow: '0 30px 90px rgba(0,0,0,.7)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '15px' }}>
              <div>
                <div style={{ color: '#10b981', fontSize: '.7rem', fontWeight: 1000 }}>НОВИЙ НАРЯД НА ДООПРАЦЮВАННЯ</div>
                <h2 style={{ margin: '8px 0 5px', overflowWrap: 'anywhere' }}>{reworkDraft.name}</h2>
                <div style={{ color: '#777', fontSize: '.8rem' }}>Доступно: {reworkDraft.total_qty} {reworkDraft.unit || 'шт'}</div>
              </div>
              <button onClick={() => setReworkDraft(null)} disabled={isProcessing} style={{ alignSelf: 'flex-start', background: 'transparent', border: 0, color: '#777', cursor: 'pointer' }}><X size={22}/></button>
            </div>
            <label style={{ display: 'block', margin: '24px 0 8px', color: '#888', fontSize: '.7rem', fontWeight: 950 }}>КІЛЬКІСТЬ НА ДООПРАЦЮВАННЯ</label>
            <input
              autoFocus
              type="number"
              min="1"
              max={reworkDraft.total_qty}
              value={reworkQuantity}
              onChange={event => setReworkQuantity(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') handleSendToRework()
              }}
              placeholder={`Від 1 до ${reworkDraft.total_qty}`}
              style={{ boxSizing: 'border-box', width: '100%', background: '#050505', border: '1px solid #333', borderRadius: '12px', color: '#fff', padding: '14px', fontSize: '1.1rem', fontWeight: 900 }}
            />
            <div style={{ color: '#555', fontSize: '.68rem', marginTop: '8px' }}>У категорії залишиться невибрана кількість. Наряд буде створено лише на вказану кількість деталей.</div>
            <button
              onClick={handleSendToRework}
              disabled={isProcessing || !Number.isInteger(Number(reworkQuantity)) || Number(reworkQuantity) <= 0 || Number(reworkQuantity) > Number(reworkDraft.total_qty)}
              style={{ width: '100%', marginTop: '24px', background: '#10b981', border: 0, color: '#00150e', borderRadius: '13px', padding: '15px', fontWeight: 1000, cursor: 'pointer' }}
            >{isProcessing ? 'СТВОРЕННЯ...' : 'СТВОРИТИ НАРЯД НА ДООПРАЦЮВАННЯ'}</button>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .glass-panel { backdrop-filter: blur(10px); }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        .mobile-text { display: none; }
        @keyframes pulse-red {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        @media (max-width: 900px) {
          .report-filters-bar {
            flex-direction: column !important;
            align-items: stretch !important;
            padding: 15px !important;
          }
          .report-filters-bar > * {
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box;
          }
          .report-main-columns {
            flex-direction: column !important;
          }
          .report-left-column, .report-right-column {
            flex: 1 1 100% !important;
            width: 100% !important;
          }
        }
        @media (max-width: 600px) {
          .qc-catalog-container {
            padding: 15px !important;
          }
          .qc-catalog-add-row {
            flex-direction: row !important;
            align-items: stretch !important;
          }
          .qc-catalog-add-row button {
            padding: 0 15px !important;
          }
          .qc-catalog-row {
            flex-wrap: nowrap !important;
            gap: 8px !important;
            padding: 10px 12px !important;
          }
          .qc-catalog-row .row-name {
            font-size: 0.8rem !important;
            word-break: break-word !important;
            line-height: 1.2 !important;
          }
          .qc-catalog-row button {
            padding: 6px 10px !important;
            font-size: 0.7rem !important;
            min-width: auto !important;
            flex-shrink: 0 !important;
          }
          .desktop-text {
            display: none !important;
          }
          .mobile-text {
            display: inline-block !important;
          }
        }
      `}} />
    </div>
  )
}
