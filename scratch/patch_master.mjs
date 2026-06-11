import { readFileSync, writeFileSync } from 'fs'

const filePath = 'a:/centrum/src/modules/MasterModule_v3.jsx'
let src = readFileSync(filePath, 'utf8')
const hasCRLF = src.includes('\r\n')
if (hasCRLF) src = src.replace(/\r\n/g, '\n')

// ── PATCH 1: Add selectedCutters state after reprintTask state ────────────────
const stateAnchor = `  const [reprintTask, setReprintTask] = useState(null)
  // Local cache of ALL orders needed for active tasks (bypasses pagination)
  const [allOrdersMap, setAllOrdersMap] = useState({})`

const stateNew = `  const [reprintTask, setReprintTask] = useState(null)
  const [selectedCutters, setSelectedCutters] = useState({}) // { [consumableName]: inventoryItemId }
  // Local cache of ALL orders needed for active tasks (bypasses pagination)
  const [allOrdersMap, setAllOrdersMap] = useState({})`

if (!src.includes(stateAnchor)) { console.error('PATCH1 anchor not found'); process.exit(1) }
src = src.replace(stateAnchor, stateNew)
console.log('✓ PATCH 1: selectedCutters state added')

// ── PATCH 2: Reset selectedCutters when opening/closing nariad modal ──────────
// a) on open (handleOpenNaryadModal)
const openAnchor = `  const handleOpenNaryadModal = (order, sets, deadline) => {
    setIsReprintMode(false)
    setSelectedMachine(null)`

const openNew = `  const handleOpenNaryadModal = (order, sets, deadline) => {
    setIsReprintMode(false)
    setSelectedCutters({})
    setSelectedMachine(null)`

if (!src.includes(openAnchor)) { console.error('PATCH2a anchor not found'); process.exit(1) }
src = src.replace(openAnchor, openNew)
console.log('✓ PATCH 2a: selectedCutters reset on modal open')

// b) on cancel button (inline onClick)
const cancelAnchor = `setActiveNaryadOrder(null); setReprintTask(null);`
const cancelNew    = `setActiveNaryadOrder(null); setReprintTask(null); setSelectedCutters({});`
if (!src.includes(cancelAnchor)) { console.error('PATCH2b anchor not found'); process.exit(1) }
src = src.replace(cancelAnchor, cancelNew)
console.log('✓ PATCH 2b: selectedCutters reset on cancel')


// ── PATCH 3: Add cutter stock selector UI after consumableSummary display ─────
// We target the end of the consumableSummary block and inject the picker below it

const consumableBlockEnd = `                  </div>
                  </div>
                )
              )}
            </div>

            <div className="no-print" style={{ padding: '30px 40px', background: '#111', borderTop: '1px solid #222', display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>`

