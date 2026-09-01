import fs from 'fs'

const filePath = 'b:/kylutsya/src/modules/Shop2Module.jsx'
let content = fs.readFileSync(filePath, 'utf8')

// 1. Update th headers
const oldTh = `{!isReworkOrder && (
                          <>
                            <th style={{ padding: '15px 20px', textAlign: 'center', color: '#8b5cf6', minWidth: '130px' }}>ОТРИМАНО З ЦЕХУ №1</th>
                            <th style={{ padding: '15px 20px', textAlign: 'center', minWidth: '160px' }}>ЗАГАЛЬНА КІЛЬКІСТЬ</th>
                          </>
                        )}`

const newTh = `{!isReworkOrder && (
                          <>
                            <th style={{ padding: '15px 20px', textAlign: 'center', color: '#8b5cf6', minWidth: '130px' }}>ОТРИМАНО З ЦЕХУ №1</th>
                            <th style={{ padding: '15px 20px', textAlign: 'center', color: '#eab308', minWidth: '110px' }}>ПРОГНОЗ БЗ</th>
                            <th style={{ padding: '15px 20px', textAlign: 'center', minWidth: '160px' }}>ЗАГАЛЬНА КІЛЬКІСТЬ</th>
                          </>
                        )}`

// 2. Update totalInProcess to totalInWork
const oldProcessCalc = `// Загальна кількість деталей, яка вже пішла в процес (згенеровані робочі карти в Цеху №2)
                          const allShop2CardsForNom = [...(workCards || []), ...(completedCards || []).filter(ac => !(workCards || []).some(wc => wc.id === ac.id))].filter(c =>
                            String(c.task_id) === String(task.id) && String(c.nomenclature_id) === String(item.nom?.id)
                          )
                          const totalInProcess = allShop2CardsForNom.reduce((s, c) => s + (Number(c.quantity) || 0), 0)`

const newProcessCalc = `// Кількість деталей, яка зараз перебуває ТІЛЬКИ в роботі в Цеху №2
                          const allShop2CardsForNom = [...(workCards || []), ...(completedCards || []).filter(ac => !(workCards || []).some(wc => wc.id === ac.id))].filter(c =>
                            String(c.task_id) === String(task.id) && String(c.nomenclature_id) === String(item.nom?.id)
                          )
                          const s2InWorkCards = (workCards || []).filter(c =>
                            String(c.task_id) === String(task.id) &&
                            String(c.nomenclature_id) === String(item.nom?.id) &&
                            (c.status === 'in-progress' || c.status === 'at-buffer' || c.status === 'waiting-buffer' || c.status === 'new')
                          )
                          const totalInWork = s2InWorkCards.reduce((s, c) => s + (Number(c.quantity) || 0), 0)`

// 3. Update table cells
const oldTdBlock = `{!isReworkOrder && (
                                 <>
                                   <td style={{ padding: '20px', textAlign: 'center', color: '#8b5cf6', fontWeight: 1000, fontSize: '1.4rem' }}>
                                     {actualArrived}
                                   </td>
                                   <td style={{ padding: '20px', textAlign: 'center', color: '#3b82f6', fontWeight: 1000, fontSize: '1.4rem' }}>
                                     <div>{actualArrived}/{displayTotal}</div>
                                     {totalInProcess > 0 && (
                                       <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'block', marginTop: '4px', fontWeight: 800 }}>
                                         ({totalInProcess} в роботі)
                                       </span>
                                     )}`

const newTdBlock = `{!isReworkOrder && (
                                 <>
                                   <td style={{ padding: '20px', textAlign: 'center', color: '#8b5cf6', fontWeight: 1000, fontSize: '1.4rem' }}>
                                     {actualArrived}
                                   </td>
                                   <td style={{ padding: '20px', textAlign: 'center', color: '#eab308', fontWeight: 1000, fontSize: '1.4rem' }}>
                                     {displayBz > 0 ? \`+\${displayBz}\` : displayBz}
                                   </td>
                                   <td style={{ padding: '20px', textAlign: 'center', color: '#3b82f6', fontWeight: 1000, fontSize: '1.4rem' }}>
                                     <div>{actualArrived}/{displayTotal}</div>
                                     {totalInWork > 0 && (
                                       <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'block', marginTop: '4px', fontWeight: 800 }}>
                                         ({totalInWork} в роботі)
                                       </span>
                                     )}`

content = content.replace(/\r\n/g, '\n')
const oldThNorm = oldTh.replace(/\r\n/g, '\n')
const newThNorm = newTh.replace(/\r\n/g, '\n')
const oldProcNorm = oldProcessCalc.replace(/\r\n/g, '\n')
const newProcNorm = newProcessCalc.replace(/\r\n/g, '\n')
const oldTdNorm = oldTdBlock.replace(/\r\n/g, '\n')
const newTdNorm = newTdBlock.replace(/\r\n/g, '\n')

if (content.includes(oldThNorm) && content.includes(oldProcNorm) && content.includes(oldTdNorm)) {
  content = content.replace(oldThNorm, newThNorm)
  content = content.replace(oldProcNorm, newProcNorm)
  content = content.replace(oldTdNorm, newTdNorm)
  fs.writeFileSync(filePath, content, 'utf8')
  console.log('Successfully updated Shop2Module columns!')
} else {
  console.error('Failed to match section in Shop2Module.jsx!')
}
