import React, { useState, useMemo, useRef, useEffect } from 'react'
import { 
  BookOpen, 
  Edit2, 
  Layers, 
  Plus, 
  Save, 
  ArrowLeft, 
  Package, 
  Trash2, 
  X, 
  Search, 
  ChevronRight, 
  ChevronDown, 
  AlertCircle 
} from 'lucide-react'
import { useMES } from '../../../MESContext'
import { 
  useV2NomenclaturesData, 
  MACHINE_TYPES, 
  renderCutterListEditorShared, 
  combineOps, 
  autoClassify 
} from '../utils/engineerHelpers.jsx'
import { BomRow } from './BomRow'
import { NomCreateModal } from './NomCreateModal'

export function SpecBuilderTab() {
  const { nomenclatures: rawNoms, bomItems, supabase, refreshTable, machineOperations, machines } = useMES()
  const v2Noms = useV2NomenclaturesData(supabase)

  const nomenclatures = useMemo(() => {
    const map = new Map()
    ;(rawNoms || []).forEach(n => {
      if (n && n.id) map.set(String(n.id), n)
    })
    ;(v2Noms || []).forEach(n => {
      if (n && n.id) map.set(String(n.id), { ...map.get(String(n.id)), ...n })
    })
    return Array.from(map.values())
  }, [rawNoms, v2Noms])

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
  const [catalogFolder, setCatalogFolder] = useState('all')
  const [collapsedFolders, setCollapsedFolders] = useState({})
  const [showNomCreate, setShowNomCreate] = useState(false)
  const [showParentCreate, setShowParentCreate] = useState(false)
  const [dossierParentId, setDossierParentId] = useState(null)
  
  // State for inline operations manager
  const [activeInlinePart, setActiveInlinePart] = useState(null)
  const [selectedMachine, setSelectedMachine] = useState('')
  const [side1Ops, setSide1Ops] = useState([])
  const [side2OpsF2, setSide2OpsF2] = useState([])
  const [side2OpsF15, setSide2OpsF15] = useState([])
  const [side2CutOpsF2, setSide2CutOpsF2] = useState([])
  const [side2CutOpsF15, setSide2CutOpsF15] = useState([])
  const [inlineCuttersList, setInlineCuttersList] = useState([])
  const [savingOps, setSavingOps] = useState(false)

  const renderCutterListEditor = (cutters, setCutters) => renderCutterListEditorShared(cutters, setCutters, nomenclatures)

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
  }, [activeInlinePart, selectedMachine, machineOperations])

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

  const selectedParent = useMemo(() => {
    if (parentId === 'temp-new') {
      return { id: 'temp-new', name: pendingParent?.name, type: pendingParent?.type, material_type: pendingParent?.material_type }
    }
    return nomenclatures.find(n => n.id === parentId)
  }, [parentId, nomenclatures, pendingParent])

  const productNoms = useMemo(() => {
    const q = parentSearch.toLowerCase()
    return nomenclatures
      .filter(n => (n.type === 'product' || n.type === 'assembly') && (!q || n.name.toLowerCase().includes(q)))
      .slice(0, 15)
  }, [nomenclatures, parentSearch])

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
  }, [parentId, bomItems, nomenclatures])

  const addRow = () => setRows(prev => [...prev, { nomId: null, nomName: '', nomType: 'part', nomUnit: 'шт', group: 'Деталі', qty: 1 }])

  const updateRow = (idx, patch) => setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))
  const removeRow = (idx) => setRows(prev => prev.filter((_, i) => i !== idx))

  const handleExpandAssembly = (assemblyNomId, multiplier = 1) => {
    const subItems = bomItems.filter(b => String(b.parent_id) === String(assemblyNomId))
    if (subItems.length === 0) return alert('Цей вузол порожній або не має BOM зв\'язків.')

    const newRowsToInsert = subItems.map(b => {
      const nom = nomenclatures.find(n => String(n.id) === String(b.child_id))
      return {
        nomId: b.child_id,
        nomName: nom?.name || '(невідомо)',
        nomType: nom?.type || 'part',
        nomUnit: nom?.unit || 'шт',
        group: b.group_label || autoClassify(nom),
        qty: (b.quantity_per_parent || 1) * multiplier
      }
    })

    setRows(prevRows => {
      const idx = prevRows.findIndex(r => String(r.nomId) === String(assemblyNomId))
      if (idx !== -1) {
        const copy = [...prevRows]
        copy.splice(idx, 1, ...newRowsToInsert)
        return copy
      }
      return [...prevRows, ...newRowsToInsert]
    })
  }

  const handleSave = async () => {
    if (!parentId) return alert('Оберіть виріб-батько')
    const invalidRows = rows.filter(r => !r.nomId)
    if (invalidRows.length > 0) return alert(`${invalidRows.length} рядків без прив'язки до номенклатури. Оберіть позиції або видаліть порожні рядки.`)
    if (rows.length === 0) return alert('Додайте хоча б одну позицію до специфікації')

    setSaving(true)
    try {
      let activeParentId = parentId

      if (parentId === 'temp-new') {
        const payloadParent = { 
          name: pendingParent.name, 
          type: pendingParent.type, 
          material_type: pendingParent.material_type 
        }
        const { data: newParent, error: parentErr } = await supabase
          .from('nomenclatures_v2')
          .insert(payloadParent)
          .select()
          .single()
        if (parentErr) throw parentErr
        
        activeParentId = newParent.id
      } else if (pendingParent && selectedParent && pendingParent.name.trim() !== selectedParent.name.trim()) {
        const { error: renameErr } = await supabase
          .from('nomenclatures_v2')
          .update({ name: pendingParent.name.trim() })
          .eq('id', activeParentId)
        if (renameErr) throw renameErr
      }

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

      const childIds = Object.keys(agg)
      const { data: existingChildren, error: childrenErr } = await supabase
        .from('nomenclatures_v2')
        .select('id')
        .in('id', childIds)
      if (childrenErr) throw childrenErr

      const existingChildIds = new Set((existingChildren || []).map(n => String(n.id)))
      const missingRows = Object.values(agg).filter(r => !existingChildIds.has(String(r.nomId)))
      if (missingRows.length > 0) {
        const missingNames = missingRows.map(r => r.nomName || r.nomId).join(', ')
        throw new Error(`Не знайдено номенклатуру: ${missingNames}. Оновіть сторінку та виберіть ці позиції повторно.`)
      }

      const { error: deleteBomErr } = await supabase.from('bom_items').delete().eq('parent_id', activeParentId)
      if (deleteBomErr) throw deleteBomErr
      if (payloadWithGroup.length > 0) {
        const { error: err1 } = await supabase.from('bom_items').insert(payloadWithGroup)
        if (err1) {
          if (err1.message && err1.message.includes('group_label')) {
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

  const catalogParents = useMemo(() => {
    const q = catalogSearch.toLowerCase()
    const productNoms = nomenclatures.filter(n => n.type === 'product' || n.type === 'assembly')
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

    const mapByName = new Map()
    productNoms.forEach(nom => {
      const normName = (nom.name || '').trim().toLowerCase()
      if (!normName) return
      
      const children = bomItems.filter(b => String(b.parent_id) === String(nom.id))
      const existing = mapByName.get(normName)

      if (!existing) {
        mapByName.set(normName, { nom, children })
      } else {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {showNomCreate && (
        <NomCreateModal supabase={supabase} refreshTable={refreshTable} onClose={() => setShowNomCreate(false)} onCreated={() => {}} />
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
              style={{ padding: '10px 20px', background: 'var(--button-bg, #f1f5f9)', color: 'var(--text-main, #0f172a)', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <ArrowLeft size={15}/> До списку
            </button>
          )}
          <button
            onClick={() => { setViewMode('editor'); setDossierParentId(null) }}
            style={{ padding: '10px 20px', background: viewMode === 'editor' ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--button-bg, #f1f5f9)', color: viewMode === 'editor' ? '#ffffff' : 'var(--text-main, #0f172a)', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Edit2 size={15}/> Конструктор
          </button>
          <button
            onClick={() => { setViewMode('catalog'); setDossierParentId(null) }}
            style={{ padding: '10px 20px', background: viewMode === 'catalog' ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--button-bg, #f1f5f9)', color: viewMode === 'catalog' ? '#ffffff' : 'var(--text-main, #0f172a)', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Layers size={15}/> Каталог ({catalogParents.length})
          </button>
          <button
            onClick={() => setShowNomCreate(true)}
            style={{ padding: '10px 20px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', cursor: 'pointer', fontWeight: 800, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={15}/> Нова номенклатура
          </button>
        </div>
      </div>

      {activeInlinePart && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--card-bg, #111)', border: '1px solid var(--border-color, #2a2a5a)', borderRadius: '24px', width: '100%', maxWidth: '680px', padding: '30px', boxShadow: '0 20px 50px rgba(0,0,0,0.8)', maxHeight: '90vh', overflowY: 'auto', color: 'var(--text-main, #fff)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color, #222)', paddingBottom: '15px' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#6366f1', fontWeight: 900, textTransform: 'uppercase' }}>Операції для деталі</span>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-main, #fff)' }}>{activeInlinePart.name}</h3>
              </div>
              <button onClick={() => { setActiveInlinePart(null); setSelectedMachine('') }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted, #555)', cursor: 'pointer' }}><X size={22}/></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted, #666)', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Оберіть верстат</label>
                <select value={selectedMachine} onChange={e => setSelectedMachine(e.target.value)} style={{ width: '100%', padding: '12px', background: 'var(--input-bg, #000)', border: '1px solid var(--border-color, #333)', color: 'var(--text-main, #fff)', borderRadius: '10px', fontSize: '0.9rem' }}>
                  <option value="">-- Оберіть тип верстата --</option>
                  {MACHINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {selectedMachine && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '180px', background: 'var(--card-header-bg, #0a0a0a)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color, #222)' }}>
                      <h5 style={{ margin: '0 0 8px 0', fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>1 сторона</h5>
                      {side1Ops.map((op, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                          <input value={op} onChange={e => { const copy = [...side1Ops]; copy[idx] = e.target.value; setSide1Ops(copy) }} style={{ flex: 1, padding: '6px', background: 'var(--input-bg, #000)', border: '1px solid var(--border-color, #222)', color: 'var(--text-main, #fff)', borderRadius: '6px', fontSize: '0.75rem' }} />
                          <button onClick={() => setSide1Ops(side1Ops.filter((_, i) => i !== idx))} style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0 8px', cursor: 'pointer' }}><Trash2 size={12}/></button>
                        </div>
                      ))}
                      <button onClick={() => setSide1Ops([...side1Ops, ''])} style={{ width: '100%', padding: '5px', background: 'transparent', border: '1px dashed var(--border-color, #333)', color: '#3b82f6', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem' }}>+ Додати</button>
                    </div>

                    <div style={{ flex: 1, minWidth: '180px', background: 'var(--card-header-bg, #0a0a0a)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color, #222)' }}>
                      <h5 style={{ margin: '0 0 8px 0', fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>2 сторона (Ф2)</h5>
                      {side2OpsF2.map((op, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                          <input value={op} onChange={e => { const copy = [...side2OpsF2]; copy[idx] = e.target.value; setSide2OpsF2(copy) }} style={{ flex: 1, padding: '6px', background: 'var(--input-bg, #000)', border: '1px solid var(--border-color, #222)', color: 'var(--text-main, #fff)', borderRadius: '6px', fontSize: '0.75rem' }} />
                          <button onClick={() => setSide2OpsF2(side2OpsF2.filter((_, i) => i !== idx))} style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0 8px', cursor: 'pointer' }}><Trash2 size={12}/></button>
                        </div>
                      ))}
                      <button onClick={() => setSide2OpsF2([...side2OpsF2, ''])} style={{ width: '100%', padding: '5px', background: 'transparent', border: '1px dashed var(--border-color, #333)', color: '#3b82f6', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem' }}>+ Додати</button>
                    </div>

                    <div style={{ flex: 1, minWidth: '180px', background: 'var(--card-header-bg, #0a0a0a)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color, #222)' }}>
                      <h5 style={{ margin: '0 0 8px 0', fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>2 сторона (Ф1.5)</h5>
                      {side2OpsF15.map((op, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                          <input value={op} onChange={e => { const copy = [...side2OpsF15]; copy[idx] = e.target.value; setSide2OpsF15(copy) }} style={{ flex: 1, padding: '6px', background: 'var(--input-bg, #000)', border: '1px solid var(--border-color, #222)', color: 'var(--text-main, #fff)', borderRadius: '6px', fontSize: '0.75rem' }} />
                          <button onClick={() => setSide2OpsF15(side2OpsF15.filter((_, i) => i !== idx))} style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0 8px', cursor: 'pointer' }}><Trash2 size={12}/></button>
                        </div>
                      ))}
                      <button onClick={() => setSide2OpsF15([...side2OpsF15, ''])} style={{ width: '100%', padding: '5px', background: 'transparent', border: '1px dashed var(--border-color, #333)', color: '#3b82f6', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem' }}>+ Додати</button>
                    </div>

                    <div style={{ flex: 1, minWidth: '180px', background: 'var(--card-header-bg, #0a0a0a)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color, #222)' }}>
                      <h5 style={{ margin: '0 0 8px 0', fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>Вирізка (Ф2)</h5>
                      {side2CutOpsF2.map((op, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                          <input value={op} onChange={e => { const copy = [...side2CutOpsF2]; copy[idx] = e.target.value; setSide2CutOpsF2(copy) }} style={{ flex: 1, padding: '6px', background: 'var(--input-bg, #000)', border: '1px solid var(--border-color, #222)', color: 'var(--text-main, #fff)', borderRadius: '6px', fontSize: '0.75rem' }} />
                          <button onClick={() => setSide2CutOpsF2(side2CutOpsF2.filter((_, i) => i !== idx))} style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0 8px', cursor: 'pointer' }}><Trash2 size={12}/></button>
                        </div>
                      ))}
                      <button onClick={() => setSide2CutOpsF2([...side2CutOpsF2, ''])} style={{ width: '100%', padding: '5px', background: 'transparent', border: '1px dashed var(--border-color, #333)', color: '#3b82f6', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem' }}>+ Додати</button>
                    </div>

                    <div style={{ flex: 1, minWidth: '180px', background: 'var(--card-header-bg, #0a0a0a)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color, #222)' }}>
                      <h5 style={{ margin: '0 0 8px 0', fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>Вирізка (Ф1.5)</h5>
                      {side2CutOpsF15.map((op, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                          <input value={op} onChange={e => { const copy = [...side2CutOpsF15]; copy[idx] = e.target.value; setSide2CutOpsF15(copy) }} style={{ flex: 1, padding: '6px', background: 'var(--input-bg, #000)', border: '1px solid var(--border-color, #222)', color: 'var(--text-main, #fff)', borderRadius: '6px', fontSize: '0.75rem' }} />
                          <button onClick={() => setSide2CutOpsF15(side2CutOpsF15.filter((_, i) => i !== idx))} style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0 8px', cursor: 'pointer' }}><Trash2 size={12}/></button>
                        </div>
                      ))}
                      <button onClick={() => setSide2CutOpsF15([...side2CutOpsF15, ''])} style={{ width: '100%', padding: '5px', background: 'transparent', border: '1px dashed var(--border-color, #333)', color: '#3b82f6', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem' }}>+ Додати</button>
                    </div>

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
          <div style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #cbd5e1)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', fontWeight: 900, textTransform: 'uppercase', display: 'block' }}>Крок 1: Оберіть або Створіть виріб-батько</label>
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
                style={{ width: '100%', padding: '12px 16px', background: 'var(--input-bg, #ffffff)', border: '1px solid var(--border-color, #cbd5e1)', color: 'var(--text-main, #0f172a)', borderRadius: '10px', fontSize: '0.95rem', fontWeight: 600, boxSizing: 'border-box' }}
              />
              {selectedParent && (
                <button onClick={() => { setParentId(''); setPendingParent(null); setParentSearch(''); setRows([]) }} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-muted, #555)', cursor: 'pointer' }}><X size={16}/></button>
              )}
              {showParentDrop && !selectedParent && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--card-bg, #ffffff)', border: '1px solid #3b82f6', borderRadius: '12px', zIndex: 9999, maxHeight: '300px', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.2)', marginTop: '5px' }}>
                  {productNoms.length === 0 ? (
                    <div style={{ padding: '16px', color: 'var(--text-muted, #64748b)', fontSize: '0.85rem', textAlign: 'center' }}>
                      <p style={{ margin: '0 0 10px 0' }}>Не знайдено виробів з назвою «{parentSearch}»</p>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setPendingParent({
                              name: parentSearch.trim(),
                              type: 'product',
                              material_type: null
                            });
                            setParentId('temp-new');
                            setParentSearch('');
                            setRows([]);
                            setShowParentDrop(false);
                          }}
                          style={{ padding: '6px 12px', background: 'rgba(245,158,11,0.15)', border: '1px solid #f59e0b40', color: '#f59e0b', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                        >
                          + Створити Готовий Виріб
                        </button>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setPendingParent({
                              name: parentSearch.trim(),
                              type: 'assembly',
                              material_type: null
                            });
                            setParentId('temp-new');
                            setParentSearch('');
                            setRows([]);
                            setShowParentDrop(false);
                          }}
                          style={{ padding: '6px 12px', background: 'rgba(167,139,250,0.15)', border: '1px solid #a78bfa40', color: '#a78bfa', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                        >
                          + Створити Вузол
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {productNoms.map(n => (
                        <div
                          key={n.id}
                          onMouseDown={() => { setParentId(n.id); setParentSearch(''); setShowParentDrop(false) }}
                          style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color, #e2e8f0)', transition: 'background 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main, #0f172a)' }}>{n.name}</span>
                          <span style={{ fontSize: '0.65rem', color: TYPE_COLORS[n.type] || '#888', fontWeight: 900, background: (TYPE_COLORS[n.type] || '#555') + '22', padding: '2px 8px', borderRadius: '20px' }}>{TYPE_LABELS[n.type] || n.type}</span>
                        </div>
                      ))}
                      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-color, #e2e8f0)', background: 'var(--card-header-bg, #f8fafc)', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', marginRight: '8px' }}>Не знайшли виріб?</span>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setPendingParent({
                              name: parentSearch.trim(),
                              type: 'product',
                              material_type: null
                            });
                            setParentId('temp-new');
                            setParentSearch('');
                            setRows([]);
                            setShowParentDrop(false);
                          }}
                          style={{ padding: '4px 10px', background: 'transparent', border: 'none', color: '#f59e0b', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                        >
                          + Створити «{parentSearch}»
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {!selectedParent && parentSearch.trim().length > 0 && (
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>Створити нову номенклатуру:</span>
                <select
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === 'product' || val === 'assembly') {
                      setPendingParent({
                        name: parentSearch.trim(),
                        type: val,
                        material_type: null
                      })
                      setParentId('temp-new')
                      setParentSearch('')
                      setRows([])
                    }
                  }}
                  value=""
                  style={{
                    background: 'var(--input-bg, #ffffff)',
                    border: '1px solid var(--border-color, #cbd5e1)',
                    color: '#7c3aed',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <option value="">— Оберіть тип (Виріб або Вузол) —</option>
                  <option value="product">Готовий Виріб (Рама)</option>
                  <option value="assembly">Вузол збірки</option>
                </select>
              </div>
            )}

            {selectedParent && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                <Package size={14} color="#818cf8"/>
                <span style={{ fontSize: '0.8rem', color: '#818cf8', fontWeight: 700 }}>{selectedParent.name}</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted, #64748b)' }}>ID: {selectedParent.id}</span>
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  background: selectedParent.type === 'product' ? 'rgba(245,158,11,0.15)' : 'rgba(167,139,250,0.15)',
                  color: selectedParent.type === 'product' ? '#f59e0b' : '#a78bfa',
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}>
                  {TYPE_LABELS[selectedParent.type] || selectedParent.type}
                </span>
              </div>
            )}
          </div>

          <div style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #cbd5e1)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', fontWeight: 900, textTransform: 'uppercase' }}>Крок 2: Складові специфікації ({rows.length} позицій)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={addRow} style={{ padding: '8px 14px', background: 'var(--button-bg, #f1f5f9)', color: 'var(--text-main, #0f172a)', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Plus size={14}/> Додати рядок
                </button>
              </div>
            </div>

            {/* BOM Table Container WITHOUT overflow:hidden so dropdown is never clipped */}
            <div style={{ border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '12px', marginBottom: '20px', background: 'var(--card-bg, #ffffff)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 120px 90px 28px', gap: '8px', padding: '10px 14px', background: 'var(--card-header-bg, #f8fafc)', borderBottom: '1px solid var(--border-color, #cbd5e1)', borderRadius: '12px 12px 0 0', fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase' }}>
                <span>№</span>
                <span>Компонент / Пошук номенклатури</span>
                <span>Група</span>
                <span style={{ textAlign: 'right' }}>К-сть</span>
                <span></span>
              </div>
              {rows.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem' }}>Специфікація порожня</p>
                  <button onClick={addRow} style={{ padding: '8px 16px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>+ Додати першу позицію</button>
                </div>
              ) : (
                rows.map((r, idx) => (
                  <BomRow
                    key={idx}
                    row={r}
                    idx={idx}
                    nomenclatures={nomenclatures}
                    bomItems={bomItems}
                    onUpdate={updateRow}
                    onRemove={removeRow}
                    supabase={supabase}
                    refreshTable={refreshTable}
                    onExpandAssembly={handleExpandAssembly}
                  />
                ))
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 900, fontSize: '0.95rem', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 20px rgba(16,185,129,0.2)' }}
            >
              <Save size={18}/> {saving ? 'Збереження...' : 'Зберегти специфікацію'}
            </button>
          </div>
        </div>
      ) : viewMode === 'dossier' && dossierParentId ? (
        (() => {
          const dossierParent = nomenclatures.find(n => n.id === dossierParentId)
          const dossierChildren = bomItems.filter(b => String(b.parent_id) === String(dossierParentId))

          const GROUP_COLORS = {
            'Деталі': '#2563eb',
            'Накладки': '#7c3aed',
            'Метизи': '#dc2626',
            'Гума/Пластик': '#059669',
            '3D-друк': '#d97706',
            'Фурнітура': '#db2777',
            'Комплектуючі': '#8b5cf6',
            'Інше': '#64748b'
          }

          const grouped = {}
          dossierChildren.forEach(b => {
            const nom = nomenclatures.find(n => String(n.id) === String(b.child_id))
            const grp = b.group_label || autoClassify(nom)
            if (!grouped[grp]) grouped[grp] = []
            grouped[grp].push(b)
          })

          const sortedGroups = Object.keys(grouped).sort((a, b) => {
            const order = ['Деталі', 'Накладки', 'Метизи', 'Гума/Пластик', '3D-друк', 'Фурнітура', 'Комплектуючі', 'Інше']
            return order.indexOf(a) - order.indexOf(b)
          })

          let globalIdx = 0

          return (
            <div className="dossier-print-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
              <div style={{ width: '100%', maxWidth: '800px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="no-print">
                <button
                  onClick={() => { setViewMode('catalog'); setDossierParentId(null) }}
                  style={{ padding: '8px 16px', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #cbd5e1)', color: 'var(--text-main, #0f172a)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <ArrowLeft size={14}/> До списку каталогу
                </button>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => window.print()}
                    style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800 }}
                  >
                    Друк специфікації
                  </button>
                  <button
                    onClick={() => { setParentId(dossierParentId); setViewMode('editor') }}
                    style={{ padding: '8px 16px', background: 'rgba(99,102,241,0.1)', border: '1px solid #6366f133', color: '#818cf8', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Edit2 size={13}/> Редагувати
                  </button>
                </div>
              </div>

              <div className="dossier-a4-sheet" style={{ width: '100%', maxWidth: '800px', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '8px', padding: '40px', boxSizing: 'border-box', boxShadow: '0 15px 35px rgba(0,0,0,0.08)', position: 'relative', color: 'var(--text-main, #0f172a)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--border-color, #cbd5e1)', paddingBottom: '20px', marginBottom: '25px' }}>
                  <div>
                    <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-main, #0f172a)', letterSpacing: '-0.02em' }}>{dossierParent?.name}</h1>
                    <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>СПЕЦИФІКАЦІЯ ВИРОБУ / BILL OF MATERIALS</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>СИСТЕМА CENTRUM MES</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', marginTop: '4px', fontFamily: 'monospace' }}>ID: {dossierParent?.id?.substring(0, 8)}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', marginTop: '2px' }}>{new Date().toLocaleDateString('uk-UA')}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {sortedGroups.map(grp => {
                    const items = grouped[grp]
                    const grpColor = GROUP_COLORS[grp] || '#888'
                    return (
                      <div key={grp} style={{ pageBreakInside: 'avoid' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: `1px solid ${grpColor}40`, paddingBottom: '6px', marginBottom: '10px' }}>
                          <span style={{ width: '3px', height: '12px', background: grpColor, borderRadius: '1px' }} />
                          <h4 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 900, color: grpColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{grp}</h4>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted, #64748b)', fontWeight: 700 }}>({items.length} поз.)</span>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', textAlign: 'left' }}>
                              <th style={{ padding: '6px 8px', color: 'var(--text-muted, #64748b)', fontWeight: 800, width: '30px' }}>№</th>
                              <th style={{ padding: '6px 8px', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>Найменування</th>
                              <th style={{ padding: '6px 8px', color: 'var(--text-muted, #64748b)', fontWeight: 800, width: '140px' }}>
                                {grp === 'Деталі' ? 'Характеристика' : 'Опис'}
                              </th>
                              <th style={{ padding: '6px 8px', color: 'var(--text-muted, #64748b)', fontWeight: 800, textAlign: 'center', width: '60px' }}>К-сть</th>
                              <th style={{ padding: '6px 8px', color: 'var(--text-muted, #64748b)', fontWeight: 800, textAlign: 'center', width: '40px' }}>Од.</th>
                              <th className="no-print" style={{ padding: '6px 8px', color: 'var(--text-muted, #64748b)', fontWeight: 800, textAlign: 'center', width: '150px' }}>Операції ЧПК</th>
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
                                <tr key={b.child_id} style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                                  <td style={{ padding: '8px 8px', color: 'var(--text-muted, #64748b)', fontWeight: 700 }}>{rowNum}</td>
                                  <td style={{ padding: '8px 8px', fontWeight: 700, color: 'var(--text-main, #0f172a)' }}>
                                    <div>{child?.name || `(ID: ${b.child_id})`}</div>
                                    {child?.type === 'assembly' && subItems.length > 0 && (
                                      <div style={{ marginTop: '5px', paddingLeft: '15px', borderLeft: '2px solid rgba(139,92,246,0.3)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {subItems.map((sb) => {
                                          const sbNom = nomenclatures.find(n => String(n.id) === String(sb.child_id))
                                          const sbOps = machineOperations?.filter(o => o.nomenclature_id === sb.child_id) || []
                                          return (
                                            <div key={sb.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', color: 'var(--text-muted, #64748b)', flexWrap: 'wrap' }}>
                                              <span style={{ color: '#8b5cf6' }}>↳</span>
                                              <span>{sbNom ? sbNom.name : 'Деталь'}</span>
                                              <span style={{ fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>x{sb.quantity_per_parent * b.quantity_per_parent}</span>
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
                                                  <span key={op.id} style={{ fontSize: '0.55rem', background: 'rgba(3,105,161,0.12)', color: '#0284c7', padding: '0px 4px', borderRadius: '4px', border: '1px solid rgba(2,132,199,0.3)' }}>
                                                    {lbl}
                                                  </span>
                                                )
                                              })}
                                              <button
                                                className="no-print"
                                                onClick={() => setActiveInlinePart({ id: sb.child_id, name: sbNom?.name })}
                                                style={{ padding: '0px 4px', background: 'transparent', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: '0.65rem', textDecoration: 'underline', fontWeight: 800 }}
                                              >
                                                Налаштувати ЧПК
                                              </button>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ padding: '8px 8px', color: 'var(--text-muted, #64748b)', fontSize: '0.75rem' }}>
                                    {grp === 'Деталі' ? (child?.material_type || '—') : (child?.description || '—')}
                                  </td>
                                  <td style={{ padding: '8px 8px', textAlign: 'center', color: '#f59e0b', fontWeight: 800, fontSize: '0.85rem' }}>{b.quantity_per_parent}</td>
                                  <td style={{ padding: '8px 8px', textAlign: 'center', color: 'var(--text-muted, #64748b)', fontSize: '0.75rem' }}>{child?.unit || 'шт'}</td>
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
                                                <span key={op.id} style={{ fontSize: '0.55rem', background: 'rgba(37,99,235,0.12)', color: '#2563eb', padding: '1px 5px', borderRadius: '4px', border: '1px solid rgba(37,99,235,0.3)' }}>
                                                  {lbl}
                                                </span>
                                              )
                                            })}
                                          </div>
                                        ) : (
                                          <span style={{ fontSize: '0.6rem', color: 'var(--text-muted, #94a3b8)', fontStyle: 'italic' }}>немає</span>
                                        )}
                                        <button
                                          onClick={() => setActiveInlinePart({ id: b.child_id, name: child?.name })}
                                          style={{ padding: '2px 6px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#6366f1', borderRadius: '4px', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 800, marginTop: '2px' }}
                                        >
                                          ЧПК
                                        </button>
                                      </div>
                                    ) : (
                                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted, #94a3b8)' }}>—</span>
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

                <div style={{ borderTop: '2px solid var(--border-color, #cbd5e1)', marginTop: '30px', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>СПЕЦИФІКАЦІЯ CENTRUM MES</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-main, #0f172a)', fontWeight: 800 }}>РАЗОМ: {dossierChildren.length} ПОЗИЦІЙ В {sortedGroups.length} ГРУПАХ</div>
                </div>
              </div>

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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

          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} size={16}/>
            <input
              value={catalogSearch}
              onChange={e => setCatalogSearch(e.target.value)}
              placeholder="Пошук специфікації за назвою виробу..."
              style={{ width: '100%', padding: '12px 15px 12px 42px', background: 'var(--input-bg, #ffffff)', border: '1px solid var(--border-color, #cbd5e1)', color: 'var(--text-main, #0f172a)', borderRadius: '12px', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>

          {filteredCatalogParents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted, #64748b)' }}>
              <BookOpen size={56} style={{ marginBottom: '15px', opacity: 0.15 }}/>
              <p style={{ fontSize: '1rem', fontWeight: 700 }}>У цій папці специфікацій не знайдено</p>
            </div>
          ) : (() => {
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

                      {!isCollapsed && (
                        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {folderItems.map(({ nom, children }) => {
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
