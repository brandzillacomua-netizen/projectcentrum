import React, { useState, useMemo } from 'react'
import { Trash2 } from 'lucide-react'
import { useMES } from '../../../MESContext'
import { useV2NomenclaturesData } from '../utils/engineerHelpers.jsx'

export function EngineerCuttersTab() {
  const { supabase, refreshTable } = useMES()
  const nomenclatures = useV2NomenclaturesData(supabase)
  
  const [newCutterName, setNewCutterName] = useState('')
  const [newCutterDiam, setNewCutterDiam] = useState('')
  const [saving, setSaving] = useState(false)
  const [assigningId, setAssigningId] = useState(null)

  // Generic cutter types (nomenclatures where type === 'cutter_type')
  const cutterTypes = useMemo(() => {
    return (nomenclatures || []).filter(n => n.type === 'cutter_type')
  }, [nomenclatures])

  // Physical stock cutters: nomenclatures of type === 'consumable' containing 'фреза' in name (case-insensitive)
  const physicalCutters = useMemo(() => {
    return (nomenclatures || []).filter(n => n.type === 'consumable' && (n.name || '').toLowerCase().includes('фреза'))
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
      const { error } = await supabase.from('nomenclatures_v2').insert([payload]).select()
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
      const assigned = physicalCutters.filter(p => String(p.characteristic) === String(id))
      if (assigned.length > 0) {
        if (!confirm(`Цей тип фрези призначено для ${assigned.length} фізичних фрез. Якщо видалити його, вони стануть не призначеними. Продовжити?`)) return
        for (const cutter of assigned) {
          await supabase.from('nomenclatures_v2').update({ characteristic: null }).eq('id', cutter.id)
        }
      }
      
      const { error } = await supabase.from('nomenclatures_v2').delete().eq('id', id)
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
