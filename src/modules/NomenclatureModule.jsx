import React, { useState, useEffect } from 'react'
import { supabase } from '../supabase'
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
  Edit3,
  X,
  Check,
  AlertCircle,
  Loader2,
  FileUp,
  Clock
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'

const NomenclatureModule = () => {
  const { 
    nomenclatures, upsertNomenclature, deleteNomenclature, 
    bomItems, syncBOM, fetchData, loading 
  } = useMES()
  
  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedParent, setSelectedParent] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [newNom, setNewNom] = useState({ 
    name: '', type: 'part', material_type: '', cnc_program: '', units_per_sheet: '', time_per_unit: '', consumption_per_sheet: '' 
  })

  const [draftBOM, setDraftBOM] = useState([])
  const [isSyncing, setIsSyncing] = useState(false)
  const [partToAdd, setPartToAdd] = useState({ child_id: '', qty: 1 })

  useEffect(() => {
    if (!selectedParent) {
      setDraftBOM([])
    } else {
      const saved = bomItems.filter(b => b.parent_id === selectedParent)
      setDraftBOM(saved.map(s => ({ ...s, child_id: s.child_id, qty: s.quantity_per_parent })))
    }
  }, [selectedParent, bomItems])

  const hasUnsavedChanges = selectedParent && JSON.stringify(draftBOM.map(d => ({c: d.child_id, q: Number(d.qty)}))) !== 
    JSON.stringify(bomItems.filter(b => b.parent_id === selectedParent).sort((a,b) => a.child_id > b.child_id ? 1 : -1).map(s => ({c: s.child_id, q: Number(s.quantity_per_parent)})))

  const types = [
    { id: 'product', label: 'Готовий виріб', icon: <Box size={16} />, color: '#ff9000' },
    { id: 'part', label: 'Деталь (Лазер)', icon: <Component size={16} />, color: '#3b82f6' },
    { id: 'hardware', label: 'Метизи / Комплектуючі', icon: <Nut size={16} />, color: '#22c55e' },
    { id: 'raw', label: 'Сировина (Листи)', icon: <Layers size={16} />, color: '#eab308' },
    { id: 'consumable', label: 'Розхідники', icon: <Trash2 size={16} />, color: '#ef4444' }
  ]

  const handleSaveNom = (e) => {
    e.preventDefault()
    if (!newNom.name) return
    const payloadNom = {
      ...newNom,
      units_per_sheet: Number(newNom.units_per_sheet) || 0,
      time_per_unit: Number(newNom.time_per_unit) || 0,
      consumption_per_sheet: Number(newNom.consumption_per_sheet) || 0
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
    setNewNom({ name: '', type: 'part', material_type: '', cnc_program: '', units_per_sheet: '', time_per_unit: '', consumption_per_sheet: '' })
  }

  const addToDraft = (type, data) => {
    if (!data.child_id) return
    const existing = draftBOM.find(d => d.child_id === data.child_id)
    if (existing) {
      setDraftBOM(draftBOM.map(d => d.child_id === data.child_id ? { ...d, qty: Number(d.qty) + Number(data.qty) } : d))
    } else {
      setDraftBOM([...draftBOM, { child_id: data.child_id, qty: data.qty }])
    }
    setPartToAdd({ child_id: '', qty: 1 })
  }

  const removeFromDraft = (childId) => setDraftBOM(draftBOM.filter(d => d.child_id !== childId))

  const handleSyncBOM = async () => {
    setIsSyncing(true)
    await apiService.submitBOM(selectedParent, draftBOM, syncBOM)
    setIsSyncing(false)
  }


  const [importLogs, setImportLogs] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)

  const parseSpecCSV = (text) => {
    // Очищаємо текст від переносів рядків всередині лапок
    const cleanedText = text.replace(/"([^"]*)"/g, (m, p1) => `"${p1.replace(/\r?\n/g, ' ')}"`)
    const lines = cleanedText.split(/\r?\n/).filter(line => line.trim() !== '')
    if (lines.length === 0) return null

    // 1. Отримуємо Назву виробу (перший рядок)
    const firstLine = lines[0].replace(/^"Специфікація\s+""/, '').replace(/"""?,.*$/, '').trim()
    
    const result = {
      productName: firstLine,
      components: []
    }

    let currentCategory = 'structural'

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      // Регулярний вираз для розділення колонок з урахуванням лапок
      const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.trim().replace(/^"|"$/g, ''))

      // Перевірка на зміну категорії (тільки якщо перший стовпець порожній)
      const isHeader = !cols[0] || isNaN(parseInt(cols[0]))
      if (isHeader) {
        if (line.includes('Метизи')) { currentCategory = 'fastener'; continue }
        if (line.includes('Стійки')) { currentCategory = 'hardware'; continue }
        if (line.includes('Накладки')) { currentCategory = 'hardware'; continue }
        if (line.includes('Тримач')) { currentCategory = 'hardware'; continue }
      }

      const indexNum = parseInt(cols[0])
      if (!isNaN(indexNum) && cols[1]) {
        const desc = cols[3] || ''
        let thickness = ''; let unitsPerSheet = 0;
        const thickMatch = desc.match(/(\d+(?:\.\d+)?)\s*мм/i); if (thickMatch) thickness = thickMatch[1];
        const unitsMatch = desc.match(/(\d+)\s*шт/i); if (unitsMatch) unitsPerSheet = parseInt(unitsMatch[1]);

        result.components.push({
          name: cols[1],
          characteristics: cols[2],
          description: desc,
          qtyPerOne: parseFloat(cols[4]) || 1,
          category: currentCategory,
          thickness,
          unitsPerSheet
        })
      }
    }
    return result
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setIsProcessing(true); setImportLogs(['⏳ Зчитування файлу...'])
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const text = event.target.result
        const parsed = parseSpecCSV(text)
        if (!parsed || !parsed.productName) throw new Error("Не вдалося розпізнати назву виробу")
        setImportLogs(prev => [...prev, `📦 Знайдено виріб: ${parsed.productName}`, `🧩 Скдадових частин: ${parsed.components.length}`])

        const createdBOM = []

        // 1. Створюємо/Оновлюємо компоненти
        for (const comp of parsed.components) {
          // Формуємо розумну назву: якщо характеристика вже містить назву - не дублюємо
          const nameLower = comp.name.toLowerCase()
          const charLower = (comp.characteristics || '').toLowerCase()
          const fullName = charLower.includes(nameLower) 
            ? comp.characteristics 
            : (comp.characteristics ? `${comp.name} ${comp.characteristics}` : comp.name)
          
          setImportLogs(prev => [...prev, `🔍 Обробка: ${fullName}...`])
          
          let materialType = comp.category === 'structural' && comp.thickness ? `Лист T300 (${comp.thickness}мм)` : comp.characteristics || ''
          const payload = {
            name: fullName,
            type: comp.category === 'structural' ? 'part' : 'hardware',
            material_type: materialType,
            units_per_sheet: comp.unitsPerSheet || 0
          }
          
          // Шукаємо за повною назвою
          const existing = nomenclatures.find(n => n.name === fullName)
          if (existing) payload.id = existing.id
          
          const { data: upserted, error } = await supabase.from('nomenclatures').upsert([payload]).select()
          if (error) throw error
          if (upserted && upserted[0]) {
            createdBOM.push({ child_id: upserted[0].id, qty: comp.qtyPerOne })
          }
        }

        // 2. Створюємо батьківський виріб
        setImportLogs(prev => [...prev, `✨ Реєстрація комплекту: ${parsed.productName}...`])
        const existingParent = nomenclatures.find(n => n.name === parsed.productName)
        const parentPayload = { name: parsed.productName, type: 'product', material_type: 'Збірка' }
        if (existingParent) parentPayload.id = existingParent.id
        
        const { data: pData, error: pErr } = await supabase.from('nomenclatures').upsert([parentPayload]).select()
        if (pErr) throw pErr

        if (pData && pData[0]) {
          const parentId = pData[0].id
          setImportLogs(prev => [...prev, `🔗 Формування специфікації BOM...`])
          await syncBOM(parentId, createdBOM)
          setImportLogs(prev => [...prev, `✅ ІМПОРТ ЗАВЕРШЕНО УСПІШНО!`, `🎉 Виріб готовий до використання.`])
        }
        
        if (fetchData) fetchData()
        setIsProcessing(false)
      } catch (err) {
        setImportLogs(prev => [...prev, `❌ Помилка: ${err.message}`]); setIsProcessing(false)
      }
    }
    reader.readAsText(file)
  }

  const filteredNomenclatures = nomenclatures.filter(n => {
    const matchesTab = (activeTab === 'all' || activeTab === 'import') || n.type === activeTab
    const matchesSearch = n.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesTab && matchesSearch
  })

  return (
    <div className="nomenclature-module-v2" style={{ background: '#080808', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <nav className="module-nav" style={{ flexShrink: 0 }}>
        <Link to="/" className="back-link"><ArrowLeft size={18} /> <span className="hide-mobile">Назад</span></Link>
        <div className="module-title-group">
          <SettingsIcon className="text-muted" size={24} />
          <h1 className="hide-mobile">Керування номенклатурою</h1>
          <h1 className="mobile-only" style={{ fontSize: '1rem' }}>НОМЕНКЛАТУРА</h1>
        </div>
        <div className="tab-switcher-v2" style={{ display: 'flex', marginLeft: 'auto', background: '#111', padding: '4px', borderRadius: '10px' }}>
           <button onClick={() => setActiveTab('all')} style={{ background: activeTab === 'all' ? '#222' : 'transparent', border: 'none', color: '#fff', padding: '6px 15px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800 }}>БАЗА</button>
           <button onClick={() => setActiveTab('import')} style={{ background: activeTab === 'import' ? '#ff9000' : 'transparent', border: 'none', color: activeTab === 'import' ? '#000' : '#555', padding: '6px 15px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800 }}>ІМПОРТ CSV</button>
        </div>
      </nav>

      <div className="module-content" style={{ padding: '20px', overflowY: 'auto' }}>
        
        {activeTab === 'import' ? (
          <div className="import-section anim-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
             <div className="glass-panel" style={{ padding: '40px', borderRadius: '24px', textAlign: 'center', border: '2px dashed #333', background: 'rgba(20,20,20,0.4)' }}>
                <FileUp size={48} color="#ff9000" style={{ marginBottom: '20px', opacity: 0.5 }} />
                <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '10px' }}>Імпорт специфікацій</h2>
                <p style={{ color: '#555', marginBottom: '30px', fontSize: '0.9rem' }}>Завантажте CSV-файл специфікації. Система автоматично створить <br/> набори та зв'язки BOM.</p>
                
                <input 
                  type="file" 
                  accept=".csv" 
                  id="csv-upload" 
                  hidden 
                  onChange={handleFileUpload}
                  disabled={isProcessing}
                />
                <label htmlFor="csv-upload" style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  background: '#ff9000', 
                  color: '#000', 
                  padding: '15px 35px', 
                  borderRadius: '14px', 
                  fontWeight: 900, 
                  cursor: isProcessing ? 'default' : 'pointer',
                  opacity: isProcessing ? 0.5 : 1
                }}>
                  {isProcessing ? <Loader2 className="spin" size={20} /> : <Plus size={20} />} ОБРАТИ ФАЙЛ СПЕЦИФІКАЦІЇ
                </label>
             </div>

             {importLogs.length > 0 && (
               <div style={{ marginTop: '30px', background: '#000', borderRadius: '16px', border: '1px solid #1a1a1a', padding: '20px', maxHeight: '400px', overflowY: 'auto' }}>
                  <h4 style={{ margin: '0 0 15px', color: '#555', display: 'flex', alignItems: 'center', gap: '8px' }}><Clock size={16}/> Логи процесу:</h4>
                  {importLogs.map((log, i) => (
                    <div key={i} style={{ 
                      fontSize: '0.8rem', 
                      padding: '8px 0', 
                      borderBottom: '1px solid #111',
                      color: log.includes('✅') ? '#10b981' : log.includes('❌') ? '#ef4444' : '#888',
                      fontWeight: log.startsWith('📦') || log.startsWith('✨') ? 800 : 400
                    }}>
                      {log}
                    </div>
                  ))}
               </div>
             )}
          </div>
        ) : (
          <div className="nomenclature-grid-responsive">
            
            <div className="content-card entry-card glass-panel" style={{ padding: '25px', borderRadius: '24px', background: 'rgba(20,20,20,0.6)', border: '1px solid #222' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                {isEditing ? <Edit3 size={20} color="#ff9000" /> : <Plus size={20} />} 
                {isEditing ? 'Реагування' : 'Реєстрація нової позиції'}
              </h3>
              {isEditing && <button onClick={cancelEdit} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #ef444433', padding: '5px 12px', borderRadius: '8px', fontSize: '0.75rem', cursor: 'pointer' }}><X size={14} /> Скасувати</button>}
            </div>
            
            <div className="type-buttons-v2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', marginBottom: '25px' }}>
              {types.map(t => (
                <button key={t.id} onClick={() => setNewNom({...newNom, type: t.id})} style={{ 
                  background: newNom.type === t.id ? t.color : 'rgba(255,255,255,0.03)', 
                  color: newNom.type === t.id ? '#000' : '#444', 
                  border: '1px solid ' + (newNom.type === t.id ? t.color : '#222'), 
                  padding: '12px 10px', 
                  borderRadius: '12px', 
                  fontSize: '0.72rem', 
                  fontWeight: 900, 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  gap: '8px', 
                  transition: 'all 0.2s',
                  boxShadow: newNom.type === t.id ? `0 0 15px ${t.color}33` : 'none'
                }}>
                  {t.icon} <span>{t.label}</span>
                </button>
              ))}
            </div>

            <form onSubmit={handleSaveNom} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-group">
                <label style={{ fontSize: '0.65rem', color: '#ff9000', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>НАЗВА МОДЕЛІ / АРТИКУЛ</label>
                <input style={{ width: '100%', background: '#000', border: '1px solid #222', color: '#fff', padding: '14px', borderRadius: '12px', fontSize: '1.2rem', fontWeight: 700 }} value={newNom.name} onChange={e => setNewNom({...newNom, name: e.target.value})} placeholder="напр. KHARAK 10.0" required />
              </div>
 
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label style={{ fontSize: '0.65rem', color: '#ff9000', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>МАТЕРІАЛ / ТОВЩИНА</label>
                  {newNom.type === 'part' ? (
                    <select style={{ width: '100%', background: '#000', border: '1px solid #222', color: '#fff', padding: '14px', borderRadius: '12px', appearance: 'none' }} value={newNom.material_type} onChange={e => setNewNom({...newNom, material_type: e.target.value})} required>
                      <option value="">Оберіть сировину...</option>
                      {nomenclatures.filter(n => n.type === 'raw').map(n => <option key={n.id} value={n.name}>{n.name}</option>)}
                    </select>
                  ) : <input style={{ width: '100%', background: '#000', border: '1px solid #222', color: '#fff', padding: '14px', borderRadius: '12px' }} value={newNom.material_type} onChange={e => setNewNom({...newNom, material_type: e.target.value})} placeholder="..." />}
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '0.65rem', color: '#ff9000', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>ЧПК (.DXF)</label>
                  <input style={{ width: '100%', background: '#000', border: '1px solid #222', color: '#fff', padding: '14px', borderRadius: '12px' }} value={newNom.cnc_program} onChange={e => setNewNom({...newNom, cnc_program: e.target.value})} placeholder="..." />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label style={{ fontSize: '0.65rem', color: '#ff9000', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
                    {newNom.type === 'consumable' ? 'ВИТРАТА НА 1 ЛИСТ (ШТ)' : 'ШТ/ЛИСТ'}
                  </label>
                  <input type="number" step="0.01" style={{ width: '100%', background: '#000', border: '1px solid #222', color: '#fff', padding: '14px', borderRadius: '12px' }} value={newNom.type === 'consumable' ? newNom.consumption_per_sheet : newNom.units_per_sheet} onChange={e => setNewNom({...newNom, [newNom.type === 'consumable' ? 'consumption_per_sheet' : 'units_per_sheet']: e.target.value})} />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '0.65rem', color: '#ff9000', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
                    {newNom.type === 'consumable' ? 'РЕСУРС (ПРИБЛИЗНО)' : 'ЧАС РОЗКРОЮ/ШТ (ХВ)'}
                  </label>
                  <input type="number" step="0.01" style={{ width: '100%', background: '#000', border: '1px solid #222', color: '#fff', padding: '14px', borderRadius: '12px' }} value={newNom.time_per_unit} onChange={e => setNewNom({...newNom, time_per_unit: e.target.value})} />
                </div>
              </div>

              <button type="submit" style={{ width: '100%', padding: '18px', background: isEditing ? '#3b82f6' : '#ff9000', color: '#000', border: 'none', borderRadius: '16px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', fontSize: '1rem', marginTop: '10px' }}>
                {isEditing ? <Check size={20} /> : <Save size={20} />} {isEditing ? 'ОНОВИТИ ПОЗИЦІЮ' : 'ЗБЕРЕГТИ НОВУ ПОЗИЦІЮ'}
              </button>
            </form>
          </div>

          <div className="content-card bom-card glass-panel" style={{ padding: '25px', borderRadius: '24px', background: 'rgba(20,20,20,0.6)', border: '1px solid #222' }}>
            <h3 style={{ margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '10px' }}><Layers size={20} /> Специфікація BOM</h3>
            <select value={selectedParent} onChange={e => setSelectedParent(e.target.value)} style={{ width: '100%', padding: '15px', background: '#000', border: '1px solid #ff900033', color: '#fff', borderRadius: '12px', fontWeight: 800, marginBottom: '20px' }}>
              <option value="">-- Оберіть виріб --</option>
              {nomenclatures.filter(n => n.type === 'product').map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>

            {selectedParent && (
              <div className="bom-builder">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 45px', gap: '10px', marginBottom: '20px' }}>
                  <select style={{ background: '#000', border: '1px solid #222', color: '#fff', padding: '10px', borderRadius: '10px' }} value={partToAdd.child_id} onChange={e => setPartToAdd({...partToAdd, child_id: e.target.value})}>
                    <option value="">+</option>
                    {nomenclatures.filter(n => n.type === 'part' || n.type === 'hardware').map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                  </select>
                  <input type="number" style={{ background: '#000', border: '1px solid #222', color: '#fff', padding: '10px', borderRadius: '10px', textAlign: 'center' }} value={partToAdd.qty} onChange={e => setPartToAdd({...partToAdd, qty: e.target.value})} />
                  <button onClick={() => addToDraft('part', partToAdd)} style={{ background: '#ff9000', border: 'none', borderRadius: '10px', cursor: 'pointer' }}><Plus size={16} /></button>
                </div>
                <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '20px' }}>
                   {draftBOM.map(d => (
                     <div key={d.child_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#111', borderRadius: '8px', marginBottom: '5px' }}>
                        <span style={{ fontSize: '0.85rem', color: '#888' }}>{nomenclatures.find(n => n.id === d.child_id)?.name}</span>
                        <div style={{ display: 'flex', gap: '10px' }}>
                           <span style={{ color: '#ff9000', fontWeight: 800 }}>{d.qty} шт</span>
                           <Trash2 size={14} color="#ef4444" style={{ cursor: 'pointer' }} onClick={() => removeFromDraft(d.child_id)} />
                        </div>
                     </div>
                   ))}
                </div>
                <button onClick={handleSyncBOM} style={{ width: '100%', padding: '12px', background: hasUnsavedChanges ? '#ff9000' : '#222', color: hasUnsavedChanges ? '#000' : '#555', border: 'none', borderRadius: '10px', fontWeight: 900, cursor: 'pointer' }} disabled={isSyncing || !hasUnsavedChanges}>
                  <Save size={16} /> ЗБЕРЕГТИ СКЛАД ВИРОБУ
                </button>
              </div>
            )}
            {!selectedParent && <p style={{ color: '#333', fontSize: '0.8rem', textAlign: 'center', marginTop: '40px' }}>Оберіть виріб зі списку вище для перегляду або редагування його складу (BOM)</p>}
          </div>

          <div className="content-card full-width glass-panel" style={{ padding: '25px', borderRadius: '24px', background: 'rgba(20,20,20,0.6)', border: '1px solid #222', marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
               <h3 style={{ margin: 0 }}>Реєстр номенклатури</h3>
               <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#555' }} />
                  <input style={{ background: '#000', border: '1px solid #222', padding: '10px 15px 10px 40px', borderRadius: '10px', color: '#fff', width: '250px' }} placeholder="Пошук за назвою..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
               </div>
            </div>

            <div className="table-responsive-container hide-mobile">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#111', borderBottom: '1px solid #222' }}>
                    <th className="sticky-col" style={{ padding: '15px', textAlign: 'left', fontSize: '0.7rem', color: '#555', textTransform: 'uppercase' }}>Назва</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontSize: '0.7rem', color: '#555', textTransform: 'uppercase' }}>Тип</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontSize: '0.7rem', color: '#555', textTransform: 'uppercase' }}>Матеріал</th>
                    <th style={{ padding: '15px', textAlign: 'center', fontSize: '0.7rem', color: '#555', textTransform: 'uppercase' }}>Норма</th>
                    <th style={{ padding: '15px', textAlign: 'center', fontSize: '0.7rem', color: '#555', textTransform: 'uppercase' }}>Дії</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNomenclatures.map(n => {
                    const typeInfo = types.find(t => t.id === n.type)
                    return (
                      <tr key={n.id} style={{ borderBottom: '1px solid #151515' }}>
                        <td className="sticky-col" style={{ padding: '15px', fontWeight: 800 }}>{n.name}</td>
                        <td style={{ padding: '15px' }}><span style={{ color: typeInfo?.color, fontSize: '0.65rem', fontWeight: 900 }}>{typeInfo?.label.toUpperCase()}</span></td>
                        <td style={{ padding: '15px', color: '#666' }}>{n.material_type || '—'}</td>
                        <td style={{ padding: '15px', textAlign: 'center' }}>
                           {n.type === 'consumable' ? (
                             <span style={{ color: '#0ea5e9', fontWeight: 800 }}>{n.consumption_per_sheet || 0}</span>
                           ) : (
                             <span style={{ color: '#555' }}>{n.units_per_sheet || 0}</span>
                           )}
                           <span style={{ fontSize: '0.6rem', color: '#333', marginLeft: '5px' }}>/лист</span>
                        </td>
                        <td style={{ padding: '15px', textAlign: 'center' }}>
                           <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                             <Edit3 size={16} style={{ cursor: 'pointer', color: '#3b82f6' }} onClick={() => startEdit(n)} />
                             <Trash2 size={16} style={{ cursor: 'pointer', color: '#ef4444' }} onClick={() => window.confirm('Видалити цей елемент?') && apiService.submitDelete(n.id, 'nomenclature', deleteNomenclature)} />
                           </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mobile-only mobile-card-grid">
               {filteredNomenclatures.map(n => (
                 <div key={n.id} style={{ background: '#111', padding: '15px', borderRadius: '15px', marginBottom: '10px', border: '1px solid #222' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                       <span style={{ fontSize: '0.6rem', color: '#ff9000', fontWeight: 900 }}>{n.type.toUpperCase()}</span>
                       <div style={{ display: 'flex', gap: '15px' }}>
                          <Edit3 size={16} color="#555" onClick={() => startEdit(n)} />
                          <Trash2 size={16} color="#ef4444" onClick={() => window.confirm('Видалити?') && apiService.submitDelete(n.id, 'nomenclature', deleteNomenclature)} />
                       </div>
                    </div>
                    <strong>{n.name}</strong>
                    <div style={{ color: '#555', fontSize: '0.8rem', marginTop: '5px' }}>{n.material_type}</div>
                 </div>
               ))}
            </div>
          </div>
        </div>
      )}
    </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .nomenclature-grid-responsive { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; }
        .full-width { grid-column: 1 / -1; }
        @media (max-width: 1024px) {
          .nomenclature-grid-responsive { grid-template-columns: 1fr; }
        }
      `}} />
    </div>
  )
}

export default NomenclatureModule
