import fs from 'fs'

const file = fs.readFileSync('a:/centrum/src/modules/KanbanModule.jsx', 'utf8')
const lines = file.split('\n')

const idx = lines.findIndex(line => line.includes('Новий пункт чеклисту'))
console.log("Found query at line:", idx + 1)
if (idx !== -1) {
  for (let i = Math.max(0, idx - 120); i < Math.min(lines.length, idx + 40); i++) {
    console.log(`${i + 1}: ${lines[i]}`)
  }
}
