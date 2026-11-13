import React, { useState, useEffect, useRef, useMemo } from 'react'
import { 
  X, Barcode, QrCode, Printer, Copy, Check, Package, Clock, 
  Cpu, Layers, Boxes, FileText, ExternalLink, Edit3, Save, 
  Sparkles, RefreshCw, AlertCircle, Tag, CheckCircle2, ChevronRight, Wrench
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import JsBarcode from 'jsbarcode'
import { supabase } from '../../../../supabase'
import {
  buildFlattenedGroupOptions,
  getPartShop2RoutingFlags,
  isMissingColumnDbError,
  stripOptionalNomColumns
} from '../../utils/nomenclatureHelpers'
import { formatMinutesToHours } from '../../../../utils/cuttingTimeUtils.js'
import { CncOperationTimingsTable } from './CncOperationTimingsTable.jsx'
import { TumblingOperationTimingsTable } from './TumblingOperationTimingsTable.jsx'
import { ReceptionOperationTimingsTable } from './ReceptionOperationTimingsTable.jsx'
import { SortingOperationTimingsTable } from './SortingOperationTimingsTable.jsx'
import { Shop2OperationTimingsPanel } from './Shop2OperationTimingsPanel.jsx'

const KNOWN_CUTTER_TYPES = {
  '1ba4c09f-2fcf-4fc8-957d-80fca75d371a': { name: 'Фреза ф3', code: 'CUT-F3', type: 'Фреза ф3 кінцева' },
  '2e2f45ea-e2d8-480b-9b08-f6d6519149fb': { name: 'Фреза ф2', code: 'CUT-F2', type: 'Фреза ф2 контурна' },
  'e5b209f9-4a1e-4c39-a88d-45b0fbced448': { name: 'Фреза ф6 (90°)', code: 'CUT-F6-90', type: 'Фреза ф6 90° фаска' },
  '8fe39a64-9668-47de-950d-f10a15a3906e': { name: 'Фреза двопера 3.175', code: 'CUT-2F-3.175', type: 'Фреза 3.175мм' },
  '23a5c254-1993-4775-a748-acf80d12fb81': { name: 'Фреза 4-пера 3х3х12х75', code: 'CUT-4F-3MM', type: 'Фреза 3мм' },
  'c4ba659c-d7f1-4d18-b590-dfad96c90b19': { name: 'Фреза фасочна 6х50х120°', code: 'CUT-CHAMF-6', type: 'Фасочна 6мм' },
  'type_f15': { name: 'Фреза ф1.5', code: 'CUT-F1.5', type: 'Фреза ф1.5' },
  'type_f2': { name: 'Фреза ф2', code: 'CUT-F2', type: 'Фреза ф2' },
  'type_f3': { name: 'Фреза ф3', code: 'CUT-F3', type: 'Фреза ф3' },
  'type_f4': { name: 'Фреза ф4', code: 'CUT-F4', type: 'Фреза ф4' },
  'type_f6': { name: 'Фреза ф6', code: 'CUT-F6', type: 'Фреза ф6' },
  'type_f6_90': { name: 'Фреза ф6 (90°)', code: 'CUT-F6-90', type: 'Фреза ф6 90°' }
}

export const isDetailItem = (item, groups = []) => {
  if (!item) return false

  const grp = Array.isArray(groups) ? groups.find(g => g.id === item.group_id) : null
  const grpName = String(grp?.name || item.group_name || '').toLowerCase()
  const grpCode = String(grp?.code || '').toLowerCase()
  const grpRule = String(grp?.rule_type || '').toLowerCase()
  const itemType = String(item.type || '').toLowerCase()
  const itemRule = String(item.rule_type || item.rule_params?.rule_type || '').toLowerCase()
  const groupId = String(item.group_id || '').toLowerCase()

  let parentGrp = null
  if (grp?.parent_id && Array.isArray(groups)) {
    parentGrp = groups.find(g => g.id === grp.parent_id)
  }
  const parentName = String(parentGrp?.name || '').toLowerCase()

  // 1. Group checks: explicitly in details group or parent is details
  if (
    grpName.includes('детал') ||
    parentName.includes('детал') ||
    grpCode === 'parts' ||
    grpRule === 'frame_part' ||
    groupId === 'cat_parts' ||
    groupId === 'grp_frame_parts'
  ) {
    return true
  }

  // 2. Rule check
  if (itemRule === 'frame_part') {
    return true
  }

  // 3. Exclude non-parts explicitly
  const isNonPart = (
    itemType === 'raw' || itemType === 'hardware' || itemType === 'product' ||
    itemType === 'packaging' || itemType === 'tool' || itemType === 'service' ||
    grpName.includes('сировин') || grpName.includes('метиз') || grpName.includes('готов') ||
    grpName.includes('продукц') || grpName.includes('пакув') || grpName.includes('інструмент')
  )

  if (!isNonPart && (itemType === 'part' || itemType === 'деталь' || itemType === 'frame_part')) {
    return true
  }

  return false
}

export const NomenclatureCardModal = ({
  isOpen,
  onClose,
  item: initialItem,
  groups = [],
  itemsMap = new Map(),
  onItemUpdated
}) => {
  const [currentItem, setCurrentItem] = useState(initialItem)
  useEffect(() => {
    setCurrentItem(initialItem)
  }, [initialItem])
  const item = currentItem || initialItem

  // Detail status check
  const isDetail = useMemo(() => isDetailItem(item, groups), [item, groups])

  // Lock background body scroll when modal is open
  useEffect(() => {
    if (!isOpen) return

    const originalOverflow = document.body.style.overflow
    const originalPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }

    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.paddingRight = originalPaddingRight
    }
  }, [isOpen])

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    group_id: '',
    unit: 'шт',
    default_material_id: '',
    unitsPerSheet: '',
    requiresPressing: false,
    requiresPainting: false,
    description: ''
  })
  const [savingEdit, setSavingEdit] = useState(false)
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('')

  const shop2Flags = useMemo(() => getPartShop2RoutingFlags(item), [item])

  const flattenedGroups = useMemo(() => {
    return buildFlattenedGroupOptions(groups || [])
  }, [groups])

  const rawMaterials = useMemo(() => {
    if (!itemsMap || !itemsMap.values) return []
    return Array.from(itemsMap.values()).filter(it => 
      it && (it.type === 'raw' || String(it.group_id || '').includes('raw') || String(it.name || '').toLowerCase().includes('лист') || String(it.name || '').toLowerCase().includes('пластина'))
    )
  }, [itemsMap])

  const handleOpenEdit = () => {
    if (!item) return
    const flags = getPartShop2RoutingFlags(item)
    setEditForm({
      name: item.name || '',
      group_id: item.group_id || '',
      unit: item.unit || 'шт',
      default_material_id: item.default_material_id || item.rule_params?.default_material_id || '',
      unitsPerSheet: item.units_per_sheet || item.rule_params?.unitsPerSheet || '',
      requiresPressing: flags.requiresPressing,
      requiresPainting: flags.requiresPainting,
      description: item.description || item.rule_params?.description || item.additional_info || ''
    })
    setIsEditOpen(true)
  }

  const handleSaveEdit = async (e) => {
    if (e) e.preventDefault()
    if (!item) return
    setSavingEdit(true)
    try {
      const targetGroup = groups.find(g => g.id === editForm.group_id)
      const editIsDetail = isDetailItem({ ...item, group_id: editForm.group_id }, groups) || targetGroup?.rule_type === 'frame_part'
      const requiresPressing = editIsDetail ? Boolean(editForm.requiresPressing) : false
      const requiresPainting = editIsDetail ? Boolean(editForm.requiresPainting) : false

      const updatedRuleParams = {
        ...(item.rule_params || {}),
        unitsPerSheet: editForm.unitsPerSheet ? Number(editForm.unitsPerSheet) : undefined,
        default_material_id: editForm.default_material_id || undefined,
        description: editForm.description || undefined,
        requiresPressing,
        requiresPainting
      }

      const payload = {
        name: editForm.name.trim(),
        group_id: editForm.group_id || null,
        unit: editForm.unit || 'шт',
        default_material_id: editForm.default_material_id || null,
        requires_pressing: requiresPressing,
        requires_painting: requiresPainting,
        rule_params: updatedRuleParams,
        updated_at: new Date().toISOString()
      }

      let { error: errV2 } = await supabase
        .from('nomenclatures_v2')
        .update(payload)
        .eq('id', item.id)

      if (errV2 && isMissingColumnDbError(errV2)) {
        const legacyPayload = stripOptionalNomColumns(payload)
        const retry = await supabase
          .from('nomenclatures_v2')
          .update(legacyPayload)
          .eq('id', item.id)
        errV2 = retry.error
      }

      if (errV2) console.warn('DB update warning:', errV2)

      // Keep legacy nomenclatures table in sync if this ID or code also exists there
      try {
        const legacyV1Payload = {
          name: payload.name,
          unit: payload.unit,
          units_per_sheet: editForm.unitsPerSheet ? Number(editForm.unitsPerSheet) : null,
          requires_pressing: requiresPressing,
          requires_painting: requiresPainting
        }
        const { error: v1Err } = await supabase
          .from('nomenclatures')
          .update(legacyV1Payload)
          .eq('id', item.id)
        if (v1Err && isMissingColumnDbError(v1Err)) {
          await supabase
            .from('nomenclatures')
            .update(stripOptionalNomColumns(legacyV1Payload))
            .eq('id', item.id)
        }
      } catch (_) {}

      try {
        await supabase
          .from('nomenclature_catalog_profiles')
          .update({
            display_name: payload.name,
            group_id: payload.group_id,
            base_unit_id: payload.unit
          })
          .eq('nomenclature_id', item.id)
      } catch (e) {}

      const merged = {
        ...item,
        ...payload,
        units_per_sheet: editForm.unitsPerSheet ? Number(editForm.unitsPerSheet) : null,
        requiresPressing,
        requiresPainting
      }
      setCurrentItem(merged)
      setIsEditOpen(false)
      setSaveSuccessMsg('Зміни номенклатури успішно збережено!')
      setTimeout(() => setSaveSuccessMsg(''), 3500)

      if (onItemUpdated) {
        onItemUpdated(merged)
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mes:refresh-table', { detail: { table: 'nomenclatures_v2' } }))
        window.dispatchEvent(new CustomEvent('mes:refresh-table', { detail: { table: 'nomenclatures' } }))
        window.dispatchEvent(new CustomEvent('mes:refresh-table', { detail: { table: 'bom_items' } }))
      }
    } catch (err) {
      console.error('Error saving nomenclature edit:', err)
      alert('Помилка збереження: ' + (err.message || err))
    } finally {
      setSavingEdit(false)
    }
  }

  const [activeTab, setActiveTab] = useState('identification') // identification | params | cnc | rubber_timings | inventory | bom
  const isRubberPart = item?.rule_type === 'rubber_part'

  const [rubberSheetTimeSec, setRubberSheetTimeSec] = useState(0)
  const [rubberSheetYield, setRubberSheetYield] = useState(1)
  const [rubberMaterialId, setRubberMaterialId] = useState('')
  const [savingRubberTimings, setSavingRubberTimings] = useState(false)
  const [rubberSaveSuccess, setRubberSaveSuccess] = useState(false)

  const rubberSheets = useMemo(() => {
    const all = Array.from(itemsMap?.values?.() || [])
    return all.filter(it => {
      if (it.status === 'archived') return false
      const nameLower = String(it.name || '').toLowerCase()
      return it.rule_type === 'rubber' || nameLower.includes('гума еластична листова') || nameLower.includes('лист гуми')
    })
  }, [itemsMap])

  useEffect(() => {
    if (item) {
      setRubberSheetTimeSec(Number(item.rule_params?.sheet_cutting_time_sec) || 0)
      setRubberSheetYield(Number(item.rule_params?.sheet_yield || item.rule_params?.units_per_sheet) || 1)
      setRubberMaterialId(item.default_material_id || item.rule_params?.raw_material_id || '')
      setRubberSaveSuccess(false)
    }
  }, [item])

  const handleSaveRubberTimings = async () => {
    if (!item?.id) return
    setSavingRubberTimings(true)
    setRubberSaveSuccess(false)
    try {
      const selectedSheet = rubberSheets.find(s => s.id === rubberMaterialId)
      const nextYield = Math.max(1, Number(rubberSheetYield) || 1)
      const nextTimeSec = Math.max(0, Number(rubberSheetTimeSec) || 0)

      const nextRuleParams = {
        ...(item.rule_params || {}),
        sheet_yield: nextYield,
        units_per_sheet: nextYield,
        unitsPerSheet: nextYield,
        sheet_cutting_time_sec: nextTimeSec,
        ...(selectedSheet ? {
          raw_material_id: selectedSheet.id,
          raw_material_code: selectedSheet.code || ''
        } : {})
      }

      const payload = {
        rule_params: nextRuleParams,
        default_material_id: rubberMaterialId || null
      }

      const { error } = await supabase
        .from('nomenclatures_v2')
        .update(payload)
        .eq('id', item.id)

      if (error) throw error

      const updatedItem = { ...item, ...payload }
      setCurrentItem(updatedItem)
      setRubberSaveSuccess(true)
      if (typeof onItemUpdated === 'function') onItemUpdated(updatedItem)
      setTimeout(() => setRubberSaveSuccess(false), 3000)
    } catch (err) {
      console.error('Error saving rubber timings:', err)
      alert('Помилка збереження таймінгів: ' + (err.message || err))
    } finally {
      setSavingRubberTimings(false)
    }
  }

  // If item is not a detail, ensure 'cnc' and 'shop2' tabs cannot be active
  useEffect(() => {
    if (!isDetail && (activeTab === 'cnc' || activeTab === 'shop2')) {
      setActiveTab('identification')
    }
    if (!isRubberPart && activeTab === 'rubber_timings') {
      setActiveTab('identification')
    }
  }, [isDetail, isRubberPart, activeTab])
  const [copiedKey, setCopiedKey] = useState(null)
  const [labelSize, setLabelSize] = useState('58x40') // '58x40' | '50x30'
  const [labelMode, setLabelMode] = useState('barcode') // 'barcode' | 'qr' | 'combo'

  // Tab Data States
  const [cncOperations, setCncOperations] = useState(null)
  const [loadingCnc, setLoadingCnc] = useState(false)
  const [cuttersMap, setCuttersMap] = useState({})
  const [operationTimingsByMachine, setOperationTimingsByMachine] = useState({})
  const [selectedMachineIdx, setSelectedMachineIdx] = useState(0)
  const [cncTotals, setCncTotals] = useState({})
  const [tumblingTimings, setTumblingTimings] = useState({})
  const [tumblingTotals, setTumblingTotals] = useState({})
  const [receptionTimings, setReceptionTimings] = useState({})
  const [receptionTotals, setReceptionTotals] = useState({})
  const [sortingTimings, setSortingTimings] = useState({})
  const [sortingTotals, setSortingTotals] = useState({})

  const [inventoryBalances, setInventoryBalances] = useState([])
  const [loadingInventory, setLoadingInventory] = useState(false)

  const [bomItems, setBomItems] = useState([])
  const [whereUsedItems, setWhereUsedItems] = useState([])
  const [parentProductsMap, setParentProductsMap] = useState({})
  const [loadingBom, setLoadingBom] = useState(false)

  // SVG Refs for Barcode & QR rendering
  const barcodeSvgRef = useRef(null)
  const labelBarcodeSvgRef = useRef(null)
  const labelQrContainerRef = useRef(null)

  // Current effective barcode and QR values (always standardized to item.code / item.barcode)
  const currentBarcode = item ? (item.barcode || item.code || '') : ''
  const currentQr = item ? (item.qr_code || item.code || '') : ''

  // Helper to resolve readable cutter data
  const resolveCutterInfo = (cid, qty) => {
    const known = KNOWN_CUTTER_TYPES[cid] || KNOWN_CUTTER_TYPES[cid?.toLowerCase()]
    const nom = cuttersMap[cid] || known || (itemsMap && itemsMap.get ? itemsMap.get(cid) : null)
    let name = nom ? (nom.name || nom.code || cid) : null
    if (!name || name.startsWith('1ba4c09f')) name = 'Фреза ф3'
    else if (name.startsWith('2e2f45ea')) name = 'Фреза ф2'
    else if (name.startsWith('e5b209f9')) name = 'Фреза ф6 (90°)'
    else if (!nom) name = `Фреза (${cid.substring(0, 8)}...)`

    return {
      id: cid,
      name,
      code: nom?.code || known?.code || null,
      type: nom?.type || known?.type || null,
      qty
    }
  }

  // Render Barcode via JsBarcode whenever item, activeTab, labelSize or labelMode changes
  useEffect(() => {
    if (!isOpen || !item) return
    const valToRender = currentBarcode
    if (!valToRender) return

    // Render main card barcode
    if (barcodeSvgRef.current) {
      try {
        JsBarcode(barcodeSvgRef.current, String(valToRender), {
          format: 'CODE128',
          width: 2,
          height: 52,
          displayValue: true,
          fontSize: 13,
          margin: 4,
          background: 'transparent'
        })
      } catch (err) {
        console.warn('[Barcode] Render error:', err)
      }
    }

    // Render thermal label barcode
    if (labelBarcodeSvgRef.current) {
      try {
        const isCombo = labelMode === 'combo'
        JsBarcode(labelBarcodeSvgRef.current, String(valToRender), {
          format: 'CODE128',
          width: isCombo ? 1.25 : 1.7,
          height: isCombo ? 30 : 38,
          displayValue: true,
          fontSize: isCombo ? 9 : 11,
          margin: 2,
          background: '#ffffff'
        })
      } catch (err) {
        console.warn('[Barcode] Thermal label render error:', err)
      }
    }
  }, [isOpen, item, currentBarcode, activeTab, labelSize, labelMode])

  // Fetch CNC Operations and Cutter Nomenclatures when switching to CNC tab
  useEffect(() => {
    if (!isOpen || !item || activeTab !== 'cnc' || !isDetail) return
    const fetchCnc = async () => {
      setLoadingCnc(true)
      try {
        const idsToQuery = [item.id, ...(Array.isArray(item.legacy_ids) ? item.legacy_ids : [])].filter(Boolean)
        const { data, error } = await supabase
          .from('machine_operations')
          .select('*')
          .in('nomenclature_id', idsToQuery)
        
        if (error) throw error
        const ops = data || []
        setCncOperations(ops)

        // Collect all cutter IDs from ops
        const cutterIds = []
        ops.forEach(op => {
          [...(op.side1_ops || []), ...(op.side2_ops || []), ...(op.side2_cut_ops || [])].forEach(s => {
            if (typeof s === 'string' && s.startsWith('__CUTTER__')) {
              const cid = s.split(':')[1]
              if (cid && !cutterIds.includes(cid)) cutterIds.push(cid)
            }
          })
        })

        if (cutterIds.length > 0) {
          const [resV1, resV2, resMat, resInv, resCharV1] = await Promise.all([
            supabase.from('nomenclatures').select('id, name, type, characteristic').in('id', cutterIds),
            supabase.from('nomenclatures_v2').select('id, name, code').in('id', cutterIds),
            supabase.from('materials').select('id, name').in('id', cutterIds),
            supabase.from('inventory').select('id, name, nomenclature_id').or(`id.in.(${cutterIds.join(',')}),nomenclature_id.in.(${cutterIds.join(',')})`),
            supabase.from('nomenclatures').select('id, name, type, characteristic').in('characteristic', cutterIds)
          ])
          const cMap = {}
          // 1. Initialise with KNOWN_CUTTER_TYPES
          cutterIds.forEach(cid => {
            const hit = KNOWN_CUTTER_TYPES[cid] || KNOWN_CUTTER_TYPES[cid?.toLowerCase()]
            if (hit) cMap[cid] = hit
          })
          // 2. From inventory
          ;(resInv?.data || []).forEach(inv => {
            if (inv.nomenclature_id && inv.name) cMap[inv.nomenclature_id] = { id: inv.nomenclature_id, name: inv.name }
            if (inv.id && inv.name) cMap[inv.id] = { id: inv.id, name: inv.name }
          })
          // 3. From characteristic
          ;(resCharV1?.data || []).forEach(n => {
            if (n.characteristic && n.name) cMap[n.characteristic] = { id: n.id, name: n.name, code: n.type }
          })
          // 4. From materials
          ;(resMat?.data || []).forEach(n => { if (n.name && !cMap[n.id]) cMap[n.id] = n })
          // 5. From nomenclatures v2
          ;(resV2?.data || []).forEach(n => { if (n.name) cMap[n.id] = n })
          // 6. From nomenclatures v1
          ;(resV1?.data || []).forEach(n => { if (n.name) cMap[n.id] = n })
          
          setCuttersMap(cMap)
        }

        // Fetch operation timings
        try {
          const { data: timingRows } = await supabase
            .from('cutting_operation_timings')
            .select('*')
            .in('nomenclature_id', idsToQuery)
          const timingsMap = { ...(item.rule_params?.operation_timings || {}) }
          if (Array.isArray(timingRows) && timingRows.length > 0) {
            timingRows.forEach(row => {
              if (!timingsMap[row.machine_type]) timingsMap[row.machine_type] = {}
              timingsMap[row.machine_type][row.operation_name] = row.timings || {}
            })
          }
          setOperationTimingsByMachine(timingsMap)
        } catch (timingErr) {
          console.warn('[NomenclatureCard] Error loading cutting_operation_timings:', timingErr)
          setOperationTimingsByMachine(item.rule_params?.operation_timings || {})
        }
        setTumblingTimings(item?.rule_params?.tumbling_operation_timings || {})
        setReceptionTimings(item?.rule_params?.reception_operation_timings || {})
        setSortingTimings(item?.rule_params?.sorting_operation_timings || {})
      } catch (err) {
        console.warn('[NomenclatureCard] Error loading CNC ops:', err)
        setCncOperations([])
      } finally {
        setLoadingCnc(false)
      }
    }
    fetchCnc()
  }, [isOpen, item, activeTab])

  const persistShop1RuleParams = async (ruleParamsPatch) => {
    if (!item?.id) return null
    const nextRuleParams = {
      ...(item.rule_params || {}),
      ...ruleParamsPatch
    }
    // Remove legacy loadTimings so cleared/edited Shop 1 timings never fall back to stale values
    delete nextRuleParams.loadTimings

    const payload = {
      rule_params: nextRuleParams,
      updated_at: new Date().toISOString()
    }

    const [v2Res, v1Res] = await Promise.all([
      supabase.from('nomenclatures_v2').update(payload).eq('id', item.id),
      supabase.from('nomenclatures').update(payload).eq('id', item.id)
    ])

    if (v2Res?.error && v1Res?.error) {
      throw v2Res.error
    }
    if (v2Res?.error || v1Res?.error) {
      console.warn('[NomenclatureCard] Partial rule_params update:', v2Res?.error || v1Res?.error)
    }

    const updated = { ...item, rule_params: nextRuleParams }
    setCurrentItem(updated)
    if (typeof onItemUpdated === 'function') {
      onItemUpdated(updated)
    }
    return updated
  }

  // Save operation timings per machine type
  const handleSaveOperationTimings = async (machineType, newTimings) => {
    if (!item?.id) return
    const upsertRows = Object.entries(newTimings).map(([opName, tObj]) => ({
      nomenclature_id: item.id,
      machine_type: machineType,
      operation_name: opName,
      timings: tObj,
      updated_at: new Date().toISOString()
    }))
    try {
      if (upsertRows.length > 0) {
        await supabase.from('cutting_operation_timings').upsert(upsertRows, { onConflict: 'nomenclature_id,machine_type,operation_name' })
      }
    } catch (dbErr) {
      console.warn('Could not upsert into cutting_operation_timings, fallback to rule_params:', dbErr)
    }
    const currentOpTimings = {
      ...(item.rule_params?.operation_timings || {}),
      [machineType]: newTimings
    }
    await persistShop1RuleParams({ operation_timings: currentOpTimings })
    setOperationTimingsByMachine(prev => ({
      ...prev,
      [machineType]: newTimings
    }))
  }

  // Save tumbling operation timings
  const handleSaveTumblingTimings = async (newTimings, totalsPerSheet) => {
    if (!item?.id) return
    await persistShop1RuleParams({ tumbling_operation_timings: newTimings })
    setTumblingTimings(newTimings)
    setTumblingTotals(totalsPerSheet)
  }

  // Save reception operation timings
  const handleSaveReceptionTimings = async (newTimings, totalsPerSheet) => {
    if (!item?.id) return
    await persistShop1RuleParams({ reception_operation_timings: newTimings })
    setReceptionTimings(newTimings)
    setReceptionTotals(totalsPerSheet)
  }

  // Save sorting operation timings
  const handleSaveSortingTimings = async (newTimings, totalsPerSheet) => {
    if (!item?.id) return
    await persistShop1RuleParams({ sorting_operation_timings: newTimings })
    setSortingTimings(newTimings)
    setSortingTotals(totalsPerSheet)
  }

  // Save Shop 2 operations & per-unit planned timings
  const handleSaveShop2Timings = async ({ shop2_operation_timings, requiresPressing, requiresPainting }) => {
    if (!item?.id) return
    const nextRuleParams = {
      ...(item.rule_params || {}),
      shop2_operation_timings,
      requiresPressing,
      requiresPainting
    }

    const v2Payload = {
      rule_params: nextRuleParams,
      requires_pressing: requiresPressing,
      requires_painting: requiresPainting,
      updated_at: new Date().toISOString()
    }

    let { error: v2Err } = await supabase
      .from('nomenclatures_v2')
      .update(v2Payload)
      .eq('id', item.id)

    if (v2Err && isMissingColumnDbError(v2Err)) {
      const retry = await supabase
        .from('nomenclatures_v2')
        .update(stripOptionalNomColumns(v2Payload))
        .eq('id', item.id)
      v2Err = retry.error
    }

    if (v2Err) console.warn('[NomenclatureCard] Shop 2 timings update warning:', v2Err)

    try {
      const v1Payload = { requires_pressing: requiresPressing, requires_painting: requiresPainting }
      const { error: v1Err } = await supabase.from('nomenclatures').update(v1Payload).eq('id', item.id)
      if (v1Err && isMissingColumnDbError(v1Err)) {
        // Legacy table does not have rule_params; skip if boolean columns not yet migrated
      }
    } catch (_) {}

    const updated = {
      ...item,
      rule_params: nextRuleParams,
      requires_pressing: requiresPressing,
      requires_painting: requiresPainting,
      requiresPressing,
      requiresPainting
    }
    setCurrentItem(updated)
    if (typeof onItemUpdated === 'function') {
      onItemUpdated(updated)
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mes:refresh-table', { detail: { table: 'nomenclatures_v2' } }))
      window.dispatchEvent(new CustomEvent('mes:refresh-table', { detail: { table: 'nomenclatures' } }))
    }
    return updated
  }

  // Fetch Inventory balances when switching to inventory tab
  useEffect(() => {
    if (!isOpen || !item || activeTab !== 'inventory') return
    const fetchInventory = async () => {
      setLoadingInventory(true)
      try {
        const idsToQuery = [
          item.id,
          item.nomenclature_id,
          ...(Array.isArray(item.legacy_ids) ? item.legacy_ids : [])
        ].filter(Boolean).map(String)

        const uniqueIds = [...new Set(idsToQuery)]

        const queries = []
        if (uniqueIds.length > 0) {
          queries.push(supabase.from('inventory').select('*').in('nomenclature_id', uniqueIds))
        }
        if (item.name) {
          queries.push(supabase.from('inventory').select('*').eq('name', item.name))
        }

        const results = await Promise.all(queries)
        const map = new Map()
        results.forEach(res => {
          if (!res.error && Array.isArray(res.data)) {
            res.data.forEach(r => map.set(r.id, r))
          }
        })

        const whOrder = { operational: 1, production: 2, pocket: 3, sgp: 4, shop1: 5, shop2: 6, scrap: 7 }
        const sorted = Array.from(map.values()).sort((a, b) => {
          const ordA = whOrder[a.warehouse] || 99
          const ordB = whOrder[b.warehouse] || 99
          return ordA - ordB
        })

        setInventoryBalances(sorted)
      } catch (err) {
        console.warn('[NomenclatureCard] Error loading inventory:', err)
        setInventoryBalances([])
      } finally {
        setLoadingInventory(false)
      }
    }
    fetchInventory()
  }, [isOpen, item, activeTab])

  // Fetch BOM items and Where-Used Specifications when switching to BOM tab
  useEffect(() => {
    if (!isOpen || !item || activeTab !== 'bom') return
    const fetchBom = async () => {
      setLoadingBom(true)
      try {
        const idsToQuery = [item.id, ...(Array.isArray(item.legacy_ids) ? item.legacy_ids : [])].filter(Boolean)

        // Query components this item consists of AND specifications this item is part of
        const [resParentBom, resWhereUsed] = await Promise.all([
          supabase.from('bom_items').select('*').in('parent_id', idsToQuery),
          supabase.from('bom_items').select('*').in('child_id', idsToQuery)
        ])

        const childBom = resParentBom?.data || []
        const parentBom = resWhereUsed?.data || []

        setBomItems(childBom)
        setWhereUsedItems(parentBom)

        // Missing nomenclature IDs to resolve (both child components and parent products)
        const missingIds = [
          ...childBom.map(b => b.child_id),
          ...parentBom.map(b => b.parent_id)
        ].filter(id => id && !itemsMap.has(id))

        const uniqueMissingIds = [...new Set(missingIds)]

        if (uniqueMissingIds.length > 0) {
          const [resV1, resV2] = await Promise.all([
            supabase.from('nomenclatures').select('id, name, type, group_id').in('id', uniqueMissingIds),
            supabase.from('nomenclatures_v2').select('id, name, code, type, group_id').in('id', uniqueMissingIds)
          ])
          const pMap = {}
          ;(resV1?.data || []).forEach(n => { pMap[n.id] = n })
          ;(resV2?.data || []).forEach(n => { pMap[n.id] = n })
          setParentProductsMap(pMap)
        }
      } catch (err) {
        console.warn('[NomenclatureCard] Error loading BOM:', err)
        setBomItems([])
        setWhereUsedItems([])
      } finally {
        setLoadingBom(false)
      }
    }
    fetchBom()
  }, [isOpen, item, activeTab])

  if (!isOpen || !item) return null

  const grp = groups.find(g => g.id === item.group_id)
  const linkedSheet = item.default_material_id ? (itemsMap.get(item.default_material_id) || null) : null
  const normQty = item.rule_params?.unitsPerSheet || item.rule_params?.sheet_yield || item.rule_params?.units_per_sheet || item.units_per_sheet || null
  const cutterRes = item.rule_params?.cutterResource === 'custom' 
    ? item.rule_params?.customCutterResource 
    : (item.rule_params?.cutterResource || item.cutter_resource || null)

  const copyToClipboard = (text, key) => {
    if (!text) return
    navigator.clipboard.writeText(String(text))
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }



  // Print Thermal Label (Barcode / QR / Combo)
  const handlePrintThermalLabel = () => {
    const isSmall = labelSize === '50x30'
    const labelWidth = isSmall ? '50mm' : '58mm'
    const labelHeight = isSmall ? '30mm' : '40mm'

    const barcodeSvgHtml = labelBarcodeSvgRef.current ? labelBarcodeSvgRef.current.outerHTML : ''
    const qrSvgHtml = labelQrContainerRef.current ? labelQrContainerRef.current.innerHTML : ''

    let middleContentHtml = ''
    if (labelMode === 'barcode') {
      middleContentHtml = `
        <div class="barcode-wrap">
          ${barcodeSvgHtml}
        </div>
      `
    } else if (labelMode === 'qr') {
      middleContentHtml = `
        <div class="qr-wrap">
          ${qrSvgHtml}
          <div class="qr-code-text">${item.code}</div>
        </div>
      `
    } else {
      // combo: barcode + QR
      middleContentHtml = `
        <div class="combo-wrap">
          <div class="combo-barcode">${barcodeSvgHtml}</div>
          <div class="combo-qr">${qrSvgHtml}</div>
        </div>
      `
    }

    // Create printable iframe
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow.document
    doc.open()
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Друк етикетки - ${item.code}</title>
        <style>
          @page {
            size: ${labelWidth} ${labelHeight};
            margin: 0;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            width: ${labelWidth};
            height: ${labelHeight};
            background: #fff;
            color: #000;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: ${isSmall ? '2mm 3mm' : '3mm 4mm'};
            overflow: hidden;
            -webkit-print-color-adjust: exact;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #000;
            padding-bottom: 2px;
            margin-bottom: 2px;
          }
          .brand {
            font-size: ${isSmall ? '7.5px' : '9px'};
            font-weight: 900;
            letter-spacing: 0.5px;
          }
          .code {
            font-size: ${isSmall ? '7.5px' : '9.5px'};
            font-weight: 800;
            font-family: monospace;
          }
          .title {
            font-size: ${isSmall ? '8.5px' : '10.5px'};
            font-weight: 800;
            line-height: 1.15;
            max-height: ${isSmall ? '20px' : '26px'};
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          }
          .barcode-wrap {
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 1px 0;
          }
          .barcode-wrap svg {
            max-width: 100%;
            height: ${isSmall ? '30px' : '38px'};
          }
          .qr-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            margin: 1px 0;
          }
          .qr-wrap svg {
            width: ${isSmall ? '20mm' : '24mm'};
            height: ${isSmall ? '20mm' : '24mm'};
          }
          .qr-code-text {
            font-size: ${isSmall ? '7px' : '8.5px'};
            font-family: monospace;
            font-weight: 800;
            margin-top: 1px;
          }
          .combo-wrap {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 2mm;
            margin: 1px 0;
          }
          .combo-barcode {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 0;
          }
          .combo-barcode svg {
            max-width: 100%;
            height: ${isSmall ? '26px' : '32px'};
          }
          .combo-qr svg {
            width: ${isSmall ? '15mm' : '18mm'};
            height: ${isSmall ? '15mm' : '18mm'};
          }
          .footer {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            font-size: ${isSmall ? '7px' : '8.5px'};
            font-weight: 700;
            color: #333;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <span class="brand">CENTRUM ERP</span>
          <span class="code">${item.code}</span>
        </div>
        <div class="title">${item.name}</div>
        ${middleContentHtml}
        <div class="footer">
          <span>Од: ${item.unit || 'шт'}</span>
          <span>${new Date().toLocaleDateString('uk-UA')}</span>
        </div>
      </body>
      </html>
    `)
    doc.close()

    iframe.contentWindow.focus()
    setTimeout(() => {
      iframe.contentWindow.print()
      setTimeout(() => {
        document.body.removeChild(iframe)
      }, 1000)
    }, 250)
  }

  // Inventory Totals calculation
  const totalStockQty = inventoryBalances.reduce((sum, row) => sum + (Number(row.total_qty) || 0), 0)
  const totalReservedQty = inventoryBalances.reduce((sum, row) => sum + (Number(row.reserved_qty) || 0), 0)
  const freeAvailableQty = totalStockQty - totalReservedQty

  return (
    <>
      <div 
        style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        overscrollBehavior: 'contain'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: 'var(--card-bg, #ffffff)',
          color: 'var(--text, #0f172a)',
          width: '100%',
          maxWidth: '1080px',
          maxHeight: '92vh',
          borderRadius: '24px',
          border: '1px solid var(--border-color, #e2e8f0)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div style={{
          padding: '20px 28px',
          borderBottom: '1px solid var(--border-color, #e2e8f0)',
          background: 'var(--card-header-bg, #f8fafc)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #ff9000 0%, #ea580c 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 6px 16px rgba(255, 144, 0, 0.3)'
            }}>
              <Barcode size={26} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '3px' }}>
                <span style={{
                  fontFamily: 'monospace',
                  fontWeight: 900,
                  fontSize: '0.95rem',
                  color: '#d97706',
                  background: 'rgba(217, 119, 6, 0.1)',
                  padding: '2px 8px',
                  borderRadius: '6px'
                }}>
                  {item.code}
                </span>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: 'var(--text-muted, #64748b)',
                  background: 'var(--bg, #f1f5f9)',
                  padding: '2px 8px',
                  borderRadius: '6px'
                }}>
                  {grp ? grp.name : 'Категорія не вказана'}
                </span>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  color: '#059669',
                  background: '#dcfce7',
                  padding: '2px 8px',
                  borderRadius: '6px'
                }}>
                  ● Активно
                </span>
                {isDetail && shop2Flags.requiresPressing && (
                  <span style={{
                    background: 'rgba(249, 115, 22, 0.12)',
                    color: '#ea580c',
                    border: '1px solid rgba(249, 115, 22, 0.3)',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '6px'
                  }}>
                    🔩 Пресування
                  </span>
                )}
                {isDetail && shop2Flags.requiresPainting && (
                  <span style={{
                    background: 'rgba(139, 92, 246, 0.12)',
                    color: '#7c3aed',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '6px'
                  }}>
                    🎨 Фарбування
                  </span>
                )}
              </div>
              <h2 style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: 900,
                color: 'var(--text, #0f172a)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }} title={item.name}>
                {item.name}
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              onClick={handleOpenEdit}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '10px',
                background: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                color: '#6366f1',
                fontWeight: 800,
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              title="Редагувати параметри номенклатури"
            >
              <Edit3 size={15} />
              <span>Редагувати</span>
            </button>

            <a
              href={`/nomenclature-v2?search=${encodeURIComponent(item.code || item.name || '')}&card=${item.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '10px',
                background: 'rgba(15, 23, 42, 0.05)',
                border: '1px solid var(--border-color, #e2e8f0)',
                color: 'var(--text-muted, #64748b)',
                fontWeight: 800,
                fontSize: '0.8rem',
                textDecoration: 'none',
                transition: 'all 0.15s'
              }}
              title="Відкрити в повному каталозі 2.0 у новій вкладці"
            >
              <span>Каталог 2.0</span>
              <ExternalLink size={13} />
            </a>

            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted, #64748b)',
                padding: '8px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s'
              }}
              className="hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* TABS NAVIGATION */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color, #e2e8f0)',
          background: 'var(--card-bg, #ffffff)',
          padding: '0 24px',
          overflowX: 'auto',
          gap: '8px',
          flexShrink: 0
        }}>
          {[
            { id: 'identification', label: 'Ідентифікація & Друк', icon: Barcode },
            { id: 'params', label: 'Параметри та Сировина', icon: Layers },
            ...(isDetail ? [
              { id: 'cnc', label: 'Операції Цех №1', icon: Cpu },
              { id: 'shop2', label: 'Операції Цеху №2', icon: Wrench }
            ] : []),
            ...(isRubberPart ? [
              { id: 'rubber_timings', label: 'Таймінги порізки', icon: Clock }
            ] : []),
            { id: 'inventory', label: 'Складські залишки', icon: Boxes },
            { id: 'bom', label: 'Специфікація BOM', icon: Package }
          ].map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '14px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? '3px solid #ff9000' : '3px solid transparent',
                  color: isActive ? '#ff9000' : 'var(--text-muted, #64748b)',
                  fontWeight: isActive ? 900 : 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s'
                }}
              >
                <Icon size={17} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* TAB CONTENT AREA */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          padding: '24px 28px',
          background: 'var(--bg, #f8fafc)'
        }}>

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 1: IDENTIFICATION & BARCODE / QR / PRINTING
              ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'identification' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
              
              {/* Left Column: Visual Barcode & QR Display */}
              <div style={{
                background: 'var(--card-bg, #ffffff)',
                borderRadius: '18px',
                padding: '22px',
                border: '1px solid var(--border-color, #e2e8f0)',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.02)'
              }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Barcode size={20} color="#ff9000" />
                    Штрихкод (Code 128)
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted, #64748b)' }}>
                    Стандартний промисловий штрихкод для сканерів складу та цеху
                  </p>
                </div>

                {/* Main Barcode Display Card */}
                <div style={{
                  background: '#ffffff',
                  border: '2px dashed var(--border-color, #cbd5e1)',
                  borderRadius: '14px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '110px'
                }}>
                  <svg ref={barcodeSvgRef} style={{ maxWidth: '100%' }} />
                </div>

                {/* QR Code and Quick Details Box */}
                <div style={{
                  display: 'flex',
                  gap: '16px',
                  background: 'var(--bg, #f1f5f9)',
                  borderRadius: '14px',
                  padding: '16px',
                  alignItems: 'center'
                }}>
                  <div style={{
                    background: '#ffffff',
                    padding: '8px',
                    borderRadius: '10px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    flexShrink: 0
                  }}>
                    <QRCodeSVG 
                      value={currentQr || item.code} 
                      size={100} 
                      level="M" 
                      includeMargin={false} 
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', fontWeight: 700 }}>
                      Вміст QR-коду (Payload):
                    </div>
                    <div style={{
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                      fontWeight: 800,
                      color: 'var(--text, #0f172a)',
                      wordBreak: 'break-all',
                      background: 'var(--card-bg, #ffffff)',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #e2e8f0)'
                    }}>
                      {currentQr || item.code}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button
                        onClick={() => copyToClipboard(currentQr || item.code, 'qr')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          background: 'rgba(255, 144, 0, 0.1)',
                          border: '1px solid rgba(255, 144, 0, 0.3)',
                          color: '#d97706',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        {copiedKey === 'qr' ? <Check size={12} /> : <Copy size={12} />}
                        {copiedKey === 'qr' ? 'Скопійовано' : 'Копіювати'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Enterprise Standardization Guarantee Banner */}
                <div style={{
                  borderTop: '1px solid var(--border-color, #e2e8f0)',
                  paddingTop: '16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  background: 'rgba(5, 150, 105, 0.06)',
                  border: '1px solid rgba(5, 150, 105, 0.2)',
                  borderRadius: '14px',
                  padding: '14px 16px'
                }}>
                  <CheckCircle2 size={22} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#065f46', marginBottom: '3px' }}>
                      Єдиний ERP-стандарт маркування CENTRUM
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#047857', lineHeight: 1.45 }}>
                      Штрихкод (Code 128) та QR-код згенеровано автоматично на основі уніфікованого коду позиції <b>{item.code}</b>. Ручна модифікація заблокована для забезпечення 100% точності сканування на всіх ділянках виробництва та складу.
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column: Thermal Label Printer & Preview */}
              <div style={{
                background: 'var(--card-bg, #ffffff)',
                borderRadius: '18px',
                padding: '22px',
                border: '1px solid var(--border-color, #e2e8f0)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.02)'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Printer size={20} color="#ff9000" />
                        Термо-друк стікера (етикетки)
                      </h3>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted, #64748b)' }}>
                        Підготовка на термопринтери (Xprinter, Zebra, TSC)
                      </p>
                    </div>

                    {/* Size Selector */}
                    <div style={{ display: 'flex', background: 'var(--bg, #f1f5f9)', padding: '3px', borderRadius: '8px', gap: '2px' }}>
                      <button
                        onClick={() => setLabelSize('58x40')}
                        style={{
                          background: labelSize === '58x40' ? '#ffffff' : 'transparent',
                          color: labelSize === '58x40' ? '#ff9000' : 'var(--text-muted, #64748b)',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        58x40 мм
                      </button>
                      <button
                        onClick={() => setLabelSize('50x30')}
                        style={{
                          background: labelSize === '50x30' ? '#ffffff' : 'transparent',
                          color: labelSize === '50x30' ? '#ff9000' : 'var(--text-muted, #64748b)',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        50x30 мм
                      </button>
                    </div>
                  </div>

                  {/* Mode / Layout Selector: Barcode vs QR vs Combo */}
                  <div style={{
                    display: 'flex',
                    background: 'var(--bg, #f1f5f9)',
                    padding: '4px',
                    borderRadius: '10px',
                    gap: '4px'
                  }}>
                    {[
                      { id: 'barcode', label: 'Штрихкод', icon: Barcode },
                      { id: 'qr', label: 'QR-код', icon: QrCode },
                      { id: 'combo', label: 'Штрих + QR (Комбо)', icon: Sparkles }
                    ].map(m => {
                      const Icon = m.icon
                      const isSel = labelMode === m.id
                      return (
                        <button
                          key={m.id}
                          onClick={() => setLabelMode(m.id)}
                          style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            background: isSel ? '#ffffff' : 'transparent',
                            color: isSel ? '#ff9000' : 'var(--text-muted, #64748b)',
                            border: isSel ? '1px solid var(--border-color, #cbd5e1)' : '1px solid transparent',
                            borderRadius: '8px',
                            padding: '6px 8px',
                            fontSize: '0.75rem',
                            fontWeight: isSel ? 900 : 700,
                            cursor: 'pointer',
                            boxShadow: isSel ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                            transition: 'all 0.15s'
                          }}
                        >
                          <Icon size={14} />
                          <span>{m.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Thermal Sticker Visual Preview */}
                <div style={{
                  background: 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)',
                  padding: '28px',
                  borderRadius: '16px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <div 
                    id="thermal-label-preview"
                    style={{
                      width: labelSize === '50x30' ? '240px' : '280px',
                      height: labelSize === '50x30' ? '145px' : '185px',
                      background: '#ffffff',
                      borderRadius: '8px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      color: '#000000',
                      position: 'relative'
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #000000', paddingBottom: '3px' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.5px' }}>CENTRUM ERP</span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 900, fontFamily: 'monospace' }}>{item.code}</span>
                    </div>

                    {/* Title */}
                    <div style={{
                      fontSize: labelSize === '50x30' ? '0.72rem' : '0.82rem',
                      fontWeight: 800,
                      lineHeight: 1.2,
                      maxHeight: '34px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}>
                      {item.name}
                    </div>

                    {/* Middle preview area depending on labelMode */}
                    {labelMode === 'barcode' && (
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <svg ref={labelBarcodeSvgRef} style={{ maxWidth: '100%' }} />
                      </div>
                    )}

                    {labelMode === 'qr' && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '2px 0' }}>
                        <QRCodeSVG value={currentQr || item.code} size={labelSize === '50x30' ? 68 : 84} level="M" />
                        <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', fontWeight: 800, color: '#0f172a', marginTop: '3px' }}>
                          {item.code}
                        </span>
                      </div>
                    )}

                    {labelMode === 'combo' && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', margin: '2px 0' }}>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0 }}>
                          <svg ref={labelBarcodeSvgRef} style={{ maxWidth: '100%' }} />
                        </div>
                        <div style={{ flexShrink: 0, padding: '2px', background: '#ffffff', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                          <QRCodeSVG value={currentQr || item.code} size={labelSize === '50x30' ? 50 : 62} level="M" />
                        </div>
                      </div>
                    )}

                    {/* Footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.65rem', fontWeight: 700, color: '#475569' }}>
                      <span>Од.вим: {item.unit || 'шт'}</span>
                      <span>Стікер готовий до наклейки</span>
                    </div>
                  </div>
                </div>

                {/* Hidden container to grab QR svg for print doc */}
                <div ref={labelQrContainerRef} style={{ display: 'none' }}>
                  <QRCodeSVG 
                    value={currentQr || item.code} 
                    size={labelMode === 'combo' ? (labelSize === '50x30' ? 68 : 84) : (labelSize === '50x30' ? 95 : 115)} 
                    level="M" 
                  />
                </div>

                {/* Print Trigger Button */}
                <button
                  onClick={handlePrintThermalLabel}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    background: 'linear-gradient(135deg, #ff9000 0%, #ea580c 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '14px 20px',
                    fontSize: '0.95rem',
                    fontWeight: 900,
                    cursor: 'pointer',
                    boxShadow: '0 6px 20px rgba(255, 144, 0, 0.35)',
                    transition: 'all 0.2s'
                  }}
                >
                  <Printer size={20} />
                  Роздрукувати {labelMode === 'barcode' ? 'штрихкод' : labelMode === 'qr' ? 'QR-код' : 'комбо стікер (Штрих + QR)'} ({labelSize} мм)
                </button>

                {/* Quick Info Tip */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  background: 'rgba(255, 144, 0, 0.08)',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  fontSize: '0.75rem',
                  color: '#b45309',
                  lineHeight: 1.4
                }}>
                  <Sparkles size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>
                    Термо-етикетка оптимізована під 100% сумісність із принтерами Xprinter / Zebra (без полів, точний векторний SVG).
                  </span>
                </div>
              </div>

            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 2: TECHNICAL PARAMETERS & RAW MATERIAL
              ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'params' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Material & Yield Card */}
              <div style={{
                background: 'var(--card-bg, #ffffff)',
                borderRadius: '16px',
                padding: '20px 24px',
                border: '1px solid var(--border-color, #e2e8f0)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '20px'
              }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>
                    Зв'язана листова сировина
                  </div>
                  {linkedSheet ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.4rem' }}>📄</span>
                      <div>
                        <div style={{ fontWeight: 900, color: '#059669', fontSize: '0.95rem' }}>{linkedSheet.name}</div>
                        <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted, #64748b)' }}>{linkedSheet.code}</div>
                      </div>
                    </div>
                  ) : item.default_material_id ? (
                    <div style={{ color: '#059669', fontWeight: 800 }}>Лист [ID: {item.default_material_id.substring(0, 8)}...]</div>
                  ) : (
                    <div style={{ color: '#dc2626', fontWeight: 800, fontSize: '0.85rem' }}>⚠️ Сировину не закріплено</div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>
                    Кількість на листі
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: normQty ? '#059669' : 'var(--text-muted, #64748b)' }}>
                    {normQty ? `${normQty} шт / лист` : '—'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>
                    Ресурс фрези
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: cutterRes ? '#d97706' : 'var(--text-muted, #64748b)' }}>
                    {cutterRes ? `${cutterRes} л / фр` : '—'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>
                    Базова одиниця виміру
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text, #0f172a)' }}>
                    {item.unit || 'шт'}
                  </div>
                </div>
              </div>

              {/* Full Rule Params JSON Explorer */}
              <div style={{
                background: 'var(--card-bg, #ffffff)',
                borderRadius: '16px',
                padding: '20px 24px',
                border: '1px solid var(--border-color, #e2e8f0)'
              }}>
                <h3 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Tag size={18} color="#ff9000" />
                  Усі технічні параметри:
                </h3>

                {item.rule_params && Object.keys(item.rule_params).length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    {Object.entries(item.rule_params)
                      .filter(([key]) => key !== 'loadTimings')
                      .map(([key, value]) => {
                        const paramLabels = {
                          part_size: 'Розмір виробу (мм)',
                          program_name: 'Програма / маркування',
                          sheet_size: 'Розмір листа (мм)',
                          thickness: 'Товщина (мм)',
                          sheet_yield: 'Кількість на листі (шт)',
                          units_per_sheet: 'Кількість на листі (шт)',
                          unitsPerSheet: 'Кількість на листі (шт)',
                          sheet_cutting_time_sec: 'Час обробки 1 листа (сек)',
                          item_cutting_time_sec: 'Час на 1 деталь (сек)',
                          raw_material_code: 'Код сировини (листа)',
                          raw_material_id: 'ID сировини',
                          default_material_id: 'ID основного матеріалу',
                          customName: 'Власна назва',
                          unit: 'Одиниця виміру',
                          requiresPressing: 'Потрібне пресування',
                          requiresPainting: 'Потрібне фарбування',
                          dimensions: 'Габарити',
                          grade: 'Марка',
                          sheetGrade: 'Марка листа',
                          sheetThickness: 'Товщина листа (мм)',
                          rawSheet: 'Робочий лист',
                          standard: 'Стандарт (DIN / ISO)',
                          diameter: 'Діаметр / різьба',
                          length: 'Довжина (мм)',
                          isBlack: 'Чорний (оксидований)',
                          isPartialThread: 'Неповна різьба',
                          type: 'Тип',
                          thread: 'Різьба',
                          tailLength: 'Довжина хвостовика',
                          outerDiameter: 'Зовнішній діаметр',
                          material: 'Матеріал',
                          cutDia: 'Діаметр різу',
                          shankDia: 'Діаметр хвостовика',
                          cutLength: 'Довжина різу',
                          totalLength: 'Загальна довжина',
                          angle: 'Кут',
                          specialType: 'Спецтип',
                          din: 'Стандарт DIN',
                          projType: 'Тип проєкту',
                          projNum: 'Номер проєкту',
                          name: 'Назва',
                          extra: 'Додатково'
                        };
                        const label = paramLabels[key] || key;
                        return (
                          <div 
                            key={key}
                            style={{
                              background: 'var(--bg, #f8fafc)',
                              border: '1px solid var(--border-color, #e2e8f0)',
                              borderRadius: '10px',
                              padding: '10px 14px'
                            }}
                          >
                            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase' }}>
                              {label}
                            </div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text, #0f172a)', marginTop: '3px', wordBreak: 'break-word' }}>
                              {typeof value === 'boolean' ? (value ? 'Так' : 'Ні') : String(value || '—')}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.85rem' }}>Параметри відсутні</div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              TAB: RUBBER CUTTING TIMINGS (ТАЙМІНГИ ПОРІЗКИ ГУМИ)
              ══════════════════════════════════════════════════════════════════════ */}
          {isRubberPart && activeTab === 'rubber_timings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{
                background: 'var(--card-bg, #ffffff)',
                borderRadius: '16px',
                padding: '24px',
                border: '1px solid var(--border-color, #e2e8f0)',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={18} color="#ff9000" />
                      Таймінги та параметри порізки листа гуми
                    </h3>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748b)', marginTop: '4px', fontWeight: 600 }}>
                      Завжди ріжеться цілий лист гуми, тому плановий час розраховується виключно за часом обробки 1 листа.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                      Матеріал (лист гуми)
                    </label>
                    <select
                      value={rubberMaterialId}
                      onChange={e => setRubberMaterialId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color, #cbd5e1)',
                        background: 'var(--bg, #f8fafc)',
                        color: 'var(--text, #0f172a)',
                        fontWeight: 800,
                        fontSize: '0.88rem'
                      }}
                    >
                      <option value="">-- Оберіть лист гуми --</option>
                      {rubberSheets.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} [{s.code}]
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                      Кількість на листі (шт)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={rubberSheetYield}
                      onChange={e => setRubberSheetYield(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color, #cbd5e1)',
                        background: 'var(--bg, #f8fafc)',
                        color: 'var(--text, #0f172a)',
                        fontWeight: 900,
                        fontSize: '0.95rem'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                      Час обробки 1 листа (сек)
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="number"
                        min="0"
                        value={rubberSheetTimeSec}
                        onChange={e => setRubberSheetTimeSec(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: '1px solid var(--border-color, #cbd5e1)',
                          background: 'var(--bg, #f8fafc)',
                          color: 'var(--text, #0f172a)',
                          fontWeight: 900,
                          fontSize: '0.95rem'
                        }}
                      />
                      <span style={{
                        fontSize: '0.85rem',
                        fontWeight: 900,
                        color: '#38bdf8',
                        background: 'rgba(56, 189, 248, 0.12)',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        whiteSpace: 'nowrap',
                        fontFamily: 'monospace'
                      }}>
                        {Math.floor((Number(rubberSheetTimeSec) || 0) / 60).toString().padStart(2, '0')}:
                        {((Number(rubberSheetTimeSec) || 0) % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', paddingTop: '8px', borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
                  {rubberSaveSuccess && (
                    <span style={{ color: '#10b981', fontWeight: 800, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={16} /> Збережено!
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveRubberTimings}
                    disabled={savingRubberTimings}
                    style={{
                      background: '#ff9000',
                      color: '#000',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '12px 24px',
                      fontWeight: 950,
                      fontSize: '0.88rem',
                      cursor: savingRubberTimings ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(255, 144, 0, 0.3)'
                    }}
                  >
                    <Save size={16} />
                    <span>{savingRubberTimings ? 'Збереження...' : 'Зберегти таймінги'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 3: CNC OPERATIONS (ТЕХНОЛОГІЧНІ ОПЕРАЦІЇ ЧПК)
              ══════════════════════════════════════════════════════════════════════ */}
          {isDetail && activeTab === 'cnc' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Combined Total Summary: Cutting + Tumbling + Reception + Sorting (Цех №1) */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(255, 144, 0, 0.09) 0%, rgba(139, 92, 246, 0.06) 50%, rgba(16, 185, 129, 0.06) 100%)',
                borderRadius: '16px',
                padding: '18px 22px',
                border: '1.5px solid rgba(255, 144, 0, 0.4)',
                boxShadow: '0 6px 20px rgba(255, 144, 0, 0.09)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.4rem' }}>⏱️</span>
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text, #0f172a)', letterSpacing: '0.01em' }}>
                        РАЗОМ ЦЕХ №1: РОЗКРІЙ + ГАЛТОВКА + ПРИЙОМКА + СОРТУВАННЯ
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748b)' }}>
                        Повний плановий цикл обробки деталі в Цеху №1 (до передачі напівфабрикату на Цех №2)
                      </div>
                    </div>
                  </div>
                  <span style={{
                    fontSize: '0.76rem',
                    fontWeight: 900,
                    padding: '4px 12px',
                    borderRadius: '20px',
                    background: 'rgba(255, 144, 0, 0.16)',
                    color: '#d97706',
                    border: '1px solid rgba(255, 144, 0, 0.35)'
                  }}>
                    Цех №1 • Повний технологічний цикл
                  </span>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))',
                  gap: '8px'
                }}>
                  {[1, 2, 3, 4, 8, 12, 16].map(sheets => {
                    const cM = cncTotals[sheets]?.sum || 0
                    const tM = tumblingTotals[sheets]?.sum || 0
                    const rM = receptionTotals[sheets]?.sum || 0
                    const sM = sortingTotals[sheets]?.sum || 0
                    const totalM = cM + tM + rM + sM
                    const hasAny = totalM > 0

                    return (
                      <div
                        key={sheets}
                        style={{
                          background: hasAny ? 'var(--card-bg, #ffffff)' : 'rgba(0, 0, 0, 0.02)',
                          borderRadius: '10px',
                          padding: '10px',
                          border: hasAny ? '1.5px solid #f59e0b' : '1px dashed var(--border-color, #cbd5e1)',
                          textAlign: 'center',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                          boxShadow: hasAny ? '0 2px 6px rgba(0,0,0,0.03)' : 'none'
                        }}
                      >
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#b45309' }}>
                          {sheets} л.
                        </div>
                        <div style={{ fontSize: '0.96rem', fontWeight: 900, color: hasAny ? 'var(--text, #0f172a)' : 'var(--text-muted, #94a3b8)' }}>
                          {hasAny ? `${totalM} хв` : '—'}
                        </div>
                        {hasAny && (
                          <>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0284c7' }}>
                              ≈ {formatMinutesToHours(totalM)}
                            </div>
                            <div style={{
                              fontSize: '0.64rem',
                              color: 'var(--text-muted, #64748b)',
                              marginTop: '3px',
                              borderTop: '1px solid rgba(0,0,0,0.06)',
                              paddingTop: '3px',
                              lineHeight: '1.2'
                            }}>
                              ✂️{cM} 🌀{tM}<br />🔍{rM} 📦{sM}
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* TOP SECTION: Planned Operation Timings with Machine Switcher */}
              {cncOperations && cncOperations.length > 0 && (() => {
                const activeMachineOp = cncOperations[selectedMachineIdx] || cncOperations[0]
                const mType = activeMachineOp?.machine_type || 'Стандартний ЧПК'
                const side1Ops = (activeMachineOp?.side1_ops || []).filter(s => typeof s === 'string' && !s.startsWith('__CUTTER__'))
                const side2Ops = (activeMachineOp?.side2_ops || []).filter(s => typeof s === 'string' && !s.startsWith('__CUTTER__'))
                const cutOps = (activeMachineOp?.side2_cut_ops || []).filter(s => typeof s === 'string' && !s.startsWith('__CUTTER__'))
                const allOps = [
                  ...side1Ops.map(name => ({ name, side: 'side1' })),
                  ...side2Ops.map(name => ({ name, side: 'side2' })),
                  ...cutOps.map(name => ({ name, side: 'side2_cut' }))
                ]
                const initialM = operationTimingsByMachine[mType] || item.rule_params?.operation_timings?.[mType] || {}

                return (
                  <div style={{
                    background: 'var(--card-bg, #ffffff)',
                    borderRadius: '16px',
                    padding: '20px 24px',
                    border: '1.5px solid rgba(245, 158, 11, 0.35)',
                    boxShadow: '0 4px 18px rgba(245, 158, 11, 0.08)'
                  }}>
                    {/* Machine Switcher Tabs if multiple setups exist */}
                    {cncOperations.length > 1 && (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted, #64748b)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>🖥️</span>
                          <span>Оберіть верстат для перегляду та налаштування таймінгів:</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {cncOperations.map((op, idx) => {
                            const isSelected = (selectedMachineIdx || 0) === idx
                            return (
                              <button
                                key={op.id || idx}
                                type="button"
                                onClick={() => setSelectedMachineIdx(idx)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '8px 16px',
                                  borderRadius: '10px',
                                  border: isSelected ? '2px solid #f59e0b' : '1px solid var(--border-color, #e2e8f0)',
                                  background: isSelected ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg, #f8fafc)',
                                  color: isSelected ? '#d97706' : 'var(--text, #0f172a)',
                                  fontWeight: isSelected ? 900 : 700,
                                  fontSize: '0.84rem',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s'
                                }}
                              >
                                <span>{isSelected ? '🎯' : '🖥️'}</span>
                                <span>{op.machine_type || `Верстат #${idx + 1}`}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Timings Table for Active Machine */}
                    {allOps.length > 0 ? (
                      <CncOperationTimingsTable
                        nomenclatureId={item.id}
                        machineType={mType}
                        operations={allOps}
                        initialTimings={initialM}
                        onSave={handleSaveOperationTimings}
                        onTotalsChange={setCncTotals}
                        isLight={typeof document !== 'undefined' && document.body.classList.contains('light-theme')}
                      />
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', padding: '12px', textAlign: 'center' }}>
                        Для верстата «{mType}» ще не зафіксовано операцій
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Tumbling Planned Timings Table */}
              <TumblingOperationTimingsTable
                nomenclatureId={item.id}
                initialTimings={tumblingTimings || item?.rule_params?.tumbling_operation_timings || {}}
                onSave={handleSaveTumblingTimings}
                onTotalsChange={setTumblingTotals}
                isLight={typeof document !== 'undefined' && document.body.classList.contains('light-theme')}
              />

              {/* Reception Planned Timings Table */}
              <ReceptionOperationTimingsTable
                nomenclatureId={item.id}
                initialTimings={receptionTimings || item?.rule_params?.reception_operation_timings || {}}
                onSave={handleSaveReceptionTimings}
                onTotalsChange={setReceptionTotals}
                isLight={typeof document !== 'undefined' && document.body.classList.contains('light-theme')}
              />

              {/* Sorting Planned Timings Table */}
              <SortingOperationTimingsTable
                nomenclatureId={item.id}
                initialTimings={sortingTimings || item?.rule_params?.sorting_operation_timings || {}}
                onSave={handleSaveSortingTimings}
                onTotalsChange={setSortingTotals}
                isLight={typeof document !== 'undefined' && document.body.classList.contains('light-theme')}
              />

              {/* Multi-Machine Cutters Summary Matrix */}
              {cncOperations && cncOperations.length > 0 && (
                <div style={{
                  background: 'var(--card-bg, #ffffff)',
                  borderRadius: '16px',
                  padding: '18px 22px',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.3rem' }}>⚙️</span>
                      <div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text, #0f172a)' }}>
                          Витрати інструменту (фрез) за типами верстатів
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748b)' }}>
                          Норми списання фрез розраховано індивідуально під кожен тип верстата (налаштування)
                        </div>
                      </div>
                    </div>
                    <span style={{
                      background: 'rgba(255, 144, 0, 0.1)',
                      color: '#d97706',
                      border: '1px solid rgba(255, 144, 0, 0.25)',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '0.74rem',
                      fontWeight: 800
                    }}>
                      Верстатів у специфікації: {cncOperations.length}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                    {cncOperations.map((op, idx) => {
                      const rawCutters = [...(op.side1_ops || []), ...(op.side2_ops || []), ...(op.side2_cut_ops || [])].filter(s => typeof s === 'string' && s.startsWith('__CUTTER__'))
                      const cutters = rawCutters.map(s => {
                        const parts = s.split(':')
                        return resolveCutterInfo(parts[1], parseFloat(parts[2]) || 1)
                      })

                      return (
                        <div 
                          key={op.id || idx}
                          style={{
                            background: 'var(--bg, #f8fafc)',
                            border: '1px solid var(--border-color, #e2e8f0)',
                            borderRadius: '12px',
                            padding: '12px 16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color, #e2e8f0)', paddingBottom: '6px' }}>
                            <div style={{ fontWeight: 900, fontSize: '0.84rem', color: '#b45309', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>🖥️</span>
                              <span>{op.machine_type || `Верстат #${idx + 1}`}</span>
                            </div>
                            <span style={{ fontSize: '0.68rem', background: '#fff', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color, #e2e8f0)', fontWeight: 700 }}>
                              {cutters.length > 0 ? `${cutters.length} фрез` : 'Без фрез'}
                            </span>
                          </div>

                          {cutters.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {cutters.map((c, ci) => (
                                <div key={ci} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                                  <div style={{ fontWeight: 800, color: 'var(--text, #0f172a)' }}>
                                    <span style={{ color: '#d97706', marginRight: '6px' }}>•</span>
                                    {c.name}
                                  </div>
                                  <div style={{ fontWeight: 900, color: '#d97706', background: 'rgba(255, 144, 0, 0.12)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.78rem' }}>
                                    {c.qty} шт
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>
                              Витрати фрез не зафіксовано
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {cncOperations && cncOperations.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {cncOperations.map((op, idx) => {
                    const side1List = (op.side1_ops || []).filter(s => typeof s === 'string' && !s.startsWith('__CUTTER__'))
                    const side2List = (op.side2_ops || []).filter(s => typeof s === 'string' && !s.startsWith('__CUTTER__'))
                    const realCutOps = (op.side2_cut_ops || []).filter(s => typeof s === 'string' && !s.startsWith('__CUTTER__'))
                    const rawCutters = [...(op.side1_ops || []), ...(op.side2_ops || []), ...(op.side2_cut_ops || [])].filter(s => typeof s === 'string' && s.startsWith('__CUTTER__'))
                    
                    const cutterItems = rawCutters.map(s => {
                      const parts = s.split(':')
                      return resolveCutterInfo(parts[1], parseFloat(parts[2]) || 1)
                    })

                    return (
                      <div 
                        key={op.id || idx}
                        style={{
                          background: 'var(--card-bg, #ffffff)',
                          borderRadius: '16px',
                          padding: '20px 24px',
                          border: '1px solid var(--border-color, #e2e8f0)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '14px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '1.2rem' }}>🖥️</span>
                            <div>
                              <div style={{ fontWeight: 900, fontSize: '0.95rem', color: '#d97706' }}>
                                Налаштування #{idx + 1}: {op.machine_type || 'Стандартний ЧПК'}
                              </div>
                              {op.machine_id && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)' }}>
                                  Верстат ID: {op.machine_id}
                                </div>
                              )}
                            </div>
                          </div>
                          <span style={{
                            fontSize: '0.75rem',
                            background: 'rgba(255, 144, 0, 0.1)',
                            color: '#d97706',
                            border: '1px solid rgba(255, 144, 0, 0.25)',
                            padding: '3px 10px',
                            borderRadius: '8px',
                            fontWeight: 800
                          }}>
                            Тип станка: {op.machine_type || 'Не вказано'}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                          {/* Side 1 */}
                          <div style={{ background: 'var(--bg, #f8fafc)', borderRadius: '12px', padding: '14px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#0284c7', marginBottom: '8px' }}>
                              🔵 Сторона 1 (Side 1)
                            </div>
                            {side1List.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {side1List.map((s, i) => (
                                  <span key={i} style={{ background: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>
                                    {s}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.78rem' }}>Немає операцій для сторони 1</span>
                            )}
                          </div>

                          {/* Side 2 */}
                          <div style={{ background: 'var(--bg, #f8fafc)', borderRadius: '12px', padding: '14px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#059669', marginBottom: '8px' }}>
                              🟢 Сторона 2 (Side 2)
                            </div>
                            {side2List.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {side2List.map((s, i) => (
                                  <span key={i} style={{ background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>
                                    {s}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.78rem' }}>Немає операцій для сторони 2</span>
                            )}
                          </div>

                          {/* Cut Ops (Only real cut operations without __CUTTER__ strings) */}
                          {realCutOps.length > 0 && (
                            <div style={{ background: 'var(--bg, #f8fafc)', borderRadius: '12px', padding: '14px', border: '1px solid var(--border-color, #e2e8f0)', gridColumn: '1 / -1' }}>
                              <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#d97706', marginBottom: '8px' }}>
                                ✂️ Вирізка
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {realCutOps.map((s, i) => (
                                  <span key={i} style={{ background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>
                                    {s}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Dedicated Cutters Consumption Section with Machine Type */}
                          {cutterItems.length > 0 && (
                            <div style={{
                              background: 'linear-gradient(135deg, rgba(255, 144, 0, 0.08) 0%, rgba(245, 158, 11, 0.04) 100%)',
                              borderRadius: '14px',
                              padding: '16px',
                              border: '1px solid rgba(255, 144, 0, 0.3)',
                              gridColumn: '1 / -1'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#b45309', display: 'flex', alignItems: 'center', gap: '7px' }}>
                                  <span>🛠️</span>
                                  <span>Встановлені витрати фрез для верстата «{op.machine_type || `Налаштування #${idx + 1}`}»:</span>
                                </div>
                                <span style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  background: '#fff',
                                  color: '#b45309',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(255, 144, 0, 0.2)'
                                }}>
                                  ⚙️ {op.machine_type || 'ЧПК'}
                                </span>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                                {cutterItems.map((c, i) => (
                                  <div 
                                    key={i}
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      background: 'var(--card-bg, #ffffff)',
                                      padding: '12px 16px',
                                      borderRadius: '10px',
                                      border: '1px solid var(--border-color, #e2e8f0)',
                                      boxShadow: '0 2px 5px rgba(0,0,0,0.03)'
                                    }}
                                  >
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                      <div style={{ fontSize: '0.88rem', fontWeight: 900, color: 'var(--text, #0f172a)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ color: '#d97706' }}>🔹</span>
                                        <span>{c.name}</span>
                                      </div>
                                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', marginTop: '2px', display: 'flex', gap: '8px' }}>
                                        <span>Верстат: <b>{op.machine_type || 'ЧПК'}</b></span>
                                        {c.code && <span style={{ fontFamily: 'monospace' }}>[{c.code}]</span>}
                                      </div>
                                    </div>
                                    <div style={{
                                      background: 'rgba(255, 144, 0, 0.15)',
                                      color: '#d97706',
                                      padding: '5px 12px',
                                      borderRadius: '8px',
                                      fontSize: '0.85rem',
                                      fontWeight: 900,
                                      whiteSpace: 'nowrap',
                                      marginLeft: '12px',
                                      textAlign: 'right'
                                    }}>
                                      <div>{c.qty} шт</div>
                                      <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted, #64748b)' }}>на партію</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{
                  background: 'var(--card-bg, #ffffff)',
                  borderRadius: '16px',
                  padding: '40px',
                  textAlign: 'center',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  color: 'var(--text-muted, #64748b)'
                }}>
                  <Cpu size={40} style={{ opacity: 0.3, marginBottom: '10px' }} />
                  <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>
                    Для цієї номенклатури ще не налаштовано технологічні операції ЧПК
                  </div>
                  <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>
                    Операції (Сторона 1, Сторона 2, фрези) можна налаштувати у модулі «Інженер» або «Специфікації».
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 3B: SHOP 2 OPERATIONS & TIMINGS (ЦЕХ №2)
              ══════════════════════════════════════════════════════════════════════ */}
          {isDetail && activeTab === 'shop2' && (
            <Shop2OperationTimingsPanel
              item={item}
              onSave={handleSaveShop2Timings}
            />
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 4: INVENTORY BALANCES (СГП / ЦЕХ 1 / ЦЕХ 2)
              ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'inventory' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Balances KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div style={{
                  background: 'var(--card-bg, #ffffff)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: '16px',
                  padding: '18px 22px'
                }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800, textTransform: 'uppercase' }}>
                    Загальний залишок (Всього)
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text, #0f172a)', marginTop: '4px' }}>
                    {totalStockQty} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted, #64748b)' }}>{item.unit || 'шт'}</span>
                  </div>
                </div>

                <div style={{
                  background: 'var(--card-bg, #ffffff)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: '16px',
                  padding: '18px 22px'
                }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800, textTransform: 'uppercase' }}>
                    Зарезервовано під замовлення
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#ea580c', marginTop: '4px' }}>
                    {totalReservedQty} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted, #64748b)' }}>{item.unit || 'шт'}</span>
                  </div>
                </div>

                <div style={{
                  background: 'var(--card-bg, #ffffff)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: '16px',
                  padding: '18px 22px'
                }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 800, textTransform: 'uppercase' }}>
                    Доступно (вільний залишок)
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: freeAvailableQty >= 0 ? '#059669' : '#dc2626', marginTop: '4px' }}>
                    {freeAvailableQty} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted, #64748b)' }}>{item.unit || 'шт'}</span>
                  </div>
                </div>
              </div>

              {/* Table of storage locations and balances */}
              <div style={{
                background: 'var(--card-bg, #ffffff)',
                border: '1px solid var(--border-color, #e2e8f0)',
                borderRadius: '16px',
                overflow: 'hidden'
              }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color, #e2e8f0)', background: 'var(--card-header-bg, #f8fafc)', fontWeight: 900, fontSize: '0.85rem' }}>
                  Розподіл залишків по складах та цехах
                </div>
                
                {inventoryBalances.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)', color: 'var(--text-muted, #64748b)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                        <th style={{ padding: '12px 20px' }}>Склад / Локація</th>
                        <th style={{ padding: '12px 20px' }}>Тип обліку</th>
                        <th style={{ padding: '12px 20px', textAlign: 'right' }}>Загальна к-сть</th>
                        <th style={{ padding: '12px 20px', textAlign: 'right' }}>Резерв</th>
                        <th style={{ padding: '12px 20px', textAlign: 'right' }}>Вільно</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryBalances.map(row => (
                        <tr key={row.id} style={{ borderBottom: '1px solid var(--border-color, #f1f5f9)' }}>
                          <td style={{ padding: '12px 20px', fontWeight: 800 }}>
                            {row.warehouse === 'operational' ? '📦 Склад оперативний (СО)' :
                             row.warehouse === 'production' ? '🏭 Склад виробництва (СВ)' :
                             row.warehouse === 'sgp' ? '🏬 СГП (Готова продукція)' : 
                             row.warehouse === 'shop1' ? '⚙️ Цех 1 (Фрезерування)' : 
                             row.warehouse === 'shop2' ? '🔧 Цех 2 (Складання)' : 
                             row.warehouse === 'pocket' ? '👝 Кишеня станка / цех' : 
                             row.warehouse === 'scrap' ? '♻️ Склад брухту' : 
                             (row.warehouse ? `📦 ${row.warehouse}` : 'Склад')}
                            {row.location ? ` / ${row.location}` : ''}
                          </td>
                          <td style={{ padding: '12px 20px', color: 'var(--text-muted, #64748b)' }}>
                            {row.type === 'raw' ? 'Сировина / Витратні' :
                             row.type === 'semi' ? 'Напівфабрикат' :
                             row.type === 'part' ? 'Деталь' :
                             row.type === 'finished' ? 'Готова продукція' :
                             (row.type || '—')}
                          </td>
                          <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 800 }}>
                            {row.total_qty || 0}
                          </td>
                          <td style={{ padding: '12px 20px', textAlign: 'right', color: '#ea580c', fontWeight: 800 }}>
                            {row.reserved_qty || 0}
                          </td>
                          <td style={{ padding: '12px 20px', textAlign: 'right', color: '#059669', fontWeight: 900 }}>
                            {(Number(row.total_qty) || 0) - (Number(row.reserved_qty) || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
                    {loadingInventory ? 'Завантаження залишків...' : 'Не знайдено складських записів для цієї позиції (залишок 0).'}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 5: BOM SPECIFICATION & WHERE-USED (Специфікація та Входження)
              ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'bom' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Package size={20} color="#ff9000" />
                  Специфікації BOM та зв'язки деталей:
                </h3>
                {loadingBom && (
                  <span style={{ fontSize: '0.8rem', color: '#ff9000', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <RefreshCw size={14} className="animate-spin" /> Завантаження...
                  </span>
                )}
              </div>

              {/* 1. WHERE-USED: До яких специфікацій належить ця деталь */}
              {whereUsedItems.length > 0 && (
                <div style={{
                  background: 'var(--card-bg, #ffffff)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: '16px',
                  padding: '20px 24px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.3rem' }}>{whereUsedItems.length === 1 ? '🎯' : '🗂️'}</span>
                      <div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text, #0f172a)' }}>
                          {whereUsedItems.length === 1 
                            ? 'Деталь належить до 1 специфікації:' 
                            : `Деталь використовується у кількох специфікаціях (${whereUsedItems.length}):`}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748b)' }}>
                          Вироби, рами або складальні одиниці, до складу яких входить ця деталь
                        </div>
                      </div>
                    </div>
                    <span style={{
                      background: whereUsedItems.length === 1 ? '#dcfce7' : 'rgba(255, 144, 0, 0.12)',
                      color: whereUsedItems.length === 1 ? '#15803d' : '#d97706',
                      padding: '4px 12px',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 900
                    }}>
                      {whereUsedItems.length === 1 ? '1 специфікація' : `${whereUsedItems.length} специфікацій`}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
                    {whereUsedItems.map((bom, idx) => {
                      const parentNom = itemsMap.get(bom.parent_id) || parentProductsMap[bom.parent_id]
                      const parentGroup = parentNom ? groups.find(g => g.id === parentNom.group_id) : null
                      return (
                        <div
                          key={bom.id || idx}
                          style={{
                            background: 'var(--bg, #f8fafc)',
                            border: '1px solid var(--border-color, #e2e8f0)',
                            borderRadius: '12px',
                            padding: '14px 18px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '12px'
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <span style={{ fontSize: '1.1rem' }}>📦</span>
                              <div style={{ fontWeight: 900, fontSize: '0.9rem', color: 'var(--text, #0f172a)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {parentNom ? parentNom.name : `Виріб [ID: ${bom.parent_id?.substring(0, 8)}...]`}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '0.72rem' }}>
                              {parentNom?.code && (
                                <span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--text-muted, #64748b)', background: 'var(--text-strong)', padding: '1px 6px', borderRadius: '4px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                                  {parentNom.code}
                                </span>
                              )}
                              {parentGroup && (
                                <span style={{ color: '#0284c7', background: '#e0f2fe', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                  {parentGroup.name}
                                </span>
                              )}
                            </div>
                          </div>

                          <div style={{
                            background: 'rgba(255, 144, 0, 0.12)',
                            color: '#d97706',
                            border: '1px solid rgba(255, 144, 0, 0.25)',
                            padding: '6px 12px',
                            borderRadius: '10px',
                            textAlign: 'right',
                            whiteSpace: 'nowrap',
                            marginLeft: '10px'
                          }}>
                            <div style={{ fontSize: '1.05rem', fontWeight: 900 }}>
                              {bom.quantity_per_parent} {item.unit || 'шт'}
                            </div>
                            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted, #64748b)' }}>
                              на 1 виріб
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 2. COMPONENTS BOM: Вхідні деталі виробу (якщо сам виріб складається з компонентів) */}
              {bomItems.length > 0 && (
                <div style={{
                  background: 'var(--card-bg, #ffffff)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: '16px',
                  padding: '20px 24px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text, #0f172a)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Package size={18} color="#ff9000" />
                      Специфікація виробу (вхідні матеріали та компоненти):
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748b)' }}>
                      Матеріали та деталі, що витрачаються на виготовлення цієї позиції
                    </div>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)', background: 'var(--card-header-bg, #f8fafc)', color: 'var(--text-muted, #64748b)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                        <th style={{ padding: '12px 20px' }}>Код / Назва компонента</th>
                        <th style={{ padding: '12px 20px', textAlign: 'right' }}>Кількість на 1 од.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bomItems.map(bom => {
                        const childNom = itemsMap.get(bom.child_id) || parentProductsMap[bom.child_id]
                        return (
                          <tr key={bom.id} style={{ borderBottom: '1px solid var(--border-color, #f1f5f9)' }}>
                            <td style={{ padding: '12px 20px', fontWeight: 800 }}>
                              <div>{childNom ? childNom.name : (bom.child_id || 'Компонент')}</div>
                              {childNom?.code && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontFamily: 'monospace' }}>
                                  {childNom.code}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 900, color: '#d97706' }}>
                              {bom.quantity_per_parent} {childNom?.unit || 'шт'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 3. EMPTY STATE: Немає ані специфікацій, ані вхідних компонентів */}
              {whereUsedItems.length === 0 && bomItems.length === 0 && !loadingBom && (
                <div style={{
                  background: 'var(--card-bg, #ffffff)',
                  borderRadius: '16px',
                  padding: '40px',
                  textAlign: 'center',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  color: 'var(--text-muted, #64748b)'
                }}>
                  <Package size={40} style={{ opacity: 0.3, marginBottom: '10px' }} />
                  <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>
                    Ця деталь поки що не прив'язана до жодної специфікації
                  </div>
                  <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>
                    Прив'язка деталей до виробів виконується у модулі «Інженер» або «Специфікації».
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div style={{
          padding: '16px 28px',
          borderTop: '1px solid var(--border-color, #e2e8f0)',
          background: 'var(--card-header-bg, #f8fafc)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>
            <span>ID номенклатури:</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{item.id}</span>
            <button
              onClick={() => copyToClipboard(item.id, 'id')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d97706', padding: '2px' }}
              title="Скопіювати ID"
            >
              {copiedKey === 'id' ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'var(--card-bg, #ffffff)',
              border: '1px solid var(--border-color, #cbd5e1)',
              borderRadius: '10px',
              padding: '8px 20px',
              fontSize: '0.85rem',
              fontWeight: 800,
              color: 'var(--text, #0f172a)',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            Закрити картку
          </button>
        </div>

      </div>

      {/* Floating Success Badge */}
      {saveSuccessMsg && (
        <div style={{
          position: 'fixed',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#059669',
          color: '#ffffff',
          padding: '8px 20px',
          borderRadius: '9999px',
          fontSize: '0.85rem',
          fontWeight: 800,
          boxShadow: '0 8px 20px rgba(5, 150, 105, 0.4)',
          zIndex: 10005,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <CheckCircle2 size={18} />
          <span>{saveSuccessMsg}</span>
        </div>
      )}
    </div>

    {/* EDIT NOMENCLATURE MODAL OVERLAY */}
    {isEditOpen && (
      <div 
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10001,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}
        onClick={() => setIsEditOpen(false)}
      >
        <div 
          style={{
            background: 'var(--card-bg, #ffffff)',
            color: 'var(--text, #0f172a)',
            borderRadius: '20px',
            border: '1px solid var(--border-color, #e2e8f0)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            width: '100%',
            maxWidth: '560px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.72rem', color: '#d97706', fontWeight: 900, fontFamily: 'monospace', background: 'rgba(217, 119, 6, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                  {item.code || item.id?.substring(0, 8)}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 700 }}>
                  ID: {item.id}
                </span>
              </div>
              <h3 style={{ margin: '6px 0 0 0', fontWeight: 900, fontSize: '1.2rem', color: 'var(--text, #0f172a)' }}>
                Редагувати номенклатуру
              </h3>
            </div>
            <button 
              onClick={() => setIsEditOpen(false)} 
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted, #64748b)', cursor: 'pointer', padding: '6px' }}
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 900, display: 'block', marginBottom: '4px' }}>
                НАЗВА НОМЕНКЛАТУРИ *
              </label>
              <input
                type="text"
                required
                value={editForm.name}
                onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--input-bg, #ffffff)',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  color: 'var(--text-main, #0f172a)',
                  borderRadius: '8px',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 900, display: 'block', marginBottom: '4px' }}>
                  КАТЕГОРІЯ / ГРУПА КАТАЛОГУ
                </label>
                <select
                  value={editForm.group_id || ''}
                  onChange={e => setEditForm(prev => ({ ...prev, group_id: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--input-bg, #ffffff)',
                    border: '1px solid var(--border-color, #cbd5e1)',
                    color: 'var(--text-main, #0f172a)',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">-- Без групи (01. Загальна) --</option>
                  {flattenedGroups.map(g => (
                    <option key={g.id} value={g.id}>{g.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 900, display: 'block', marginBottom: '4px' }}>
                  ОДИНИЦЯ ВИМІРУ
                </label>
                <select
                  value={editForm.unit || 'шт'}
                  onChange={e => setEditForm(prev => ({ ...prev, unit: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--input-bg, #ffffff)',
                    border: '1px solid var(--border-color, #cbd5e1)',
                    color: 'var(--text-main, #0f172a)',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="шт">Штуки (шт)</option>
                  <option value="компл.">Комплекти (компл.)</option>
                  <option value="лист">Листи (лист)</option>
                  <option value="кг">Кілограми (кг)</option>
                  <option value="м">Метри (м)</option>
                  <option value="м²">Квадратні метри (м²)</option>
                  <option value="л">Літри (л)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 900, display: 'block', marginBottom: '4px' }}>
                  ОСНОВНИЙ МАТЕРІАЛ (ЛИСТ)
                </label>
                <select
                  value={editForm.default_material_id || ''}
                  onChange={e => setEditForm(prev => ({ ...prev, default_material_id: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--input-bg, #ffffff)',
                    border: '1px solid var(--border-color, #cbd5e1)',
                    color: 'var(--text-main, #0f172a)',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">-- Не вказано / без матеріалу --</option>
                  {rawMaterials.map(m => (
                    <option key={m.id} value={m.id}>{m.name || m.code}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 900, display: 'block', marginBottom: '4px' }}>
                  К-СТЬ ДЕТАЛЕЙ З ЛИСТА (ШТ)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="напр. 24"
                  value={editForm.unitsPerSheet}
                  onChange={e => setEditForm(prev => ({ ...prev, unitsPerSheet: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--input-bg, #ffffff)',
                    border: '1px solid var(--border-color, #cbd5e1)',
                    color: 'var(--text-main, #0f172a)',
                    borderRadius: '8px',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {(isDetail || groups.find(g => g.id === editForm.group_id)?.rule_type === 'frame_part') && (
              <div style={{
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1px solid rgba(249, 115, 22, 0.28)',
                background: 'rgba(249, 115, 22, 0.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <label style={{ fontSize: '0.72rem', color: '#ea580c', fontWeight: 900, display: 'block' }}>
                  ЦЕХ №2: ОПЕРАЦІЇ ПОСТОБРОБКИ ДЕТАЛІ
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  <label style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.84rem',
                    fontWeight: 800,
                    background: editForm.requiresPressing ? 'rgba(249, 115, 22, 0.14)' : 'var(--input-bg, #ffffff)',
                    border: editForm.requiresPressing ? '1.5px solid #f97316' : '1px solid var(--border-color, #cbd5e1)',
                    color: editForm.requiresPressing ? '#c2410c' : 'var(--text-main, #0f172a)'
                  }}>
                    <input
                      type="checkbox"
                      checked={Boolean(editForm.requiresPressing)}
                      onChange={e => setEditForm(prev => ({ ...prev, requiresPressing: e.target.checked }))}
                    />
                    <span>🔩 Пресування</span>
                  </label>
                  <label style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.84rem',
                    fontWeight: 800,
                    background: editForm.requiresPainting ? 'rgba(139, 92, 246, 0.14)' : 'var(--input-bg, #ffffff)',
                    border: editForm.requiresPainting ? '1.5px solid #8b5cf6' : '1px solid var(--border-color, #cbd5e1)',
                    color: editForm.requiresPainting ? '#6d28d9' : 'var(--text-main, #0f172a)'
                  }}>
                    <input
                      type="checkbox"
                      checked={Boolean(editForm.requiresPainting)}
                      onChange={e => setEditForm(prev => ({ ...prev, requiresPainting: e.target.checked }))}
                    />
                    <span>🎨 Фарбування</span>
                  </label>
                </div>
                <div style={{ fontSize: '0.73rem', color: 'var(--text-muted, #64748b)' }}>
                  Система враховуватиме ці ознаки в буфері Цеху №2 та малярці залежно від вибору фарбування в замовленні.
                </div>
              </div>
            )}

            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', fontWeight: 900, display: 'block', marginBottom: '4px' }}>
                ОПИС / ДОДАТКОВІ ПРИМІТКИ
              </label>
              <textarea
                rows={3}
                placeholder="Додаткова інформація про деталь або виріб..."
                value={editForm.description}
                onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--input-bg, #ffffff)',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  color: 'var(--text-main, #0f172a)',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  background: 'transparent',
                  color: 'var(--text-muted, #64748b)',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Скасувати
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                style={{
                  padding: '10px 22px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#ff9000',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '0.85rem',
                  cursor: savingEdit ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(255, 144, 0, 0.35)'
                }}
              >
                {savingEdit ? <RefreshCw size={15} className="anim-spin" /> : <Save size={15} />}
                <span>{savingEdit ? 'Збереження...' : 'Зберегти зміни'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
    </>
  )
}
