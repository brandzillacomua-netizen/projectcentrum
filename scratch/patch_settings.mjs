import { readFileSync, writeFileSync } from 'fs'

const filePath = 'a:/centrum/src/modules/SettingsModule.jsx'
let src = readFileSync(filePath, 'utf8')
// Normalize CRLF → LF for reliable string matching
const hasCRLF = src.includes('\r\n')
if (hasCRLF) src = src.replace(/\r\n/g, '\n')

// ── PATCH 1: Add cutter state variables ──────────────────────────────────────
const stateOld = `  const [sheetsPreviewList, setSheetsPreviewList] = useState([])

  // Tabs: users, structure, system`

const stateNew = `  const [sheetsPreviewList, setSheetsPreviewList] = useState([])

  // Cutter (фрези) stock upload states
  const [cuttersFile, setCuttersFile] = useState(null)
  const [cuttersRecordMode, setCuttersRecordMode] = useState('overwrite')
  const [cuttersUploadStatus, setCuttersUploadStatus] = useState('idle')
  const [cuttersUploadLog, setCuttersUploadLog] = useState('')
  const [cuttersPreviewList, setCuttersPreviewList] = useState([])

  // Tabs: users, structure, system`

if (!src.includes(stateOld)) { console.error('PATCH1 anchor not found'); process.exit(1) }
src = src.replace(stateOld, stateNew)
console.log('✓ PATCH 1: state vars added')

// ── PATCH 2: Add cutter handler functions before parseCSV ────────────────────
const parseCSVAnchor = `  const parseCSV = (text, delimiter = ';') => {`

const cutterHandlers = `  // ── CUTTER (ФРЕЗИ) UPLOAD HELPERS ──

  const handleCuttersFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setCuttersFile(file)
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target.result
      const delim = detectDelimiter(text)
      const parsed = parseCSV(text, delim)
      if (parsed.length > 0) {
        processCuttersCSV(parsed)
      } else {
        alert('Помилка: файл порожній або має невірний формат.')
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  const processCuttersCSV = (parsedCsv) => {
    const headers = parsedCsv[0]
    const nameColIdx = headers.findIndex(h => {
      const n = h.toLowerCase().trim()
      return n.includes('номенклатура') || n.includes('назва') || n === 'name'
    })
    const diamColIdx = headers.findIndex(h => {
      const n = h.toLowerCase().trim()
      return n.includes('діаметр') || n.includes('diameter')
    })
    let qtyColIdx = headers.findIndex(h => h.toLowerCase().includes('залишок'))
    if (qtyColIdx === -1) qtyColIdx = headers.findIndex(h => {
      const n = h.toLowerCase().trim()
      return n.includes('склад') || n.includes('кількість') || n === 'qty'
    })
    if (nameColIdx === -1) {
      alert('Помилка: не знайдено колонку «Номенклатура».')
      return
    }
    const rows = parsedCsv.slice(1)
    const items = []
    rows.forEach((row, idx) => {
      const name = row[nameColIdx] ? row[nameColIdx].trim() : ''
      if (!name || !name.toLowerCase().startsWith('фреза')) return
      const rawDiam = diamColIdx !== -1 ? (row[diamColIdx] || '').replace(',', '.').trim() : ''
      const diameter = parseFloat(rawDiam) || 0
      const rawQty = qtyColIdx !== -1 ? (row[qtyColIdx] || '').trim() : ''
      const qty = parseInt(rawQty) || 0
      if (qty <= 0) return
      items.push({ name, diameter, qty, rowNum: idx + 2 })
    })
    items.sort((a, b) => {
      if (a.diameter !== b.diameter) return a.diameter - b.diameter
      return a.name.localeCompare(b.name, 'uk')
    })
    setCuttersPreviewList(items)
    setCuttersUploadStatus('preview')
  }

  const executeCuttersUpload = async () => {
    setCuttersUploadStatus('uploading')
    setCuttersUploadLog('Початок завантаження залишків фрез...\\n')
    const existingInventory = inventory || []
    const updates = []
    const inserts = []
    try {
      const dbNomMap = {}
      nomenclatures.forEach(n => { dbNomMap[normalizeHomoglyphs(n.name)] = n })
      setCuttersUploadLog(prev => prev + \`Обробка \${cuttersPreviewList.length} позицій фрез...\\n\`)
      for (const item of cuttersPreviewList) {
        const normName = normalizeHomoglyphs(item.name)
        let nomRecord = dbNomMap[normName]
        if (!nomRecord) {
          const { data: newNom, error: nomErr } = await supabase
            .from('nomenclatures')
            .insert([{ name: item.name, type: 'consumable' }])
            .select().single()
          if (nomErr) {
            setCuttersUploadLog(prev => prev + \`  ⚠️ [НОМ ПОМИЛКА] \${item.name}: \${nomErr.message}\\n\`)
            continue
          }
          setCuttersUploadLog(prev => prev + \`  ✅ [НОМ СТВОРЕНО] \${newNom.name} (ID: \${newNom.id})\\n\`)
          nomRecord = newNom
          dbNomMap[normName] = newNom
        }
        const existingInv = existingInventory.find(i =>
          i.warehouse === 'operational' &&
          String(i.nomenclature_id) === String(nomRecord.id) &&
          i.type === 'consumable'
        )
        if (existingInv) {
          const newTotal = cuttersRecordMode === 'add'
            ? (Number(existingInv.total_qty) || 0) + item.qty
            : item.qty
          updates.push({
            id: existingInv.id, nomenclature_id: nomRecord.id, name: item.name,
            type: 'consumable', warehouse: 'operational', unit: 'шт',
            total_qty: newTotal, reserved_qty: existingInv.reserved_qty || 0,
            updated_at: new Date().toISOString()
          })
          setCuttersUploadLog(prev => prev + \`[ОНОВИТИ] \${item.name}: \${newTotal} шт (Ø\${item.diameter})\\n\`)
        } else {
          inserts.push({
            nomenclature_id: nomRecord.id, name: item.name,
            type: 'consumable', warehouse: 'operational', unit: 'шт',
            total_qty: item.qty, reserved_qty: 0,
            updated_at: new Date().toISOString()
          })
          setCuttersUploadLog(prev => prev + \`[НОВИЙ] \${item.name}: \${item.qty} шт (Ø\${item.diameter})\\n\`)
        }
      }
      setCuttersUploadLog(prev => prev + \`\\nНадсилання змін до Supabase...\\n\`)
      const batchOps = []
      if (updates.length > 0) batchOps.push(supabase.from('inventory').upsert(updates))
      if (inserts.length > 0) batchOps.push(supabase.from('inventory').insert(inserts))
      const results = await Promise.all(batchOps)
      for (const res of results) { if (res.error) throw res.error }
      setCuttersUploadLog(prev => prev + \`✅ Успішно оновлено базу даних!\\n\`)
      setCuttersUploadStatus('success')
      refreshTable('inventory')
      refreshTable('nomenclatures')
    } catch (err) {
      setCuttersUploadLog(prev => prev + \`❌ Помилка запису в БД: \${err.message || err}\\n\`)
      setCuttersUploadStatus('error')
    }
  }

  const parseCSV = (text, delimiter = ';') => {`

