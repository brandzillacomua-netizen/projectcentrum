import React, { useState } from 'react'
import { 
  Settings, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  FileCode, 
  ShieldCheck,
  AlertCircle,
  BarChart3,
  Database,
  Upload,
  Plus,
  Trash2
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'

const MACHINE_TYPES = [
  'CNC 1200x800 - 4 листи (Малий)',
  'CNC 3050(16)х16 - 3-12 листів (швидкісний)',
  'CNC 3060х1600 - 3-36 листів (Три Головий)',
  'CNC 6000x2000 - 4 - 96 листів (Дракон)',
  'CNC KE XIN - 4 - 16 листів (ФЕЯ)'
]

const MachineOperationsTab = () => {
  const { nomenclatures, machines, machineOperations, supabase, bomItems } = useMES()
  const [selectedNom, setSelectedNom] = useState('')
  const [selectedMachine, setSelectedMachine] = useState('')
  const [side1Ops, setSide1Ops] = useState([])
  const [side2Ops, setSide2Ops] = useState([])
  const [side2CutOps, setSide2CutOps] = useState([])
  const [uploading, setUploading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Load existing if available
  React.useEffect(() => {
    if (selectedNom && selectedMachine) {
      const existing = machineOperations?.find(o => 
        o.nomenclature_id === selectedNom && 
        (o.machine_type === selectedMachine || o.machine_id === selectedMachine)
      )
      if (existing) {
        setSide1Ops(existing.side1_ops || [])
        setSide2Ops(existing.side2_ops || [])
        setSide2CutOps(existing.side2_cut_ops || [])
      } else {
        setSide1Ops([])
        setSide2Ops([])
        setSide2CutOps([])
      }
    }
  }, [selectedNom, selectedMachine, machineOperations])

  const handleSave = async () => {
    if (!selectedNom || !selectedMachine) return alert('Оберіть номенклатуру та тип верстата')
    const isType = MACHINE_TYPES.includes(selectedMachine)
    const payload = {
      nomenclature_id: selectedNom,
      machine_id: isType ? null : selectedMachine,
      machine_type: isType ? selectedMachine : null,
      side1_ops: side1Ops.filter(Boolean),
      side2_ops: side2Ops.filter(Boolean),
      side2_cut_ops: side2CutOps.filter(Boolean)
    }
    
    const existing = machineOperations?.find(o => 
      o.nomenclature_id === selectedNom && 
      (o.machine_type === selectedMachine || o.machine_id === selectedMachine)
    )
    if (existing) {
      await supabase.from('machine_operations').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('machine_operations').insert(payload)
    }
    alert('Збережено!')
  }

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)

    let successCount = 0
    let failMessages = []

    for (const file of files) {
      try {
        const text = await file.text()
        // Handle Windows (CRLF) and Unix (LF) line endings
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

        if (lines.length < 4) {
          throw new Error('Файл занадто короткий. Очікується мінімум 4 рядки.')
        }

        // Формат файлу:
        // Рядок 0: Назва станку (перша комірка)
        // Рядок 1: Назва номенклатури (перша комірка)
        // Рядок 2: Заголовки — пропускаємо
        // Рядки 3+: Операції — кожен рядок: "сторона1,сторона2,вирізка"

        const macName = lines[0].split(',')[0].trim()
        const nomName = lines[1].split(',')[0].trim()

        let detectedType = null
        let detectedMachineId = null

        // Розумне розпізнавання назв станків/типів з CSV файлу
        const normMac = macName.toLowerCase()
        if (normMac.includes('3050(16)x1600') || normMac.includes('3050(16)х1600') || normMac.includes('3050(16)') || normMac.includes('16x16') || normMac.includes('16х16')) {
          detectedType = 'CNC 3050(16)х16 - 3-12 листів (швидкісний)'
        } else if (normMac.includes('дракон') || normMac.includes('60x20') || normMac.includes('6000x2000') || normMac.includes('6000х2000')) {
          detectedType = 'CNC 6000x2000 - 4 - 96 листів (Дракон)'
        } else if (normMac.includes('малий') || normMac.includes('12x8') || normMac.includes('1200x800') || normMac.includes('12х8') || normMac.includes('1200х800')) {
          detectedType = 'CNC 1200x800 - 4 листи (Малий)'
        } else if (normMac.includes('три головий') || normMac.includes('триголовий') || normMac.includes('3060') || normMac.includes('30x16') || normMac.includes('30х16')) {
          detectedType = 'CNC 3060х1600 - 3-36 листів (Три Головий)'
        } else if (normMac.includes('фея') || normMac.includes('ke xin')) {
          detectedType = 'CNC KE XIN - 4 - 16 листів (ФЕЯ)'
        } else {
          // Check if matching a known machine type
          const exactType = MACHINE_TYPES.find(t => t.toLowerCase() === macName.toLowerCase() || t.toLowerCase().includes(macName.toLowerCase()))
          if (exactType) {
            detectedType = exactType
          } else {
            // Fallback to searching machine name
            const mac = machines.find(m => m.name.toLowerCase() === macName.toLowerCase() || m.name.toLowerCase().includes(macName.toLowerCase()))
            if (mac) {
              detectedType = mac.type || mac.name
              if (!MACHINE_TYPES.includes(detectedType)) {
                detectedMachineId = mac.id
                detectedType = null
              }
            }
          }
        }

        if (!detectedType && !detectedMachineId) {
          throw new Error(`Тип або верстат "${macName}" не знайдено в базі. Очікується один з типів:\n${MACHINE_TYPES.join('\n')}`)
        }

        const normalizeKey = (s) => {
          if (!s) return ''
          const homoglyphs = {
            'a': 'а', 'b': 'в', 'c': 'с', 'e': 'е', 'h': 'н', 'k': 'к', 'm': 'м', 'o': 'о', 'p': 'р', 't': 'т', 'x': 'х', 'y': 'у'
          }
          return s.toLowerCase()
            .replace(/[\r\n\s_\-]/g, '')
            .split('')
            .map(c => homoglyphs[c] || c)
            .join('')
        }

        const csvNomKey = normalizeKey(nomName)
        let nom = nomenclatures.find(n => normalizeKey(n.name) === csvNomKey)
          || nomenclatures.find(n => {
               const dbNomKey = normalizeKey(n.name)
               return csvNomKey.startsWith(dbNomKey) || dbNomKey.startsWith(csvNomKey)
             })

        if (!nom) {
          // Спробуємо знайти за найбільшим збігом токенів (частин назви)
          const getTokens = (s) => {
            if (!s) return []
            const homoglyphs = {
              'a': 'а', 'b': 'в', 'c': 'с', 'e': 'е', 'h': 'н', 'k': 'к', 'm': 'м', 'o': 'о', 'p': 'р', 't': 'т', 'x': 'х', 'y': 'у'
            }
            return s.toLowerCase()
              .split(/[\r\n\s_\-\(\),]/)
              .filter(Boolean)
              .map(tok => tok.split('').map(c => homoglyphs[c] || c).join(''))
          }

          const csvTokens = getTokens(nomName)
          let bestNom = null
          let bestScore = 0

          for (const n of nomenclatures) {
            const dbTokens = getTokens(n.name)
            let common = 0
            const tempDb = [...dbTokens]
            for (const t of csvTokens) {
              const idx = tempDb.indexOf(t)
              if (idx !== -1) {
                common++
                tempDb.splice(idx, 1)
              }
            }
            if (common > bestScore) {
              bestScore = common
              bestNom = n
            }
          }

          if (bestNom && (bestScore / csvTokens.length >= 0.7 || bestScore >= 4)) {
            nom = bestNom
          }
        }

        if (!nom) {
          throw new Error(`Номенклатура "${nomName}" не знайдена в базі.`)
        }

        const s1 = [], s2 = [], s2c = []
        for (let i = 3; i < lines.length; i++) {
          const parts = lines[i].split(',')
          if (parts[0]?.trim()) s1.push(parts[0].trim())
          if (parts[1]?.trim()) s2.push(parts[1].trim())
          if (parts[2]?.trim()) s2c.push(parts[2].trim())
        }

        const payload = {
          nomenclature_id: nom.id,
          machine_id: detectedMachineId,
          machine_type: detectedType,
          side1_ops: s1,
          side2_ops: s2,
          side2_cut_ops: s2c
        }

        // We must query the DB directly to find existing because we might have just inserted it in a previous loop iteration!
        const { data: dbOps } = await supabase
          .from('machine_operations')
          .select('id')
          .eq('nomenclature_id', nom.id)
          // We can't filter by machine_type easily if it's null, so we fetch all for this nomenclature and find in JS
        
        let existingId = null;
        if (dbOps && dbOps.length > 0) {
          // fetch full records to match machine_type / machine_id
          const { data: fullOps } = await supabase.from('machine_operations').select('*').in('id', dbOps.map(d => d.id))
          const existing = fullOps?.find(o => 
            ((detectedType && o.machine_type === detectedType) || (detectedMachineId && o.machine_id === detectedMachineId))
          )
          if (existing) existingId = existing.id
        }

        if (existingId) {
          await supabase.from('machine_operations').update(payload).eq('id', existingId)
        } else {
          await supabase.from('machine_operations').insert(payload)
        }
        
        successCount++
      } catch (err) {
        failMessages.push(`${file.name}: ${err.message}`)
      }
    }
    
    setUploading(false)
    e.target.value = ''
    
    if (failMessages.length > 0) {
      alert(`✅ Успішно завантажено: ${successCount}\n❌ Помилок: ${failMessages.length}\n\nДеталі:\n${failMessages.join('\n')}`)
    } else {
      alert(`✅ Успішно завантажено ${successCount} файлів!`)
    }
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111', padding: '20px', borderRadius: '16px', border: '1px solid #222' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Масове завантаження CSV</h2>
          <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#666' }}>Формат: рядок 1 — назва станку, рядок 2 — назва номенклатури, рядок 3 — заголовки, далі — операції по рядках (3 колонки через кому)</p>
        </div>
        <div>
          <label style={{ background: '#3b82f6', color: '#fff', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center', fontWeight: 600 }}>
            <Upload size={18} /> {uploading ? 'Завантаження...' : 'Обрати CSV файли (можна декілька)'}
            <input type="file" accept=".csv" multiple style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploading} />
          </label>
        </div>
      </div>

      {/* ── Список збережених операцій ── */}
      {machineOperations && machineOperations.length > 0 && (
        <div style={{ background: '#111', padding: '20px', borderRadius: '16px', border: '1px solid #222' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Збережені операції ({machineOperations.length})</h2>
            <input 
              type="text" 
              placeholder="Пошук по номенклатурі..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '250px', padding: '10px 15px', background: '#000', border: '1px solid #333', color: '#fff', borderRadius: '8px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {(() => {
              // Фільтрація по пошуку
              const filteredOps = machineOperations.filter(op => {
                if (!searchQuery) return true
                const nom = nomenclatures.find(n => n.id === op.nomenclature_id)
                return nom?.name?.toLowerCase().includes(searchQuery.toLowerCase())
              })

              // Групування по готовому виробу (через зв'язки BOM або по назві)
              const groupedOps = filteredOps.reduce((acc, op) => {
                const nom = nomenclatures.find(n => n.id === op.nomenclature_id)
                const name = nom?.name || 'Невідомо'
                
                // Знаходимо ВСІ готові вироби, в які входить ця деталь
                const bomLinks = bomItems?.filter(b => String(b.child_id) === String(op.nomenclature_id)) || []
                const parentNames = bomLinks.map(b => nomenclatures.find(n => String(n.id) === String(b.parent_id))?.name).filter(Boolean)
                
                if (parentNames.length > 0) {
                  // Якщо деталь є в кількох виробах, додаємо її операцію в кожну групу
                  parentNames.forEach(groupName => {
                    if (!acc[groupName]) acc[groupName] = []
                    acc[groupName].push({ op, nom })
                  })
                } else {
                  // Fallback: якщо немає зв'язку в специфікації
                  let groupName = null
                  const parts = name.split('-')
                  const singleLetterIdx = parts.findIndex(p => /^[a-zA-Zа-яА-ЯёЁіІїЇєЄґҐ]$/.test(p.trim()))
                  groupName = singleLetterIdx > 0
                    ? parts.slice(0, singleLetterIdx).join('-')
                    : (parts.length >= 2 ? parts.slice(0, 2).join('-') : name.split(' ')[0])
                  
                  if (!acc[groupName]) acc[groupName] = []
                  acc[groupName].push({ op, nom })
                }
                return acc
              }, {})

              if (Object.keys(groupedOps).length === 0) {
                return <div style={{ color: '#666', textAlign: 'center', padding: '20px' }}>Нічого не знайдено</div>
              }

              return Object.entries(groupedOps).sort((a, b) => a[0].localeCompare(b[0])).map(([groupName, items]) => (
                <div key={groupName} style={{ background: '#0a0a0a', border: '1px solid #222', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ background: '#1a1a1a', padding: '10px 15px', borderBottom: '1px solid #222', fontWeight: 800, color: '#aaa', fontSize: '0.9rem' }}>
                    Виріб: {groupName} ({items.length})
                  </div>
                  <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {items.sort((a, b) => (a.nom?.name || '').localeCompare(b.nom?.name || '')).map(({ op, nom }) => {
                      const mac = machines.find(m => m.id === op.machine_id)
                      const macText = op.machine_type || mac?.name || '—'
                      const opMachineKey = op.machine_type || op.machine_id
                      const isSelected = selectedNom === op.nomenclature_id && selectedMachine === opMachineKey
                      return (
                        <div key={op.id} style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          background: isSelected ? '#1a2a3a' : 'transparent',
                          border: `1px solid ${isSelected ? '#3b82f6' : '#222'}`,
                          borderRadius: '8px', padding: '10px 12px'
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{nom?.name || '—'}</div>
                            <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '2px' }}>{macText}</div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', fontSize: '0.7rem', color: '#555' }}>
                            <span style={{ background: '#1a1a2e', padding: '3px 8px', borderRadius: '20px', color: '#60a5fa' }}>1ст: {(op.side1_ops || []).length}</span>
                            <span style={{ background: '#1a1a2e', padding: '3px 8px', borderRadius: '20px', color: '#34d399' }}>2ст: {(op.side2_ops || []).length}</span>
                            <span style={{ background: '#1a1a2e', padding: '3px 8px', borderRadius: '20px', color: '#f59e0b' }}>вир: {(op.side2_cut_ops || []).length}</span>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedNom(op.nomenclature_id)
                              setSelectedMachine(op.machine_type || op.machine_id)
                              // scroll to manual edit section smoothly
                              window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
                            }}
                            style={{ padding: '6px 12px', background: isSelected ? '#3b82f6' : '#1e3a5f', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                          >
                            {isSelected ? '✓ Редагується' : 'Редагувати'}
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm(`Видалити операції для "${nom?.name}"?`)) return
                              await supabase.from('machine_operations').delete().eq('id', op.id)
                              if (isSelected) { setSelectedNom(''); setSelectedMachine('') }
                            }}
                            style={{ padding: '6px 10px', background: '#2a0a0a', color: '#ef4444', border: '1px solid #3a1a1a', borderRadius: '6px', cursor: 'pointer' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            })()}
          </div>
        </div>
      )}

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
            {machines.filter(m => !MACHINE_TYPES.includes(m.name)).map(m => (
              <option key={m.id} value={m.id}>{m.name} (Застаріле)</option>
            ))}
          </select>
        </div>

        {selectedNom && selectedMachine && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
              {renderOpList(side1Ops, setSide1Ops, 'Операція (1 сторона)')}
              {renderOpList(side2Ops, setSide2Ops, 'Операція (2 сторона)')}
              {renderOpList(side2CutOps, setSide2CutOps, 'Операція (2 сторона вирізка)')}
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

const EngineerModule = () => {
  const { tasks, orders, nomenclatures, approveEngineer } = useMES()
  const [activeTab, setActiveTab] = useState('tasks')
  
  const pendingTasks = tasks.filter(t => t.status === 'waiting' && !t.engineer_conf)
  const approvedCount = tasks.filter(t => t.status === 'waiting' && t.engineer_conf).length

  return (
    <div className="engineer-module-v2" style={{ background: '#080808', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <nav className="module-nav" style={{ flexShrink: 0 }}>
        <Link to="/" className="back-link"><ArrowLeft size={18} /> <span className="hide-mobile">На головну</span></Link>
        <div className="module-title-group">
          <Settings className="text-secondary" size={24} />
          <h1 className="hide-mobile">Робоче місце Інженера</h1>
          <h1 className="mobile-only" style={{ fontSize: '1rem' }}>ІНЖЕНЕР</h1>
        </div>
      </nav>

      <div className="module-content" style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button 
            onClick={() => setActiveTab('tasks')}
            style={{ padding: '10px 20px', background: activeTab === 'tasks' ? '#3b82f6' : '#111', color: '#fff', border: '1px solid #222', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
          >
            Черга ЧПК ({pendingTasks.length})
          </button>
          <button 
            onClick={() => setActiveTab('operations')}
            style={{ padding: '10px 20px', background: activeTab === 'operations' ? '#3b82f6' : '#111', color: '#fff', border: '1px solid #222', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
          >
            <Database size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '5px' }} />
            Операції станків
          </button>
        </div>

        {activeTab === 'tasks' ? (
          <>
            <div className="eng-stats-bar" style={{ display: 'flex', gap: '15px', marginBottom: '25px', overflowX: 'auto', paddingBottom: '10px' }}>
           <div style={{ flex: 1, minWidth: '150px', background: '#111', padding: '15px', borderRadius: '16px', border: '1px solid #222' }}>
              <div style={{ fontSize: '0.65rem', color: '#555', fontWeight: 800, textTransform: 'uppercase' }}>В ЧЕРЗІ ЧПК</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#3b82f6' }}>{pendingTasks.length}</div>
           </div>
           <div style={{ flex: 1, minWidth: '150px', background: '#111', padding: '15px', borderRadius: '16px', border: '1px solid #222' }}>
              <div style={{ fontSize: '0.65rem', color: '#555', fontWeight: 800, textTransform: 'uppercase' }}>ПІДТВЕРДЖЕНО</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#10b981' }}>{approvedCount}</div>
           </div>
           <div className="hide-mobile" style={{ flex: 2, background: 'rgba(59, 130, 246, 0.05)', padding: '15px', borderRadius: '16px', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <AlertCircle size={20} color="#3b82f6" />
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#888', lineHeight: 1.4 }}>Ваше підтвердження активує кнопки запуску на терміналах операторів верстатів.</p>
           </div>
        </div>

        <div className="eng-grid-layout" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
           {pendingTasks.map(task => {
              const order = orders.find(o => o.id === task.order_id)
              return (
                <div key={task.id} className="eng-task-card glass-panel" style={{ background: '#111', padding: '25px', borderRadius: '24px', border: '1px solid #222', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div className="order-branding">
                         <strong style={{ fontSize: '1.2rem', display: 'block' }}>№{order?.order_num}</strong>
                         <span style={{ fontSize: '0.8rem', color: '#555', fontWeight: 600 }}>{order?.customer}</span>
                      </div>
                      <div style={{ color: '#444', fontSize: '0.75rem', fontWeight: 800 }}><Clock size={12} /> {new Date(task.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                   </div>

                   <div className="spec-review" style={{ background: '#0a0a0a', padding: '15px', borderRadius: '14px', border: '1px solid #1a1a1a' }}>
                      <label style={{ fontSize: '0.6rem', color: '#444', textTransform: 'uppercase', marginBottom: '10px', display: 'block', fontWeight: 900 }}>Програми обробки (ЧПК):</label>
                      {order?.order_items?.map((item, idx) => {
                         const nom = nomenclatures.find(n => n.id === item.nomenclature_id)
                         return (
                           <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                              <FileCode size={16} color="#3b82f6" />
                              <div style={{ flex: 1 }}>
                                 <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{nom?.name}</div>
                                 <div style={{ fontSize: '0.65rem', color: '#3b82f6', fontFamily: 'monospace' }}>{nom?.cnc_program || 'БЕЗ ПРОГРАМИ (CNC_DEFAULT)'}</div>
                              </div>
                           </div>
                         )
                      })}
                   </div>

                   <button 
                     onClick={() => apiService.submitApproveEngineer(task.id, approveEngineer)}
                     style={{ width: '100%', padding: '16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '0.9rem' }}
                   >
                     <ShieldCheck size={20} /> ПІДТВЕРДИТИ ЧПК
                   </button>
                </div>
              )
           })}

           {pendingTasks.length === 0 && (
             <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '80px 20px', color: '#333' }}>
                <CheckCircle2 size={64} style={{ marginBottom: '20px', opacity: 0.1 }} />
                <p style={{ fontSize: '1.2rem', fontWeight: 800 }}>ЧЕРГА ПІДТВЕРДЖЕНЬ ПОРОЖНЯ</p>
                <p style={{ fontSize: '0.9rem' }}>Всі активні наряди успішно опрацьовані інженером</p>
             </div>
           )}
          </div>
          </>
        ) : (
          <MachineOperationsTab />
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .eng-task-card { transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .eng-task-card:hover { transform: translateY(-5px); border-color: #3b82f6; box-shadow: 0 15px 40px rgba(59, 130, 246, 0.15); }
      `}} />
    </div>
  )
}

export default EngineerModule
