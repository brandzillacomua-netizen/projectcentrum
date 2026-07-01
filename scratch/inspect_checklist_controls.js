import fs from 'fs'

const file = fs.readFileSync('a:/centrum/src/modules/KanbanModule.jsx', 'utf8')
const lines = file.split('\n')

lines.forEach((line, index) => {
  if (line.includes('підпункт') || line.includes('Новий пункт чеклисту') || line.includes('form-control') || line.includes('date') || line.includes('dueDate') || line.includes('due_date')) {
    if (line.includes('isAdmin') || line.includes('creator') || line.includes('role') || line.includes('access') || line.includes('user') || line.includes('button') || line.includes('input') || line.includes('onClick')) {
      console.log(`${index + 1}: ${line.trim()}`)
    }
  }
})
