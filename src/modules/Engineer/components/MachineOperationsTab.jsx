import React from 'react'
import { Upload, Search, Trash2, Plus } from 'lucide-react'
import { useMES } from '../../../MESContext'

const MACHINE_TYPES = [
  'CNC 1200x800 - 4 листи (Малий)',
  'CNC 3050(16)х16 - 3-12 листів (швидкісний)',
  'CNC 3060х1600 - 3-36 листів (Три Головий)',
  'CNC 6000x2000 - 4 - 96 листів (Дракон)',
  'CNC KE XIN - 4 - 16 листів (ФЕЯ)'
]

const renderCutterListEditorShared = (cutters, setCutters, nomenclatures) => {
  let cutterNoms = nomenclatures.filter(n => n.type === 'cutter_type')
  if (cutterNoms.length === 0) {
    cutterNoms = nomenclatures.filter(n => {
      return n.name.toLowerCase().match(/^фреза\s+[фf][0-9]/)
    })
  }
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
              style={{ background: '#ef4444', border: 'none', color: '#fff', borderRadius: '6px', padding: '0 10px', cursor: 'pointer' }}
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

export function MachineOperationsTab({
  selectedNom, setSelectedNom,
  selectedMachine, setSelectedMachine,
  side1Ops, setSide1Ops,
  side2OpsF2, setSide2OpsF2,
  side2OpsF15, setSide2OpsF15,
  side2CutOpsF2, setSide2CutOpsF2,
  side2CutOpsF15, setSide2CutOpsF15,
  cuttersList, setCuttersList,
  uploading, setUploading,
  searchQuery, setSearchQuery
}) {
  const { nomenclatures, machines, machineOperations, supabase, bomItems, refreshTable } = useMES()

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
    refreshTable('machine_operations')
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

  const filteredOps = (machineOperations || []).filter(op => {
    if (!searchQuery) return true
    const nom = nomenclatures.find(n => n.id === op.nomenclature_id)
    return nom?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ background: '#111', padding: '20px', borderRadius: '16px', border: '1px solid #222' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Збережені операції ({filteredOps.length})</h2>
          <input 
            type="text" 
            placeholder="Пошук по номенклатурі..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '250px', padding: '10px 15px', background: '#000', border: '1px solid #333', color: '#fff', borderRadius: '8px' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredOps.map(op => {
            const nom = nomenclatures.find(n => n.id === op.nomenclature_id)
            const mac = machines.find(m => m.id === op.machine_id)
            const macText = op.machine_type || mac?.name || '—'
            return (
              <div key={op.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0a0a0a', padding: '12px', borderRadius: '10px', border: '1px solid #222' }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{nom?.name || '—'}</div>
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>Верстат: {macText}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => {
                      setSelectedNom(op.nomenclature_id)
                      setSelectedMachine(op.machine_type || op.machine_id)
                    }}
                    style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800 }}
                  >
                    Редагувати
                  </button>
                  <button 
                    onClick={async () => {
                      if (window.confirm('Видалити операції для цієї позиції?')) {
                        await supabase.from('machine_operations').delete().eq('id', op.id)
                        refreshTable('machine_operations')
                      }
                    }}
                    style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Manual editing */}
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
              {renderCutterListEditorShared(cuttersList, setCuttersList, nomenclatures)}
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
