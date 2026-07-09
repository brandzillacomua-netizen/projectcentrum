import React, { useState, useMemo, useRef, useEffect } from 'react'
import { BookOpen, Edit2, Layers, Plus, Save, ArrowLeft, Package, Trash2, X } from 'lucide-react'
import { useMES } from '../../../MESContext'

const TYPE_COLORS = { product: '#f59e0b', part: '#60a5fa', raw: '#34d399', consumable: '#f87171', assembly: '#a78bfa' }
const TYPE_LABELS = { product: 'Виріб', part: 'Деталь', raw: 'Сировина', consumable: 'Метиз', assembly: 'Вузол' }

function autoClassify(nom) {
  if (!nom) return 'Інше'
  const name = (nom.name || '').toLowerCase()
  const type = (nom.type || '').toLowerCase()
  const code = (nom.nomenclature_code || '').toLowerCase()

  if (name.includes('гвинт') || name.includes('гайка') || name.includes('болт') || name.includes('шайба') || name.includes('прес гайк') || name.includes('прес-гайк') || name.includes('втулка') || type === 'consumable') return 'Метизи'
  if (name.includes('кріплення') || name.includes('друк') || name.includes('3д') || name.includes('3d')) return '3D-друк'
  if (name.includes('стійка') || name.includes('стийка')) return 'Стійки'
  if (name.includes('накладка') || name.includes('накладки') || name.includes('наклад')) return 'Накладки'
  if (name.includes('гума') || name.includes('пластик') || name.includes('пвх') || name.includes('каучук') || name.includes('уплітнювач') || name.includes('прокладка') || name.includes('проклад')) return 'Гума/Пластик'
  if (name.startsWith('іп') || name.startsWith('іп-') || name.includes(' іп') || code.startsWith('іп') || type === 'part') return 'Деталі'
  if (type === 'assembly') return 'Комплектуючі'
  return 'Інше'
}

function NomCreateModal({ onClose, onCreated, supabase, refreshTable, prefilledName = '' }) {
  const [name, setName] = useState(prefilledName)
  const [type, setType] = useState('part')
  const [materialType, setMaterialType] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return alert('Введіть назву')
    setSaving(true)
    try {
      const payload = { name: name.trim(), type, material_type: materialType.trim() || null }
      const { data, error } = await supabase.from('nomenclatures').insert(payload).select().single()
      if (error) throw error
      await refreshTable('nomenclatures')
      onCreated(data)
      onClose()
    } catch (e) { alert('Помилка: ' + e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: '20px', width: '100%', maxWidth: '480px', padding: '30px' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#a78bfa', marginBottom: '20px' }}>Нова номенклатура</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '10px', background: '#111', border: '1px solid #222', color: '#fff', borderRadius: '8px' }} placeholder="Назва..." />
          <select value={type} onChange={e => setType(e.target.value)} style={{ width: '100%', padding: '10px', background: '#111', border: '1px solid #222', color: '#fff', borderRadius: '8px' }}>
            <option value="part">Деталь (part)</option>
            <option value="raw">Сировина (raw)</option>
            <option value="consumable">Метиз (consumable)</option>
          </select>
          <button onClick={handleSave} disabled={saving} style={{ padding: '12px', background: '#a78bfa', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 900, cursor: 'pointer' }}>Зберегти</button>
        </div>
      </div>
    </div>
  )
}

function BomRow({ row, idx, nomenclatures, bomItems, onUpdate, onRemove, supabase, refreshTable, onExpandAssembly }) {
  const [query, setQuery] = useState(row.nomName || '')
  const [showDrop, setShowDrop] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const filtered = useMemo(() => {
    if (!query || query.length < 2) return []
    const q = query.toLowerCase()
    return nomenclatures.filter(n => (n.name || '').toLowerCase().includes(q)).slice(0, 10)
  }, [query, nomenclatures])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '30px 1fr 120px 80px 30px', gap: '10px', alignItems: 'center', padding: '6px 12px', borderBottom: '1px solid #1c1c1f' }}>
      <span>{idx + 1}</span>
      <div style={{ position: 'relative' }}>
        <input 
          value={query} 
          onChange={e => { setQuery(e.target.value); setShowDrop(true); onUpdate(idx, { nomName: e.target.value }) }} 
          style={{ width: '100%', background: '#000', border: '1px solid #222', color: '#fff', padding: '8px', borderRadius: '6px' }}
        />
        {showDrop && query.length >= 2 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#111', border: '1px solid #333', zIndex: 999 }}>
            {filtered.map(n => (
              <div 
                key={n.id} 
                onMouseDown={() => { setQuery(n.name); setShowDrop(false); onUpdate(idx, { nomId: n.id, nomName: n.name, nomType: n.type, nomUnit: n.unit, group: autoClassify(n) }) }}
                style={{ padding: '8px', cursor: 'pointer' }}
              >
                {n.name}
              </div>
            ))}
          </div>
        )}
      </div>
      <select value={row.group || 'Деталі'} onChange={e => onUpdate(idx, { group: e.target.value })} style={{ background: '#000', border: '1px solid #222', color: '#fff', padding: '8px', borderRadius: '6px' }}>
        <option>Деталі</option>
        <option>Метизи</option>
        <option>Накладки</option>
      </select>
      <input type="number" min="0.001" step="any" value={row.qty} onChange={e => onUpdate(idx, { qty: parseFloat(e.target.value) || 0 })} style={{ width: '100%', background: '#000', border: '1px solid #222', color: '#fff', padding: '8px', borderRadius: '6px', textAlign: 'center' }} />
      <button onClick={() => onRemove(idx)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
    </div>
  )
}

