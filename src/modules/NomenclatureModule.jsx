import React, { useState, useEffect } from 'react'
import { 
  Settings as SettingsIcon, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  Layers,
  Box,
  Component,
  Nut,
  Search,
  Filter,
  Edit3,
  X,
  Check,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'

const NomenclatureModule = () => {
  const { 
    nomenclatures, upsertNomenclature, deleteNomenclature, 
    bomItems, syncBOM, loading 
  } = useMES()
  
  // Tabs & Search
  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedParent, setSelectedParent] = useState('')
  
  // Nomenclature Form State
  const [isEditing, setIsEditing] = useState(false)
  const [newNom, setNewNom] = useState({ 
    name: '', type: 'part', material_type: '', cnc_program: '', units_per_sheet: '', time_per_unit: '' 
  })

  // BOM Draft State
  const [draftBOM, setDraftBOM] = useState([])
  const [isSyncing, setIsSyncing] = useState(false)
  const [partToAdd, setPartToAdd] = useState({ child_id: '', qty: 1 })
  const [hwToAdd, setHwToAdd] = useState({ child_id: '', qty: 1 })

  // Sync Draft with DB when parent changes
  useEffect(() => {
    if (!selectedParent) {
      setDraftBOM([])
    } else {
      const saved = bomItems.filter(b => b.parent_id === selectedParent)
      setDraftBOM(saved.map(s => ({ ...s, qty: s.quantity_per_parent })))
    }
  }, [selectedParent, bomItems])

  const hasUnsavedChanges = selectedParent && JSON.stringify(draftBOM.map(d => ({c: d.child_id, q: Number(d.qty)}))) !== 
    JSON.stringify(bomItems.filter(b => b.parent_id === selectedParent).sort((a,b) => a.child_id > b.child_id ? 1 : -1).map(s => ({c: s.child_id, q: Number(s.quantity_per_parent)})))

  const types = [
    { id: 'product', label: 'Готовий виріб', icon: <Box size={16} />, color: '#ff9000' },
    { id: 'part', label: 'Деталь (Лазер)', icon: <Component size={16} />, color: '#3b82f6' },
    { id: 'hardware', label: 'Метизи / Комплектуючі', icon: <Nut size={16} />, color: '#22c55e' },
    { id: 'raw', label: 'Сировина', icon: <Layers size={16} />, color: '#eab308' },
    { id: 'expendable', label: 'Розхідники', icon: <Trash2 size={16} />, color: '#ef4444' }
  ]

  const handleSaveNom = (e) => {
    e.preventDefault()
    if (!newNom.name) return
    const payloadNom = {
      ...newNom,
      units_per_sheet: Number(newNom.units_per_sheet) || 0,
      time_per_unit: Number(newNom.time_per_unit) || 0
    }
    apiService.submitNomenclature(payloadNom, upsertNomenclature)
    cancelEdit()
  }

  const startEdit = (nom) => {
    setIsEditing(true)
    setNewNom({ ...nom })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setNewNom({ name: '', type: 'part', material_type: '', cnc_program: '', units_per_sheet: '', time_per_unit: '' })
  }

  // BOM Actions (Local Draft Only)
  const addToDraft = (type, data) => {
    if (!data.child_id) return
    const existing = draftBOM.find(d => d.child_id === data.child_id)
    if (existing) {
      setDraftBOM(draftBOM.map(d => d.child_id === data.child_id ? { ...d, qty: Number(d.qty) + Number(data.qty) } : d))
    } else {
      setDraftBOM([...draftBOM, { child_id: data.child_id, qty: data.qty }])
    }
    if (type === 'part') setPartToAdd({ child_id: '', qty: 1 })
    else setHwToAdd({ child_id: '', qty: 1 })
  }

  const removeFromDraft = (childId) => {
    setDraftBOM(draftBOM.filter(d => d.child_id !== childId))
  }

  const updateDraftQty = (childId, newQty) => {
    setDraftBOM(draftBOM.map(d => d.child_id === childId ? { ...d, qty: newQty } : d))
  }

  const handleSyncBOM = async () => {
    setIsSyncing(true)
    await apiService.submitBOM(selectedParent, draftBOM, syncBOM)
    setIsSyncing(false)
  }

  const filteredNomenclatures = nomenclatures.filter(n => {
    const matchesTab = activeTab === 'all' || n.type === activeTab
    const matchesSearch = n.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesTab && matchesSearch
  })

  // Grouping draft items for display
  const draftParts = draftBOM.filter(d => nomenclatures.find(n => n.id === d.child_id)?.type === 'part')
  const draftHardware = draftBOM.filter(d => {
    const t = nomenclatures.find(n => n.id === d.child_id)?.type
    return t === 'hardware' || t === 'expendable' || t === 'other'
  })

  return (
    <div className="module-page nomenclature-page">
      <nav className="module-nav">
        <Link to="/" className="back-link"><ArrowLeft size={20} /> Назад до Порталу</Link>
        <div className="module-title-group">
          <SettingsIcon className="text-muted" size={24} />
          <h1>Керування номенклатурою (Drone Factory)</h1>
        </div>
      </nav>

      <div className="module-content">
        <div className="nomenclature-grid">
          
          {/* Nomenclature Editor */}
          <div className="content-card entry-card glass-panel">
            <div className="card-header">
              <h3>
                {isEditing ? <Edit3 size={18} className="text-accent" /> : <Plus size={18} />} 
                {isEditing ? 'Редагування позиції' : 'Реєстрація нової позиції'}
              </h3>
              {isEditing && <button className="btn-cancel-edit" onClick={cancelEdit}><X size={14} /> Скасувати</button>}
            </div>
            
            <div className="type-selector-pills">
              {types.map(t => (
                <button key={t.id} className={`type-pill ${newNom.type === t.id ? 'active' : ''}`} onClick={() => setNewNom({...newNom, type: t.id})} style={newNom.type === t.id ? { backgroundColor: t.color, color: '#000' } : {}}>
                  {t.icon} <span>{t.label}</span>
                </button>
              ))}
            </div>

            <form onSubmit={handleSaveNom} className="nom-form">
              <div className="form-group main-group">
                <label>Назва моделі / артикулу</label>
                <input value={newNom.name} onChange={e => setNewNom({...newNom, name: e.target.value})} placeholder="напр. KHARAK 10.0" required />
              </div>

              {(newNom.type === 'part' || newNom.type === 'raw') && (
                <div className="form-grid">
                  <div className="form-group">
                    <label>Матеріал / Товщина</label>
                    {newNom.type === 'part' ? (
                      <select value={newNom.material_type} onChange={e => setNewNom({...newNom, material_type: e.target.value})} required>
                        <option value="">Оберіть сировину...</option>
                        {nomenclatures.filter(n => n.type === 'raw').map(n => <option key={n.id} value={`${n.name} (${n.material_type})`}>{n.name} ({n.material_type})</option>)}
                      </select>
                    ) : <input value={newNom.material_type} onChange={e => setNewNom({...newNom, material_type: e.target.value})} placeholder="напр. 3mm" />}
                  </div>
                  {newNom.type === 'part' && (
                    <><div className="form-group"><label>ЧПК (.dxf)</label><input value={newNom.cnc_program} onChange={e => setNewNom({...newNom, cnc_program: e.target.value})} /></div>
                    <div className="form-group"><label>шт/Лист</label><input type="number" value={newNom.units_per_sheet} onChange={e => setNewNom({...newNom, units_per_sheet: e.target.value})} /></div>
                    <div className="form-group"><label>Час вирізки/шт (хв)</label><input type="number" value={newNom.time_per_unit} onChange={e => setNewNom({...newNom, time_per_unit: e.target.value})} /></div></>
                  )}
                </div>
              )}
              <button type="submit" className={`btn-primary-glow full-width ${isEditing ? 'edit-mode' : ''}`}>
                {isEditing ? <Check size={18} /> : <Save size={18} />} {isEditing ? 'Оновити в базі' : 'Зберегти нову позицію'}
              </button>
            </form>
          </div>

          {/* BOM Editor with Save Button */}
          <div className="content-card bom-card glass-panel">
            <div className="card-header bom-header">
              <div className="h-left">
                <h3><Layers size={18} /> Склад комплекту (BOM)</h3>
                <p className="header-hint">Сформуйте склад виробу та натисніть "Зберегти"</p>
              </div>
              {hasUnsavedChanges && <div className="unsaved-badge"><AlertCircle size={14} /> Є незбережені зміни</div>}
            </div>
            
            <div className="bom-editor-content">
              <select value={selectedParent} onChange={e => setSelectedParent(e.target.value)} className="big-select">
                <option value="">-- Оберіть виріб для редагування --</option>
                {nomenclatures.filter(n => n.type === 'product').map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
              </select>

              {selectedParent && (
                <div className="bom-builder-sections">
                  <div className="bom-section">
                    <h4 className="section-title"><Component size={14} /> Деталі</h4>
                    <div className="bom-short-form">
                      <select value={partToAdd.child_id} onChange={e => setPartToAdd({...partToAdd, child_id: e.target.value})}>
                        <option value="">+ Додати деталь...</option>
                        {nomenclatures.filter(n => n.type === 'part').map(n => <option key={n.id} value={n.id}>{n.name} ({n.material_type})</option>)}
                      </select>
                      <input type="number" value={partToAdd.qty} onChange={e => setPartToAdd({...partToAdd, qty: e.target.value})} className="qty-mini" />
                      <button onClick={() => addToDraft('part', partToAdd)} className="btn-add-inline"><Plus size={16} /></button>
                    </div>
                    {draftParts.map(d => <DraftRow key={d.child_id} item={d} nomenclatures={nomenclatures} onRemove={removeFromDraft} onUpdate={updateDraftQty} />)}
                  </div>

                  <div className="bom-section">
                    <h4 className="section-title"><Nut size={14} /> Метизи</h4>
                    <div className="bom-short-form">
                      <select value={hwToAdd.child_id} onChange={e => setHwToAdd({...hwToAdd, child_id: e.target.value})}>
                        <option value="">+ Додати метиз...</option>
                        {nomenclatures.filter(n => n.type === 'hardware' || n.type === 'expendable').map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                      </select>
                      <input type="number" value={hwToAdd.qty} onChange={e => setHwToAdd({...hwToAdd, qty: e.target.value})} className="qty-mini" />
                      <button onClick={() => addToDraft('hw', hwToAdd)} className="btn-add-inline"><Plus size={16} /></button>
                    </div>
                    {draftHardware.map(d => <DraftRow key={d.child_id} item={d} nomenclatures={nomenclatures} onRemove={removeFromDraft} onUpdate={updateDraftQty} />)}
                  </div>

                  <button onClick={handleSyncBOM} className={`btn-save-bom full-width ${hasUnsavedChanges ? 'pulse' : ''}`} disabled={isSyncing || !hasUnsavedChanges}>
                    {isSyncing ? <Loader2 size={18} className="spin" /> : <Save size={18} />} 
                    Зберегти склад комплекту
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Global Register */}
          <div className="content-card full-width glass-panel">
            <div className="card-header register-header">
              <div className="header-left">
                <h3><Layers size={18} /> Глобальний реєстр позицій</h3>
                <div className="tab-menu">
                  {['all', 'product', 'part', 'hardware', 'raw', 'expendable'].map(t => (
                    <button key={t} className={activeTab === t ? 'active' : ''} onClick={() => setActiveTab(t)}>
                      {t === 'all' ? 'Всі' : types.find(type => type.id === t)?.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="header-right">
                <div className="search-box"><Search size={16} /><input placeholder="Пошук..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
              </div>
            </div>

            <div className="table-container">
              <table className="nom-table">
                <thead><tr><th>Тип</th><th>Назва / Артикул</th><th>Матеріал</th><th>CNC/Параметри</th><th>Час/шт</th><th>Дії</th></tr></thead>
                <tbody>
                  {filteredNomenclatures.map(n => {
                    const typeInfo = types.find(t => t.id === n.type)
                    return (
                      <tr key={n.id}>
                        <td width="160"><span className="type-badge" style={{ backgroundColor: `${typeInfo?.color}22`, color: typeInfo?.color }}>{typeInfo?.icon} {typeInfo?.label}</span></td>
                        <td className="important-text">{n.name} {n.material_type ? `(${n.material_type})` : ''}</td>
                        <td>{n.material_type || '—'}</td>
                        <td>{n.type === 'part' ? <div className="p-meta"><code>{n.cnc_program}</code> <span>{n.units_per_sheet}шт/л</span></div> : '—'}</td>
                        <td>{n.time_per_unit || 0} хв</td>
                        <td>
                          <div className="action-btns">
                            <button className="btn-action edit" onClick={() => startEdit(n)}><Edit3 size={14} /></button>
                            <button className="btn-action del" onClick={() => window.confirm(`Видалити?`) && apiService.submitDelete(n.id, 'nomenclature', deleteNomenclature)}><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .nomenclature-page { background: #080808; min-height: 100vh; color: #fff; }
        .nomenclature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(500px, 1fr)); gap: 30px; padding-bottom: 50px; align-items: start; }
        .full-width { grid-column: 1 / -1; }
        .glass-panel { background: rgba(20,20,20,0.4) !important; border: 1px solid #222 !important; backdrop-filter: blur(20px); border-radius: 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.6); }
        .content-card { padding: 30px; }
        .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; }
        .card-header h3 { font-size: 1.2rem; display: flex; align-items: center; gap: 12px; font-weight: 800; }
        .header-hint { color: #666; font-size: 0.8rem; margin: 5px 0; }
        
        .bom-header { align-items: center !important; }
        .unsaved-badge { background: rgba(255, 144, 0, 0.1); color: var(--primary); padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; display: flex; align-items: center; gap: 6px; border: 1px solid rgba(255, 144, 0, 0.2); }

        .btn-cancel-edit { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid #ef444444; padding: 4px 12px; border-radius: 8px; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 6px; }
        .type-selector-pills { display: flex; gap: 10px; margin-bottom: 25px; flex-wrap: wrap; }
        .type-pill { background: #111; border: 1px solid #222; padding: 8px 16px; border-radius: 12px; color: #555; font-size: 0.8rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.3s; }
        .nom-form { display: flex; flex-direction: column; gap: 20px; }
        .nom-form select, .nom-form input { width: 100%; padding: 12px; background: #000; border: 1px solid #333; color: #fff; border-radius: 10px; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .btn-primary-glow { background: var(--primary); color: #000; border: none; padding: 16px; border-radius: 14px; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 0 30px rgba(255,144,0,0.2); }
        .btn-primary-glow.edit-mode { background: #3b82f6; box-shadow: 0 0 30px rgba(59,130,246,0.3); }

        /* BOM Builder */
        .big-select { width: 100%; padding: 14px; background: #000; border: 1px solid var(--primary); color: #fff; border-radius: 12px; font-weight: 800; margin-bottom: 20px; }
        .bom-section { margin-bottom: 25px; }
        .section-title { font-size: 0.85rem; text-transform: uppercase; color: #555; margin: 0 0 15px; border-bottom: 1px solid #1a1a1a; padding-bottom: 8px; display: flex; align-items: center; gap: 10px; }
        .bom-short-form { display: grid; grid-template-columns: 1fr 80px 45px; gap: 10px; margin-bottom: 15px; }
        .bom-short-form select, .bom-short-form input { padding: 10px; background: #000; border: 1px solid #222; color: #fff; border-radius: 10px; }
        .btn-add-inline { background: var(--primary); border: none; color: #000; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        
        .bom-item-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; background: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 12px; margin-bottom: 10px; transition: 0.3s; }
        .row-info { font-size: 0.9rem; font-weight: 600; display: flex; align-items: center; gap: 10px; }
        .qty-inp-wrap { border: 1px solid #222; border-radius: 6px; display: flex; overflow: hidden; background: #000; }
        .qty-inp-wrap input { width: 50px; background: transparent; border: none; color: var(--primary); text-align: center; font-family: monospace; font-weight: 900; }
        .btn-row-del { color: #333; background: transparent; border: none; cursor: pointer; transition: 0.2s; }
        .btn-row-del:hover { color: #ef4444; }

        .btn-save-bom { background: #222; color: #888; border: 1px solid #333; padding: 18px; border-radius: 16px; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 12px; transition: 0.3s; margin-top: 20px; }
        .btn-save-bom.pulse { background: var(--primary); color: #000; border: none; box-shadow: 0 0 40px rgba(255, 144, 0, 0.3); }
        .btn-save-bom:disabled { opacity: 0.5; cursor: not-allowed; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from {transform: rotate(0deg)} to {transform: rotate(360deg)} }

        /* Table */
        .tab-menu { display: flex; gap: 10px; margin-top: 15px; }
        .tab-menu button { background: transparent; border: none; color: #444; font-weight: 900; font-size: 0.8rem; cursor: pointer; padding: 5px 12px; border-bottom: 2px solid transparent; }
        .tab-menu button.active { color: var(--primary); border-bottom-color: var(--primary); }
        .search-box { background: #000; border: 1px solid #222; padding: 10px 20px; border-radius: 14px; width: 300px; display: flex; align-items: center; gap: 12px; }
        .search-box input { background: transparent; border: none; color: #fff; width: 100%; outline: none; }
        .nom-table td { padding: 18px 15px; border-bottom: 1px solid #111; vertical-align: middle; }
        .action-btns { display: flex; gap: 10px; }
        .btn-action { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; border: none; background: #111; color: #444; }
        .btn-action.edit:hover { background: rgba(59,130,246,0.1); color: #3b82f6; }
        .btn-action.del:hover { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
      `}} />
    </div>
  )
}

const DraftRow = ({ item, nomenclatures, onRemove, onUpdate }) => {
  const child = nomenclatures.find(n => n.id === item.child_id)
  return (
    <div className="bom-item-row">
      <div className="row-info"><span>{child?.name}</span></div>
      <div className="row-ctrls" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div className="qty-inp-wrap">
          <input type="number" value={item.qty} onChange={e => onUpdate(item.child_id, e.target.value)} />
          <span style={{ padding: '0 8px', fontSize: '0.6rem', alignSelf: 'center', color: '#444' }}>шт</span>
        </div>
        <button onClick={() => onRemove(item.child_id)} className="btn-row-del"><Trash2 size={14} /></button>
      </div>
    </div>
  )
}

export default NomenclatureModule
