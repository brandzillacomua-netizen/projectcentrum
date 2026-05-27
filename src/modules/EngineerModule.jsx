import React, { useState } from 'react'
import { 
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
  Trash2
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'

const MACHINE_TYPES = [
  'CNC 1200x800 - 4 листи (Малий)',
  'CNC 3050(16)х16 - 3-12 листів (швидкісний)',
  'CNC 3060х1600 - 3-36 листів (Три Головий)',
  'CNC 6000x2000 - 4 - 96 листів (Дракон)',
  'CNC KE XIN - 4 - 16 листів (ФЕЯ)'
]

const MachineOperationsTab = () => {
  const { nomenclatures, machines, machineOperations, supabase, bomItems, refreshTable } = useMES()
  const [selectedNom, setSelectedNom] = useState('')
  const [selectedMachine, setSelectedMachine] = useState('')
  const [side1Ops, setSide1Ops] = useState([])
  const [side2Ops, setSide2Ops] = useState([])
  const [side2CutOps, setSide2CutOps] = useState([])
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
        setSide2Ops((existing.side2_ops || []).filter(op => !op.startsWith('__CUTTER__:')))
        setSide2CutOps((existing.side2_cut_ops || []).filter(op => !op.startsWith('__CUTTER__:') && !op.startsWith('__CUTTER__Reference:')))
      } else {
        setSide1Ops([])
        setSide2Ops([])
        setSide2CutOps([])
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
    const existingCutters = existing ? (existing.side2_cut_ops || []).filter(op => op.startsWith('__CUTTER__:')) : []

    const payload = {
      nomenclature_id: selectedNom,
      machine_id: isType ? null : selectedMachine,
      machine_type: isType ? selectedMachine : null,
      side1_ops: side1Ops.filter(Boolean),
      side2_ops: side2Ops.filter(Boolean),
      side2_cut_ops: [...side2CutOps.filter(Boolean), ...existingCutters]
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
    if (normMac.includes('3050(16)x1600') || normMac.includes('3050(16)х1600') || normMac.includes('3050(16)') || normMac.includes('16x16') || normMac.includes('16х16')) {
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
        .from('nomenclatures')
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
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) return []

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
             return csvNomKey.startsWith(dbNomKey) || dbNomKey.startsWith(csvNomKey)
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
            .split(/[\r\n\s_\-\(\),]/)
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

          if (bestNom && (bestScore / csvTokens.length >= 0.7 || bestScore >= 4)) {
            nom = bestNom
          }
        }
      }
      return nom
    }

    const containsMachineHeaders = lines.some(l => l.split(',')[0].trim().toLowerCase().startsWith('станок'))
    
    const rawBlocks = []
    if (!containsMachineHeaders) {
      if (lines.length < 4) {
        throw new Error('Файл занадто короткий. Очікується мінімум 4 рядки.')
      }
      const macName = lines[0].split(',')[0].trim()
      const nomName = lines[1].split(',')[0].trim()
      const matchedNom = findNomenclature(nomName)
      if (!matchedNom) {
        throw new Error(`Номенклатура "${nomName}" не знайдена в базі.`)
      }
      
      const rows = []
      for (let i = 2; i < lines.length; i++) {
        rows.push(lines[i].split(','))
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
        const parts = line.split(',').map(p => p.trim())
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

      for (const parts of rb.rows) {
        const isHeaderRow = parts[0]?.toLowerCase().includes('операція') ||
                            parts[1]?.toLowerCase().includes('операція') ||
                            parts[2]?.toLowerCase().includes('операція')

        if (!isHeaderRow) {
          if (parts[0]?.trim()) s1.push(parts[0].trim())
          if (parts[1]?.trim()) s2.push(parts[1].trim())
          if (parts[2]?.trim()) s2c.push(parts[2].trim())
        }

        const cutterSize = parts[3]?.trim()
        const cutterQtyStr = parts[4]?.trim()

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
        }
        successCount++
      } catch (err) {
        failMessages.push(`${file.name}: ${err.message}`)
      }
    }
    
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
      <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#888' }}>{title}</h4>
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
          <button onClick={() => setOps(ops.filter((_, i) => i !== idx))} style={{ background: '#ef4444', border: 'none', color: '#fff', borderRadius: '6px', padding: '0 10px', cursor: 'pointer' }}><Trash2 size={14} /></button>
        </div>
      ))}
      <button onClick={() => setOps([...ops, ''])} style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px dashed #333', color: '#3b82f6', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px' }}>
        <Plus size={16} /> Додати операцію
      </button>
    </div>
  )

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
              {renderOpList(side1Ops, setSide1Ops, 'Операція (1 сторона)')}
              {renderOpList(side2Ops, setSide2Ops, 'Операція (2 сторона)')}
              {renderOpList(side2CutOps, setSide2CutOps, 'Операція (2 сторона вирізка)')}
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

const EngineerModule = () => {
  const { tasks, orders, nomenclatures, approveEngineer, machineCalls, machines, currentUser, supabase } = useMES()
  const [activeTab, setActiveTab] = useState('tasks')
  
  const pendingTasks = tasks.filter(t => t.status === 'waiting' && !t.engineer_conf)
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

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button 
            onClick={() => setActiveTab('tasks')}
            style={{ padding: '10px 20px', background: activeTab === 'tasks' ? '#3b82f6' : '#111', color: '#fff', border: '1px solid #222', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
          >
            Черга ЧПК ({pendingTasks.length})
          </button>
          <button 
            onClick={() => setActiveTab('operations')}
            style={{ padding: '10px 20px', background: activeTab === 'operations' ? '#3b82f6' : '#111', color: '#fff', border: '1px solid #222', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
          >
            <Database size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '5px' }} />
            Операції станків
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
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#888', lineHeight: 1.4 }}>Ваше підтвердження активує кнопки запуску на терміналах операторів верстатів.</p>
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
        ) : (
          <MachineOperationsTab />
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .eng-task-card { transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .eng-task-card:hover { transform: translateY(-5px); border-color: #3b82f6; box-shadow: 0 15px 40px rgba(59, 130, 246, 0.15); }
      `}} />
    </div>
  )
}

export default EngineerModule