export function SpecBuilderTab({
  parentId, setParentId,
  pendingParent, setPendingParent,
  parentSearch, setParentSearch,
  showParentDrop, setShowParentDrop,
  rows, setRows,
  saving, setSaving,
  viewMode, setViewMode,
  catalogSearch, setCatalogSearch,
  expandedParents, setExpandedParents,
  showNomCreate, setShowNomCreate,
  showParentCreate, setShowParentCreate,
  parentCreateType, setParentCreateType,
  dossierParentId, setDossierParentId,
  activeInlinePart, setActiveInlinePart,
  selectedMachine, setSelectedMachine,
  side1Ops, setSide1Ops,
  side2OpsF2, setSide2OpsF2,
  side2OpsF15, setSide2OpsF15,
  side2CutOpsF2, setSide2CutOpsF2,
  side2CutOpsF15, setSide2CutOpsF15,
  inlineCuttersList, setInlineCuttersList,
  savingOps, setSavingOps
}) {
  const { nomenclatures, bomItems, supabase, refreshTable } = useMES()

  const productNoms = useMemo(() => {
    return nomenclatures.filter(n => n.type === 'product' || n.type === 'assembly')
  }, [nomenclatures])

  const catalogParents = useMemo(() => {
    const pIds = [...new Set(bomItems.map(b => b.parent_id))]
    return pIds.map(pid => ({
      nom: nomenclatures.find(n => n.id === pid),
      children: bomItems.filter(b => b.parent_id === pid)
    })).filter(p => p.nom)
  }, [bomItems, nomenclatures])

  const handleSave = async () => {
    if (!parentId) return alert('Оберіть виріб-батько')
    setSaving(true)
    try {
      await supabase.from('bom_items').delete().eq('parent_id', parentId)
      const payload = rows.map(r => ({ parent_id: parentId, child_id: r.nomId, quantity_per_parent: r.qty, group_label: r.group }))
      await supabase.from('bom_items').insert(payload)
      alert('Специфікацію збережено!')
      refreshTable('bom_items')
    } catch (e) {
      alert('Помилка збереження: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const addRow = () => setRows([...rows, { nomId: null, nomName: '', nomType: 'part', nomUnit: 'шт', group: 'Деталі', qty: 1 }])
  const updateRow = (idx, patch) => setRows(rows.map((r, i) => i === idx ? { ...r, ...patch } : r))
  const removeRow = (idx) => setRows(rows.filter((_, i) => i !== idx))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111', padding: '20px', borderRadius: '16px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900 }}>Конструктор специфікацій BOM</h2>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setViewMode('editor')} style={{ padding: '8px 16px', background: viewMode === 'editor' ? '#ff9000' : '#222', color: viewMode === 'editor' ? '#000' : '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 800 }}>Конструктор</button>
          <button onClick={() => setViewMode('catalog')} style={{ padding: '8px 16px', background: viewMode === 'catalog' ? '#ff9000' : '#222', color: viewMode === 'catalog' ? '#000' : '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 800 }}>Каталог</button>
        </div>
      </div>

      {viewMode === 'editor' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: '#111', padding: '20px', borderRadius: '16px' }}>
            <select value={parentId} onChange={e => setParentId(e.target.value)} style={{ width: '100%', padding: '12px', background: '#000', border: '1px solid #333', color: '#fff', borderRadius: '8px' }}>
              <option value="">-- Оберіть виріб-батько --</option>
              {productNoms.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
          </div>

          <div style={{ background: '#111', padding: '20px', borderRadius: '16px' }}>
            {rows.map((r, idx) => (
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
              />
            ))}
            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
              <button onClick={addRow} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px dashed #444', color: '#aaa', borderRadius: '8px', cursor: 'pointer' }}>+ Додати позицію</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '10px 24px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 800 }}>Зберегти специфікацію</button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {catalogParents.map(({ nom, children }) => (
            <div key={nom.id} style={{ background: '#111', padding: '16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ fontSize: '1rem', color: '#fff' }}>{nom.name}</strong>
                <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '4px' }}>Компонентів: {children.length}</div>
              </div>
              <button 
                onClick={() => {
                  setParentId(nom.id)
                  setRows(children.map(c => {
                    const childNom = nomenclatures.find(n => n.id === c.child_id)
                    return { nomId: c.child_id, nomName: childNom?.name || '', nomType: childNom?.type || 'part', nomUnit: childNom?.unit || 'шт', group: c.group_label || 'Деталі', qty: c.quantity_per_parent }
                  }))
                  setViewMode('editor')
                }}
                style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 800 }}
              >
                Редагувати в BOM
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