const consumableBlockWithCutterPicker = `                  </div>
                  </div>
                )
              )}

              {/* ── ВИБІР ФРЕЗ ЗІ СКЛАДУ ── */}
              {consumableSummary.length > 0 && (() => {
                // Find cutters in consumableSummary (names starting with "фреза")
                const cutterItems = consumableSummary.filter(c => c.name.toLowerCase().startsWith('фреза'))
                if (cutterItems.length === 0) return null

                return (
                  <div className="no-print" style={{ marginTop: '14px', padding: '20px 30px', borderRadius: '18px', border: '1px solid rgba(255,144,0,0.18)', background: 'rgba(255,144,0,0.03)' }}>
                    <h4 style={{ margin: '0 0 14px', fontSize: '0.75rem', fontWeight: 950, color: '#ff9000', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      🔧 ВИБІР ФРЕЗ ЗІ СКЛАДУ
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {cutterItems.map((c, idx) => {
                        // Extract diameter from the consumable name (e.g. "Фреза ф3" → 3, "Фреза кукурудза 2×3,175×..." → look in brackets or explicit number)
                        const nameLower = c.name.toLowerCase()
                        // Try to extract diameter: look for pattern ф<number> or just a number after space
                        const fMatch = nameLower.match(/ф\s*([\d,.]+)/)
                        const parsedDiam = fMatch ? parseFloat(fMatch[1].replace(',', '.')) : null

                        // Filter inventory for consumable cutters with matching diameter
                        const stockCutters = (inventory || []).filter(inv => {
                          const nom = nomenclatures.find(n => String(n.id) === String(inv.nomenclature_id))
                          if (!nom) return false
                          if (!nom.name.toLowerCase().startsWith('фреза')) return false
                          if (inv.type !== 'consumable') return false
                          const availQty = Math.max(0, (Number(inv.total_qty) || 0) - (Number(inv.reserved_qty) || 0))
                          if (availQty <= 0) return false
                          // If we have a parsed diameter, filter by it (from nom name)
                          if (parsedDiam) {
                            const nomNameLower = nom.name.toLowerCase()
                            const nomFMatch = nomNameLower.match(/ф\s*([\d,.]+)|diameter[:\s]*([\d,.]+)|([\d,.]+)\s*(?:мм|mm)/)
                            // Also check the name contains the diameter number
                            if (nomFMatch) {
                              const nomDiam = parseFloat((nomFMatch[1] || nomFMatch[2] || nomFMatch[3] || '0').replace(',', '.'))
                              return Math.abs(nomDiam - parsedDiam) < 0.01
                            }
                            // fallback: check if diameter number appears in name
                            return nomNameLower.includes(String(parsedDiam))
                          }
                          return true
                        })

                        const selectedInvId = selectedCutters[c.name] || ''
                        const selectedInv = stockCutters.find(inv => String(inv.id) === String(selectedInvId))
                        const availQty = selectedInv ? Math.max(0, (Number(selectedInv.total_qty) || 0) - (Number(selectedInv.reserved_qty) || 0)) : null

                        return (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                            <div style={{ minWidth: '180px' }}>
                              <div style={{ fontSize: '0.65rem', color: '#ff9000', fontWeight: 800, marginBottom: '2px' }}>{c.name}</div>
                              <div style={{ fontSize: '0.72rem', color: '#888', fontWeight: 700 }}>Потрібно: <span style={{ color: '#fff', fontWeight: 900 }}>{c.total} ОД.</span></div>
                            </div>
                            <div style={{ flex: 1, minWidth: '260px' }}>
                              <select
                                value={selectedInvId}
                                onChange={e => setSelectedCutters(prev => ({ ...prev, [c.name]: e.target.value }))}
                                style={{
                                  width: '100%',
                                  background: '#0d0d11',
                                  border: selectedInvId ? '1px solid rgba(255,144,0,0.5)' : '1px solid rgba(255,255,255,0.08)',
                                  borderRadius: '10px',
                                  color: '#fff',
                                  padding: '9px 14px',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  outline: 'none',
                                  cursor: 'pointer',
                                  fontFamily: "'Outfit', sans-serif"
                                }}
                              >
                                <option value="">— Оберіть фрезу зі складу —</option>
                                {stockCutters.map(inv => {
                                  const nom = nomenclatures.find(n => String(n.id) === String(inv.nomenclature_id))
                                  const qty = Math.max(0, (Number(inv.total_qty) || 0) - (Number(inv.reserved_qty) || 0))
                                  return (
                                    <option key={inv.id} value={inv.id}>
                                      {nom?.name || inv.name} — {qty} шт на складі
                                    </option>
                                  )
                                })}
                                {stockCutters.length === 0 && (
                                  <option disabled value="">Немає фрез на складі</option>
                                )}
                              </select>
                            </div>
                            {selectedInvId && availQty !== null && (
                              <div style={{
                                fontSize: '0.72rem', fontWeight: 800, padding: '6px 12px', borderRadius: '8px',
                                background: availQty >= c.total ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                color: availQty >= c.total ? '#10b981' : '#ef4444',
                                border: \`1px solid \${availQty >= c.total ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}\`
                              }}>
                                {availQty >= c.total ? '✓ Достатньо' : \`⚠ Не вистачає \${c.total - availQty} шт\`}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>

            <div className="no-print" style={{ padding: '30px 40px', background: '#111', borderTop: '1px solid #222', display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>`

if (!src.includes(consumableBlockEnd)) { console.error('PATCH3 anchor not found'); process.exit(1) }
src = src.replace(consumableBlockEnd, consumableBlockWithCutterPicker)
console.log('✓ PATCH 3: cutter picker UI added in work order modal')

if (hasCRLF) src = src.replace(/\n/g, '\r\n')
writeFileSync(filePath, src, 'utf8')
console.log('✓ MasterModule_v3.jsx written successfully')

// Verify
const verify = readFileSync(filePath, 'utf8')
const checks = [
  'selectedCutters',
  'ВИБІР ФРЕЗ ЗІ СКЛАДУ',
  'setSelectedCutters'
]
let ok = true
for (const c of checks) {
  if (verify.includes(c)) console.log(`  ✓ ${c}`)
  else { console.error(`  ✗ MISSING: ${c}`); ok = false }
}
if (!ok) process.exit(1)
console.log('\nAll MasterModule patches applied!')
