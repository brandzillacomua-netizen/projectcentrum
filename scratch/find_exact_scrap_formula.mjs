import fs from 'fs'

const content = fs.readFileSync('b:/kylutsya/src/modules/ForemanWorkplace.jsx', 'utf8')
const lines = content.split('\n')

lines.forEach((line, idx) => {
  if (line.includes('groupBreakdown') || line.includes('util') || line.includes('getScrapBreakdown')) {
    console.log(`L${idx + 1}: ${line.trim()}`)
  }
})
