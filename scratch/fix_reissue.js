const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'modules', 'ForemanWorkplace.jsx');
let c = fs.readFileSync(file, 'utf8');

const p1 = /const\s+capacity\s*=\s*isRepair\s*\?\s*1\s*:\s*\(\s*Number\(\s*machineObj\?\.sheet_capacity\s*\)\s*\|\|\s*1\s*\)/;
const r1 = 'const capacity = (Number(machineObj?.sheet_capacity) || 1)';

const p2 = /setGenModal\(\{\s*task,\s*part:\s*\{\s*nom\s*\},\s*total:\s*sheetsNeeded,\s*requirement:\s*shortage,\s*created:\s*0,\s*machineName,\s*sheets:\s*sheetsNeeded,\s*isRepair:\s*true\s*\}\)/;
const r2 = `const unitsPerSheet = Number(nom?.units_per_sheet) || 1;
                                      const sheetsNeeded = Math.ceil(shortage / unitsPerSheet);
                                      const machineName = activeCards[0]?.machine || (machines && machines[0]?.name) || '—';
                                      const machineObj = (machines || []).find(m => m.name === machineName);
                                      const capacity = Number(machineObj?.sheet_capacity) || 1;
                                      const cardsNeeded = Math.ceil(sheetsNeeded / capacity);
                                      setGenModal({
                                        task,
                                        part: { nom },
                                        total: cardsNeeded,
                                        requirement: shortage,
                                        created: 0,
                                        machineName,
                                        sheets: sheetsNeeded,
                                        isRepair: true
                                      })`;

const p3 = /\)\s*:\s*\(\s*<>\s*<div\s+style=\{\{\s*background:\s*'#080808'[\s\S]*?<\/button>\s*<\/>\s*\)/;
const r3 = `) : (
              <>
                {genModal.isRepair ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px' }}>
                    {/* Machine selector */}
                    <div>
                      <label style={{ display: 'block', color: '#888', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>
                        Оберіть верстат для довипуску:
                      </label>
                      <select
                        value={genModal.machineName}
                        onChange={(e) => {
                          const newMachineName = e.target.value
                          const newMachineObj = (machines || []).find(m => m.name === newMachineName)
                          const newCapacity = Number(newMachineObj?.sheet_capacity) || 1
                          const newCardsNeeded = Math.ceil(genModal.sheets / newCapacity)
                          setGenModal(prev => ({
                            ...prev,
                            machineName: newMachineName,
                            total: newCardsNeeded
                          }))
                        }}
                        style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '15px', borderRadius: '15px', fontSize: '0.95rem', outline: 'none', fontWeight: 800 }}
                      >
                        {(machines || []).map(m => (
                          <option key={m.id} value={m.name}>{m.name} (місткість: {m.sheet_capacity || 1} л.)</option>
                        ))}
                      </select>
                    </div>

                    {/* Deficit info cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                      <div style={{ background: '#080808', padding: '15px', borderRadius: '15px', border: '1px solid #1a1a1a', textAlign: 'center' }}>
                        <div style={{ color: '#555', fontSize: '0.65rem', fontWeight: 800 }}>НЕОБХІДНО ЛИСТІВ:</div>
                        <div style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 950, marginTop: '4px' }}>{genModal.sheets} л.</div>
                      </div>
                      <div style={{ background: '#080808', padding: '15px', borderRadius: '15px', border: '1px solid #1a1a1a', textAlign: 'center' }}>
                        <div style={{ color: '#555', fontSize: '0.65rem', fontWeight: 800 }}>КІЛЬКІСТЬ КАРТ:</div>
                        <div style={{ color: '#ff9000', fontSize: '1.2rem', fontWeight: 950, marginTop: '4px' }}>{genModal.total} шт.</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: '#080808', padding: '20px', borderRadius: '20px', border: '1px solid #1a1a1a', marginBottom: '30px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                      <span style={{ color: '#555', fontSize: '0.75rem', fontWeight: 800 }}>СТАТУС:</span>
                      <span style={{ color: '#3b82f6', fontSize: '0.75rem', fontWeight: 900 }}>Згенеровано {genModal.created} з {genModal.total}</span>
                    </div>
                    <div style={{ height: '6px', background: '#1a1a1a', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: \`\${(genModal.created / genModal.total) * 100}%\`, height: '100%', background: '#3b82f6', transition: '0.3s' }} />
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: '30px' }}>
                  <label style={{ display: 'block', color: '#888', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '10px', textAlign: 'center' }}>
                    {genModal.isRepair ? 'Кількість карт до друку' : 'Скільки ще карт згенерувати?'}
                  </label>
                  <input
                    type="number"
                    id="gen_count_input"
                    value={genModal.total}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value) || 1)
                      setGenModal(prev => ({ ...prev, total: val }))
                    }}
                    min="1"
                    style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', fontSize: '2.5rem', fontWeight: 950, textAlign: 'center', padding: '15px', borderRadius: '20px', outline: 'none', borderInline: '4px solid #10b981' }}
                  />
                </div>

                <button
                  onClick={() => {
                    const v = parseInt(document.getElementById('gen_count_input').value)
                    if (v > 0) {
                      handleGenerateFromWorksheet(genModal.task, genModal.part, genModal.sheets, genModal.machineName, v, genModal.created, genModal.requirement, genModal.isRepair)
                      setGenModal(null)
                    }
                  }}
                  style={{ width: '100%', background: '#10b981', color: '#fff', padding: '22px', borderRadius: '22px', fontSize: '1rem', fontWeight: 950, cursor: 'pointer', border: 'none', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 10px 20px -5px rgba(16, 185, 129, 0.4)' }}
                >
                  ПІДТВЕРДИТИ ТА ДРУКУВАТИ
                </button>
              </>
            )`;

console.log('Testing P1:', p1.test(c));
console.log('Testing P2:', p2.test(c));
console.log('Testing P3:', p3.test(c));

if (p1.test(c) && p2.test(c) && p3.test(c)) {
  fs.writeFileSync(file, c.replace(p1, r1).replace(p2, r2).replace(p3, r3), 'utf8');
  console.log('Successfully updated ForemanWorkplace.jsx!');
} else {
  console.log('Error: One or more patterns failed to match!');
}
