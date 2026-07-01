import fs from 'fs'

const file = fs.readFileSync('a:/centrum/src/modules/Shop2Terminal.jsx', 'utf8')
const lines = file.split('\n')

lines.forEach((line, index) => {
  if (line.includes('useState(')) {
    console.log(`${index + 1}: ${line.trim()}`)
  }
})
