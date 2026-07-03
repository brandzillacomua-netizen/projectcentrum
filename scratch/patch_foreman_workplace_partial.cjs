const fs = require('fs');

const filePath = 'a:/centrum/src/modules/ForemanWorkplace.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Додаємо materialRequests у деструктуризацію useMES() на лінії 38
const useMesTarget = "createDovyпускMaterialRequests } = useMES()";
if (content.includes(useMesTarget)) {
  content = content.replace(useMesTarget, "createDovyпускMaterialRequests, materialRequests } = useMES()");
  console.log('✅ useMES updated with materialRequests!');
} else {
  console.log('❌ Could not find useMesTarget');
}

// 2. Дозволяємо відображення нарядів з частковим погодженням
const targetRel = "return t.warehouse_conf && t.engineer_conf && t.director_conf && isLaser";
if (content.includes(targetRel)) {
  content = content.replace(targetRel, "return (t.warehouse_conf === true || t.warehouse_conf === 'partial') && t.engineer_conf && t.director_conf && isLaser");
  console.log('✅ relevantTasks checks updated!');
} else {
  console.log('❌ Could not find targetRel');
}

// 3. Інтегруємо getKittingSheets та ліміти перед рендерингом сплітів
const searchGenCount = "const generatedCount = cardsBelongingToThisSplitCount";
const idxGenCount = content.indexOf(searchGenCount);

if (idxGenCount !== -1) {
  // Шукаємо кінець блоку toGen
  const endSearchStr = "const toGen = partialCounts[`${genModal.part.nom?.id}_${sIdx}`] ?? remainingCount";
  const idxEnd = content.indexOf(endSearchStr, idxGenCount);
  
  if (idxEnd !== -1) {
    const replacement = `// Функція для підрахунку виданих та дефіцитних листів
                    const getKittingSheets = (taskObj, partNom) => {
                      const baseMat = partNom?.material_type || ''
                      const taskReqs = (materialRequests || []).filter(r => String(r.task_id) === String(taskObj.id))
                      const sheetReqs = taskReqs.filter(r => {
                        const rNom = nomenclatures.find(n => n.id === r.nomenclature_id)
                        const rName = rNom?.name || r.details || ''
                        const lowerName = rName.toLowerCase()
                        
                        const isSheet = lowerName.includes('лист') || lowerName.includes('sheet')
                        if (!isSheet) return false
                        
                        const activeMaterials = baseMat.split('+').map(m => m.trim().toLowerCase())
                        return activeMaterials.some(act => lowerName.includes(act) || act.includes(lowerName))
                      })
                      
                      const issued = sheetReqs.filter(r => r.status === 'issued' || r.status === 'completed')
                        .reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)
                        
                      const pending = sheetReqs.filter(r => r.status === 'pending')
                        .reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)
                        
                      return { issuedSheets: issued, pendingSheets: pending }
                    }

                    const { issuedSheets, pendingSheets } = getKittingSheets(genModal.task, genModal.part.nom)
                    const generatedCount = cardsBelongingToThisSplitCount
                    const isGenerated = sheetsUsedInThisSplit >= splitSheets
                    const remainingCount = Math.max(0, splitLoadings - generatedCount)

                    // Розраховуємо ліміт карт на основі виданих листів
                    const hasKittingReqs = (materialRequests || []).some(r => String(r.task_id) === String(genModal.task.id))
                    const maxAllowedToGen = hasKittingReqs 
                      ? Math.min(remainingCount, Math.floor(Math.max(0, issuedSheets - sheetsUsedInThisSplit) / currentCapacity))
                      : remainingCount
                    const isKittingBlocked = hasKittingReqs && maxAllowedToGen <= 0

                    const splitGlobalOffsetForThisMachine = currentGlobalOffset
                    currentGlobalOffset += splitLoadings
                    const toGen = Math.min(maxAllowedToGen, partialCounts[\`\${genModal.part.nom?.id}_\${sIdx}\`] ?? remainingCount)`;
                    
    content = content.substring(0, idxGenCount) + replacement + content.substring(idxEnd + endSearchStr.length);
    console.log('✅ Split calculations patched via index!');
  }
} else {
  console.log('❌ Could not find searchGenCount');
}

// 4. Оновлюємо JSX метадані для попозиційних бейджів
const searchMetadata = "Листів: {splitSheets} | Деталей: {splitQty}";
const idxMetadata = content.indexOf(searchMetadata);

