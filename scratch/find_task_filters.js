import fs from 'fs'

const file = fs.readFileSync('a:/centrum/src/modules/KanbanModule.jsx', 'utf8')
const lines = file.split('\n')

lines.forEach((line, index) => {
  if (line.includes('is_collective') || line.includes('filteredTasks') || line.includes('getTaskDepartment')) {
    console.log(`${index + 1}: ${line.trim()}`)
  }
})
