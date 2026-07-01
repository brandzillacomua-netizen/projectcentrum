import fs from 'fs'

const file = fs.readFileSync('a:/centrum/src/modules/KanbanModule.jsx', 'utf8')
const lines = file.split('\n')

lines.forEach((line, index) => {
  if (line.includes('canEdit') && line.includes('=')) {
    console.log(`${index + 1}: ${line.trim()}`)
  }
})
