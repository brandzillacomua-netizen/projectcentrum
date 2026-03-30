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
  const { nomenclatures, upsertNomenclature, deleteNomenclature, bomItems, saveBOM, removeBOM } = useMES()
  const [newNom, setNewNom] = useState({ name: '', units_per_sheet: '', time_per_unit: '', material_type: '', cnc_program: '' })
  
  const [selectedParent, setSelectedParent] = useState('')
  const [bomPart, setBomPart] = useState({ child_id: '', qty: 1 })

  const handleSave = (e) => {
    e.preventDefault()
    if (!newNom.name) return
    upsertNomenclature({
      name: newNom.name,
      units_per_sheet: Number(newNom.units_per_sheet),
      time_per_unit: Number(newNom.time_per_unit),
      material_type: newNom.material_type,
      cnc_program: newNom.cnc_program
    })
    setNewNom({ name: '', units_per_sheet: '', time_per_unit: '', material_type: '', cnc_program: '' })
  }

  const handleAddBOM = (e) => {
    e.preventDefault()
    if (!selectedParent || !bomPart.child_id) return
    saveBOM(selectedParent, bomPart.child_id, bomPart.qty)
    setBomPart({ ...bomPart, child_id: '' })
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
        <div className="settings-grid">
          {/* Add Nomenclature Card */}
          <div className="content-card settings-card">
            <div className="card-header">
              <h3><Plus size={18} /> Додати Номенклатуру</h3>
            </div>
            <form onSubmit={handleSave} className="settings-form">
              <div className="form-group">
                <label>Назва деталі / Виробу</label>
                <input 
                  value={newNom.name} 
                  onChange={e => setNewNom({...newNom, name: e.target.value})} 
                  placeholder="напр. KHARAK 10.0"
                />
              </div>
              <div className="form-grid-three">
                <div className="form-group">
                  <label>Метал / Товщина</label>
                  <input 
                    value={newNom.material_type} 
                    onChange={e => setNewNom({...newNom, material_type: e.target.value})}
                    placeholder="напр. T300-3"
                  />
                </div>
                <div className="form-group">
                  <label>Програма ЧПК</label>
                  <input 
                    value={newNom.cnc_program} 
                    onChange={e => setNewNom({...newNom, cnc_program: e.target.value})}
                    placeholder="filename.dxf"
                  />
                </div>
                <div className="form-group">
                  <label>Деталей/Лист</label>
                  <input 
                    type="number" 
                    value={newNom.units_per_sheet} 
                    onChange={e => setNewNom({...newNom, units_per_sheet: e.target.value})}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Середній час на 1 деталь (хв)</label>
                <input 
                  type="number" 
                  value={newNom.time_per_unit} 
                  onChange={e => setNewNom({...newNom, time_per_unit: e.target.value})}
                />
              </div>
              <button type="submit" className="btn-primary full-width">
                <Save size={18} /> Зберегти позицію
              </button>
            </form>
          </div>

          {/* BOM Editor: Link Finished Product to Parts */}
          <div className="content-card settings-card">
            <div className="card-header">
              <h3><Layers size={18} /> Редактор Специфікацій (BOM)</h3>
            </div>
            <div className="bom-editor-wrap">
              <div className="parent-select">
                <label>Виберіть Готовий Виріб (Parent)</label>
                <select value={selectedParent} onChange={e => setSelectedParent(e.target.value)}>
                  <option value="">Оберіть виріб...</option>
                  {nomenclatures.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </div>

              {selectedParent && (
                <div className="bom-details">
                  <form onSubmit={handleAddBOM} className="bom-add-row">
                    <select value={bomPart.child_id} onChange={e => setBomPart({...bomPart, child_id: e.target.value})}>
                      <option value="">Додати запчастину / деталь...</option>
                      {nomenclatures.filter(n => n.id !== selectedParent).map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                    </select>
                    <input 
                      type="number" 
                      value={bomPart.qty} 
                      onChange={e => setBomPart({...bomPart, qty: e.target.value})} 
                      min="1"
                      className="qty-input"
                    />
                    <button type="submit" className="btn-icon text-accent"><Plus size={20} /></button>
                  </form>

                  <div className="bom-current-list">
                    <h4>Склад виробу:</h4>
                    {bomItems.filter(b => b.parent_id === selectedParent).map(b => {
                      const child = nomenclatures.find(n => n.id === b.child_id)
                      return (
                        <div key={b.id} className="bom-item-row">
                          <span>{child?.name}</span>
                          <div className="bom-item-right">
                            <strong>{b.quantity_per_parent} шт</strong>
                            <button onClick={() => removeBOM(b.id)} className="btn-icon text-danger"><Trash2 size={16} /></button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Master List Card */}
          <div className="content-card full-width">
            <div className="card-header">
              <h3><Layers size={18} /> Глобальний реєстр номенклатури</h3>
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Назва моделі / Деталі</th>
                    <th>Матеріал (товщина)</th>
                    <th>Програма ЧПК</th>
                    <th>шт/Лист</th>
                    <th>Час (хв)</th>
                    <th>Дії</th>
                  </tr>
                </thead>
                <tbody>
                  {nomenclatures.map(n => (
                    <tr key={n.id}>
                      <td><div className="nom-main">{n.name}</div></td>
                      <td>{n.material_type || '—'}</td>
                      <td><code className="prog-code">{n.cnc_program || '—'}</code></td>
                      <td>{n.units_per_sheet} шт</td>
                      <td>{n.time_per_unit} хв</td>
                      <td><button 
                        onClick={() => window.confirm(`Видалити "${n.name}"?`) && deleteNomenclature(n.id)}
                        className="btn-icon text-danger">
                        <Trash2 size={16} />
                      </button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 30px; }
        .full-width { grid-column: 1 / -1; }
        .settings-card { background: rgba(30,30,30,0.5); border: 1px solid #333; }
        .settings-form { display: flex; flex-direction: column; gap: 15px; }
        .form-grid-three { display: grid; grid-template-columns: 1fr 1fr 0.6fr; gap: 15px; }
        
        /* BOM Editor Styles */
        .bom-editor-wrap { padding: 10px 0; }
        .parent-select { margin-bottom: 20px; }
        .parent-select select { width: 100%; padding: 12px; background: #111; border: 1px solid #ff9000; color: #fff; border-radius: 8px; font-weight: 700; }
        
        .bom-add-row { display: grid; grid-template-columns: 1fr 80px 40px; gap: 10px; margin-bottom: 20px; }
        .bom-add-row select, .bom-add-row input { padding: 8px; background: #000; border: 1px solid #333; color: #eee; border-radius: 6px; }
        
        .bom-current-list h4 { font-size: 0.8rem; color: #666; text-transform: uppercase; margin-bottom: 15px; }
        .bom-item-row { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #121212; border-radius: 8px; margin-bottom: 8px; border: 1px solid #222; }
        .bom-item-right { display: flex; align-items: center; gap: 15px; }
        .bom-item-right strong { color: var(--primary); }
        
        /* Table enhancements */
        .data-table { width: 100%; border-collapse: separate; border-spacing: 0 8px; }
        .data-table th { text-align: left; padding: 12px 15px; color: #666; font-size: 0.75rem; text-transform: uppercase; font-weight: 800; }
        .data-table td { padding: 15px; background: #121212; border-top: 1px solid #333; border-bottom: 1px solid #333; color: #eee; }
        .data-table td:first-child { border-left: 1px solid #333; border-top-left-radius: 10px; border-bottom-left-radius: 10px; }
        .data-table td:last-child { border-right: 1px solid #333; border-top-right-radius: 10px; border-bottom-right-radius: 10px; }
      `}} />
    </div>
  )
}

export default SettingsModule

