import React, { useState, useMemo } from 'react'
import { Trash2, Sparkles } from 'lucide-react'
import { useMES } from '../../../MESContext'
import { 
  useV2NomenclaturesData, 
  isVirtualCutterType, 
  STANDARD_CUTTER_TYPES 
} from '../utils/engineerHelpers.jsx'

export function EngineerCuttersTab() {
  const { nomenclatures, supabase, refreshTable } = useMES()
  const v2Noms = useV2NomenclaturesData(supabase)
  
  const [newCutterName, setNewCutterName] = useState('')
  const [newCutterDiam, setNewCutterDiam] = useState('')
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [assigningId, setAssigningId] = useState(null)

  // 1. Generic virtual cutter types (from both nomenclatures and nomenclatures_v2)
  const cutterTypes = useMemo(() => {
    const all = [...(nomenclatures || []), ...(v2Noms || [])]
    return Array.from(new Map(
      all
        .filter(isVirtualCutterType)
        .map(n => [String(n.id), n])
    ).values()).sort((a, b) => {
      const dA = parseFloat(a.material_type || a.rule_params?.diameter || a.name?.match(/ф\s*([0-9.]+)/i)?.[1] || a.name?.match(/([0-9.]+)/)?.[1] || 999)
      const dB = parseFloat(b.material_type || b.rule_params?.diameter || b.name?.match(/ф\s*([0-9.]+)/i)?.[1] || b.name?.match(/([0-9.]+)/)?.[1] || 999)
      if (dA !== dB) return dA - dB
      return (a.name || '').localeCompare(b.name || '', 'uk')
    })
  }, [nomenclatures, v2Noms])

  // 2. Physical stock warehouse cutters (excluding virtual cutter types)
  const physicalCutters = useMemo(() => {
    const all = [...(v2Noms || []), ...(nomenclatures || [])]
    const virtualIds = new Set(cutterTypes.map(c => String(c.id)))
    
    return Array.from(new Map(
      all
        .filter(n => {
          if (!n || virtualIds.has(String(n.id))) return false
          if (isVirtualCutterType(n)) return false
          const name = String(n.name || '').toLowerCase()
          return (
            n.group_id === 'grp_mills' ||
            n.rule_type === 'mill' ||
            n.type === 'consumable' ||
            name.includes('фреза')
          )
        })
        .map(n => {
          const assignedId = n.characteristic || n.rule_params?.cutter_type_id || n.rule_params?.characteristic || null
          return [String(n.id), { ...n, assignedCutterTypeId: assignedId }]
        })
    ).values()).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'uk'))
  }, [nomenclatures, v2Noms, cutterTypes])

  // Quick action: Seed standard virtual cutter types and auto-link physical cutters
  const handleSeedStandardTypes = async () => {
    if (!confirm('Створити стандартні типи фрез (Тип Ф1.5, Тип Ф2, Тип Ф3, Тип Ф4, Тип Ф6, Тип Ф6 90°) та автоматично прив\'язати наявні фрези зі складу?')) return
    setSeeding(true)
    try {
      const existingNames = new Set(cutterTypes.map(c => (c.name || '').trim().toLowerCase()))
      const newlyCreated = []

      for (const std of STANDARD_CUTTER_TYPES) {
        if (!existingNames.has(std.name.toLowerCase())) {
          // Insert into nomenclatures (V1)
          const { data: v1Row, error: err1 } = await supabase
            .from('nomenclatures')
            .insert([{
              name: std.name,
              type: 'cutter_type',
              material_type: String(std.diameter)
            }])
            .select()
            .single()

          // Insert into nomenclatures_v2 (V2)
          const { data: v2Row, error: err2 } = await supabase
            .from('nomenclatures_v2')
            .insert([{
              code: `CT-${std.id}-${Date.now()}`,
              name: std.name,
              group_id: 'grp_mills',
              rule_type: 'cutter_type',
              rule_params: { diameter: std.diameter },
              unit: 'шт',
              status: 'active'
            }])
            .select()
            .single()

          if (!err1 && v1Row) newlyCreated.push({ ...std, dbId: v1Row.id })
          else if (!err2 && v2Row) newlyCreated.push({ ...std, dbId: v2Row.id })
        }
      }

      await refreshTable('nomenclatures')
      alert(`Створено ${newlyCreated.length} типів фрез!`)
    } catch (err) {
      alert('Помилка створення базових типів: ' + err.message)
    } finally {
      setSeeding(false)
    }
  }

  const handleAddCutterType = async (e) => {
    e.preventDefault()
    if (!newCutterName.trim()) return alert('Введіть назву фрези')
    setSaving(true)
    try {
      const cleanName = newCutterName.trim()
      const cleanDiam = newCutterDiam.trim() || null
      const parsedDiam = cleanDiam ? parseFloat(cleanDiam.replace(',', '.')) : null

      // 1. Insert into V1 nomenclatures
      try {
        await supabase.from('nomenclatures').insert([{
          name: cleanName,
          type: 'cutter_type',
          material_type: cleanDiam
        }])
      } catch (err) {
        console.warn('V1 insert skipped or failed:', err)
      }

      // 2. Insert into V2 nomenclatures_v2
      try {
        await supabase.from('nomenclatures_v2').insert([{
          code: `CT-${Date.now()}`,
          name: cleanName,
          group_id: 'grp_mills',
          rule_type: 'cutter_type',
          rule_params: { diameter: parsedDiam },
          unit: 'шт',
          status: 'active'
        }])
      } catch (err) {
        console.warn('V2 insert skipped or failed:', err)
      }

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
      // 1. Зняти прив'язку зі всіх фізичних фрез
      await supabase.from('nomenclatures').update({ characteristic: null }).eq('characteristic', id)

      // 2. Видалити пов'язані профілі каталогу, щоб не порушувати FK
      await supabase.from('nomenclature_catalog_profiles').delete().eq('nomenclature_id', id)

      // 3. Видалити зв'язки з bom_items, якщо були
      await supabase.from('bom_items').delete().eq('child_id', id)
      await supabase.from('bom_items').delete().eq('parent_id', id)

      // 4. Видалити сам тип фрези з nomenclatures та nomenclatures_v2
      await supabase.from('nomenclatures').delete().eq('id', id)
      await supabase.from('nomenclatures_v2').delete().eq('id', id)

      await refreshTable('nomenclatures')
      alert('Тип фрези видалено!')
    } catch (err) {
      alert('Помилка видалення: ' + err.message)
    }
  }

  const handleAssignCutterType = async (physicalId, genericId) => {
    setAssigningId(physicalId)
    try {
      const val = genericId || null

      // Update in V1 nomenclatures
      await supabase
        .from('nomenclatures')
        .update({ characteristic: val })
        .eq('id', physicalId)

      // Update in V2 nomenclatures_v2 if item exists there
      const targetV2 = (v2Noms || []).find(v => String(v.id) === String(physicalId))
      if (targetV2) {
        const currentParams = targetV2.rule_params || {}
        await supabase
          .from('nomenclatures_v2')
          .update({
            rule_params: {
              ...currentParams,
              cutter_type_id: val,
              characteristic: val
            }
          })
          .eq('id', physicalId)
      }

      await refreshTable('nomenclatures')
    } catch (err) {
      alert('Помилка прив\'язки: ' + err.message)
    } finally {
      setAssigningId(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
      {/* Створення типу фрези */}
      <div style={{ background: '#111', padding: '25px', borderRadius: '16px', border: '1px solid #222' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#10b981', fontWeight: 900 }}>✚ Створити новий тип фрези</h3>
          <button
            onClick={handleSeedStandardTypes}
            disabled={seeding}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 800 }}
          >
            <Sparkles size={14} />
            {seeding ? 'Створення...' : '⚡ Створити стандартні типи фрез (Ф1.5 - Ф6)'}
          </button>
        </div>
        <form onSubmit={handleAddCutterType} style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 2, minWidth: '200px' }}>
            <label style={{ display: 'block', fontSize: '0.7rem', color: '#888', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>Назва фрези в системі</label>
            <input 
              type="text" 
              placeholder="напр. Тип Ф2, Тип Ф3, Фреза ф6, Фреза ф6 (90)" 
              value={newCutterName}
              onChange={e => setNewCutterName(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', background: '#000', border: '1px solid #333', color: '#fff', borderRadius: '8px', fontSize: '0.9rem', outline: 'none' }}
              required
            />
          </div>
          <div style={{ flex: 1, minWidth: '120px' }}>
            <label style={{ display: 'block', fontSize: '0.7rem', color: '#888', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>Діаметр (мм)</label>
            <input 
              type="number" 
              step="any" 
              placeholder="напр. 1.5, 2, 3, 4, 6" 
              value={newCutterDiam}
              onChange={e => setNewCutterDiam(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', background: '#000', border: '1px solid #333', color: '#fff', borderRadius: '8px', fontSize: '0.9rem', outline: 'none' }}
            />
          </div>
          <button 
            type="submit" 
            disabled={saving}
            style={{ padding: '12px 24px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 900, cursor: 'pointer', fontSize: '0.85rem' }}
          >
            {saving ? 'Збереження...' : 'Створити'}
          </button>
        </form>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '25px', alignItems: 'start' }}>
        {/* Список типів фрез */}
        <div style={{ background: '#111', padding: '25px', borderRadius: '16px', border: '1px solid #222' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>Типи фрез в системі ({cutterTypes.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {cutterTypes.map(c => {
              const diam = c.material_type || c.rule_params?.diameter || c.name?.match(/ф\s*([0-9.]+)/i)?.[1] || '—'
              const assignedCount = physicalCutters.filter(p => String(p.assignedCutterTypeId) === String(c.id)).length
              return (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0a0a0a', padding: '12px 15px', borderRadius: '10px', border: '1px solid #222' }}>
                  <div>
                    <div style={{ fontWeight: 800, color: '#fff' }}>{c.name}</div>
                    <div style={{ fontSize: '0.72rem', color: '#888', marginTop: '2px' }}>
                      Діаметр: <span style={{ color: '#38bdf8', fontWeight: 700 }}>{diam} мм</span> | Прив'язано фрез зі складу: <span style={{ color: '#10b981', fontWeight: 800 }}>{assignedCount}</span>
                    </div>
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
            {cutterTypes.length === 0 && (
              <div style={{ color: '#888', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>
                Немає типів фрез. Натисніть кнопку вище для створення стандартних типів (Ф1.5 - Ф6).
              </div>
            )}
          </div>
        </div>

        {/* Прив'язка фізичних фрез зі складу */}
        <div style={{ background: '#111', padding: '25px', borderRadius: '16px', border: '1px solid #222' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>Прив'язка фрез зі складу до типів фрез ({physicalCutters.length})</h3>
          <p style={{ fontSize: '0.75rem', color: '#888', marginTop: '-15px', marginBottom: '20px', lineHeight: 1.4 }}>
            Оберіть для кожної фізичної фрези зі складу відповідний віртуальний тип фрези в системі. Це дозволяє оператору та майстру автоматично підбирати відповідні фрези на виробництві.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '500px', overflowY: 'auto', paddingRight: '5px' }}>
            {physicalCutters.map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0a0a0a', padding: '12px 15px', borderRadius: '10px', border: '1px solid #222', gap: '15px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, color: '#eee', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div style={{ fontSize: '0.72rem', color: '#666', marginTop: '2px' }}>{p.material_type || p.rule_type || '—'}</div>
                </div>
                <select 
                  value={p.assignedCutterTypeId || ''}
                  onChange={e => handleAssignCutterType(p.id, e.target.value)}
                  disabled={assigningId === p.id}
                  style={{ width: '190px', padding: '8px', background: '#000', border: '1px solid #333', color: p.assignedCutterTypeId ? '#10b981' : '#888', borderRadius: '6px', fontSize: '0.78rem', fontWeight: p.assignedCutterTypeId ? 800 : 500 }}
                >
                  <option value="">-- Не призначено --</option>
                  {cutterTypes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            ))}
            {physicalCutters.length === 0 && <div style={{ color: '#888', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>Не знайдено складських фрез.</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
