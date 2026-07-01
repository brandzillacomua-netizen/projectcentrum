import fs from 'fs'

const file = fs.readFileSync('a:/centrum/src/modules/KanbanModule.jsx', 'utf8')
const lines = file.split('\n')

lines.forEach((line, index) => {
  if (line.includes('checklist-item') || line.includes('detail-body') || line.includes('detail-modal') || line.includes('detail-main')) {
    console.log(`${index + 1}: ${line.trim()}`)
  }
})
