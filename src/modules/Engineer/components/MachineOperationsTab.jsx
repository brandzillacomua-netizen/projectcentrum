import React, { useState } from 'react'
import { Upload, Search, Trash2, Plus } from 'lucide-react'
import { useMES } from '../../../MESContext'
import { 
  useV2NomenclaturesData, 
  MACHINE_TYPES, 
  renderCutterListEditorShared, 
  combineOps, 
  autoClassify 
} from '../utils/engineerHelpers.jsx'

export function MachineOperationsTab() {
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
    await refreshTable('machine_operations')
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

          const s2ValF2 = s2ColIdx !== -1 ? parts[s2ColIdx]?.trim() : ""
          const s2ValF15 = s2f15ColIdx !== -1 ? parts[s2f15ColIdx]?.trim() : ""
          if (s2ValF2 && s2ValF15 && s2ValF2 !== s2ValF15) {
            s2.push(`${s2ValF2} | ${s2ValF15}`)
          } else if (s2ValF2) {
            s2.push(s2ValF2)
          } else if (s2ValF15) {
            s2.push(s2ValF15)
          }

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
          matchedProduct = localNomsCopy.find(n => 
            n.type === 'product' && 
            n.name.toLowerCase().replace(/[^a-z0-9а-яіїєґ]/g, '') === cleanSearchName
          )

          if (!matchedProduct) {
            matchedProduct = localNomsCopy.find(n => 
              n.type === 'product' && 
              (n.name.toLowerCase().includes(parentProductName.toLowerCase()) || 
               parentProductName.toLowerCase().includes(n.name.toLowerCase()))
            )
          }

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
            const mac = (machines || []).find(m => m.name.toLowerCase() === block.machineName.toLowerCase() || m.name.toLowerCase().includes(block.machineName.toLowerCase()))
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
      const mac = (machines || []).find(m => m.id === op.machine_id)
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
        const s2 = matchedBlock.s2
        setSide2OpsF2(s2.map(op => op.includes('|') ? op.split('|')[0].trim() : op))
        setSide2OpsF15(s2.map(op => op.includes('|') ? op.split('|')[1].trim() : ''))
        const s2c = matchedBlock.s2c
        setSide2CutOpsF2(s2c.map(op => op.includes('|') ? op.split('|')[0].trim() : op))
        setSide2CutOpsF15(s2c.map(op => op.includes('|') ? op.split('|')[1].trim() : ''))
      }
      await refreshTable('machine_operations')
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
              const filteredOps = machineOperations.filter(op => {
                if (!searchQuery) return true
                const nom = nomenclatures.find(n => n.id === op.nomenclature_id)
                return nom?.name?.toLowerCase().includes(searchQuery.toLowerCase())
              })

              const groupedOps = filteredOps.reduce((acc, op) => {
                const nom = nomenclatures.find(n => n.id === op.nomenclature_id)
                const name = nom?.name || 'Невідомо'
                
                const bomLinks = bomItems?.filter(b => String(b.child_id) === String(op.nomenclature_id)) || []
                const parentNames = bomLinks.map(b => nomenclatures.find(n => String(n.id) === String(b.parent_id))?.name).filter(Boolean)
                
                if (parentNames.length > 0) {
                  parentNames.forEach(groupName => {
                    if (!acc[groupName]) acc[groupName] = []
                    acc[groupName].push({ op, nom })
                  })
                } else {
                  let groupName = null
                  const parts = name.split('-')
                  const singleLetterIdx = parts.findIndex(p => /^[a-zA-Zа-яА-ЯёЁіІїЇєЄґҐ]$/.test(p.trim()))
                  groupName = singleLetterIdx > 0
                    ? parts.slice(0, singleLetterIdx).join('-')
                    : (parts.length >= 2 ? parts.slice(0, 2).join('-') : name.split(' ')[0])
                  
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
                      const mac = (machines || []).find(m => m.id === op.machine_id)
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
                              await refreshTable('machine_operations')
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
            {(machines || []).filter(m => !MACHINE_TYPES.includes(m.name)).map(m => (
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
