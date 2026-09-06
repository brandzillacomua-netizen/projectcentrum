import React from 'react'
import { Hash, Cpu, Zap, Activity, CheckCircle2, MapPin, ClipboardList } from 'lucide-react'
import { MACHINE_TYPES } from '../hooks/useMachinesData.js'

export function MachinesFormCard({ showAdd, form, setForm, handleSubmit }) {
  if (!showAdd) return null

  return (
    <div className="glass-panel anim-slide-down" style={{ background: '#0a0a0a', border: '1px solid #222', borderRadius: '28px', padding: '40px', marginBottom: '40px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
      <h3 style={{ fontSize: '0.75rem', fontWeight: 1000, color: '#ff9000', textTransform: 'uppercase', marginBottom: '25px', letterSpacing: '2px' }}>
        {form.id ? 'Редагування верстата' : 'Параметри нового обладнання'}
      </h3>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1.5fr', gap: '20px', marginBottom: '20px' }}>
           <div className="input-group">
              <label><Hash size={12}/> Назва</label>
              <input placeholder="напр. Laser Alpha-1" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
           </div>
           <div className="input-group">
              <label><Cpu size={12}/> Тип станка</label>
              <select style={{ width: '100%', background: '#000', border: '1px solid #222', color: '#fff', padding: '15px', borderRadius: '12px', fontSize: '0.9rem', outline: 'none', transition: '0.2s', cursor: 'pointer' }} value={form.type} onChange={e => setForm({...form, type: e.target.value})} required>
                {MACHINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
           </div>
           <div className="input-group">
              <label><Zap size={12}/> Місткість (л.)</label>
              <input type="number" value={form.capacity} onChange={e => setForm({...form, capacity: e.target.value})} required />
           </div>
           <div className="input-group">
              <label><Activity size={12}/> Статус верстата</label>
              <select style={{ width: '100%', background: '#000', border: '1px solid #222', color: '#fff', padding: '15px', borderRadius: '12px', fontSize: '0.9rem', outline: 'none', transition: '0.2s', cursor: 'pointer' }} value={form.status || 'idle'} onChange={e => setForm({...form, status: e.target.value})} required>
                <option value="idle">Вільний (в роботі)</option>
                <option value="repair">В ремонті</option>
              </select>
           </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr', gap: '20px' }}>
           <div className="input-group">
              <label><Hash size={12}/> Порядковий № (в розкрій)</label>
              <input placeholder="напр. 1" value={form.sequence_number} onChange={e => setForm({...form, sequence_number: e.target.value})} />
           </div>
           <div className="input-group">
              <label><CheckCircle2 size={12}/> Інвентарний №</label>
              <input placeholder="INV-2024-001" value={form.inventory_no} onChange={e => setForm({...form, inventory_no: e.target.value})} />
           </div>
           <div className="input-group">
              <label><MapPin size={12}/> Локація / Поверх</label>
              <input placeholder="напр. 2 поверх" value={form.floor} onChange={e => setForm({...form, floor: e.target.value})} />
           </div>
           <div className="input-group">
              <label><ClipboardList size={12}/> Додатковий опис</label>
              <input placeholder="Технічні особливості..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
           </div>
        </div>
        <button type="submit" style={{ background: '#fff', color: '#000', border: 'none', padding: '20px', borderRadius: '16px', fontWeight: 1000, cursor: 'pointer', fontSize: '1rem', marginTop: '10px' }}>
           {form.id ? 'ЗБЕРЕГТИ ЗМІНИ' : 'ЗАРЕЄСТРУВАТИ ВЕРСТАТ'}
        </button>
      </form>
    </div>
  )
}
