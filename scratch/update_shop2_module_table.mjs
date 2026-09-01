import fs from 'fs'

const filePath = 'b:/kylutsya/src/modules/Shop2Module.jsx'
let content = fs.readFileSync(filePath, 'utf8')

// Replace TH header
const oldTh = `<th style={{ padding: '15px 20px', textAlign: 'center', color: '#eab308', minWidth: '100px' }}>БЗ (ЗАПАС)</th>`
const newTh = `<th style={{ padding: '15px 20px', textAlign: 'center', color: '#8b5cf6', minWidth: '130px' }}>ОТРИМАНО З ЦЕХУ №1</th>`

// Replace TD cell
const oldTd = `<td style={{ padding: '20px', textAlign: 'center', color: '#eab308', fontWeight: 1000, fontSize: '1.4rem' }}>
                                    {displayBz}
                                  </td>`

const newTd = `<td style={{ padding: '20px', textAlign: 'center', color: '#8b5cf6', fontWeight: 1000, fontSize: '1.4rem' }}>
                                    {actualArrived}
                                  </td>`

content = content.replace(/\r\n/g, '\n')
const oldThNorm = oldTh.replace(/\r\n/g, '\n')
const newThNorm = newTh.replace(/\r\n/g, '\n')
const oldTdNorm = oldTd.replace(/\r\n/g, '\n')
const newTdNorm = newTd.replace(/\r\n/g, '\n')

if (content.includes(oldThNorm) && content.includes(oldTdNorm)) {
  content = content.replace(oldThNorm, newThNorm)
  content = content.replace(oldTdNorm, newTdNorm)
  fs.writeFileSync(filePath, content, 'utf8')
  console.log('Successfully updated Shop2Module table headers and cells!')
} else {
  console.error('Target strings not found in Shop2Module.jsx!')
}