if (!src.includes(parseCSVAnchor)) { console.error('PATCH2 anchor not found'); process.exit(1) }
src = src.replace(parseCSVAnchor, cutterHandlers)
console.log('✓ PATCH 2: handler functions added')

// ── PATCH 3: Add Cutters UI section in the system tab (after SO section) ─────
// The SO section ends with a specific error block + </section> + </div>
// We find this unique closing sequence and inject the cutters panel before </div>

const soSectionEnd = `            </section>

          </div>
        )}
      </div>`

const cuttersUI = `            </section>

            {/* ── ЗАВАНТАЖЕННЯ ЗАЛИШКІВ ФРЕЗ (СКЛАД) ── */}
            <section className="settings-panel glass-panel" style={{ background: '#0e0e11', padding: '30px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.04)', gridColumn: '1 / -1' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000' }}>
                <Layers size={20} /> ЗАВАНТАЖЕННЯ ЗАЛИШКІВ ФРЕЗ (СКЛАД)
              </h3>
              <p style={{ fontSize: '0.72rem', color: '#555', marginTop: 0, marginBottom: '24px', lineHeight: '1.5' }}>
                Завантажте CSV-файл залишків фрез зі складу. Колонки: <strong style={{ color: '#ff9000' }}>«Номенклатура»</strong>, <strong style={{ color: '#60a5fa' }}>«Діаметр ріжучої частини»</strong>, <strong style={{ color: '#10b981' }}>«Залишок на складі»</strong>. Сортуються автоматично за діаметром.
              </p>

              {cuttersUploadStatus === 'idle' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ border: '2px dashed rgba(255,144,0,0.3)', borderRadius: '18px', padding: '36px 20px', textAlign: 'center', background: 'rgba(255,144,0,0.01)', cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative', maxWidth: '520px' }}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#ff9000'; e.currentTarget.style.background = 'rgba(255,144,0,0.04)' }}
                    onDragLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,144,0,0.3)'; e.currentTarget.style.background = 'rgba(255,144,0,0.01)' }}
                    onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) handleCuttersFileChange({ target: { files: [file] } }) }}
                  >
                    <input id="cutters-file-input" type="file" accept=".csv" onChange={handleCuttersFileChange} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                    <Upload size={38} color="#ff9000" style={{ marginBottom: '14px', opacity: 0.8 }} />
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', fontWeight: 800 }}>Оберіть або перетягніть CSV файл</h4>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: '#666', fontWeight: 600 }}>«Номенклатура» | «Діаметр ріжучої частини» | «Залишок на складі»</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 700 }}>Режим запису:</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {[{ v: 'overwrite', label: '✎ Перезаписати (рекомендовано)' }, { v: 'add', label: '+ Додати до наявного' }].map(opt => (
                        <button key={opt.v} onClick={() => setCuttersRecordMode(opt.v)} type="button" style={{
                          background: cuttersRecordMode === opt.v ? 'rgba(255,144,0,0.12)' : 'transparent',
                          border: cuttersRecordMode === opt.v ? '1px solid #ff9000' : '1px solid rgba(255,255,255,0.07)',
                          color: cuttersRecordMode === opt.v ? '#ff9000' : '#888',
                          padding: '6px 14px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s'
                        }}>{opt.label}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {cuttersUploadStatus === 'preview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                    {[
                      { label: 'Всього фрез', val: cuttersPreviewList.length, color: '#ff9000' },
                      { label: 'Унікальних діаметрів', val: new Set(cuttersPreviewList.map(i => i.diameter)).size, color: '#60a5fa' },
                      { label: 'Загальна кількість', val: cuttersPreviewList.reduce((s, i) => s + i.qty, 0), color: '#10b981' },
                    ].map(s => (
                      <div key={s.label} style={{ background: 'rgba(0,0,0,0.25)', border: \`1px solid \${s.color}22\`, borderRadius: '14px', padding: '12px 20px', minWidth: '160px' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: s.color }}>{s.val}</div>
                        <div style={{ fontSize: '0.68rem', color: '#888', fontWeight: 700, marginTop: '2px' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ maxHeight: '380px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', background: 'rgba(0,0,0,0.12)' }} className="custom-scroll">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#666' }}>
                          <th style={{ padding: '10px 16px' }}>Назва фрези</th>
                          <th style={{ padding: '10px 16px', textAlign: 'center', color: '#60a5fa' }}>Ø Діаметр (мм)</th>
                          <th style={{ padding: '10px 16px', textAlign: 'center', color: '#10b981' }}>Залишок (шт)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cuttersPreviewList.map((item, i) => {
                          const prevDiam = i > 0 ? cuttersPreviewList[i - 1].diameter : null
                          const isNewGroup = prevDiam !== item.diameter
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', background: isNewGroup && i > 0 ? 'rgba(255,144,0,0.02)' : 'transparent' }}>
                              <td style={{ padding: '10px 16px', fontWeight: 700, color: '#eee' }}>{item.name}</td>
                              <td style={{ padding: '10px 16px', textAlign: 'center', color: '#60a5fa', fontWeight: 900 }}>
                                {isNewGroup && <span style={{ display: 'inline-block', background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '8px', padding: '2px 10px' }}>Ø {item.diameter}</span>}
                              </td>
                              <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 900, color: '#10b981', fontSize: '1rem' }}>{item.qty}</td>
                            </tr>
                          )
                        })}
                        {cuttersPreviewList.length === 0 && <tr><td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: '#555' }}>Жодної фрези не знайдено</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 700 }}>Режим запису:</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {[{ v: 'overwrite', label: '✎ Перезаписати' }, { v: 'add', label: '+ Додати' }].map(opt => (
                          <button key={opt.v} onClick={() => setCuttersRecordMode(opt.v)} type="button" style={{
                            background: cuttersRecordMode === opt.v ? 'rgba(255,144,0,0.12)' : 'transparent',
                            border: cuttersRecordMode === opt.v ? '1px solid #ff9000' : '1px solid rgba(255,255,255,0.07)',
                            color: cuttersRecordMode === opt.v ? '#ff9000' : '#888',
                            padding: '6px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s'
                          }}>{opt.label}</button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button type="button" onClick={() => { setCuttersUploadStatus('idle'); setCuttersFile(null); setCuttersPreviewList([]) }} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#aaa', padding: '12px 22px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>← НАЗАД</button>
                      <button type="button" onClick={executeCuttersUpload} disabled={cuttersPreviewList.length === 0} style={{ background: cuttersPreviewList.length === 0 ? '#222' : 'linear-gradient(135deg, #ff9000, #ff6a00)', border: 'none', color: cuttersPreviewList.length === 0 ? '#555' : '#000', padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 900, cursor: cuttersPreviewList.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Upload size={16} /> ЗАПИСАТИ В СИСТЕМУ ({cuttersPreviewList.length} фрез)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {cuttersUploadStatus === 'uploading' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', padding: '30px 0' }}>
                  <div className="spinner-mes" style={{ width: '44px', height: '44px', borderRadius: '50%', border: '3px solid rgba(255,144,0,0.15)', borderTopColor: '#ff9000', animation: 'spin 1s linear infinite' }} />
                  <div style={{ fontSize: '0.85rem', color: '#aaa', fontWeight: 700 }}>Запис залишків фрез у базу...</div>
                  <pre style={{ background: '#000', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '14px', color: '#00ff66', fontFamily: 'monospace', fontSize: '0.7rem', width: '100%', maxWidth: '640px', maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap', margin: 0 }} className="custom-scroll">{cuttersUploadLog}</pre>
                </div>
              )}

              {cuttersUploadStatus === 'success' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0' }}>
                  <CheckCircle2 size={52} color="#10b981" />
                  <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>ЗАВАНТАЖЕННЯ ЗАВЕРШЕНО УСПІШНО!</h4>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#aaa', textAlign: 'center' }}>Залишки фрез оновлено. Нач. цеху може обрати фрезу зі складу при формуванні наряду.</p>
                  <pre style={{ background: '#000', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '14px', color: '#00ff66', fontFamily: 'monospace', fontSize: '0.7rem', width: '100%', maxWidth: '640px', maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap', margin: 0 }} className="custom-scroll">{cuttersUploadLog}</pre>
                  <button type="button" onClick={() => { setCuttersUploadStatus('idle'); setCuttersFile(null); setCuttersPreviewList([]); setCuttersUploadLog('') }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', marginTop: '6px' }}>
                    ЗАВАНТАЖИТИ НАСТУПНИЙ ФАЙЛ
                  </button>
                </div>
              )}

              {cuttersUploadStatus === 'error' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0' }}>
                  <AlertCircle size={52} color="#ef4444" />
                  <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>ПОМИЛКА ПРИ ЗАПИСІ</h4>
                  <pre style={{ background: '#000', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '14px', color: '#ef4444', fontFamily: 'monospace', fontSize: '0.7rem', width: '100%', maxWidth: '640px', maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap', margin: 0 }} className="custom-scroll">{cuttersUploadLog}</pre>
                  <button type="button" onClick={() => setCuttersUploadStatus('preview')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}>
                    ← ПОВЕРНУТИСЬ ДО ПЕРЕГЛЯДУ
                  </button>
                </div>
              )}

            </section>

          </div>
        )}
      </div>`

