import React from 'react'
import { Hash, Cpu, Zap, Activity, CheckCircle2, MapPin, ClipboardList } from 'lucide-react'
import { MACHINE_TYPES } from '../hooks/useMachinesData.js'

export function MachinesFormCard({ showAdd, form, setForm, handleSubmit }) {
  if (!showAdd) return null

  return (
    <div className="glass-panel anim-slide-down machines-form-card">
      <h3 className="machines-form-title">
        {form.id ? 'Редагування верстата' : 'Параметри нового обладнання'}
      </h3>
      <form onSubmit={handleSubmit} className="machines-form-body">
        <div className="machines-form-grid-1">
          <div className="input-group">
            <label><Hash size={12}/> Назва</label>
            <input 
              placeholder="напр. Laser Alpha-1" 
              value={form.name} 
              onChange={e => setForm({...form, name: e.target.value})} 
              required 
            />
          </div>
          <div className="input-group">
            <label><Cpu size={12}/> Тип станка</label>
            <select 
              className="machines-form-select" 
              value={form.type} 
              onChange={e => setForm({...form, type: e.target.value})} 
              required
            >
              {MACHINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label><Zap size={12}/> Місткість (л.)</label>
            <input 
              type="number" 
              value={form.capacity} 
              onChange={e => setForm({...form, capacity: e.target.value})} 
              required 
            />
          </div>
          <div className="input-group">
            <label><Activity size={12}/> Статус верстата</label>
            <select 
              className="machines-form-select" 
              value={form.status || 'idle'} 
              onChange={e => setForm({...form, status: e.target.value})} 
              required
            >
              <option value="idle">Вільний (в роботі)</option>
              <option value="repair">В ремонті</option>
            </select>
          </div>
        </div>

        <div className="machines-form-grid-2">
          <div className="input-group">
            <label><Hash size={12}/> Порядковий № (в розкрій)</label>
            <input 
              placeholder="напр. 1" 
              value={form.sequence_number} 
              onChange={e => setForm({...form, sequence_number: e.target.value})} 
            />
          </div>
          <div className="input-group">
            <label><CheckCircle2 size={12}/> Інвентарний №</label>
            <input 
              placeholder="INV-2024-001" 
              value={form.inventory_no} 
              onChange={e => setForm({...form, inventory_no: e.target.value})} 
            />
          </div>
          <div className="input-group">
            <label><MapPin size={12}/> Локація / Поверх</label>
            <input 
              placeholder="напр. 2 поверх" 
              value={form.floor} 
              onChange={e => setForm({...form, floor: e.target.value})} 
            />
          </div>
          <div className="input-group">
            <label><ClipboardList size={12}/> Додатковий опис</label>
            <input 
              placeholder="Технічні особливості..." 
              value={form.description} 
              onChange={e => setForm({...form, description: e.target.value})} 
            />
          </div>
        </div>

        <button type="submit" className="machines-form-submit-btn">
          {form.id ? 'ЗБЕРЕГТИ ЗМІНИ' : 'ЗАРЕЄСТРУВАТИ ВЕРСТАТ'}
        </button>
      </form>
    </div>
  )
}
