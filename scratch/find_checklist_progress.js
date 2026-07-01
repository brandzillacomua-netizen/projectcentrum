import fs from 'fs'

const file = fs.readFileSync('a:/centrum/src/modules/KanbanModule.jsx', 'utf8')
const lines = file.split('\n')

lines.forEach((line, index) => {
  if (line.includes('checklistProgress')) {
    console.log(`Line ${index + 1}: ${line.trim()}`)
    for (let i = index; i < index + 15; i++) {
      console.log(`${i + 1}: ${lines[i]}`)
    }
  }
})