// Count occurrences of soSectionEnd to ensure unique match
const count = src.split(soSectionEnd).length - 1
console.log(`Occurrences of soSectionEnd anchor: ${count}`)
if (count !== 1) { console.error('PATCH3 anchor not unique or not found'); process.exit(1) }
src = src.replace(soSectionEnd, cuttersUI)
console.log('✓ PATCH 3: cutters UI section inserted in system tab')

// ── PATCH 4: Add cutter selection dropdown in MasterModule_v3 ────────────────
// This is the second part of the task - in the work order modal, after consumableSummary
// display, add a per-diameter cutter picker. We'll patch MasterModule_v3.jsx separately.

if (hasCRLF) src = src.replace(/\n/g, '\r\n')
writeFileSync(filePath, src, 'utf8')
console.log('✓ SettingsModule.jsx written successfully')


// Verify
const verify = readFileSync(filePath, 'utf8')
const checks = [
  'cuttersUploadStatus',
  'handleCuttersFileChange',
  'executeCuttersUpload',
  'ЗАВАНТАЖЕННЯ ЗАЛИШКІВ ФРЕЗ'
]
let ok = true
for (const c of checks) {
  if (verify.includes(c)) {
    console.log(`  ✓ ${c}`)
  } else {
    console.error(`  ✗ MISSING: ${c}`)
    ok = false
  }
}
if (!ok) process.exit(1)
console.log('\nAll patches applied successfully!')
