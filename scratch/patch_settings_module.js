import fs from 'fs'
import { execSync } from 'child_process'

const filePath = 'a:/centrum/src/modules/SettingsModule.jsx'

// Discard all changes to start fresh
execSync('git checkout -- a:/centrum/src/modules/SettingsModule.jsx')
console.log("Restored original SettingsModule.jsx from git.")

const content = fs.readFileSync(filePath, 'utf8')
const lines = content.split(/\r?\n/)

// 1. Insert state variables and functions at line 135 (0-based: 134)
const stateInsert = `  // Snapshot correction state
  const [corrSearchQuery, setCorrSearchQuery] = useState('')
  const [corrFoundTasks, setCorrFoundTasks] = useState([])
  const [corrSelectedTask, setCorrSelectedTask] = useState(null)
  const [corrSnapshotParts, setCorrSnapshotParts] = useState([])
  const [corrIsSaving, setCorrIsSaving] = useState(false)
  const [corrSearchLoading, setCorrSearchLoading] = useState(false)

  const handleSearchTasks = async () => {
    if (!corrSearchQuery.trim()) return
    setCorrSearchLoading(true)
    setCorrFoundTasks([])
    setCorrSelectedTask(null)
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_num, customer')
        .ilike('order_num', \`%\${corrSearchQuery.trim()}%\`)
      
      if (ordersError) throw ordersError
      
      if (ordersData && ordersData.length > 0) {
        const orderIds = ordersData.map(o => o.id)
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('*')
          .in('order_id', orderIds)
          .order('created_at', { ascending: false })
          
        if (tasksError) throw tasksError
        
        const mapped = (tasksData || []).map(t => {
          const ord = ordersData.find(o => o.id === t.order_id)
          return {
            ...t,
            order_num: ord ? ord.order_num : 'Невідомо',
            customer: ord ? ord.customer : 'Невідомо'
          }
        })
        setCorrFoundTasks(mapped)
      } else {
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('*, orders(order_num, customer)')
          .eq('id', corrSearchQuery.trim())
        if (!tasksError && tasksData && tasksData.length > 0) {
          const mapped = tasksData.map(t => ({
            ...t,
            order_num: t.orders ? t.orders.order_num : 'Невідомо',
            customer: t.orders ? t.orders.customer : 'Невідомо'
          }))
          setCorrFoundTasks(mapped)
        }
      }
    } catch (err) {
      console.error(err)
      alert('Помилка пошуку нарядів: ' + err.message)
    } finally {
      setCorrSearchLoading(false)
    }
  }

  const handleSelectTask = (task) => {
    setCorrSelectedTask(task)
    if (task && task.plan_snapshot) {
      const parts = []
      Object.entries(task.plan_snapshot).forEach(([key, val]) => {
        if (key !== 'materialSummary' && key !== 'selectedCutters' && key !== 'consumables' && !key.startsWith('_')) {
          parts.push({
            nomenclature_id: key,
            id: val.id || key,
            name: val.name || 'Без назви',
            code: val.code || 'Без коду',
            need: Number(val.need) || 0,
            stock: Number(val.stock) || 0,
            plan: Number(val.plan) || 0,
            sheets: Number(val.sheets) || 0,
            sheets_t300: Number(val.sheets_t300) || 0,
            sheets_t700: Number(val.sheets_t700) || 0,
            units_per_sheet: Number(val.units_per_sheet) || 1,
            material: val.material || '',
            order_item_id: val.order_item_id || '',
            selected_machine: val.selected_machine || val.machine || '',
            cutter_override: val.cutter_override || '2',
            splits: val.splits || []
          })
        }
      })
      setCorrSnapshotParts(parts)
    } else {
      setCorrSnapshotParts([])
    }
  }

  const handlePartStockChange = (nomId, val) => {
    const newStock = Math.max(0, parseInt(val) || 0)
    setCorrSnapshotParts(prev => prev.map(p => {
      if (p.nomenclature_id === nomId) {
        const newPlan = Math.max(0, p.need - newStock)
        const unitsPerSheet = p.units_per_sheet || 1
        const newSheets = Math.ceil(newPlan / unitsPerSheet)
        const isT700 = (p.material || p.name || '').toLowerCase().includes('т700') || (p.material || p.name || '').toLowerCase().includes('t700')
        return {
          ...p,
          stock: newStock,
          plan: newPlan,
          sheets: newSheets,
          sheets_t300: isT700 ? 0 : newSheets,
          sheets_t700: isT700 ? newSheets : 0
        }
      }
      return p
    }))
  }

  const handlePartSheetsChange = (nomId, val) => {
    const newSheets = Math.max(0, parseInt(val) || 0)
    setCorrSnapshotParts(prev => prev.map(p => {
      if (p.nomenclature_id === nomId) {
        const isT700 = (p.material || p.name || '').toLowerCase().includes('т700') || (p.material || p.name || '').toLowerCase().includes('t700')
        return {
          ...p,
          sheets: newSheets,
          sheets_t300: isT700 ? 0 : newSheets,
          sheets_t700: isT700 ? newSheets : 0
        }
      }
      return p
    }))
  }

  const handleSaveCorrection = async () => {
    if (!corrSelectedTask) return
    if (!window.confirm('Ви впевнені, що хочете зберегти ці зміни снапшоту? Це оновить дані в наряді, запитах матеріалів та картах БЗ.')) return
    
    setCorrIsSaving(true)
    try {
      const taskId = corrSelectedTask.id
      const orderId = corrSelectedTask.order_id
      
      const { data: siblingTasks, error: siblingErr } = await supabase
        .from('tasks')
        .select('*')
        .eq('order_id', orderId)
        
      if (siblingErr) throw siblingErr

      const { data: materialRequests, error: matErr } = await supabase
        .from('material_requests')
        .select('*')
        .eq('task_id', taskId)
        
      if (matErr) throw matErr

      const { data: workCardsData, error: wcErr } = await supabase
        .from('work_cards')
        .select('*')
        .eq('task_id', taskId)
        
      if (wcErr) throw wcErr

      const dbWrites = []

      for (const siblingTask of (siblingTasks || [])) {
        const currentSnap = siblingTask.plan_snapshot || {}
        const newSnap = { ...currentSnap }
        
        corrSnapshotParts.forEach(p => {
          newSnap[p.nomenclature_id] = {
            id: p.id,
            name: p.name,
            code: p.code,
            need: p.need,
            stock: p.stock,
            plan: p.plan,
            sheets: p.sheets,
            sheets_t300: p.sheets_t300,
            sheets_t700: p.sheets_t700,
            material: p.material,
            order_item_id: p.order_item_id,
            selected_machine: p.selected_machine,
            machine: p.selected_machine,
            cutter_override: p.cutter_override,
            splits: p.splits,
            units_per_sheet: p.units_per_sheet
          }
        })
        
        if (newSnap.materialSummary) {
          const newMatSummary = { ...newSnap.materialSummary }
          
          corrSnapshotParts.forEach(p => {
            Object.entries(newMatSummary).forEach(([matId, matInfo]) => {
              if (matInfo.components) {
                const hasComp = matInfo.components.some(c => c.startsWith(p.name + ':'))
                if (hasComp) {
                  newMatSummary[matId] = {
                    ...matInfo,
                    sheets: p.sheets,
                    totalUnits: p.plan,
                    components: [\`\${p.name}: \${p.plan}шт\`]
                  }
                }
              }
            })
          })
          newSnap.materialSummary = newMatSummary
        }
        
        dbWrites.push(
          supabase.from('tasks').update({ plan_snapshot: newSnap }).eq('id', siblingTask.id)
        )
      }

      corrSnapshotParts.forEach(p => {
        const matchingRequest = (materialRequests || []).find(r => 
          r.details && 
          r.details.includes('СКЛАД ОПЕРАТИВНИЙ:') && 
          r.details.includes(p.name)
        )
        if (matchingRequest) {
          const cleanMatName = matchingRequest.details.match(/СКЛАД ОПЕРАТИВНИЙ:\\s*(.*?)\\s*—/)?.[1] || 'Лист'
          const updatedDetails = \`СКЛАД ОПЕРАТИВНИЙ: \${cleanMatName} — \${p.sheets} л. (Разом: \${p.plan} шт | Для: \${p.name}: \${p.plan}шт)\`
          
          dbWrites.push(
            supabase.from('material_requests').update({
              quantity: p.sheets,
              details: updatedDetails
            }).eq('id', matchingRequest.id)
          )
        }
      })

      corrSnapshotParts.forEach(p => {
        const bzCard = (workCardsData || []).find(c => 
          String(c.nomenclature_id) === String(p.nomenclature_id) && 
          c.card_info && 
          c.card_info.includes('[ЗІ СКЛАДУ БЗ]')
        )
        
        if (bzCard) {
          if (p.stock > 0) {
            dbWrites.push(
              supabase.from('work_cards').update({ quantity: p.stock }).eq('id', bzCard.id)
            )
            dbWrites.push(
              supabase.from('work_card_history').update({
                qty_at_start: p.stock,
                qty_completed: p.stock
              }).eq('card_id', bzCard.id)
            )
          } else {
            dbWrites.push(
              supabase.from('work_cards').delete().eq('id', bzCard.id)
            )
            dbWrites.push(
              supabase.from('work_card_history').delete().eq('card_id', bzCard.id)
            )
          }
        } else if (p.stock > 0) {
          const createCard = async () => {
            const { data: insertedCard, error: insErr } = await supabase
              .from('work_cards')
              .insert([{
                task_id: taskId,
                order_id: orderId,
                nomenclature_id: p.nomenclature_id,
                quantity: p.stock,
                status: 'completed',
                operation: 'Склад БЗ',
                card_info: '[ЗІ СКЛАДУ БЗ]'
              }])
              .select()
              .single()
            if (!insErr && insertedCard) {
              await supabase.from('work_card_history').insert([{
                card_id: insertedCard.id,
                nomenclature_id: p.nomenclature_id,
                stage_name: 'Склад БЗ',
                operator_name: 'Склад (БРОНЬ)',
                qty_at_start: p.stock,
                qty_completed: p.stock,
                scrap_qty: 0,
                completed_at: new Date().toISOString()
              }])
            }
          }
          dbWrites.push(createCard())
        }
      })

      await Promise.all(dbWrites)
      alert('Зміни успішно збережено та застосовано!')
      
      refreshTable('tasks')
      refreshTable('material_requests')
      refreshTable('work_cards')
      
      const { data: updatedTask } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single()
        
      if (updatedTask) {
        const ord = siblingTasks[0]?.order_num ? siblingTasks[0] : { order_num: corrSelectedTask.order_num, customer: corrSelectedTask.customer }
        handleSelectTask({
          ...updatedTask,
          order_num: ord.order_num,
          customer: ord.customer
        })
      }
      
      setCorrFoundTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            plan_snapshot: updatedTask.plan_snapshot
          }
        }
        return t
      }))
    } catch (e) {
      console.error(e)
      alert('Помилка збереження змін: ' + e.message)
    } finally {
      setCorrIsSaving(false)
    }
  }
`

