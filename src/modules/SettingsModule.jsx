import React, { useState } from 'react'
import { 
  Settings as SettingsIcon, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  Layers 
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'

const SettingsModule = () => {
  const { nomenclatures, upsertNomenclature } = useMES()
  const [newNom, setNewNom] = useState({ name: '', units_per_sheet: '', time_per_unit: '' })

  const handleSave = (e) => {
    e.preventDefault()
    if (!newNom.name) return
    upsertNomenclature({
      name: newNom.name,
      units_per_sheet: Number(newNom.units_per_sheet),
      time_per_unit: Number(newNom.time_per_unit)
    })
    setNewNom({ name: '', units_per_sheet: '', time_per_unit: '' })
  }

  return (
    <div className="module-page">
      <nav className="module-nav">
        <Link to="/" className="back-link"><ArrowLeft size={20} /> Назад до Порталу</Link>
        <div className="module-title-group">
          <SettingsIcon className="text-muted" />
          <h1>Налаштування Системи</h1>
        </div>
      </nav>

      <div className="module-content">
        <div className="dashboard-grid">
          {/* Add Nomenclature */}
          <div className="content-card">
            <div className="card-header">
              <h3><Plus size={18} /> Додати Номенклатуру</h3>
            </div>
            <form onSubmit={handleSave} className="order-form">
              <div className="form-group">
                <label>Назва деталі</label>
                <input 
                  value={newNom.name} 
                  onChange={e => setNewNom({...newNom, name: e.target.value})} 
                  placeholder="напр. Кронштейн А1"
                />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Деталей на 1 листі</label>
                  <input 
                    type="number" 
                    value={newNom.units_per_sheet} 
                    onChange={e => setNewNom({...newNom, units_per_sheet: e.target.value})}
                    placeholder="шт"
                  />
                </div>
                <div className="form-group">
                  <label>Час на 1 деталь (хв)</label>
                  <input 
                    type="number" 
                    step="1" 
                    value={newNom.time_per_unit} 
                    onChange={e => setNewNom({...newNom, time_per_unit: e.target.value})}
                    placeholder="хв"
                  />
                </div>
              </div>
              <button type="submit" className="btn-primary full-width" style={{ marginTop: '15px' }}>
                <Save size={18} /> Зберегти позицію
              </button>
            </form>
          </div>

          {/* Nomenclature List */}
          <div className="content-card">
            <div className="card-header">
              <h3><Layers size={18} /> База номенклатури</h3>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Назва</th>
                  <th>Деталей/Лист</th>
                  <th>Час/Деталь</th>
                  <th>Дії</th>
                </tr>
              </thead>
              <tbody>
                {nomenclatures.map(n => (
                  <tr key={n.id}>
                    <td>{n.name}</td>
                    <td>{n.units_per_sheet} шт</td>
                    <td>{n.time_per_unit} хв</td>
                    <td><button className="btn-icon text-danger"><Trash2 size={16} /></button></td>
                  </tr>
                ))}
                {nomenclatures.length === 0 && (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>База порожня</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .data-table { width: 100%; border-collapse: collapse; }
        .data-table th { text-align: left; padding: 12px; color: #888; font-size: 0.85rem; border-bottom: 1px solid #eee; }
        .data-table td { padding: 12px; border-bottom: 1px solid #f9f9f9; font-size: 0.95rem; }
        .text-danger { color: var(--danger); }
      `}} />
    </div>
  )
}

export default SettingsModule
