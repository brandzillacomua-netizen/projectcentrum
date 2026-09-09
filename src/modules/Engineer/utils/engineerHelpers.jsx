import React, { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'

export const MACHINE_TYPES = [
  'CNC 1200x800 - 4 листи (Малий)',
  'CNC 3050(16)х16 - 3-12 листів (швидкісний)',
  'CNC 3060х1600 - 3-36 листів (Три Головий)',
  'CNC 6000x2000 - 4 - 96 листів (Дракон)',
  'CNC KE XIN - 4 - 16 листів (ФЕЯ)'
]

export const isVirtualCutterType = (n) => {
  if (!n) return false
  if (n.type === 'cutter_type' || n.rule_type === 'cutter_type' || n.group_id === 'grp_cutter_types') return true
  const name = String(n.name || '').trim().toLowerCase()
  // Exclude physical warehouse cutters with dimensions (e.g. 1.5х3.175х6х50) or flute/shape descriptions
  if (name.includes('кукурудз') || name.includes('двопер') || name.includes('двохпер') || name.includes('однопер') || name.includes('компресій')) {
    return false
  }
  if (name.match(/[0-9]+[хx][0-9]+/)) {
    return false
  }
  // Matches "Тип Ф2", "Тип Ф3", "Фреза ф2", "Фреза ф1.5", "Ф2", "Ф3", "Ф6"
  if (name.startsWith('тип ф') || name.startsWith('тип f') || name.match(/^фреза\s+ф[0-9]/) || name.match(/^ф[0-9.]+(\s|$)/)) {
    return true
  }
  return false
}

export const STANDARD_CUTTER_TYPES = [
  { id: 'type_f15', name: 'Тип Ф1.5', diameter: 1.5 },
  { id: 'type_f2', name: 'Тип Ф2', diameter: 2.0 },
  { id: 'type_f3', name: 'Тип Ф3', diameter: 3.0 },
  { id: 'type_f4', name: 'Тип Ф4', diameter: 4.0 },
  { id: 'type_f6', name: 'Тип Ф6', diameter: 6.0 },
  { id: 'type_f6_90', name: 'Тип Ф6 (90°)', diameter: 6.0 }
]

export const renderCutterListEditorShared = (cutters, setCutters, nomenclatures, rawNoms = []) => {
  const allNoms = [...(rawNoms || []), ...(nomenclatures || [])]
  
  // Вибираємо тільки ВІРТУАЛЬНІ ТИПИ ФРЕЗ (Тип Ф2, Тип Ф3, Тип Ф4, Тип Ф6, Фреза ф1.5 тощо)
  let cutterNoms = Array.from(new Map(
    allNoms
      .filter(isVirtualCutterType)
      .map(n => [String(n.id), n])
  ).values())

  // Якщо в БД ще не створено віртуальних типів, надаємо системні стандартні типи
  if (cutterNoms.length === 0) {
    cutterNoms = STANDARD_CUTTER_TYPES.map(s => ({
      id: s.id,
      name: s.name,
      material_type: String(s.diameter)
    }))
  }

  // Сортуємо типи фрез строго за діаметром (1.5 -> 2 -> 3 -> 3.175 -> 4 -> 6 ...)
  cutterNoms.sort((a, b) => {
    const dA = parseFloat(a.material_type || a.rule_params?.diameter || a.name?.match(/ф\s*([0-9.]+)/i)?.[1] || a.name?.match(/([0-9.]+)/)?.[1] || 999)
    const dB = parseFloat(b.material_type || b.rule_params?.diameter || b.name?.match(/ф\s*([0-9.]+)/i)?.[1] || b.name?.match(/([0-9.]+)/)?.[1] || 999)
    if (dA !== dB) return dA - dB
    return (a.name || '').localeCompare(b.name || '', 'uk')
  })

  return (
    <div style={{ flex: '1 1 100%', minWidth: '280px', width: '100%', background: 'var(--card-header-bg, #f8fafc)', padding: '15px', borderRadius: '12px', border: '1px solid var(--border-color, #cbd5e1)' }}>
      <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span>⚙️ Витрата типів фрез на деталь / лист</span>
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {cutters.map((c, idx) => (
          <div key={idx} style={{ display: 'flex', gap: '5px', marginBottom: '8px', alignItems: 'center' }}>
            <select 
              value={c.nomId} 
              onChange={e => {
                const copy = [...cutters]
                copy[idx].nomId = e.target.value
                setCutters(copy)
              }}
              style={{ flex: 2, minWidth: 0, padding: '8px', background: 'var(--input-bg, #ffffff)', border: '1px solid var(--border-color, #cbd5e1)', color: 'var(--text-main, #0f172a)', borderRadius: '6px', fontSize: '0.8rem', outline: 'none' }}
            >
              <option value="">-- Оберіть тип фрези (Ф1.5, Ф2, Ф3, Ф4, Ф6...) --</option>
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
              style={{ width: '70px', flexShrink: 0, padding: '8px', background: 'var(--input-bg, #ffffff)', border: '1px solid var(--border-color, #cbd5e1)', color: '#f59e0b', borderRadius: '6px', fontSize: '0.8rem', textAlign: 'center', fontWeight: 800, outline: 'none' }}
            />
            <button 
              onClick={() => setCutters(cutters.filter((_, i) => i !== idx))}
              title="Видалити"
              style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0 10px', height: '34px', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button 
          onClick={() => setCutters([...cutters, { nomId: '', qty: 1 }])}
          style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px dashed var(--border-color, #cbd5e1)', color: '#10b981', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, marginTop: '4px' }}
        >
          + Додати тип фрези до витрат
        </button>
      </div>
    </div>
  )
}

export const combineOps = (f2Arr, f15Arr) => {
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

export const TYPE_COLORS = {
  product: '#d97706',   // amber (Виріб)
  part: '#2563eb',      // blue (Деталь)
  raw: '#059669',       // green (Сировина)
  hardware: '#dc2626',   // red (Метиз)
  consumable: '#dc2626', // red (Метиз)
  cutter: '#10b981',    // emerald (Фреза)
  assembly: '#7c3aed'   // indigo (Вузол)
}

export const TYPE_LABELS = {
  product: 'Виріб',
  part: 'Деталь',
  raw: 'Сировина',
  hardware: 'Метиз',
  consumable: 'Метиз',
  cutter: 'Фреза',
  assembly: 'Вузол'
}

import { classifyV2Type, mapV2ToStandardNom } from '../../Nomenclature/utils/nomenclatureHelpers.js'
export { classifyV2Type, mapV2ToStandardNom }

export const useV2NomenclaturesData = (supabase) => {
  const [v2Noms, setV2Noms] = useState([])
  const fetchV2 = async () => {
    try {
      const { data } = await supabase.from('nomenclatures_v2').select('*').order('name')
      if (data) {
        const mapped = data.map(v => mapV2ToStandardNom(v))
        setV2Noms(mapped)
      }
    } catch (e) {
      console.error('Error loading V2 items:', e)
    }
  }
  useEffect(() => {
    fetchV2()
    const handleRefresh = (e) => {
      const table = e.detail?.table
      if (table === 'nomenclatures' || table === 'nomenclatures_v2') {
        fetchV2()
      }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('mes:refresh-table', handleRefresh)
      return () => window.removeEventListener('mes:refresh-table', handleRefresh)
    }
  }, [])
  return v2Noms
}

export const autoClassify = (nom) => {
  if (!nom) return 'Деталі'
  const type = nom.type
  const name = (nom.name || '').toLowerCase()

  // 1. Raw materials first (carbon sheets/plates must not be caught by "пластина")
  if (
    type === 'raw' ||
    name.includes('карбон') ||
    name.includes('лист') ||
    name.includes('труба') ||
    name.includes('пруток') ||
    name.includes('склотекстоліт') ||
    name.includes('гума')
  ) {
    return 'Сировина (Листи, Труби)'
  }

  // 2. Hardware / Fasteners
  if (
    type === 'hardware' ||
    name.includes('гвинт') ||
    name.includes('гайка') ||
    name.includes('шайба') ||
    name.includes('шпилька') ||
    name.includes('заклепка') ||
    name.includes('стійка') ||
    name.includes('болт')
  ) {
    return 'Метизи'
  }

  // 3. Cutters / Tools
  if (type === 'cutter' || name.includes('фреза')) {
    return 'Інструмент (Фрези)'
  }

  // 4. Parts
  if (
    type === 'part' ||
    name.includes('деталь') ||
    name.includes('пластина') ||
    name.includes('проставка') ||
    name.includes('профіль') ||
    name.includes('рейка') ||
    name.includes('луч') ||
    name.includes('арм')
  ) {
    return 'Деталі'
  }

  // 5. Assemblies
  if (type === 'assembly' || name.includes('вузол') || name.includes('комплект')) {
    return 'Комплектуючі'
  }

  if (type === 'consumable') {
    return 'Метизи'
  }

  return 'Метизи'
}