const importLogLineIndex = lines.findIndex(line => line.includes("const [importLog, setImportLog] = useState('')"))
lines.splice(importLogLineIndex + 1, 0, stateInsert)
console.log("Successfully inserted states and functions at line:", importLogLineIndex + 2)

// 2. Insert the corrections tab button (indices have shifted, so search again)
const systemButtonIndex = lines.findIndex((line) => {
  return line.includes("setActiveTab('system')")
})
let systemButtonEndIndex = -1
for (let i = systemButtonIndex; i < systemButtonIndex + 10; i++) {
  if (lines[i].trim() === ')}') {
    systemButtonEndIndex = i
    break
  }
}

const buttonInsert = `            {isAdmin && (
              <button onClick={() => setActiveTab('corrections')} className={\`tab-btn-v2 \${activeTab === 'corrections' ? 'active' : ''}\`}>
                <Sliders size={16} /> КОРЕКЦІЯ СНАПШОТІВ
              </button>
            )}`

lines.splice(systemButtonEndIndex + 1, 0, buttonInsert)
console.log("Successfully inserted tab button at line:", systemButtonEndIndex + 2)

// 3. Find index of "CSV IMPORT WIZARD MODAL" comment (indices have shifted)
const csvModalIndex = lines.findIndex((line) => {
  return line.includes('CSV IMPORT WIZARD MODAL')
})

