import fs from 'fs'

const filePath = 'a:/centrum/src/modules/MasterModule_v3.jsx'
let content = fs.readFileSync(filePath, 'utf8')

// 1. We will add a completely new print-only layout inside the modal.
// We will insert it just before the closing tag of `worksheet-modal-overlay`.

const modalEndStr = `          </div>\n        </div>\n      )}`
const indexOfModalEnd = content.lastIndexOf(modalEndStr)

if (indexOfModalEnd === -1) {
    console.error('Could not find modal end string.')
}

const printOnlyTemplate = `
          {/* THE SEPARATE 100% CLEAN PRINT TEMPLATE */}
          <div className="print-only-target">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '24pt', fontWeight: 'bold' }}>
                НАРЯД № {activeNaryadOrder.order_num}
                {(() => {
                  if (activeNaryadOrder.isPrepOrder) return '';
                  if (isReprintMode && reprintTask) return reprintTask.batch_index ? \`/\${reprintTask.batch_index}\` : '';
                  const totalUnits = activeNaryadOrder.order_items?.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0) || 0;
                  const thisNaryadTotal = Object.values(naryadQtys).reduce((acc, v) => acc + (Number(v) || 0), 0) || 0;
                  const alreadyPlanned = tasks.filter(t => String(t.order_id) === String(activeNaryadOrder.id)).reduce((acc, t) => acc + (Number(t.planned_sets) || 0), 0);
                  if (thisNaryadTotal < totalUnits || alreadyPlanned > 0) {
                     const orderTasks = tasks.filter(t => String(t.order_id) === String(activeNaryadOrder.id));
                     const maxBatchIndex = orderTasks.reduce((max, t) => Math.max(max, Number(t.batch_index) || 0), 0);
                     return \`/\${maxBatchIndex + 1}\`;
                  }
                  return '';
                })()}
              </h2>
            </div>

            <div style={{ border: '2px solid #000', padding: '10px', marginBottom: '20px', borderRadius: '8px' }}>
              <div style={{ fontSize: '14pt', fontWeight: 'bold', marginBottom: '10px', textDecoration: 'underline' }}>
                ВИРІБ: {productNames || '—'}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '8pt', fontWeight: 'bold' }}>ЗАМОВНИК</div>
                  <div style={{ fontSize: '11pt', fontWeight: 'bold' }}>{activeNaryadOrder.customer}</div>
                </div>
                <div>
                  <div style={{ fontSize: '8pt', fontWeight: 'bold' }}>ДАТА ФОРМУВАННЯ</div>
                  <div style={{ fontSize: '11pt', fontWeight: 'bold' }}>{new Date().toLocaleDateString('uk-UA')}</div>
                </div>
                <div>
                  <div style={{ fontSize: '8pt', fontWeight: 'bold' }}>ДЕДЛАЙН НА ЦЮ ПАРТІЮ</div>
                  <div style={{ fontSize: '11pt', fontWeight: 'bold' }}>
                    {(() => {
                      if (activeNaryadOrder.isPrepOrder) return '—';
                      if (isReprintMode && reprintTask) return reprintTask.deadline ? new Date(reprintTask.deadline).toLocaleDateString('uk-UA') : '—';
                      let localDeadline = Object.values(naryadDeadlines).find(d => d);
                      if (localDeadline) return new Date(localDeadline).toLocaleDateString('uk-UA');
                      if (activeNaryadOrder.deadline) return new Date(activeNaryadOrder.deadline).toLocaleDateString('uk-UA');
                      return '—';
                    })()}
                  </div>
                </div>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #000', padding: '4px', width: '45%', textAlign: 'left', fontSize: '9pt', background: '#eee' }}>ДЕТАЛЬ В РОЗКРІЙ</th>
                  <th style={{ border: '1px solid #000', padding: '4px', width: '10%', textAlign: 'center', fontSize: '9pt', background: '#eee' }}>ПЛАН</th>
                  <th style={{ border: '1px solid #000', padding: '4px', width: '23%', textAlign: 'left', fontSize: '9pt', background: '#eee' }}>МАТЕРІАЛ</th>
                  <th style={{ border: '1px solid #000', padding: '4px', width: '7%', textAlign: 'center', fontSize: '9pt', background: '#eee' }}>ШТ/Л</th>
                  <th style={{ border: '1px solid #000', padding: '4px', width: '7%', textAlign: 'center', fontSize: '9pt', background: '#eee' }}>ЛИСТІВ</th>
                  <th style={{ border: '1px solid #000', padding: '4px', width: '8%', textAlign: 'center', fontSize: '9pt', background: '#eee' }}>БЗ</th>
                </tr>
              </thead>
              <tbody>
                {activeNaryadOrder.order_items?.map(it => {
                  const nom = nomenclatures.find(n => n.id === it.nomenclature_id)
                  const thisNaryadQty = isReprintMode ? Number(it.quantity) : (naryadQtys[it.id] || 0)
                  if (thisNaryadQty <= 0) return null

                  if (activeNaryadOrder.isPrepOrder) {
                    return (
                      <tr key={it.id}>
                        <td style={{ border: '1px solid #000', padding: '4px', fontSize: '9pt', wordWrap: 'break-word', wordBreak: 'break-all' }}>
                          <strong>{nom?.name || '—'}</strong>
                        </td>
                        <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontSize: '11pt', fontWeight: 'bold' }}>{thisNaryadQty.toString()}</td>
                        <td style={{ border: '1px solid #000', padding: '4px', fontSize: '9pt' }}>{nom?.name || '—'}</td>
                        <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontSize: '9pt' }}>1</td>
                        <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontSize: '11pt', fontWeight: 'bold' }}>{thisNaryadQty.toString()}</td>
                        <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontSize: '10pt', fontWeight: 'bold' }}>0</td>
                      </tr>
                    )
                  }

                  const parts = getBOMParts(it.nomenclature_id)
                  const allParts = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === it.nomenclature_id), quantity_per_parent: 1 }]
                  const displayParts = allParts.filter(p => p.nom?.type === 'part' || p.nom?.type === 'raw' || !p.nom?.type)
                  
                  return displayParts.map((part, pIdx) => {
                    const snapshot = reprintTask?.plan_snapshot?.[String(part.nom?.id)]
                    const totalNeeded = snapshot ? snapshot.need : (thisNaryadQty * (Number(part.quantity_per_parent) || 1))
                    const inStock = snapshot ? snapshot.stock : (() => {
                      const bzInv = inventory.find(i => String(i.nomenclature_id) === String(part.nom?.id) && i.type === 'bz')
                      return bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0
                    })()
                    const totalToProduce = snapshot ? snapshot.plan : Math.max(0, totalNeeded - inStock)
                    const unitsPerSheet = Number(part.nom?.units_per_sheet) || 1
                    const sheets = Math.ceil(totalToProduce / unitsPerSheet)

                    return (
                      <tr key={\`\${it.id}-\${pIdx}\`}>
                        <td style={{ border: '1px solid #000', padding: '4px', fontSize: '9pt', wordWrap: 'break-word', wordBreak: 'break-all' }}>
                          <strong>{part.nom?.name || '—'}</strong>
                        </td>
                        <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontSize: '11pt', fontWeight: 'bold' }}>{totalToProduce.toString()}</td>
                        <td style={{ border: '1px solid #000', padding: '4px', fontSize: '9pt' }}>{part.nom?.material_type || '—'}</td>
                        <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontSize: '9pt' }}>{unitsPerSheet.toString()}</td>
                        <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontSize: '11pt', fontWeight: 'bold' }}>{totalToProduce > 0 ? (sheets || 0).toString() : '0'}</td>
                        <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontSize: '10pt', fontWeight: 'bold' }}>{totalToProduce > 0 ? \`+\${(sheets * unitsPerSheet) - totalToProduce}\` : '0'}</td>
                      </tr>
                    )
                  })
                })}
              </tbody>
              <tfoot style={{ background: '#eee' }}>
                {(() => {
                  let totalPlan = 0;
                  let totalSheets = 0;
                  if (activeNaryadOrder.isPrepOrder) {
                    activeNaryadOrder.order_items?.forEach(it => {
                      totalPlan += Number(it.quantity);
                      totalSheets += Number(it.quantity);
                    });
                  } else {
                    activeNaryadOrder.order_items?.forEach(it => {
                      const thisNaryadQty = isReprintMode ? Number(it.quantity) : (naryadQtys[it.id] || 0);
                      const parts = getBOMParts(it.nomenclature_id);
                      const allParts = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === it.nomenclature_id), quantity_per_parent: 1 }];
                      const displayParts = allParts.filter(p => p.nom?.type === 'part' || p.nom?.type === 'raw' || !p.nom?.type);
                      displayParts.forEach(part => {
                        const snapshot = reprintTask?.plan_snapshot?.[String(part.nom?.id)];
                        const need = snapshot ? snapshot.need : (thisNaryadQty * (Number(part.quantity_per_parent) || 1));
                        const inStock = snapshot ? snapshot.stock : (() => {
                          const bzInv = inventory.find(i => String(i.nomenclature_id) === String(part.nom?.id) && i.type === 'bz');
                          return bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0;
                        })();
                        const plan = snapshot ? snapshot.plan : Math.max(0, need - inStock);
                        const unitsPerSheet = Number(part.nom?.units_per_sheet) || 1;
                        const sheets = Math.ceil(plan / unitsPerSheet);
                        totalPlan += plan;
                        if (plan > 0) totalSheets += sheets;
                      });
                    });
                  }
                  return (
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold', fontSize: '10pt', textTransform: 'uppercase' }}>ЗАГАЛЬНИЙ ПІДСУМОК:</td>
                      <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontWeight: 'bold', fontSize: '12pt' }}>{totalPlan.toString()}</td>
                      <td style={{ border: '1px solid #000', padding: '4px' }}></td>
                      <td style={{ border: '1px solid #000', padding: '4px' }}></td>
                      <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontWeight: 'bold', fontSize: '12pt' }}>{totalSheets.toString()}</td>
                      <td style={{ border: '1px solid #000', padding: '4px' }}></td>
                    </tr>
                  )
                })()}
              </tfoot>
            </table>

            <div style={{ border: '2px solid #000', padding: '10px', marginTop: '15px', borderRadius: '8px' }}>
              <div style={{ fontSize: '9pt', fontWeight: 'bold', marginBottom: '10px' }}>ВІДОМІСТЬ МАТЕРІАЛІВ:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
                {(() => {
                   let matMap = {};
                   if (!activeNaryadOrder.isPrepOrder) {
                     activeNaryadOrder.order_items?.forEach(it => {
                       const thisNaryadQty = isReprintMode ? Number(it.quantity) : (naryadQtys[it.id] || 0);
                       const parts = getBOMParts(it.nomenclature_id);
                       const allParts = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === it.nomenclature_id), quantity_per_parent: 1 }];
                       const displayParts = allParts.filter(p => p.nom?.type === 'part' || p.nom?.type === 'raw' || !p.nom?.type);
                       displayParts.forEach(part => {
                         const matName = part.nom?.material_type;
                         if (matName) {
                           const snapshot = reprintTask?.plan_snapshot?.[String(part.nom?.id)];
                           const need = snapshot ? snapshot.need : (thisNaryadQty * (Number(part.quantity_per_parent) || 1));
                           const inStock = snapshot ? snapshot.stock : (() => {
                             const bzInv = inventory.find(i => String(i.nomenclature_id) === String(part.nom?.id) && i.type === 'bz');
                             return bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0;
                           })();
                           const plan = snapshot ? snapshot.plan : Math.max(0, need - inStock);
                           const unitsPerSheet = Number(part.nom?.units_per_sheet) || 1;
                           const sheets = Math.ceil(plan / unitsPerSheet);
                           if (sheets > 0) {
                              if (!matMap[matName]) matMap[matName] = 0;
                              matMap[matName] += sheets;
                           }
                         }
                       });
                     });
                   }
                   return Object.entries(matMap).map(([mat, count], idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '4px', height: '30px', background: '#000' }}></div>
                        <div>
                           <div style={{ fontSize: '7pt', fontWeight: 'bold' }}>{mat}</div>
                           <div style={{ fontSize: '14pt', fontWeight: 'bold' }}>{count} <span style={{ fontSize: '8pt', fontWeight: 'normal' }}>листів</span></div>
                        </div>
                      </div>
                   ));
                })()}
              </div>
            </div>
          </div>\n`