if (idxMetadata !== -1) {
  const endMetaSearch = "Всі карти згенеровано ✅</div>}";
  const idxMetaEnd = content.indexOf(endMetaSearch, idxMetadata);
  
  if (idxMetaEnd !== -1) {
    const replacement = `Листів: {splitSheets} | Деталей: {splitQty}
                          </div>
                          {(() => {
                            if (isGenerated) {
                              return <div style={{ fontSize: '0.55rem', color: '#10b981', marginTop: '2px', fontWeight: 900 }}>Всі карти згенеровано ✅</div>
                            }
                            if (!hasKittingReqs) return null;
                            if (issuedSheets === 0) {
                              return (
                                <div style={{ fontSize: '0.6rem', color: '#ef4444', fontWeight: 900, marginTop: '4px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                                  ⚠️ Очікуємо погодження складу (немає листів)
                                </div>
                              )
                            }
                            if (pendingSheets > 0) {
                              return (
                                <div style={{ fontSize: '0.6rem', color: '#eab308', fontWeight: 900, marginTop: '4px', background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.15)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                                  ⏳ Видано: {issuedSheets} л. | Очікуємо видачу {pendingSheets} листів з СО
                                </div>
                              )
                            }
                            return (
                              <div style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 900, marginTop: '4px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                                ✅ ГОТОВО ДО ЗАПУСКУ ({issuedSheets} л. видано)
                              </div>
                            )
                          })()}`;
                          
    content = content.substring(0, idxMetadata) + replacement + content.substring(idxMetaEnd + endMetaSearch.length);
    console.log('✅ Split metadata badges patched via index!');
  }
} else {
  console.log('❌ Could not find searchMetadata');
}

// 5. Оновлюємо кнопку генерації
const searchBtn = "disabled={isGenerating}";
// Шукаємо кнопку генерації після посилання на handleGenerateFromWorksheet
const idxBtn = content.indexOf(searchBtn, idxMetadata);

if (idxBtn !== -1) {
  const endBtnSearch = "{isGenerating ? 'ОБРОБКА...' : 'ГЕНЕРУВАТИ'}\r\n                            </button>";
  let idxBtnEnd = content.indexOf(endBtnSearch, idxBtn);
  if (idxBtnEnd === -1) {
    // Спробуємо LF варіант
    idxBtnEnd = content.indexOf("{isGenerating ? 'ОБРОБКА...' : 'ГЕНЕРУВАТИ'}\n                            </button>", idxBtn);
  }
  
  if (idxBtnEnd !== -1) {
    const replacement = `disabled={isGenerating || isKittingBlocked}
                              onClick={() => {
                                const finalToGen = Math.min(toGen, remainingCount)
                                if (finalToGen <= 0) return

                                handleGenerateFromWorksheet(
                                  genModal.task,
                                  genModal.part,
                                  splitSheets,
                                  split.machine,
                                  finalToGen,
                                  generatedCount,
                                  splitQty,
                                  genModal.isRepair,
                                  globalTotalLoadings,
                                  splitGlobalOffsetForThisMachine,
                                  currentCapacity
                                )
                              }}
                              style={{ 
                                background: isGenerating ? '#333' : (isKittingBlocked ? '#1e1b18' : '#10b981'), 
                                color: isKittingBlocked ? '#7f1d1d' : '#fff', 
                                border: isKittingBlocked ? '1px solid rgba(239,68,68,0.2)' : 'none',
                                padding: '10px 15px', 
                                borderRadius: '10px', 
                                fontSize: '0.7rem', 
                                fontWeight: 950, 
                                cursor: (isGenerating || isKittingBlocked) ? 'not-allowed' : 'pointer', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '5px', 
                                pointerEvents: (isGenerating || isKittingBlocked) ? 'none' : 'auto' 
                              }}
                            >
                              {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Printer size={12} />}
                              {isGenerating ? 'ОБРОБКА...' : (isKittingBlocked ? 'НЕМАЄ ЛИСТІВ' : 'ГЕНЕРУВАТИ')}`;
                              
    content = content.substring(0, idxBtn) + replacement + content.substring(content.indexOf('</button>', idxBtn));
    console.log('✅ Split action button patched via index!');
  } else {
    console.log('❌ Could not find button end marker');
  }
} else {
  console.log('❌ Could not find searchBtn');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('🏁 Save complete.');