let panelEndIndex = -1
for (let i = csvModalIndex - 1; i > csvModalIndex - 10; i--) {
  if (lines[i].trim() === ')}') {
    panelEndIndex = i
    break
  }
}

const correctionsPanel = `
        {/* ── TAB 4: SNAPSHOT CORRECTIONS ── */}
        {activeTab === 'corrections' && isAdmin && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            <section className="settings-panel glass-panel" style={{ background: '#0e0e11', padding: '30px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000' }}>
                <Sliders size={20} /> Адмін-корекція запусків та БЗ снапшотів
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#888', marginTop: 0, marginBottom: '24px', lineHeight: '1.5' }}>
                Тут ви можете скоригувати зафіксовані в нарядах дані по БЗ (Буферній Зоні). Система автоматично перерахує кількість деталей до випуску та необхідні листи, а також оновить відповідні запити матеріалів на складі й робочі картки БЗ.
              </p>
              
              <div style={{ display: 'flex', gap: '12px', maxWidth: '600px', marginBottom: '24px' }}>
                <input
                  style={{
                    width: '100%',
                    background: '#000',
                    border: '1px solid rgba(255,255,255,0.05)',
                    color: '#fff',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    fontSize: '0.85rem',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    fontFamily: 'inherit'
                  }}
                  value={corrSearchQuery}
                  onChange={e => setCorrSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearchTasks()}
                  placeholder="Введіть номер наряду (напр: 30062026-01)"
                />
                <button
                  onClick={handleSearchTasks}
                  disabled={corrSearchLoading}
                  style={{
                    background: 'linear-gradient(135deg, #ff9000, #ff6a00)',
                    color: '#000',
                    border: 'none',
                    padding: '0 24px',
                    borderRadius: '12px',
                    fontWeight: 900,
                    cursor: corrSearchLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Search size={16} /> Пошук
                </button>
              </div>

              {corrSearchLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '20px 0' }}>
                  <div className="spinner-mes" style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid rgba(255,144,0,0.15)', borderTopColor: '#ff9000', animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: '0.78rem', color: '#aaa' }}>Пошук нарядів...</span>
                </div>
              )}

              {corrFoundTasks.length > 0 && !corrSelectedTask && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: 900, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Знайдені наряди:</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '15px' }}>
                    {corrFoundTasks.map(t => (
                      <div
                        key={t.id}
                        onClick={() => handleSelectTask(t)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid rgba(255,255,255,0.05)',
                          borderRadius: '16px',
                          padding: '16px',
                          cursor: 'pointer',
                          transition: '0.2s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,144,0,0.3)'; e.currentTarget.style.background = 'rgba(255,144,0,0.02)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                      >
                        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#fff' }}>№ {t.order_num}{t.batch_index ? \`/\${t.batch_index}\` : ''}</div>
                        <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Клієнт: {t.customer}</div>
                        <div style={{ fontSize: '0.7rem', color: '#ff9000', marginTop: '8px', fontWeight: 700 }}>Етап: {t.step} | Стан: {t.status}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {corrFoundTasks.length === 0 && corrSearchQuery && !corrSearchLoading && (
                <div style={{ fontSize: '0.8rem', color: '#555', padding: '10px 0' }}>Нарядів не знайдено. Спробуйте інший пошуковий запит.</div>
              )}
            </section>

            {corrSelectedTask && (
              <section className="glass-panel" style={{ background: '#0e0e11', padding: '30px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 950, color: '#fff' }}>
                      Редагування наряду № {corrSelectedTask.order_num}{corrSelectedTask.batch_index ? \`/\${corrSelectedTask.batch_index}\` : ''}
                    </h3>
                    <div style={{ fontSize: '0.78rem', color: '#888', marginTop: '4px' }}>
                      Клієнт: {corrSelectedTask.customer} | Поточний крок: <strong style={{ color: '#ff9000' }}>{corrSelectedTask.step}</strong>
                    </div>
                  </div>
                  <button
                    onClick={() => setCorrSelectedTask(null)}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: '#fff',
                      padding: '8px 16px',
                      borderRadius: '10px',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    Назад до списку
                  </button>
                </div>

                <div style={{ border: '1px solid rgba(255,255,255,0.04)', borderRadius: '16px', background: 'rgba(0,0,0,0.12)', overflowX: 'auto', marginBottom: '24px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#666' }}>
                        <th style={{ padding: '12px 16px' }}>Деталь / Код</th>
                        <th style={{ padding: '12px 16px' }}>Матеріал</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center' }}>Потреба</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', color: '#ff9000' }}>Взято з БЗ (Запас)</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center' }}>План до виготовлення</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center' }}>В листі (шт)</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', color: '#60a5fa' }}>Листів</th>
                      </tr>
                    </thead>
                    <tbody>
                      {corrSnapshotParts.map(p => (
                        <tr key={p.nomenclature_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 800, color: '#fff' }}>{p.name}</div>
                            <div style={{ fontSize: '0.68rem', color: '#444', marginTop: '2px' }}>{p.code}</div>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#888' }}>{p.material}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700 }}>{p.need}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <input
                              type="number"
                              value={p.stock}
                              onChange={e => handlePartStockChange(p.nomenclature_id, e.target.value)}
                              style={{
                                background: '#000',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                color: '#ff9000',
                                padding: '6px 10px',
                                width: '100px',
                                textAlign: 'center',
                                fontWeight: 800,
                                fontSize: '0.85rem'
                              }}
                            />
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 800, color: '#aaa' }}>{p.plan}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', color: '#666' }}>{p.units_per_sheet}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <input
                              type="number"
                              value={p.sheets}
                              onChange={e => handlePartSheetsChange(p.nomenclature_id, e.target.value)}
                              style={{
                                background: '#000',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                color: '#60a5fa',
                                padding: '6px 10px',
                                width: '80px',
                                textAlign: 'center',
                                fontWeight: 800,
                                fontSize: '0.85rem'
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button
                    onClick={() => handleSelectTask(corrSelectedTask)}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      color: '#aaa',
                      padding: '12px 24px',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    Скинути зміни
                  </button>
                  <button
                    onClick={handleSaveCorrection}
                    disabled={corrIsSaving}
                    style={{
                      background: 'linear-gradient(135deg, #ff9000, #ff6a00)',
                      color: '#000',
                      border: 'none',
                      padding: '12px 30px',
                      borderRadius: '12px',
                      fontWeight: 900,
                      cursor: corrIsSaving ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {corrIsSaving ? 'Збереження...' : 'Зберегти зміни'}
                  </button>
                </div>
              </section>
            )}
          </div>
        )}
`

lines.splice(panelEndIndex + 1, 0, correctionsPanel)
console.log("Successfully inserted tab panel at line:", panelEndIndex + 2)

fs.writeFileSync(filePath, lines.join('\r\n'), 'utf8')
console.log("ALL PATCHES APPLIED SUCCESSFULLY!")