content = content.substring(0, indexOfModalEnd) + printOnlyTemplate + content.substring(indexOfModalEnd)

// 2. We need to update the CSS to ensure ONLY print-only-target is visible during print.
// In the current @media print, we hide a lot of things. Let's completely replace the @media print block.

const cssBlockRegex = /@media print \{[\s\S]*?\n\s*\}/
if (!cssBlockRegex.test(content)) {
    console.error("Could not find @media print block.")
}

const cleanPrintCss = \`@media print {
          @page { 
            size: A4 portrait; 
            margin: 0; 
          }
          body * {
            visibility: hidden;
          }
          .worksheet-modal-overlay, .worksheet-modal-overlay * {
            visibility: hidden;
          }
          .print-only-target, .print-only-target * {
            visibility: visible !important;
          }
          .print-only-target {
            position: absolute !important;
            left: 0;
            top: 0;
            width: 210mm !important;
            min-height: 297mm !important;
            padding: 10mm !important;
            box-sizing: border-box !important;
            background: white !important;
            display: block !important;
            color: black !important;
          }
          .worksheet-panel {
            display: none !important;
          }
          /* Reset table layout strictly for this new table */
          .print-only-target table {
             width: 100% !important;
             max-width: 100% !important;
             border-collapse: collapse !important;
             table-layout: fixed !important;
          }
          .print-only-target th, .print-only-target td {
             word-wrap: break-word !important;
             overflow-wrap: break-word !important;
             word-break: break-all !important;
             white-space: normal !important;
             vertical-align: middle !important;
          }
          /* We don't need UI-specific hide classes here because this is a clean template */
        }\`

// We need to replace the entire CSS string in dangerouslySetInnerHTML
// Wait, the string is very long. I will just replace the @media print block.

const fullStyleRegex = /@media print \{[\s\S]*?\n\s*\}/
content = content.replace(fullStyleRegex, cleanPrintCss)

// 3. Since we don't rely on the UI table for printing anymore, we can remove the 'no-print' and 'print-td-hide' hacks from it.
// Actually, it's safer to just leave the UI table alone, it has no impact on print anymore!
// And wait, the user's "ВЕРСТАТ", "ПОТРЕБА", "СКЛАД БЗ" are still in the UI, which is fine, the user only complained about the print out!
// The user said: "Оцю таблицю треба там розмістити щоб убо видно але без колонок ВЕРСТАТ ПОТРЕБА СКЛАД БЗ". This means in the printed form!

fs.writeFileSync(filePath, content, 'utf8')
console.log('DONE')
