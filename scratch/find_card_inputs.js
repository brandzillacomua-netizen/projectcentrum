import fs from 'fs'

const file = fs.readFileSync('a:/centrum/src/modules/Shop1Terminal.jsx', 'utf8')
const lines = file.split('\n')

lines.forEach((line, index) => {
  if (line.includes('<input') || line.includes('type="text"') || line.includes('placeholder')) {
    console.log(`${index + 1}: ${line.trim()}`)
  }
})
