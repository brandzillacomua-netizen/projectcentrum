import fs from 'fs'

const file = fs.readFileSync('a:/centrum/src/modules/Shop1Terminal.jsx', 'utf8')
const lines = file.split('\n')

let found = false
lines.forEach((line, index) => {
  if (line.includes('const handleManualEntry')) {
    found = true
    console.log(`Starts at line ${index + 1}`)
    for (let i = index; i < index + 40; i++) {
      console.log(`${i + 1}: ${lines[i]}`)
    }
  }
})
