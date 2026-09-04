import React, { useState, useMemo, useRef, useEffect } from 'react'
import {
  Sparkles, 
  Settings, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  FileCode, 
  ShieldCheck,
  AlertCircle,
  BarChart3,
  Database,
  Upload,
  Plus,
  Trash2,
  BookOpen,
  Search,
  Save,
  X,
  ChevronRight,
  ChevronDown,
  Package,
  Layers,
  Edit2,
  Copy,
  FileUp,
  Loader2,
  Sliders
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { 
  DEFAULT_ERP_GROUPS, 
  ERP_CATEGORY_SCHEMAS, 
  generateStandardName, 
  buildFlattenedGroupOptions 
} from './NomenclatureV2'
import { apiService } from '../services/apiDispatcher'

const MACHINE_TYPES = [
  'CNC 1200x800 - 4 листи (Малий)',
  'CNC 3050(16)х16 - 3-12 листів (швидкісний)',
  'CNC 3060х1600 - 3-36 листів (Три Головий)',
  'CNC 6000x2000 - 4 - 96 листів (Дракон)',
  'CNC KE XIN - 4 - 16 листів (ФЕЯ)'
]

const renderCutterListEditorShared = (cutters, setCutters, nomenclatures) => {
  const cutterNoms = Array.from(new Map(nomenclatures
    .filter(n => {
      const name = String(n.name || '').toLowerCase()
      return n.type === 'cutter_type' || name.includes('фреза') || name.match(/^ф\s*[0-9]/) || name.match(/^f\s*[0-9]/)
    })
    .map(n => [String(n.id), n])
  ).values()).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'uk'))
  return (
    <div style={{ flex: 1, minWidth: '280px', background: '#111', padding: '15px', borderRadius: '12px', border: '1px solid #222' }}>
      <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span>⚙️ Витрата фрез на лист</span>
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {cutters.map((c, idx) => (
          <div key={idx} style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
            <select 
              value={c.nomId} 
              onChange={e => {
                const copy = [...cutters]
                copy[idx].nomId = e.target.value
                setCutters(copy)
              }}
              style={{ flex: 2, padding: '8px', background: '#000', border: '1px solid #333', color: '#fff', borderRadius: '6px', fontSize: '0.8rem' }}
            >
              <option value="">-- Оберіть фрезу --</option>
              {cutterNoms.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
            <input 
              type="number"
              min="0.001"
              step="any"
              placeholder="к-сть"
              value={c.qty !== undefined && c.qty !== null ? c.qty : ''}
              onChange={e => {
                const copy = [...cutters]
                copy[idx].qty = e.target.value
                setCutters(copy)
              }}
              style={{ width: '70px', padding: '8px', background: '#000', border: '1px solid #333', color: '#f59e0b', borderRadius: '6px', fontSize: '0.8rem', textAlign: 'center', fontWeight: 800 }}
            />
            <button 
              onClick={() => setCutters(cutters.filter((_, i) => i !== idx))}
              style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0 10px', cursor: 'pointer' }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button 
          onClick={() => setCutters([...cutters, { nomId: '', qty: 1 }])}
          style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px dashed #333', color: '#10b981', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, marginTop: '4px' }}
        >
          + Додати фрезу до витрат
        </button>
      </div>
    </div>
  )
}

const combineOps = (f2Arr, f15Arr) => {
  const maxLen = Math.max(f2Arr.length, f15Arr.length)
  const combined = []
  for (let i = 0; i < maxLen; i++) {
    const valF2 = (f2Arr[i] || "").trim()
    const valF15 = (f15Arr[i] || "").trim()
    if (valF15) {
      combined.push(`${valF2} | ${valF15}`)
    } else if (valF2) {
      combined.push(valF2)
    }
  }
  return combined.filter(Boolean)
}

const useV2NomenclaturesData = (supabase) => {
    const [v2Noms, setV2Noms] = useState([])
    const fetchV2 = async () => {
      try {
        const { data } = await supabase.from('nomenclatures_v2').select('*').order('name')
        if (data) {
          const mapped = data.map(v => ({
            ...v,
            id: v.id,
            name: v.name,
            code: v.code || '',
            type: (v.group_id === 'grp_production_frames' || v.group_id === 'grp_test_samples' || v.group_id === 'cat_fg' || v.rule_type === 'full_frame' || (v.name || '').toLowerCase().includes('рама'))
              ? 'product'
              : (v.rule_type === 'frame_part' ? 'part' : 'consumable'),
            unit: v.unit || 'шт',
            category: v.category || 'Загальна'
          }))
          setV2Noms(mapped)
        }
      } catch (e) {
        console.error('Error loading V2 items:', e)
      }
    }
    useEffect(() => {
      fetchV2()
    }, [])
    return v2Noms
  }

const MachineOperationsTab = () => {
  const { nomenclatures: rawNoms, machines, machineOperations, supabase, bomItems, refreshTable } = useMES()
  const nomenclatures = useV2NomenclaturesData(supabase)
  const [selectedNom, setSelectedNom] = useState('')
  const [selectedMachine, setSelectedMachine] = useState('')
  const [side1Ops, setSide1Ops] = useState([])
  const [side2OpsF2, setSide2OpsF2] = useState([])
  const [side2OpsF15, setSide2OpsF15] = useState([])
  const [side2CutOpsF2, setSide2CutOpsF2] = useState([])
  const [side2CutOpsF15, setSide2CutOpsF15] = useState([])
  const [cuttersList, setCuttersList] = useState([])
  const [uploading, setUploading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  React.useEffect(() => {
    if (selectedNom && selectedMachine) {
      const existing = machineOperations?.find(o => 
        o.nomenclature_id === selectedNom && 
        (o.machine_type === selectedMachine || o.machine_id === selectedMachine)
      )
      if (existing) {
        setSide1Ops((existing.side1_ops || []).filter(op => !op.startsWith('__CUTTER__:')))
        const s2 = (existing.side2_ops || []).filter(op => !op.startsWith('__CUTTER__:'))
        setSide2OpsF2(s2.map(op => op.includes('|') ? op.split('|')[0].trim() : op))
        setSide2OpsF15(s2.map(op => op.includes('|') ? op.split('|')[1].trim() : ''))
        const s2c = (existing.side2_cut_ops || []).filter(op => !op.startsWith('__CUTTER__:') && !op.startsWith('__CUTTER__Reference:'))
        setSide2CutOpsF2(s2c.map(op => op.includes('|') ? op.split('|')[0].trim() : op))
        setSide2CutOpsF15(s2c.map(op => op.includes('|') ? op.split('|')[1].trim() : ''))
        
        const cutterOps = (existing.side2_cut_ops || []).filter(op => op.startsWith('__CUTTER__:'))
        const parsed = cutterOps.map(c => {
          const parts = c.split(':')
          return { nomId: parts[1], qty: parseFloat(parts[2]) || 0 }
        })
        setCuttersList(parsed)
      } else {
        setSide1Ops([])
        setSide2OpsF2([])
        setSide2OpsF15([])
        setSide2CutOpsF2([])
        setSide2CutOpsF15([])
        setCuttersList([])
      }
    }
  }, [selectedNom, selectedMachine, machineOperations])

  const handleSave = async () => {
    if (!selectedNom || !selectedMachine) return alert('Оберіть номенклатуру та тип верстата')
    const isType = MACHINE_TYPES.includes(selectedMachine)
    
    const existing = machineOperations?.find(o => 
      o.nomenclature_id === selectedNom && 
      (o.machine_type === selectedMachine || o.machine_id === selectedMachine)
    )
    
    const cutterStrings = cuttersList
      .filter(c => c.nomId && c.qty > 0)
      .map(c => `__CUTTER__:${c.nomId}:${c.qty}`)

    const payload = {
      nomenclature_id: selectedNom,
      machine_id: isType ? null : selectedMachine,
      machine_type: isType ? selectedMachine : null,
      side1_ops: side1Ops.filter(Boolean),
      side2_ops: combineOps(side2OpsF2, side2OpsF15),
      side2_cut_ops: [...combineOps(side2CutOpsF2, side2CutOpsF15), ...cutterStrings]
    }
    
    if (existing) {
      await supabase.from('machine_operations').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('machine_operations').insert(payload)
    }
    alert('Збережено!')
  }

  const resolveMachineType = (machineName) => {
    if (!machineName) return null
    const normMac = machineName.toLowerCase()
    if (normMac.includes('3050(16)x1600') || normMac.includes('3050(16)х1600') || normMac.includes('3050(16)') || normMac.includes('16x16') || normMac.includes('16х16') || normMac.includes('3050x1600') || normMac.includes('3050х1600') || normMac.includes('3050')) {
      return 'CNC 3050(16)х16 - 3-12 листів (швидкісний)'
    } else if (normMac.includes('дракон') || normMac.includes('60x20') || normMac.includes('6000x2000') || normMac.includes('6000х2000')) {
      return 'CNC 6000x2000 - 4 - 96 листів (Дракон)'
    } else if (normMac.includes('малий') || normMac.includes('12x8') || normMac.includes('1200x800') || normMac.includes('12х8') || normMac.includes('1200х800')) {
      return 'CNC 1200x800 - 4 листи (Малий)'
    } else if (normMac.includes('три головий') || normMac.includes('триголовий') || normMac.includes('3060') || normMac.includes('30x16') || normMac.includes('30х16')) {
      return 'CNC 3060х1600 - 3-36 листів (Три Головий)'
    } else if (normMac.includes('фея') || normMac.includes('ke xin')) {
      return 'CNC KE XIN - 4 - 16 листів (ФЕЯ)'
    }
    const exactType = MACHINE_TYPES.find(t => t.toLowerCase() === machineName.toLowerCase() || t.toLowerCase().includes(machineName.toLowerCase()))
    if (exactType) return exactType
    return null
  }

  const resolveCutterNomenclature = async (cutterSize, localNomsCopy) => {
    let cleanSize = cutterSize.trim()
    let nomName = cleanSize
    if (!nomName.toLowerCase().startsWith('фреза')) {
      nomName = `Фреза ${cleanSize}`
    }

    let nom = localNomsCopy.find(n => n.name.toLowerCase() === nomName.toLowerCase())
    if (!nom) {
      const newNomPayload = {
        name: nomName,
        type: 'consumable',
        consumption_per_sheet: 0.5
      }
      const { data, error } = await supabase
        .from('nomenclatures_v2')
        .insert(newNomPayload)
        .select()
        .single()
        
      if (error) {
        console.error(`Error creating cutter nomenclature ${nomName}:`, error)
        throw new Error(`Не вдалося створити номенклатуру фрези "${nomName}": ${error.message}`)
      }
      nom = data
      localNomsCopy.push(nom)
      await refreshTable('nomenclatures')
    }
    return nom
  }

  const parseConsolidatedCsv = async (text, localNomsCopy) => {
    const splitCsvIntoRows = (txt) => {
      const rows = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < txt.length; i++) {
        const char = txt[i]
        if (char === '"') {
          inQuotes = !inQuotes
          current += char
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
          if (current.trim()) {
            rows.push(current)
          }
          current = ''
          if (char === '\r' && txt[i + 1] === '\n') {
            i++
          }
        } else {
          current += char
        }
      }
      if (current.trim()) {
        rows.push(current)
      }
      return rows
    }

    const lines = splitCsvIntoRows(text).map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) return []

    const parseCsvLine = (line) => {
      const result = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      result.push(current.trim())
      return result.map(val => {
        let clean = val
        if (clean.startsWith('"') && clean.endsWith('"')) {
          clean = clean.slice(1, -1)
        }
        return clean.trim()
      })
    }

    const cleanNomenclatureLine = (line) => {
      let clean = line.trim()
      while (clean.endsWith(',')) {
        clean = clean.slice(0, -1).trim()
      }
      if (clean.startsWith('"') && clean.endsWith('"')) {
        clean = clean.slice(1, -1).trim()
      }
      return clean
    }

    const normalizeKey = (s) => {
      if (!s) return ''
      const mapper = {
        'а': 'a', 'в': 'b', 'с': 'c', 'е': 'e', 'н': 'h', 'h': 'h',
        'к': 'k', 'м': 'm', 'о': 'o', 'р': 'p', 'т': 't', 'х': 'x',
        'у': 'y', 'і': 'i', 'ї': 'i', 'и': 'y', 'п': 'p'
      }
      return s.toLowerCase()
        .trim()
        .split('')
        .map(c => mapper[c] || c)
        .join('')
        .replace(/[^a-z0-9]/g, '')
    }

    const findNomenclature = (cellText) => {
      if (!cellText) return null
      const lower = cellText.toLowerCase()
      if (lower.startsWith('операція') || lower.startsWith('operation') || lower.startsWith('уп') || lower.startsWith('up') || lower.startsWith('№') || lower.startsWith('фреза') || lower.includes('сторона')) {
        return null
      }

      const csvNomKey = normalizeKey(cellText)
      if (!csvNomKey) return null

      let nom = localNomsCopy.find(n => normalizeKey(n.name) === csvNomKey)
        || localNomsCopy.find(n => {
             const dbNomKey = normalizeKey(n.name)
             return csvNomKey.startsWith(dbNomKey)
           })

      if (!nom) {
        const getTokens = (s) => {
          if (!s) return []
          const mapper = {
            'а': 'a', 'в': 'b', 'с': 'c', 'е': 'e', 'н': 'h', 'h': 'h',
            'к': 'k', 'м': 'm', 'о': 'o', 'р': 'p', 'т': 't', 'х': 'x',
            'у': 'y', 'і': 'i', 'ї': 'i', 'и': 'y', 'п': 'p'
          }
          return s.toLowerCase()
            .split(/[\r\n\s_\-\(\),'"\`.\[\]\\/`]/)
            .filter(Boolean)
            .map(tok => tok.split('').map(c => mapper[c] || c).join(''))
        }

        const csvTokens = getTokens(cellText)
        if (csvTokens.length > 0) {
          let bestNom = null
          let bestScore = 0

          for (const n of localNomsCopy) {
            const dbTokens = getTokens(n.name)
            let common = 0
            const tempDb = [...dbTokens]
            for (const t of csvTokens) {
              const idx = tempDb.indexOf(t)
              if (idx !== -1) {
                common++
                tempDb.splice(idx, 1)
              }
            }
            if (common > bestScore) {
              bestScore = common
              bestNom = n
            }
          }

          if (bestNom) {
            const dbTokens = getTokens(bestNom.name)
            const ratio = bestScore / Math.max(csvTokens.length, dbTokens.length)
            if (ratio >= 0.75 || bestScore >= 5) {
              nom = bestNom
            }
          }
        }
      }
      return nom
    }

    const containsMachineHeaders = lines.some(l => {
      const firstCol = parseCsvLine(l)[0] || ''
      return firstCol.toLowerCase().startsWith('станок')
    })
    
    const rawBlocks = []
    if (!containsMachineHeaders) {
      if (lines.length < 4) {
        throw new Error('Файл занадто короткий. Очікується мінімум 4 рядки.')
      }
      const macName = cleanNomenclatureLine(lines[0])
      const nomName = cleanNomenclatureLine(lines[1])
      const matchedNom = findNomenclature(nomName)
      if (!matchedNom) {
        throw new Error(`Номенклатура "${nomName}" не знайдена в базі.`)
      }
      
      const rows = []
      for (let i = 2; i < lines.length; i++) {
        rows.push(parseCsvLine(lines[i]))
      }
      rawBlocks.push({
        machineName: macName,
        nomenclature: matchedNom,
        rows
      })
    } else {
      let currentMachineName = null
      let currentBlock = null

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const parts = parseCsvLine(line)
        const cell0 = parts[0] || ''

        if (cell0.toLowerCase().startsWith('станок')) {
          currentMachineName = cell0
          currentBlock = null
          continue
        }

        const matchedNom = findNomenclature(cell0)
        if (matchedNom) {
          currentBlock = {
            machineName: currentMachineName || 'Невідомий станок',
            nomenclature: matchedNom,
            rows: []
          }
          rawBlocks.push(currentBlock)
          continue
        }

        if (currentBlock && line.replace(/,/g, '').trim()) {
          currentBlock.rows.push(parts)
        }
      }
    }

    const processedBlocks = []
    for (const rb of rawBlocks) {
      const s1 = [], s2 = [], s2c = []
      const cuttersMap = {}

      // Find the header row in this block's rows to identify operation columns
      const headerRow = rb.rows.find(parts => 
        parts[0]?.toLowerCase().includes('операція') || 
        parts[1]?.toLowerCase().includes('операція')
      )

      let s1ColIdx = 0
      let s2ColIdx = 1
      let s2f15ColIdx = -1
      let s2cColIdx = 2
      let s2cf15ColIdx = -1

      if (headerRow) {
        headerRow.forEach((colText, idx) => {
          const txt = colText.toLowerCase().replace(/\s+/g, ' ');
          if (txt.includes('1 сторона')) {
            s1ColIdx = idx
          } else if (txt.includes('2 сторона') && !txt.includes('вирізка')) {
            if (txt.includes('1.5') || txt.includes('1,5')) {
              s2f15ColIdx = idx
            } else {
              s2ColIdx = idx
            }
          } else if (txt.includes('вирізка')) {
            if (txt.includes('1.5') || txt.includes('1,5')) {
              s2cf15ColIdx = idx
            } else {
              s2cColIdx = idx
            }
          }
        })
      }

      // Find cutter columns dynamically
      let cutterSizeIdx = 5
      let cutterQtyIdx = 6

      const cutterHeaderRow = rb.rows.find(parts => 
        parts.some(c => c.toLowerCase().includes('фреза') && (c.toLowerCase().includes('d') || c.toLowerCase().includes('тип')))
      ) || rb.rows.find(parts =>
        parts.some(c => c.toLowerCase().includes('фреза'))
      )

      if (cutterHeaderRow) {
        cutterHeaderRow.forEach((colText, idx) => {
          const txt = colText.toLowerCase();
          if (txt.includes('фреза')) {
            cutterSizeIdx = idx
          } else if (txt.includes('к-сть') || txt.includes('кількість') || txt.includes('кол-во') || txt.includes('qty') || txt.includes('шт')) {
            cutterQtyIdx = idx
          }
        })
      } else {
        const maxCols = Math.max(...rb.rows.map(r => r.length))
        if (maxCols <= 5) {
          cutterSizeIdx = 3
          cutterQtyIdx = 4
        }
      }

      for (const parts of rb.rows) {
        const isHeaderRow = parts.some(p => p?.toLowerCase().includes('операція') || p?.toLowerCase().includes('станок'))

        if (!isHeaderRow) {
          if (parts[s1ColIdx]?.trim()) {
            s1.push(parts[s1ColIdx].trim())
          }

          // Side 2
          const s2ValF2 = s2ColIdx !== -1 ? parts[s2ColIdx]?.trim() : ""
          const s2ValF15 = s2f15ColIdx !== -1 ? parts[s2f15ColIdx]?.trim() : ""
          if (s2ValF2 && s2ValF15 && s2ValF2 !== s2ValF15) {
            s2.push(`${s2ValF2} | ${s2ValF15}`)
          } else if (s2ValF2) {
            s2.push(s2ValF2)
          } else if (s2ValF15) {
            s2.push(s2ValF15)
          }

          // Side 2 Cutout
          const s2cValF2 = s2cColIdx !== -1 ? parts[s2cColIdx]?.trim() : ""
          const s2cValF15 = s2cf15ColIdx !== -1 ? parts[s2cf15ColIdx]?.trim() : ""
          if (s2cValF2 && s2cValF15 && s2cValF2 !== s2cValF15) {
            s2c.push(`${s2cValF2} | ${s2cValF15}`)
          } else if (s2cValF2) {
            s2c.push(s2cValF2)
          } else if (s2cValF15) {
            s2c.push(s2cValF15)
          }
        }

        const cutterSize = cutterSizeIdx !== -1 ? parts[cutterSizeIdx]?.trim() : ""
        const cutterQtyStr = cutterQtyIdx !== -1 ? parts[cutterQtyIdx]?.trim() : ""

        if (cutterSize && cutterQtyStr &&
            !cutterSize.toLowerCase().includes('фреза') &&
            !cutterQtyStr.toLowerCase().includes('к-сть') &&
            !cutterQtyStr.toLowerCase().includes('шт')) {
          const qtyVal = parseInt(cutterQtyStr, 10)
          if (!isNaN(qtyVal)) {
            cuttersMap[cutterSize] = qtyVal
          }
        }
      }

      processedBlocks.push({
        machineName: rb.machineName,
        nomenclature: rb.nomenclature,
        s1,
        s2,
        s2c,
        cuttersMap
      })
    }

    return processedBlocks
  }

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)

    let successCount = 0
    let failMessages = []
    const localNomsCopy = [...nomenclatures]

    for (const file of files) {
      try {
        const text = await file.text()
        const blocks = await parseConsolidatedCsv(text, localNomsCopy)
        
        if (blocks.length === 0) {
          throw new Error('У файлі не знайдено жодної операції.')
        }

        // Try to extract parent product name from filename (e.g. "Product - Part.csv")
        const fileNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name
        const hyphenIndex = fileNameWithoutExt.indexOf(' - ')
        let parentProductName = null
        if (hyphenIndex !== -1) {
          parentProductName = fileNameWithoutExt.substring(0, hyphenIndex).trim()
        } else {
          const parts = fileNameWithoutExt.split('-')
          if (parts.length > 1) {
            parentProductName = parts[0].trim()
          }
        }

        let matchedProduct = null
        if (parentProductName) {
          const cleanSearchName = parentProductName.toLowerCase().replace(/[^a-z0-9а-яіїєґ]/g, '')
          // Try exact match after cleaning
          matchedProduct = localNomsCopy.find(n => 
            n.type === 'product' && 
            n.name.toLowerCase().replace(/[^a-z0-9а-яіїєґ]/g, '') === cleanSearchName
          )

          // Substring match fallback
          if (!matchedProduct) {
            matchedProduct = localNomsCopy.find(n => 
              n.type === 'product' && 
              (n.name.toLowerCase().includes(parentProductName.toLowerCase()) || 
               parentProductName.toLowerCase().includes(n.name.toLowerCase()))
            )
          }

          // Token-based score match fallback
          if (!matchedProduct) {
            const getTokens = (s) => {
              if (!s) return []
              const mapper = {
                'а': 'a', 'в': 'b', 'с': 'c', 'е': 'e', 'н': 'h', 'h': 'h',
                'к': 'k', 'м': 'm', 'о': 'o', 'р': 'p', 'т': 't', 'х': 'x',
                'у': 'y', 'і': 'i', 'ї': 'i', 'и': 'y', 'п': 'p'
              }
              return s.toLowerCase()
                .split(/[\r\n\s_\-\(\),'"\`.\[\]\\/`]/)
                .filter(Boolean)
                .map(tok => tok.split('').map(c => mapper[c] || c).join(''))
            }
            const searchTokens = getTokens(parentProductName)
            if (searchTokens.length > 0) {
              let bestNom = null
              let bestScore = 0
              for (const n of localNomsCopy) {
                if (n.type !== 'product') continue
                const dbTokens = getTokens(n.name)
                let common = 0
                const tempDb = [...dbTokens]
                for (const t of searchTokens) {
                  const idx = tempDb.indexOf(t)
                  if (idx !== -1) {
                    common++
                    tempDb.splice(idx, 1)
                  }
                }
                if (common > bestScore) {
                  bestScore = common
                  bestNom = n
                }
              }
              if (bestNom && (bestScore / searchTokens.length >= 0.6 || bestScore >= 3)) {
                matchedProduct = bestNom
              }
            }
          }
        }

        for (const block of blocks) {
          let detectedType = resolveMachineType(block.machineName)
          let detectedMachineId = null

          if (!detectedType) {
            const mac = machines.find(m => m.name.toLowerCase() === block.machineName.toLowerCase() || m.name.toLowerCase().includes(block.machineName.toLowerCase()))
            if (mac) {
              detectedType = mac.type || mac.name
              if (!MACHINE_TYPES.includes(detectedType)) {
                detectedMachineId = mac.id
                detectedType = null
              }
            }
          }

          if (!detectedType && !detectedMachineId) {
            if (block.s1.length === 0 && block.s2.length === 0 && block.s2c.length === 0) {
              continue
            }
            throw new Error(`Тип або верстат "${block.machineName}" не знайдено в базі.`)
          }

          const finalCutters = []
          for (const [size, qty] of Object.entries(block.cuttersMap)) {
            const cutterNom = await resolveCutterNomenclature(size, localNomsCopy)
            finalCutters.push(`__CUTTER__:${cutterNom.id}:${qty}`)
          }

          const side2CutOpsWithCutters = [...block.s2c, ...finalCutters]

          const payload = {
            nomenclature_id: block.nomenclature.id,
            machine_id: detectedMachineId,
            machine_type: detectedType,
            side1_ops: block.s1,
            side2_ops: block.s2,
            side2_cut_ops: side2CutOpsWithCutters
          }

          const { data: dbOps } = await supabase
            .from('machine_operations')
            .select('id')
            .eq('nomenclature_id', block.nomenclature.id)
          
          let existingId = null
          if (dbOps && dbOps.length > 0) {
            const { data: fullOps } = await supabase.from('machine_operations').select('*').in('id', dbOps.map(d => d.id))
            const existing = fullOps?.find(o => 
              ((detectedType && o.machine_type === detectedType) || (detectedMachineId && o.machine_id === detectedMachineId))
            )
            if (existing) existingId = existing.id
          }

          if (existingId) {
            await supabase.from('machine_operations').update(payload).eq('id', existingId)
          } else {
            await supabase.from('machine_operations').insert(payload)
          }

          // Link the part to the product in bom_items if matchedProduct was identified
          if (matchedProduct) {
            const childId = block.nomenclature.id
            const parentId = matchedProduct.id
            const { data: existingBom } = await supabase
              .from('bom_items')
              .select('id')
              .eq('parent_id', parentId)
              .eq('child_id', childId)
            
            if (!existingBom || existingBom.length === 0) {
              const grpLabel = autoClassify(block.nomenclature)
              await supabase.from('bom_items').insert({
                parent_id: parentId,
                child_id: childId,
                quantity_per_parent: 1,
                group_label: grpLabel
              })
            }
          }
        }
        successCount++
      } catch (err) {
        failMessages.push(`${file.name}: ${err.message}`)
      }
    }
    
    // Refresh tables to update active UI cache
    await refreshTable('machine_operations')
    await refreshTable('bom_items')
    
    setUploading(false)
    e.target.value = ''
    
    if (failMessages.length > 0) {
      alert(`✅ Успішно завантажено: ${successCount}\n❌ Помилок: ${failMessages.length}\n\nДеталі:\n${failMessages.join('\n')}`)
    } else {
      alert(`✅ Успішно завантажено ${successCount} файлів!`)
    }
  }

  const handleSingleRowImport = async (e, op, nom) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    try {
      const text = await file.text()
      const nomName = nom?.name || ''
      const mac = machines.find(m => m.id === op.machine_id)
      const macText = op.machine_type || mac?.name || ''
      
      const localNomsCopy = [...nomenclatures]
      const blocks = await parseConsolidatedCsv(text, localNomsCopy)
      
      const matchedBlock = blocks.find(b => {
        if (String(b.nomenclature.id) !== String(nom.id)) return false
        const bType = resolveMachineType(b.machineName)
        const targetType = resolveMachineType(macText)
        return bType === targetType
      })

      if (!matchedBlock) {
        throw new Error(`У файлі не знайдено операцій для номенклатури "${nomName}" на верстаті "${macText}".`)
      }

      const finalCutters = []
      for (const [size, qty] of Object.entries(matchedBlock.cuttersMap)) {
        const cutterNom = await resolveCutterNomenclature(size, localNomsCopy)
        finalCutters.push(`__CUTTER__:${cutterNom.id}:${qty}`)
      }

      const side2CutOpsWithCutters = [...matchedBlock.s2c, ...finalCutters]

      const payload = {
        side1_ops: matchedBlock.s1,
        side2_ops: matchedBlock.s2,
        side2_cut_ops: side2CutOpsWithCutters
      }

      const { error } = await supabase.from('machine_operations').update(payload).eq('id', op.id)
      if (error) throw error

      alert(`✅ Успішно оновлено операції для "${nomName}"!`)
      
      if (selectedNom === op.nomenclature_id && selectedMachine === (op.machine_type || op.machine_id)) {
        setSide1Ops(matchedBlock.s1)
        setSide2Ops(matchedBlock.s2)
        setSide2CutOps(matchedBlock.s2c)
      }
    } catch (err) {
      alert(`❌ Помилка імпорту: ${err.message}`)
    } finally {
      e.target.value = ''
    }
  }

  const renderOpList = (ops, setOps, title) => (
    <div style={{ flex: 1, background: '#111', padding: '15px', borderRadius: '12px', border: '1px solid #222' }}>
      <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: 'var(--text-muted, #64748b)' }}>{title}</h4>
      {ops.map((op, idx) => (
        <div key={idx} style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
          <input 
            value={op} 
            onChange={(e) => {
              const newOps = [...ops]
              newOps[idx] = e.target.value
              setOps(newOps)
            }}
            style={{ flex: 1, padding: '8px', background: '#000', border: '1px solid #333', color: '#fff', borderRadius: '6px' }}
          />
          <button onClick={() => setOps(ops.filter((_, i) => i !== idx))} style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0 10px', cursor: 'pointer' }}><Trash2 size={14} /></button>
        </div>
      ))}
      <button onClick={() => setOps([...ops, ''])} style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px dashed #333', color: '#3b82f6', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px' }}>
        <Plus size={16} /> Додати операцію
      </button>
    </div>
  )

  const renderCutterListEditor = (cutters, setCutters) => renderCutterListEditorShared(cutters, setCutters, nomenclatures)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111', padding: '20px', borderRadius: '16px', border: '1px solid #222' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Масове завантаження CSV</h2>
          <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#666' }}>Формат: рядок 1 — назва станку, рядок 2 — назва номенклатури, рядок 3 — заголовки, далі — операції по рядках (3 колонки через кому)</p>
        </div>
        <div>
          <label style={{ background: '#3b82f6', color: '#fff', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center', fontWeight: 600 }}>
            <Upload size={18} /> {uploading ? 'Завантаження...' : 'Обрати CSV файли (можна декілька)'}
            <input type="file" accept=".csv" multiple style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploading} />
          </label>
        </div>
      </div>

      {/* ── Список збережених операцій ── */}
      {machineOperations && machineOperations.length > 0 && (
        <div style={{ background: '#111', padding: '20px', borderRadius: '16px', border: '1px solid #222' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Збережені операції ({machineOperations.length})</h2>
            <input 
              type="text" 
              placeholder="Пошук по номенклатурі..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '250px', padding: '10px 15px', background: '#000', border: '1px solid #333', color: '#fff', borderRadius: '8px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {(() => {
              // Фільтрація по пошуку
              const filteredOps = machineOperations.filter(op => {
                if (!searchQuery) return true
                const nom = nomenclatures.find(n => n.id === op.nomenclature_id)
                return nom?.name?.toLowerCase().includes(searchQuery.toLowerCase())
              })

              // Групування по готовому виробу (через зв'язки BOM або по назві)
              const groupedOps = filteredOps.reduce((acc, op) => {
                const nom = nomenclatures.find(n => n.id === op.nomenclature_id)
                const name = nom?.name || 'Невідомо'
                
                // Знаходимо ВСІ готові вироби, в які входить ця деталь
                const bomLinks = bomItems?.filter(b => String(b.child_id) === String(op.nomenclature_id)) || []
                const parentNames = bomLinks.map(b => nomenclatures.find(n => String(n.id) === String(b.parent_id))?.name).filter(Boolean)
                
                if (parentNames.length > 0) {
                  // Якщо деталь є в кількох виробах, додаємо її операцію в кожну групу
                  parentNames.forEach(groupName => {
                    if (!acc[groupName]) acc[groupName] = []
                    acc[groupName].push({ op, nom })
                  })
                } else {
                  // Fallback: якщо немає зв'язку в специфікації
                  let groupName = null
                  const parts = name.split('-')
                  const singleLetterIdx = parts.findIndex(p => /^[a-zA-Zа-яА-ЯёЁіІїЇєЄґҐ]$/.test(p.trim()))
                  groupName = singleLetterIdx > 0
                    ? parts.slice(0, singleLetterIdx).join('-')
                    : (parts.length >= 2 ? parts.slice(0, 2).join('-') : name.split(' ')[0])
                  
                  // Спроба знайти відповідний готовий виріб за префіксом (наприклад, KH/KR -> KHARAK)
                  const cleanGroup = groupName.toLowerCase().replace(/[^a-z0-9]/g, '')
                  const products = nomenclatures.filter(n => n.type === 'product')
                  const matchedProduct = products.find(p => {
                    const cleanProdName = p.name.toLowerCase().replace(/[^a-z0-9]/g, '')
                    const normProd = cleanProdName.replace('kharak', 'kh').replace('kulytsya', 'kl').replace('кулиця', 'kl')
                    return normProd.includes(cleanGroup) || cleanGroup.includes(normProd) ||
                           (cleanGroup.startsWith('kh') && normProd.includes(cleanGroup.replace('kh', 'kharak'))) ||
                           (cleanGroup.startsWith('kr') && normProd.includes(cleanGroup.replace('kr', 'kharak')))
                  })

                  if (matchedProduct) {
                    groupName = matchedProduct.name
                  }
                  
                  if (!acc[groupName]) acc[groupName] = []
                  acc[groupName].push({ op, nom })
                }
                return acc
              }, {})

              if (Object.keys(groupedOps).length === 0) {
                return <div style={{ color: '#666', textAlign: 'center', padding: '20px' }}>Нічого не знайдено</div>
              }

              return Object.entries(groupedOps).sort((a, b) => a[0].localeCompare(b[0])).map(([groupName, items]) => (
                <div key={groupName} style={{ background: '#0a0a0a', border: '1px solid #222', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ background: '#1a1a1a', padding: '10px 15px', borderBottom: '1px solid #222', fontWeight: 800, color: '#aaa', fontSize: '0.9rem' }}>
                    Виріб: {groupName} ({items.length})
                  </div>
                  <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {items.sort((a, b) => (a.nom?.name || '').localeCompare(b.nom?.name || '')).map(({ op, nom }) => {
                      const mac = machines.find(m => m.id === op.machine_id)
                      const macText = op.machine_type || mac?.name || '—'
                      const opMachineKey = op.machine_type || op.machine_id
                      const isSelected = selectedNom === op.nomenclature_id && selectedMachine === opMachineKey
                      return (
                        <div key={op.id} style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          background: isSelected ? '#1a2a3a' : 'transparent',
                          border: `1px solid ${isSelected ? '#3b82f6' : '#222'}`,
                          borderRadius: '8px', padding: '10px 12px'
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{nom?.name || '—'}</div>
                            <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '2px' }}>{macText}</div>
                            {(() => {
                              const cutterOps = (op.side2_cut_ops || []).filter(o => o.startsWith('__CUTTER__:'))
                              if (cutterOps.length === 0) return null
                              const cuttersText = cutterOps.map(c => {
                                const parts = c.split(':')
                                const cNom = nomenclatures.find(n => String(n.id) === String(parts[1]))
                                return `${cNom ? cNom.name : 'Фреза'} (${parts[2]} шт/л.)`
                              }).join(', ')
                              return (
                                <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '4px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                                  <span style={{ fontWeight: 600 }}>Витрата фрез на лист:</span> {cuttersText}
                                </div>
                              )
                            })()}
                          </div>
                          <div style={{ display: 'flex', gap: '6px', fontSize: '0.7rem', color: '#555' }}>
                            <span style={{ background: '#1a1a2e', padding: '3px 8px', borderRadius: '20px', color: '#60a5fa' }}>1ст: {(op.side1_ops || []).filter(o => !o.startsWith('__CUTTER__:')).length}</span>
                            <span style={{ background: '#1a1a2e', padding: '3px 8px', borderRadius: '20px', color: '#34d399' }}>2ст: {(op.side2_ops || []).filter(o => !o.startsWith('__CUTTER__:')).length}</span>
                            <span style={{ background: '#1a1a2e', padding: '3px 8px', borderRadius: '20px', color: '#f59e0b' }}>вир: {(op.side2_cut_ops || []).filter(o => !o.startsWith('__CUTTER__:') && !o.startsWith('__CUTTER__Reference:')).length}</span>
                          </div>
                          <label style={{ 
                            padding: '6px 12px', 
                            background: '#10b98120', 
                            border: '1px solid #10b98150', 
                            color: '#10b981', 
                            borderRadius: '6px', 
                            cursor: 'pointer', 
                            fontWeight: 600, 
                            fontSize: '0.75rem', 
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#10b98130'}
                          onMouseLeave={e => e.currentTarget.style.background = '#10b98120'}
                          >
                            <Upload size={12} />
                            <span>Імпорт CSV</span>
                            <input 
                              type="file" 
                              accept=".csv" 
                              style={{ display: 'none' }} 
                              onChange={(e) => handleSingleRowImport(e, op, nom)} 
                            />
                          </label>
                          <button
                            onClick={() => {
                              setSelectedNom(op.nomenclature_id)
                              setSelectedMachine(op.machine_type || op.machine_id)
                              // scroll to manual edit section smoothly
                              window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
                            }}
                            style={{ padding: '6px 12px', background: isSelected ? '#3b82f6' : '#1e3a5f', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                          >
                            {isSelected ? '✓ Редагується' : 'Редагувати'}
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm(`Видалити операції для "${nom?.name}"?`)) return
                              await supabase.from('machine_operations').delete().eq('id', op.id)
                              if (isSelected) { setSelectedNom(''); setSelectedMachine('') }
                            }}
                            style={{ padding: '6px 10px', background: '#2a0a0a', color: '#ef4444', border: '1px solid #3a1a1a', borderRadius: '6px', cursor: 'pointer' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            })()}
          </div>
        </div>
      )}

      <div style={{ background: '#111', padding: '20px', borderRadius: '16px', border: '1px solid #222' }}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: '1.2rem' }}>Ручне редагування</h2>
        
        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
          <select value={selectedNom} onChange={e => setSelectedNom(e.target.value)} style={{ flex: 1, padding: '12px', background: '#000', border: '1px solid #333', color: '#fff', borderRadius: '8px' }}>
            <option value="">-- Оберіть номенклатуру --</option>
            {nomenclatures.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
          <select value={selectedMachine} onChange={e => setSelectedMachine(e.target.value)} style={{ flex: 1, padding: '12px', background: '#000', border: '1px solid #333', color: '#fff', borderRadius: '8px' }}>
            <option value="">-- Оберіть тип верстата --</option>
            {MACHINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            {machines.filter(m => !MACHINE_TYPES.includes(m.name)).map(m => (
              <option key={m.id} value={m.id}>{m.name} (Застаріле)</option>
            ))}
          </select>
        </div>

        {selectedNom && selectedMachine && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
              {renderOpList(side1Ops, setSide1Ops, '1 сторона')}
              {renderOpList(side2OpsF2, setSide2OpsF2, '2 сторона (Ф2)')}
              {renderOpList(side2OpsF15, setSide2OpsF15, '2 сторона (Ф1.5)')}
              {renderOpList(side2CutOpsF2, setSide2CutOpsF2, 'Вирізка (Ф2)')}
              {renderOpList(side2CutOpsF15, setSide2CutOpsF15, 'Вирізка (Ф1.5)')}
              {renderCutterListEditor(cuttersList, setCuttersList)}
            </div>
            <button onClick={handleSave} style={{ padding: '15px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', fontSize: '1rem' }}>
              ЗБЕРЕГТИ ОПЕРАЦІЇ
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── NOM QUICK-CREATE MODAL (EXACT ERP NOMENCLATURE V2.0 WIZARD) ─────────────
const NomCreateModal = ({ onClose, onCreated, supabase, refreshTable, prefilledName = '', defaultGroupId = null }) => {
  const [groups, setGroups] = useState(DEFAULT_ERP_GROUPS)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const [wizardGroup, setWizardGroup] = useState(null)
  const [wizardRuleType, setWizardRuleType] = useState('generic')
  const DEFAULT_LOAD_TIMINGS = { '2': '', '4': '', '8': '', '16': '', '32': '', '64': '' }

  const [wizardParams, setWizardParams] = useState({
    standard: 'DIN912', diameter: '3', length: '10', isBlack: true, isPartialThread: false,
    type: 'TFF', thread: '3', tailLength: '6', outerDiameter: '5', material: 'Алюміній',
    cutDia: '1,5', shankDia: '3,175', cutLength: '8', totalLength: '38', angle: '90',
    specialType: '', din: 'DIN 934', thickness: '1',
    grade: 'Т300', dimensions: '500*600', extra: '',
    projType: 'SERIAL', projNum: '', name: prefilledName || '',
    customName: prefilledName || '', unit: 'шт',
    sheetGrade: 'Т300', sheetThickness: '3', unitsPerSheet: 24,
    loadTimings: { ...DEFAULT_LOAD_TIMINGS }
  })
  const [saving, setSaving] = useState(false)

  // 1. Fetch Catalog Groups & Items for Duplicate Check
  useEffect(() => {
    let isMounted = true
    const loadCatalogData = async () => {
      try {
        const { data: gData } = await supabase.from('nomenclature_catalog_groups').select('*').order('sort_order', { ascending: true })
        if (gData && gData.length > 0 && isMounted) {
          // Merge gData with DEFAULT_ERP_GROUPS so rule_type and V2 structure are ALWAYS preserved!
          const groupMap = new Map(DEFAULT_ERP_GROUPS.map(g => [g.id, g]))
          gData.forEach(g => {
            if (groupMap.has(g.id)) {
              const existing = groupMap.get(g.id)
              groupMap.set(g.id, { ...existing, ...g, rule_type: g.rule_type || existing.rule_type })
            }
          })
          setGroups(Array.from(groupMap.values()))
        } else if (isMounted) {
          setGroups(DEFAULT_ERP_GROUPS)
        }

        const { data: nData } = await supabase.from('nomenclatures_v2').select('*')
        if (nData && isMounted) {
          setItems(nData)
        }
      } catch (err) {
        console.warn('V2 wizard data load warning:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    loadCatalogData()
    return () => { isMounted = false }
  }, [supabase])

  // Flattened groups for select options
  const flattenedGroups = useMemo(() => {
    return buildFlattenedGroupOptions(groups)
  }, [groups])

  // Set default group once loaded
  useEffect(() => {
    if (groups.length > 0 && !wizardGroup) {
      const defaultG = defaultGroupId
        ? (groups.find(g => g.id === defaultGroupId) || groups.find(g => g.id === 'grp_production_frames') || groups[0])
        : (groups.find(g => g.id === 'grp_production_frames') || groups.find(g => g.id === 'grp_carbon_t300') || groups[0])
      setWizardGroup(defaultG)
      setWizardRuleType(defaultG?.rule_type || 'full_frame')
    }
  }, [groups, wizardGroup, defaultGroupId])

  // Auto-parse prefilledName if provided
  useEffect(() => {
    if (prefilledName && prefilledName.trim()) {
      const numMatch = prefilledName.match(/\d+/)
      const cleanName = prefilledName.replace(/\d+/g, '').replace(/^(рама|комплект|деталь|виріб)/gi, '').trim()
      setWizardParams(prev => ({
        ...prev,
        projNum: numMatch ? numMatch[0] : prev.projNum,
        name: cleanName || prev.name
      }))
    }
  }, [prefilledName])

  // Generated Real-time Name
  const generatedName = useMemo(() => {
    return generateStandardName(wizardRuleType, wizardParams)
  }, [wizardRuleType, wizardParams])

  // Duplicate Check
  const isDuplicate = useMemo(() => {
    if (!generatedName) return false
    const norm = generatedName.toLowerCase().replace(/\s+/g, '')
    return items.some(it => (it.name || '').toLowerCase().replace(/\s+/g, '') === norm)
  }, [generatedName, items])

  const inputStyle = { 
    width: '100%', 
    background: 'var(--input-bg, #ffffff)', 
    border: '1px solid var(--border-color, #cbd5e1)', 
    borderRadius: '12px', 
    padding: '10px 14px', 
    color: 'var(--text-main, #0f172a)', 
    fontWeight: 700, 
    fontSize: '0.88rem',
    boxSizing: 'border-box',
    outline: 'none'
  }

  const labelStyle = { 
    fontSize: '0.72rem', 
    fontWeight: 900, 
    color: 'var(--text-muted, #64748b)', 
    textTransform: 'uppercase', 
    marginBottom: '6px', 
    display: 'block' 
  }

  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    if (!generatedName) {
      return alert('Будь ласка, заповніть параметри для формування назви!')
    }
    if (isDuplicate) {
      return alert('Позиція з такою назвою вже існує у V2 каталозі!')
    }

    setSaving(true)
    try {
      const nextCode = items.reduce((max, it) => {
        const num = parseInt(String(it.code || '').replace(/\D/g, ''))
        return num > max ? num : max
      }, 90000) + 1

      const v2Payload = {
        code: `V2-${nextCode}`,
        name: generatedName,
        group_id: wizardGroup?.id || null,
        unit: wizardParams.unit || 'шт',
        rule_type: wizardRuleType,
        rule_params: wizardParams,
        status: 'active'
      }

      const { data: inserted, error: insertErr } = await supabase
        .from('nomenclatures_v2')
        .insert([v2Payload])
        .select()
        .single()

      if (insertErr) throw insertErr

      await refreshTable('nomenclatures')
      if (onCreated) onCreated(inserted)
      onClose()
      alert(`✅ Позицію «${generatedName}» успішно збережено до V2 каталогу!`)
    } catch (err) {
      alert('Помилка збереження до V2 каталогу: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const refDicts = {
    millTypes: ['кукурудза', 'двопера', 'чотирьохпера', 'фасочна', 'сферична по алюмінію'],
    millShankDias: ['3,175', '4', '6', '8', '10', '12'],
    millCutDias: ['1', '1,2', '1,5', '2', '2,5', '3', '3,175', '4', '6', '8'],
    millCutLengths: ['4', '6', '8', '12', '15', '17', '22', '25', '32'],
    millTotalLengths: ['38', '45', '50', '55', '60', '75', '100'],
    grades: ['Т300', 'Т700'],
    thicknesses: ['1', '2', '2,5', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
    extras: ['(преференція)', '(0/45/90)']
  }

  const prefixList = ['Комплект карбонової рами', 'Комплект карбонових елементів', 'Набір деталей рами', 'Складова рами']
  const seriesList = ['Серія Серійний', 'Серія Продакшн', 'Серія Марун']

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '24px', width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', padding: '30px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={22} color="#ff9000" />
            <h3 style={{ margin: 0, fontWeight: 950, fontSize: '1.2rem', color: 'var(--text-main, #0f172a)' }}>
              Конструктор Номенклатури ERP
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Category Selector */}
          <div>
            <label style={labelStyle}>КАТЕГОРІЯ НОМЕНКЛАТУРИ</label>
            <select 
              value={wizardGroup?.id || ''} 
              onChange={e => {
                const g = groups.find(it => it.id === e.target.value)
                const rType = g?.rule_type || 'generic'
                setWizardGroup(g)
                setWizardRuleType(rType)
                setWizardParams(prev => ({
                  ...prev,
                  isBlack: rType === 'screw_black' ? true : rType === 'screw_silver' ? false : prev.isBlack
                }))
              }}
              style={{ ...inputStyle, fontWeight: 800, fontSize: '0.9rem', padding: '12px' }}
            >
              {flattenedGroups.map(g => (
                <option 
                  key={g.id} 
                  value={g.id}
                  style={{
                    fontWeight: g.depth === 0 ? 900 : g.hasSubs ? 800 : 400
                  }}
                >
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          {/* Live Preview Card */}
          <div style={{ background: 'rgba(255,144,0,0.08)', border: '1px solid rgba(255,144,0,0.35)', borderRadius: '16px', padding: '18px' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#d97706', textTransform: 'uppercase', marginBottom: '6px' }}>АВТОМАТИЧНО СГЕНЕРОВАНА НАЗВА:</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 950, color: 'var(--text-main, #0f172a)', wordBreak: 'break-word' }}>
              {generatedName || <span style={{ color: '#777', fontStyle: 'italic', fontWeight: 600 }}>{wizardRuleType === 'frame_part' ? 'Введіть назву деталі у поле нижче...' : 'Заповніть параметри нижче...'}</span>}
            </div>

            {isDuplicate && (
              <div style={{ marginTop: '10px', color: '#dc2626', fontSize: '0.78rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={15} /> Увага: Позиція з такою назвою вже існує у V2 каталозі!
              </div>
            )}
          </div>

          {/* Category Rules & Dictionaries Badge */}
          {ERP_CATEGORY_SCHEMAS[wizardRuleType] && (
            <div style={{ background: 'var(--button-bg, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '14px', padding: '12px 16px', fontSize: '0.75rem' }}>
              <div style={{ color: 'var(--text-muted, #64748b)', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px', fontSize: '0.68rem', letterSpacing: '0.5px' }}>
                📋 Обов'язкові довідникові параметри для {ERP_CATEGORY_SCHEMAS[wizardRuleType].title}:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {ERP_CATEGORY_SCHEMAS[wizardRuleType].fields.map(f => (
                  <span key={f.key} style={{ background: 'rgba(217,119,6,0.12)', color: '#b45309', border: '1px solid rgba(217,119,6,0.3)', padding: '3px 8px', borderRadius: '6px', fontWeight: 800, fontSize: '0.7rem' }}>
                    ✓ {f.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Dynamic Rule Form Fields */}
          <div style={{ background: 'var(--card-bg, #ffffff)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color, #cbd5e1)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            
            {/* SCREWS */}
            {(wizardRuleType === 'screw' || wizardRuleType === 'screw_black' || wizardRuleType === 'screw_silver') && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>СТАНДАРТ (DIN / ISO)</label>
                    <select value={wizardParams.standard} onChange={e => setWizardParams({...wizardParams, standard: e.target.value})} style={inputStyle}>
                      <option value="DIN912">DIN 912 (Циліндрична)</option>
                      <option value="DIN7991">DIN 7991 (Потай)</option>
                      <option value="ISO7380">ISO 7380 (Напівкругла)</option>
                      <option value="DIN7985">DIN 7985 (Сочевиця)</option>
                      <option value="DIN913">DIN 913 (Установчий)</option>
                      <option value="ISO10642">ISO 10642</option>
                      <option value="custom">✏️ + Власний стандарт...</option>
                    </select>
                    {wizardParams.standard === 'custom' && (
                      <input type="text" value={wizardParams.customStandard || ''} onChange={e => setWizardParams({...wizardParams, customStandard: e.target.value})} placeholder="напр. DIN 84" style={{ ...inputStyle, marginTop: '8px' }} />
                    )}
                  </div>
                  <div>
                    <label style={labelStyle}>РІЗЬБА (М)</label>
                    <select value={wizardParams.diameter} onChange={e => setWizardParams({...wizardParams, diameter: e.target.value})} style={inputStyle}>
                      <option value="1,6">М1.6</option>
                      <option value="2">М2</option>
                      <option value="2,5">М2.5</option>
                      <option value="3">М3</option>
                      <option value="4">М4</option>
                      <option value="5">М5</option>
                      <option value="6">М6</option>
                      <option value="8">М8</option>
                      <option value="10">М10</option>
                      <option value="custom">✏️ + Власна різьба...</option>
                    </select>
                    {wizardParams.diameter === 'custom' && (
                      <input type="text" value={wizardParams.customDiameter || ''} onChange={e => setWizardParams({...wizardParams, customDiameter: e.target.value})} placeholder="напр. 3,5" style={{ ...inputStyle, marginTop: '8px' }} />
                    )}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>ДОВЖИНА ГВИНТА (мм)</label>
                  <input type="text" value={wizardParams.length} onChange={e => setWizardParams({...wizardParams, length: e.target.value})} placeholder="напр. 10, 16, 25" style={inputStyle} />
                </div>

                <div style={{ display: 'flex', gap: '20px', paddingTop: '5px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    <input type="checkbox" checked={wizardParams.isBlack} onChange={e => setWizardParams({...wizardParams, isBlack: e.target.checked})} />
                    Чорний колір (чорний)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    <input type="checkbox" checked={wizardParams.isPartialThread} onChange={e => setWizardParams({...wizardParams, isPartialThread: e.target.checked})} />
                    Неповна різьба
                  </label>
                </div>
              </>
            )}

            {/* NUTS */}
            {wizardRuleType === 'nut' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>СТАНДАРТ (DIN)</label>
                    <select value={wizardParams.din || 'DIN 934'} onChange={e => setWizardParams({...wizardParams, din: e.target.value})} style={inputStyle}>
                      <option value="DIN 934">DIN 934 (Шестигранна)</option>
                      <option value="DIN 6923">DIN 6923 (З фланцем)</option>
                      <option value="DIN 985">DIN 985 (З нейлоном)</option>
                      <option value="custom">✏️ + Власний DIN...</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>РІЗЬБА (М)</label>
                    <select value={wizardParams.diameter || '3'} onChange={e => setWizardParams({...wizardParams, diameter: e.target.value})} style={inputStyle}>
                      <option value="2">М2</option>
                      <option value="2,5">М2.5</option>
                      <option value="3">М3</option>
                      <option value="4">М4</option>
                      <option value="5">М5</option>
                      <option value="6">М6</option>
                      <option value="custom">✏️ + Власна різьба...</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* PRESS NUTS */}
            {wizardRuleType === 'press_nut' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>РІЗЬБА (М)</label>
                    <select value={wizardParams.diameter || '3'} onChange={e => setWizardParams({...wizardParams, diameter: e.target.value})} style={inputStyle}>
                      <option value="2">М2</option>
                      <option value="2,5">М2.5</option>
                      <option value="3">М3</option>
                      <option value="4">М4</option>
                      <option value="5">М5</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>ТОВЩИНА ЗАПРЕСОВКИ</label>
                    <select value={wizardParams.thickness || '1'} onChange={e => setWizardParams({...wizardParams, thickness: e.target.value})} style={inputStyle}>
                      <option value="0">0 (0.8 мм)</option>
                      <option value="1">1 (1.0 мм)</option>
                      <option value="2">2 (1.4 мм)</option>
                      <option value="3">3 (2.3 мм)</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* STANDOFFS */}
            {wizardRuleType === 'standoff' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>ТИП СТІЙКИ</label>
                    <select value={wizardParams.type} onChange={e => setWizardParams({...wizardParams, type: e.target.value})} style={inputStyle}>
                      <option value="TFF">TFF (Мама-Мама)</option>
                      <option value="TFM">TFM (Тато-Мама)</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>РІЗЬБА (М)</label>
                    <select value={wizardParams.thread} onChange={e => setWizardParams({...wizardParams, thread: e.target.value})} style={inputStyle}>
                      <option value="3">М3</option>
                      <option value="4">М4</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>ДОВЖИНА СТІЙКИ (мм)</label>
                    <input type="text" value={wizardParams.length} onChange={e => setWizardParams({...wizardParams, length: e.target.value})} placeholder="напр. 20" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>МАТЕРІАЛ</label>
                    <select value={wizardParams.material} onChange={e => setWizardParams({...wizardParams, material: e.target.value})} style={inputStyle}>
                      <option value="Алюміній">Алюміній</option>
                      <option value="Латунь">Латунь</option>
                      <option value="Цинк S5">Цинк S5</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* MILLS */}
            {wizardRuleType === 'mill' && (
              <>
                <div>
                  <label style={labelStyle}>ТИП ФРЕЗИ</label>
                  <select value={wizardParams.type || 'кукурудза'} onChange={e => setWizardParams({...wizardParams, type: e.target.value})} style={inputStyle}>
                    {refDicts.millTypes.map(m => (
                      <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={labelStyle}>d (різ, мм)</label>
                    <select value={wizardParams.cutDia || '1,5'} onChange={e => setWizardParams({...wizardParams, cutDia: e.target.value})} style={inputStyle}>
                      {refDicts.millCutDias.map(v => <option key={v} value={v}>{v} мм</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>D (цанга)</label>
                    <select value={wizardParams.shankDia || '3,175'} onChange={e => setWizardParams({...wizardParams, shankDia: e.target.value})} style={inputStyle}>
                      {refDicts.millShankDias.map(v => <option key={v} value={v}>{v} мм</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>l (різ, мм)</label>
                    <select value={wizardParams.cutLength || '8'} onChange={e => setWizardParams({...wizardParams, cutLength: e.target.value})} style={inputStyle}>
                      {refDicts.millCutLengths.map(v => <option key={v} value={v}>{v} мм</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>L (заг, мм)</label>
                    <select value={wizardParams.totalLength || '38'} onChange={e => setWizardParams({...wizardParams, totalLength: e.target.value})} style={inputStyle}>
                      {refDicts.millTotalLengths.map(v => <option key={v} value={v}>{v} мм</option>)}
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* CARBON SHEETS */}
            {wizardRuleType === 'carbon' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={labelStyle}>МАРКА СИРОВИНИ</label>
                    <select value={wizardParams.grade || 'Т300'} onChange={e => setWizardParams({...wizardParams, grade: e.target.value})} style={inputStyle}>
                      {refDicts.grades.map(g => <option key={g} value={g}>Карбон {g}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>ФОРМАТ (мм)</label>
                    <select value={wizardParams.dimensions || '500*600'} onChange={e => setWizardParams({...wizardParams, dimensions: e.target.value})} style={inputStyle}>
                      <option value="500*600">500*600</option>
                      <option value="1000*600">1000*600</option>
                      <option value="500*500">500*500</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>ТОВЩИНА (мм)</label>
                    <select value={wizardParams.thickness || '1'} onChange={e => setWizardParams({...wizardParams, thickness: e.target.value})} style={inputStyle}>
                      {refDicts.thicknesses.map(t => <option key={t} value={t}>{t} мм</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>СПЕЦ. ПОЗНАЧКА</label>
                    <select value={wizardParams.extra || ''} onChange={e => setWizardParams({...wizardParams, extra: e.target.value})} style={inputStyle}>
                      <option value="">— Немає</option>
                      {refDicts.extras.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* FULL FRAME & KITS */}
            {(wizardRuleType === 'full_frame' || wizardRuleType === 'element_kit') && (
              <>
                <div>
                  <label style={labelStyle}>ПОЧАТОК НАЗВИ / ТИП ВИРОБУ</label>
                  <select value={wizardParams.prefixChoice || 'Комплект карбонової рами'} onChange={e => setWizardParams({...wizardParams, prefixChoice: e.target.value})} style={inputStyle}>
                    {prefixList.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>ТИП ПРОЄКТУ</label>
                    <select value={wizardParams.projType || 'SERIAL'} onChange={e => setWizardParams({...wizardParams, projType: e.target.value})} style={inputStyle}>
                      <option value="SERIAL">Серійний виріб</option>
                      <option value="RND">Серія RND</option>
                      <option value="IP">Індивідуальний проєкт (ІП)</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>НОМЕР ПРОЄКТУ</label>
                    <input type="text" value={wizardParams.projNum || ''} onChange={e => setWizardParams({...wizardParams, projNum: e.target.value})} placeholder="напр. 52 або 176" style={inputStyle} />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>НАЗВА МОДЕЛІ / МОДИФІКАЦІЯ</label>
                  <input type="text" value={wizardParams.name || ''} onChange={e => setWizardParams({...wizardParams, name: e.target.value})} placeholder="напр. Drozd Interceptor" style={inputStyle} />
                </div>
              </>
            )}

            {/* FRAME PART (ДЕТАЛІ ЛАЗЕР) */}
            {wizardRuleType === 'frame_part' && (
              <>
                <div>
                  <label style={labelStyle}>НАЗВА ДЕТАЛІ</label>
                  <input type="text" value={wizardParams.name || wizardParams.customName || ''} onChange={e => setWizardParams({...wizardParams, name: e.target.value, customName: e.target.value})} placeholder="напр. KR-10(218)-П-7-60" style={inputStyle} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr', gap: '10px' }}>
                  <div>
                    <label style={labelStyle}>МАРКА СИРОВИНИ</label>
                    <select value={wizardParams.sheetGrade || 'Т300'} onChange={e => setWizardParams({...wizardParams, sheetGrade: e.target.value})} style={inputStyle}>
                      {refDicts.grades.map(g => <option key={g} value={g}>Карбон {g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>ТОВЩИНА (мм)</label>
                    <select value={wizardParams.sheetThickness || '3'} onChange={e => setWizardParams({...wizardParams, sheetThickness: e.target.value})} style={inputStyle}>
                      {refDicts.thicknesses.map(t => <option key={t} value={t}>{t} мм</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>НОРМА (шт/л)</label>
                    <input type="number" value={wizardParams.unitsPerSheet || 24} onChange={e => setWizardParams({...wizardParams, unitsPerSheet: Number(e.target.value) || 1})} placeholder="24" style={inputStyle} />
                  </div>
                </div>

                {/* LOAD TIMINGS SECTION */}
                <div style={{ background: 'rgba(255, 144, 0, 0.05)', border: '1px solid rgba(255, 144, 0, 0.25)', borderRadius: '16px', padding: '16px', marginTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={16} color="#d97706" />
                      <span style={{ fontSize: '0.75rem', fontWeight: 950, color: 'var(--text-main, #0f172a)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        ТАЙМІНГИ ОБРОБКИ ДЛЯ ВАРІАНТІВ ЗАГРУЗКИ (ХВИЛИНИ)
                      </span>
                    </div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #64748b)', fontWeight: 700 }}>Час виконання на партію</span>
                  </div>

                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', marginBottom: '12px', lineHeight: '1.3' }}>
                    Вкажіть час обробки деталі (в хвилинах) для кожної кількості листів при завантаженні у верстат:
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    {['2', '4', '8', '16', '32', '64'].map(sheets => {
                      const val = wizardParams.loadTimings?.[sheets] ?? ''
                      return (
                        <div key={sheets} style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '12px', padding: '10px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#d97706', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{sheets} {sheets === '2' || sheets === '4' || sheets === '32' || sheets === '64' ? 'листи' : 'листів'}:</span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted, #64748b)', fontWeight: 700 }}>хв</span>
                          </div>
                          <input 
                            type="number"
                            step="0.1"
                            min="0"
                            value={val}
                            onChange={e => {
                              const updatedVal = e.target.value
                              setWizardParams(prev => ({
                                ...prev,
                                loadTimings: {
                                  ...(prev.loadTimings || DEFAULT_LOAD_TIMINGS),
                                  [sheets]: updatedVal
                                }
                              }))
                            }}
                            placeholder="напр. 15"
                            style={{ 
                              ...inputStyle,
                              padding: '8px 10px',
                              fontSize: '0.88rem'
                            }} 
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}

            {/* GENERIC / CUSTOM */}
            {wizardRuleType === 'generic' && (
              <div>
                <label style={labelStyle}>ПОВНА НАЗВА ПОЗИЦІЇ</label>
                <input type="text" value={wizardParams.customName || ''} onChange={e => setWizardParams({...wizardParams, customName: e.target.value})} placeholder="Введіть стандартизовану назву..." style={inputStyle} />
              </div>
            )}

            {/* Unit selector */}
            <div style={{ borderTop: '1px solid var(--border-color, #e2e8f0)', paddingTop: '15px' }}>
              <label style={labelStyle}>ОДИНИЦЯ ВИМІРУ</label>
              <select value={wizardParams.unit || 'шт'} onChange={e => setWizardParams({...wizardParams, unit: e.target.value})} style={inputStyle}>
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

          <button 
            type="submit" 
            disabled={isDuplicate || !generatedName || saving}
            style={{ 
              background: isDuplicate || !generatedName ? 'var(--button-bg, #cbd5e1)' : 'linear-gradient(135deg, #10b981, #059669)', 
              color: isDuplicate || !generatedName ? '#777' : '#ffffff', 
              border: 'none', 
              borderRadius: '14px', 
              padding: '16px', 
              fontWeight: 950, 
              fontSize: '0.95rem', 
              cursor: isDuplicate || !generatedName || saving ? 'not-allowed' : 'pointer',
              boxShadow: isDuplicate || !generatedName ? 'none' : '0 5px 20px rgba(16,185,129,0.3)',
              transition: 'all 0.2s'
            }}
          >
            {saving ? 'ЗБЕРЕЖЕННЯ ДО V2 КАТАЛОГУ...' : 'ЗБЕРЕГТИ ДО V2 КАТАЛОГУ'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── BOM ROW COMPONENT ────────────────────────────────────────────────────────
const BomRow = ({ row, idx, nomenclatures, bomItems, onUpdate, onRemove, supabase, refreshTable, onExpandAssembly }) => {
  const [query, setQuery] = useState(row.nomName || '')
  const [showDrop, setShowDrop] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const inputRef = useRef(null)

  // Sync query when row.nomName/nomId changes from parent (e.g. after expand assembly)
  const prevNomId = useRef(row.nomId)
  useEffect(() => {
    if (prevNomId.current !== row.nomId) {
      prevNomId.current = row.nomId
      setQuery(row.nomName || '')
    }
  }, [row.nomId, row.nomName])

  const filtered = useMemo(() => {
    if (!query || query.length < 2) return []
    const q = query.toLowerCase()
    return nomenclatures.filter(n => 
      (n.name || '').toLowerCase().includes(q) ||
      (n.description || '').toLowerCase().includes(q) ||
      (n.material_type || '').toLowerCase().includes(q) ||
      (n.nomenclature_code || '').toLowerCase().includes(q)
    ).slice(0, 12)
  }, [query, nomenclatures])

  const subItems = useMemo(() => {
    if (!row.nomId || !bomItems) return []
    return bomItems.filter(b => String(b.parent_id) === String(row.nomId))
  }, [row.nomId, bomItems])

  const TYPE_COLORS = { product: '#d97706', part: '#2563eb', raw: '#059669', consumable: '#dc2626', assembly: '#7c3aed' }
  const TYPE_LABELS = { product: 'Виріб', part: 'Деталь', raw: 'Сировина', consumable: 'Метиз', assembly: 'Вузол' }

  return (
    <>
      {showCreate && (
        <NomCreateModal
          prefilledName={query}
          supabase={supabase}
          refreshTable={refreshTable}
          onClose={() => setShowCreate(false)}
          onCreated={nom => {
            setQuery(nom.name)
            setShowDrop(false)
            onUpdate(idx, { nomId: nom.id, nomName: nom.name, nomType: nom.type, nomUnit: nom.unit, group: autoClassify(nom) })
          }}
        />
      )}
      <div style={{ background: idx % 2 === 0 ? '#0e0e0e' : 'transparent', borderRadius: '8px', padding: '6px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 120px 90px 28px', gap: '8px', alignItems: 'center', padding: '4px 10px', position: 'relative' }}>
          <span style={{ color: '#333', fontSize: '0.8rem', fontWeight: 700, textAlign: 'center' }}>{idx + 1}</span>
          <div style={{ position: 'relative' }}>
            <input
              ref={inputRef}
              value={query}
              placeholder="Пошук або назва компонента..."
              onChange={e => { setQuery(e.target.value); setShowDrop(true); onUpdate(idx, { nomId: null, nomName: e.target.value }) }}
              onFocus={() => setShowDrop(true)}
              style={{ width: '100%', padding: '8px 12px', background: row.nomId ? '#0f1f14' : '#111', border: `1px solid ${row.nomId ? '#16a34a40' : '#2a2a2a'}`, color: '#fff', borderRadius: '8px', fontSize: '0.85rem', boxSizing: 'border-box' }}
            />
            {showDrop && query.length >= 2 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#111', border: '1px solid #3b82f6', borderRadius: '10px', zIndex: 9999, maxHeight: '240px', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.8)', marginTop: '4px' }}>
                {filtered.map(n => (
                  <div
                    key={n.id}
                    onMouseDown={() => {
                      setQuery(n.name)
                      setShowDrop(false)
                      onUpdate(idx, { nomId: n.id, nomName: n.name, nomType: n.type, nomUnit: n.unit, group: autoClassify(n) })
                    }}
                    style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1a1a1a', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>{n.name}</div>
                      {n.material_type && <div style={{ fontSize: '0.7rem', color: '#555' }}>{n.material_type}</div>}
                    </div>
                    <span style={{ fontSize: '0.65rem', fontWeight: 900, background: (TYPE_COLORS[n.type] || '#555') + '22', color: TYPE_COLORS[n.type] || '#888', padding: '2px 8px', borderRadius: '20px', whiteSpace: 'nowrap' }}>{TYPE_LABELS[n.type] || n.type}</span>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div style={{ padding: '12px 14px' }}>
                    <div style={{ color: '#555', fontSize: '0.8rem', marginBottom: '10px' }}>Нічого не знайдено</div>
                    <button onMouseDown={() => { setShowDrop(false); setShowCreate(true) }} style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid #7c3aed40', color: '#a78bfa', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Plus size={14}/> Створити «{query}»
                    </button>
                  </div>
                )}
                {filtered.length > 0 && (
                  <div style={{ padding: '8px 14px', borderTop: '1px solid #1a1a1a' }}>
                    <button onMouseDown={() => { setShowDrop(false); setShowCreate(true) }} style={{ background: 'transparent', border: 'none', color: '#7c3aed', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Plus size={12}/> Не знайшли? Створити нову
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <select
            value={row.group || 'Деталі'}
            onChange={e => onUpdate(idx, { group: e.target.value })}
            style={{ padding: '8px 8px', background: '#111', border: '1px solid #2a2a2a', color: 'var(--text-muted, #64748b)', borderRadius: '8px', fontSize: '0.75rem' }}
          >
            <option>Деталі</option>
            <option>Накладки</option>
            <option>Метизи</option>
            <option>Гума/Пластик</option>
            <option>3D-друк</option>
            <option>Фурнітура</option>
            <option>Комплектуючі</option>
            <option>Інше</option>
          </select>
          <input
            type="number"
            min="1"
            step="1"
            value={row.qty}
            onChange={e => onUpdate(idx, { qty: e.target.value })}
            style={{ padding: '8px 10px', background: '#111', border: '1px solid #2a2a2a', color: '#f59e0b', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 700, textAlign: 'right' }}
          />
          <button onClick={() => onRemove(idx)} style={{ background: 'transparent', border: 'none', color: '#3a1a1a', cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = '#3a1a1a'}><Trash2 size={15}/></button>
        </div>

        {row.nomId && row.nomType === 'assembly' && subItems.length > 0 && (
          <div style={{ marginLeft: '36px', marginRight: '10px', marginTop: '6px', marginBottom: '4px', padding: '10px 14px', background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#a78bfa', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '5px' }}>📦 Вузол містить {subItems.length} компонент(ів):</span>
              <button 
                onClick={() => onExpandAssembly(row.nomId, Number(row.qty) || 1)}
                style={{ padding: '3px 8px', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', color: '#c084fc', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(167,139,250,0.25)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(167,139,250,0.15)'}
              >
                💥 Розгорнути в окремі рядки
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {subItems.map(s => {
                const subNom = nomenclatures.find(n => String(n.id) === String(s.child_id))
                return (
                  <span key={s.id} style={{ fontSize: '0.7rem', background: '#0a0a0a', border: '1px solid #1a1a1a', padding: '2px 8px', borderRadius: '6px', color: '#aaa' }}>
                    {subNom ? subNom.name : 'компонент'} <strong style={{ color: '#fff' }}>x{s.quantity_per_parent}</strong>
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ─── AUTO-CLASSIFY helper (mirrors PackagingModule logic) ─────────────────────
function autoClassify(nom) {
  if (!nom) return 'Інше'
  const name = (nom.name || '').toLowerCase()
  const type = (nom.type || '').toLowerCase()
  const code = (nom.nomenclature_code || '').toLowerCase()

  // Метизи: гвинт, гайка, болт, шайба, прес-гайка
  if (
    name.includes('гвинт') ||
    name.includes('гайка') ||
    name.includes('болт') ||
    name.includes('шайба') ||
    name.includes('прес гайк') ||
    name.includes('прес-гайк') ||
    name.includes('втулка') ||
    type === 'consumable'
  ) return 'Метизи'

  // Кріплення / 3D-друк
  if (
    name.includes('кріплення') ||
    name.includes('друк') ||
    name.includes('3д') ||
    name.includes('3d')
  ) return '3D-друк'

  // Стійки
  if (name.includes('стійка') || name.includes('стийка')) return 'Стійки'

  // Накладки
  if (
    name.includes('накладка') ||
    name.includes('накладки') ||
    name.includes('наклад')
  ) return 'Накладки'

  // Гума / Пластик
  if (
    name.includes('гума') ||
    name.includes('пластик') ||
    name.includes('пвх') ||
    name.includes('каучук') ||
    name.includes('уплітнювач') ||
    name.includes('прокладка') ||
    name.includes('проклад')
  ) return 'Гума/Пластик'

  // Деталі: ІП- префікс, код ІП, type=part
  if (
    name.startsWith('іп') ||
    name.startsWith('іп-') ||
    name.includes(' іп') ||
    code.startsWith('іп') ||
    type === 'part'
  ) return 'Деталі'

  // Вузоли / субасемблі
  if (type === 'assembly') return 'Комплектуючі'

  return 'Інше'
}

// ─── BOM SPEC BUILDER TAB ─────────────────────────────────────────────────────
const SpecBuilderTab = () => {
  const { nomenclatures: rawNoms, bomItems, supabase, refreshTable } = useMES()
  const nomenclatures = useV2NomenclaturesData(supabase)

  // Editor state
  const [parentId, setParentId] = useState('')
  const [pendingParent, setPendingParent] = useState(null)
  const [parentSearch, setParentSearch] = useState('')
  const [showParentDrop, setShowParentDrop] = useState(false)
  const [rows, setRows] = useState([])
  const lastLoadedParentId = useRef(null)
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState('editor') // 'editor' | 'catalog' | 'dossier'
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogFolder, setCatalogFolder] = useState('all') // 'all' | 'grp_production_frames' | 'grp_test_samples' | 'grp_assemblies'
  const [collapsedFolders, setCollapsedFolders] = useState({})
  const [expandedParents, setExpandedParents] = useState({})
  const [showNomCreate, setShowNomCreate] = useState(false)
  const [nomCreateDefaultGroup, setNomCreateDefaultGroup] = useState(null)
  const [showParentCreate, setShowParentCreate] = useState(false)
  const [parentCreateType, setParentCreateType] = useState('product')
  const [dossierParentId, setDossierParentId] = useState(null)
  
  // State for inline operations manager
  const [activeInlinePart, setActiveInlinePart] = useState(null) // { id, name }
  const [selectedMachine, setSelectedMachine] = useState('')
  const [side1Ops, setSide1Ops] = useState([])
  const [side2OpsF2, setSide2OpsF2] = useState([])
  const [side2OpsF15, setSide2OpsF15] = useState([])
  const [side2CutOpsF2, setSide2CutOpsF2] = useState([])
  const [side2CutOpsF15, setSide2CutOpsF15] = useState([])
  const [inlineCuttersList, setInlineCuttersList] = useState([])
  const [savingOps, setSavingOps] = useState(false)

  const { machineOperations, machines } = useMES()

  const renderCutterListEditor = (cutters, setCutters) => renderCutterListEditorShared(cutters, setCutters, nomenclatures)

  // Prevent background scroll when modal is active
  useEffect(() => {
    const isModalOpen = !!activeInlinePart || !!showNomCreate || !!showParentCreate
    if (isModalOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [activeInlinePart, showNomCreate, showParentCreate])

  // Load existing machine operations when active part and machine are chosen
  useEffect(() => {
    if (activeInlinePart && selectedMachine) {
      const existing = machineOperations?.find(o => 
        o.nomenclature_id === activeInlinePart.id && 
        (o.machine_type === selectedMachine || o.machine_id === selectedMachine)
      )
      if (existing) {
        setSide1Ops((existing.side1_ops || []).filter(op => !op.startsWith('__CUTTER__:')))
        const s2 = (existing.side2_ops || []).filter(op => !op.startsWith('__CUTTER__:'))
        setSide2OpsF2(s2.map(op => op.includes('|') ? op.split('|')[0].trim() : op))
        setSide2OpsF15(s2.map(op => op.includes('|') ? op.split('|')[1].trim() : ''))
        const s2c = (existing.side2_cut_ops || []).filter(op => !op.startsWith('__CUTTER__:') && !op.startsWith('__CUTTER__Reference:'))
        setSide2CutOpsF2(s2c.map(op => op.includes('|') ? op.split('|')[0].trim() : op))
        setSide2CutOpsF15(s2c.map(op => op.includes('|') ? op.split('|')[1].trim() : ''))
        
        const cutterOps = (existing.side2_cut_ops || []).filter(op => op.startsWith('__CUTTER__:'))
        const parsed = cutterOps.map(c => {
          const parts = c.split(':')
          return { nomId: parts[1], qty: parseFloat(parts[2]) || 0 }
        })
        setInlineCuttersList(parsed)
      } else {
        setSide1Ops([])
        setSide2OpsF2([])
        setSide2OpsF15([])
        setSide2CutOpsF2([])
        setSide2CutOpsF15([])
        setInlineCuttersList([])
      }
    }
  }, [activeInlinePart, selectedMachine])

  const handleSaveInlineOps = async () => {
    if (!activeInlinePart || !selectedMachine) return
    setSavingOps(true)
    try {
      const isType = MACHINE_TYPES.includes(selectedMachine)
      
      const existing = machineOperations?.find(o => 
        o.nomenclature_id === activeInlinePart.id && 
        (o.machine_type === selectedMachine || o.machine_id === selectedMachine)
      )
      
      const cutterStrings = inlineCuttersList
        .filter(c => c.nomId && c.qty > 0)
        .map(c => `__CUTTER__:${c.nomId}:${c.qty}`)

      const payload = {
        nomenclature_id: activeInlinePart.id,
        machine_id: isType ? null : selectedMachine,
        machine_type: isType ? selectedMachine : null,
        side1_ops: side1Ops.filter(Boolean),
        side2_ops: combineOps(side2OpsF2, side2OpsF15),
        side2_cut_ops: [...combineOps(side2CutOpsF2, side2CutOpsF15), ...cutterStrings]
      }
      
      if (existing) {
        await supabase.from('machine_operations').update(payload).eq('id', existing.id)
      } else {
        await supabase.from('machine_operations').insert(payload)
      }
      await refreshTable('machine_operations')
      alert('Операції збережено успішно!')
      setActiveInlinePart(null)
      setSelectedMachine('')
    } catch (err) {
      alert('Помилка збереження: ' + err.message)
    } finally {
      setSavingOps(false)
    }
  }

  // Derive the selected parent nomenclature object
  const selectedParent = useMemo(() => {
    if (parentId === 'temp-new') {
      return { id: 'temp-new', name: pendingParent?.name, type: pendingParent?.type, material_type: pendingParent?.material_type }
    }
    return nomenclatures.find(n => n.id === parentId)
  }, [parentId, nomenclatures, pendingParent])

  // Product list for parent selection
  const productNoms = useMemo(() => {
    const q = parentSearch.toLowerCase()
    return nomenclatures
      .filter(n => (n.type === 'product' || n.type === 'assembly') && (!q || n.name.toLowerCase().includes(q)))
      .slice(0, 15)
  }, [nomenclatures, parentSearch])

  // When parent changes, load its existing BOM rows
  useEffect(() => {
    if (!parentId) {
      setRows([])
      lastLoadedParentId.current = null
      return
    }
    if (parentId === 'temp-new') {
      setRows([])
      lastLoadedParentId.current = 'temp-new'
      return
    }
    
    const existing = bomItems.filter(b => String(b.parent_id) === String(parentId))
    if (existing.length > 0) {
      setRows(existing.map(b => {
        const nom = nomenclatures.find(n => String(n.id) === String(b.child_id))
        return {
          nomId: b.child_id,
          nomName: nom?.name || '(невідомо)',
          nomType: nom?.type || 'part',
          nomUnit: nom?.unit || 'шт',
          group: b.group_label || autoClassify(nom),
          qty: b.quantity_per_parent ?? 1
        }
      }))
    } else {
      setRows([])
    }
    lastLoadedParentId.current = parentId
  }, [parentId])

  const addRow = () => setRows(prev => [...prev, { nomId: null, nomName: '', nomType: 'part', nomUnit: 'шт', group: 'Деталі', qty: 1 }])

  const updateRow = (idx, patch) => setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))
  const removeRow = (idx) => setRows(prev => prev.filter((_, i) => i !== idx))

  const handleSave = async () => {
    if (!parentId) return alert('Оберіть виріб-батько')
    const invalidRows = rows.filter(r => !r.nomId)
    if (invalidRows.length > 0) return alert(`${invalidRows.length} рядків без прив'язки до номенклатури. Оберіть позиції або видаліть порожні рядки.`)
    if (rows.length === 0) return alert('Додайте хоча б одну позицію до специфікації')

    setSaving(true)
    try {
      let activeParentId = parentId

      if (parentId === 'temp-new') {
        const nextCode = (nomenclatures || []).reduce((max, it) => {
          const num = parseInt(String(it.code || '').replace(/\D/g, ''))
          return !isNaN(num) && num > max ? num : max
        }, 90000) + 1

        const payloadParent = { 
          code: `V2-${nextCode}`,
          name: (pendingParent?.name || '').trim(), 
          group_id: 'grp_production_frames',
          unit: 'шт',
          rule_type: 'full_frame',
          rule_params: pendingParent?.material_type ? { material_type: pendingParent.material_type } : {},
          status: 'active'
        }
        const { data: newParent, error: parentErr } = await supabase
          .from('nomenclatures_v2')
          .insert([payloadParent])
          .select()
          .single()
        if (parentErr) throw parentErr
        
        activeParentId = newParent.id

        await supabase.from('nomenclatures').upsert([{
          id: newParent.id,
          name: newParent.name,
          code: newParent.code || '',
          unit: newParent.unit || 'шт',
          type: 'product',
          status: 'active'
        }], { onConflict: 'id' })
      } else if (pendingParent && selectedParent && pendingParent.name.trim() !== selectedParent.name.trim()) {
        const { error: renameErr } = await supabase
          .from('nomenclatures_v2')
          .update({ name: pendingParent.name.trim() })
          .eq('id', activeParentId)
        if (renameErr) throw renameErr
      }

      // Aggregate duplicate child_ids
      const agg = {}
      rows.forEach(r => {
        if (!agg[r.nomId]) agg[r.nomId] = { ...r, qty: Number(r.qty) || 1 }
        else agg[r.nomId].qty += Number(r.qty) || 1
      })
      const payloadWithGroup = Object.values(agg).map(r => ({
        parent_id: activeParentId,
        child_id: r.nomId,
        quantity_per_parent: r.qty,
        group_label: r.group
      }))
      const payloadNoGroup = Object.values(agg).map(r => ({
        parent_id: activeParentId,
        child_id: r.nomId,
        quantity_per_parent: r.qty
      }))

      // Verify that components still exist before replacing the old BOM.
      const childIds = Object.keys(agg)
      const { data: existingV2 } = await supabase.from('nomenclatures_v2').select('id').in('id', childIds)
      const { data: existingV1 } = await supabase.from('nomenclatures').select('id').in('id', childIds)
      const existingSet = new Set([
        ...(existingV2 || []).map(n => String(n.id)),
        ...(existingV1 || []).map(n => String(n.id))
      ])

      const missingRows = Object.values(agg).filter(r => !existingSet.has(String(r.nomId)))
      if (missingRows.length > 0) {
        const missingNames = missingRows.map(r => r.nomName || r.nomId).join(', ')
        throw new Error(`Не знайдено номенклатуру: ${missingNames}. Оновіть сторінку та виберіть ці позиції повторно.`)
      }

      // Sync activeParentId and all childIds to nomenclatures table so foreign key constraints on bom_items are 100% satisfied
      const idsToSync = Array.from(new Set([activeParentId, ...childIds].map(String)))

      // 1. Fetch DB V2 items for these IDs to guarantee we have authoritative records
      const { data: dbV2Items } = await supabase
        .from('nomenclatures_v2')
        .select('*')
        .in('id', idsToSync)

      const syncPayloadMap = new Map()

      if (dbV2Items && dbV2Items.length > 0) {
        dbV2Items.forEach(v => {
          syncPayloadMap.set(String(v.id), {
            id: v.id,
            name: v.name,
            code: v.code || '',
            unit: v.unit || 'шт',
            type: (String(v.id) === String(activeParentId) || v.type === 'product' || v.type === 'assembly') ? 'product' : 'part',
            status: v.status || 'active'
          })
        })
      }

      // 2. Add local memory items if any ID was missing from DB V2 response
      const allKnownNoms = [...(rawNoms || []), ...(nomenclatures || [])]
      if (selectedParent) allKnownNoms.push(selectedParent)

      idsToSync.forEach(id => {
        if (!syncPayloadMap.has(id)) {
          const found = allKnownNoms.find(n => String(n.id) === id)
          if (found) {
            syncPayloadMap.set(id, {
              id: found.id,
              name: found.name,
              code: found.code || '',
              unit: found.unit || 'шт',
              type: (id === String(activeParentId) || found.type === 'product' || found.type === 'assembly') ? 'product' : 'part',
              status: 'active'
            })
          }
        }
      })

      // 3. Absolute fallback: if activeParentId is STILL missing, construct fallback item from pendingParent / selectedParent
      if (!syncPayloadMap.has(String(activeParentId))) {
        const pName = selectedParent?.name || pendingParent?.name || 'Виріб V2'
        syncPayloadMap.set(String(activeParentId), {
          id: activeParentId,
          name: pName,
          code: `V2-${String(activeParentId).substring(0, 8)}`,
          unit: 'шт',
          type: 'product',
          status: 'active'
        })
      }

      const syncPayload = Array.from(syncPayloadMap.values())
      if (syncPayload.length > 0) {
        const { error: syncErr } = await supabase.from('nomenclatures').upsert(syncPayload, { onConflict: 'id' })
        if (syncErr) {
          console.warn('Sync to nomenclatures error:', syncErr.message)
        }
      }

      const { error: deleteBomErr } = await supabase.from('bom_items').delete().eq('parent_id', activeParentId)
      if (deleteBomErr) throw deleteBomErr
      if (payloadWithGroup.length > 0) {
        // Try with group_label first; fall back without it if column doesn't exist
        const { error: err1 } = await supabase.from('bom_items').insert(payloadWithGroup)
        if (err1) {
          if (err1.message && err1.message.includes('group_label')) {
            // Column doesn't exist yet — save without it
            const { error: err2 } = await supabase.from('bom_items').insert(payloadNoGroup)
            if (err2) throw err2
          } else {
            throw err1
          }
        }
      }
      
      await refreshTable('nomenclatures')
      await refreshTable('bom_items')
      
      setPendingParent(null)
      setParentId(activeParentId)
      lastLoadedParentId.current = activeParentId
      
      alert(`✅ Специфікацію збережено! (${payloadWithGroup.length} позицій)`)
    } catch (e) { alert('Помилка: ' + e.message) }
    finally { setSaving(false) }
  }

  // Catalog: group bom_items by parent — show all finished products & assemblies (including empty ones without BOMs)
  
  const catalogParents = useMemo(() => {
    const q = catalogSearch.toLowerCase()
    
    // 1. Get all products and assemblies from nomenclatures
    const productNoms = nomenclatures.filter(n => n.type === 'product' || n.type === 'assembly')
    
    // 2. Include any additional parent IDs from bomItems
    const knownNomIds = new Set(productNoms.map(n => String(n.id)))
    bomItems.forEach(b => {
      if (!knownNomIds.has(String(b.parent_id))) {
        const found = nomenclatures.find(n => String(n.id) === String(b.parent_id))
        if (found) {
          productNoms.push(found)
          knownNomIds.add(String(found.id))
        }
      }
    })

    // 3. De-duplicate by normalized name so historical duplicate DB rows merge into single clean catalog entries
    const mapByName = new Map()
    productNoms.forEach(nom => {
      const normName = (nom.name || '').trim().toLowerCase()
      if (!normName) return
      
      const children = bomItems.filter(b => String(b.parent_id) === String(nom.id))
      const existing = mapByName.get(normName)

      if (!existing) {
        mapByName.set(normName, { nom, children })
      } else {
        // If current entry has children (BOM items) and existing doesn't, prefer current entry with children
        if (children.length > 0 && existing.children.length === 0) {
          mapByName.set(normName, { nom, children })
        }
      }
    })

    const uniqueParents = Array.from(mapByName.values())

    return uniqueParents
      .filter(p => {
        if (!p.nom) return false
        const t = p.nom.type
        if (t && t !== 'product' && t !== 'assembly') return false
        if (q && !p.nom.name.toLowerCase().includes(q)) return false
        return true
      })
      .sort((a, b) => {
        // Empty specifications (0 children) appear FIRST at the top!
        const aEmpty = a.children.length === 0 ? 0 : 1
        const bEmpty = b.children.length === 0 ? 0 : 1
        if (aEmpty !== bEmpty) return aEmpty - bEmpty
        return a.nom.name.localeCompare(b.nom.name)
      })
  }, [bomItems, nomenclatures, catalogSearch])

const getItemFolderKey = (nom) => {
    if (!nom) return 'grp_production_frames'
    const gId = nom.group_id
    const name = (nom.name || '').toLowerCase()
    const cat = (nom.category || '').toLowerCase()
    if (gId === 'grp_test_samples' || cat.includes('тестов') || name.includes('тестовий') || name.includes('тест')) {
      return 'grp_test_samples'
    }
    if (nom.type === 'assembly' || gId === 'grp_assemblies' || cat.includes('вузол')) {
      return 'grp_assemblies'
    }
    return 'grp_production_frames'
  }

  const folderCounts = useMemo(() => {
    const counts = { all: catalogParents.length, grp_production_frames: 0, grp_test_samples: 0, grp_assemblies: 0 }
    catalogParents.forEach(({ nom }) => {
      const key = getItemFolderKey(nom)
      counts[key] = (counts[key] || 0) + 1
    })
    return counts
  }, [catalogParents])

  const filteredCatalogParents = useMemo(() => {
    if (catalogFolder === 'all') return catalogParents
    return catalogParents.filter(({ nom }) => getItemFolderKey(nom) === catalogFolder)
  }, [catalogParents, catalogFolder])

  

  const TYPE_COLORS = { product: '#d97706', part: '#2563eb', raw: '#059669', consumable: '#dc2626', assembly: '#7c3aed' }
  const TYPE_LABELS = { product: 'Виріб', part: 'Деталь', raw: 'Сировина', consumable: 'Метиз', assembly: 'Вузол' }

  // Group rows for preview
  const groupedRows = useMemo(() => {
    const groups = {}
    rows.forEach((r, idx) => {
      const g = r.nomId ? (r.group || 'Деталі') : 'Нові рядки'
      if (!groups[g]) groups[g] = []
      groups[g].push({ ...r, _idx: idx })
    })
    return groups
  }, [rows])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {showNomCreate && (
        <NomCreateModal
          supabase={supabase}
          refreshTable={refreshTable}
          prefilledName={parentSearch}
          defaultGroupId={nomCreateDefaultGroup || 'grp_production_frames'}
          onClose={() => { setShowNomCreate(false); setNomCreateDefaultGroup(null); }}
          onCreated={(newItem) => {
            if (newItem && newItem.id) {
              setParentId(newItem.id);
              setPendingParent(null);
              setParentSearch('');
              setRows([]);
            }
            setShowNomCreate(false);
            setNomCreateDefaultGroup(null);
          }}
        />
      )}

      {showParentCreate && (
        <ParentCreateModal 
          initialType={parentCreateType} 
          prefilledName={parentSearch}
          onClose={() => setShowParentCreate(false)} 
          onCreated={(data) => {
            setPendingParent(data);
            setParentId('temp-new');
            setParentSearch('');
            setRows([]);
          }} 
        />
      )}

      {/* Header */}
      <div style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #cbd5e1)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', borderRadius: '20px', padding: '25px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <BookOpen size={24} color="#818cf8" />
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900, color: 'var(--text-main, #0f172a)' }}>Конструктор специфікацій BOM</h2>
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>Створюйте та редагуйте специфікації (Bill of Materials) безпосередньо в системі</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {viewMode === 'dossier' && (
            <button
              onClick={() => { setViewMode('catalog'); setDossierParentId(null) }}
              style={{ padding: '10px 20px', background: 'var(--button-bg, #f1f5f9)', color: 'var(--text-secondary, #334155)', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <ArrowLeft size={15}/> До списку
            </button>
          )}
          <button
            onClick={() => { setViewMode('editor'); setDossierParentId(null) }}
            style={{ padding: '10px 20px', background: viewMode === 'editor' ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--button-bg, #f1f5f9)', color: viewMode === 'editor' ? '#ffffff' : 'var(--text-secondary, #334155)', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Edit2 size={15}/> Конструктор
          </button>
          <button
            onClick={() => { setViewMode('catalog'); setDossierParentId(null) }}
            style={{ padding: '10px 20px', background: viewMode === 'catalog' ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--button-bg, #f1f5f9)', color: viewMode === 'catalog' ? '#ffffff' : 'var(--text-secondary, #334155)', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Layers size={15}/> Каталог ({catalogParents.length})
          </button>
          <button
            onClick={() => setShowNomCreate(true)}
            style={{ padding: '10px 20px', background: 'rgba(16, 185, 129, 0.1)', color: '#059669', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={15}/> Нова номенклатура
          </button>
        </div>
      </div>

      {/* Inline Operations modal widget */}
      {activeInlinePart && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#0d0d0d', border: '1px solid #2a2a5a', borderRadius: '24px', width: '100%', maxWidth: '680px', padding: '30px', boxShadow: '0 20px 50px rgba(0,0,0,0.8)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #1a1a2e', paddingBottom: '15px' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#6366f1', fontWeight: 900, textTransform: 'uppercase' }}>Операції для деталі</span>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '1.2rem', fontWeight: 900, color: '#fff' }}>{activeInlinePart.name}</h3>
              </div>
              <button onClick={() => { setActiveInlinePart(null); setSelectedMachine('') }} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer' }}><X size={22}/></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '0.7rem', color: '#666', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Оберіть верстат</label>
                <select value={selectedMachine} onChange={e => setSelectedMachine(e.target.value)} style={{ width: '100%', padding: '12px', background: '#111', border: '1px solid #222', color: '#fff', borderRadius: '10px', fontSize: '0.9rem' }}>
                  <option value="">-- Оберіть тип верстата --</option>
                  {MACHINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {selectedMachine && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {/* Render inputs side1 */}
                    <div style={{ flex: 1, minWidth: '180px', background: '#0a0a0a', padding: '12px', borderRadius: '12px', border: '1px solid #111' }}>
                      <h5 style={{ margin: '0 0 8px 0', fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>1 сторона</h5>
                      {side1Ops.map((op, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                          <input value={op} onChange={e => { const copy = [...side1Ops]; copy[idx] = e.target.value; setSide1Ops(copy) }} style={{ flex: 1, padding: '6px', background: '#000', border: '1px solid #222', color: '#fff', borderRadius: '6px', fontSize: '0.75rem' }} />
                          <button onClick={() => setSide1Ops(side1Ops.filter((_, i) => i !== idx))} style={{ background: '#7f1d1d', border: 'none', color: '#fff', borderRadius: '6px', padding: '0 8px', cursor: 'pointer' }}><Trash2 size={12}/></button>
                        </div>
                      ))}
                      <button onClick={() => setSide1Ops([...side1Ops, ''])} style={{ width: '100%', padding: '5px', background: 'transparent', border: '1px dashed #222', color: '#3b82f6', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem' }}>+ Додати</button>
                    </div>

                    {/* Render inputs side2 F2 */}
                    <div style={{ flex: 1, minWidth: '180px', background: '#0a0a0a', padding: '12px', borderRadius: '12px', border: '1px solid #111' }}>
                      <h5 style={{ margin: '0 0 8px 0', fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>2 сторона (Ф2)</h5>
                      {side2OpsF2.map((op, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                          <input value={op} onChange={e => { const copy = [...side2OpsF2]; copy[idx] = e.target.value; setSide2OpsF2(copy) }} style={{ flex: 1, padding: '6px', background: '#000', border: '1px solid #222', color: '#fff', borderRadius: '6px', fontSize: '0.75rem' }} />
                          <button onClick={() => setSide2OpsF2(side2OpsF2.filter((_, i) => i !== idx))} style={{ background: '#7f1d1d', border: 'none', color: '#fff', borderRadius: '6px', padding: '0 8px', cursor: 'pointer' }}><Trash2 size={12}/></button>
                        </div>
                      ))}
                      <button onClick={() => setSide2OpsF2([...side2OpsF2, ''])} style={{ width: '100%', padding: '5px', background: 'transparent', border: '1px dashed #333', color: '#3b82f6', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem' }}>+ Додати</button>
                    </div>

                    {/* Render inputs side2 F1.5 */}
                    <div style={{ flex: 1, minWidth: '180px', background: '#0a0a0a', padding: '12px', borderRadius: '12px', border: '1px solid #111' }}>
                      <h5 style={{ margin: '0 0 8px 0', fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>2 сторона (Ф1.5)</h5>
                      {side2OpsF15.map((op, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                          <input value={op} onChange={e => { const copy = [...side2OpsF15]; copy[idx] = e.target.value; setSide2OpsF15(copy) }} style={{ flex: 1, padding: '6px', background: '#000', border: '1px solid #222', color: '#fff', borderRadius: '6px', fontSize: '0.75rem' }} />
                          <button onClick={() => setSide2OpsF15(side2OpsF15.filter((_, i) => i !== idx))} style={{ background: '#7f1d1d', border: 'none', color: '#fff', borderRadius: '6px', padding: '0 8px', cursor: 'pointer' }}><Trash2 size={12}/></button>
                        </div>
                      ))}
                      <button onClick={() => setSide2OpsF15([...side2OpsF15, ''])} style={{ width: '100%', padding: '5px', background: 'transparent', border: '1px dashed #333', color: '#3b82f6', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem' }}>+ Додати</button>
                    </div>

                    {/* Render inputs side2cut F2 */}
                    <div style={{ flex: 1, minWidth: '180px', background: '#0a0a0a', padding: '12px', borderRadius: '12px', border: '1px solid #111' }}>
                      <h5 style={{ margin: '0 0 8px 0', fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>Вирізка (Ф2)</h5>
                      {side2CutOpsF2.map((op, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                          <input value={op} onChange={e => { const copy = [...side2CutOpsF2]; copy[idx] = e.target.value; setSide2CutOpsF2(copy) }} style={{ flex: 1, padding: '6px', background: '#000', border: '1px solid #222', color: '#fff', borderRadius: '6px', fontSize: '0.75rem' }} />
                          <button onClick={() => setSide2CutOpsF2(side2CutOpsF2.filter((_, i) => i !== idx))} style={{ background: '#7f1d1d', border: 'none', color: '#fff', borderRadius: '6px', padding: '0 8px', cursor: 'pointer' }}><Trash2 size={12}/></button>
                        </div>
                      ))}
                      <button onClick={() => setSide2CutOpsF2([...side2CutOpsF2, ''])} style={{ width: '100%', padding: '5px', background: 'transparent', border: '1px dashed #333', color: '#3b82f6', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem' }}>+ Додати</button>
                    </div>

                    {/* Render inputs side2cut F1.5 */}
                    <div style={{ flex: 1, minWidth: '180px', background: '#0a0a0a', padding: '12px', borderRadius: '12px', border: '1px solid #111' }}>
                      <h5 style={{ margin: '0 0 8px 0', fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>Вирізка (Ф1.5)</h5>
                      {side2CutOpsF15.map((op, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                          <input value={op} onChange={e => { const copy = [...side2CutOpsF15]; copy[idx] = e.target.value; setSide2CutOpsF15(copy) }} style={{ flex: 1, padding: '6px', background: '#000', border: '1px solid #222', color: '#fff', borderRadius: '6px', fontSize: '0.75rem' }} />
                          <button onClick={() => setSide2CutOpsF15(side2CutOpsF15.filter((_, i) => i !== idx))} style={{ background: '#7f1d1d', border: 'none', color: '#fff', borderRadius: '6px', padding: '0 8px', cursor: 'pointer' }}><Trash2 size={12}/></button>
                        </div>
                      ))}
                      <button onClick={() => setSide2CutOpsF15([...side2CutOpsF15, ''])} style={{ width: '100%', padding: '5px', background: 'transparent', border: '1px dashed #333', color: '#3b82f6', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem' }}>+ Додати</button>
                    </div>

                    {/* Render cutters */}
                    {renderCutterListEditor(inlineCuttersList, setInlineCuttersList)}
                  </div>

                  <button onClick={handleSaveInlineOps} disabled={savingOps} style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem', marginTop: '10px' }}>
                    {savingOps ? 'Збереження...' : 'Зберегти операції'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {viewMode === 'editor' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Parent product selector */}
          <div style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #cbd5e1)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', fontWeight: 900, textTransform: 'uppercase', display: 'block' }}>Крок 1: Оберіть або Створіть виріб-батько</label>
              <button
                onClick={() => {
                  setNomCreateDefaultGroup('grp_production_frames');
                  setShowNomCreate(true);
                }}
                style={{
                  padding: '8px 16px',
                  background: 'linear-gradient(135deg, #ff9000 0%, #ea580c 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: 900,
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(234, 88, 12, 0.25)'
                }}
              >
                <Sparkles size={15} /> + Створити новий виріб (Конструктор ERP)
              </button>
            </div>
            <div style={{ position: 'relative', maxWidth: '600px' }}>
              <input
                value={parentId ? (pendingParent ? pendingParent.name : (selectedParent ? selectedParent.name : "")) : parentSearch}
                placeholder="Введіть назву або почніть пошук..."
                onChange={e => {
                  const val = e.target.value
                  if (parentId === 'temp-new') {
                    setPendingParent(prev => ({ ...prev, name: val }))
                  } else if (parentId) {
                    if (!pendingParent && selectedParent) {
                      setPendingParent({ ...selectedParent })
                    }
                    setPendingParent(prev => ({ ...prev, name: val }))
                  } else {
                    setParentSearch(val)
                    setShowParentDrop(true)
                  }
                }}
                onFocus={() => { if (!parentId) setShowParentDrop(true) }}
                onBlur={() => { if (!parentId) setTimeout(() => setShowParentDrop(false), 180) }}
                style={{ width: '100%', padding: '12px 16px', background: 'var(--input-bg, #ffffff)', border: '1px solid var(--border-color, #cbd5e1)', color: '#fff', borderRadius: '10px', fontSize: '0.95rem', fontWeight: 600, boxSizing: 'border-box' }}
              />
              {selectedParent && (
                <button onClick={() => { setParentId(''); setPendingParent(null); setParentSearch(''); setRows([]) }} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#555', cursor: 'pointer' }}><X size={16}/></button>
              )}
              {showParentDrop && !selectedParent && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#111', border: '1px solid #ff9000', borderRadius: '12px', zIndex: 9999, maxHeight: '300px', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.8)', marginTop: '5px' }}>
                  {productNoms.length === 0 ? (
                    <div style={{ padding: '16px', color: 'var(--text-muted, #64748b)', fontSize: '0.85rem', textAlign: 'center' }}>
                      <p style={{ margin: '0 0 10px 0' }}>Не знайдено виробів з назвою «{parentSearch}»</p>
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setNomCreateDefaultGroup('grp_production_frames');
                          setShowNomCreate(true);
                          setShowParentDrop(false);
                        }}
                        style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #ff9000, #ea580c)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Sparkles size={14} /> + Створити через Конструктор ERP
                      </button>
                    </div>
                  ) : (
                    <>
                      {productNoms.map(n => (
                        <div
                          key={n.id}
                          onMouseDown={() => { setParentId(n.id); setParentSearch(''); setShowParentDrop(false) }}
                          style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1a1a1a', transition: 'background 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#1a1a2e'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{n.name}</span>
                          <span style={{ fontSize: '0.65rem', color: TYPE_COLORS[n.type] || '#888', fontWeight: 900, background: (TYPE_COLORS[n.type] || '#555') + '22', padding: '2px 8px', borderRadius: '20px' }}>{TYPE_LABELS[n.type] || n.type}</span>
                        </div>
                      ))}
                      <div style={{ padding: '10px 16px', borderTop: '1px solid #1a1a1a', background: '#0a0a0a', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: '#555', marginRight: '8px' }}>Не знайшли виріб?</span>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setNomCreateDefaultGroup('grp_production_frames');
                            setShowNomCreate(true);
                            setShowParentDrop(false);
                          }}
                          style={{ padding: '6px 12px', background: 'rgba(255,144,0,0.15)', border: '1px solid rgba(255,144,0,0.3)', color: '#ff9000', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Sparkles size={13} /> + Створити «{parentSearch}» через Конструктор ERP
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Quick action bar under search field */}
            {!selectedParent && parentSearch.trim().length > 0 && (
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>Створити нову номенклатуру:</span>
                <button
                  onClick={() => {
                    setNomCreateDefaultGroup('grp_production_frames');
                    setShowNomCreate(true);
                  }}
                  style={{ padding: '6px 14px', background: 'rgba(255,144,0,0.15)', border: '1px solid rgba(255,144,0,0.3)', color: '#ff9000', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                >
                  <Sparkles size={14} /> Створити в Конструкторі ERP («{parentSearch}»)
                </button>
              </div>
            )}

            {selectedParent && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                <Package size={14} color="#818cf8"/>
                <span style={{ fontSize: '0.8rem', color: '#818cf8', fontWeight: 700 }}>{selectedParent.name}</span>
                <span style={{ fontSize: '0.65rem', color: '#555' }}>ID: {selectedParent.id}</span>
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  background: selectedParent.type === 'product' ? 'rgba(245,158,11,0.15)' : 'rgba(167,139,250,0.15)',
                  color: selectedParent.type === 'product' ? '#f59e0b' : '#a78bfa',
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}>
                  {selectedParent.type === 'product' ? 'Готовий Виріб' : 'Вузол збірки'}
                </span>
                {bomItems.filter(b => String(b.parent_id) === String(parentId)).length > 0 && (
                  <span style={{ fontSize: '0.7rem', background: '#1a2a1a', color: '#34d399', padding: '2px 10px', borderRadius: '20px', fontWeight: 700 }}>
                    ✓ Вже має {bomItems.filter(b => String(b.parent_id) === String(parentId)).length} позицій (редагування)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* BOM Rows */}
          <div style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #cbd5e1)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', borderRadius: '16px' }}>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 120px 90px 28px', gap: '8px', padding: '10px 10px', background: '#111', borderBottom: '1px solid #1a1a1a' }}>
              <span style={{ fontSize: '0.65rem', color: '#444', fontWeight: 900, textAlign: 'center' }}>№</span>
              <span style={{ fontSize: '0.65rem', color: '#444', fontWeight: 900 }}>ПОЗИЦІЯ / НОМЕНКЛАТУРА</span>
              <span style={{ fontSize: '0.65rem', color: '#444', fontWeight: 900 }}>ГРУПА</span>
              <span style={{ fontSize: '0.65rem', color: '#444', fontWeight: 900, textAlign: 'right' }}>К-СТЬ</span>
              <span/>
            </div>

            {/* Rows grouped */}
            {rows.length === 0 ? (
              <div style={{ padding: '50px', textAlign: 'center', color: '#2a2a2a' }}>
                <Layers size={48} style={{ marginBottom: '15px', opacity: 0.3 }}/>
                <p style={{ fontSize: '0.9rem', fontWeight: 700 }}>Специфікація порожня</p>
                <p style={{ fontSize: '0.8rem', color: '#2a2a2a' }}>Натисніть «+ Додати позицію» щоб почати</p>
              </div>
            ) : (
              <div style={{ padding: '8px' }}>
                {Object.entries(groupedRows)
                   .sort(([aName], [bName]) => {
                     const order = ['Деталі', 'Метизи', 'Накладки', 'Гума/Пластик', '3D-друк', 'Фурнітура', 'Комплектуючі', 'Інше', 'Нові рядки']
                     const aIdx = order.indexOf(aName)
                     const bIdx = order.indexOf(bName)
                     return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx)
                   })
                   .map(([groupName, groupRows]) => (
                  <div key={groupName} style={{ marginBottom: '12px' }}>
                    <div style={{
                      fontSize: '0.65rem',
                      color: groupName === 'Нові рядки' ? '#a78bfa' : '#555',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      padding: '6px 10px',
                      letterSpacing: '0.08em'
                    }}>
                      — {groupName} ({groupRows.length}) —
                    </div>
                    {groupRows.map(r => (
                      <BomRow
                        key={r._idx}
                        row={r}
                        idx={r._idx}
                        nomenclatures={nomenclatures}
                        bomItems={bomItems}
                        onUpdate={updateRow}
                        onRemove={removeRow}
                        supabase={supabase}
                        refreshTable={refreshTable}
                        onExpandAssembly={(assemblyId, parentQty) => {
                          const capturedIdx = r._idx
                          const subs = bomItems.filter(b =>
                            String(b.parent_id) === String(assemblyId) &&
                            String(b.child_id) !== String(assemblyId)
                          )
                          if (subs.length === 0) return alert('Цей вузол не містить деталей у специфікації')
                          const newRows = subs.map(s => {
                            const subNom = nomenclatures.find(n => String(n.id) === String(s.child_id))
                            return {
                              nomId: s.child_id,
                              nomName: subNom ? subNom.name : 'Деталь',
                              nomType: subNom ? subNom.type : 'part',
                              qty: (s.quantity_per_parent || 1) * parentQty,
                              group: s.group_label || (subNom ? autoClassify(subNom) : 'Деталі')
                            }
                          })
                          setRows(prev => {
                            const copy = [...prev]
                            copy.splice(capturedIdx, 1, ...newRows)
                            return copy
                          })
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Footer actions */}
            <div style={{ display: 'flex', gap: '10px', padding: '12px', borderTop: '1px solid #1a1a1a', background: '#0a0a0a' }}>
              <button
                onClick={addRow}
                style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px dashed #2a2a2a', color: '#4a4a6a', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.color = '#a78bfa' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#4a4a6a' }}
              >
                <Plus size={16}/> Додати позицію
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !parentId || rows.length === 0}
                style={{ padding: '10px 28px', background: saving ? '#1a1a1a' : 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 900, cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', opacity: (!parentId || rows.length === 0) ? 0.4 : 1, transition: 'opacity 0.2s' }}
              >
                <Save size={16}/> {saving ? 'Збереження...' : 'Зберегти специфікацію'}
              </button>
            </div>
          </div>
        </div>
      ) : viewMode === 'dossier' && dossierParentId ? (
        /* ── DOSSIER VIEW ── */
        (() => {
          const dossierParent = nomenclatures.find(n => n.id === dossierParentId)
          const dossierChildren = bomItems.filter(b => String(b.parent_id) === String(dossierParentId))
          const GROUP_ORDER = ['Деталі', 'Накладки', 'Метизи', 'Гума/Пластик', '3D-друк', 'Фурнітура', 'Комплектуючі', 'Інше']
          const GROUP_COLORS = {
            'Деталі': '#60a5fa', 'Накладки': '#a78bfa', 'Метизи': '#f59e0b',
            'Гума/Пластик': '#34d399', '3D-друк': '#f87171', 'Фурнітура': '#fb923c',
            'Комплектуючі': '#38bdf8', 'Інше': '#888'
          }
          const grouped = {}
          dossierChildren.forEach(b => {
            const childNom = nomenclatures.find(n => String(n.id) === String(b.child_id))
            const g = b.group_label || autoClassify(childNom)
            if (!grouped[g]) grouped[g] = []
            grouped[g].push(b)
          })
          const sortedGroups = Object.keys(grouped).sort((a, b) => {
            const ai = GROUP_ORDER.indexOf(a), bi = GROUP_ORDER.indexOf(b)
            if (ai === -1 && bi === -1) return a.localeCompare(b)
            if (ai === -1) return 1
            if (bi === -1) return -1
            return ai - bi
          })
          let globalIdx = 0

          return (
            <div className="dossier-print-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', width: '100%' }}>
              <div className="no-print" style={{ width: '100%', maxWidth: '800px', background: '#0d0d14', border: '1px solid #1a1a2e', borderRadius: '18px', padding: '20px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#6366f1', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Досьє на виріб</span>
                  <h3 style={{ margin: '4px 0 0 0', fontSize: '1.4rem', fontWeight: 900, color: '#e0e7ff' }}>{dossierParent?.name}</h3>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => window.print()}
                    style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                  >
                    Друк специфікації
                  </button>
                  <button
                    onClick={() => { setParentId(dossierParentId); setViewMode('editor') }}
                    style={{ padding: '8px 16px', background: 'rgba(99,102,241,0.1)', border: '1px solid #6366f133', color: '#818cf8', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Edit2 size={13}/> Редагувати
                  </button>
                  <button
                    onClick={() => { setViewMode('catalog'); setDossierParentId(null) }}
                    style={{ padding: '8px 16px', background: '#111', border: '1px solid #222', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                  >
                    Назад
                  </button>
                </div>
              </div>

              {/* Dossier Card (Designed as A4 sheet mockup) */}
              <div className="dossier-a4-sheet" style={{ width: '100%', maxWidth: '800px', background: '#0e0e11', border: '1px solid #222', borderRadius: '8px', padding: '40px', boxSizing: 'border-box', boxShadow: '0 15px 35px rgba(0,0,0,0.5)', position: 'relative', color: '#fff' }}>
                
                {/* Dossier Header Info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #333', paddingBottom: '20px', marginBottom: '25px' }}>
                  <div>
                    <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>{dossierParent?.name}</h1>
                    <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#666', fontWeight: 600 }}>СПЕЦИФІКАЦІЯ ВИРОБУ / BILL OF MATERIALS</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 800 }}>СИСТЕМА CENTRUM MES</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', marginTop: '4px', fontFamily: 'monospace' }}>ID: {dossierParent?.id?.substring(0, 8)}</div>
                    <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '2px' }}>{new Date().toLocaleDateString('uk-UA')}</div>
                  </div>
                </div>

                {/* Main BOM groups list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {sortedGroups.map(grp => {
                    const items = grouped[grp]
                    const grpColor = GROUP_COLORS[grp] || '#888'
                    return (
                      <div key={grp} style={{ pageBreakInside: 'avoid' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: `1px solid ${grpColor}40`, paddingBottom: '6px', marginBottom: '10px' }}>
                          <span style={{ width: '3px', height: '12px', background: grpColor, borderRadius: '1px' }} />
                          <h4 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 900, color: grpColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{grp}</h4>
                          <span style={{ fontSize: '0.65rem', color: '#555', fontWeight: 700 }}>({items.length} поз.)</span>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #222', textAlign: 'left' }}>
                              <th style={{ padding: '6px 8px', color: '#444', fontWeight: 800, width: '30px' }}>№</th>
                              <th style={{ padding: '6px 8px', color: '#444', fontWeight: 800 }}>Найменування</th>
                              <th style={{ padding: '6px 8px', color: '#444', fontWeight: 800, width: '140px' }}>
                                {grp === 'Деталі' ? 'Характеристика' : 'Опис'}
                              </th>
                              <th style={{ padding: '6px 8px', color: '#444', fontWeight: 800, textAlign: 'center', width: '60px' }}>К-сть</th>
                              <th style={{ padding: '6px 8px', color: '#444', fontWeight: 800, textAlign: 'center', width: '40px' }}>Од.</th>
                              <th className="no-print" style={{ padding: '6px 8px', color: '#444', fontWeight: 800, textAlign: 'center', width: '150px' }}>Операції ЧПК</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map(b => {
                              globalIdx++
                              const rowNum = globalIdx
                              const child = nomenclatures.find(n => String(n.id) === String(b.child_id))
                              const existingOps = machineOperations?.filter(o => o.nomenclature_id === b.child_id) || []

                              const subItems = bomItems.filter(sb => String(sb.parent_id) === String(b.child_id))

                              return (
                                <tr key={b.child_id} style={{ borderBottom: '1px solid #141416' }}>
                                  <td style={{ padding: '8px 8px', color: '#444', fontWeight: 700 }}>{rowNum}</td>
                                  <td style={{ padding: '8px 8px', fontWeight: 700, color: '#e2e8f0' }}>
                                    <div>{child?.name || `(ID: ${b.child_id})`}</div>
                                    {child?.type === 'assembly' && subItems.length > 0 && (
                                      <div style={{ marginTop: '5px', paddingLeft: '15px', borderLeft: '2px solid #a78bfa33', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {subItems.map((sb) => {
                                          const sbNom = nomenclatures.find(n => String(n.id) === String(sb.child_id))
                                          const sbOps = machineOperations?.filter(o => o.nomenclature_id === sb.child_id) || []
                                          return (
                                            <div key={sb.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', color: '#a0aec0', flexWrap: 'wrap' }}>
                                              <span style={{ color: '#a78bfa' }}>↳</span>
                                              <span>{sbNom ? sbNom.name : 'Деталь'}</span>
                                              <span style={{ fontWeight: 800, color: '#e2e8f0' }}>x{sb.quantity_per_parent * b.quantity_per_parent}</span>
                                              {sbOps.map(op => {
                                                const mac = machines?.find(m => m.id === op.machine_id)
                                                const rawLbl = op.machine_type || mac?.name || 'CNC'
                                                let lbl = rawLbl
                                                const norm = rawLbl.toLowerCase()
                                                if (norm.includes('1200') || norm.includes('1200x800') || norm.includes('малий')) lbl = 'Малий (1200)'
                                                else if (norm.includes('3050')) lbl = 'Швидкісний (3050)'
                                                else if (norm.includes('3060') || norm.includes('триголовий') || norm.includes('три головий')) lbl = '3-Головий (3060)'
                                                else if (norm.includes('6000') || norm.includes('дракон')) lbl = 'Дракон (6000)'
                                                else if (norm.includes('feya') || norm.includes('ke xin') || norm.includes('фея')) lbl = 'Фея'
                                                else lbl = rawLbl.replace('CNC ', '').substring(0, 12)
                                                return (
                                                  <span key={op.id} style={{ fontSize: '0.55rem', background: '#0f172a', color: '#38bdf8', padding: '0px 4px', borderRadius: '4px', border: '1px solid #0284c744' }}>
                                                    {lbl}
                                                  </span>
                                                )
                                              })}
                                              <button
                                                className="no-print"
                                                onClick={() => setActiveInlinePart({ id: sb.child_id, name: sbNom?.name })}
                                                style={{ padding: '0px 4px', background: 'transparent', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '0.65rem', textDecoration: 'underline', fontWeight: 800 }}
                                              >
                                                Налаштувати ЧПК
                                              </button>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ padding: '8px 8px', color: '#718096', fontSize: '0.75rem' }}>
                                    {grp === 'Деталі' ? (child?.material_type || '—') : (child?.description || '—')}
                                  </td>
                                  <td style={{ padding: '8px 8px', textAlign: 'center', color: '#f59e0b', fontWeight: 800, fontSize: '0.85rem' }}>{b.quantity_per_parent}</td>
                                  <td style={{ padding: '8px 8px', textAlign: 'center', color: '#4a5568', fontSize: '0.75rem' }}>{child?.unit || 'шт'}</td>
                                  <td className="no-print" style={{ padding: '4px 8px', textAlign: 'center' }}>
                                    {(child?.type === 'part' || child?.type === 'assembly') ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
                                        {existingOps.length > 0 ? (
                                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', justifyContent: 'center' }}>
                                            {existingOps.map(op => {
                                              const mac = machines?.find(m => m.id === op.machine_id)
                                              const rawLbl = op.machine_type || mac?.name || 'CNC'
                                              let lbl = rawLbl
                                              const norm = rawLbl.toLowerCase()
                                              if (norm.includes('1200') || norm.includes('1200x800') || norm.includes('малий')) lbl = 'Малий (1200)'
                                              else if (norm.includes('3050')) lbl = 'Швидкісний (3050)'
                                              else if (norm.includes('3060') || norm.includes('триголовий') || norm.includes('три головий')) lbl = '3-Головий (3060)'
                                              else if (norm.includes('6000') || norm.includes('дракон')) lbl = 'Дракон (6000)'
                                              else if (norm.includes('feya') || norm.includes('ke xin') || norm.includes('фея')) lbl = 'Фея'
                                              else lbl = rawLbl.replace('CNC ', '').substring(0, 12)
                                              
                                              return (
                                                <span key={op.id} style={{ fontSize: '0.55rem', background: '#1e3a8a', color: '#93c5fd', padding: '1px 5px', borderRadius: '4px', border: '1px solid #2563eb' }}>
                                                  {lbl}
                                                </span>
                                              )
                                            })}
                                          </div>
                                        ) : (
                                          <span style={{ fontSize: '0.6rem', color: '#444', fontStyle: 'italic' }}>немає</span>
                                        )}
                                        <button
                                          onClick={() => setActiveInlinePart({ id: b.child_id, name: child?.name })}
                                          style={{ padding: '2px 6px', background: '#1e1b4b', border: '1px solid #312e81', color: '#a5b4fc', borderRadius: '4px', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 800, marginTop: '2px' }}
                                        >
                                          ЧПК
                                        </button>
                                      </div>
                                    ) : (
                                      <span style={{ fontSize: '0.65rem', color: '#222' }}>—</span>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                  })}
                </div>

                {/* Dossier Footer Totals */}
                <div style={{ borderTop: '2px solid #333', marginTop: '30px', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#555', fontWeight: 800 }}>СПЕЦИФІКАЦІЯ CENTRUM MES</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-main, #0f172a)', fontWeight: 800 }}>РАЗОМ: {dossierChildren.length} ПОЗИЦІЙ В {sortedGroups.length} ГРУПАХ</div>
                </div>
              </div>

              {/* CSS style block specifically for print formatting */}
              <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                  body { background: #fff !important; color: #000 !important; }
                  .no-print { display: none !important; }
                  .dossier-print-container { width: 100% !important; align-items: start !important; }
                  .dossier-a4-sheet { border: none !important; box-shadow: none !important; padding: 0 !important; width: 100% !important; background: #fff !important; color: #000 !important; }
                  .dossier-a4-sheet h1, .dossier-a4-sheet h4, .dossier-a4-sheet table, .dossier-a4-sheet td, .dossier-a4-sheet th { color: #000 !important; }
                  .dossier-a4-sheet tr { border-bottom: 1px solid #ddd !important; }
                  .dossier-a4-sheet th { border-bottom: 2px solid #000 !important; }
                  .dossier-a4-sheet table { page-break-inside: auto; }
                  .dossier-a4-sheet tr { page-break-inside: avoid; page-break-after: auto; }
                }
              `}} />
            </div>
          )
        })()
      ) : (
        /* ── CATALOG VIEW (FOLDERS STRUCTURE) ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Folder Navigation Pills Bar */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', background: 'var(--card-bg, #ffffff)', padding: '12px 16px', borderRadius: '16px', border: '1px solid var(--border-color, #cbd5e1)', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', marginRight: '6px' }}>Папки v2.0:</span>
            
            <button
              onClick={() => setCatalogFolder('all')}
              style={{
                padding: '7px 14px',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '0.8rem',
                border: '1px solid var(--border-color, #cbd5e1)',
                background: catalogFolder === 'all' ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--button-bg, #f8fafc)',
                color: catalogFolder === 'all' ? '#ffffff' : 'var(--text-main, #0f172a)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s'
              }}
            >
              📁 Усі позиції ({folderCounts.all})
            </button>

            <button
              onClick={() => setCatalogFolder('grp_production_frames')}
              style={{
                padding: '7px 14px',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '0.8rem',
                border: '1px solid var(--border-color, #cbd5e1)',
                background: catalogFolder === 'grp_production_frames' ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--button-bg, #f8fafc)',
                color: catalogFolder === 'grp_production_frames' ? '#ffffff' : 'var(--text-main, #0f172a)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s'
              }}
            >
              🚀 Продакшн ({folderCounts.grp_production_frames})
            </button>

            <button
              onClick={() => setCatalogFolder('grp_test_samples')}
              style={{
                padding: '7px 14px',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '0.8rem',
                border: '1px solid var(--border-color, #cbd5e1)',
                background: catalogFolder === 'grp_test_samples' ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--button-bg, #f8fafc)',
                color: catalogFolder === 'grp_test_samples' ? '#ffffff' : 'var(--text-main, #0f172a)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s'
              }}
            >
              🧪 Тестові зразки ({folderCounts.grp_test_samples})
            </button>

            <button
              onClick={() => setCatalogFolder('grp_assemblies')}
              style={{
                padding: '7px 14px',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '0.8rem',
                border: '1px solid var(--border-color, #cbd5e1)',
                background: catalogFolder === 'grp_assemblies' ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--button-bg, #f8fafc)',
                color: catalogFolder === 'grp_assemblies' ? '#ffffff' : 'var(--text-main, #0f172a)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s'
              }}
            >
              📦 Вузли збірки ({folderCounts.grp_assemblies})
            </button>
          </div>

          {/* Search bar */}
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} size={16}/>
            <input
              value={catalogSearch}
              onChange={e => setCatalogSearch(e.target.value)}
              placeholder="Пошук специфікації за назвою виробу..."
              style={{ width: '100%', padding: '12px 15px 12px 42px', background: 'var(--input-bg, #ffffff)', border: '1px solid var(--border-color, #cbd5e1)', color: 'var(--text-main, #0f172a)', borderRadius: '12px', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>

          {/* Render Items by Folders */}
          {filteredCatalogParents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted, #64748b)' }}>
              <BookOpen size={56} style={{ marginBottom: '15px', opacity: 0.15 }}/>
              <p style={{ fontSize: '1rem', fontWeight: 700 }}>У цій папці специфікацій не знайдено</p>
            </div>
          ) : (() => {
            // Group catalogParents into folder buckets
            const FOLDER_DEFINITIONS = [
              { key: 'grp_production_frames', label: '🚀 Продакшн (Серійні рами)', color: '#d97706', bg: 'rgba(217,119,6,0.06)', border: 'rgba(217,119,6,0.25)' },
              { key: 'grp_test_samples', label: '🧪 Тестові зразки (Прототипи та RND)', color: '#7c3aed', bg: 'rgba(124,58,237,0.06)', border: 'rgba(124,58,237,0.25)' },
              { key: 'grp_assemblies', label: '📦 Вузли збірки (Підвузли)', color: '#2563eb', bg: 'rgba(37,99,235,0.06)', border: 'rgba(37,99,235,0.25)' }
            ]

            const folderMap = {}
            filteredCatalogParents.forEach(item => {
              const fKey = getItemFolderKey(item.nom)
              if (!folderMap[fKey]) folderMap[fKey] = []
              folderMap[fKey].push(item)
            })

            const activeFolders = FOLDER_DEFINITIONS.filter(fd => (folderMap[fd.key] || []).length > 0)

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {activeFolders.map(folder => {
                  const folderItems = folderMap[folder.key] || []
                  const isCollapsed = catalogFolder === 'all' ? collapsedFolders[folder.key] !== false : collapsedFolders[folder.key] === true

                  return (
                    <div 
                      key={folder.key}
                      style={{ 
                        background: 'var(--card-bg, #ffffff)', 
                        border: `1px solid ${folder.border}`, 
                        borderRadius: '18px', 
                        overflow: 'hidden',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.03)'
                      }}
                    >
                      {/* Folder Card Header */}
                      <div 
                        onClick={() => setCollapsedFolders(prev => ({ ...prev, [folder.key]: isCollapsed ? false : true }))}
                        style={{ 
                          padding: '14px 20px', 
                          background: folder.bg, 
                          borderBottom: isCollapsed ? 'none' : `1px solid ${folder.border}`,
                          display: 'flex', 
                          justify: 'space-between', 
                          alignItems: 'center', 
                          cursor: 'pointer',
                          userSelect: 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '1.05rem', fontWeight: 950, color: folder.color }}>{folder.label}</span>
                          <span style={{ fontSize: '0.7rem', fontWeight: 900, background: folder.color, color: '#ffffff', padding: '2px 9px', borderRadius: '12px' }}>
                            {folderItems.length} позицій
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: folder.color, fontWeight: 800, fontSize: '0.8rem' }}>
                          <span>{isCollapsed ? 'Показати' : 'Згорнути'}</span>
                          {isCollapsed ? <ChevronDown size={18} /> : <ChevronRight size={18} style={{ transform: 'rotate(90deg)' }} />}
                        </div>
                      </div>

                      {/* Folder Items List */}
                      {!isCollapsed && (
                        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {folderItems.map(({ nom, children }) => {
                            const isExpanded = expandedParents[nom.id]
                            const isEmpty = children.length === 0

                            return (
                              <div
                                key={nom.id}
                                style={{
                                  background: 'var(--card-bg, #ffffff)',
                                  border: isEmpty ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid var(--border-color, #e2e8f0)',
                                  boxShadow: isEmpty ? '0 4px 16px rgba(239, 68, 68, 0.08)' : '0 2px 10px rgba(0,0,0,0.03)',
                                  borderRadius: '14px',
                                  overflow: 'hidden',
                                  transition: 'all 0.2s'
                                }}
                              >
                                <div
                                  onClick={() => {
                                    if (isEmpty) {
                                      setParentId(nom.id)
                                      setViewMode('editor')
                                    } else {
                                      setDossierParentId(nom.id)
                                      setViewMode('dossier')
                                    }
                                  }}
                                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', cursor: 'pointer', transition: 'background 0.2s' }}
                                  onMouseEnter={e => e.currentTarget.style.background = isEmpty ? 'rgba(239, 68, 68, 0.06)' : 'var(--button-bg, #f8fafc)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                    <Package size={16} color={isEmpty ? '#ef4444' : '#6366f1'} />
                                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main, #0f172a)' }}>{nom.name}</span>
                                    <span style={{ fontSize: '0.65rem', color: TYPE_COLORS[nom.type] || '#888', fontWeight: 900, background: (TYPE_COLORS[nom.type] || '#555') + '22', padding: '2px 8px', borderRadius: '20px' }}>
                                      {TYPE_LABELS[nom.type] || nom.type}
                                    </span>
                                    {isEmpty && (
                                      <span style={{
                                        fontSize: '0.65rem',
                                        color: '#dc2626',
                                        fontWeight: 900,
                                        background: '#fee2e2', 
                                        border: '1px solid #fca5a5',
                                        padding: '3px 10px',
                                        borderRadius: '20px',
                                        letterSpacing: '0.5px',
                                        textTransform: 'uppercase',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px'
                                      }}>
                                        <AlertCircle size={11} /> ПОРОЖНЯ
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ fontSize: '0.75rem', color: isEmpty ? '#dc2626' : 'var(--text-muted, #64748b)', fontWeight: isEmpty ? 900 : 700 }}>
                                      {isEmpty ? '0 позицій (ПОРОЖНЯ)' : `${children.length} позицій`}
                                    </span>

                                    {!isEmpty && (
                                      <button
                                        onClick={e => { e.stopPropagation(); setDossierParentId(nom.id); setViewMode('dossier') }}
                                        style={{ padding: '5px 12px', background: 'rgba(99,102,241,0.1)', border: '1px solid #6366f133', color: '#818cf8', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}
                                      >
                                        <Layers size={11}/> Досьє виробу
                                      </button>
                                    )}

                                    <button
                                      onClick={e => { e.stopPropagation(); setParentId(nom.id); setViewMode('editor') }}
                                      style={{
                                        padding: '6px 14px',
                                        background: isEmpty ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--button-bg, #f1f5f9)',
                                        border: isEmpty ? 'none' : '1px solid var(--border-color, #cbd5e1)',
                                        color: isEmpty ? '#ffffff' : 'var(--text-main, #0f172a)',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '0.7rem',
                                        fontWeight: 900,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px'
                                      }}
                                    >
                                      <Edit2 size={11}/> {isEmpty ? '+ Наповнити специфікацію' : 'Конструктор'}
                                    </button>

                                    <button
                                      onClick={async e => {
                                        e.stopPropagation()
                                        if (!confirm(`Видалити позицію та специфікацію «${nom.name}»?`)) return
                                        try {
                                          await supabase.from('bom_items').delete().eq('parent_id', nom.id)
                                          await supabase.from('nomenclature_catalog_profiles').delete().eq('nomenclature_id', nom.id)
                                          await supabase.from('nomenclatures_v2').delete().eq('id', nom.id)

                                          await refreshTable('bom_items')
                                          await refreshTable('nomenclatures')
                                        } catch (err) {
                                          alert('Помилка видалення: ' + err.message)
                                        }
                                      }}
                                      title="Видалити позицію з системи"
                                      style={{ padding: '5px 8px', background: 'rgba(239,68,68,0.06)', border: '1px solid #ef444420', color: '#ef4444', borderRadius: '6px', cursor: 'pointer' }}
                                    >
                                      <Trash2 size={12}/>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}
      <style dangerouslySetInnerHTML={{ __html: '.anim-spin { animation: spin 1s linear infinite; } @keyframes spin { from{transform:rotate(0deg);} to{transform:rotate(360deg);} }' }} />
    </div>
  )
}

const CutterSettingsTab = () => {
  const { nomenclatures: rawNoms, supabase, refreshTable } = useMES()
  const nomenclatures = useV2NomenclaturesData(supabase)
  const [newCutterName, setNewCutterName] = useState('')
  const [newCutterDiam, setNewCutterDiam] = useState('')
  const [saving, setSaving] = useState(false)
  const [assigningId, setAssigningId] = useState(null)

  // Generic cutter types (nomenclatures where type === 'cutter_type')
  const cutterTypes = useMemo(() => {
    return nomenclatures.filter(n => n.type === 'cutter_type')
  }, [nomenclatures])

  // Physical stock cutters: nomenclatures of type === 'consumable' containing 'фреза' in name (case-insensitive)
  const physicalCutters = useMemo(() => {
    return nomenclatures.filter(n => n.type === 'consumable' && n.name.toLowerCase().includes('фреза'))
  }, [nomenclatures])

  const handleAddCutterType = async (e) => {
    e.preventDefault()
    if (!newCutterName.trim()) return alert('Введіть назву фрези')
    setSaving(true)
    try {
      const payload = {
        name: newCutterName.trim(),
        type: 'cutter_type',
        material_type: newCutterDiam.trim() || null
      }
      const { data, error } = await supabase.from('nomenclatures').insert([payload]).select()
      if (error) throw error
      setNewCutterName('')
      setNewCutterDiam('')
      await refreshTable('nomenclatures')
      alert('Тип фрези створено успішно!')
    } catch (err) {
      alert('Помилка: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCutterType = async (id, name) => {
    if (!confirm(`Ви дійсно бажаєте видалити тип фрези "${name}"?`)) return
    try {
      // Find any physical cutters assigned to it and unassign them
      const assigned = physicalCutters.filter(p => String(p.characteristic) === String(id))
      if (assigned.length > 0) {
        if (!confirm(`Цей тип фрези призначено для ${assigned.length} фізичних фрез. Якщо видалити його, вони стануть не призначеними. Продовжити?`)) return
        for (const cutter of assigned) {
          await supabase.from('nomenclatures').update({ characteristic: null }).eq('id', cutter.id)
        }
      }
      
      const { error } = await supabase.from('nomenclatures').delete().eq('id', id)
      if (error) throw error
      await refreshTable('nomenclatures')
      alert('Тип фрези видалено!')
    } catch (err) {
      alert('Помилка видалення: ' + err.message)
    }
  }

  const handleAssignCutterType = async (physicalId, genericId) => {
    setAssigningId(physicalId)
    try {
      const { error } = await supabase
        .from('nomenclatures_v2')
        .update({ characteristic: genericId || null })
        .eq('id', physicalId)
      if (error) throw error
      await refreshTable('nomenclatures')
    } catch (err) {
      alert('Помилка прив\'язки: ' + err.message)
    } finally {
      setAssigningId(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      {/* Створення типу фрези */}
      <div style={{ background: '#111', padding: '25px', borderRadius: '16px', border: '1px solid #222' }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem', color: '#10b981', fontWeight: 900 }}>✚ Створити новий тип фрези</h3>
        <form onSubmit={handleAddCutterType} style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 2, minWidth: '200px' }}>
            <label style={{ display: 'block', fontSize: '0.7rem', color: '#666', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>Назва фрези в системі</label>
            <input 
              type="text" 
              placeholder="напр. Фреза ф1.5, Фреза ф2, Фреза ф6 (90)" 
              value={newCutterName}
              onChange={e => setNewCutterName(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', background: '#000', border: '1px solid #333', color: '#fff', borderRadius: '8px', fontSize: '0.9rem', outline: 'none' }}
              required
            />
          </div>
          <div style={{ flex: 1, minWidth: '120px' }}>
            <label style={{ display: 'block', fontSize: '0.7rem', color: '#666', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>Діаметр (мм)</label>
            <input 
              type="number" 
              step="any" 
              placeholder="напр. 1.5, 2, 6" 
              value={newCutterDiam}
              onChange={e => setNewCutterDiam(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', background: '#000', border: '1px solid #333', color: '#fff', borderRadius: '8px', fontSize: '0.9rem', outline: 'none' }}
            />
          </div>
          <button 
            type="submit" 
            disabled={saving}
            style={{ padding: '12px 24px', background: 'linear-gradient(135deg, #10b981, #ff6a00)', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 900, cursor: 'pointer', fontSize: '0.85rem' }}
          >
            {saving ? 'Збереження...' : 'Створити'}
          </button>
        </form>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '25px', alignItems: 'start', flexWrap: 'wrap' }}>
        {/* Список типів фрез */}
        <div style={{ background: '#111', padding: '25px', borderRadius: '16px', border: '1px solid #222' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>Типи фрез в системі ({cutterTypes.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {cutterTypes.map(c => {
              const assignedCount = physicalCutters.filter(p => String(p.characteristic) === String(c.id)).length
              return (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0a0a0a', padding: '12px 15px', borderRadius: '10px', border: '1px solid #222' }}>
                  <div>
                    <div style={{ fontWeight: 800, color: '#fff' }}>{c.name}</div>
                    <div style={{ fontSize: '0.72rem', color: '#666', marginTop: '2px' }}>Діаметр: {c.material_type || '—'} мм | Прив'язано фрез: <span style={{ color: '#10b981', fontWeight: 800 }}>{assignedCount}</span></div>
                  </div>
                  <button 
                    onClick={() => handleDeleteCutterType(c.id, c.name)}
                    style={{ background: '#2a0a0a', color: '#ef4444', border: '1px solid #3a1a1a', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
            {cutterTypes.length === 0 && <div style={{ color: '#555', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>Немає типів фрез. Створіть перший вище.</div>}
          </div>
        </div>

        {/* Прив'язка фізичних фрез зі складу */}
        <div style={{ background: '#111', padding: '25px', borderRadius: '16px', border: '1px solid #222' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>Прив'язка фрез зі складу до типів фрез</h3>
          <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '-15px', marginBottom: '20px', lineHeight: 1.4 }}>
            Оберіть для кожної фізичної фрези з бази номенклатур відповідний віртуальний тип фрези в системі. Це дозволить автоматично підбирати відповідні фрези зі складу на виробництві.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '500px', overflowY: 'auto', paddingRight: '5px' }}>
            {physicalCutters.map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0a0a0a', padding: '12px 15px', borderRadius: '10px', border: '1px solid #222', gap: '15px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, color: '#eee', fontSize: '0.85rem' }}>{p.name}</div>
                  <div style={{ fontSize: '0.72rem', color: '#555', marginTop: '2px' }}>Характеристика: {p.material_type || '—'}</div>
                </div>
                <select 
                  value={p.characteristic || ''}
                  onChange={e => handleAssignCutterType(p.id, e.target.value)}
                  disabled={assigningId === p.id}
                  style={{ width: '180px', padding: '8px', background: '#000', border: '1px solid #333', color: p.characteristic ? '#10b981' : '#888', borderRadius: '6px', fontSize: '0.78rem', fontWeight: p.characteristic ? 800 : 500 }}
                >
                  <option value="">-- Не призначено --</option>
                  {cutterTypes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            ))}
            {physicalCutters.length === 0 && <div style={{ color: '#555', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>Не знайдено фрез у базі номенклатур (тип: consumable, назва містить "фреза").</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

const EngineerV2Module = () => {
  const { tasks, orders, nomenclatures: rawNoms, approveEngineer, machineCalls, machines, currentUser, supabase } = useMES()
  const nomenclatures = useV2NomenclaturesData(supabase)
  const isSuperAdmin = currentUser?.login === 'admin@workshop.local' || currentUser?.position === 'Адмін' || currentUser?.access_rights?.director
  const [activeTab, setActiveTab] = useState('tasks')
  
  const pendingTasks = tasks.filter(t => t.status === 'waiting' && !t.engineer_conf && !t.step?.includes('Пресування'))
  const approvedCount = tasks.filter(t => t.status === 'waiting' && t.engineer_conf).length

  const activeCalls = (machineCalls || []).filter(c => 
    c.status === 'pending' && 
    c.called_role === 'engineer' && 
    (!c.called_employee_id || c.called_employee_id === currentUser?.id)
  )

  const handleResolveCall = async (callId) => {
    const resolverName = currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() : 'Інженер ЧПК'
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

  return (
    <div className="engineer-module-v2" style={{ background: '#080808', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <nav className="module-nav" style={{ flexShrink: 0 }}>
        <Link to="/" className="back-link"><ArrowLeft size={18} /> <span className="hide-mobile">На головну</span></Link>
        <div className="module-title-group">
          <Settings className="text-secondary" size={24} />
          <h1 className="hide-mobile">Робоче місце Інженера</h1>
          <h1 className="mobile-only" style={{ fontSize: '1rem' }}>ІНЖЕНЕР</h1>
        </div>
      </nav>

      <div className="module-content" style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
        {activeCalls.length > 0 && (
          <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '16px', padding: '15px 20px', marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '0.85rem', fontWeight: 900, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="pulse-indicator" style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', boxShadow: '0 0 8px #ef4444' }} />
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
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', marginTop: '2px' }}>
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

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setActiveTab('tasks')}
            style={{ padding: '10px 20px', background: activeTab === 'tasks' ? '#3b82f6' : '#111', color: '#fff', border: '1px solid #222', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
          >
            Черга ЧПК ({pendingTasks.length})
          </button>
          {isSuperAdmin && (
            <button 
              onClick={() => setActiveTab('operations')}
              style={{ padding: '10px 20px', background: activeTab === 'operations' ? '#3b82f6' : '#111', color: '#fff', border: '1px solid #222', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
            >
              <Database size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '5px' }} />
              Операції станків
            </button>
          )}
          <button 
            onClick={() => setActiveTab('spec')}
            style={{ padding: '10px 20px', background: activeTab === 'spec' ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : '#111', color: '#fff', border: `1px solid ${activeTab === 'spec' ? '#6366f1' : '#222'}`, borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '7px' }}
          >
            <BookOpen size={15} style={{ display: 'inline' }} />
            Специфікації BOM
          </button>
          <button 
            onClick={() => setActiveTab('import')}
            style={{ padding: '10px 20px', background: activeTab === 'import' ? 'linear-gradient(135deg,#059669,#10b981)' : '#111', color: activeTab === 'import' ? '#fff' : '#aaa', border: `1px solid ${activeTab === 'import' ? '#10b981' : '#222'}`, borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '7px', boxShadow: activeTab === 'import' ? '0 4px 15px rgba(16,185,129,0.25)' : 'none' }}
          >
            <FileUp size={15} style={{ display: 'inline' }} />
            Імпорт CSV
          </button>
          <button 
            onClick={() => setActiveTab('cutters')}
            style={{ padding: '10px 20px', background: activeTab === 'cutters' ? '#3b82f6' : '#111', color: '#fff', border: '1px solid #222', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '7px' }}
          >
            <Sliders size={15} style={{ display: 'inline' }} />
            Налаштування фрез
          </button>
        </div>

        {activeTab === 'tasks' ? (
          <>
            <div className="eng-stats-bar" style={{ display: 'flex', gap: '15px', marginBottom: '25px', overflowX: 'auto', paddingBottom: '10px' }}>
           <div style={{ flex: 1, minWidth: '150px', background: '#111', padding: '15px', borderRadius: '16px', border: '1px solid #222' }}>
              <div style={{ fontSize: '0.65rem', color: '#555', fontWeight: 800, textTransform: 'uppercase' }}>В ЧЕРЗІ ЧПК</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#3b82f6' }}>{pendingTasks.length}</div>
           </div>
           <div style={{ flex: 1, minWidth: '150px', background: '#111', padding: '15px', borderRadius: '16px', border: '1px solid #222' }}>
              <div style={{ fontSize: '0.65rem', color: '#555', fontWeight: 800, textTransform: 'uppercase' }}>ПІДТВЕРДЖЕНО</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#10b981' }}>{approvedCount}</div>
           </div>
           <div className="hide-mobile" style={{ flex: 2, background: 'rgba(59, 130, 246, 0.05)', padding: '15px', borderRadius: '16px', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <AlertCircle size={20} color="#3b82f6" />
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', lineHeight: 1.4 }}>Ваше підтвердження активує кнопки запуску на терміналах операторів верстатів.</p>
           </div>
        </div>

        <div className="eng-grid-layout" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
           {pendingTasks.map(task => {
              const order = orders.find(o => o.id === task.order_id)
              return (
                <div key={task.id} className="eng-task-card glass-panel" style={{ background: '#111', padding: '25px', borderRadius: '24px', border: '1px solid #222', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div className="order-branding">
                         <strong style={{ fontSize: '1.2rem', display: 'block' }}>№{order?.order_num}</strong>
                         <span style={{ fontSize: '0.8rem', color: '#555', fontWeight: 600 }}>{order?.customer}</span>
                      </div>
                      <div style={{ color: '#444', fontSize: '0.75rem', fontWeight: 800 }}><Clock size={12} /> {new Date(task.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                   </div>

                   <div className="spec-review" style={{ background: '#0a0a0a', padding: '15px', borderRadius: '14px', border: '1px solid #1a1a1a' }}>
                      <label style={{ fontSize: '0.6rem', color: '#444', textTransform: 'uppercase', marginBottom: '10px', display: 'block', fontWeight: 900 }}>Програми обробки (ЧПК):</label>
                      {order?.order_items?.map((item, idx) => {
                         const nom = nomenclatures.find(n => n.id === item.nomenclature_id)
                         return (
                           <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                              <FileCode size={16} color="#3b82f6" />
                              <div style={{ flex: 1 }}>
                                 <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{nom?.name}</div>
                                 <div style={{ fontSize: '0.65rem', color: '#3b82f6', fontFamily: 'monospace' }}>{nom?.cnc_program || 'БЕЗ ПРОГРАМИ (CNC_DEFAULT)'}</div>
                              </div>
                           </div>
                         )
                      })}
                   </div>

                   <button 
                     onClick={() => apiService.submitApproveEngineer(task.id, approveEngineer)}
                     style={{ width: '100%', padding: '16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '0.9rem' }}
                   >
                     <ShieldCheck size={20} /> ПІДТВЕРДИТИ ЧПК
                   </button>
                </div>
              )
           })}

           {pendingTasks.length === 0 && (
             <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '80px 20px', color: '#333' }}>
                <CheckCircle2 size={64} style={{ marginBottom: '20px', opacity: 0.1 }} />
                <p style={{ fontSize: '1.2rem', fontWeight: 800 }}>ЧЕРГА ПІДТВЕРДЖЕНЬ ПОРОЖНЯ</p>
                <p style={{ fontSize: '0.9rem' }}>Всі активні наряди успішно опрацьовані інженером</p>
             </div>
           )}
          </div>
          </>
        ) : (activeTab === 'operations' && isSuperAdmin) ? (
          <MachineOperationsTab />
        ) : activeTab === 'import' ? (
          <ImportSpecTab />
        ) : activeTab === 'cutters' ? (
          <CutterSettingsTab />
        ) : (
          <SpecBuilderTab />
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .eng-task-card { transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .eng-task-card:hover { transform: translateY(-5px); border-color: #3b82f6; box-shadow: 0 15px 40px rgba(59, 130, 246, 0.15); }
      `}} />
    </div>
  )
}

export default EngineerV2Module
