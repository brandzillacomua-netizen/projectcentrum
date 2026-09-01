import fs from 'fs'

const filePath = 'b:/kylutsya/src/modules/Shop2Module.jsx'
let content = fs.readFileSync(filePath, 'utf8')
const lines = content.replace(/\r\n/g, '\n').split('\n')

// 1. Replace lines 917 to 922 (0-indexed: 917 to 922)
// Line 918 is `{!isReworkOrder && (`
const thReplacement = [
  '                        {!isReworkOrder && (',
  '                          <>',
  '                            <th style={{ padding: \'15px 20px\', textAlign: \'center\', color: \'#8b5cf6\', minWidth: \'130px\' }}>ОТРИМАНО З ЦЕХУ №1</th>',
  '                            <th style={{ padding: \'15px 20px\', textAlign: \'center\', color: \'#eab308\', minWidth: \'110px\' }}>ПРОГНОЗ БЗ</th>',
  '                            <th style={{ padding: \'15px 20px\', textAlign: \'center\', minWidth: \'160px\' }}>ЗАГАЛЬНА КІЛЬКІСТЬ</th>',
  '                          </>'
]

// Replace 917..922
lines.splice(917, 6, ...thReplacement)

// 2. Insert totalInWork calc around line 990 (adjusted line index after thReplacement insertion)
// Find lines matching `const totalInProcess = `
const procIndex = lines.findIndex(l => l.includes('const totalInProcess ='))
if (procIndex !== -1) {
  lines.splice(procIndex, 1, 
    '                          const s2InWorkCards = (workCards || []).filter(c => String(c.task_id) === String(task.id) && String(c.nomenclature_id) === String(item.nom?.id) && (c.status === \'in-progress\' || c.status === \'at-buffer\' || c.status === \'waiting-buffer\' || c.status === \'new\'))',
    '                          const totalInWork = s2InWorkCards.reduce((s, c) => s + (Number(c.quantity) || 0), 0)'
  )
}

// 3. Update table cells
const cellIndex = lines.findIndex(l => l.includes('color: \'#8b5cf6\', fontWeight: 1000, fontSize: \'1.4rem\''))
if (cellIndex !== -1) {
  // Find where `({totalInProcess} в роботі)` is:
  const inWorkIndex = lines.findIndex((l, i) => i > cellIndex && l.includes('{totalInProcess} в роботі'))
  if (inWorkIndex !== -1) {
    lines[inWorkIndex] = lines[inWorkIndex].replace('{totalInProcess} в роботі', '{totalInWork} в роботі').replace('totalInProcess > 0', 'totalInWork > 0')
  }

  // Insert predicted BZ td cell before `<td style={{ padding: '20px', textAlign: 'center', color: '#3b82f6'`
  const td3bIndex = lines.findIndex((l, i) => i >= cellIndex && l.includes('color: \'#3b82f6\''))
  if (td3bIndex !== -1) {
    const bzCell = [
      '                                   <td style={{ padding: \'20px\', textAlign: \'center\', color: \'#eab308\', fontWeight: 1000, fontSize: \'1.4rem\' }}>',
      '                                     {displayBz > 0 ? `+${displayBz}` : displayBz}',
      '                                   </td>'
    ]
    lines.splice(td3bIndex, 0, ...bzCell)
  }
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf8')
console.log('Successfully updated Shop2Module table!')
